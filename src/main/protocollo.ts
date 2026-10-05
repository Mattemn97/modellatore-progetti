/* --- PROTOCOLLO app:// : FILE DELL'INTERFACCIA E ROTTE /api --- */
import { net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA = 'app';
export const HOST = 'modellatore';
export const URL_INIZIALE = `${SCHEMA}://${HOST}/index.html`;

// Solo questi file e cartelle della radice dell'app si possono servire alla pagina
const RADICI_AMMESSE = new Set(['index.html', 'style.css', 'settings.json', 'js']);

export type GestoreApi = (richiesta: Request, url: URL) => Promise<Response>;

// Va chiamata prima di app.whenReady(): rende app:// uno schema "vero" (moduli ES, fetch, storage)
export function registraSchema(): void {
    protocol.registerSchemesAsPrivileged([{
        scheme: SCHEMA,
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }]);
}

function nonTrovato(): Response {
    return new Response('Non trovato', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// Risolve un percorso dell'URL dentro la radice; null se esce dalla radice o non è ammesso
export function risolviFile(radice: string, percorsoUrl: string): string | null {
    let relativo: string;
    try {
        relativo = decodeURIComponent(percorsoUrl).replace(/^\/+/, '');
    } catch {
        return null;
    }
    if (relativo === '') relativo = 'index.html';
    const assoluto = path.resolve(radice, relativo);
    const dentro = path.relative(radice, assoluto);
    if (dentro === '' || dentro.startsWith('..') || path.isAbsolute(dentro)) return null;
    const primo = dentro.split(path.sep)[0] ?? '';
    return RADICI_AMMESSE.has(primo) ? assoluto : null;
}

export function installaProtocollo(radice: string, api: GestoreApi): void {
    protocol.handle(SCHEMA, async (richiesta) => {
        const url = new URL(richiesta.url);
        if (url.host !== HOST) return nonTrovato();
        if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return api(richiesta, url);
        if (richiesta.method !== 'GET' && richiesta.method !== 'HEAD') {
            return new Response('Metodo non consentito', { status: 405 });
        }
        const file = risolviFile(radice, url.pathname);
        if (!file) return nonTrovato();
        try {
            // net.fetch su file:// sceglie il Content-Type giusto (text/javascript per i moduli)
            const risposta = await net.fetch(pathToFileURL(file).toString());
            // Niente cache: in sviluppo si modifica js/ e si ricarica
            const intestazioni = new Headers(risposta.headers);
            intestazioni.set('Cache-Control', 'no-store');
            return new Response(risposta.body, { status: risposta.status, headers: intestazioni });
        } catch {
            return nonTrovato();
        }
    });
}
