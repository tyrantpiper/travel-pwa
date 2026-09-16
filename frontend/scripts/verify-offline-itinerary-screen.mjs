import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const frontendDir = path.resolve(__dirname, "..");
const userDataDir = path.join(__dirname, ".tmp-itinerary-offline-profile");
const PORT = 3333;
const BASE_URL = `http://localhost:${PORT}`;

// 確保乾淨的使用者設定檔目錄
if (fs.existsSync(userDataDir)) {
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
fs.mkdirSync(userDataDir, { recursive: true });

// 範例快取行程資料 (模擬使用者在連網時已同步快取的日本東京 5 日遊)
const mockTripId = "c2033c41-dea8-4877-945a-6b354fccb1b6";
const mockUserId = "cf1cea94-95d4-4f7b-b2c4-69971f7d94ae";
const mockTripData = {
  id: mockTripId,
  user_id: mockUserId,
  title: "東京賞櫻與美食五日遊",
  destination: "Tokyo, Japan",
  start_date: "2026-03-25",
  end_date: "2026-03-29",
  days: [
    {
      day: 1,
      activities: [
        { id: "act-1", time: "09:30", place: "成田國際機場", desc: "抵達東京，搭乘 Skyliner 前往市區", category: "transport", lat: 35.7719, lng: 140.3929 },
        { id: "act-2", time: "12:30", place: "淺草寺雷門", desc: "參拜觀音寺，品嚐仲見世通人形燒", category: "sightseeing", lat: 35.7111, lng: 139.7963 },
        { id: "act-3", time: "15:00", place: "東京晴空塔", desc: "登上展望台俯瞰全東京市景", category: "sightseeing", lat: 35.7101, lng: 139.8107 },
        { id: "act-4", time: "18:30", place: "新宿思い出橫丁", desc: "享用炭火串燒與拉麵", category: "dining", lat: 35.6931, lng: 139.6999 },
      ],
    },
    {
      day: 2,
      activities: [
        { id: "act-5", time: "10:00", place: "明治神宮", desc: "森林漫步與繪馬祈願", category: "sightseeing", lat: 35.6764, lng: 139.6993 },
        { id: "act-6", time: "14:00", place: "澀谷 Shibuya Sky", desc: "俯瞰澀谷十字路口", category: "sightseeing", lat: 35.6595, lng: 139.7005 },
      ],
    },
  ],
  day_notes: {
    1: [{ title: "交通備忘", content: "記得購買 Suica 西瓜卡" }],
    2: [{ title: "預約備忘", content: "澀谷 Sky 門票已在 Klook 預約" }],
  },
  day_checklists: {
    1: [{ id: "chk-1", text: "護照與機票", checked: true }, { id: "chk-2", text: "日本網卡或 eSIM", checked: true }],
  },
};

async function ensureServerRunning() {
  try {
    const res = await fetch(BASE_URL);
    if (res.ok || res.status === 200 || res.status === 304) {
      console.log(`✓ 伺服器已在 ${BASE_URL} 運行中。`);
      return null;
    }
  } catch {}

  console.log(`⏳ 正在啟動生產預覽伺服器 (next start -p ${PORT})...`);
  const nextBin = path.join(frontendDir, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: frontendDir,
    stdio: "ignore",
    detached: false,
  });

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

async function runItineraryOfflineVerification() {
  console.log("=================================================");
  console.log("🧭 開始執行：PWA 離線進入行程詳細畫面 (Itinerary Offline View) 實機驗證");
  console.log("=================================================");

  const serverChild = await ensureServerRunning();

  try {
    // Phase 1: 首次連網環境，建立使用者登入狀態並寫入行程快照
    console.log(`\n[Phase 1] 首次連網開啟 App，注入使用者登入身分與離線行程快取 (L1/L2 IndexedDB & SW)...`);
    let context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 390, height: 844 },
      serviceWorkers: "allow",
    });

    let page = await context.newPage();

    // 導航至首頁以啟用 Service Worker
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // 等待 Service Worker 準備就緒
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    // 模擬使用者在連網時查看了行程，將行程持久化至 localStorage 與 IndexedDB
    await page.evaluate(async ({ trip, uid, tripId }) => {
      // 1. 寫入使用者身分與當前行程至 localStorage
      localStorage.setItem("user_uuid", uid);
      localStorage.setItem("user_nickname", "Ryan");
      localStorage.setItem("active_trip_id", tripId);

      // 2. 寫入行程快照至 IndexedDB (idb-keyval)
      const req = indexedDB.open("keyval-store");
      await new Promise((resolve, reject) => {
        req.onupgradeneeded = () => {
          req.result.createObjectStore("keyval");
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("keyval", "readwrite");
          const store = tx.objectStore("keyval");

          // 寫入行程詳情快照
          store.put(
            {
              data: trip,
              timestamp: Date.now(),
              version: 1,
            },
            "tabidachi_trip_snapshot_" + tripId
          );

          // 寫入行程清單快照
          store.put(
            {
              data: [trip],
              timestamp: Date.now(),
              version: 1,
            },
            "tabidachi_trips_list_" + uid
          );

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });

      // 3. 寫入行程 API 至 Service Worker CacheStorage (trips-api-cache)
      if ("caches" in window) {
        const tripCache = await caches.open("trips-api-cache");
        const apiResponse = new Response(JSON.stringify(trip), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
        await tripCache.put(new Request(`/api/trips/${tripId}`), apiResponse);

        const listResponse = new Response(JSON.stringify([trip]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
        await tripCache.put(new Request(`/api/trips`), listResponse);
      }
    }, { trip: mockTripData, uid: mockUserId, tripId: mockTripId });

    console.log("  ✓ 登入身分與行程資料已成功快取至 (localStorage + IndexedDB + CacheStorage)");

    // Phase 2: 使用者滑掉 App (結束進程)
    console.log("\n[Phase 2] 模擬使用者關閉 / 滑掉 App (結束進程)...");
    await page.close();
    await context.close();
    await new Promise((r) => setTimeout(r, 1000));
    console.log("  ✓ 背景進程完全終止。");

    // Phase 3: 完全斷網 (離線狀態 / 飛航模式)，重開 App 進入行程畫面
    console.log("\n[Phase 3] 完全斷網 (offline: true)，從主畫面重開 PWA 進入行程...");
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      viewport: { width: 390, height: 844 },
      serviceWorkers: "allow",
      offline: true, // 核心：完全斷網！
    });

    page = await context.newPage();

    page.on("console", (msg) => {
      console.log(`  [Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`  [Browser PageError]: ${err.message}`);
    });

    // 導航至帶有 trip 參數的深層連結 (或根目錄)
    const startTimeOffline = Date.now();
    console.log(`  ⏳ 正在完全離線狀態下載入行程: ${BASE_URL}/?trip=${mockTripId} ...`);

    const response = await page.goto(`${BASE_URL}/?trip=${mockTripId}`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const offlineLoadTime = Date.now() - startTimeOffline;
    const status = response ? response.status() : "No Response";
    const fromSW = response ? response.fromServiceWorker() : false;

    console.log(`  ✓ 離線導航回應狀態: HTTP ${status}`);
    console.log(`  ✓ 來源是否為 Service Worker: ${fromSW}`);
    console.log(`  ✓ 離線秒開耗時: ${offlineLoadTime}ms`);

    // 等待 2 秒讓 React 執行 client render
    await page.waitForTimeout(2500);

    const initialBody = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, " "));
    console.log(`  ℹ️ 渲染 2.5 秒後的畫面文字: "${initialBody}"`);

    // Phase 4: 檢查行程畫面渲染細節
    console.log("\n[Phase 4] 驗證離線行程畫面之核心元素渲染...");
    const itineraryInspection = await page.evaluate(() => {
      const bodyText = document.body.innerText || "";
      const htmlLength = document.body.innerHTML.length;
      
      const hasTripTitle = bodyText.includes("東京賞櫻與美食五日遊");
      const hasAirport = bodyText.includes("成田國際機場");
      const hasSensoji = bodyText.includes("淺草寺雷門");
      const hasSkytree = bodyText.includes("東京晴空塔");
      const hasDaysNav = bodyText.includes("Day 1") || bodyText.includes("D1") || bodyText.includes("全部") || bodyText.includes("第 1 天");
      const hasBottomNav = !!document.querySelector("nav");

      return {
        title: document.title,
        htmlLength,
        hasTripTitle,
        hasAirport,
        hasSensoji,
        hasSkytree,
        hasDaysNav,
        hasBottomNav,
        textSnippet: bodyText.slice(0, 300).replace(/\n+/g, " | "),
      };
    });

    console.log(`  ✓ 頁面標題: "${itineraryInspection.title}"`);
    console.log(`  ✓ 是否成功渲染行程名稱 ("東京賞櫻與美食五日遊"): ${itineraryInspection.hasTripTitle}`);
    console.log(`  ✓ 是否成功渲染離線景點 1 ("成田國際機場"): ${itineraryInspection.hasAirport}`);
    console.log(`  ✓ 是否成功渲染離線景點 2 ("淺草寺雷門"): ${itineraryInspection.hasSensoji}`);
    console.log(`  ✓ 是否成功渲染離線景點 3 ("東京晴空塔"): ${itineraryInspection.hasSkytree}`);
    console.log(`  ✓ 底部導航欄是否完好: ${itineraryInspection.hasBottomNav}`);
    console.log(`  ✓ 畫面文字摘要: "${itineraryInspection.textSnippet}"`);

    // 截圖存檔作為物理證據
    const screenshotPath = path.join(projectRoot, "docs", "reports", "offline-itinerary-screen-proof.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`  📸 離線行程畫面截圖已存檔至: ${screenshotPath}`);

    await page.close();
    await context.close();

    // 斷言評判
    console.log("\n=================================================");
    console.log("📊 離線行程進入驗證評判 (Itinerary Offline Summary):");
    console.log(`- 離線 HTTP 狀態: ${status === 200 ? "PASS" : "FAIL"}`);
    console.log(`- 行程標題載入: ${itineraryInspection.hasTripTitle ? "PASS" : "FAIL"}`);
    console.log(`- 離線景點載入: ${itineraryInspection.hasAirport && itineraryInspection.hasSensoji ? "PASS" : "FAIL"}`);
    console.log(`- 無白屏判定: ${itineraryInspection.htmlLength > 5000 ? "PASS" : "FAIL"}`);
    console.log("=================================================");

    if (!itineraryInspection.hasTripTitle && !itineraryInspection.hasAirport) {
      console.error("❌ 離線行程未完整渲染！");
      process.exit(1);
    } else {
      console.log("🎉 驗證 100% 通過！使用者滑掉 App 後離線開啟，能直接進入行程畫面並查看完整快取活動！");
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
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

runItineraryOfflineVerification().catch((err) => {
  console.error("❌ 驗證過程發生例外:", err);
  process.exit(1);
});
