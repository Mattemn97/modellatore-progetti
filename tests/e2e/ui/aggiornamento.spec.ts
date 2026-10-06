/* --- E2E: AGGIORNAMENTO DELLA VERSIONE DESKTOP CONTRO UN SERVER DI RELEASE FINTO (spec 0025) --- */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { apriApp, pronta, registraDialoghi } from '../app';

// Una Release appena più nuova dell'app (patch + 1) il cui setup non corrisponde all'impronta di latest.yml:
// si vede, ma non si installa. Segue version di package.json, così il test vale a ogni rilascio
const [maggiore, minore, patch] = (JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')) as { version: string }).version.split('.').map(Number);
const NUOVA = `${maggiore}.${minore}.${(patch ?? 0) + 1}`;
const SETUP = `Modellatore-MBSE-Setup-${NUOVA}.exe`;
const CONTENUTO = Buffer.from('non sono un setup');
const LATEST = `version: ${NUOVA}
files:
  - url: ${SETUP}
    sha512: ${Buffer.alloc(64, 1).toString('base64')}
    size: ${CONTENUTO.length}
path: ${SETUP}
sha512: ${Buffer.alloc(64, 1).toString('base64')}
releaseDate: '2026-10-05T10:00:00.000Z'
releaseNotes: Pannelli più veloci
`;

test('avviso con le novità; un download che non corrisponde all\'impronta lascia la versione di prima', async () => {
    const server = http.createServer((richiesta, risposta) => {
        // electron-updater aggiunge ?noCache=…: conta solo il percorso
        const percorso = new URL(richiesta.url ?? '/', 'http://localhost').pathname;
        if (percorso === '/latest.yml') {
            risposta.writeHead(200, { 'Content-Type': 'text/yaml' }).end(LATEST);
        } else if (percorso === `/${SETUP}`) {
            risposta.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': CONTENUTO.length }).end(CONTENUTO);
        } else {
            risposta.writeHead(404).end();
        }
    });
    await new Promise<void>((pronto) => server.listen(0, '127.0.0.1', pronto));
    const porta = (server.address() as AddressInfo).port;
    // La cache di electron-updater va in LOCALAPPDATA: una cartella temporanea, mai quella dell'utente
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'modellatore-e2e-aggiornamento-'));
    const { pagina, chiudi } = await apriApp({ env: { MODELLATORE_URL_RELEASE: `http://127.0.0.1:${porta}/`, LOCALAPPDATA: cache } });
    try {
        registraDialoghi(pagina);
        await pronta(pagina);
        const banner = pagina.locator('#bannerAggiornamento');
        await expect(banner).toContainText(`È disponibile la versione ${NUOVA}`, { timeout: 20_000 });
        await banner.locator('[data-aggiornamento="novita"]').click();
        await expect(banner.locator('.note-aggiornamento')).toHaveText('Pannelli più veloci');

        await banner.locator('[data-aggiornamento="installa"]').click();
        await expect(banner).toContainText('Aggiornamento non riuscito', { timeout: 20_000 });
        await expect(banner).toContainText("non corrisponde all'impronta");
        // L'app è ancora qui, sulla versione di prima
        await expect(pagina.locator('#badgeSalvataggio')).toBeVisible();
    } finally {
        await chiudi();
        server.close();
        fs.rmSync(cache, { recursive: true, force: true });
    }
});
