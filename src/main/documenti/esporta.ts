/* --- CANALE DI EXPORT WORD E PDF: DALLA PAGINA AI BYTE DEL FILE (spec 0028) --- */
// La pagina manda Markdown, modello e diagrammi; qui si legge il logo, si scrive il .docx o si stampa il PDF
// in una finestra nascosta senza JavaScript, e si restituiscono i byte (la pagina li scarica come il Markdown).
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { CANALI } from '../canali.js';
import { HOST, SCHEMA, registraPaginaStampa } from '../protocollo.js';
import { scriviDocx } from './docx.js';
import { htmlDocumento, intestazionePdf, piePaginaPdf } from './html.js';
import { controllaRichiesta, leggiLogo, testoIntestazione, type Logo, type RichiestaExport } from './modello.js';

export type EsitoExport = { ok: true; dati: Uint8Array; avviso: string | null } | { ok: false; messaggio: string };

function daPaginaInterna(evento: IpcMainInvokeEvent): boolean {
    return (evento.senderFrame?.url ?? '').startsWith(`${SCHEMA}://${HOST}/`);
}

async function stampaPdf(richiesta: RichiestaExport, logo: Logo | null): Promise<Buffer> {
    const pagina = registraPaginaStampa(htmlDocumento(richiesta, logo));
    const finestra = new BrowserWindow({
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: false }
    });
    const contenuti = finestra.webContents;
    contenuti.setWindowOpenHandler(() => ({ action: 'deny' }));
    contenuti.on('will-navigate', (e) => e.preventDefault());
    try {
        await finestra.loadURL(pagina.url);
        return await contenuti.printToPDF({
            pageSize: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: intestazionePdf(testoIntestazione(richiesta)),
            footerTemplate: piePaginaPdf(richiesta.modello.piePagina),
            margins: { top: 0.9, bottom: 0.8, left: 0.79, right: 0.79 }
        });
    } finally {
        pagina.togli();
        if (!finestra.isDestroyed()) finestra.destroy();
    }
}

export function installaCanaleExport(cartellaLavoro: () => string | null): void {
    ipcMain.handle(CANALI.esportaDocumento, async (evento, grezza: unknown): Promise<EsitoExport> => {
        if (!daPaginaInterna(evento)) return { ok: false, messaggio: 'richiesta non ammessa' };
        const richiesta = controllaRichiesta(grezza);
        if (!richiesta) return { ok: false, messaggio: 'richiesta di export non valida' };
        const { logo, motivo } = leggiLogo(cartellaLavoro(), richiesta.modello.logo);
        try {
            const dati = richiesta.formato === 'docx' ? scriviDocx(richiesta, logo) : await stampaPdf(richiesta, logo);
            return { ok: true, dati: new Uint8Array(dati), avviso: motivo ? `Logo non usato: ${motivo}` : null };
        } catch (e) {
            return { ok: false, messaggio: e instanceof Error ? e.message : String(e) };
        }
    });
}
