/* --- CONFRONTO DEI BLOCCHI DI LIBRERIA: MODIFICHE PER IL CHANGELOG E LIVELLO SEMVER (spec 0002, 0018) --- */
// Porta fedele di confronta_blocco, confronta_librerie e livello_di di start.py
import { eOggetto, valoriUguali } from './file.js';

type Oggetto = Record<string, unknown>;
export type Livello = 'patch' | 'minor' | 'major';
export const ORDINE_LIVELLI: Record<Livello, number> = { patch: 0, minor: 1, major: 2 };

export interface ModificaRequisito {
    id: string;
    tipo: 'aggiunto' | 'rimosso' | 'modificato' | 'rinominato';
    idPrecedente?: string;
    campi: string[];
}

export interface Modifica {
    blocco: string;
    idPrecedente?: string;
    titolo: string;
    tipo: 'creato' | 'eliminato' | 'modificato' | 'rinominato';
    campiBlocco: string[];
    requisiti: ModificaRequisito[];
}

type Requisito = Oggetto & { id: string };

export function requisitiDi(blocco: unknown): Requisito[] {
    const requisiti = eOggetto(blocco) ? blocco.requisiti : null;
    if (!Array.isArray(requisiti)) return [];
    return requisiti.filter((r): r is Requisito => eOggetto(r) && typeof r.id === 'string');
}

export function titoloDi(blocco: unknown, idBlocco: string): string {
    const titolo = eOggetto(blocco) ? blocco.titolo : null;
    return typeof titolo === 'string' && titolo.trim() ? titolo : idBlocco;
}

// Confronto generico: un campo aggiunto in futuro è coperto senza toccare questo codice.
// Un campo presente da una parte sola è cambiato (anche se dall'altra vale null)
function campiCambiati(prima: Oggetto, dopo: Oggetto, esclusi: Set<string>): string[] {
    const chiavi = [...Object.keys(prima), ...Object.keys(dopo).filter((k) => !(k in prima))];
    return chiavi.filter((k) => {
        if (esclusi.has(k)) return false;
        const inPrima = k in prima;
        const inDopo = k in dopo;
        if (!inPrima || !inDopo) return inPrima !== inDopo;
        return !valoriUguali(prima[k], dopo[k]);
    });
}

// Modifica di un blocco per il changelog, oppure null se non è cambiato nulla
export function confrontaBlocco(idBlocco: string, prima: unknown, dopo: unknown, rinomine: Record<string, string> = {}): Modifica | null {
    if (!eOggetto(prima) && !eOggetto(dopo)) return null;
    if (!eOggetto(prima)) {
        return {
            blocco: idBlocco, titolo: titoloDi(dopo, idBlocco), tipo: 'creato', campiBlocco: [],
            requisiti: requisitiDi(dopo).map((r) => ({ id: r.id, tipo: 'aggiunto', campi: [] }))
        };
    }
    if (!eOggetto(dopo)) {
        return {
            blocco: idBlocco, titolo: titoloDi(prima, idBlocco), tipo: 'eliminato', campiBlocco: [],
            requisiti: requisitiDi(prima).map((r) => ({ id: r.id, tipo: 'rimosso', campi: [] }))
        };
    }

    const campiBlocco = campiCambiati(prima, dopo, new Set(['id', 'requisiti']));
    const reqPrima = requisitiDi(prima);
    const reqDopo = requisitiDi(dopo);

    // Prima le rinomine, poi l'abbinamento per id nuovo: uno scambio a→b, b→a dà due rinominato
    const abbinati = new Map<string, Requisito>();
    for (const r of reqPrima) {
        const nuovo = Object.hasOwn(rinomine, r.id) ? rinomine[r.id] : undefined;
        if (nuovo !== undefined) abbinati.set(nuovo, r);
    }
    for (const r of reqPrima) {
        if (!Object.hasOwn(rinomine, r.id) && !abbinati.has(r.id)) abbinati.set(r.id, r);
    }
    const nuovoIdDi = new Map<Requisito, string>();
    for (const [nuovo, r] of abbinati) nuovoIdDi.set(r, nuovo);
    const idsDopo = reqDopo.map((r) => r.id);
    const presenti = new Set(idsDopo);

    const ordinePrima = reqPrima.filter((r) => nuovoIdDi.has(r) && presenti.has(nuovoIdDi.get(r) ?? '')).map((r) => nuovoIdDi.get(r) ?? '');
    const ordineDopo = idsDopo.filter((i) => abbinati.has(i));
    if (ordinePrima.length !== ordineDopo.length || ordinePrima.some((v, i) => v !== ordineDopo[i])) campiBlocco.push('ordineRequisiti');

    const modifiche: ModificaRequisito[] = [];
    const usati = new Set<Requisito>();
    for (const r of reqDopo) {
        const vecchio = abbinati.get(r.id);
        if (vecchio === undefined) {
            modifiche.push({ id: r.id, tipo: 'aggiunto', campi: [] });
            continue;
        }
        usati.add(vecchio);
        const campi = campiCambiati(vecchio, r, new Set(['id']));
        if (vecchio.id !== r.id) modifiche.push({ id: r.id, tipo: 'rinominato', idPrecedente: vecchio.id, campi });
        else if (campi.length > 0) modifiche.push({ id: r.id, tipo: 'modificato', campi });
    }
    for (const r of reqPrima) {
        if (!usati.has(r)) modifiche.push({ id: r.id, tipo: 'rimosso', campi: [] });
    }

    if (campiBlocco.length === 0 && modifiche.length === 0) return null;
    return { blocco: idBlocco, titolo: titoloDi(dopo, idBlocco), tipo: 'modificato', campiBlocco, requisiti: modifiche };
}

export function confrontaLibrerie(prima: Oggetto, dopo: Oggetto): Modifica[] {
    const ids = [...Object.keys(prima), ...Object.keys(dopo).filter((k) => !(k in prima))];
    const modifiche: Modifica[] = [];
    for (const idBlocco of ids) {
        const modifica = confrontaBlocco(idBlocco, prima[idBlocco], dopo[idBlocco]);
        if (modifica) modifiche.push(modifica);
    }
    return modifiche;
}

// major: requisito rimosso o rinominato, tipologia cambiata, blocco eliminato o rinominato; minor: blocco o requisito nuovo
export function livelloDi(modifiche: Modifica[]): Livello {
    let livello: Livello = 'patch';
    for (const m of modifiche) {
        if (m.tipo === 'eliminato' || m.tipo === 'rinominato') return 'major';
        for (const r of m.requisiti) {
            if (r.tipo === 'rimosso' || r.tipo === 'rinominato' || r.campi.includes('tipologia')) return 'major';
        }
        if (m.tipo === 'creato' || m.requisiti.some((r) => r.tipo === 'aggiunto')) livello = 'minor';
    }
    return livello;
}

export function avanzaVersione(versione: string, livello: Livello): string {
    const [major = 0, minor = 0, patch = 0] = versione.split('.').map((x) => Number.parseInt(x, 10));
    if (livello === 'major') return `${major + 1}.0.0`;
    if (livello === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

export function livelloMaggiore(a: Livello, b: Livello): Livello {
    return ORDINE_LIVELLI[a] >= ORDINE_LIVELLI[b] ? a : b;
}
