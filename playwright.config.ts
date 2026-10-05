/* --- TEST END TO END SULL'APP DESKTOP --- */
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/e2e',
    // Una sola app Electron alla volta: l'istanza unica impedirebbe le altre
    workers: 1,
    fullyParallel: false,
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { trace: 'retain-on-failure' }
});
