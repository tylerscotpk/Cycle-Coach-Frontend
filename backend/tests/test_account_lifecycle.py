"""Account deletion + undo cancellation + sync plan resolution. Stripe is fully mocked: no real API calls/charges."""
import time
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
import stripe

import server
from database import db
from routes.auth import hash_password
from routes import stripe as stripe_routes

PW = "Passw0rd!"
NOW = int(time.time())


@pytest.fixture(autouse=True)
def block_real_stripe(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("Real Stripe call attempted")
    for cls in (stripe.Subscription, stripe.Invoice, stripe.InvoicePayment, stripe.Refund, stripe.Customer):
        for name in ("retrieve", "modify", "cancel", "list", "create"):
            if hasattr(cls, name):
                monkeypatch.setattr(cls, name, boom, raising=False)
    monkeypatch.setattr(stripe.checkout.Session, "list", boom, raising=False)


@pytest_asyncio.fixture(loop_scope="module")
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as c:
        yield c


async def make_user(**fields):
    uid = str(uuid.uuid4())
    email = f"del_{uid[:8]}@test.com"
    await db.auth_users.insert_one({"id": uid, "email": email, "password_hash": hash_password(PW), "is_active": True,
                                    "email_verified": True, "plan_type": "none", "created_at": datetime.now(timezone.utc).isoformat(), **fields})
    token = secrets.token_urlsafe(24)
    await db.user_sessions.insert_one({"user_id": uid, "session_token": token,
                                       "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()})
    await db.partner_profiles.insert_one({"id": f"p_{uid}", "user_id": uid, "name": "x"})
    await db.cycle_history.insert_one({"id": f"c_{uid}", "partner_id": f"p_{uid}"})
    await db.ai_conversations.insert_one({"user_id": uid, "partner_id": f"p_{uid}", "message": "hi"})
    return uid, email, {"Authorization": f"Bearer {token}"}


def sub_obj(sid, status="active", cancel_at_period_end=False, cancel_at=None, start=NOW - 10 * 86400, end=NOW + 20 * 86400):
    return {"id": sid, "status": status, "cancel_at_period_end": cancel_at_period_end, "cancel_at": cancel_at,
            "latest_invoice": f"in_{sid}", "metadata": {"tier": "advanced"}, "trial_end": None,
            "items": {"data": [{"id": "si_1", "price": {"id": stripe_routes.ADVANCED_PRICE_ID},
                                "current_period_start": start, "current_period_end": end}]}}


def mock_billing(monkeypatch, subs, calls, fail_cancel=False):
    monkeypatch.setattr(stripe.Subscription, "list", lambda **k: SimpleNamespace(data=list(subs.values())))
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda sid: subs[sid])
    monkeypatch.setattr(stripe.Invoice, "retrieve", lambda iid: {"id": iid, "amount_paid": 800, "currency": "usd"})
    monkeypatch.setattr(stripe.InvoicePayment, "list", lambda **k: SimpleNamespace(
        data=[{"status": "paid", "payment": {"payment_intent": "pi_123"}}]), raising=False)

    def refund(**k):
        calls.setdefault("refunds", []).append(k)
        return {"id": "re_1"}

    def cancel(sid, **k):
        if fail_cancel:
            raise stripe.APIConnectionError("down")
        calls.setdefault("cancelled", []).append((sid, k))
        subs[sid]["status"] = "canceled"
        return subs[sid]
    monkeypatch.setattr(stripe.Refund, "create", refund)
    monkeypatch.setattr(stripe.Subscription, "cancel", cancel)


async def assert_purged(uid, email):
    assert await db.auth_users.find_one({"id": uid}) is None
    assert await db.user_sessions.find_one({"user_id": uid}) is None
    assert await db.partner_profiles.find_one({"user_id": uid}) is None
    assert await db.cycle_history.find_one({"partner_id": f"p_{uid}"}) is None
    assert await db.ai_conversations.find_one({"user_id": uid}) is None


# ---------------- Deletion ----------------

@pytest.mark.asyncio(loop_scope="module")
async def test_delete_trial_account_no_stripe(client):
    uid, email, h = await make_user(plan_type="trial", subscription_status="trialing")
    other_uid, _, _ = await make_user()
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"}, headers=h)
    assert r.status_code == 200 and r.json()["success"]
    await assert_purged(uid, email)
    assert await db.auth_users.find_one({"id": other_uid}) is not None
    assert await db.partner_profiles.find_one({"user_id": other_uid}) is not None
    rec = await db.account_deletions.find_one({}, sort=[("_id", -1)])
    assert email not in str(rec) and uid not in str(rec)
    # session revoked
    r2 = await client.get("/api/auth/check", headers=h)
    assert r2.json()["authenticated"] is False


@pytest.mark.asyncio(loop_scope="module")
async def test_delete_requires_password_and_confirmation(client):
    uid, _, h = await make_user()
    r = await client.post("/api/account/delete", json={"password": "wrong", "confirmation": "DELETE"}, headers=h)
    assert r.status_code == 401
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "nope"}, headers=h)
    assert r.status_code == 400
    assert await db.auth_users.find_one({"id": uid}) is not None
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"})
    assert r.status_code == 401


@pytest.mark.asyncio(loop_scope="module")
async def test_delete_lifetime_account(client):
    uid, email, h = await make_user(plan_type="grandfathered", subscription_tier="grandfathered", subscription_status="active")
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "delete"}, headers=h)
    assert r.status_code == 200
    await assert_purged(uid, email)


@pytest.mark.asyncio(loop_scope="module")
@pytest.mark.parametrize("cancelling", [False, True])
async def test_delete_paid_and_pending_cancel_refunds_and_cancels(client, monkeypatch, cancelling):
    uid, email, h = await make_user(plan_type="advanced", subscription_tier="advanced",
                                    subscription_status="cancelling" if cancelling else "active",
                                    stripe_customer_id="cus_x", stripe_subscription_id="sub_a")
    subs = {"sub_a": sub_obj("sub_a", cancel_at_period_end=cancelling, cancel_at=NOW + 20 * 86400 if cancelling else None)}
    calls = {}
    mock_billing(monkeypatch, subs, calls)
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"}, headers=h)
    assert r.status_code == 200, r.text
    assert calls["cancelled"][0][0] == "sub_a"
    refund = calls["refunds"][0]
    assert refund["payment_intent"] == "pi_123"
    assert 520 <= refund["amount"] <= 540  # ~20/30 of $8.00
    assert refund["idempotency_key"] == "cc-acctdel-refund-in_sub_a"
    await assert_purged(uid, email)


@pytest.mark.asyncio(loop_scope="module")
async def test_delete_trialing_stripe_sub_no_refund(client, monkeypatch):
    uid, email, h = await make_user(plan_type="trial", subscription_status="trialing",
                                    stripe_customer_id="cus_t", stripe_subscription_id="sub_t")
    subs = {"sub_t": sub_obj("sub_t", status="trialing")}
    calls = {}
    mock_billing(monkeypatch, subs, calls)
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"}, headers=h)
    assert r.status_code == 200
    assert "refunds" not in calls and calls["cancelled"][0][0] == "sub_t"
    await assert_purged(uid, email)


@pytest.mark.asyncio(loop_scope="module")
async def test_delete_billing_failure_keeps_account_then_retry_succeeds(client, monkeypatch):
    uid, email, h = await make_user(plan_type="basic", subscription_status="active",
                                    stripe_customer_id="cus_f", stripe_subscription_id="sub_f")
    subs = {"sub_f": sub_obj("sub_f")}
    calls = {}
    mock_billing(monkeypatch, subs, calls, fail_cancel=True)
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"}, headers=h)
    assert r.status_code == 409
    assert await db.auth_users.find_one({"id": uid}) is not None
    mock_billing(monkeypatch, subs, calls)
    r = await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"}, headers=h)
    assert r.status_code == 200
    # same idempotency key used both attempts → Stripe would return one refund
    keys = {c["idempotency_key"] for c in calls["refunds"]}
    assert keys == {"cc-acctdel-refund-in_sub_f"}
    await assert_purged(uid, email)


# ---------------- Undo cancellation ----------------

@pytest.mark.asyncio(loop_scope="module")
async def test_undo_cancellation_success(client, monkeypatch):
    uid, _, h = await make_user(plan_type="advanced", subscription_tier="advanced", subscription_status="cancelling",
                                cancels_at=datetime.fromtimestamp(NOW + 86400 * 5, tz=timezone.utc).isoformat(),
                                stripe_subscription_id="sub_u")
    subs = {"sub_u": sub_obj("sub_u", cancel_at_period_end=True, cancel_at=NOW + 86400 * 5)}
    modified = {}

    def modify(sid, **k):
        modified.update(k)
        subs[sid]["cancel_at_period_end"] = False
        subs[sid]["cancel_at"] = None
        return subs[sid]
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda sid: subs[sid])
    monkeypatch.setattr(stripe.Subscription, "modify", modify)
    r = await client.post("/api/account/undo-cancellation", headers=h)
    assert r.status_code == 200 and r.json()["success"], r.text
    assert modified == {"cancel_at_period_end": False}
    u = await db.auth_users.find_one({"id": uid})
    assert u["subscription_status"] == "active" and u["cancels_at"] is None and u["plan_type"] == "advanced"


@pytest.mark.asyncio(loop_scope="module")
async def test_undo_cancellation_rejects_expired_and_lifetime(client, monkeypatch):
    _, _, h = await make_user(subscription_status="cancelled", stripe_subscription_id="sub_e")
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda sid: sub_obj(sid, status="canceled"))
    r = await client.post("/api/account/undo-cancellation", headers=h)
    assert r.status_code == 400
    _, _, h2 = await make_user(plan_type="grandfathered", subscription_tier="grandfathered")
    r = await client.post("/api/account/undo-cancellation", headers=h2)
    assert r.status_code == 400


@pytest.mark.asyncio(loop_scope="module")
async def test_undo_cancellation_not_pending_is_noop(client, monkeypatch):
    _, _, h = await make_user(plan_type="basic", subscription_status="active", stripe_subscription_id="sub_n")
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda sid: sub_obj(sid))
    r = await client.post("/api/account/undo-cancellation", headers=h)
    assert r.status_code == 200 and r.json().get("already_renewing")


# ---------------- Sync activation ----------------

@pytest.mark.asyncio(loop_scope="module")
async def test_sync_sets_plan_type_from_price(client, monkeypatch):
    uid, _, h = await make_user()
    sub = SimpleNamespace(**sub_obj("sub_s"))
    sub_dict = sub_obj("sub_s")
    s = type("S", (dict,), {"__getattr__": lambda self, k: self[k]})(sub_dict)
    monkeypatch.setattr(stripe.Customer, "list", lambda **k: SimpleNamespace(data=[SimpleNamespace(id="cus_s")]))
    monkeypatch.setattr(stripe.Subscription, "list", lambda **k: SimpleNamespace(data=[s]))
    r = await client.post("/api/subscription/sync", headers=h)
    assert r.json()["synced"] is True
    u = await db.auth_users.find_one({"id": uid})
    assert u["plan_type"] == "advanced" and u["subscription_tier"] == "advanced"
    chk = await client.get("/api/auth/check", headers=h)
    assert chk.json()["has_subscription"] is True
    await db.auth_users.delete_one({"id": uid})
