/* --- IMPOSTAZIONI LETTE DALL'API (settings.json della cartella dei dati, solo all'avvio) --- */
import fs from 'node:fs';
import path from 'node:path';

export const VERSIONI_PREDEFINITE = 3;
export const MAX_FILE_CLIENTE_MB_PREDEFINITO = 20;

export interface ImpostazioniApi {
    versioniProgetti: number;
    versioniLibreria: number;
    maxFileClienteMb: number;
}

function leggi(cartellaDati: string): Record<string, unknown> | null {
    try {
        const valore: unknown = JSON.parse(fs.readFileSync(path.join(cartellaDati, 'settings.json'), 'utf-8'));
        return valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

function sezione(dati: Record<string, unknown> | null, nome: string): Record<string, unknown> {
    const valore = dati?.[nome];
    return valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : {};
}

// <sezione>.versioni: intero, minimo 1; cliente.maxFileMB: numero positivo; altrimenti il predefinito
export function leggiImpostazioniApi(cartellaDati: string): ImpostazioniApi {
    const dati = leggi(cartellaDati);
    const versioni = (nome: string): number => {
        const v = sezione(dati, nome).versioni;
        return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : VERSIONI_PREDEFINITE;
    };
    const mb = sezione(dati, 'cliente').maxFileMB;
    return {
        versioniProgetti: versioni('progetti'),
        versioniLibreria: versioni('libreria'),
        maxFileClienteMb: typeof mb === 'number' && Number.isFinite(mb) && mb > 0 ? mb : MAX_FILE_CLIENTE_MB_PREDEFINITO
    };
}
