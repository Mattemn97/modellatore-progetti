/* --- PROCESSO PRINCIPALE: AVVIO, ISTANZA UNICA, CHIUSURA --- */
import { app, type BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaFinestraPrincipale } from './finestra.js';
import { urlPaginaErrore } from './pagina-errore.js';
import { ErrorePonte, PontePython } from './ponte-python.js';
import { installaProtocollo, registraSchema, URL_INIZIALE } from './protocollo.js';

// out/main/index.mjs → out/
const cartellaOut = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Radice dell'app: index.html, style.css, settings.json, js/ (e start.py finché serve il ponte)
const radice = app.getAppPath();
const sviluppo = process.argv.includes('--dev');

registraSchema();

let finestra: BrowserWindow | null = null;
const ponte = new PontePython(radice);

function mostraFinestra(): void {
    if (!finestra) return;
    if (finestra.isMinimized()) finestra.restore();
    finestra.show();
    finestra.focus();
}

async function avvia(): Promise<void> {
    installaProtocollo(radice, (richiesta, url) => ponte.inoltra(richiesta, url));
    finestra = creaFinestraPrincipale(cartellaOut, sviluppo);
    finestra.on('closed', () => { finestra = null; });
    try {
        await ponte.avvia();
    } catch (e) {
        const motivo = e instanceof Error ? e.message : String(e);
        const dettagli = e instanceof ErrorePonte ? e.dettagli : '';
        await finestra.loadURL(urlPaginaErrore(
            'Il servizio dei file non è partito',
            `In questa versione di sviluppo il programma usa ancora start.py per leggere e scrivere i file. ${motivo}`,
            dettagli,
            'Controlla che Python 3.11 sia installato e nel PATH (oppure indica il suo percorso nella variabile <code>MODELLATORE_PYTHON</code>), poi riapri il programma. Per provare a mano: <code>python start.py --solo-api --porta 8090</code>.'
        ));
        finestra.show();
        return;
    }
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
    // Il processo figlio va chiuso sempre, anche dopo un errore
    app.on('will-quit', () => ponte.ferma());
    process.on('exit', () => ponte.ferma());
}
