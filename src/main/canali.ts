/* --- NOMI DEI CANALI IPC (condivisi da processo principale e preload) --- */
export const CANALI = {
    chiediTesto: 'modellatore:chiedi-testo',
    rispostaTesto: 'modellatore:risposta-testo',
    cartelleStato: 'modellatore:cartelle-stato',
    cartelleScegli: 'modellatore:cartelle-scegli',
    cartelleApplica: 'modellatore:cartelle-applica',
    apriPercorso: 'modellatore:apri-percorso'
} as const;
