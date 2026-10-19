/* --- PORTE PROPAGATE DEI BLOCCHI MATRIOSKA (spec 0035) --- */
// Un requisito di interfaccia di un blocco interno che nessun filo usa nel livello in cui sta sale sul bordo del
// blocco che lo contiene, come porta "propagata", e così via verso l'alto finché un filo lo usa. Lì si collega
// come una porta qualsiasi: il filo ricorda il percorso dei nodi interni (sourcePercorso / targetPercorso).
// Funzioni pure sul modello: non lo cambiano mai.

import { isInterfaccia } from './model.js';
import type { Blocco, Filo, Grafo, Libreria, Nodo, RequisitoLibreria, TipoEstremo } from './tipi.js';

// Oltre questa profondità non si cercano porte (difesa contro modelli rotti con cicli)
const PROFONDITA_MAX = 12;

export interface PortaPropagata {
    reqId: string;
    // Id dei nodi dentro il blocco, dal primo livello interno fino a quello che ha il requisito (almeno uno)
    percorso: string[];
    // Etichette degli stessi nodi, per le righe del blocco e i messaggi
    etichette: string[];
    req: RequisitoLibreria;
    proprietario: Nodo;
    def: Blocco;
}

export function percorsoSorgente(edge: Filo): string[] {
    return edge.sourcePercorso ?? [];
}

export function percorsoDestinazione(edge: Filo): string[] {
    return edge.targetPercorso ?? [];
}

// Chiave di una porta dentro il suo nodo: l'id del requisito, preceduto dal percorso per una porta propagata.
// È anche la chiave di node.pinPositions per il lato della porta
export function chiavePorta(reqId: string, percorso: readonly string[] = []): string {
    return percorso.length ? `${percorso.join('/')}:${reqId}` : reqId;
}

export function stessoPercorso(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
    const x = a ?? [];
    const y = b ?? [];
    return x.length === y.length && x.every((v, i) => v === y[i]);
}

function etichettaNodo(n: Nodo): string {
    return n.label || n.id;
}

// Estremi 'node' usati dai fili di un livello: "nodo|chiavePorta"
export function estremiUsati(graph: Grafo): Set<string> {
    const usati = new Set<string>();
    const segna = (tipo: TipoEstremo, nodo: string, reqId: string, percorso: string[]) => {
        if (tipo === 'node') usati.add(`${nodo}|${chiavePorta(reqId, percorso)}`);
    };
    (graph.edges ?? []).forEach((e) => {
        segna(e.sourceType, e.source, e.sourceHandle, percorsoSorgente(e));
        segna(e.targetType, e.target, e.targetHandle, percorsoDestinazione(e));
    });
    return usati;
}

// Le porte che il nodo mostra sul bordo oltre ai suoi requisiti, nell'ordine dei nodi interni e dei loro requisiti
export function portePropagate(nodo: Nodo, libreria: Libreria, profondita = 0): PortaPropagata[] {
    const interno = nodo.internal_graph;
    if (!interno?.nodes?.length || profondita > PROFONDITA_MAX) return [];
    const usati = estremiUsati(interno);
    const esito: PortaPropagata[] = [];
    interno.nodes.forEach((figlio) => {
        const def = libreria[figlio.type];
        if (!def) return;
        const etichetta = etichettaNodo(figlio);
        const proprie: PortaPropagata[] = def.requisiti.filter(isInterfaccia)
            .map((req) => ({ reqId: req.id, percorso: [figlio.id], etichette: [etichetta], req, proprietario: figlio, def }));
        const salite = portePropagate(figlio, libreria, profondita + 1)
            .map((p) => ({ ...p, percorso: [figlio.id, ...p.percorso], etichette: [etichetta, ...p.etichette] }));
        [...proprie, ...salite].forEach((p) => {
            // Dentro il livello del figlio la porta ha il percorso senza il figlio stesso
            if (!usati.has(`${figlio.id}|${chiavePorta(p.reqId, p.percorso.slice(1))}`)) esito.push(p);
        });
    });
    return esito;
}

export interface PortaRisolta {
    req: RequisitoLibreria;
    proprietario: Nodo;
    def: Blocco;
    etichette: string[];
}

// Il requisito reqId del nodo raggiunto scendendo da nodo lungo percorso (vuoto = il nodo stesso), o null
export function risolviPorta(nodo: Nodo, reqId: string, percorso: readonly string[], libreria: Libreria): PortaRisolta | null {
    let corrente: Nodo | undefined = nodo;
    const etichette: string[] = [];
    for (const id of percorso) {
        corrente = corrente.internal_graph?.nodes?.find((n) => n.id === id);
        if (!corrente) return null;
        etichette.push(etichettaNodo(corrente));
    }
    const def = libreria[corrente.type];
    const req = def?.requisiti.find((r) => r.id === reqId);
    return def && req ? { req, proprietario: corrente, def, etichette } : null;
}

// Una porta propagata è ancora sul bordo del nodo: c'è ed è di interfaccia, e nessun filo la usa dentro
export function portaEsposta(nodo: Nodo, reqId: string, percorso: readonly string[], libreria: Libreria): boolean {
    if (!percorso.length) return true;
    const chiave = chiavePorta(reqId, percorso);
    return portePropagate(nodo, libreria).some((p) => chiavePorta(p.reqId, p.percorso) === chiave);
}

// Perché un estremo con percorso non va (null se va bene); il messaggio finisce in Coerenza e nell'ispettore
export function motivoPortaNonValida(nodo: Nodo, reqId: string, percorso: readonly string[], libreria: Libreria): string | null {
    if (!percorso.length) return null;
    const risolta = risolviPorta(nodo, reqId, percorso, libreria);
    if (!risolta) return `La porta interna ${reqId} non c'è più dentro "${etichettaNodo(nodo)}".`;
    if (!isInterfaccia(risolta.req)) return `Il requisito ${reqId} non è più di interfaccia: non sale sul bordo di "${etichettaNodo(nodo)}".`;
    if (!portaEsposta(nodo, reqId, percorso, libreria)) {
        return `La porta ${reqId} di "${risolta.etichette.join(' › ')}" è già collegata dentro "${etichettaNodo(nodo)}": non è più sul suo bordo.`;
    }
    return null;
}
