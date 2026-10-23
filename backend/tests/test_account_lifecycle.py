"""Account deletion + undo cancellation + sync plan resolution. Stripe is fully mocked: no real API calls/charges."""
import time
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
import asyncio
import resend
import stripe

import server
from routes import account as account_routes
from database import db
from routes.auth import hash_password
from routes import stripe as stripe_routes

PW = "Passw0rd!"
NOW = int(time.time())


SENT = []


@pytest.fixture(autouse=True)
def safe_email(monkeypatch):
    """Never send real email: capture Resend payloads in memory."""
    SENT.clear()
    monkeypatch.setenv("RESEND_API_KEY", "re_test_dummy")
    monkeypatch.setattr(resend.Emails, "send", lambda params: SENT.append(params) or {"id": "email_test"})


async def flush_emails():
    if account_routes._email_tasks:
        await asyncio.gather(*list(account_routes._email_tasks))


@pytest.fixture(autouse=True)
def block_real_stripe(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("Real Stripe call attempted")
    for cls in (stripe.Subscription, stripe.Invoice, stripe.InvoicePayment, stripe.Refund, stripe.Customer):
        for name in ("retrieve", "modify", "cancel", "list", "create"):
            if hasattr(cls, name):
                monkeypatch.setattr(cls, name, boom, raising=False)
    monkeypatch.setattr(stripe.checkout.Session, "list", boom, raising=False)


@pytest_asyncio.fixture(loop_scope="module", scope="module", autouse=True)
async def remove_test_users_after():
    yield
    ids = [u["id"] async for u in db.auth_users.find({"email": {"$regex": r"^del_[0-9a-f]{8}@test\.com$"}}, {"id": 1})]
    await db.auth_users.delete_many({"id": {"$in": ids}})
    for coll in (db.user_sessions, db.partner_profiles, db.ai_conversations):
        await coll.delete_many({"user_id": {"$in": ids}})
    await db.cycle_history.delete_many({"partner_id": {"$in": [f"p_{i}" for i in ids]}})
    await db.deletion_refunds.delete_many({"subscription_id": {"$in": ["sub_a", "sub_t"]}})


@pytest_asyncio.fixture(loop_scope="module", autouse=True)
async def clean_refund_records():
    # Fake invoice ids are reused across tests (real Stripe ids are unique)
    await db.deletion_refunds.delete_many({"invoice_id": {"$regex": "^in_"}})
    yield


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
    await db.partner_profiles.insert_one({"id": f"p_{uid}", "user_id": uid, "name": "PARTNERSECRET"})
    await db.cycle_history.insert_one({"id": f"c_{uid}", "partner_id": f"p_{uid}"})
    await db.ai_conversations.insert_one({"user_id": uid, "partner_id": f"p_{uid}", "message": "hi"})
    return uid, email, {"Authorization": f"Bearer {token}"}


def sub_obj(sid, status="active", cancel_at_period_end=False, cancel_at=None, start=NOW - 10 * 86400, end=NOW + 20 * 86400):
    return {"id": sid, "status": status, "cancel_at_period_end": cancel_at_period_end, "cancel_at": cancel_at,
            "latest_invoice": f"in_{sid}", "metadata": {"tier": "advanced"}, "trial_end": None,
            "items": {"data": [{"id": "si_1", "price": {"id": stripe_routes.ADVANCED_PRICE_ID},
                                "current_period_start": start, "current_period_end": end}]}}


DAY = 86400


def inv(iid, paid, lines):
    return {"id": iid, "amount_paid": paid, "currency": "usd",
            "lines": {"data": [{"amount": amt, "period": {"start": st, "end": en}} for amt, st, en in lines]}}


def mock_billing(monkeypatch, subs, calls, invoices=None, existing_refunds=None, fail_cancel=False,
                 fail_refund=False, no_pi=False, fail_invoice_list=False, refund_status="succeeded"):
    invoices = invoices if invoices is not None else {
        sid: [inv(f"in_{sid}", 800, [(800, NOW - 10 * DAY, NOW + 20 * DAY)])] for sid in subs}
    refunds_by_pi = existing_refunds if existing_refunds is not None else {}
    used_keys = {}
    monkeypatch.setattr(stripe.Subscription, "list", lambda **k: SimpleNamespace(data=list(subs.values())))
    monkeypatch.setattr(stripe.Subscription, "retrieve", lambda sid: subs[sid])

    def inv_list(subscription, **k):
        if fail_invoice_list:
            raise stripe.APIConnectionError("stripe down")
        return SimpleNamespace(data=invoices.get(subscription, []))
    monkeypatch.setattr(stripe.Invoice, "list", inv_list)
    monkeypatch.setattr(stripe.InvoicePayment, "list", lambda invoice, **k: SimpleNamespace(
        data=[] if no_pi else [{"status": "paid", "payment": {"payment_intent": f"pi_{invoice}"}}]), raising=False)
    monkeypatch.setattr(stripe.Refund, "list", lambda payment_intent, **k: SimpleNamespace(
        data=list(refunds_by_pi.get(payment_intent, []))), raising=False)

    def refund(**k):
        if fail_refund:
            raise stripe.InvalidRequestError("charge disputed", param=None)
        if k["idempotency_key"] in used_keys:
            return used_keys[k["idempotency_key"]]
        r = {"id": f"re_{len(used_keys) + 1}", "amount": k["amount"], "status": refund_status, "metadata": k["metadata"]}
        used_keys[k["idempotency_key"]] = r
        refunds_by_pi.setdefault(k["payment_intent"], []).append(r)
        calls.setdefault("refunds", []).append(k)
        return r

    def cancel(sid, **k):
        if fail_cancel:
            raise stripe.APIConnectionError("down")
        calls.setdefault("cancelled", []).append((sid, k))
        subs[sid]["status"] = "canceled"
        return subs[sid]
    monkeypatch.setattr(stripe.Refund, "create", refund)
    monkeypatch.setattr(stripe.Subscription, "cancel", cancel)


async def paid_user(**extra):
    return await make_user(plan_type="advanced", subscription_tier="advanced", subscription_status="active",
                           stripe_customer_id=f"cus_{uuid.uuid4().hex[:6]}", stripe_subscription_id="sub_a", **extra)


async def delete(client, h):
    return await client.post("/api/account/delete", json={"password": PW, "confirmation": "DELETE"}, headers=h)


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
    uid, email, h = await paid_user()
    if cancelling:
        await db.auth_users.update_one({"id": uid}, {"$set": {"subscription_status": "cancelling"}})
    subs = {"sub_a": sub_obj("sub_a", cancel_at_period_end=cancelling, cancel_at=NOW + 20 * DAY if cancelling else None)}
    calls = {}
    mock_billing(monkeypatch, subs, calls)
    r = await delete(client, h)
    assert r.status_code == 200, r.text
    assert calls["cancelled"][0][0] == "sub_a"
    refund = calls["refunds"][0]
    assert refund["payment_intent"] == "pi_in_sub_a"
    assert 530 <= refund["amount"] <= 534  # 20/30 of $8.00
    assert refund["idempotency_key"] == "cc-acctdel-refund-in_sub_a"
    body = r.json()
    assert body["refunds"][0]["status"] == "refunded" and not body["refund_needs_attention"]
    await assert_purged(uid, email)


@pytest.mark.asyncio(loop_scope="module")
async def test_refund_after_upgrade_uses_actual_paid_lines(client, monkeypatch):
    uid, email, h = await paid_user()
    start, up, end = NOW - 10 * DAY, NOW - 5 * DAY, NOW + 20 * DAY
    basic_credit, adv_charge = -round(500 * 25 / 30), round(800 * 25 / 30)
    invoices = {"sub_a": [
        inv("in_base", 500, [(500, start, end)]),
        inv("in_upgrade", basic_credit + adv_charge, [(basic_credit, up, end), (adv_charge, up, end)]),
    ]}
    calls = {}
    mock_billing(monkeypatch, {"sub_a": sub_obj("sub_a")}, calls, invoices=invoices)
    r = await delete(client, h)
    assert r.status_code == 200
    total = sum(c["amount"] for c in calls["refunds"])
    assert abs(total - round(800 * 20 / 30)) <= 2  # unused time at the Advanced rate actually paid
    assert {c["payment_intent"] for c in calls["refunds"]} == {"pi_in_base", "pi_in_upgrade"}
    await assert_purged(uid, email)


@pytest.mark.asyncio(loop_scope="module")
async def test_refund_capped_by_prior_refunds_and_never_duplicated(client, monkeypatch):
    uid, _, h = await paid_user()
    calls = {}
    existing = {"pi_in_sub_a": [{"id": "re_old", "amount": 600, "status": "succeeded", "metadata": {}}]}
    mock_billing(monkeypatch, {"sub_a": sub_obj("sub_a")}, calls, existing_refunds=existing)
    r = await delete(client, h)
    assert r.status_code == 200
    assert calls["refunds"][0]["amount"] == 200  # 800 paid - 600 already refunded

    _, _, h2 = await paid_user()
    calls2 = {}
    existing2 = {"pi_in_sub_a": [{"id": "re_prev", "amount": 533, "status": "succeeded",
                                  "metadata": {"reason": "account_deletion"}}]}
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})
    mock_billing(monkeypatch, {"sub_a": sub_obj("sub_a")}, calls2, existing_refunds=existing2)
    r = await delete(client, h2)
    assert r.status_code == 200 and "refunds" not in calls2
    assert r.json()["refunds"][0]["status"] == "refunded"
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})


@pytest.mark.asyncio(loop_scope="module")
@pytest.mark.parametrize("mode", ["fail_refund", "no_pi", "fail_invoice_list"])
async def test_refund_failure_never_blocks_deletion_and_is_recorded(client, monkeypatch, mode):
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})
    uid, email, h = await paid_user()
    calls = {}
    mock_billing(monkeypatch, {"sub_a": sub_obj("sub_a")}, calls, **{mode: True})
    r = await delete(client, h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["refund_needs_attention"] is True
    ref = body["refunds"][0]
    assert ref["status"] == "needs_attention" and ref["reference"].startswith("RF-")
    assert calls["cancelled"][0][0] == "sub_a"  # billing stopped regardless
    doc = await db.deletion_refunds.find_one({"reference": ref["reference"]})
    assert doc["status"] == "needs_attention" and doc["error"]
    assert email not in str(doc) and uid not in str(doc)
    await assert_purged(uid, email)


@pytest.mark.asyncio(loop_scope="module")
async def test_cancel_failure_keeps_account_then_retry_single_refund(client, monkeypatch):
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})
    uid, email, h = await paid_user()
    subs = {"sub_a": sub_obj("sub_a")}
    calls, existing = {}, {}
    mock_billing(monkeypatch, subs, calls, existing_refunds=existing, fail_cancel=True)
    r = await delete(client, h)
    assert r.status_code == 409
    assert await db.auth_users.find_one({"id": uid}) is not None
    assert "refunds" not in calls  # nothing refunded before billing is stopped
    mock_billing(monkeypatch, subs, calls, existing_refunds=existing)
    r = await delete(client, h)
    assert r.status_code == 200
    assert len(calls["refunds"]) == 1
    assert await db.deletion_refunds.count_documents({"invoice_id": "in_sub_a"}) == 1
    await assert_purged(uid, email)
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})


@pytest.mark.asyncio(loop_scope="module")
async def test_admin_can_retry_and_resolve_failed_refunds(client, monkeypatch):
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})
    _, _, h = await paid_user()
    subs = {"sub_a": sub_obj("sub_a")}
    calls = {}
    mock_billing(monkeypatch, subs, calls, fail_refund=True)
    ref = (await delete(client, h)).json()["refunds"][0]["reference"]
    token = secrets.token_urlsafe(16)
    await db.admin_sessions.insert_one({"token": token, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()})
    ah = {"Authorization": f"Bearer {token}"}
    assert (await client.get("/api/admin/deletion-refunds")).status_code == 401
    lst = (await client.get("/api/admin/deletion-refunds", headers=ah)).json()
    assert any(d["reference"] == ref for d in lst) and all("user_ref" not in d for d in lst)
    mock_billing(monkeypatch, subs, calls)
    r = await client.post(f"/api/admin/deletion-refunds/{ref}/retry", headers=ah)
    assert r.json()["status"] == "refunded"
    assert 530 <= calls["refunds"][0]["amount"] <= 534  # measured at deletion time
    r = await client.post(f"/api/admin/deletion-refunds/{ref}/retry", headers=ah)
    assert len(calls["refunds"]) == 1  # no duplicate on second retry
    r = await client.post(f"/api/admin/deletion-refunds/{ref}/mark-resolved", headers=ah)
    assert r.json()["status"] == "resolved_manually"
    await db.deletion_refunds.delete_many({"invoice_id": "in_sub_a"})
    await db.admin_sessions.delete_one({"token": token})


@pytest.mark.asyncio(loop_scope="module")
async def test_delete_trialing_stripe_sub_no_refund(client, monkeypatch):
    uid, email, h = await make_user(plan_type="trial", subscription_status="trialing",
                                    stripe_customer_id="cus_t", stripe_subscription_id="sub_t")
    subs = {"sub_t": sub_obj("sub_t", status="trialing")}
    calls = {}
    mock_billing(monkeypatch, subs, calls)
    r = await delete(client, h)
    assert r.status_code == 200
    assert "refunds" not in calls and calls["cancelled"][0][0] == "sub_t"
    await assert_purged(uid, email)


# ---------------- Deletion confirmation email ----------------

def _email_for(addr):
    return [m for m in SENT if m["to"] == [addr]]


@pytest.mark.asyncio(loop_scope="module")
@pytest.mark.parametrize("refund_status,expect,absent", [("succeeded", "Issued", "Pending"), ("pending", "Pending", "Issued")])
async def test_email_paid_refund_state_follows_stripe(client, monkeypatch, refund_status, expect, absent):
    uid, email, h = await paid_user()
    mock_billing(monkeypatch, {"sub_a": sub_obj("sub_a")}, {}, refund_status=refund_status)
    r = await delete(client, h)
    assert r.status_code == 200 and r.json()["confirmation_email"] is True
    await flush_emails()
    [msg] = _email_for(email)
    body = msg["html"]
    assert "permanently deleted" in body and "No future subscription charges" in body
    assert "$5.3" in body and r.json()["refunds"][0]["reference"] in body
    assert expect in body and absent + " —" not in body
    assert "cyclecoach4men@gmail.com" in body
    assert "PARTNERSECRET" not in body and uid not in body
    assert r.json()["refunds"][0]["state"] == ("issued" if refund_status == "succeeded" else "pending")


@pytest.mark.asyncio(loop_scope="module")
async def test_email_needs_attention_and_pending_cancellation(client, monkeypatch):
    uid, email, h = await paid_user(cancels_at=datetime.fromtimestamp(NOW + 20 * DAY, tz=timezone.utc).isoformat())
    await db.auth_users.update_one({"id": uid}, {"$set": {"subscription_status": "cancelling"}})
    mock_billing(monkeypatch, {"sub_a": sub_obj("sub_a", cancel_at_period_end=True, cancel_at=NOW + 20 * DAY)}, {}, fail_refund=True)
    r = await delete(client, h)
    assert r.status_code == 200
    await flush_emails()
    body = _email_for(email)[0]["html"]
    assert "Needs attention" in body and "Issued" not in body
    assert r.json()["refunds"][0]["reference"] in body and "quote the reference" in body
    assert "No future subscription charges" in body


@pytest.mark.asyncio(loop_scope="module")
@pytest.mark.parametrize("fields,expected", [
    ({"plan_type": "trial", "subscription_status": "trialing"}, "You had no active recurring subscription"),
    ({"plan_type": "grandfathered", "subscription_tier": "grandfathered", "subscription_status": "active"}, "Lifetime access has ended"),
    ({"plan_type": "basic", "subscription_status": "cancelled"}, "You had no active recurring subscription"),
])
async def test_email_trial_lifetime_expired(client, fields, expected):
    _, email, h = await make_user(**fields)
    r = await delete(client, h)
    assert r.status_code == 200
    await flush_emails()
    body = _email_for(email)[0]["html"]
    assert expected in body and "No refund was due" in body


@pytest.mark.asyncio(loop_scope="module")
async def test_email_trial_with_stripe_sub(client, monkeypatch):
    _, email, h = await make_user(plan_type="trial", subscription_status="trialing",
                                  stripe_customer_id="cus_t2", stripe_subscription_id="sub_t")
    mock_billing(monkeypatch, {"sub_t": sub_obj("sub_t", status="trialing")}, {})
    assert (await delete(client, h)).status_code == 200
    await flush_emails()
    assert "free trial was cancelled. You will not be charged" in _email_for(email)[0]["html"]


@pytest.mark.asyncio(loop_scope="module")
async def test_email_failure_or_unconfigured_never_blocks_deletion(client, monkeypatch):
    def broken(params):
        raise RuntimeError("email service down")
    monkeypatch.setattr(resend.Emails, "send", broken)
    uid, email, h = await make_user(plan_type="basic", subscription_status="cancelled")
    r = await delete(client, h)
    assert r.status_code == 200
    await flush_emails()
    await assert_purged(uid, email)
    monkeypatch.delenv("RESEND_API_KEY")
    uid2, email2, h2 = await make_user()
    assert (await delete(client, h2)).status_code == 200
    await flush_emails()
    await assert_purged(uid2, email2)


@pytest.mark.asyncio(loop_scope="module")
async def test_no_email_for_unverified_address(client):
    _, email, h = await make_user(email_verified=False)
    r = await delete(client, h)
    assert r.status_code == 200 and r.json()["confirmation_email"] is False
    await flush_emails()
    assert _email_for(email) == []
    assert email not in str(await db.account_deletions.find_one({}, sort=[("_id", -1)]))


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
