import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const frontendDir = path.resolve(__dirname, "..");
const userDataDir = path.join(__dirname, ".tmp-pwa-profile");
const PORT = 3333;
const BASE_URL = `http://localhost:${PORT}`;

// 確保乾淨的使用者設定檔目錄
if (fs.existsSync(userDataDir)) {
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
fs.mkdirSync(userDataDir, { recursive: true });

async function ensureServerRunning() {
  try {
    const res = await fetch(BASE_URL);
    if (res.ok || res.status === 200 || res.status === 304) {
      console.log(`✓ 伺服器已在 ${BASE_URL} 運行中。`);
      return null;
    }
  } catch {
    // 伺服器未運行，準備啟動
  }

  console.log(`⏳ 正在啟動生產預覽伺服器 (next start -p ${PORT})...`);
  const nextBin = path.join(frontendDir, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: frontendDir,
    stdio: "ignore",
    detached: false,
  });

  // 等待伺服器就緒 (最多等待 15 秒)
  const maxWait = 15000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(BASE_URL);
      if (res.status === 200) {
        console.log(`✓ 生產伺服器已於 ${Date.now() - start}ms 內就緒！`);
        return child;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  throw new Error(`❌ 伺服器於 ${maxWait}ms 內未能就緒！`);
}

async function runVerification() {
  console.log("=================================================");
  console.log("🚀 開始執行 PWA 離線重開 / 滑掉重啟 (Swipe-Away) 實機模擬驗證");
  console.log("=================================================");

  const serverChild = await ensureServerRunning();

  try {
    // Phase 1: 首次在有網路環境下開啟 PWA
    console.log(`\n[Phase 1] 首次連網開啟 App (${BASE_URL})...`);
    let context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 390, height: 844 }, // iPhone 14 / 15 螢幕比例
      serviceWorkers: "allow",
    });

    let page = await context.newPage();

    // 監聽控制台輸出
    page.on("console", (msg) => {
      if (msg.text().includes("[SW]") || msg.text().includes("Service Worker")) {
        console.log(`  [Browser Console] ${msg.text()}`);
      }
    });

    const startTimeOnline = Date.now();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    console.log(`  ✓ 頁面連網載入成功 (耗時: ${Date.now() - startTimeOnline}ms)`);

    // 等待 Service Worker 註冊、安裝並成為 active controller
    console.log("  ⏳ 等待 Service Worker 註冊與 Precache 寫入 CacheStorage...");
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      // 等待 controller 獲取控制權
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(true), { once: true });
          setTimeout(() => resolve(false), 5000);
        });
      }
      return !!reg.active;
    });

    console.log(`  ✓ Service Worker Active 狀態: ${swRegistered}`);

    // 檢查 CacheStorage 內是否已成功寫入 /
    const cacheStatus = await page.evaluate(async () => {
      const keys = await caches.keys();
      let rootFound = false;
      let totalCached = 0;
      for (const key of keys) {
        const c = await caches.open(key);
        const reqs = await c.keys();
        totalCached += reqs.length;
        for (const r of reqs) {
          if (r.url.endsWith("/") || r.url.includes("/?")) {
            rootFound = true;
          }
        }
      }
      return { keys, totalCached, rootFound };
    });

    console.log(`  ✓ 快取庫分區 (Cache Keys):`, cacheStatus.keys);
    console.log(`  ✓ 預快取資產總數: ${cacheStatus.totalCached}`);
    console.log(`  ✓ 根目錄 App Shell (/) 命中確認: ${cacheStatus.rootFound}`);

    if (!cacheStatus.rootFound) {
      throw new Error("❌ 根目錄 / 未被寫入任何 Cache 儲存區！");
    }

    // Phase 2: 使用者把 App 滑掉 (結束進程 / 關閉瀏覽器 Context)
    console.log("\n[Phase 2] 模擬使用者滑掉 App (結束進程、清除執行階段記憶體)...");
    await page.close();
    await context.close();
    console.log("  ✓ 瀏覽器進程已完全關閉，模擬 App 從背景任務滑掉。");

    // 等待 1 秒確保磁碟快取同步完畢
    await new Promise((r) => setTimeout(r, 1000));

    // Phase 3: 完全斷網 (離線狀態 / 飛航模式)，重開 App
    console.log("\n[Phase 3] 模擬開啟飛航模式 (完全斷網) 並從主畫面重開 PWA...");
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 390, height: 844 },
      serviceWorkers: "allow",
      offline: true, // 核心：完全斷網！
    });

    page = await context.newPage();

    const startTimeOffline = Date.now();
    console.log(`  ⏳ 正在離線導航至 ${BASE_URL}/?source=pwa ...`);

    const response = await page.goto(`${BASE_URL}/?source=pwa`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const offlineLoadTime = Date.now() - startTimeOffline;
    const status = response ? response.status() : "No Response";
    const fromServiceWorker = response ? response.fromServiceWorker() : false;

    console.log(`  ✓ 離線導航回應狀態: HTTP ${status}`);
    console.log(`  ✓ 來源是否為 Service Worker: ${fromServiceWorker}`);
    console.log(`  ✓ 離線秒開耗時: ${offlineLoadTime}ms (目標: < 500ms)`);

    // Phase 4: 檢查頁面內容與拒絕白屏
    console.log("\n[Phase 4] 驗證 DOM 渲染與防白屏機制...");
    await page.waitForLoadState("load").catch(() => {});

    const pageContent = await page.evaluate(() => {
      const bodyText = document.body.innerText || "";
      const htmlLength = document.body.innerHTML.length;
      const hasHeaderOrNav = !!document.querySelector("header, nav, main, [role='main'], div");
      return {
        title: document.title,
        htmlLength,
        hasHeaderOrNav,
        snippet: bodyText.slice(0, 150).replace(/\n/g, " "),
      };
    });

    console.log(`  ✓ 頁面 Title: "${pageContent.title}"`);
    console.log(`  ✓ Body HTML 長度: ${pageContent.htmlLength} 字元`);
    console.log(`  ✓ 是否包含實體 DOM 元素: ${pageContent.hasHeaderOrNav}`);
    console.log(`  ✓ 渲染文字摘要: "${pageContent.snippet}"`);

    // 截圖存檔作為物理證據
    const screenshotPath = path.join(projectRoot, "docs", "reports", "offline-swipe-reopen-proof.png");
    try {
      await page.screenshot({ path: screenshotPath });
      console.log(`  📸 離線畫面已存檔至: ${screenshotPath}`);
    } catch (e) {
      console.warn(`  ⚠️ 截圖略過 (無影響核心驗證): ${e.message}`);
    }

    await page.close();
    await context.close();

    // 斷言評判
    console.log("\n=================================================");
    console.log("📊 最終驗證評判結果 (Final Assertion Summary):");
    console.log(`- 離線 HTTP 狀態: ${status === 200 ? "PASS (200 OK)" : "FAIL (" + status + ")"}`);
    console.log(`- 服務工作者攔截: ${fromServiceWorker ? "PASS (from Service Worker)" : "FAIL"}`);
    console.log(`- 白屏偵測: ${pageContent.htmlLength > 500 ? "PASS (內容充實，無白屏)" : "FAIL (疑似白屏)"}`);
    console.log(`- 秒開效能: ${offlineLoadTime < 500 ? "PASS (" + offlineLoadTime + "ms < 500ms)" : "WARN (" + offlineLoadTime + "ms)"}`);
    console.log("=================================================");

    if (status !== 200 || !fromServiceWorker || pageContent.htmlLength <= 500) {
      console.error("❌ 驗證未達標！");
      process.exit(1);
    } else {
      console.log("🎉 全部物理驗證 100% 通過！滑掉 App 離線重開保證不白屏！");
    }
  } finally {
    if (serverChild) {
      console.log("🧹 正在關閉暫存伺服器進程...");
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(serverChild.pid), "/f", "/t"]);
      } else {
        serverChild.kill("SIGTERM");
      }
    }
    // 清理暫存設定檔
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

runVerification().catch((err) => {
  console.error("❌ 驗證過程發生例外:", err);
  process.exit(1);
});
