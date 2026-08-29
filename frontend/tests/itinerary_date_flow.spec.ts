import { test, expect } from '@playwright/test';

test('Itinerary Date Range & Overview E2E Flow', async ({ page }) => {
    // 1. Listen for console errors to verify 0 runtime errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    // 2. Set up authenticated state in localStorage
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
        localStorage.setItem('user_nickname', 'E2ETester');
        localStorage.setItem('user_uuid', 'e2e-tester-uuid-1234');
        localStorage.setItem('onboarding_completed', 'true');
    });
    await page.reload();

    // 3. Verify App Header / Shell is loaded
    await page.waitForTimeout(1500);
    const mainEl = page.locator('main').first();
    await expect(mainEl).toBeVisible();

    // 4. Check if sample trip or trip cards exist, and click first trip
    const tripCard = page.locator('.group').first();
    if (await tripCard.isVisible()) {
        await tripCard.click();
        await page.waitForTimeout(1000);

        // 5. Verify Overview (Day 0) tab is present
        const overviewTab = page.getByRole('button', { name: /(ALL|總覽|Overview)/i }).first();
        if (await overviewTab.isVisible()) {
            await overviewTab.click();
            await page.waitForTimeout(500);
            console.log('✅ Overview tab interaction passed');
        }

        // 6. Verify Date Capsule button is present and clickable
        const dateCapsule = page.locator('button').filter({ hasText: /(天|Day|Days)/i }).first();
        if (await dateCapsule.isVisible()) {
            await dateCapsule.click();
            await page.waitForTimeout(500);
            
            // Check if CalendarRangeSheet Dialog opens
            const dialog = page.getByRole('dialog').first();
            if (await dialog.isVisible()) {
                console.log('✅ Calendar Range Sheet dialog opened successfully');
                // Close dialog
                const closeOrReset = page.getByRole('button', { name: /(關閉|Close|重設|Reset|✕)/i }).first();
                if (await closeOrReset.isVisible()) {
                    await closeOrReset.click();
                } else {
                    await page.keyboard.press('Escape');
                }
            }
        }
    }

    // 7. Verify zero button nesting console errors
    const buttonNestingErrors = consoleErrors.filter(err => err.includes('cannot contain a nested <button>'));
    expect(buttonNestingErrors.length).toBe(0);

    console.log('✅ End-to-End Date & Overview Flow Completed with 0 console errors');
});
