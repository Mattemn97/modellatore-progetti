/* --- CHIAMATE ALLE API DEL PROGRAMMA (/api/*, servite dal processo principale) --- */

export type EsitoApi<T> =
    | { ok: true; stato: number; dati: T }
    | { ok: false; stato: number; errore: string; messaggio: string; dati?: unknown };

interface CorpoErrore {
    errore?: string;
    messaggio?: string;
}

// fetch con JSON in entrata e in uscita; un errore di rete diventa stato 0
export async function chiamaApi<T = unknown>(metodo: string, percorso: string, corpo?: unknown): Promise<EsitoApi<T>> {
    const opzioni: RequestInit = { method: metodo, headers: { 'Content-Type': 'application/json' } };
    if (corpo !== undefined) opzioni.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    let risposta: Response;
    try {
        risposta = await fetch(percorso, opzioni);
    } catch {
        return { ok: false, stato: 0, errore: 'rete', messaggio: 'Server non raggiungibile' };
    }
    let dati: unknown = null;
    if (risposta.status !== 204) {
        try { dati = await risposta.json(); } catch { dati = null; }
    }
    if (risposta.ok) return { ok: true, stato: risposta.status, dati: dati as T };
    const errore = (dati ?? {}) as CorpoErrore;
    return {
        ok: false,
        stato: risposta.status,
        errore: errore.errore || `http_${risposta.status}`,
        messaggio: errore.messaggio || `Errore del server (HTTP ${risposta.status})`,
        dati
    };
}
