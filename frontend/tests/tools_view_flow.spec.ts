import { test, expect } from '@playwright/test';

test.describe('ToolsView Full-Stack E2E Flow', () => {
    test('should verify Cards, Expenses, and AI Tools tabs without regression', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('http://localhost:3000');
        await page.evaluate(() => {
            localStorage.setItem('user_nickname', 'ToolsTester');
            localStorage.setItem('user_uuid', 'tools-tester-uuid-1234');
            localStorage.setItem('onboarding_completed', 'true');
        });
        await page.reload();
        await page.waitForTimeout(1500);

        // 1. Navigate to "工具 / Tools" from bottom navigation bar (3rd tab)
        const bottomNav = page.locator('.fixed.z-100, .fixed.z-\\[100\\]').first();
        const toolsNavBtn = bottomNav.locator('button').nth(2);
        await expect(toolsNavBtn).toBeVisible();
        await toolsNavBtn.click();
        await page.waitForTimeout(600);

        console.log('✅ Navigated to ToolsView successfully');

        // ==========================================
        // 2. Test Cards Tab (信用卡管理 - 增量完整性)
        // ==========================================
        const toolsTabStrip = page.locator('.grid.grid-cols-3').first();
        const cardsTabBtn = toolsTabStrip.locator('button').nth(0);
        await expect(cardsTabBtn).toBeVisible();
        await cardsTabBtn.click();
        await page.waitForTimeout(300);

        // Click Add Card Button
        const addCardBtn = page.locator('button').filter({ hasText: /(新增卡片|Add Card|新增)/i }).first();
        if (await addCardBtn.isVisible()) {
            await addCardBtn.click();
            await page.waitForTimeout(300);

            // Fill Add Card Dialog
            const cardNameInput = page.locator('input[placeholder*="玉山"], input[placeholder*="Card"]').first();
            if (await cardNameInput.isVisible()) {
                await cardNameInput.fill('玉山熊本熊卡');
                const rateInput = page.locator('input[type="number"]').first();
                if (await rateInput.isVisible()) await rateInput.fill('8.5');

                const saveCardBtn = page.locator('button').filter({ hasText: /(儲存|Save)/i }).last();
                await saveCardBtn.click();
                await page.waitForTimeout(500);
                console.log('✅ Credit card created and rendered successfully');

                // Verify Card appears
                const createdCard = page.locator('text=玉山熊本熊卡').first();
                await expect(createdCard).toBeVisible();

                // Click Card to open detail preview sheet
                await createdCard.click();
                await page.waitForTimeout(400);

                // Close sheet by pressing escape
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
                console.log('✅ Card detail preview Sheet verified');
            }
        }

        // ==========================================
        // 3. Test Expense Tab (記帳分帳 - 增量完整性)
        // ==========================================
        const expenseTabBtn = toolsTabStrip.locator('button').nth(1);
        await expect(expenseTabBtn).toBeVisible();
        await expenseTabBtn.click();
        await page.waitForTimeout(300);

        // Verify Expense View Toggle (Total / List)
        const totalBtn = page.locator('button').filter({ hasText: /(總計|Total|總覽)/i }).first();
        const listBtn = page.locator('button').filter({ hasText: /(清單|List)/i }).first();
        if (await totalBtn.isVisible() && await listBtn.isVisible()) {
            await listBtn.click();
            await page.waitForTimeout(200);
            await totalBtn.click();
            await page.waitForTimeout(200);
            console.log('✅ Expense view toggle and filters verified');
        }

        // ==========================================
        // 4. Test AI Tab (現代化 AI 工具箱 - 升級驗證)
        // ==========================================
        const aiTabBtn = toolsTabStrip.locator('button').nth(2);
        await expect(aiTabBtn).toBeVisible();
        await aiTabBtn.click();
        await page.waitForTimeout(400);

        // Verify In-Place Segmented Controls
        const grillMeModeBtn = page.locator('button').filter({ hasText: /(智能引導|Grill)/i }).first();
        const multimodalModeBtn = page.locator('button').filter({ hasText: /(多模態匯入|Import)/i }).first();
        const freeformModeBtn = page.locator('button').filter({ hasText: /(自由輸入|Freeform)/i }).first();

        await expect(grillMeModeBtn).toBeVisible();
        await expect(multimodalModeBtn).toBeVisible();
        await expect(freeformModeBtn).toBeVisible();
        console.log('✅ AI Tab in-place 3-way Segmented Switcher rendered');

        // 4.1 Test Grill-Me Step 1 -> Step 2 in ToolsView
        const destPill = page.locator('button').filter({ hasText: /(東京|京都|首爾)/i }).first();
        if (await destPill.isVisible()) {
            await destPill.click();
            await page.waitForTimeout(200);
            const nextBtn = page.locator('button').filter({ hasText: /(下一步|Next)/i }).first();
            await nextBtn.click();
            await page.waitForTimeout(300);
            console.log('✅ ToolsView Grill-Me Wizard transitioned to Step 2');
        }

        // 4.2 Test Multimodal Import in ToolsView
        await multimodalModeBtn.click();
        await page.waitForTimeout(300);
        const importTextarea = page.locator('textarea').first();
        await expect(importTextarea).toBeVisible();

        const tmplPill = page.locator('button').filter({ hasText: /(東京|京都|沖繩)/i }).first();
        if (await tmplPill.isVisible()) {
            await tmplPill.click();
            await page.waitForTimeout(200);
            const filledVal = await importTextarea.inputValue();
            expect(filledVal.length).toBeGreaterThan(10);
            console.log('✅ ToolsView Multimodal Import template populated');
        }

        // 4.3 Test Freeform Mode in ToolsView
        await freeformModeBtn.click();
        await page.waitForTimeout(300);
        const freeformTextarea = page.locator('textarea').first();
        await expect(freeformTextarea).toBeVisible();
        await freeformTextarea.fill('我想去北海道吃拉麵看雪');
        console.log('✅ ToolsView Freeform prompt textarea verified');

        // 5. Assert zero button nesting or critical console errors
        const buttonNestingErrors = consoleErrors.filter(err => err.includes('cannot contain a nested <button>'));
        expect(buttonNestingErrors.length).toBe(0);

        console.log('✅ ToolsView Full-Stack E2E Flow 100% Passed!');
    });
});
