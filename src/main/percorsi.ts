/* --- PERCORSI SERVITI DAL PROTOCOLLO app:// (logica pura) --- */
import path from 'node:path';

// Risolve un percorso dell'URL dentro la cartella dell'interfaccia (out/renderer); null se ne esce
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
    return assoluto;
}
