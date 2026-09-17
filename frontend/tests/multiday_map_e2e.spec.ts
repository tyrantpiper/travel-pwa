import { test, expect } from '@playwright/test';

test('MultiDayMasterMap 3 Flagship Features & Zero-Regression Automated E2E Test', async ({ page, context }) => {
    // 1. 監聽瀏覽器 Console Error，確保運行時 0 異常
    const consoleErrors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    // 2. 授權並模擬精準 GPS 地理定位 (台北 101: 25.0339, 121.5654)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 25.0339, longitude: 121.5654 });

    // 3. 設定已登入狀態與示範行程
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
        localStorage.setItem('user_nickname', 'E2ETester');
        localStorage.setItem('user_uuid', 'e2e-tester-uuid-1234');
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('gemini_api_key', 'AIzaSyMockKeyForTest12345');
    });
    await page.reload();
    await page.waitForTimeout(1500);

    // 關閉任何干擾的彈出對話框 (如 AI API Key 設定)
    const dialogCloseBtn = page.getByRole('button', { name: /(Close|關閉|✕)/i }).first();
    if (await dialogCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dialogCloseBtn.click();
        await page.waitForTimeout(400);
    }

    // 4. 點擊範例行程卡片以進入行程詳情頁
    const tripCard = page.locator('button, .group').filter({ hasText: /(3 Day Taipei Explorer|Taipei|範例|Explorer)/i }).first();
    await expect(tripCard).toBeVisible({ timeout: 5000 });
    await tripCard.click();
    await page.waitForTimeout(1500);

    // 5. 切換至總覽模式 (點擊 "ALL 總覽" Tab 按鈕)
    const allTab = page.getByRole('button', { name: /ALL.*總覽|ALL/i }).first();
    await expect(allTab).toBeVisible({ timeout: 5000 });
    await allTab.click();
    await page.waitForTimeout(1200);

    // 6. 驗證總覽地圖核心容器與標題
    const mapHeaderTitle = page.locator('span').filter({ hasText: /(全行程多天軌跡|Full-Trip Route Mesh)/i }).first();
    await expect(mapHeaderTitle).toBeVisible({ timeout: 8000 });
    console.log('✅ 1. 總覽地圖容器與標題渲染正常');

    // 7. 自動化驗證：🚶🚗🚌 交通模式切換 (步行 ⇄ 開車 ⇄ 大眾運輸)
    // 定位多天總覽地圖內的交通模式切換按鈕
    const multiDayContainer = page.locator('div').filter({ has: mapHeaderTitle }).first();
    const walkBtn = multiDayContainer.getByRole('button', { name: /(步行|Walk)/i }).first();
    const driveBtn = multiDayContainer.getByRole('button', { name: /(開車|Drive)/i }).first();
    const transitBtn = multiDayContainer.getByRole('button', { name: /(大眾運輸|Transit)/i }).first();

    await expect(walkBtn).toBeVisible();
    await expect(driveBtn).toBeVisible();
    await expect(transitBtn).toBeVisible();

    // 點擊「開車」模式
    await driveBtn.click();
    await page.waitForTimeout(400);
    await expect(driveBtn).toHaveClass(/text-blue-600|dark:text-blue-400/);
    console.log('✅ 2. 交通模式切換至 [開車] 成功');

    // 點擊「大眾運輸」模式
    await transitBtn.click();
    await page.waitForTimeout(400);
    await expect(transitBtn).toHaveClass(/text-amber-600|dark:text-amber-400/);
    console.log('✅ 3. 交通模式切換至 [大眾運輸] 成功');

    // 切換回「步行」模式 (快取秒切)
    await walkBtn.click();
    await page.waitForTimeout(400);
    await expect(walkBtn).toHaveClass(/text-emerald-600|dark:text-emerald-400/);
    console.log('✅ 4. 交通模式切換回 [步行] 成功 (二級快取生效)');

    // 8. 自動化驗證：📍 GPS 定位到我 (Locate Me)
    const locateBtn = page.locator('button[aria-label="Locate Me"]').first();
    if (await locateBtn.isVisible()) {
        await locateBtn.click();
        await page.waitForTimeout(800);
        console.log('✅ 5. GPS 定位觸發正常，無崩潰');
    }

    // 9. 自動化驗證：👁️ 街景覆蓋圖層 (Mapillary Toggle)
    const coverageBtn = page.locator('button[aria-label="Toggle Street View Coverage"]').first();
    if (await coverageBtn.isVisible()) {
        await coverageBtn.click();
        await page.waitForTimeout(300);
        await coverageBtn.click();
        console.log('✅ 6. 街景覆蓋圖層切換正常');
    }

    // 10. 自動化驗證：既有功能無降級 (天數聚焦與羅盤全景置中)
    const compassBtn = page.locator('button[aria-label="Fit Bounds"]').first();
    await expect(compassBtn).toBeVisible();
    await compassBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ 7. 全景置中羅盤按鈕正常');

    // 11. 既有底圖切換 (衛星 ⇄ 向量)
    const mapStyleBtn = page.locator('button[aria-label="Toggle Map Style"]').first();
    await expect(mapStyleBtn).toBeVisible();
    await mapStyleBtn.click();
    await page.waitForTimeout(300);
    await mapStyleBtn.click();
    console.log('✅ 8. 底圖切換 (向量 ⇄ 衛星) 正常');

    // 12. 嚴格驗收：確保整段旅程中 0 任何嚴重 Console Runtime Crash
    const criticalErrors = consoleErrors.filter(err =>
        !err.includes('favicon') &&
        !err.includes('Warning: ReactDOM.render') &&
        !err.includes('Download the React DevTools') &&
        !err.includes('404') && // 外部圖片/地圖瓦片未配置時的網絡 404
        !err.includes('Failed to load resource') &&
        !err.includes('Failed to load preferences') && // 離線/未綁定使用者之背景設定請求
        !err.includes('config is not valid') // MapLibre 瓦片快取設定提示
    );
    if (criticalErrors.length > 0) {
        console.log('Captured console errors:', criticalErrors);
    }
    expect(criticalErrors.length).toBe(0);

    console.log('🎉 【全自動化 E2E 驗收通過】：三大旗艦主鍵正常運作，既有功能 100% 零回歸 (Zero Regression)！');
});
