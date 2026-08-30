import { test, expect } from '@playwright/test';

test.describe('Account Settings iOS Swift Flow', () => {
    test('should hide app version, migrate cache/delete to subview, and transition smoothly', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // 1. Set user auth state in localStorage
        await page.goto('http://localhost:3000');
        await page.evaluate(() => {
            localStorage.setItem('user_uuid', 'test-user-e2e-1234');
            localStorage.setItem('user_nickname', 'Traveler E2E');
            localStorage.setItem('onboarding_completed', 'true');
            localStorage.setItem('language', 'zh');
        });
        await page.reload();
        await page.waitForTimeout(1000);

        // 2. Navigate to Profile tab via custom event or bottom nav
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent('navigate-to-profile'));
        });
        await page.waitForTimeout(500);

        // Wait for profile content to render
        await expect(page.locator('text=Traveler E2E').or(page.locator('text=Traveler')).first()).toBeVisible({ timeout: 10000 });

        // 3. Verify "App 版本" (v1.0.0) is HIDDEN from UI
        await expect(page.locator('text=App 版本')).not.toBeVisible();
        await expect(page.locator('text=v1.0.0')).not.toBeVisible();

        // 4. Verify "清除快取" and "刪除所有資料" are NOT visible on main view
        await expect(page.locator('text=清除快取 (Debug)')).not.toBeVisible();
        await expect(page.locator('text=刪除所有資料')).not.toBeVisible();

        // 5. Tap "帳號設定" (Account Settings) to push into subview
        const accountSettingsBtn = page.locator('div, button').filter({ hasText: /^帳號設定/ }).first();
        await expect(accountSettingsBtn).toBeVisible();
        await accountSettingsBtn.click();
        await page.waitForTimeout(400);

        // 6. In Account Settings Subview: Verify elements are present
        await expect(page.locator('text=帳號識別碼 (UUID)')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=test-user-e2e-1234')).toBeVisible();
        await expect(page.locator('text=複製識別碼').or(page.locator('text=已複製'))).toBeVisible();
        await expect(page.locator('text=清除快取 (Debug)')).toBeVisible();
        await expect(page.locator('text=刪除所有資料')).toBeVisible();

        // 7. Test Back Button: Tap clean circular back button to return
        const backBtn = page.locator('button[aria-label="Back"]').first();
        await expect(backBtn).toBeVisible();
        await backBtn.click();
        await page.waitForTimeout(400);

        // 8. Verify returned back to Main Settings View
        await expect(page.locator('text=帳號識別碼 (UUID)')).not.toBeVisible();
        await expect(accountSettingsBtn).toBeVisible();

        // 9. Tap "使用說明" (Usage Guide) to push into guide subview
        const usageGuideBtn = page.locator('div, button').filter({ hasText: /^使用說明/ }).first();
        await expect(usageGuideBtn).toBeVisible();
        await usageGuideBtn.click();
        await page.waitForTimeout(400);

        // 10. In Usage Guide Subview: Verify Header and Accordion are present
        await expect(page.locator('text=Tabidachi 全功能操作手冊').or(page.locator('text=Tabidachi Comprehensive Guide'))).toBeVisible({ timeout: 5000 });
        const tripTrigger = page.getByRole('button', { name: /行程管理|Trip Management/i }).first();
        await expect(tripTrigger).toBeVisible();
        await tripTrigger.click();
        await expect(page.locator('text=建立新行程').or(page.locator('text=Create New Trip')).first()).toBeVisible({ timeout: 5000 });

        // 11. Tap Back Button from Usage Guide
        const guideBackBtn = page.locator('button[aria-label="Back"]').first();
        await expect(guideBackBtn).toBeVisible();
        await guideBackBtn.click();
        await page.waitForTimeout(400);

        // 12. Verify returned to Main Settings View again
        await expect(usageGuideBtn).toBeVisible();

        // 13. Verify zero React / DOM nesting errors
        const reactErrors = consoleErrors.filter(err => 
            err.includes('cannot contain a nested') ||
            err.includes('Minified React error') ||
            err.includes('Uncaught Error')
        );
        expect(reactErrors).toEqual([]);
        console.log('✅ Account Settings & Usage Guide iOS Swift Sub-views E2E Flow verified successfully with 0 UI errors');
    });
});
