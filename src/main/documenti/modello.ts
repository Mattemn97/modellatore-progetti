/* --- RICHIESTA DI EXPORT WORD E PDF: TIPI, CONTROLLO E LOGO DEL MODELLO AZIENDALE (spec 0028) --- */
import fs from 'node:fs';
import path from 'node:path';

export type FormatoExport = 'docx' | 'pdf';

export interface IntestazioneExport {
    documento: string;
    // Titolo del DID, es. "Specifica del sistema/sottosistema"
    titolo: string;
    progetto: string;
    data: string;
    // Nome del file della libreria con la versione
    libreria: string;
}

export interface ModelloAziendale {
    azienda: string;
    logo: string;
    classificazione: string;
    piePagina: string;
    autore: string;
}

export interface Revisione {
    revisione: string;
    data: string;
    descrizione: string;
    autore: string;
}

// Un diagramma (spec 0029): SVG per il PDF, PNG per il Word, dimensioni in pixel CSS
export interface ImmagineDiagramma {
    svg: string;
    png: Uint8Array;
    larghezza: number;
    altezza: number;
}

export interface RichiestaExport {
    formato: FormatoExport;
    markdown: string;
    intestazione: IntestazioneExport;
    modello: ModelloAziendale;
    revisioni: Revisione[];
    immagini: Record<string, ImmagineDiagramma>;
}

export interface Logo {
    dati: Buffer;
    tipo: 'png' | 'jpeg';
    larghezza: number;
    altezza: number;
}

const MAX_LOGO = 2 * 1024 * 1024;

const testo = (v: unknown): string => (typeof v === 'string' ? v : '');
const oggetto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

// Ripulisce quello che arriva dalla pagina: solo testi, numeri e byte attesi; null se la forma non va
export function controllaRichiesta(grezza: unknown): RichiestaExport | null {
    const r = oggetto(grezza);
    if (r.formato !== 'docx' && r.formato !== 'pdf') return null;
    if (typeof r.markdown !== 'string') return null;
    const i = oggetto(r.intestazione);
    const m = oggetto(r.modello);
    const revisioni = (Array.isArray(r.revisioni) ? r.revisioni : []).map((v) => {
        const o = oggetto(v);
        return { revisione: testo(o.revisione), data: testo(o.data), descrizione: testo(o.descrizione), autore: testo(o.autore) };
    });
    const immagini: Record<string, ImmagineDiagramma> = {};
    for (const [chiave, v] of Object.entries(oggetto(r.immagini))) {
        const o = oggetto(v);
        const larghezza = Number(o.larghezza);
        const altezza = Number(o.altezza);
        if (typeof o.svg !== 'string' || !(o.png instanceof Uint8Array) || !(larghezza > 0) || !(altezza > 0)) continue;
        immagini[chiave] = { svg: o.svg, png: o.png, larghezza, altezza };
    }
    return {
        formato: r.formato,
        markdown: r.markdown,
        intestazione: { documento: testo(i.documento), titolo: testo(i.titolo), progetto: testo(i.progetto), data: testo(i.data), libreria: testo(i.libreria) },
        modello: { azienda: testo(m.azienda), logo: testo(m.logo), classificazione: testo(m.classificazione), piePagina: testo(m.piePagina), autore: testo(m.autore) },
        revisioni,
        immagini
    };
}

// Larghezza e altezza in pixel di un PNG (IHDR) o di un JPEG (primo SOFn); null se non si riconosce
export function dimensioniImmagine(dati: Buffer): { tipo: 'png' | 'jpeg'; larghezza: number; altezza: number } | null {
    if (dati.length > 24 && dati.readUInt32BE(0) === 0x89504e47 && dati.toString('latin1', 12, 16) === 'IHDR') {
        return { tipo: 'png', larghezza: dati.readUInt32BE(16), altezza: dati.readUInt32BE(20) };
    }
    if (dati.length > 4 && dati[0] === 0xff && dati[1] === 0xd8) {
        let p = 2;
        while (p + 9 < dati.length) {
            if (dati[p] !== 0xff) return null;
            const marcatore = dati[p + 1]!;
            const lunghezza = dati.readUInt16BE(p + 2);
            const sof = marcatore >= 0xc0 && marcatore <= 0xcf && marcatore !== 0xc4 && marcatore !== 0xc8 && marcatore !== 0xcc;
            if (sof) return { tipo: 'jpeg', altezza: dati.readUInt16BE(p + 5), larghezza: dati.readUInt16BE(p + 7) };
            p += 2 + lunghezza;
        }
    }
    return null;
}

// Logo del modello, letto solo dentro la cartella di lavoro (AC-5): { logo } oppure { motivo } per l'avviso
export function leggiLogo(cartellaLavoro: string | null, percorso: string): { logo: Logo | null; motivo: string | null } {
    const relativo = percorso.trim();
    if (!relativo) return { logo: null, motivo: null };
    if (!cartellaLavoro) return { logo: null, motivo: 'cartella di lavoro non configurata' };
    const assoluto = path.resolve(cartellaLavoro, relativo);
    const dentro = path.relative(cartellaLavoro, assoluto);
    if (!dentro || dentro.startsWith('..') || path.isAbsolute(dentro)) return { logo: null, motivo: `${relativo} è fuori dalla cartella di lavoro` };
    let dati: Buffer;
    try {
        if (fs.statSync(assoluto).size > MAX_LOGO) return { logo: null, motivo: `${relativo} supera 2 MB` };
        dati = fs.readFileSync(assoluto);
    } catch {
        return { logo: null, motivo: `${relativo} non si trova` };
    }
    const dimensioni = dimensioniImmagine(dati);
    if (!dimensioni || !dimensioni.larghezza || !dimensioni.altezza) return { logo: null, motivo: `${relativo} non è un PNG o un JPEG` };
    return { logo: { dati, ...dimensioni }, motivo: null };
}

// Revisione corrente: l'ultima della tabella con un valore
export function revisioneCorrente(revisioni: Revisione[]): string {
    for (let i = revisioni.length - 1; i >= 0; i--) {
        const r = revisioni[i]!.revisione.trim();
        if (r) return r;
    }
    return '—';
}

export function testoIntestazione(r: RichiestaExport): string {
    return [r.modello.azienda.trim(), r.intestazione.documento, `Rev. ${revisioneCorrente(r.revisioni)}`].filter(Boolean).join(' · ');
}
