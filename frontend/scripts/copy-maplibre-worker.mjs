import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

const req = createRequire(import.meta.url);
try {
    const pkgPath = req.resolve('maplibre-gl/package.json');
    const dist = path.join(path.dirname(pkgPath), 'dist');
    const dest = path.join(frontendDir, 'public', 'maplibre');

    mkdirSync(dest, { recursive: true });
    for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
        const srcFile = path.join(dist, file);
        if (existsSync(srcFile)) {
            copyFileSync(srcFile, path.join(dest, file));
        }
    }
} catch {
    // maplibre-gl not yet resolved
}
