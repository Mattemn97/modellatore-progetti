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
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    finestra.removeMenu();
    finestra.once('ready-to-show', () => finestra.show());

    // Il titolo resta quello del programma anche se la pagina cambia il suo <title>
    finestra.on('page-title-updated', (e) => e.preventDefault());

    const contenuti = finestra.webContents;

    // Link verso l'esterno: nel browser di sistema, mai in una finestra del programma
    contenuti.setWindowOpenHandler(({ url }) => {
        if (esterno(url)) void shell.openExternal(url);
        return { action: 'deny' };
    });
    contenuti.on('will-navigate', (e, url) => {
        if (interno(url)) return;
        e.preventDefault();
        if (esterno(url)) void shell.openExternal(url);
    });

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
