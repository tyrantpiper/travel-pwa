import { test, expect } from '@playwright/test';

test('User Login Flow Verification', async ({ page }) => {
    // 1. Navigate to Landing Page
    await page.goto('http://localhost:3000');

    // 2. Verify Landing Heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // 3. Perform Login
    const nicknameInput = page.locator('input').first();
    await expect(nicknameInput).toBeVisible();
    await nicknameInput.fill('LogicTester');

    // 4. Submit
    const startBtn = page.getByRole('button', { name: /(開始旅程|Start Journey)/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 5. Verify State Transition to AppShell / Dashboard
    await page.waitForTimeout(1000);
    const mainOrDialog = page.locator('main').or(page.getByRole('dialog')).first();
    await expect(mainOrDialog).toBeVisible();

    console.log('✅ Login Logic & E2E Transition Verified successfully');
});
