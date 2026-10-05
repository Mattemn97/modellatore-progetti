/* --- AGGIORNAMENTO AUTOMATICO DELLA VERSIONE DESKTOP: CONTROLLO, DOWNLOAD VERIFICATO E RIAVVIO (spec 0025) --- */
// Stesso contratto di /api/aggiornamento della 1.x (spec 0015), così il banner della pagina non cambia.
// Il lavoro vero lo fa electron-updater: legge latest.yml della Release, scarica il setup, ne controlla lo SHA512
// e lo installa in silenzio al riavvio. Qui c'è solo la macchina a stati, con l'aggiornatore iniettato (test).
import { ErroreApi } from './api/errori.js';

export type StatoAggiornamento =
    'disattivato' | 'controllo' | 'nessuno' | 'disponibile' | 'download' | 'installazione' | 'riavvio' | 'errore';

interface InfoVersione {
    version: string;
    releaseNotes?: string | Array<{ note: string | null }> | null;
}

// Il sottoinsieme di electron-updater che usiamo
export interface Aggiornatore {
    checkForUpdates(): Promise<unknown>;
    downloadUpdate(): Promise<unknown>;
    quitAndInstall(silenzioso: boolean, riapri: boolean): void;
    on(evento: 'update-available', ascoltatore: (info: InfoVersione) => void): unknown;
    on(evento: 'update-not-available', ascoltatore: () => void): unknown;
    on(evento: 'update-downloaded', ascoltatore: () => void): unknown;
    on(evento: 'error', ascoltatore: (errore: Error) => void): unknown;
}

export interface OpzioniAggiornamento {
    versione: string;
    // null: niente controllo, con il motivo
    aggiornatore: Aggiornatore | null;
    motivoSpento?: string;
    // Pagina della Release, per le note e quando l'installazione non è possibile
    paginaRelease?: (versione: string) => string;
}

function testoNote(note: InfoVersione['releaseNotes']): string {
    if (!note) return '';
    if (typeof note === 'string') return note.replace(/<[^>]*>/g, '').trim();
    return note.map((n) => n.note ?? '').join('\n\n').replace(/<[^>]*>/g, '').trim();
}

function motivoErrore(errore: Error, attuale: string): string {
    const messaggio = errore.message || String(errore);
    if (/sha512|checksum/i.test(messaggio)) {
        return `Il file scaricato non corrisponde all'impronta della Release: non è stato installato niente. Resti sulla versione ${attuale}.`;
    }
    return `Download non riuscito (${messaggio.split('\n')[0]}). Resti sulla versione ${attuale}.`;
}

export class ServizioAggiornamento {
    private stato: StatoAggiornamento;
    private nuova: string | null = null;
    private note = '';
    private motivo: string | null;
    private inDownload = false;

    constructor(private readonly opzioni: OpzioniAggiornamento) {
        this.stato = opzioni.aggiornatore ? 'nessuno' : 'disattivato';
        this.motivo = opzioni.aggiornatore ? null : (opzioni.motivoSpento ?? null);
        const a = opzioni.aggiornatore;
        if (!a) return;
        a.on('update-available', (info) => {
            this.nuova = info.version;
            this.note = testoNote(info.releaseNotes);
            this.stato = 'disponibile';
        });
        a.on('update-not-available', () => { this.stato = 'nessuno'; });
        a.on('update-downloaded', () => {
            this.inDownload = false;
            this.stato = 'installazione';
            // Un attimo perché la pagina veda lo stato, poi setup silenzioso e riavvio sulla versione nuova
            setTimeout(() => {
                this.stato = 'riavvio';
                a.quitAndInstall(true, true);
            }, 500);
        });
        a.on('error', (errore) => this.fallito(errore));
    }

    // Senza rete al controllo l'app parte come sempre, senza avvisi; un download fallito invece si dice
    private fallito(errore: unknown): void {
        if (!this.inDownload) {
            if (this.stato === 'controllo') this.stato = 'nessuno';
            console.warn('Controllo degli aggiornamenti non riuscito:', errore instanceof Error ? errore.message : errore);
            return;
        }
        this.inDownload = false;
        this.stato = 'errore';
        this.motivo = motivoErrore(errore instanceof Error ? errore : new Error(String(errore)), this.opzioni.versione);
    }

    // All'avvio, una volta sola
    controlla(): void {
        const a = this.opzioni.aggiornatore;
        if (!a) return;
        this.stato = 'controllo';
        a.checkForUpdates().catch(() => {
            if (this.stato === 'controllo') this.stato = 'nessuno';
        });
    }

    leggi(): Record<string, unknown> {
        const installabile = !!this.opzioni.aggiornatore && !!this.nuova;
        return {
            stato: this.stato,
            attuale: this.opzioni.versione,
            nuova: this.nuova,
            note: this.note,
            installabile,
            pagina: this.nuova && this.opzioni.paginaRelease ? this.opzioni.paginaRelease(this.nuova) : null,
            motivo: this.motivo
        };
    }

    // POST /api/aggiornamento/installa: la pagina ha già salvato il progetto
    installa(versione: unknown): void {
        const a = this.opzioni.aggiornatore;
        const pronto = this.stato === 'disponibile' || this.stato === 'errore';
        if (!a || !this.nuova || !pronto) throw new ErroreApi(409, 'non_disponibile', 'Nessun aggiornamento da installare.');
        if (versione !== this.nuova) throw new ErroreApi(409, 'versione_cambiata', `La versione disponibile ora è la ${this.nuova}.`);
        this.inDownload = true;
        this.stato = 'download';
        this.motivo = null;
        a.downloadUpdate().catch((e: unknown) => this.fallito(e));
    }
}
