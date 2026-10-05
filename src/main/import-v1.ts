/* --- IMPORT DEI DATI DI UNA INSTALLAZIONE 1.x: COPIA DI progetti/, shared/ E settings.json (voce 22) --- */
// Copia soltanto: la cartella vecchia non si scrive, non si sposta, non si cancella mai
import fs from 'node:fs';
import path from 'node:path';
import type { Cartelle } from './configurazione.js';

export interface FileDaImportare {
    // Percorso mostrato all'utente, relativo alla cartella 1.x (es. progetti\impianto.json)
    relativo: string;
    sorgente: string;
    destinazione: string;
}

export interface Analisi {
    nuovi: FileDaImportare[];
    uguali: FileDaImportare[];
    diversi: FileDaImportare[];
}

export class ErroreImport extends Error {}

// Tutti i file sotto una cartella (senza seguire i collegamenti), con il percorso relativo
function fileSotto(cartella: string): string[] {
    const risultato: string[] = [];
    const visita = (relativa: string) => {
        for (const voce of fs.readdirSync(path.join(cartella, relativa), { withFileTypes: true })) {
            const figlia = path.join(relativa, voce.name);
            if (voce.isSymbolicLink()) continue;
            if (voce.isDirectory()) visita(figlia);
            else if (voce.isFile() && !voce.name.endsWith('.tmp')) risultato.push(figlia);
        }
    };
    visita('');
    return risultato;
}

function uguali(a: string, b: string): boolean {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
}

export function analizza(cartellaV1: string, cartelle: Cartelle): Analisi {
    if (!path.isAbsolute(cartellaV1) || !fs.existsSync(cartellaV1)) throw new ErroreImport('La cartella scelta non esiste.');
    const progetti = path.join(cartellaV1, 'progetti');
    const shared = path.join(cartellaV1, 'shared');
    const haProgetti = fs.existsSync(progetti) && fs.statSync(progetti).isDirectory();
    const haShared = fs.existsSync(shared) && fs.statSync(shared).isDirectory();
    if (!haProgetti && !haShared) {
        throw new ErroreImport('Non sembra la cartella di una versione 1.x: mancano le cartelle progetti e shared accanto a start.exe.');
    }
    const confronta = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
    if (confronta(cartellaV1, cartelle.lavoro) || (haShared && confronta(shared, cartelle.librerie))) {
        throw new ErroreImport('È la cartella che il programma sta già usando: scegli quella della vecchia installazione.');
    }
    const elenco: FileDaImportare[] = [];
    if (haProgetti) {
        for (const r of fileSotto(progetti)) elenco.push({ relativo: path.join('progetti', r), sorgente: path.join(progetti, r), destinazione: path.join(cartelle.lavoro, 'progetti', r) });
    }
    if (haShared) {
        for (const r of fileSotto(shared)) elenco.push({ relativo: path.join('shared', r), sorgente: path.join(shared, r), destinazione: path.join(cartelle.librerie, r) });
    }
    const settings = path.join(cartellaV1, 'settings.json');
    if (fs.existsSync(settings) && fs.statSync(settings).isFile()) {
        elenco.push({ relativo: 'settings.json', sorgente: settings, destinazione: path.join(cartelle.lavoro, 'settings.json') });
    }
    const analisi: Analisi = { nuovi: [], uguali: [], diversi: [] };
    for (const f of elenco) {
        if (!fs.existsSync(f.destinazione)) analisi.nuovi.push(f);
        else if (uguali(f.sorgente, f.destinazione)) analisi.uguali.push(f);
        else analisi.diversi.push(f);
    }
    return analisi;
}

// Copia i file nuovi e, se richiesto, sovrascrive quelli diversi; restituisce quanti ne ha copiati
export function esegui(analisi: Analisi, sovrascrivi: boolean): { copiati: number; saltati: number } {
    const daCopiare = sovrascrivi ? [...analisi.nuovi, ...analisi.diversi] : analisi.nuovi;
    for (const f of daCopiare) {
        fs.mkdirSync(path.dirname(f.destinazione), { recursive: true });
        // Prima in un .tmp accanto, poi al suo posto: un errore a metà non lascia file troncati
        fs.copyFileSync(f.sorgente, f.destinazione + '.tmp');
        fs.renameSync(f.destinazione + '.tmp', f.destinazione);
    }
    return { copiati: daCopiare.length, saltati: analisi.uguali.length + (sovrascrivi ? 0 : analisi.diversi.length) };
}
