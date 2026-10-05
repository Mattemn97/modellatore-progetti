/* --- LIBRERIA DI PROVA --- */
// Due blocchi collegabili: interfaccia Elettrica con Elettrica, capacità con capacità

export const LIBRERIA_PROVA = {
    alimentatore: {
        id: 'alimentatore',
        titolo: 'Alimentatore',
        descrizione: 'Fornisce la tensione',
        categoria: 'Elettrica',
        sottocategoria: 'Potenza',
        requisiti: [
            { id: 'ali_001', titolo: 'Uscita 24V', tipologia: 'Elettrica', metodoVerifica: 'Test', testiExport: [{ testo: "L'alimentatore fornisce 24V", documento: 'IRS' }] },
            { id: 'ali_002', titolo: 'Efficienza', tipologia: null, metodoVerifica: 'Analisi', testiExport: [{ testo: "L'efficienza è almeno del 90%", documento: 'SSS' }] }
        ]
    },
    centralina: {
        id: 'centralina',
        titolo: 'Centralina',
        descrizione: 'Controlla il sistema',
        categoria: 'Elettrica',
        sottocategoria: 'Controllo',
        requisiti: [
            { id: 'cen_001', titolo: 'Ingresso 24V', tipologia: 'Elettrica', metodoVerifica: 'Test', testiExport: [{ testo: 'La centralina accetta 24V', documento: 'IRS' }] },
            { id: 'cen_002', titolo: 'Tempo di risposta', tipologia: null, metodoVerifica: 'Test', testiExport: [{ testo: 'La centralina risponde entro 10 ms', documento: 'SSS' }] }
        ]
    },
    sensore: {
        id: 'sensore',
        titolo: 'Sensore',
        descrizione: 'Misura la temperatura',
        categoria: 'Misura',
        sottocategoria: 'Temperatura',
        requisiti: [
            { id: 'sen_001', titolo: 'Uscita segnale', tipologia: 'Segnale', metodoVerifica: 'Ispezione', testiExport: [{ testo: 'Il sensore fornisce un segnale 4-20 mA', documento: 'IDD' }] }
        ]
    }
};

// Progetto con alimentatore e centralina collegati sul requisito Elettrica
export function progettoCollegato(nome = 'Sistema di prova'): Record<string, unknown> {
    return {
        formatVersion: 2,
        nome,
        libraryPath: 'shared/libreria.json',
        workspace: {
            nodes: [
                { id: 'node_a', type: 'alimentatore', label: 'Alimentatore', width: 160, height: 60, position: { x: 100, y: 100 }, internal_graph: { nodes: [], edges: [] } },
                { id: 'node_c', type: 'centralina', label: 'Centralina', width: 160, height: 60, position: { x: 500, y: 100 }, internal_graph: { nodes: [], edges: [] } }
            ],
            edges: [
                { id: 'edge_1', source: 'node_a', sourceHandle: 'ali_001', sourceType: 'node', target: 'node_c', targetHandle: 'cen_001', targetType: 'node', waypoints: [] }
            ]
        }
    };
}
