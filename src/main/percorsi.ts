/* --- PERCORSI SERVITI DAL PROTOCOLLO app:// (logica pura) --- */
import path from 'node:path';

// Solo questi file e cartelle della radice dell'app si possono servire alla pagina
const RADICI_AMMESSE = new Set(['index.html', 'benvenuto.html', 'style.css', 'settings.json', 'js']);

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
