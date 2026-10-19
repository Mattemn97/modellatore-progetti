/* --- BLOCCHI MATRIOSKA: L'INTERNO STANDARD DI UN BLOCCO DI LIBRERIA (spec 0034) --- */
// Funzioni pure sul modello: copia dell'interno di un'istanza per la libreria, controlli prima del salvataggio
// e costruzione dell'interno di una nuova istanza (id nuovi, fili e posizioni ripuliti, figli matrioska).

import { aggiornaRiferimentiRequisiti, isInterfaccia, verificaCompatibilita, type Estremo } from './model.js';
import { generaId } from './utils.js';
import { percorsoDestinazione, percorsoSorgente, risolviPorta } from './porte.js';
import { rimappaCavi } from './cavi.js';
import type { Filo, Grafo, Libreria, Nodo, Requisito, TipoEstremo } from './tipi.js';

// Oltre questa profondità un interno standard non si apre più (difesa contro i cicli)
const PROFONDITA_MAX = 12;

function vuoto(): Grafo {
    return { nodes: [], edges: [] };
}

export function copiaGrafo(g: Grafo): Grafo {
    return JSON.parse(JSON.stringify(g)) as Grafo;
}

function haContenuto(g: Grafo | undefined | null): g is Grafo {
    return !!g && ((g.nodes?.length ?? 0) > 0 || (g.edges?.length ?? 0) > 0);
}

function visitaLivelli(g: Grafo, azione: (livello: Grafo) => void): void {
    azione(g);
    (g.nodes ?? []).forEach((n) => { if (n.internal_graph) visitaLivelli(n.internal_graph, azione); });
}

// Blocchi e fili di tutti i livelli
export function riassuntoInterno(g: Grafo): { blocchi: number; fili: number } {
    let blocchi = 0;
    let fili = 0;
    visitaLivelli(g, (livello) => {
        blocchi += livello.nodes?.length ?? 0;
        fili += livello.edges?.length ?? 0;
    });
    return { blocchi, fili };
}

export function descriviRiassunto({ blocchi, fili }: { blocchi: number; fili: number }): string {
    return `${blocchi} ${blocchi === 1 ? 'blocco' : 'blocchi'}, ${fili} ${fili === 1 ? 'filo' : 'fili'}`;
}

// Tipi di blocco usati a qualsiasi profondità dell'interno
export function tipiNellInterno(g: Grafo): Set<string> {
    const tipi = new Set<string>();
    visitaLivelli(g, (livello) => (livello.nodes ?? []).forEach((n) => tipi.add(n.type)));
    return tipi;
}

export function tipiMancanti(g: Grafo, libreria: Libreria): string[] {
    return [...tipiNellInterno(g)].filter((t) => !libreria[t]).sort((a, b) => a.localeCompare(b, 'it'));
}

// Vero se l'interno contiene il blocco stesso, anche attraverso gli interni standard dei blocchi che contiene
export function contieneSeStesso(idBlocco: string, interno: Grafo, libreria: Libreria): boolean {
    const visti = new Set<string>();
    const visita = (g: Grafo): boolean => [...tipiNellInterno(g)].some((tipo) => {
        if (tipo === idBlocco) return true;
        if (visti.has(tipo)) return false;
        visti.add(tipo);
        const suo = libreria[tipo]?.interno;
        return !!suo && visita(suo);
    });
    return visita(interno);
}

// Blocchi della libreria che hanno il blocco tipo nel loro interno standard
export function interniCheUsano(tipo: string, libreria: Libreria): string[] {
    return Object.values(libreria)
        .filter((b) => b.id !== tipo && b.interno && tipiNellInterno(b.interno).has(tipo))
        .map((b) => b.titolo || b.id);
}

// Rinomine dei requisiti del blocco idBlocco dentro il suo interno standard (fili verso i blocchi tondi e posizioni).
// libreria: quella con il blocco già nella forma nuova. Restituisce l'interno aggiornato e i fili tolti
export function rinominaNellInterno(idBlocco: string, interno: Grafo, libreria: Libreria, rinomine: Record<string, string>): { interno: Grafo; filiTolti: number } {
    const copia = copiaGrafo(interno);
    const radice: Grafo = {
        nodes: [{ id: '__istanza__', type: idBlocco, label: '', width: 0, height: 0, position: { x: 0, y: 0 }, internal_graph: copia }],
        edges: []
    };
    const trovaPadre = (tipoPadre: string | null, reqId: string): Requisito | null =>
        (tipoPadre ? libreria[tipoPadre]?.requisiti.find((r) => r.id === reqId) : null) ?? null;
    const filiTolti = aggiornaRiferimentiRequisiti(radice, libreria, idBlocco, rinomine, trovaPadre);
    return { interno: radice.nodes[0]!.internal_graph, filiTolti };
}

export interface InternoIstanziato {
    grafo: Grafo;
    // Tipi dell'interno assenti dalla libreria: quei blocchi non si creano
    mancanti: string[];
    // Fili tolti perché un estremo non esiste più o non è più compatibile
    filiTolti: number;
}

function filtraMappa<V>(mappa: Record<string, V> | undefined, tieni: (id: string) => boolean): Record<string, V> | undefined {
    if (!mappa) return undefined;
    const risultato = Object.fromEntries(Object.entries(mappa).filter(([id]) => tieni(id)));
    return Object.keys(risultato).length ? risultato : undefined;
}

/**
 * Interno di una nuova istanza del blocco tipo, con id nuovi (spec 0034, AC-4). idIstanza: l'id del nodo appena creato,
 * che diventa il proprietario dei blocchi tondi del suo interno. Un figlio con l'interno vuoto prende l'interno
 * standard del suo tipo, se c'è.
 */
// Id vecchio → nuovo di ogni nodo creato, livello per livello (per i percorsi delle porte propagate, spec 0035)
interface MappaId {
    id: string;
    sotto: Map<string, MappaId>;
}

// Un percorso di nodi interni con gli id nuovi, o null se un nodo non è stato creato
function rimappaPercorso(percorso: readonly string[], mappa: Map<string, MappaId> | undefined): string[] | null {
    const esito: string[] = [];
    let livello = mappa;
    for (const id of percorso) {
        const voce = livello?.get(id);
        if (!voce) return null;
        esito.push(voce.id);
        livello = voce.sotto;
    }
    return esito;
}

export function istanziaInterno(tipo: string, idIstanza: string, libreria: Libreria): InternoIstanziato {
    const mancanti = new Set<string>();
    let filiTolti = 0;

    function costruisci(tipoContenitore: string, sorgente: Grafo | undefined, idContenitore: string, profondita: number, catena: Set<string>): { grafo: Grafo; mappa: Map<string, MappaId> } {
        const nuoviId = new Map<string, MappaId>();
        if (!haContenuto(sorgente) || profondita > PROFONDITA_MAX) return { grafo: vuoto(), mappa: nuoviId };
        const requisitiContenitore = libreria[tipoContenitore]?.requisiti ?? [];
        const nodi: Nodo[] = [];

        (sorgente.nodes ?? []).forEach((n) => {
            const def = libreria[n.type];
            if (!def) {
                mancanti.add(n.type);
                return;
            }
            const id = generaId('node');
            const dentro = new Set([...catena, n.type]);
            const interno = haContenuto(n.internal_graph)
                ? costruisci(n.type, n.internal_graph, id, profondita + 1, dentro)
                : catena.has(n.type) ? { grafo: vuoto(), mappa: new Map<string, MappaId>() } : costruisci(n.type, def.interno, id, profondita + 1, dentro);
            nuoviId.set(n.id, { id, sotto: interno.mappa });
            const requisito = (reqId: string) => def.requisiti.find((r) => r.id === reqId);
            // Lati delle righe (spec 0035): del blocco, per i suoi requisiti, e delle porte propagate, con gli id nuovi
            const lati: Record<string, NonNullable<Nodo['pinPositions']>[string]> = {};
            Object.entries(n.pinPositions ?? {}).forEach(([chiave, valore]) => {
                const due = chiave.lastIndexOf(':');
                if (due < 0) {
                    if (requisito(chiave)) lati[chiave] = { ...valore };
                    return;
                }
                const nuovo = rimappaPercorso(chiave.slice(0, due).split('/'), interno.mappa);
                if (nuovo) lati[`${nuovo.join('/')}:${chiave.slice(due + 1)}`] = { ...valore };
            });
            const nodo: Nodo = {
                id, type: n.type, label: n.label, width: n.width, height: n.height,
                position: { x: n.position.x, y: n.position.y },
                internal_graph: interno.grafo,
                pinPositions: lati
            };
            const capacita = filtraMappa(n.capabilityPositions, (r) => { const req = requisito(r); return !!req && !isInterfaccia(req); });
            if (capacita) nodo.capabilityPositions = capacita;
            nodi.push(nodo);
        });

        const perId = new Map(nodi.map((n) => [n.id, n]));
        const estremo = (ownerType: TipoEstremo, ownerId: string, reqId: string, percorso: string[]): Estremo | null => {
            if (ownerType === 'parent') {
                const req = requisitiContenitore.find((r) => r.id === reqId) ?? null;
                return { ownerId: idContenitore, reqId, ownerType, req };
            }
            const voce = nuoviId.get(ownerId);
            const nodo = voce ? perId.get(voce.id) : undefined;
            if (!nodo || !voce) return null;
            if (percorso.length) {
                const nuovo = rimappaPercorso(percorso, voce.sotto);
                const risolta = nuovo ? risolviPorta(nodo, reqId, nuovo, libreria) : null;
                return nuovo && risolta ? { ownerId: nodo.id, reqId, ownerType, percorso: nuovo, req: risolta.req } : null;
            }
            const req = libreria[nodo.type]?.requisiti.find((r) => r.id === reqId) ?? null;
            return { ownerId: nodo.id, reqId, ownerType, req };
        };
        const fili: Filo[] = [];
        const nuoviFili = new Map<string, string>();
        (sorgente.edges ?? []).forEach((e) => {
            const a = estremo(e.sourceType, e.source, e.sourceHandle, percorsoSorgente(e));
            const b = estremo(e.targetType, e.target, e.targetHandle, percorsoDestinazione(e));
            if (!a || !b || !a.req || !b.req || verificaCompatibilita(a, b)) {
                filiTolti++;
                return;
            }
            const filo: Filo = {
                id: generaId('edge'),
                source: a.ownerId, sourceHandle: e.sourceHandle, sourceType: e.sourceType,
                target: b.ownerId, targetHandle: e.targetHandle, targetType: e.targetType,
                waypoints: (e.waypoints ?? []).map((p) => ({ x: p.x, y: p.y }))
            };
            if (a.percorso?.length) filo.sourcePercorso = a.percorso;
            if (b.percorso?.length) filo.targetPercorso = b.percorso;
            nuoviFili.set(e.id, filo.id);
            fili.push(filo);
        });

        const grafo: Grafo = { nodes: nodi, edges: fili, parentReqPositions: {} };
        // Cavi dell'interno (spec 0036, AC-8): con i nuovi id, un cavo senza uno dei due blocchi si scarta
        const cavi = rimappaCavi(sorgente.cavi, (id) => nuoviId.get(id)?.id, (id) => nuoviFili.get(id));
        if (cavi.length) grafo.cavi = cavi;
        Object.entries(sorgente.parentReqPositions ?? {}).forEach(([reqId, p]) => {
            if (requisitiContenitore.some((r) => r.id === reqId)) grafo.parentReqPositions![reqId] = { x: p.x, y: p.y };
        });
        return { grafo, mappa: nuoviId };
    }

    const { grafo } = costruisci(tipo, libreria[tipo]?.interno, idIstanza, 0, new Set([tipo]));
    return { grafo, mancanti: [...mancanti].sort((a, b) => a.localeCompare(b, 'it')), filiTolti };
}
