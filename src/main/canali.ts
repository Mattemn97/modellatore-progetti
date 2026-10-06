/* --- NOMI DEI CANALI IPC (condivisi da processo principale e preload) --- */
export const CANALI = {
    chiediTesto: 'modellatore:chiedi-testo',
    rispostaTesto: 'modellatore:risposta-testo',
    cartelleStato: 'modellatore:cartelle-stato',
    cartelleScegli: 'modellatore:cartelle-scegli',
    cartelleApplica: 'modellatore:cartelle-applica',
    apriPercorso: 'modellatore:apri-percorso',
    importaV1Analizza: 'modellatore:importa-v1-analizza',
    importaV1Esegui: 'modellatore:importa-v1-esegui',
    // Export Word e PDF dei documenti (spec 0028)
    esportaDocumento: 'modellatore:esporta-documento'
} as const;
