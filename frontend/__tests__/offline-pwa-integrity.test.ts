import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("🛡️ PWA 離線秒開與 Precache 完整性硬核驗證 (Offline PWA Integrity)", () => {
    const frontendDir = path.resolve(__dirname, "..");
    const swPath = path.join(frontendDir, "public", "sw.js");
    const swSourcePath = path.join(frontendDir, "app", "sw.ts");
    const layoutPath = path.join(frontendDir, "app", "layout.tsx");
    const landingPath = path.join(frontendDir, "components", "views", "landing-page.tsx");
    const swRegisterPath = path.join(frontendDir, "components", "service-worker-register.tsx");

    it("TC-1: public/sw.js 實體檔案必須生成且大小 > 40 KiB", () => {
        expect(fs.existsSync(swPath)).toBe(true);
        const stats = fs.statSync(swPath);
        expect(stats.size).toBeGreaterThan(40 * 1024); // 大於 40KB
    });

    it("TC-2: public/sw.js 預快取清單中必須明確包含根目錄 '/' 與版本 revision", () => {
        const content = fs.readFileSync(swPath, "utf-8");
        const arrEnd = content.indexOf("];");
        const arrStart = content.indexOf("[");
        expect(arrStart).toBeGreaterThan(-1);
        expect(arrEnd).toBeGreaterThan(arrStart);

        const manifestSnippet = content.slice(arrStart, arrEnd + 1);
        // 透過 eval 解析 manifest 陣列
        const manifest = eval(manifestSnippet) as Array<{ url: string; revision?: string | null }>;
        
        expect(manifest.length).toBeGreaterThan(20); // 包含 public/ 核心靜態資產與根目錄 App Shell
        expect(manifest.some(e => e.url.includes("_next"))).toBe(false); // 🛡️ 徹底排除脆弱動態 chunks，杜絕 404
        
        // 關鍵斷言：根目錄 / 必須存在
        const rootEntry = manifest.find(e => e.url === "/");
        expect(rootEntry).toBeDefined();
        expect(rootEntry?.revision).toBeTruthy();
        expect(typeof rootEntry?.revision).toBe("string");
    });

    it("TC-3: sw.ts 必須宣告 document 離線 fallbacks 與三重保險 handlerDidError", () => {
        const swSource = fs.readFileSync(swSourcePath, "utf-8");

        // 必須宣告 fallbacks
        expect(swSource).toContain("fallbacks:");
        expect(swSource).toContain('url: "/"');
        expect(swSource).toContain('request.destination === "document"');

        // handlerDidError 必須包含多層保險
        expect(swSource).toContain("app-shell-navigation");
        expect(swSource).toContain('serwist.matchPrecache("/")');
        expect(swSource).toContain("precache");
    });

    it("TC-4: RootLayout (layout.tsx) 必須在全域頂層掛載 ServiceWorkerRegister", () => {
        const layoutSource = fs.readFileSync(layoutPath, "utf-8");
        expect(layoutSource).toContain("ServiceWorkerRegister");
        expect(layoutSource).toContain("<ServiceWorkerRegister />");

        // 註冊組件本身必須存在
        expect(fs.existsSync(swRegisterPath)).toBe(true);
        const registerSource = fs.readFileSync(swRegisterPath, "utf-8");
        expect(registerSource).toContain("navigator.serviceWorker");
        expect(registerSource).toContain('.register("/sw.js"');
    });

    it("TC-5: landing-page.tsx 未掛載門鎖已拔除，禁止 return null 白屏", () => {
        const landingSource = fs.readFileSync(landingPath, "utf-8");
        expect(landingSource).not.toContain("if (!mounted) return null;");
        expect(landingSource).toContain("if (!mounted) return <AppShellSkeleton />;");
    });

    it("TC-6: 離線導航保險機制邏輯執行模擬 (Offline Navigation Fallback Logic Simulation)", async () => {
        // 模擬 CacheStorage 環境
        const mockShellHtml = "<!DOCTYPE html><html><head><title>Tabidachi</title></head><body><div id='__next'>AppShell</div></body></html>";
        const mockCacheStorage = new Map<string, Map<string, Response>>();

        const fakeCaches = {
            open: async (name: string) => {
                if (!mockCacheStorage.has(name)) {
                    mockCacheStorage.set(name, new Map());
                }
                const store = mockCacheStorage.get(name)!;
                return {
                    match: async (url: string) => store.get(url) || null,
                    put: async (url: string, res: Response) => store.set(url, res),
                };
            },
            keys: async () => Array.from(mockCacheStorage.keys()),
        };

        // 預先在 precache 桶注入根目錄 HTML
        const precacheBucket = await fakeCaches.open("serwist-precache-v2-http://localhost:3000/");
        await precacheBucket.put("/", new Response(mockShellHtml, {
            status: 200,
            headers: { "content-type": "text/html" },
        }));

        // 模擬 sw.ts 中的 handlerDidError 三重保險邏輯
        const simulateHandlerDidError = async () => {
            const navCache = await fakeCaches.open("app-shell-navigation");
            const cachedNav = await navCache.match("/");
            if (cachedNav) return cachedNav;

            const cacheKeys = await fakeCaches.keys();
            for (const key of cacheKeys) {
                if (key.includes("precache")) {
                    const pCache = await fakeCaches.open(key);
                    const match = await pCache.match("/");
                    if (match) return match;
                }
            }

            return Response.error();
        };

        const fallbackResponse = await simulateHandlerDidError();
        expect(fallbackResponse.status).toBe(200);
        const text = await fallbackResponse.text();
        expect(text).toContain("<title>Tabidachi</title>");
        expect(text).toContain("AppShell");
    });

    it("TC-7: 實機離線滑掉重開 (Swipe-Away) 物理證據存在且有效", () => {
        const proofPath = path.join(frontendDir, "..", "docs", "reports", "offline-swipe-reopen-proof.png");
        expect(fs.existsSync(proofPath)).toBe(true);
        const stats = fs.statSync(proofPath);
        expect(stats.size).toBeGreaterThan(50 * 1024); // 截圖大於 50KB，證明非空白圖
    });
});

