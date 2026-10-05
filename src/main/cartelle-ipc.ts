/* --- CANALI DELLE CARTELLE: STATO, SCELTA, APPLICA, APRI (pagina di benvenuto e finestra Impostazioni, spec 0019) --- */
import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { CANALI } from './canali.js';
import { daPreparare, preparaCartelle, problemaCartelle, statoCartelle, type Cartelle } from './configurazione.js';
import { analizza, ErroreImport, esegui } from './import-v1.js';
import { HOST, SCHEMA } from './protocollo.js';

export interface StatoCartelleApp {
    // Cartelle in uso (pronte) oppure null
    cartelle: Cartelle | null;
    // Cosa proporre nella pagina di benvenuto
    proposta: Cartelle;
    // Perché le cartelle non sono pronte (cartella sparita, non scrivibile...)
    motivo: string | null;
    // settings.json della cartella di lavoro
    settings: string | null;
}

export type EsitoApplica =
    | { esito: 'ok' }
    | { esito: 'da-creare'; cartelle: string[] }
    | { esito: 'errore'; messaggio: string };

export interface GestoreCartelle {
    stato(): StatoCartelleApp;
    // Salva la configurazione e rimette in piedi le API sulle cartelle nuove
    usa(cartelle: Cartelle): void;
    // Rimette in piedi le API sulle stesse cartelle e ricarica la pagina (dopo un import)
    ricarica(): void;
    impostazioniPredefinite: string;
}

// Solo le pagine del programma possono usare questi canali
function daPaginaInterna(evento: IpcMainInvokeEvent): boolean {
    return (evento.senderFrame?.url ?? '').startsWith(`${SCHEMA}://${HOST}/`);
}

function testo(valore: unknown): string | null {
    return typeof valore === 'string' && valore.trim() ? valore.trim() : null;
}

export function installaCanaliCartelle(gestore: GestoreCartelle): void {
    ipcMain.handle(CANALI.cartelleStato, (evento) => {
        if (!daPaginaInterna(evento)) return null;
        return gestore.stato();
    });

    ipcMain.handle(CANALI.cartelleScegli, async (evento, titolo: unknown, iniziale: unknown) => {
        if (!daPaginaInterna(evento)) return null;
        const finestra = BrowserWindow.fromWebContents(evento.sender);
        const opzioni: Electron.OpenDialogOptions = {
            title: testo(titolo) ?? 'Scegli una cartella',
            properties: ['openDirectory', 'createDirectory', 'promptToCreate']
        };
        const partenza = testo(iniziale);
        if (partenza) opzioni.defaultPath = partenza;
        const esito = finestra ? await dialog.showOpenDialog(finestra, opzioni) : await dialog.showOpenDialog(opzioni);
        return esito.canceled ? null : esito.filePaths[0] ?? null;
    });

    ipcMain.handle(CANALI.cartelleApplica, (evento, richiesta: unknown, crea: unknown): EsitoApplica => {
        if (!daPaginaInterna(evento)) return { esito: 'errore', messaggio: 'Richiesta non ammessa.' };
        const r = (richiesta ?? {}) as Record<string, unknown>;
        const lavoro = testo(r.lavoro);
        if (!lavoro) return { esito: 'errore', messaggio: 'Scegli la cartella di lavoro.' };
        const cartelle: Cartelle = { lavoro, librerie: testo(r.librerie) ?? path.join(lavoro, 'shared') };
        const problema = problemaCartelle(cartelle);
        if (problema) return { esito: 'errore', messaggio: problema };
        const mancanti = daPreparare(cartelle);
        if (mancanti.length > 0 && crea !== true) return { esito: 'da-creare', cartelle: mancanti };
        try {
            preparaCartelle(cartelle, gestore.impostazioniPredefinite);
        } catch (e) {
            const messaggio = e instanceof Error ? e.message : String(e);
            return { esito: 'errore', messaggio: `Impossibile preparare le cartelle: ${messaggio}` };
        }
        const stato = statoCartelle(cartelle);
        if (!stato.pronte) return { esito: 'errore', messaggio: stato.motivo };
        try {
            gestore.usa(cartelle);
        } catch (e) {
            const messaggio = e instanceof Error ? e.message : String(e);
            return { esito: 'errore', messaggio: `Impossibile usare le cartelle: ${messaggio}` };
        }
        return { esito: 'ok' };
    });

    // Import dalla 1.x (voce 22): prima l'anteprima, poi la copia con la scelta sui file diversi
    const analisiDi = (cartellaV1: unknown) => {
        const cartelle = gestore.stato().cartelle;
        if (!cartelle) throw new ErroreImport('Scegli prima la cartella di lavoro.');
        const sorgente = testo(cartellaV1);
        if (!sorgente) throw new ErroreImport('Scegli la cartella della vecchia installazione.');
        return analizza(sorgente, cartelle);
    };
    const messaggioDi = (e: unknown) => (e instanceof Error ? e.message : String(e));

    ipcMain.handle(CANALI.importaV1Analizza, (evento, cartellaV1: unknown) => {
        if (!daPaginaInterna(evento)) return { errore: 'Richiesta non ammessa.' };
        try {
            const a = analisiDi(cartellaV1);
            return { nuovi: a.nuovi.length, uguali: a.uguali.length, diversi: a.diversi.map((f) => f.relativo) };
        } catch (e) {
            return { errore: messaggioDi(e) };
        }
    });

    ipcMain.handle(CANALI.importaV1Esegui, (evento, cartellaV1: unknown, sovrascrivi: unknown) => {
        if (!daPaginaInterna(evento)) return { errore: 'Richiesta non ammessa.' };
        try {
            const esito = esegui(analisiDi(cartellaV1), sovrascrivi === true);
            gestore.ricarica();
            return esito;
        } catch (e) {
            return { errore: `Import non completato: ${messaggioDi(e)}` };
        }
    });

    ipcMain.handle(CANALI.apriPercorso, async (evento, percorso: unknown) => {
        if (!daPaginaInterna(evento)) return 'Richiesta non ammessa.';
        const p = testo(percorso);
        if (!p) return 'Percorso mancante.';
        // '' se aperto, altrimenti il messaggio di Windows
        return shell.openPath(p);
    });
}
