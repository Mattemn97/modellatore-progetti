/* --- FINESTRA PRINCIPALE: SICUREZZA, LINK ESTERNI, CHIUSURA CON MODIFICHE --- */
import { BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import { SCHEMA, HOST } from './protocollo.js';

const TITOLO = 'Modellatore MBSE';

function interno(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === `${SCHEMA}:` && u.host === HOST;
    } catch {
        return false;
    }
}

function esterno(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

// Pagina vuota delle finestre staccate (spec 0023): la principale ci sposta dentro i pannelli
const URL_STACCATA = `${SCHEMA}://${HOST}/popout.html`;

const SICUREZZA = { contextIsolation: true, nodeIntegration: false, sandbox: true } as const;

// Link esterni nel browser di sistema, navigazione solo dentro app://
function proteggiNavigazione(contenuti: Electron.WebContents, permetti: (url: string) => boolean): void {
    contenuti.setWindowOpenHandler(({ url }) => {
        if (permetti(url)) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    title: TITOLO, autoHideMenuBar: true, minWidth: 320, minHeight: 240,
                    webPreferences: { ...SICUREZZA }
                }
            };
        }
        if (esterno(url)) void shell.openExternal(url);
        return { action: 'deny' };
    });
    contenuti.on('will-navigate', (e, url) => {
        if (interno(url)) return;
        e.preventDefault();
        if (esterno(url)) void shell.openExternal(url);
    });
}

export function creaFinestraPrincipale(cartellaOut: string, sviluppo: boolean): BrowserWindow {
    const finestra = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: TITOLO,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(cartellaOut, 'preload', 'index.cjs'),
            ...SICUREZZA
        }
    });
    finestra.removeMenu();
    finestra.once('ready-to-show', () => finestra.show());

    // Il titolo resta quello del programma anche se la pagina cambia il suo <title>
    finestra.on('page-title-updated', (e) => e.preventDefault());

    const contenuti = finestra.webContents;

    // Link verso l'esterno: nel browser di sistema; l'unica finestra del programma che si apre è quella staccata
    proteggiNavigazione(contenuti, (url) => url === URL_STACCATA);
    const staccate = new Set<BrowserWindow>();
    contenuti.on('did-create-window', (staccata) => {
        staccate.add(staccata);
        staccata.removeMenu();
        staccata.on('page-title-updated', (e) => e.preventDefault());
        staccata.on('closed', () => staccate.delete(staccata));
        // Dentro una finestra staccata non si apre altro
        proteggiNavigazione(staccata.webContents, () => false);
    });
    // Le finestre staccate si chiudono con la principale (spec 0023, AC-4)
    finestra.on('closed', () => staccate.forEach((f) => { if (!f.isDestroyed()) f.close(); }));

    // In Electron un beforeunload che blocca chiude in silenzio niente: si chiede come farebbe il browser
    contenuti.on('will-prevent-unload', (e) => {
        const scelta = dialog.showMessageBoxSync(finestra, {
            type: 'warning',
            title: TITOLO,
            message: 'Ci sono modifiche non ancora salvate su disco.',
            detail: 'Se chiudi adesso potresti perdere le ultime modifiche.',
            buttons: ['Chiudi comunque', 'Annulla'],
            defaultId: 1,
            cancelId: 1,
            noLink: true
        });
        // preventDefault qui ignora il beforeunload e lascia chiudere
        if (scelta === 0) e.preventDefault();
    });

    // F12 apre gli strumenti per sviluppatori solo in `npm run dev`
    if (sviluppo) {
        contenuti.on('before-input-event', (_e, input) => {
            if (input.type === 'keyDown' && input.key === 'F12') contenuti.toggleDevTools();
        });
    }

    return finestra;
}
