/* --- CONFIGURAZIONE: CARTELLA DI LAVORO E CARTELLA DELLE LIBRERIE (spec 0019) --- */
// Sta in userData (per utente, fuori dalla cartella del programma); le cartelle si preparano su richiesta
import fs from 'node:fs';
import path from 'node:path';

export interface Configurazione {
    formatVersion: 1;
    cartellaLavoro: string;
    // null = <cartellaLavoro>\shared
    cartellaLibrerie: string | null;
}

export interface Cartelle {
    lavoro: string;
    librerie: string;
}

export const NOME_FILE = 'configurazione.json';
export const NOME_CARTELLA_PREDEFINITA = 'Modellatore MBSE';

// Stesso testo della libreria di esempio di start.py (ensure_shared_library)
export const LIBRERIA_DI_ESEMPIO = `{
  "centralina_condivisa": {
    "id": "centralina_condivisa",
    "titolo": "Centralina Condivisa",
    "descrizione": "Blocco di esempio creato all'avvio",
    "categoria": "Elettrica",
    "sottocategoria": "Controllo",
    "requisiti": [
      {
        "id": "cen_condivisa_001",
        "titolo": "Alimentazione 24V",
        "tipologia": "Elettrica",
        "metodoVerifica": "Test",
        "testiExport": [
          { "testo": "La centralina deve essere alimentata a 24V", "documento": "IRS" }
        ]
      }
    ]
  }
}`;

export function cartelleDi(c: Configurazione): Cartelle {
    return { lavoro: c.cartellaLavoro, librerie: c.cartellaLibrerie ?? path.join(c.cartellaLavoro, 'shared') };
}

// null se manca, è rotta o non ha percorsi assoluti
export function leggiConfigurazione(cartellaUtente: string): Configurazione | null {
    try {
        const dati: unknown = JSON.parse(fs.readFileSync(path.join(cartellaUtente, NOME_FILE), 'utf-8'));
        if (dati === null || typeof dati !== 'object') return null;
        const c = dati as Record<string, unknown>;
        if (c.formatVersion !== 1 || typeof c.cartellaLavoro !== 'string' || !path.isAbsolute(c.cartellaLavoro)) return null;
        const librerie = c.cartellaLibrerie;
        if (librerie !== null && librerie !== undefined && (typeof librerie !== 'string' || !path.isAbsolute(librerie))) return null;
        return { formatVersion: 1, cartellaLavoro: c.cartellaLavoro, cartellaLibrerie: typeof librerie === 'string' ? librerie : null };
    } catch {
        return null;
    }
}

export function scriviConfigurazione(cartellaUtente: string, c: Configurazione): void {
    fs.mkdirSync(cartellaUtente, { recursive: true });
    const file = path.join(cartellaUtente, NOME_FILE);
    fs.writeFileSync(file + '.tmp', JSON.stringify(c, null, 2), 'utf-8');
    fs.renameSync(file + '.tmp', file);
}

function confrontabile(p: string): string {
    const assoluto = path.resolve(p);
    return process.platform === 'win32' ? assoluto.toLowerCase() : assoluto;
}

function dentroO(uguale: string, cartella: string): boolean {
    const a = confrontabile(uguale);
    const b = confrontabile(cartella);
    return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

// Messaggio in italiano se le cartelle non vanno bene, altrimenti null
export function problemaCartelle(cartelle: Cartelle): string | null {
    if (!path.isAbsolute(cartelle.lavoro)) return 'La cartella di lavoro deve essere un percorso completo (es. C:\\Utenti\\nome\\Documenti\\Modellatore MBSE).';
    if (!path.isAbsolute(cartelle.librerie)) return 'La cartella delle librerie deve essere un percorso completo.';
    if (dentroO(cartelle.librerie, path.join(cartelle.lavoro, 'progetti'))) {
        return 'La cartella delle librerie non può stare dentro la cartella dei progetti.';
    }
    if (dentroO(cartelle.lavoro, cartelle.librerie) && confrontabile(cartelle.lavoro) !== confrontabile(cartelle.librerie)) {
        return 'La cartella di lavoro non può stare dentro la cartella delle librerie.';
    }
    if (confrontabile(cartelle.lavoro) === confrontabile(cartelle.librerie)) {
        return 'Scegli due cartelle diverse per il lavoro e per le librerie.';
    }
    return null;
}

function scrivibile(cartella: string): boolean {
    try {
        if (!fs.statSync(cartella).isDirectory()) return false;
        fs.accessSync(cartella, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

export type StatoCartelle = { pronte: true } | { pronte: false; motivo: string };

// Le cartelle esistono, sono scrivibili e hanno la struttura minima (progetti/)?
export function statoCartelle(cartelle: Cartelle): StatoCartelle {
    const problema = problemaCartelle(cartelle);
    if (problema) return { pronte: false, motivo: problema };
    if (!scrivibile(cartelle.lavoro)) return { pronte: false, motivo: `La cartella di lavoro "${cartelle.lavoro}" non esiste o non è scrivibile.` };
    if (!scrivibile(cartelle.librerie)) return { pronte: false, motivo: `La cartella delle librerie "${cartelle.librerie}" non esiste o non è scrivibile.` };
    return { pronte: true };
}

// Cartelle da creare o da preparare (assenti o senza la struttura del modellatore)
export function daPreparare(cartelle: Cartelle): string[] {
    const elenco: string[] = [];
    if (!fs.existsSync(path.join(cartelle.lavoro, 'progetti'))) elenco.push(cartelle.lavoro);
    if (!fs.existsSync(cartelle.librerie) || fs.readdirSync(cartelle.librerie).length === 0) elenco.push(cartelle.librerie);
    return elenco;
}

// Crea ciò che manca, senza mai sovrascrivere: cartelle, progetti/, libreria di esempio, settings.json predefinito
export function preparaCartelle(cartelle: Cartelle, impostazioniPredefinite: string): void {
    fs.mkdirSync(path.join(cartelle.lavoro, 'progetti'), { recursive: true });
    fs.mkdirSync(cartelle.librerie, { recursive: true });
    const settings = path.join(cartelle.lavoro, 'settings.json');
    if (!fs.existsSync(settings) && fs.existsSync(impostazioniPredefinite)) fs.copyFileSync(impostazioniPredefinite, settings);
    const haLibrerie = fs.readdirSync(cartelle.librerie).some((n) => n.toLowerCase().endsWith('.json'));
    if (!haLibrerie) fs.writeFileSync(path.join(cartelle.librerie, 'libreria.json'), LIBRERIA_DI_ESEMPIO, 'utf-8');
}
