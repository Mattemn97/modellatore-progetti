/* --- PROGETTI SU DISCO: ELENCO, LETTURA, SCRITTURA CON VERSIONI, ANNULLA, RINOMINA, CESTINO (spec 0001, 0018) --- */
import fs from 'node:fs';
import path from 'node:path';
import { ErroreApi } from './errori.js';
import {
    conRitentativi, decodificaUtf8, eFile, eOggetto, esiste, improntaDi, interpretaJson, leggiBytes, numeriCopie, percorsoCopia,
    pulisciTemporanei, rimuoviSeEsiste, ruotaCopie, scriviAtomico, serializza, sposta
} from './file.js';

// Formato del file progetto: si scrive sempre 2 (con la chiave facoltativa cliente), si leggono 1 e 2
export const FORMATO_PROGETTO = 2;
const FORMATI_PROGETTO_LETTI = [1, 2];
const LUNGHEZZA_MAX_SLUG = 80;
const FORMATO_SLUG = /^[a-z0-9]+(_[a-z0-9]+)*$/;
const NOMI_RISERVATI = new Set(['con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`)]);
export const MSG_SLUG_NON_VALIDO = 'Il nome deve contenere almeno una lettera o cifra e non può essere un nome riservato di Windows';

type Oggetto = Record<string, unknown>;

export function slugValido(slug: unknown): slug is string {
    return typeof slug === 'string' && slug.length <= LUNGHEZZA_MAX_SLUG && FORMATO_SLUG.test(slug) && !NOMI_RISERVATI.has(slug);
}

export function controllaSlug(slug: unknown): asserts slug is string {
    if (!slugValido(slug)) throw new ErroreApi(400, 'slug_non_valido', MSG_SLUG_NON_VALIDO);
}

export function controllaProgetto(progetto: unknown): asserts progetto is Oggetto {
    const p = eOggetto(progetto) ? progetto : null;
    const workspace = p && eOggetto(p.workspace) ? p.workspace : null;
    const valido = p !== null
        && typeof p.nome === 'string' && p.nome.trim() !== ''
        && typeof p.libraryPath === 'string'
        && workspace !== null
        && Array.isArray(workspace.nodes) && Array.isArray(workspace.edges)
        && typeof p.formatVersion === 'number' && Number.isInteger(p.formatVersion) && FORMATI_PROGETTO_LETTI.includes(p.formatVersion)
        && (p.cliente === undefined || p.cliente === null || eOggetto(p.cliente));
    if (!valido) {
        throw new ErroreApi(400, 'progetto_non_valido',
            'Il progetto non ha la forma attesa: formatVersion 1 o 2, nome, libraryPath, workspace con nodes ed edges e cliente facoltativo.');
    }
}

// Copia in progetto la chiave cliente di origine, se c'è: requisiti cliente e workspace viaggiano insieme
function conCliente(progetto: Oggetto, origine: unknown): Oggetto {
    if (eOggetto(origine) && eOggetto(origine.cliente)) progetto.cliente = origine.cliente;
    return progetto;
}

// Python: str(datetime.now().strftime('%Y%m%d_%H%M%S'))
function dataOraCompatta(d = new Date()): string {
    const due = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${due(d.getMonth() + 1)}${due(d.getDate())}_${due(d.getHours())}${due(d.getMinutes())}${due(d.getSeconds())}`;
}

export class ArchivioProgetti {
    readonly cartella: string;
    private readonly cartellaVersioni: string;
    private readonly cartellaCestino: string;
    private readonly fileUltimo: string;

    constructor(cartellaDati: string, private readonly maxVersioni: number) {
        this.cartella = path.join(cartellaDati, 'progetti');
        this.cartellaVersioni = path.join(this.cartella, '_versioni');
        this.cartellaCestino = path.join(this.cartella, '_cestino');
        this.fileUltimo = path.join(this.cartella, '_ultimo.json');
    }

    prepara(): void {
        for (const c of [this.cartella, this.cartellaVersioni, this.cartellaCestino]) fs.mkdirSync(c, { recursive: true });
        // Scritture interrotte da un arresto precedente
        pulisciTemporanei(this.cartella);
        pulisciTemporanei(this.cartellaVersioni);
    }

    private principale(slug: string): string {
        return path.join(this.cartella, `${slug}.json`);
    }

    private versione(slug: string, n: number): string {
        return percorsoCopia(this.cartellaVersioni, slug, n);
    }

    private contaVersioni(slug: string): number {
        let n = 0;
        while (n < this.maxVersioni && esiste(this.versione(slug, n + 1))) n++;
        return n;
    }

    private rimuoviVersioni(slug: string): void {
        for (const n of numeriCopie(this.cartellaVersioni, slug)) conRitentativi(() => rimuoviSeEsiste(this.versione(slug, n)));
    }

    private leggiEsistente(slug: string): Buffer {
        const percorso = this.principale(slug);
        if (!eFile(percorso)) throw new ErroreApi(404, 'non_trovato', `Il progetto "${slug}" non esiste.`);
        return leggiBytes(percorso);
    }

    private controllaImpronta(attuali: Buffer, attesa: unknown): void {
        const impronta = improntaDi(attuali);
        if (attesa !== impronta) {
            throw new ErroreApi(409, 'conflitto', "Il file del progetto è cambiato sul disco dopo che l'app l'ha letto.", { impronta });
        }
    }

    /* --- Elenco, lettura e creazione --- */

    elenco(): { progetti: Array<{ slug: string; nome: string; modificato: number; danneggiato: boolean }> } {
        const progetti: Array<{ slug: string; nome: string; modificato: number; danneggiato: boolean }> = [];
        for (const voce of fs.readdirSync(this.cartella, { withFileTypes: true })) {
            if (!voce.isFile() || !voce.name.endsWith('.json')) continue;
            const slug = voce.name.slice(0, -5);
            if (!slugValido(slug)) continue;
            const completo = path.join(this.cartella, voce.name);
            let nome = slug;
            let danneggiato = false;
            try {
                const dati: unknown = JSON.parse(decodificaUtf8(leggiBytes(completo)));
                if (!eOggetto(dati)) danneggiato = true;
                else if (typeof dati.nome === 'string' && dati.nome.trim()) nome = dati.nome;
            } catch (e) {
                // JSON o UTF-8 non validi: danneggiato; file bloccato o sparito: si mostra con lo slug
                if (!(e instanceof ErroreApi) && !(e as NodeJS.ErrnoException).code) danneggiato = true;
            }
            let modificato = 0;
            try { modificato = Math.floor(fs.statSync(completo).mtimeMs); } catch { /* sparito nel frattempo */ }
            progetti.push({ slug, nome, modificato, danneggiato });
        }
        progetti.sort((a, b) => b.modificato - a.modificato);
        return { progetti };
    }

    leggi(slug: string): { progetto: Oggetto; impronta: string; versioni: number } {
        const dati = this.leggiEsistente(slug);
        const progetto = interpretaJson(dati, `Il file del progetto "${slug}" non è JSON valido.`);
        return { progetto, impronta: improntaDi(dati), versioni: this.contaVersioni(slug) };
    }

    crea(slug: unknown, progetto: unknown): { slug: string; impronta: string; versioni: number } {
        controllaSlug(slug);
        controllaProgetto(progetto);
        if (esiste(this.principale(slug))) throw new ErroreApi(409, 'esiste', `Esiste già un progetto con il nome "${slug}".`);
        // Versioni rimaste da un file tolto a mano: il nuovo progetto parte senza
        this.rimuoviVersioni(slug);
        const dati = serializza(progetto);
        scriviAtomico(this.principale(slug), dati);
        return { slug, impronta: improntaDi(dati), versioni: 0 };
    }

    /* --- Scrittura con versioni --- */

    scrivi(slug: string, progetto: unknown, attesa: unknown, forza: boolean): { impronta: string; versioni: number } {
        controllaProgetto(progetto);
        const attuali = this.leggiEsistente(slug);
        if (!forza) this.controllaImpronta(attuali, attesa);
        const nuovi = serializza(progetto);
        if (!nuovi.equals(attuali)) {
            // Il file principale si scrive per ultimo: un'interruzione tocca solo le versioni
            ruotaCopie(this.cartellaVersioni, slug, attuali, this.maxVersioni);
            scriviAtomico(this.principale(slug), nuovi);
        }
        return { impronta: improntaDi(nuovi), versioni: this.contaVersioni(slug) };
    }

    annulla(slug: string, attesa: unknown): { progetto: Oggetto; impronta: string; versioni: number } {
        const attuali = this.leggiEsistente(slug);
        this.controllaImpronta(attuali, attesa);
        if (!esiste(this.versione(slug, 1))) throw new ErroreApi(409, 'nessuna_versione', 'Non ci sono versioni precedenti da ripristinare.');
        const precedente = interpretaJson(leggiBytes(this.versione(slug, 1)), 'La versione precedente non è JSON valido.');
        const attuale = interpretaJson(attuali, `Il file del progetto "${slug}" non è JSON valido.`);
        if (!eOggetto(precedente.workspace)) throw new ErroreApi(422, 'json_non_valido', 'La versione precedente non contiene un workspace.');
        // Si ripristina solo il modello (workspace e requisiti cliente): nome e percorso della libreria restano quelli attuali
        const progetto = conCliente({
            formatVersion: FORMATO_PROGETTO,
            nome: typeof attuale.nome === 'string' ? attuale.nome : slug,
            libraryPath: typeof attuale.libraryPath === 'string' ? attuale.libraryPath : '',
            workspace: precedente.workspace
        }, precedente);
        const nuovi = serializza(progetto);
        scriviAtomico(this.principale(slug), nuovi);
        // .2→.1, .3→.2: la versione usata sparisce, non se ne crea una nuova
        for (let n = 1; n <= this.maxVersioni; n++) {
            const successiva = this.versione(slug, n + 1);
            if (n + 1 <= this.maxVersioni && esiste(successiva)) sposta(successiva, this.versione(slug, n));
            else conRitentativi(() => rimuoviSeEsiste(this.versione(slug, n)));
        }
        for (const n of numeriCopie(this.cartellaVersioni, slug)) {
            if (n > this.maxVersioni) conRitentativi(() => rimuoviSeEsiste(this.versione(slug, n)));
        }
        return { progetto, impronta: improntaDi(nuovi), versioni: this.contaVersioni(slug) };
    }

    /* --- Rinomina ed eliminazione --- */

    rinomina(slug: string, nuovoSlug: unknown, nome: unknown, attesa: unknown): { slug: string; impronta: string; versioni: number } {
        controllaSlug(nuovoSlug);
        if (typeof nome !== 'string' || !nome.trim()) throw new ErroreApi(400, 'progetto_non_valido', 'Il nome del progetto non può essere vuoto.');
        const attuali = this.leggiEsistente(slug);
        this.controllaImpronta(attuali, attesa);
        if (nuovoSlug !== slug && esiste(this.principale(nuovoSlug))) {
            throw new ErroreApi(409, 'esiste', `Esiste già un progetto con il nome "${nuovoSlug}".`);
        }
        const attuale = interpretaJson(attuali, `Il file del progetto "${slug}" non è JSON valido.`);
        const progetto = conCliente({
            formatVersion: FORMATO_PROGETTO,
            nome,
            libraryPath: typeof attuale.libraryPath === 'string' ? attuale.libraryPath : '',
            workspace: attuale.workspace ?? null
        }, attuale);
        const nuovi = serializza(progetto);
        // Il nome non fa parte delle versioni: la rinomina non ne crea una nuova
        scriviAtomico(this.principale(nuovoSlug), nuovi);
        if (nuovoSlug !== slug) {
            this.rimuoviVersioni(nuovoSlug);
            for (const n of numeriCopie(this.cartellaVersioni, slug)) sposta(this.versione(slug, n), this.versione(nuovoSlug, n));
            conRitentativi(() => fs.unlinkSync(this.principale(slug)));
            if (this.leggiUltimo() === slug) this.scriviUltimo(nuovoSlug);
        }
        return { slug: nuovoSlug, impronta: improntaDi(nuovi), versioni: this.contaVersioni(nuovoSlug) };
    }

    elimina(slug: string): void {
        const percorso = this.principale(slug);
        if (!eFile(percorso)) throw new ErroreApi(404, 'non_trovato', `Il progetto "${slug}" non esiste.`);
        const base = `${slug}_${dataOraCompatta()}`;
        let destinazione = path.join(this.cartellaCestino, `${base}.json`);
        for (let contatore = 2; esiste(destinazione); contatore++) destinazione = path.join(this.cartellaCestino, `${base}_${contatore}.json`);
        sposta(percorso, destinazione);
        this.rimuoviVersioni(slug);
        if (this.leggiUltimo() === slug) this.scriviUltimo(null);
    }

    /* --- Ultimo progetto aperto --- */

    leggiUltimo(): string | null {
        try {
            const dati: unknown = JSON.parse(leggiBytes(this.fileUltimo).toString('utf-8'));
            const slug = eOggetto(dati) ? dati.progetto : null;
            return slugValido(slug) ? slug : null;
        } catch {
            return null;
        }
    }

    scriviUltimo(slug: string | null): void {
        // Python: json.dumps({'progetto': slug}) con gli spazi dopo i due punti
        scriviAtomico(this.fileUltimo, Buffer.from(`{"progetto": ${JSON.stringify(slug)}}`, 'utf-8'));
    }
}
