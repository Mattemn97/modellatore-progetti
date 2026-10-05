/* --- COMPILAZIONE DEL PROCESSO PRINCIPALE E DEL PRELOAD --- */
// esbuild compila e basta: i tipi li controlla `npm run typecheck` (tsc)
import { build } from 'esbuild';

const comune = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    external: ['electron'],
    logLevel: 'warning'
};

await Promise.all([
    // Processo principale in ESM (Electron lo carica da package.json "main")
    build({ ...comune, entryPoints: ['src/main/index.ts'], outfile: 'out/main/index.mjs', format: 'esm' }),
    // Il preload in sandbox deve essere CommonJS
    build({ ...comune, entryPoints: ['src/preload/index.ts'], outfile: 'out/preload/index.cjs', format: 'cjs' })
]);
