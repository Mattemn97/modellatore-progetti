/* --- E2E: GUSCIO DESKTOP (spec 0016) --- */
import { expect, test } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ambienteElectron, apriApp, chiudiTour, eseguibileElectron, preparaCopia } from './app';

test("apre l'editor nella finestra desktop da app://, con la libreria e le API", async () => {
    const { app, pagina, chiudi } = await apriApp();
    try {
        await expect(pagina.getByText('Centralina Condivisa')).toBeVisible({ timeout: 20_000 });
        expect(pagina.url()).toBe('app://modellatore/index.html');
        const titolo = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle());
        expect(titolo).toBe('Modellatore MBSE');
        const prefs = await app.evaluate(({ BrowserWindow }) => {
            // Metodo presente a runtime ma non nei tipi di Electron
            type ConPreferenze = { getLastWebPreferences(): Electron.WebPreferences | null };
            const contenuti = BrowserWindow.getAllWindows()[0]?.webContents as unknown as ConPreferenze | undefined;
            const p = contenuti?.getLastWebPreferences();
            return { ci: p?.contextIsolation, ni: p?.nodeIntegration, sb: p?.sandbox };
        });
        expect(prefs).toEqual({ ci: true, ni: false, sb: true });
        const stati = await pagina.evaluate(async () => {
            const percorsi = ['/api/progetti', '/js/app.js', '/settings.json', '/start.py', '/js/%2e%2e/start.py', '/progetti/_ultimo.json'];
            return Promise.all(percorsi.map(async (p) => (await fetch(p)).status));
        });
        expect(stati).toEqual([200, 200, 200, 404, 404, 404]);
    } finally {
        await chiudi();
    }
});

test('trascinando un blocco il progetto si salva su disco, Ctrl+Z lo annulla', async () => {
    const { pagina, cartella, chiudi } = await apriApp();
    const file = path.join(cartella, 'progetti', 'nuovo_progetto.json');
    const nodi = (): number => JSON.parse(fs.readFileSync(file, 'utf-8')).workspace.nodes.length;
    try {
        await expect(pagina.getByText('Centralina Condivisa')).toBeVisible({ timeout: 20_000 });
        await chiudiTour(pagina);
        await pagina.dragAndDrop('text=Centralina Condivisa', '#canvasContainer', { targetPosition: { x: 400, y: 300 } });
        await expect.poll(nodi, { timeout: 10_000 }).toBe(1);
        await pagina.locator('#canvasContainer').click({ position: { x: 50, y: 50 } });
        await pagina.keyboard.press('Control+z');
        await expect.poll(nodi, { timeout: 10_000 }).toBe(0);
    } finally {
        await chiudi();
    }
});

test('un link esterno non apre finestre del programma', async () => {
    const { app, pagina, chiudi } = await apriApp();
    try {
        // Il browser di sistema non deve aprirsi durante il test
        await app.evaluate(({ shell }) => { shell.openExternal = async () => {}; });
        await pagina.evaluate(() => { window.open('https://example.com', '_blank'); });
        await pagina.waitForTimeout(500);
        expect(app.windows()).toHaveLength(1);
    } finally {
        await chiudi();
    }
});

test('un secondo avvio esce subito e lascia la finestra già aperta', async () => {
    const copia = preparaCopia();
    const { app, pagina, chiudi } = await apriApp({ copia });
    try {
        await expect(pagina.getByText('Centralina Condivisa')).toBeVisible({ timeout: 20_000 });
        const seconda = spawn(eseguibileElectron(), [copia.cartella], { env: ambienteElectron(copia) });
        const codice = await new Promise<number | null>((r) => seconda.on('exit', r));
        expect(codice).toBe(0);
        expect(app.windows()).toHaveLength(1);
    } finally {
        await chiudi();
    }
});

test('nessun processo Python parte: le API sono nel processo principale', async () => {
    const { pagina, chiudi } = await apriApp();
    try {
        await expect(pagina.getByText('Centralina Condivisa')).toBeVisible({ timeout: 20_000 });
        expect(processiDellaProva().filter((nome) => /python|^py\.exe$/i.test(nome))).toEqual([]);
    } finally {
        await chiudi();
    }
});

// Nomi dei processi lanciati sulle copie dei test (Electron e i suoi figli)
function processiDellaProva(): string[] {
    if (process.platform !== 'win32') return [];
    const comando = "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*modellatore-e2e-*' } | ForEach-Object { $_.Name }";
    const uscita = execSync(`powershell -NoProfile -Command "${comando}"`).toString();
    return uscita.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
}
