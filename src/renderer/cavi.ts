/* --- CAVI FISICI: REGOLE, SIGLE, PULIZIA, GEOMETRIA ED ELENCO (spec 0036) --- */
// Un cavo sta fra due blocchi dello stesso livello e contiene fili di interfaccia fra quei due blocchi.
// Lo strato logico (fili) non sa nulla dei cavi: i cavi riferiscono i fili per id.

import { isDerivazione, isInterfaccia } from './model.js';
import { percorsoDestinazione, percorsoSorgente, risolviPorta } from './porte.js';
import { ALTEZZA_TESTA } from './blocco.js';
import { instrada, type Direzione, type EstremoFilo, type Rettangolo } from './instradamento.js';
import { generaId } from './utils.js';
import type { ContestoFili } from './diagramma.js';
import type { Cavo, Filo, Grafo, Libreria, Punto, Requisito } from './tipi.js';

export function caviDi(graph: Grafo): Cavo[] {
    return graph.cavi ?? [];
}

function visita(radice: Grafo, azione: (graph: Grafo, percorso: string[], etichette: string[]) => void): void {
    const giu = (graph: Grafo, percorso: string[], etichette: string[]): void => {
        azione(graph, percorso, etichette);
        (graph.nodes ?? []).forEach((n) => {
            if (n.internal_graph) giu(n.internal_graph, [...percorso, n.id], [...etichette, n.label || n.id]);
        });
    };
    giu(radice, [], []);
}

function requisitoDelNodo(graph: Grafo, libreria: Libreria, nodeId: string, reqId: string, percorso: readonly string[]): Requisito | null {
    const nodo = graph.nodes.find((n) => n.id === nodeId);
    if (!nodo) return null;
    if (percorso.length) return risolviPorta(nodo, reqId, percorso, libreria)?.req ?? null;
    return libreria[nodo.type]?.requisiti.find((r) => r.id === reqId) ?? null;
}

const fraIBlocchi = (edge: Filo, da: string, a: string): boolean =>
    !isDerivazione(edge) && ((edge.source === da && edge.target === a) || (edge.source === a && edge.target === da));

// Un filo si può mettere in un cavo: fra due blocchi diversi del livello, con un requisito di interfaccia (AC-2)
export function filoCablabile(graph: Grafo, edge: Filo, libreria: Libreria): boolean {
    if (isDerivazione(edge) || edge.source === edge.target) return false;
    return isInterfaccia(requisitoDelNodo(graph, libreria, edge.source, edge.sourceHandle, percorsoSorgente(edge)))
        && isInterfaccia(requisitoDelNodo(graph, libreria, edge.target, edge.targetHandle, percorsoDestinazione(edge)));
}

export function filiFraBlocchi(graph: Grafo, libreria: Libreria, da: string, a: string): Filo[] {
    return graph.edges.filter((e) => fraIBlocchi(e, da, a) && filoCablabile(graph, e, libreria));
}

export function cavoDelFilo(graph: Grafo, edgeId: string): Cavo | null {
    return caviDi(graph).find((c) => c.fili.includes(edgeId)) ?? null;
}

// Prima sigla W001, W002… non usata in tutto il progetto
export function siglaLibera(radice: Grafo): string {
    const usate = new Set<string>();
    visita(radice, (g) => caviDi(g).forEach((c) => usate.add(c.sigla)));
    let n = 1;
    while (usate.has(`W${String(n).padStart(3, '0')}`)) n++;
    return `W${String(n).padStart(3, '0')}`;
}

// Nuovo cavo fra due blocchi del livello, con dentro i fili di interfaccia fra loro ancora senza cavo (AC-5)
export function creaCavo(radice: Grafo, graph: Grafo, libreria: Libreria, da: string, a: string): Cavo | null {
    if (da === a || !graph.nodes.some((n) => n.id === da) || !graph.nodes.some((n) => n.id === a)) return null;
    const fili = filiFraBlocchi(graph, libreria, da, a).filter((e) => !cavoDelFilo(graph, e.id)).map((e) => e.id);
    const cavo: Cavo = { id: generaId('cavo'), sigla: siglaLibera(radice), da, a, fili };
    (graph.cavi ??= []).push(cavo);
    return cavo;
}

// Mette il filo nel cavo (togliendolo da quello dove stava) o in nessuno con null
export function assegnaFilo(graph: Grafo, edgeId: string, cavoId: string | null): void {
    caviDi(graph).forEach((c) => { c.fili = c.fili.filter((id) => id !== edgeId); });
    const cavo = cavoId ? caviDi(graph).find((c) => c.id === cavoId) : null;
    if (cavo) cavo.fili.push(edgeId);
}

export function eliminaCavo(graph: Grafo, cavoId: string): void {
    graph.cavi = caviDi(graph).filter((c) => c.id !== cavoId);
    if (!graph.cavi.length) delete graph.cavi;
}

// Toglie in tutto il progetto i cavi con un blocco sparito e dai cavi i fili spariti o non più fra i due blocchi.
// Non guarda la libreria: un blocco di libreria mancante non deve svuotare i cavi. Vero se ha cambiato qualcosa
export function riallineaCavi(radice: Grafo): boolean {
    let cambiato = false;
    visita(radice, (graph) => {
        if (!graph.cavi) return;
        const nodi = new Set(graph.nodes.map((n) => n.id));
        const fili = new Map(graph.edges.map((e) => [e.id, e]));
        const usati = new Set<string>();
        const tenuti = graph.cavi.filter((c) => c.da !== c.a && nodi.has(c.da) && nodi.has(c.a));
        if (tenuti.length !== graph.cavi.length) cambiato = true;
        tenuti.forEach((c) => {
            const prima = c.fili.length;
            c.fili = c.fili.filter((id) => {
                const e = fili.get(id);
                const ok = !!e && !usati.has(id) && fraIBlocchi(e, c.da, c.a);
                if (ok) usati.add(id);
                return ok;
            });
            if (c.fili.length !== prima) cambiato = true;
        });
        if (tenuti.length) graph.cavi = tenuti;
        else delete graph.cavi;
    });
    return cambiato;
}

// Copia dei cavi di un interno di libreria con i nuovi id di nodi e fili (spec 0034, AC-8)
export function rimappaCavi(cavi: Cavo[] | undefined, nodo: (id: string) => string | undefined, filo: (id: string) => string | undefined): Cavo[] {
    return (cavi ?? []).flatMap((c) => {
        const da = nodo(c.da);
        const a = nodo(c.a);
        if (!da || !a) return [];
        return [{ ...c, id: generaId('cavo'), da, a, fili: c.fili.map(filo).filter((id): id is string => !!id) }];
    });
}

/* --- Geometria: un capo per lato del blocco, distribuiti lungo il bordo (AC-4) --- */

export interface EstremiCavo {
    da: EstremoFilo;
    a: EstremoFilo;
}

export function geometriaCavi(graph: Grafo, contesto: ContestoFili): Map<string, EstremiCavo> {
    const riquadri = new Map<string, Rettangolo>();
    graph.nodes.forEach((n) => {
        const f = contesto.forma(n.id);
        if (f) riquadri.set(n.id, { x1: n.position.x, y1: n.position.y, x2: n.position.x + f.larghezza, y2: n.position.y + f.altezza });
    });
    const centro = (r: Rettangolo): Punto => ({ x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 });
    // Capi per "nodo|lato", ordinati per l'altezza dell'altro blocco così i cavi non si incrociano all'uscita
    const gruppi = new Map<string, Array<{ id: string; capo: 'da' | 'a'; ordine: number }>>();
    const metti = (nodeId: string, lato: Direzione, voce: { id: string; capo: 'da' | 'a'; ordine: number }) => {
        const k = `${nodeId}|${lato}`;
        gruppi.set(k, [...(gruppi.get(k) ?? []), voce]);
    };
    caviDi(graph).forEach((c) => {
        const ra = riquadri.get(c.da);
        const rb = riquadri.get(c.a);
        if (!ra || !rb || c.da === c.a) return;
        const ca = centro(ra);
        const cb = centro(rb);
        metti(c.da, cb.x < ca.x ? 'sinistra' : 'destra', { id: c.id, capo: 'da', ordine: cb.y });
        metti(c.a, ca.x <= cb.x ? 'sinistra' : 'destra', { id: c.id, capo: 'a', ordine: ca.y });
    });
    const capi = new Map<string, Partial<EstremiCavo>>();
    gruppi.forEach((lista, k) => {
        const [nodeId, lato] = k.split('|') as [string, Direzione];
        const r = riquadri.get(nodeId)!;
        lista.sort((x, y) => x.ordine - y.ordine || x.id.localeCompare(y.id));
        const alto = r.y2 - r.y1;
        const inizio = alto - ALTEZZA_TESTA >= 20 ? r.y1 + ALTEZZA_TESTA : r.y1;
        const tratto = r.y2 - inizio;
        lista.forEach((v, i) => {
            const punto = { x: lato === 'sinistra' ? r.x1 : r.x2, y: Math.round(inizio + (tratto * (i + 1)) / (lista.length + 1)) };
            const voce = capi.get(v.id) ?? {};
            voce[v.capo] = { punto, direzione: lato, proprio: r };
            capi.set(v.id, voce);
        });
    });
    const esito = new Map<string, EstremiCavo>();
    capi.forEach((v, id) => { if (v.da && v.a) esito.set(id, { da: v.da, a: v.a }); });
    return esito;
}

export function percorsoCavo(estremi: EstremiCavo, contesto: ContestoFili): Punto[] {
    return instrada(estremi.da, estremi.a, contesto.ostacoli, contesto.margine);
}

/* --- Elenco del pannello Cavi e conteggi della Dashboard (AC-7) --- */

export interface RigaCavo {
    chiave: string;
    percorso: string[];
    livello: string;
    cavo: Cavo;
    da: string;
    a: string;
    // Un filo per voce: "requisito di partenza ↔ requisito di arrivo"
    fili: string[];
}

export function elencoCavi(radice: Grafo, nomeRadice = 'Radice'): RigaCavo[] {
    const righe: RigaCavo[] = [];
    visita(radice, (graph, percorso, etichette) => {
        const nome = (id: string) => { const n = graph.nodes.find((x) => x.id === id); return n ? n.label || n.id : id; };
        const fili = new Map(graph.edges.map((e) => [e.id, e]));
        caviDi(graph).forEach((cavo) => righe.push({
            chiave: [...percorso, cavo.id].join('/'),
            percorso,
            livello: etichette.length ? etichette.join(' › ') : nomeRadice,
            cavo,
            da: nome(cavo.da),
            a: nome(cavo.a),
            fili: cavo.fili.map((id) => fili.get(id)).filter((e): e is Filo => !!e)
                .map((e) => (e.source === cavo.da ? `${e.sourceHandle} ↔ ${e.targetHandle}` : `${e.targetHandle} ↔ ${e.sourceHandle}`))
        }));
    });
    return righe;
}

// Fili di interfaccia fra blocchi in tutto il progetto e quanti stanno in un cavo
export function statoCablaggio(radice: Grafo, libreria: Libreria): { cavi: number; cablabili: number; cablati: number } {
    let cavi = 0;
    let cablabili = 0;
    let cablati = 0;
    visita(radice, (graph) => {
        cavi += caviDi(graph).length;
        const dentro = new Set(caviDi(graph).flatMap((c) => c.fili));
        graph.edges.forEach((e) => {
            if (!filoCablabile(graph, e, libreria)) return;
            cablabili++;
            if (dentro.has(e.id)) cablati++;
        });
    });
    return { cavi, cablabili, cablati };
}
