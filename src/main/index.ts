/* --- PROCESSO PRINCIPALE: AVVIO, CARTELLE DI LAVORO, ISTANZA UNICA, CHIUSURA --- */
import { app, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiImpostazioniApi } from './api/impostazioni.js';
import { ArchivioLibrerie } from './api/librerie.js';
import { ArchivioProgetti } from './api/progetti.js';
import { creaRouter } from './api/router.js';
import { installaCanaliCartelle, type StatoCartelleApp } from './cartelle-ipc.js';
import { cartelleDi, leggiConfigurazione, NOME_CARTELLA_PREDEFINITA, scriviConfigurazione, statoCartelle, type Cartelle } from './configurazione.js';
import { creaFinestraPrincipale } from './finestra.js';
import { installaProtocollo, registraSchema, URL_BENVENUTO, URL_INIZIALE } from './protocollo.js';
import { installaRichiestaTesto } from './richiesta-testo.js';

// out/main/index.mjs → out/
const cartellaOut = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Cartella del programma (settings.json con i valori predefiniti) e interfaccia compilata (out/renderer)
const radice = app.getAppPath();
const cartellaInterfaccia = path.join(cartellaOut, 'renderer');
const settingsPredefiniti = path.join(radice, 'settings.json');
const sviluppo = process.argv.includes('--dev');

// Test end to end: dati di Chromium (localStorage, configurazione, istanza unica) e Documenti in cartelle a parte
if (process.env.MODELLATORE_DATI_UTENTE) app.setPath('userData', process.env.MODELLATORE_DATI_UTENTE);
if (process.env.MODELLATORE_DOCUMENTI) app.setPath('documents', process.env.MODELLATORE_DOCUMENTI);

registraSchema();

let finestra: BrowserWindow | null = null;
let cartelle: Cartelle | null = null;
let motivo: string | null = null;
let router: ReturnType<typeof creaRouter> | null = null;

function mostraFinestra(): void {
    if (!finestra) return;
    if (finestra.isMinimized()) finestra.restore();
    finestra.show();
    finestra.focus();
}

// Cartelle da usare all'avvio: variabili di ambiente (test), cartella del repository (npm run dev), configurazione salvata
function cartelleIniziali(): Cartelle | null {
    const lavoro = process.env.MODELLATORE_CARTELLA_LAVORO;
    if (lavoro) return { lavoro, librerie: process.env.MODELLATORE_CARTELLA_LIBRERIE || path.join(lavoro, 'shared') };
    if (sviluppo) return { lavoro: radice, librerie: path.join(radice, 'shared') };
    const configurazione = leggiConfigurazione(app.getPath('userData'));
    return configurazione ? cartelleDi(configurazione) : null;
}

// API sulle cartelle date (progetti, librerie, impostazioni lette all'avvio)
function attivaApi(c: Cartelle): void {
    const impostazioni = leggiImpostazioniApi(c.lavoro);
    const progetti = new ArchivioProgetti(c.lavoro, impostazioni.versioniProgetti);
    progetti.prepara();
    const librerie = new ArchivioLibrerie(c.lavoro, c.librerie, impostazioni.versioniLibreria);
    librerie.prepara();
    router = creaRouter({ progetti, librerie, versione: app.getVersion(), maxFileClienteMb: impostazioni.maxFileClienteMb });
    cartelle = c;
    motivo = null;
}

function rispostaNonConfigurato(): Response {
    return Response.json({ errore: 'non_configurato', messaggio: 'Scegli prima la cartella di lavoro.' }, { status: 503 });
}

function statoPerPagine(): StatoCartelleApp {
    const proposta = cartelle ?? cartelleIniziali() ?? (() => {
        const lavoro = path.join(app.getPath('documents'), NOME_CARTELLA_PREDEFINITA);
        return { lavoro, librerie: path.join(lavoro, 'shared') };
    })();
    const settings = cartelle ? path.join(cartelle.lavoro, 'settings.json') : null;
    return { cartelle, proposta, motivo, settings };
}

async function avvia(): Promise<void> {
    installaProtocollo(cartellaInterfaccia, (richiesta, url) => (router ? router(richiesta, url) : Promise.resolve(rispostaNonConfigurato())), () => {
        const file = cartelle ? path.join(cartelle.lavoro, 'settings.json') : null;
        return file && fs.existsSync(file) ? file : settingsPredefiniti;
    });
    installaRichiestaTesto(cartellaOut);
    installaCanaliCartelle({
        stato: statoPerPagine,
        impostazioniPredefinite: settingsPredefiniti,
        usa: (nuove) => {
            scriviConfigurazione(app.getPath('userData'), {
                formatVersion: 1,
                cartellaLavoro: nuove.lavoro,
                cartellaLibrerie: path.resolve(nuove.librerie) === path.resolve(nuove.lavoro, 'shared') ? null : nuove.librerie
            });
            attivaApi(nuove);
            // La pagina si ricarica sulle cartelle nuove appena la risposta è partita
            setImmediate(() => { void finestra?.loadURL(URL_INIZIALE); });
        },
        ricarica: () => {
            if (!cartelle) return;
            // Impostazioni delle API (versioni, limiti) rilette: un import può aver portato un settings.json nuovo
            attivaApi(cartelle);
            setImmediate(() => { void finestra?.loadURL(URL_INIZIALE); });
        }
    });

    const iniziali = cartelleIniziali();
    if (iniziali) {
        const stato = statoCartelle(iniziali);
        if (stato.pronte) attivaApi(iniziali);
        else motivo = stato.motivo;
    }

    finestra = creaFinestraPrincipale(cartellaOut, sviluppo);
    finestra.on('closed', () => { finestra = null; });
    await finestra.loadURL(router ? URL_INIZIALE : URL_BENVENUTO);
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
