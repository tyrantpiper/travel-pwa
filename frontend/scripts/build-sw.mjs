import { mkdir, writeFile } from "node:fs/promises";
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
}

console.log("[build-sw] Service Worker build complete! Assets ready in public/ directory.");
