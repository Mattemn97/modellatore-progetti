/* --- GESTIONE STATO GLOBALE --- */

import type { Cliente, DocumentiPerClasse, Grafo, Impostazioni, Libreria, Livello } from './tipi.js';

// Impostate da loadSettings() prima di ogni altro init: dopo l'avvio non sono mai null
export let appSettings: Impostazioni = null as unknown as Impostazioni;

// Valori usati quando settings.json manca o non ha una chiave
const DEFAULT_SETTINGS: Impostazioni = {
    libraryPath: 'shared/libreria.json',
    progetti: { debounceMs: 1000, versioni: 3 },
    libreria: { versioni: 3 },
    aggiornamenti: { controllo: true, repository: 'Mattemn97/modellatore-progetti' },
    cliente: { prefisso: 'CLI-', maxFileMB: 20, righeAnteprima: 200, righePannello: 300 },
    coerenza: { righePerGruppo: 200 },
    gerarchia: { righeAperte: 300 },
    matrice: { gruppiVisibili: 300 },
    documentiExport: { anteprimaCaratteri: 200000 },
    grid: { size: 20 },
    node: { width: 160, height: 60, selectedBorderColor: '#0078d4' },
    parentBlock: { radius: 28 },
    requirements: {
        radius: 7,
        capabilityColor: '#8e44ad',
        typeColors: { Elettrica: '#e74c3c', Segnale: '#2ecc71', Meccanica: '#f39c12', Fluidica: '#3498db' }
    },
    metodiVerifica: ['Ispezione', 'Analisi', 'Dimostrazione', 'Test'],
    documenti: ['SSS', 'SSDD', 'IRS', 'IDD', 'SRS', 'SDD'],
    documentiPerClasse: { interfaccia: ['IRS', 'IDD'], capacita: ['SSS', 'SSDD', 'SRS', 'SDD'] }
};

export const appState: { librarySearchQuery: string; library: Libreria; workspace: Grafo; cliente: Cliente | null } = {
    librarySearchQuery: '',
    // Libreria di esempio, sostituita da quella caricata da libraryPath
    library: {
        centralina: {
            id: 'centralina',
            titolo: 'Centralina Principale',
            descrizione: 'Unità di controllo principale del sistema',
            categoria: 'Elettrica',
            sottocategoria: 'Controllo',
            requisiti: [
                {
                    id: 'cen_001',
                    titolo: 'Alimentazione 24V',
                    tipologia: 'Elettrica',
                    metodoVerifica: 'Test',
                    testiExport: [{ testo: 'La centralina deve essere alimentata a 24V DC con tolleranza +/- 5%', documento: 'IRS' }]
                },
                {
                    id: 'cen_002',
                    titolo: 'Gestione allarmi',
                    tipologia: null,
                    metodoVerifica: 'Dimostrazione',
                    testiExport: [{ testo: "La centralina deve segnalare gli allarmi di sistema all'operatore", documento: 'SSS' }]
                }
            ]
        }
    },
    workspace: { nodes: [], edges: [] },
    // Requisiti cliente del progetto aperto (spec 0003): null se il progetto non ne ha
    cliente: null
};

// Il percorso dei livelli aperti; si sostituisce sempre sul posto (altri moduli tengono questo riferimento)
export const pathStack: Livello[] = [{ id: 'root', label: 'Progetto Intero (Root)', graph: appState.workspace, parentNode: null }];
export let activeNodeId: string | null = null;

export function setActiveNodeId(id: string | null): void {
    activeNodeId = id;
}

// Il livello sullo schermo: pathStack ha sempre almeno la radice
export function getCurrentLevel(): Livello {
    return pathStack[pathStack.length - 1] as Livello;
}

type Parziale<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export async function loadSettings(): Promise<void> {
    let caricate: Parziale<Impostazioni> = {};
    try {
        const response = await fetch('settings.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        caricate = await response.json() as Parziale<Impostazioni>;
    } catch (e) {
        console.warn('settings.json non leggibile, uso i valori predefiniti:', e);
    }
    appSettings = {
        ...DEFAULT_SETTINGS,
        ...(caricate as Partial<Impostazioni>),
        progetti: { ...DEFAULT_SETTINGS.progetti, ...caricate.progetti },
        libreria: { ...DEFAULT_SETTINGS.libreria, ...caricate.libreria },
        aggiornamenti: { ...DEFAULT_SETTINGS.aggiornamenti, ...caricate.aggiornamenti },
        cliente: { ...DEFAULT_SETTINGS.cliente, ...caricate.cliente },
        coerenza: { ...DEFAULT_SETTINGS.coerenza, ...caricate.coerenza },
        gerarchia: { ...DEFAULT_SETTINGS.gerarchia, ...caricate.gerarchia },
        matrice: { ...DEFAULT_SETTINGS.matrice, ...caricate.matrice },
        documentiExport: { ...DEFAULT_SETTINGS.documentiExport, ...caricate.documentiExport },
        grid: { ...DEFAULT_SETTINGS.grid, ...caricate.grid },
        node: { ...DEFAULT_SETTINGS.node, ...caricate.node },
        parentBlock: { ...DEFAULT_SETTINGS.parentBlock, ...caricate.parentBlock },
        requirements: { ...DEFAULT_SETTINGS.requirements, ...caricate.requirements },
        documentiPerClasse: unisciDocumentiPerClasse(caricate.documentiPerClasse)
    };
}

// Per ciascuna classe vince una lista di stringhe, altrimenti il predefinito (spec 0027, AC-1):
// un refuso in settings.json non deve far sparire tutti i documenti dal menu
export function unisciDocumentiPerClasse(caricata: unknown): DocumentiPerClasse {
    const esito: DocumentiPerClasse = { ...DEFAULT_SETTINGS.documentiPerClasse };
    if (!caricata || typeof caricata !== 'object') return esito;
    for (const classe of ['interfaccia', 'capacita'] as const) {
        const lista = (caricata as Record<string, unknown>)[classe];
        if (!Array.isArray(lista) || !lista.every(v => typeof v === 'string')) continue;
        esito[classe] = [...new Set((lista as string[]).map(v => v.trim()).filter(v => v && v !== 'Cliente'))];
    }
    return esito;
}
