# Reference snippets used by iteration_34 browser_automation runs (Cycle Coach TZ/luteal/duplicate checks)
LOGIN_ONBOARD = """
await page.fill('[data-testid="login-email-input"]', 'adv_active@test.com')
await page.fill('[data-testid="login-password-input"]', 'Test1234')
await page.click('[data-testid="login-submit-btn"]')
await page.wait_for_selector('[data-testid="state-privacy-waiver"]', timeout=15000)
await page.click('[data-testid="state-privacy-waiver"]')
await page.get_by_text('Outside the United States').click()
await page.click('[data-testid="privacy-continue-btn"]')
await page.click('[data-testid="consent-local-storage-checkbox"]')
await page.click('[data-testid="consent-partner-checkbox"]')
await page.click('[data-testid="consent-continue-btn"]')
"""
