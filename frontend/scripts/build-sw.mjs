import { mkdir, writeFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

process.env.NODE_ENV = "production";

console.log("[build-sw] Starting build-time Service Worker compilation...");

import { execSync } from "node:child_process";

const gitRev = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "prod-" + Date.now();
  }
})();

const { createSerwistRoute } = await import("@serwist/turbopack");

const { generateStaticParams, GET } = createSerwistRoute({
  swSrc: path.join(frontendDir, "app", "sw.ts"),
  useNativeEsbuild: true,
  // 🛡️ 關鍵修復：僅快取 public/ 穩固資產，徹底剔除 .next/static 動態臨時 chunks，杜絕 404
  globPatterns: ["public/**/*"],
  additionalPrecacheEntries: [
    { url: "/", revision: gitRev },
  ],
  esbuildOptions: {
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
  },
});

const outDir = path.join(frontendDir, "public");
await mkdir(outDir, { recursive: true });

const params = await generateStaticParams();
for (const { path: filePath } of params) {
  const res = await GET(new Request(`http://localhost/${filePath}`), {
    params: Promise.resolve({ path: filePath }),
  });
  const content = await res.text();
  const targetPath = path.join(outDir, filePath);
  await writeFile(targetPath, content, "utf-8");
  console.log(`[build-sw] ✅ Generated static asset: ${targetPath} (${(content.length / 1024).toFixed(2)} KiB)`);

  // 🛡️ 關鍵補足：若在 Vercel 雲端構建環境，同步輸出至 .vercel/output/static
  const vercelStaticDir = path.join(frontendDir, ".vercel", "output", "static");
  if (existsSync(vercelStaticDir)) {
    try {
      await cp(targetPath, path.join(vercelStaticDir, filePath));
      console.log(`[build-sw] 🚀 Synced to Vercel output: ${filePath}`);
    } catch (copyErr) {
      console.warn(`[build-sw] ⚠️ Vercel sync warning (non-fatal): ${copyErr.message}`);
    }
  }
}

console.log("[build-sw] Service Worker build complete! Assets ready in public/ directory.");

