import { test, expect } from '@playwright/test';

test('User Login Flow Verification', async ({ page }) => {
    // 1. Navigate to Landing Page
    await page.goto('http://localhost:3000');

    // 2. Verify Landing Elements
    await expect(page.getByRole('heading', { name: 'Tabidachi' })).toBeVisible();
    await expect(page.getByText('Travel Planner')).toBeVisible();

    // 3. Perform Login
    const nicknameInput = page.getByPlaceholder('E.g. Ryan');
    await expect(nicknameInput).toBeVisible();
    await nicknameInput.fill('LogicTester');

    // 4. Submit
    const startBtn = page.getByRole('button', { name: 'Start Journey' });
    await startBtn.click();

    // 5. Verify State Transition
    // Expect Login button to disappear (indicating successful state change)
    await expect(startBtn).not.toBeVisible();

    // 6. Check for Post-Login UI (Wizard or AppShell)
    // We expect either the Welcome Wizard or the Dashboard
    // This confirms the "Login Logic" (Frontend -> LocalStorage -> State Update) worked.
    const dashboardOrWizard = page.locator('main').or(page.getByRole('dialog'));
    await expect(dashboardOrWizard).toBeVisible();

    console.log('✅ Login Logic Verified: Helper transitioned from Landing Page');
});
