/* --- PROCESSO PRINCIPALE: AVVIO, ISTANZA UNICA, CHIUSURA --- */
import { app, type BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiImpostazioniApi } from './api/impostazioni.js';
import { ArchivioLibrerie } from './api/librerie.js';
import { ArchivioProgetti } from './api/progetti.js';
import { creaRouter } from './api/router.js';
import { creaFinestraPrincipale } from './finestra.js';
import { installaProtocollo, registraSchema, URL_INIZIALE } from './protocollo.js';
import { installaRichiestaTesto } from './richiesta-testo.js';

// out/main/index.mjs → out/
const cartellaOut = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Radice dell'app: index.html, style.css, settings.json, js/
const radice = app.getAppPath();
const sviluppo = process.argv.includes('--dev');

// Test end to end: dati di Chromium (localStorage, istanza unica) in una cartella a parte
if (process.env.MODELLATORE_DATI_UTENTE) app.setPath('userData', process.env.MODELLATORE_DATI_UTENTE);

registraSchema();

let finestra: BrowserWindow | null = null;

function mostraFinestra(): void {
    if (!finestra) return;
    if (finestra.isMinimized()) finestra.restore();
    finestra.show();
    finestra.focus();
}

async function avvia(): Promise<void> {
    // Cartella dei dati (progetti/, shared/, settings.json): la cartella dell'app fino alla voce 21
    const cartellaDati = radice;
    const impostazioni = leggiImpostazioniApi(cartellaDati);
    const progetti = new ArchivioProgetti(cartellaDati, impostazioni.versioniProgetti);
    progetti.prepara();
    const librerie = new ArchivioLibrerie(cartellaDati, impostazioni.versioniLibreria);
    librerie.prepara();
    installaProtocollo(radice, creaRouter({
        progetti,
        librerie,
        versione: app.getVersion(),
        maxFileClienteMb: impostazioni.maxFileClienteMb
    }));
    installaRichiestaTesto(cartellaOut);
    finestra = creaFinestraPrincipale(cartellaOut, sviluppo);
    finestra.on('closed', () => { finestra = null; });
    await finestra.loadURL(URL_INIZIALE);
}

if (!app.requestSingleInstanceLock()) {
    // Un altro modellatore è già aperto: lui si porta in primo piano, noi usciamo
    app.quit();
} else {
    app.on('second-instance', mostraFinestra);
    app.whenReady().then(avvia).catch((e: unknown) => {
        console.error(e);
        app.quit();
    });
    app.on('window-all-closed', () => app.quit());
}
