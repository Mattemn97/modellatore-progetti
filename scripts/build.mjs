/* --- COMPILAZIONE: PROCESSO PRINCIPALE, PRELOAD E INTERFACCIA --- */
// esbuild compila e basta: i tipi li controlla `npm run typecheck` (tsc)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const nodo = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    external: ['electron'],
    logLevel: 'warning'
};

// Interfaccia: un bundle ESM per pagina, servito da out/renderer/ tramite app://
const interfaccia = {
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'chrome130',
    sourcemap: true,
    logLevel: 'warning',
    entryPoints: { app: 'src/renderer/app.js', benvenuto: 'src/renderer/benvenuto.js' },
    outdir: 'out/renderer'
};

fs.rmSync('out/renderer', { recursive: true, force: true });
await Promise.all([
    // Processo principale in ESM (Electron lo carica da package.json "main")
    build({ ...nodo, entryPoints: ['src/main/index.ts'], outfile: 'out/main/index.mjs', format: 'esm' }),
    // Il preload in sandbox deve essere CommonJS
    build({ ...nodo, entryPoints: ['src/preload/index.ts'], outfile: 'out/preload/index.cjs', format: 'cjs' }),
    build(interfaccia)
]);
for (const file of ['index.html', 'benvenuto.html', 'style.css']) {
    fs.copyFileSync(path.join('src/renderer', file), path.join('out/renderer', file));
}
