/* --- CHIAMATE ALLE API DALLA PAGINA (stesso trasporto dell'app) --- */
import type { Page } from '@playwright/test';

export interface RispostaApi<T = Record<string, unknown>> {
    stato: number;
    corpo: T;
}

// fetch eseguito nella pagina: oggi risponde start.py dietro il ponte, domani il processo principale
export async function api<T = Record<string, unknown>>(
    pagina: Page, metodo: string, percorso: string, corpo?: unknown, tipo = 'application/json'
): Promise<RispostaApi<T>> {
    return pagina.evaluate(async ({ metodo, percorso, corpo, tipo }) => {
        const opzioni: RequestInit = { method: metodo };
        if (corpo !== undefined) {
            opzioni.body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
            opzioni.headers = { 'Content-Type': tipo };
        } else if (metodo !== 'GET' && metodo !== 'HEAD') {
            opzioni.headers = { 'Content-Type': tipo };
        }
        const risposta = await fetch(percorso, opzioni);
        const testo = await risposta.text();
        let dati: unknown;
        try { dati = testo ? JSON.parse(testo) : null; } catch { dati = testo; }
        return { stato: risposta.status, corpo: dati as T };
    }, { metodo, percorso, corpo, tipo });
}

export function progettoVuoto(nome: string, libraryPath = 'shared/libreria.json'): Record<string, unknown> {
    return { formatVersion: 2, nome, libraryPath, workspace: { nodes: [], edges: [] } };
}
