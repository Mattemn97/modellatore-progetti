/* --- ROUTER DELLE API: DA Request A Response, STESSI CONTROLLI E CODICI DI start.py (spec 0018) --- */
import { leggiFileCliente } from './cliente.js';
import { ErroreApi, nonConsentito, nonTrovatoApi } from './errori.js';
import { decodificaUtf8, eOggetto } from './file.js';
import type { ArchivioLibrerie } from './librerie.js';
import { controllaSlug, type ArchivioProgetti } from './progetti.js';

const MAX_CORPO = 50 * 1024 * 1024;

type Oggetto = Record<string, unknown>;
type Esito = [number, unknown];

export interface ServiziApi {
    progetti: ArchivioProgetti;
    librerie: ArchivioLibrerie;
    versione: string;
    maxFileClienteMb: number;
    // Aggiornamento automatico della versione desktop (spec 0025)
    aggiornamento: { leggi(): Oggetto; installa(versione: unknown): void };
}

function rispostaJson(stato: number, dati: unknown): Response {
    if (stato === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(dati), {
        status: stato,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

function segmentiDi(url: URL): string[] {
    return url.pathname.split('/').slice(2).map((parte) => {
        try {
            return decodeURIComponent(parte);
        } catch {
            return parte;
        }
    });
}

function controllaContentType(richiesta: Request): void {
    const tipo = (richiesta.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase();
    if (tipo !== 'application/json') {
        throw new ErroreApi(415, 'tipo_non_supportato', 'Le scritture richiedono Content-Type: application/json.');
    }
}

function leggiCorpo(dati: ArrayBuffer | null, perCliente: boolean, maxFileClienteMb: number): Oggetto {
    const byte = dati ? Buffer.from(dati) : Buffer.alloc(0);
    if (byte.length > MAX_CORPO) {
        if (perCliente) throw new ErroreApi(413, 'troppo_grande', `Il file supera il limite di ${maxFileClienteMb} MB (cliente.maxFileMB in settings.json).`);
        throw new ErroreApi(413, 'troppo_grande', 'Il progetto supera il limite di 50 MB.');
    }
    let corpo: unknown;
    try {
        corpo = JSON.parse(decodificaUtf8(byte));
    } catch {
        throw new ErroreApi(400, 'json_non_valido', 'Il corpo della richiesta non è JSON valido.');
    }
    if (!eOggetto(corpo)) throw new ErroreApi(400, 'richiesta_non_valida', 'Il corpo della richiesta deve essere un oggetto JSON.');
    return corpo;
}

function instradaLibreria(librerie: ArchivioLibrerie, metodo: string, segmenti: string[], corpo: Oggetto, url: URL): Esito | null {
    if (segmenti[0] !== 'libreria' || segmenti.length !== 2) return null;
    const conPost = (azione: () => unknown): Esito => {
        if (metodo !== 'POST') throw nonConsentito();
        return [200, azione()];
    };
    switch (segmenti[1]) {
        case 'apri': return conPost(() => librerie.apri(corpo.percorso));
        case 'salva': return conPost(() => librerie.salva(corpo));
        case 'elimina': return conPost(() => librerie.elimina(corpo));
        case 'rinomina': return conPost(() => librerie.rinominaBlocco(corpo));
        case 'changelog':
            if (metodo !== 'GET') throw nonConsentito();
            // parse_qs di Python ignora i valori vuoti
            return [200, librerie.leggiVoci(url.searchParams.get('percorso') || null)];
        default: return null;
    }
}

function instradaProgetti(progetti: ArchivioProgetti, metodo: string, segmenti: string[], corpo: Oggetto): Esito | null {
    if (segmenti.length === 1 && segmenti[0] === 'progetti') {
        if (metodo === 'GET') return [200, progetti.elenco()];
        if (metodo === 'POST') return [201, progetti.crea(corpo.slug, corpo.progetto)];
        throw nonConsentito();
    }
    if (segmenti[0] === 'progetti' && (segmenti.length === 2 || segmenti.length === 3)) {
        const slug = segmenti[1];
        controllaSlug(slug);
        if (segmenti.length === 2) {
            if (metodo === 'GET') return [200, progetti.leggi(slug)];
            if (metodo === 'PUT') return [200, progetti.scrivi(slug, corpo.progetto, corpo.improntaAttesa, corpo.forza === true)];
            if (metodo === 'DELETE') {
                progetti.elimina(slug);
                return [204, null];
            }
            throw nonConsentito();
        }
        if (segmenti[2] === 'annulla') {
            if (metodo !== 'POST') throw nonConsentito();
            return [200, progetti.annulla(slug, corpo.improntaAttesa)];
        }
        if (segmenti[2] === 'rinomina') {
            if (metodo !== 'POST') throw nonConsentito();
            return [200, progetti.rinomina(slug, corpo.nuovoSlug, corpo.nome, corpo.improntaAttesa)];
        }
    }
    if (segmenti.length === 1 && segmenti[0] === 'ultimo') {
        if (metodo === 'GET') return [200, { progetto: progetti.leggiUltimo() }];
        if (metodo === 'PUT') {
            controllaSlug(corpo.progetto);
            progetti.scriviUltimo(corpo.progetto);
            return [204, null];
        }
        throw nonConsentito();
    }
    return null;
}

export function creaRouter(servizi: ServiziApi): (richiesta: Request, url: URL) => Promise<Response> {
    return async (richiesta, url) => {
        const metodo = richiesta.method.toUpperCase();
        try {
            const segmenti = segmentiDi(url);
            if (segmenti.length === 0 || segmenti.includes('')) throw nonTrovatoApi();
            const scrittura = metodo === 'POST' || metodo === 'PUT' || metodo === 'DELETE';
            if (scrittura) controllaContentType(richiesta);

            // Il corpo si legge prima: da qui in poi il lavoro sui file è sincrono, una richiesta alla volta
            const dati = metodo === 'POST' || metodo === 'PUT' ? await richiesta.arrayBuffer() : null;

            if (segmenti[0] === 'aggiornamento') {
                if (segmenti.length === 1) {
                    if (metodo !== 'GET') throw nonConsentito();
                    return rispostaJson(200, servizi.aggiornamento.leggi());
                }
                if (segmenti.length === 2 && segmenti[1] === 'installa') {
                    if (metodo !== 'POST') throw nonConsentito();
                    servizi.aggiornamento.installa(leggiCorpo(dati, false, servizi.maxFileClienteMb).versione);
                    return rispostaJson(202, { stato: 'download' });
                }
                throw nonTrovatoApi();
            }

            if (segmenti.length === 2 && segmenti[0] === 'cliente' && segmenti[1] === 'leggi') {
                // Non tocca il disco: lavora solo sui byte ricevuti
                if (metodo !== 'POST') throw nonConsentito();
                return rispostaJson(200, leggiFileCliente(leggiCorpo(dati, true, servizi.maxFileClienteMb), servizi.maxFileClienteMb));
            }

            const corpo = metodo === 'POST' || metodo === 'PUT' ? leggiCorpo(dati, false, servizi.maxFileClienteMb) : {};
            const esito = instradaProgetti(servizi.progetti, metodo, segmenti, corpo)
                ?? instradaLibreria(servizi.librerie, metodo, segmenti, corpo, url);
            if (!esito) throw nonTrovatoApi();
            return rispostaJson(esito[0], esito[1]);
        } catch (e) {
            if (e instanceof ErroreApi) return rispostaJson(e.stato, e.corpo());
            console.error(`Errore interno su ${metodo} ${url.pathname}:`, e);
            const messaggio = e instanceof Error ? e.message : String(e);
            return rispostaJson(500, { errore: 'errore_interno', messaggio: `Errore interno del server: ${messaggio}` });
        }
    };
}
