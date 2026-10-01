/* --- GESTIONE STATO GLOBALE --- */

export let appSettings = null;

// Valori usati quando settings.json manca o non ha una chiave
const DEFAULT_SETTINGS = {
    libraryPath: "shared/libreria.json",
    progetti: { debounceMs: 1000, versioni: 3 },
    libreria: { versioni: 3 },
    cliente: { prefisso: "CLI-", maxFileMB: 20, righeAnteprima: 200, righePannello: 300 },
    coerenza: { righePerGruppo: 200 },
    gerarchia: { righeAperte: 300 },
    matrice: { gruppiVisibili: 300 },
    grid: { size: 20 },
    node: { width: 160, height: 60, selectedBorderColor: "#0078d4" },
    parentBlock: { radius: 28 },
    requirements: {
        radius: 7,
        capabilityColor: "#8e44ad",
        typeColors: { Elettrica: "#e74c3c", Segnale: "#2ecc71", Meccanica: "#f39c12", Fluidica: "#3498db" }
    },
    metodiVerifica: ["Ispezione", "Analisi", "Dimostrazione", "Test"],
    documenti: ["SSS", "SSDD", "IRS", "IDD", "SRS", "SDD"]
};

export const appState = {
    activeTypeFilter: 'Tutti',
    omitUninvolved: false,
    librarySearchQuery: '',
    // Libreria di esempio, sostituita da quella caricata da libraryPath
    library: {
        "centralina": {
            id: "centralina",
            titolo: "Centralina Principale",
            descrizione: "Unità di controllo principale del sistema",
            categoria: "Elettrica",
            sottocategoria: "Controllo",
            requisiti: [
                {
                    id: "cen_001",
                    titolo: "Alimentazione 24V",
                    tipologia: "Elettrica",
                    metodoVerifica: "Test",
                    testiExport: [{ testo: "La centralina deve essere alimentata a 24V DC con tolleranza +/- 5%", documento: "IRS" }]
                },
                {
                    id: "cen_002",
                    titolo: "Gestione allarmi",
                    tipologia: null,
                    metodoVerifica: "Dimostrazione",
                    testiExport: [{ testo: "La centralina deve segnalare gli allarmi di sistema all'operatore", documento: "SSS" }]
                }
            ]
        }
    },
    workspace: { nodes: [], edges: [] },
    // Requisiti cliente del progetto aperto (spec 0003): null se il progetto non ne ha
    cliente: null
};

export let pathStack = [{ id: 'root', label: 'Progetto Intero (Root)', graph: appState.workspace, parentNode: null }];
export let activeNodeId = null;

export function setActiveNodeId(id) {
    activeNodeId = id;
}

export function getCurrentLevel() {
    return pathStack[pathStack.length - 1];
}

export async function loadSettings() {
    let caricate = {};
    try {
        const response = await fetch('settings.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        caricate = await response.json();
    } catch (e) {
        console.warn('settings.json non leggibile, uso i valori predefiniti:', e);
    }
    appSettings = {
        ...DEFAULT_SETTINGS,
        ...caricate,
        progetti: { ...DEFAULT_SETTINGS.progetti, ...caricate.progetti },
        libreria: { ...DEFAULT_SETTINGS.libreria, ...caricate.libreria },
        cliente: { ...DEFAULT_SETTINGS.cliente, ...caricate.cliente },
        coerenza: { ...DEFAULT_SETTINGS.coerenza, ...caricate.coerenza },
        gerarchia: { ...DEFAULT_SETTINGS.gerarchia, ...caricate.gerarchia },
        matrice: { ...DEFAULT_SETTINGS.matrice, ...caricate.matrice },
        grid: { ...DEFAULT_SETTINGS.grid, ...caricate.grid },
        node: { ...DEFAULT_SETTINGS.node, ...caricate.node },
        parentBlock: { ...DEFAULT_SETTINGS.parentBlock, ...caricate.parentBlock },
        requirements: { ...DEFAULT_SETTINGS.requirements, ...caricate.requirements }
    };
}
