# Test Credentials

## Test User (Grandfathered/Lifetime)
- Email: testuser@test.com
- Password: Test1234
- Subscription: grandfathered (lifetime access, no Stripe subscription)

## Trial User (also Grandfathered from test iteration 10)
- Email: trialtest@test.com
- Password: Test1234
- Plan: grandfathered (was trial, upgraded to lifetime during testing)

## Original User (Advanced)
- Email: ts_peterson@yahoo.com
- Password: (user-set, unknown to agent)
- Subscription: active, subscription_tier: advanced

## Admin Dashboard
- URL: /admin
- Password: cyclecoach2024

## Account deletion / Undo-cancellation test accounts (password for all: Test1234, seeded in preview DB)
- del_trial@test.com — trial (trialing, no Stripe ids) → safe to DELETE
- del_lifetime@test.com — Lifetime (grandfathered) → safe to DELETE
- del_expired@test.com — expired/no plan (plan_type none, status cancelled) → safe to DELETE (reaches /account via nav "Account")
- undo_cancel@test.com — Advanced, pending cancellation, FAKE stripe ids (UI only; confirming Undo returns a Stripe error, no charge)
- adv_active@test.com — Advanced active, FAKE stripe ids (UI only; do NOT confirm cancel/downgrade/delete)
NOTE: preview backend uses a LIVE Stripe key. Never complete a Stripe checkout. Stripe paths are covered by mocked pytest: backend/tests/test_account_lifecycle.py
