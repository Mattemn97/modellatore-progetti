/* --- PROTOCOLLO app:// : FILE DELL'INTERFACCIA E ROTTE /api --- */
import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { risolviFile } from './percorsi.js';

export const SCHEMA = 'app';
export const HOST = 'modellatore';
export const URL_INIZIALE = `${SCHEMA}://${HOST}/index.html`;

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

export const URL_BENVENUTO = `${SCHEMA}://${HOST}/benvenuto.html`;

// radice: out/renderer (spec 0020). settings.json: quello della cartella di lavoro se c'è (spec 0019), altrimenti i predefiniti
export function installaProtocollo(radice: string, api: GestoreApi, settings: () => string): void {
    protocol.handle(SCHEMA, async (richiesta) => {
        const url = new URL(richiesta.url);
        if (url.host !== HOST) return nonTrovato();
        if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return api(richiesta, url);
        if (richiesta.method !== 'GET' && richiesta.method !== 'HEAD') {
            return new Response('Metodo non consentito', { status: 405 });
        }
        const file = url.pathname === '/settings.json' ? settings() : risolviFile(radice, url.pathname);
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
