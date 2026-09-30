/* --- GESTIONE STATO GLOBALE --- */

export let appSettings = null;

export const appState = {
    activeTypeFilter: 'Tutti',
    omitUninvolved: false,
    librarySearchQuery: '',
    library: {
        "centralina": { 
            name: "Centralina Principale", 
            category: "Elettrica/Controllo",
            requirements: [
                { 
                    id: "req_1", 
                    title: "Alimentazione 24V", 
                    description: "Fornisce alimentazione principale a 24V DC con tolleranza +/- 5%", 
                    type: "Elettrica" 
                },
                { 
                    id: "req_2", 
                    title: "Bus CAN", 
                    description: "Interfaccia di comunicazione CAN Bus High Speed a 500 kbps", 
                    type: "Segnale" 
                }
            ]
        },
        "sensore": { 
            name: "Sensore di Pressione", 
            category: "Sensori/Fluidica",
            requirements: [
                { 
                    id: "req_3", 
                    title: "Out Segnale", 
                    description: "Uscita analogica 0-10V proporzionale alla pressione misurata", 
                    type: "Segnale" 
                },
                { 
                    id: "req_4", 
                    title: "Ingresso Fluido", 
                    description: "Connessione meccanica 1/4 NPT per ingresso fluido di processo", 
                    type: "Fluidica" 
                }
            ]
        }
    },
    workspace: { nodes: [], edges: [] }
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
    try {
        const response = await fetch('settings.json');
        appSettings = await response.json();
    } catch (e) {
        appSettings = {
            grid: { size: 20 },
            node: { width: 160, height: 60, selectedBorderColor: "#0078d4" },
            requirements: { radius: 7, typeColors: { Elettrica: "#e74c3c", Segnale: "#2ecc71", Meccanica: "#f39c12", Fluidica: "#3498db" } }
        };
    }
}