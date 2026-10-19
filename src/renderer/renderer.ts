/* --- MOTORE DI RENDERING, ZOOM/PAN, BLOCCHI TONDI DEL PADRE E COLLEGAMENTI --- */
// Dalla spec 0035 la lavagna ha lo stile dell'IDV Interface Manager: blocchi come componenti con intestazione e una
// riga per requisito, porte ai lati, fili tratteggiati per classe con l'etichetta, legenda e strumenti di vista.

import { appState, pathStack, getCurrentLevel, activeNodeId, setActiveNodeId, appSettings } from './state.js';
import { selectNode, mostraDettaglioCliente, mostraDettaglioCollegamento, aggiornaDettaglioCollegamento, chiudiDettaglioCollegamento } from './inspector.js';
import { renderUI } from './app.js';
import { pianificaSalvataggio } from './progetto.js';
import { segnaSchedaClienteDaAggiornare } from './cliente.js';
import { segnaMatriceDaAggiornare } from './matrice.js';
import { segnaDocumentiDaAggiornare } from './documenti.js';
import { coerenzaAttiva, aggiornaCoerenza, problemaPin, contatoreBlocco, segnaSchedaCoerenzaDaAggiornare } from './coerenza.js';
import {
    gerarchiaAttiva, segnaGerarchiaDaRicalcolare, segnaSchedaGerarchiaDaAggiornare, catenaAttiva, filoInCatena,
    filiInCatena, occorrenzaInCatena, contatoreGerarchia, coloreCatena, chiaveSulCanvas, scegliDaCanvas
} from './gerarchia.js';
import {
    isInterfaccia, isRequisitoCliente, getClasseRequisito, getColoreRequisito, descriviRequisito,
    verificaCollegamento, isDerivazione, requisitoPadre, requisitiPadre, titoloRequisito, ID_CLIENTE, type Estremo
} from './model.js';
import { escapeHtml, generaId } from './utils.js';
import {
    contestoFili, percorsoFilo, posizioneInColonna as posizioneInColonnaDiagramma, puntoEtichetta, stileFilo, testoEtichetta,
    type ContestoFili
} from './diagramma.js';
import {
    ALTEZZA_RIGA, ALTEZZA_TESTA, coloreDaTesto, formaBlocco, larghezzaTesto, latoDalPunto, puntoRigaRelativo, siglaClasse,
    tagliaTesto, type FormaBlocco, type RigaBlocco
} from './blocco.js';
import { chiavePorta, estremiUsati, percorsoDestinazione, percorsoSorgente, risolviPorta } from './porte.js';
import { trattoPiuVicino } from './instradamento.js';
import { filtriAttivi, modoNascondi, requisitoIncluso, bloccoPassa, bloccoIncluso, aggiornaRiepilogoFiltri } from './filtri.js';
import { segnaTabelleDaAggiornare } from './tabelle.js';
import type { Blocco, EstremoDescritto, Filo, Grafo, Nodo, Punto, Requisito, TipoEstremo } from './tipi.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('workspaceSvg') as unknown as SVGSVGElement;
const viewport = document.getElementById('viewport') as unknown as SVGGElement;
const nodesLayer = document.getElementById('nodesLayer') as unknown as SVGGElement;
const edgesLayer = document.getElementById('edgesLayer') as unknown as SVGGElement;
const parentLayer = document.getElementById('parentLayer') as unknown as SVGGElement;
const labelsLayer = document.getElementById('labelsLayer') as unknown as SVGGElement | null;

interface Proprietario {
    ownerId: string;
    ownerType: TipoEstremo;
    // Porta propagata (spec 0035): nodi interni fino al proprietario del requisito
    percorso?: string[];
}

export let isDrawingEdge = false;
export let edgeStartData: (Proprietario & { reqId: string; x: number; y: number }) | null = null;
let tempEdgePath: SVGPathElement | null = null;

// Gestione Zoom e Pan
export let zoomState = { scale: 1, x: 0, y: 0 };
let isPanning = false;
let startPan = { x: 0, y: 0 };

// Requisito cliente evidenziato sul canvas dal dettaglio nell'ispettore
let idClienteEvidenziato: string | null = null;

// Contesto dei fili dell'ultimo disegno: forme dei blocchi, lati delle porte, percorsi (spec 0033, 0035)
let contestoCorrente: ContestoFili | null = null;

/* --- VISTA DELLA LAVAGNA: SOLO PREFERENZE DI QUESTO PC, MAI NEL PROGETTO (spec 0035) --- */

const CHIAVE_VISTA = 'modellatore.vistaLavagna';
const vista = { etichette: true, legenda: true };

function leggiVista(): void {
    try {
        const v = JSON.parse(localStorage.getItem(CHIAVE_VISTA) || '{}') as Partial<typeof vista>;
        if (typeof v.etichette === 'boolean') vista.etichette = v.etichette;
        if (typeof v.legenda === 'boolean') vista.legenda = v.legenda;
    } catch {
        // Preferenze illeggibili: quelle predefinite
    }
}

function scriviVista(): void {
    try {
        localStorage.setItem(CHIAVE_VISTA, JSON.stringify(vista));
    } catch {
        // Senza localStorage la scelta vale fino alla chiusura
    }
}

export function commutaVista(chiave: keyof typeof vista): void {
    vista[chiave] = !vista[chiave];
    scriviVista();
    render();
}

export function vistaAttiva(chiave: keyof typeof vista): boolean {
    return vista[chiave];
}

leggiVista();

/* --- FILO SELEZIONATO (spec 0009): per id, mai per oggetto --- */

// { percorso: id dei livelli aperti uniti da '/', edgeId }
let filoSelezionato: { percorso: string; edgeId: string } | null = null;
let dettaglioFiloRichiesto = false;

function percorsoLivello(): string {
    return pathStack.map((l) => l.id).join('/');
}

export function filoSelezionatoId(): string | null {
    return filoSelezionato && filoSelezionato.percorso === percorsoLivello() ? filoSelezionato.edgeId : null;
}

// Restituisce vero se c'era un filo selezionato (chi chiama decide se ridisegnare)
export function togliSelezioneFilo(): boolean {
    const cera = filoSelezionato !== null;
    filoSelezionato = null;
    return cera;
}

export function selezionaFilo(edgeId: string): void {
    const edge = getCurrentLevel().graph.edges.find((e) => e.id === edgeId);
    if (!edge) return;
    filoSelezionato = { percorso: percorsoLivello(), edgeId };
    setActiveNodeId(null);
    evidenziaCliente(null);
    mostraDettaglioCollegamento(edge);
    render();
}

// Toglie un filo dal livello: usata dal clic destro e dal pulsante dell'ispettore
export function eliminaFilo(graph: Grafo, edgeId: string): void {
    graph.edges = graph.edges.filter((e) => e.id !== edgeId);
    if (filoSelezionato?.edgeId === edgeId) {
        filoSelezionato = null;
        chiudiDettaglioCollegamento(edgeId);
    }
    render();
}

// Reinstrada (spec 0033, AC-5): toglie gli snodi messi a mano e lascia il percorso all'app
export function reinstradaFilo(edgeId: string): void {
    const edge = getCurrentLevel().graph.edges.find((e) => e.id === edgeId);
    if (!edge || !edge.waypoints?.length) return;
    edge.waypoints = [];
    render();
}

export function reinstradaLivello(): void {
    const aMano = getCurrentLevel().graph.edges.filter((e) => e.waypoints?.length);
    if (!aMano.length) {
        alert('Nessun filo con punti messi a mano in questo livello.');
        return;
    }
    const quanti = aMano.length === 1 ? '1 filo' : `${aMano.length} fili`;
    if (!confirm(`Togliere i punti messi a mano da ${quanti} di questo livello?`)) return;
    aMano.forEach((e) => { e.waypoints = []; });
    render();
}

// A ogni disegno: un filo sparito (Annulla, Ricarica, cambio livello) si deseleziona; altrimenti il dettaglio si
// riallinea al più una volta per fotogramma (AC-6)
function risolviFiloSelezionato(graph: Grafo): void {
    if (!filoSelezionato) return;
    const id = filoSelezionatoId();
    const edge = id ? graph.edges.find((e) => e.id === id) : null;
    if (!edge) {
        const vecchio = filoSelezionato.edgeId;
        filoSelezionato = null;
        chiudiDettaglioCollegamento(vecchio);
        return;
    }
    if (dettaglioFiloRichiesto) return;
    dettaglioFiloRichiesto = true;
    requestAnimationFrame(() => {
        dettaglioFiloRichiesto = false;
        const idOra = filoSelezionatoId();
        const edgeOra = idOra ? getCurrentLevel().graph.edges.find((e) => e.id === idOra) : null;
        if (edgeOra) aggiornaDettaglioCollegamento(edgeOra);
    });
}

export function evidenziaCliente(id: string | null): void {
    idClienteEvidenziato = id;
}

/* --- ZOOM, PAN, ADATTA --- */

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;

// Sposta la vista (zoom invariato) per mettere al centro il punto x, y del canvas
export function centraVista(x: number, y: number): void {
    const rect = svg.getBoundingClientRect();
    zoomState.x = rect.width / 2 - x * zoomState.scale;
    zoomState.y = rect.height / 2 - y * zoomState.scale;
    updateViewportTransform();
}

export function resetView(): void {
    zoomState = { scale: 1, x: 0, y: 0 };
    updateViewportTransform();
}

// Zoom di un fattore intorno al centro della lavagna (pulsanti − e +)
export function zoomaDi(fattore: number): void {
    const rect = svg.getBoundingClientRect();
    zoomaIntorno(fattore, rect.width / 2, rect.height / 2);
}

function zoomaIntorno(fattore: number, mx: number, my: number): void {
    const nuova = Math.min(Math.max(ZOOM_MIN, zoomState.scale * fattore), ZOOM_MAX);
    zoomState.x = mx - (mx - zoomState.x) * (nuova / zoomState.scale);
    zoomState.y = my - (my - zoomState.y) * (nuova / zoomState.scale);
    zoomState.scale = nuova;
    updateViewportTransform();
}

// Adatta: tutto il livello aperto nella finestra, con un margine, senza ingrandire oltre il 150%
export function adattaVista(): void {
    const livello = getCurrentLevel();
    const contesto = contestoCorrente ?? contestoFili(livello.graph, livello.parentNode, appState.library, appState.cliente);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    contesto.ostacoli.forEach((r) => {
        x1 = Math.min(x1, r.x1 - 10); y1 = Math.min(y1, r.y1); x2 = Math.max(x2, r.x2 + 10); y2 = Math.max(y2, r.y2);
    });
    livello.graph.edges.forEach((e) => (e.waypoints ?? []).forEach((p) => {
        x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
    }));
    if (x1 === Infinity) {
        resetView();
        return;
    }
    const rect = svg.getBoundingClientRect();
    const margine = 40;
    const scala = Math.min(1.5, Math.max(ZOOM_MIN, Math.min((rect.width - margine * 2) / (x2 - x1 || 1), (rect.height - margine * 2) / (y2 - y1 || 1))));
    zoomState.scale = scala;
    zoomState.x = (rect.width - (x2 - x1) * scala) / 2 - x1 * scala;
    zoomState.y = (rect.height - (y2 - y1) * scala) / 2 - y1 * scala;
    updateViewportTransform();
}

function updateViewportTransform(): void {
    viewport.setAttribute('transform', `translate(${zoomState.x}, ${zoomState.y}) scale(${zoomState.scale})`);
    const etichetta = document.getElementById('etichettaZoom');
    if (etichetta) etichetta.textContent = `${Math.round(zoomState.scale * 100)}%`;
    // La griglia a puntini segue zoom e pan
    const griglia = document.getElementById('grid');
    const passo = appSettings ? appSettings.grid.size : 20;
    if (griglia) {
        const lato = passo * zoomState.scale;
        griglia.setAttribute('width', String(lato));
        griglia.setAttribute('height', String(lato));
        griglia.setAttribute('x', String(zoomState.x % lato));
        griglia.setAttribute('y', String(zoomState.y % lato));
        const punto = griglia.querySelector('circle');
        if (punto) {
            punto.setAttribute('cx', String(lato / 2));
            punto.setAttribute('cy', String(lato / 2));
            punto.setAttribute('r', String(Math.max(0.6, Math.min(1.4, zoomState.scale))));
        }
    }
}

function creaSvg<K extends keyof SVGElementTagNameMap>(tag: K, attributi: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributi).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
}

function testoSvg(testo: string, attributi: Record<string, string | number>): SVGTextElement {
    const t = creaSvg('text', attributi);
    t.textContent = testo;
    return t;
}

function aggiungiTooltip(el: SVGElement, testo: string): void {
    const title = creaSvg('title');
    title.textContent = testo;
    el.appendChild(title);
}

// Eventi Zoom con Rotella e Pan con Click Centrale / Trascinamento Canvas
svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    zoomaIntorno(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top);
});

// Clic sullo sfondo senza spostarsi: toglie la selezione del filo (il pan non la toglie)
let premutoSfondo: Punto | null = null;

svg.addEventListener('mouseup', (e) => {
    const p = premutoSfondo;
    premutoSfondo = null;
    if (!p || !filoSelezionato) return;
    if (Math.abs(e.clientX - p.x) > 3 || Math.abs(e.clientY - p.y) > 3) return;
    const vecchio = filoSelezionato.edgeId;
    filoSelezionato = null;
    chiudiDettaglioCollegamento(vecchio);
    render();
});

svg.addEventListener('mousedown', (e) => {
    const bersaglio = e.target as Element;
    if (e.button === 1 || bersaglio === svg || bersaglio.id === 'gridBackground') { // Tasto centrale o sfondo
        if (e.button === 0) premutoSfondo = { x: e.clientX, y: e.clientY };
        isPanning = true;
        startPan = { x: e.clientX - zoomState.x, y: e.clientY - zoomState.y };
        svg.classList.add('in-pan');
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        zoomState.x = e.clientX - startPan.x;
        zoomState.y = e.clientY - startPan.y;
        updateViewportTransform();
    }
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    svg.classList.remove('in-pan');
});

/* --- RICERCA DEI REQUISITI NEL LIVELLO CORRENTE --- */

function getBlockDef(type: string | null | undefined): Blocco | null {
    return (type ? appState.library[type] : null) || null;
}

// Tipo del padre del livello corrente: null alla radice, dove il padre sono i requisiti cliente
function tipoPadreCorrente(): string | null {
    return getCurrentLevel().parentNode?.type ?? null;
}

// Requisito di un estremo: ownerType 'parent' = requisito del blocco che contiene il livello corrente;
// con un percorso, il requisito del blocco interno di una porta propagata (spec 0035)
function trovaRequisito(ownerId: string, reqId: string, ownerType: TipoEstremo, percorso: readonly string[] = []): Requisito | null {
    if (ownerType === 'parent') return requisitoPadre(tipoPadreCorrente(), reqId);
    const nodo = getCurrentLevel().graph.nodes.find((n) => n.id === ownerId);
    if (!nodo) return null;
    if (percorso.length) return risolviPorta(nodo, reqId, percorso, appState.library)?.req ?? null;
    return getBlockDef(nodo.type)?.requisiti.find((r) => r.id === reqId) || null;
}

// Estremo di un filo del livello corrente per l'ispettore dei collegamenti (spec 0009): requisito, nodo e definizione,
// o mancante. I campi ownerId, reqId, ownerType servono a verificaCompatibilita()
export function descriviEstremo(ownerId: string, reqId: string, ownerType: TipoEstremo, percorso: string[] = []): EstremoDescritto {
    const base = { ownerId, reqId, ownerType, ...(percorso.length ? { percorso } : {}) };
    if (ownerType === 'parent') {
        const parentNode = getCurrentLevel().parentNode || null;
        const req = requisitoPadre(tipoPadreCorrente(), reqId);
        return req ? { ...base, req, tondo: true, cliente: !parentNode, parentNode } : { ...base, mancante: true };
    }
    const nodo = getCurrentLevel().graph.nodes.find((n) => n.id === ownerId) || null;
    const def = nodo ? getBlockDef(nodo.type) : null;
    if (nodo && def && percorso.length) {
        const risolta = risolviPorta(nodo, reqId, percorso, appState.library);
        return risolta
            ? { ...base, req: risolta.req, nodo, def, tondo: false, cliente: false, proprietario: risolta.proprietario, defProprietario: risolta.def, etichettePercorso: risolta.etichette }
            : { ...base, mancante: true };
    }
    const req = def?.requisiti.find((r) => r.id === reqId) || null;
    return req && nodo && def ? { ...base, req, nodo, def, tondo: false, cliente: false } : { ...base, mancante: true };
}

// Centro di un blocco del livello aperto (per centrare la vista su un problema o una ricerca)
export function centroNodo(node: Nodo): Punto {
    const def = getBlockDef(node.type);
    const forma = def ? formaBlocco(node, def, appState.library, appSettings) : null;
    const w = forma?.larghezza ?? (node.width || appSettings.node.width);
    const h = forma?.altezza ?? (node.height || appSettings.node.height);
    return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
}

/* --- FILTRI (spec 0008): COSA È INCLUSO NEL LIVELLO --- */

const chiaveEstremo = (ownerType: TipoEstremo, ownerId: string, reqId: string, percorso: readonly string[] = []) =>
    `${ownerType}:${ownerId}:${chiavePorta(reqId, percorso)}`;

interface Inclusi {
    estremi: Set<string>;
    nodi: Set<string>;
    fili: Set<string>;
}

// Inclusi del livello, una volta per disegno: estremi (pin e blocchi tondi), nodi e fili. Funzione pura
function calcolaInclusi(graph: Grafo, parentNode: Nodo | null, contesto: ContestoFili): Inclusi {
    const tutti = filtriAttivi() === 0;
    const estremi = new Set<string>();
    const nodi = new Set<string>();
    const fili = new Set<string>();
    // Blocchi tondi: solo i filtri di requisito, mai quelli di blocco (AC-5)
    const tondi: Requisito[] = parentNode ? getBlockDef(parentNode.type)?.requisiti || [] : requisitiPadre(null);
    const ownerTondi = parentNode ? parentNode.id : ID_CLIENTE;
    tondi.forEach((req) => {
        if (tutti || requisitoIncluso(req)) estremi.add(chiaveEstremo('parent', ownerTondi, req.id));
    });
    (graph.nodes || []).forEach((node) => {
        const def = getBlockDef(node.type);
        if (!def) return;
        if (tutti || bloccoIncluso(def)) nodi.add(node.id);
        const passa = tutti || bloccoPassa(def);
        // Le righe del blocco: i suoi requisiti e le porte propagate dall'interno
        (contesto.forma(node.id)?.righe ?? []).forEach((riga) => {
            if (passa && (tutti || requisitoIncluso(riga.req))) estremi.add(chiaveEstremo('node', node.id, riga.reqId, riga.percorso));
        });
    });
    // Un filo è incluso se almeno un estremo lo è; un estremo che non si trova non conta (AC-5, AC-10)
    (graph.edges || []).forEach((edge) => {
        if (estremi.has(chiaveEstremo(edge.sourceType, edge.source, edge.sourceHandle, percorsoSorgente(edge)))
            || estremi.has(chiaveEstremo(edge.targetType, edge.target, edge.targetHandle, percorsoDestinazione(edge)))) fili.add(edge.id);
    });
    return { estremi, nodi, fili };
}

// Inclusi del disegno in corso e fili disegnati (per Nascondi: gli estremi dei fili disegnati restano)
let inclusi: Inclusi = { estremi: new Set(), nodi: new Set(), fili: new Set() };
let estremiDisegnati = new Set<string>();
// Porte con almeno un filo nel livello (quadratino pieno): "nodo|chiavePorta"
let porteCollegate = new Set<string>();
// Porte senza filo qui ma collegate a un livello sopra, salendo sul bordo dei contenitori (spec 0035)
let porteSopra = new Set<string>();

function estremoIncluso(ownerType: TipoEstremo, ownerId: string, reqId: string, percorso: readonly string[] = []): boolean {
    return inclusi.estremi.has(chiaveEstremo(ownerType, ownerId, reqId, percorso));
}

export function render(): void {
    if (!appSettings) return;
    // Ogni mutazione del modello passa di qui: parte (o riparte) l'attesa del salvataggio automatico
    pianificaSalvataggio();
    // Controllo di coerenza: calcolo puro sul modello di adesso, letto da evidenze, contatori e scheda
    if (coerenzaAttiva()) aggiornaCoerenza();
    // Gerarchia: indice e catena si rifanno al massimo una volta per fotogramma (spec 0005)
    if (gerarchiaAttiva()) segnaGerarchiaDaRicalcolare();

    updateViewportTransform();

    const currentLevel = getCurrentLevel();
    const currentGraph = currentLevel.graph;

    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    parentLayer.innerHTML = '';
    if (labelsLayer) labelsLayer.innerHTML = '';

    risolviFiloSelezionato(currentGraph);

    // Forme dei blocchi, lati delle porte e percorsi dei fili: una volta per disegno (spec 0033, 0035)
    const contesto = contestoFili(currentGraph, currentLevel.parentNode, appState.library, appState.cliente);
    contestoCorrente = contesto;
    porteCollegate = estremiUsati(currentGraph);
    porteSopra = new Set();
    if (pathStack.length > 1) {
        currentGraph.nodes.forEach((n) => (contesto.forma(n.id)?.righe ?? []).forEach((r) => {
            const k = `${n.id}|${r.chiave}`;
            if (r.interfaccia && !porteCollegate.has(k) && collegataSopra(n.id, r.reqId, r.percorso)) porteSopra.add(k);
        }));
    }

    // FILTRI: inclusi del livello, poi cosa si disegna (spec 0008, AC-5, AC-6, AC-11)
    inclusi = calcolaInclusi(currentGraph, currentLevel.parentNode, contesto);
    const nascondi = modoNascondi();
    const filiCatena = filiInCatena(currentGraph);
    // Un filo senza requisito di partenza non si è mai disegnato
    const candidati = currentGraph.edges.filter((edge) => trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType, percorsoSorgente(edge)));
    const daDisegnare = candidati.filter((edge) => !nascondi || inclusi.fili.has(edge.id) || filiCatena.has(edge.id));
    estremiDisegnati = new Set();
    daDisegnare.forEach((edge) => {
        estremiDisegnati.add(chiaveEstremo(edge.sourceType, edge.source, edge.sourceHandle, percorsoSorgente(edge)));
        estremiDisegnati.add(chiaveEstremo(edge.targetType, edge.target, edge.targetHandle, percorsoDestinazione(edge)));
    });
    const nodiDiFili = new Set<string>();
    daDisegnare.forEach((edge) => {
        if (edge.sourceType === 'node') nodiDiFili.add(edge.source);
        if (edge.targetType === 'node') nodiDiFili.add(edge.target);
    });

    if (currentLevel.parentNode) {
        renderParentBlocks(currentLevel.parentNode, currentGraph);
    } else {
        renderBlocchiCliente(currentGraph);
    }

    // RENDER FILI (EDGES): percorsi automatici intorno ai blocchi o snodi messi a mano (spec 0033)
    daDisegnare.forEach((edge) => renderEdge(edge, currentGraph, contesto));

    // RENDER NODI: con Nascondi un blocco escluso resta se è nella catena o estremo di un filo disegnato
    let blocchiEsclusi = 0;
    currentGraph.nodes.forEach((node) => {
        const blockDef = getBlockDef(node.type);
        const forma = contesto.forma(node.id);
        if (!blockDef || !forma) return;
        const incluso = inclusi.nodi.has(node.id);
        if (!incluso) blocchiEsclusi++;
        if (nascondi && !incluso && !nodiDiFili.has(node.id) && !nodoNellaCatena(node, blockDef)) return;
        renderNode(node, blockDef, forma, contesto);
    });
    aggiornaRiepilogoFiltri(blocchiEsclusi, candidati.filter((e) => !inclusi.fili.has(e.id)).length);
    aggiornaLegenda(currentGraph, contesto, daDisegnare);
    aggiornaVuoto(currentGraph);
    aggiornaPulsantiVista();

    renderUI();
    // La scheda Cliente si aggiorna al massimo una volta per fotogramma, mai qui dentro
    segnaSchedaClienteDaAggiornare();
    segnaSchedaCoerenzaDaAggiornare();
    segnaSchedaGerarchiaDaAggiornare();
    // Matrice e Documenti come pannelli: ricalcolo differito dopo una raffica di modifiche (spec 0022)
    segnaMatriceDaAggiornare();
    segnaDocumentiDaAggiornare();
    // Tabelle e Dashboard (spec 0035): come la Matrice, solo se visibili
    segnaTabelleDaAggiornare();
}

// Percorso di un nodo del livello corrente: gli id dei livelli aperti più il suo
function percorsoNodo(node: Nodo): string[] {
    return [...pathStack.slice(1).map((l) => l.id), node.id];
}

// Un blocco con pin della catena della Gerarchia (spec 0005, AC-10)
function haPinInCatena(node: Nodo, blockDef: Blocco): boolean {
    return blockDef.requisiti.some((r) => occorrenzaInCatena(chiaveSulCanvas('node', node.id, r.id)));
}

// Pin della catena o occorrenze della catena nel contenuto: il blocco si disegna anche con Nascondi Non Coinvolti
function nodoNellaCatena(node: Nodo, blockDef: Blocco): boolean {
    if (!catenaAttiva()) return false;
    return haPinInCatena(node, blockDef) || contatoreGerarchia(percorsoNodo(node)) > 0;
}

function renderEdge(edge: Filo, currentGraph: Grafo, contesto: ContestoFili): void {
    if (!edge.waypoints) edge.waypoints = [];
    const points = percorsoFilo(edge, contesto);
    if (!points) return;

    const srcReq = trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType, percorsoSorgente(edge));
    const tgtReq = trovaRequisito(edge.target, edge.targetHandle, edge.targetType, percorsoDestinazione(edge));
    const edgeColor = getColoreRequisito(srcReq);
    const derivazione = isDerivazione(edge);
    const stile = stileFilo(edge, srcReq);
    const automatico = edge.waypoints.length === 0;
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Gerarchia con una scelta: i fili della catena evidenziati, tutti gli altri attenuati
    let classeCatena = '';
    if (catenaAttiva()) classeCatena = filoInCatena(currentGraph, edge.id) ? ' catena-gerarchia' : ' fuori-catena';
    // Senza catena attenua il filtro: un filo escluso si disegna solo con Attenua (spec 0008, AC-6)
    else if (!inclusi.fili.has(edge.id)) classeCatena = ' fuori-filtro';
    const selezionato = filoSelezionatoId() === edge.id;

    // Gruppo del filo: alone della selezione, area di presa larga e tratto visibile; i gestori stanno sul gruppo
    const g = creaSvg('g', { class: `link-g${selezionato ? ' selezionato' : ''}` });
    g.style.setProperty('--lc', edgeColor);
    if (selezionato) g.appendChild(creaSvg('path', { class: 'link-halo', d: pathData, stroke: edgeColor }));
    g.appendChild(creaSvg('path', { class: 'link-hit', d: pathData }));
    const path = creaSvg('path', {
        class: (derivazione ? 'edge-path edge-derivazione' : `edge-path edge-${stile}`) + (automatico ? ' filo-automatico' : ' filo-a-mano') + classeCatena + (selezionato ? ' filo-selezionato' : ''),
        d: pathData,
        stroke: edgeColor
    });
    g.appendChild(path);

    const relazione = derivazione ? 'Derivazione padre → figlio' : 'Collegamento tra blocchi';
    aggiungiTooltip(g,
        `${relazione} [${getClasseRequisito(srcReq)}]\n` +
        `${srcReq?.id ?? edge.sourceHandle} ${titoloRequisito(srcReq)} → ${tgtReq?.id ?? edge.targetHandle} ${titoloRequisito(tgtReq)}\n` +
        (automatico ? 'Percorso automatico · ' : 'Percorso a mano (Reinstrada per tornare automatico) · ') +
        'Clic: dettaglio · Doppio clic: aggiungi snodo · Clic destro: elimina');

    // Clic: seleziona il filo e ne mostra il dettaglio nell'ispettore (spec 0009)
    g.addEventListener('click', (e) => {
        e.stopPropagation();
        selezionaFilo(edge.id);
    });

    // Aggiungi Snodo con Doppio Clic, nel tratto più vicino. Un filo automatico diventa a mano con gli angoli
    // del percorso di adesso, così il disegno non salta (spec 0033, AC-4)
    g.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const coords = getCanvasCoords(e);
        const tratto = trattoPiuVicino(points, coords);
        // Per un filo a mano gli angoli sono i suoi snodi. Il tratto i va da points[i] a points[i+1]:
        // fra gli angoli il nuovo snodo va in posizione i
        const angoli = points.slice(1, -1).map((p) => ({ x: p.x, y: p.y }));
        angoli.splice(tratto, 0, { x: coords.x, y: coords.y });
        edge.waypoints = angoli;
        render();
    });

    // ELIMINAZIONE CAVO: Click Destro
    g.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Vuoi eliminare questo collegamento?')) eliminaFilo(currentGraph, edge.id);
    });

    edgesLayer.appendChild(g);

    edge.waypoints.forEach((wp, idx) => {
        const handle = creaSvg('circle', { cx: wp.x, cy: wp.y, r: 4.5, class: 'snodo-filo' });
        handle.style.setProperty('--lc', edgeColor);
        // Gli snodi seguono il filo (AC-11)
        if (classeCatena === ' fuori-catena' || classeCatena === ' fuori-filtro') handle.classList.add(classeCatena.trim());
        handle.addEventListener('mousedown', (e) => startWaypointDrag(e, wp));
        handle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            edge.waypoints.splice(idx, 1);
            render();
        });
        edgesLayer.appendChild(handle);
    });

    // Etichetta IDV a metà del tratto più lungo: id del requisito di partenza e classe (spec 0035)
    if (!vista.etichette || derivazione || !labelsLayer) return;
    const posto = puntoEtichetta(points);
    if (!posto) return;
    const { id, classe } = testoEtichetta(srcReq, edge);
    const largo = larghezzaTesto(id, 10, true, true) + larghezzaTesto(` ${classe}`, 10.5, true) + 12;
    const lbl = creaSvg('g', { class: `lbl ${stile}${selezionato ? ' selezionato' : ''}${classeCatena}`, transform: `translate(${posto.x - largo / 2}, ${posto.y - 8})` });
    lbl.style.setProperty('--lc', edgeColor);
    lbl.appendChild(creaSvg('rect', { width: largo, height: 16, rx: 2 }));
    const testo = creaSvg('text', { x: 6, y: 11.5 });
    const tid = creaSvg('tspan', { class: 'lbl-id' });
    tid.textContent = id;
    const tcl = creaSvg('tspan');
    tcl.textContent = ` ${classe}`;
    testo.append(tid, tcl);
    lbl.appendChild(testo);
    aggiungiTooltip(lbl, `${srcReq?.id ?? edge.sourceHandle} → ${tgtReq?.id ?? edge.targetHandle}\nClic: dettaglio del collegamento`);
    lbl.addEventListener('click', (e) => {
        e.stopPropagation();
        selezionaFilo(edge.id);
    });
    labelsLayer.appendChild(lbl);
}

/* --- BLOCCHI COME COMPONENTI IDV (spec 0035) --- */

// Seconda riga dell'intestazione: il tipo se l'etichetta è diversa, altrimenti l'interno o la descrizione
function sottotitoloBlocco(node: Nodo, def: Blocco): string {
    const interni = node.internal_graph?.nodes?.length ?? 0;
    const interno = interni ? `▸ ${interni} ${interni === 1 ? 'blocco' : 'blocchi'} dentro` : '';
    if ((node.label || '') !== def.titolo) return [`Tipo ${def.titolo}`, interno].filter(Boolean).join(' · ');
    return interno || def.descrizione || '';
}

function renderNode(node: Nodo, blockDef: Blocco, forma: FormaBlocco, contesto: ContestoFili): void {
    const { larghezza: w, altezza: h } = forma;
    const selezionato = activeNodeId === node.id;
    const g = creaSvg('g', { transform: `translate(${node.position.x}, ${node.position.y})`, class: `blocco-idv${selezionato ? ' selezionato' : ''}` });

    // Gerarchia: si attenua il corpo, mai il gruppo, così i pin della catena restano pieni
    const occorrenzeDentro = contatoreGerarchia(percorsoNodo(node));
    let attenua = '';
    if (catenaAttiva() && occorrenzeDentro === 0 && !haPinInCatena(node, blockDef)) attenua = 'fuori-catena';
    // Filtri: blocco escluso attenuato, i pin seguono solo la propria inclusione (spec 0008, AC-6, AC-11)
    else if (!catenaAttiva() && !inclusi.nodi.has(node.id)) attenua = 'fuori-filtro';
    const conAttenua = (el: SVGElement): SVGElement => {
        if (attenua) el.classList.add(attenua);
        return el;
    };

    g.appendChild(conAttenua(creaSvg('rect', { width: w, height: h, class: 'comp-body' })));
    const testa = conAttenua(creaSvg('rect', { width: w, height: ALTEZZA_TESTA, class: 'comp-head' }));
    // La descrizione sull'intestazione, mai dentro il testo del nome (il nome resta solo il nome)
    if (blockDef.descrizione) aggiungiTooltip(testa, blockDef.descrizione);
    g.appendChild(testa);

    const corpo = conAttenua(creaSvg('g', { class: 'corpo-blocco' }));
    // Badge con l'id del tipo di libreria, in alto a destra
    const badge = tagliaTesto(blockDef.id.toUpperCase(), 10.5, 70, true, true);
    const largoBadge = larghezzaTesto(badge, 10.5, true, true) + 10;
    const idb = creaSvg('g', { class: 'comp-idb', transform: `translate(${w - largoBadge - 8}, 6)` });
    idb.appendChild(creaSvg('rect', { width: largoBadge, height: 16, rx: 2 }));
    idb.appendChild(testoSvg(badge, { x: largoBadge / 2, y: 11.5, 'text-anchor': 'middle' }));
    corpo.appendChild(idb);
    // Categoria con il suo colore, e la seconda riga
    corpo.appendChild(creaSvg('rect', { x: 10, y: 26, width: 8, height: 8, rx: 1.5, fill: coloreDaTesto(blockDef.categoria || '-') }));
    const categoria = [blockDef.categoria, blockDef.sottocategoria].filter(Boolean).join(' · ') || 'Senza categoria';
    corpo.appendChild(testoSvg(tagliaTesto(categoria, 10.5, w - 34), { x: 22, y: 33.5, class: 'comp-meta' }));
    const sotto = sottotitoloBlocco(node, blockDef);
    if (sotto) corpo.appendChild(testoSvg(tagliaTesto(sotto, 10, w - 20), { x: 10, y: 45, class: 'comp-meta comp-meta-k' }));
    corpo.appendChild(creaSvg('line', { x1: 0, y1: ALTEZZA_TESTA, x2: w, y2: ALTEZZA_TESTA, class: 'comp-sep' }));

    if (!blockDef.requisiti.length) corpo.appendChild(testoSvg('Nessun requisito', { x: 12, y: ALTEZZA_TESTA + 14, class: 'port-none' }));
    if (forma.inizioPropagate !== null) {
        corpo.appendChild(creaSvg('line', { x1: 0, y1: forma.inizioPropagate, x2: w, y2: forma.inizioPropagate, class: 'comp-sep sep-propagate' }));
        corpo.appendChild(testoSvg('PORTE DAI BLOCCHI INTERNI', { x: 10, y: forma.inizioPropagate + 12.5, class: 'titolo-propagate' }));
    }
    forma.righe.forEach((riga, i) => corpo.appendChild(rigaBlocco(node, riga, i, w)));
    g.appendChild(corpo);

    // Nome del blocco (sopra le righe, per i test e la lettura)
    const largoNome = w - largoBadge - 26;
    g.appendChild(conAttenua(testoSvg(tagliaTesto(node.label || blockDef.titolo || node.id, 12.5, largoNome, true), { x: 10, y: 18, class: 'node-text' })));

    // Contorno: sopra le righe, sotto le porte
    const rect = conAttenua(creaSvg('rect', { width: w, height: h, class: 'node-rect' }));
    if (selezionato) {
        rect.style.stroke = appSettings.node.selectedBorderColor;
        rect.style.strokeWidth = '2.4px';
    }
    g.appendChild(rect);

    // Porte: una per riga, al lato salvato o verso l'altro capo del filo
    forma.righe.forEach((riga) => {
        const lato = contesto.lato(node.id, riga.chiave);
        const pos = puntoRigaRelativo(forma, riga, lato);
        const owner: Proprietario = { ownerId: node.id, ownerType: 'node', ...(riga.percorso.length ? { percorso: riga.percorso } : {}) };
        const chiave = `${node.id}|${riga.chiave}`;
        const pin = createReqPin(pos.x, pos.y, riga.req, owner, riga.interfaccia ? 'porta' : 'capacita', {
            collegato: porteCollegate.has(chiave) || porteSopra.has(chiave),
            sopra: porteSopra.has(chiave),
            propagata: riga.propagata,
            assoluto: { x: node.position.x + pos.x, y: node.position.y + pos.y },
            etichette: riga.etichette
        });
        pin.addEventListener('mousedown', (e) => {
            if (!e.shiftKey) return;
            e.stopPropagation();
            startPortaLatoDrag(node, forma, riga.chiave);
        });
        g.appendChild(pin);
    });

    // Maniglia per allargare il blocco (l'altezza la decidono le righe)
    const resizeHandle = creaSvg('rect', { x: w - 8, y: h - 8, width: 8, height: 8, class: 'node-resize-handle' });
    resizeHandle.addEventListener('mousedown', (e) => startResizeDrag(e, node));
    g.appendChild(resizeHandle);

    // Problemi di coerenza nel contenuto del blocco: contatore in alto a destra, trasparente al mouse
    const problemi = contatoreBlocco(node);
    if (problemi > 0) {
        const contatore = creaSvg('g', { class: 'contatore-coerenza', transform: `translate(${w}, 0)` });
        contatore.appendChild(creaSvg('circle', { r: 9 }));
        contatore.appendChild(testoSvg(problemi > 99 ? '99+' : String(problemi), { 'text-anchor': 'middle', y: 3.5 }));
        g.appendChild(contatore);
    }

    // Occorrenze della catena nel contenuto del blocco: contatore in alto a sinistra, nel colore della classe della scelta
    if (occorrenzeDentro > 0) {
        const contatore = creaSvg('g', { class: 'contatore-gerarchia' });
        contatore.appendChild(creaSvg('circle', { r: 9, fill: coloreCatena() }));
        contatore.appendChild(testoSvg(occorrenzeDentro > 99 ? '99+' : String(occorrenzeDentro), { 'text-anchor': 'middle', y: 3.5 }));
        g.appendChild(contatore);
    }

    g.addEventListener('mousedown', (e) => startDrag(e, node));
    g.addEventListener('dblclick', () => enterNode(node));
    g.addEventListener('click', (e) => { e.stopPropagation(); selectNode(node); });

    nodesLayer.appendChild(g);
}

// Una riga: id e titolo del requisito a sinistra, la sigla della classe a destra (righe alterne ombreggiate)
function rigaBlocco(node: Nodo, riga: RigaBlocco, indice: number, w: number): SVGGElement {
    const g = creaSvg('g', { class: `port-riga${riga.propagata ? ' propagata' : ''}` });
    g.appendChild(creaSvg('rect', { x: 0, y: riga.y - ALTEZZA_RIGA / 2, width: w, height: ALTEZZA_RIGA, class: `port-row${indice % 2 === 1 ? ' alt' : ''}` }));
    const sigla = siglaClasse(riga.req);
    const largoSigla = larghezzaTesto(sigla, 9, true, true);
    const largoId = larghezzaTesto(riga.reqId, 10.5, true, true);
    const titolo = riga.propagata ? `↳ ${riga.etichette.join(' › ')} · ${riga.req.titolo}` : riga.req.titolo;
    g.appendChild(testoSvg(riga.reqId, { x: 14, y: riga.y + 3.8, class: 'port-text port-id' }));
    g.appendChild(testoSvg(tagliaTesto(titolo, 11, w - largoId - largoSigla - 44), { x: 20 + largoId, y: riga.y + 3.8, class: 'port-text' }));
    g.appendChild(testoSvg(sigla, { x: w - 14, y: riga.y + 3.2, 'text-anchor': 'end', class: 'port-type' }));
    const dove = riga.propagata ? `\nSale da: ${riga.etichette.join(' › ')} (dentro ${node.label || node.id})` : '';
    aggiungiTooltip(g, descriviRequisito(riga.req) + dove);
    return g;
}

/* --- BLOCCHI TONDI: I REQUISITI DEL BLOCCO PADRE VISTI DALL'INTERNO --- */

interface OpzioniBloccoTondo {
    etichetta: string;
    sottotitolo: string;
    tooltip: string;
    ritirato?: boolean;
    modificato?: boolean;
    evidenziato?: boolean;
    alClic?: () => void;
}

// Posizione del centro del blocco tondo; salvata in graph.parentReqPositions quando lo sposti
function getParentBlockCenter(graph: Grafo, reqId: string, idx: number): Punto {
    return graph.parentReqPositions?.[reqId] || posizioneInColonna(idx);
}

// Posto idx della colonna a sinistra in cui stanno i blocchi tondi non ancora spostati
export function posizioneInColonna(idx: number): Punto {
    return posizioneInColonnaDiagramma(idx);
}

function getParentReqPinPos(graph: Grafo, reqId: string, idx: number): Punto {
    const centro = getParentBlockCenter(graph, reqId, idx);
    return { x: centro.x + appSettings.parentBlock.radius, y: centro.y };
}

function renderParentBlocks(parentNode: Nodo, graph: Grafo): void {
    const parentDef = getBlockDef(parentNode.type);
    if (!parentDef) return;
    const intestazione = `Requisito del blocco padre [${parentNode.label || parentDef.titolo}]`;
    parentDef.requisiti.forEach((req, idx) => {
        disegnaBloccoTondo(graph, req, idx, parentNode.id, {
            etichetta: req.id,
            sottotitolo: req.titolo,
            tooltip: `${intestazione}\n${descriviRequisito(req)}\n\nTrascina per spostare`
        });
    });
}

// Alla radice: i requisiti cliente che hanno una posizione salvata (sono "sul canvas")
function renderBlocchiCliente(graph: Grafo): void {
    const posizioni = graph.parentReqPositions || {};
    requisitiPadre(null).forEach((req, idx) => {
        if (!posizioni[req.id] || !isRequisitoCliente(req)) return;
        disegnaBloccoTondo(graph, req, idx, ID_CLIENTE, {
            etichetta: req.idCliente,
            sottotitolo: titoloRequisito(req),
            tooltip: `Requisito cliente\n${descriviRequisito(req)}\n\nClic: dettaglio · Trascina per spostare`,
            ritirato: req.stato === 'ritirato',
            modificato: req.modificato,
            evidenziato: req.id === idClienteEvidenziato,
            alClic: () => mostraDettaglioCliente(req.id)
        });
    });
}

function disegnaBloccoTondo(graph: Grafo, req: Requisito, idx: number, ownerId: string, opzioni: OpzioniBloccoTondo): void {
    const raggio = appSettings.parentBlock.radius;
    const centro = getParentBlockCenter(graph, req.id, idx);
    const colore = opzioni.ritirato ? '#9e9e9e' : getColoreRequisito(req);
    const g = creaSvg('g', { class: 'parent-block' });
    // Con una catena della Gerarchia decide lei cosa si attenua, al posto del filtro per classe
    const inCatena = occorrenzaInCatena(chiaveSulCanvas('parent', ownerId, req.id));
    const incluso = estremoIncluso('parent', ownerId, req.id);
    // Nascondi: un blocco tondo escluso resta se è nella catena o estremo di un filo disegnato (spec 0008, AC-6)
    if (modoNascondi() && !incluso && !inCatena && !estremiDisegnati.has(chiaveEstremo('parent', ownerId, req.id))) return;
    if (catenaAttiva()) {
        if (!inCatena) g.classList.add('fuori-catena');
    } else if (!incluso) {
        g.classList.add('fuori-filtro');
    }

    const problema = problemaPin(graph, 'parent', ownerId, req.id);
    let classe = 'parent-block-circle';
    if (opzioni.ritirato) classe += ' parent-block-ritirato';
    if (opzioni.evidenziato) classe += ' parent-block-evidenziato';
    if (problema) classe += ' problema-coerenza';
    if (inCatena) classe += ' pin-catena';
    const cerchio = creaSvg('circle', { cx: centro.x, cy: centro.y, r: raggio, class: classe, stroke: colore });
    aggiungiTooltip(cerchio, problema ? `${opzioni.tooltip}\n\n⚠️ ${problema}` : opzioni.tooltip);
    // Il clic (premi e rilascia senza spostare) lo decide startParentBlockDrag: il click arriverebbe solo senza tremolio
    cerchio.addEventListener('mousedown', (e) => startParentBlockDrag(e, graph, req, idx, ownerId, opzioni.alClic));
    cerchio.addEventListener('click', (e) => { if (opzioni.alClic || gerarchiaAttiva()) e.stopPropagation(); });
    g.appendChild(cerchio);

    if (opzioni.modificato) {
        const segno = creaSvg('circle', {
            cx: centro.x + raggio * 0.7, cy: centro.y - raggio * 0.7, r: 5, class: 'segno-modificato'
        });
        aggiungiTooltip(segno, "Modificato dall'ultimo import: apri il dettaglio e segnalo come visto");
        g.appendChild(segno);
    }

    g.appendChild(testoSvg(opzioni.etichetta, { x: centro.x, y: centro.y + raggio + 14, 'text-anchor': 'middle', class: 'parent-block-id' }));
    g.appendChild(testoSvg(opzioni.sottotitolo || '', { x: centro.x, y: centro.y + raggio + 27, 'text-anchor': 'middle', class: 'parent-block-title' }));

    const pinPos = getParentReqPinPos(graph, req.id, idx);
    g.appendChild(createReqPin(pinPos.x, pinPos.y, req, { ownerId, ownerType: 'parent' }, isInterfaccia(req) ? 'tondo' : 'tondo-capacita', {
        collegato: true, sopra: false, propagata: false, assoluto: pinPos, etichette: []
    }));

    parentLayer.appendChild(g);
}

// Trascina un blocco tondo; premuto e rilasciato senza cambiare casella della griglia è un clic:
// a modalità Gerarchia accesa sceglie il requisito, altrimenti chiama alClic (il dettaglio del cliente)
function startParentBlockDrag(e: MouseEvent, graph: Grafo, req: Requisito, idx: number, ownerId: string, alClic?: () => void): void {
    e.stopPropagation();
    const reqId = req.id;
    const centro = getParentBlockCenter(graph, reqId, idx);
    const startCoords = getCanvasCoords(e);
    const offset = { x: startCoords.x - centro.x, y: startCoords.y - centro.y };
    let spostato = false;

    function drag(ev: MouseEvent): void {
        const coords = getCanvasCoords(ev);
        const nuova = { x: coords.x - offset.x, y: coords.y - offset.y };
        if (!spostato && nuova.x === centro.x && nuova.y === centro.y) return;
        spostato = true;
        if (!graph.parentReqPositions) graph.parentReqPositions = {};
        graph.parentReqPositions[reqId] = nuova;
        render();
    }
    function endDrag(): void {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
        if (spostato) return;
        if (gerarchiaAttiva()) scegliDaCanvas({ ownerType: 'parent', ownerId }, req);
        else if (alClic) alClic();
    }
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}

/* --- COORDINATE --- */

// Punto del canvas sotto il cursore, con zoom e pan tolti, senza aggancio alla griglia (spec 0011)
export function puntoCanvas(e: { clientX: number; clientY: number }): Punto {
    const rect = svg.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left - zoomState.x) / zoomState.scale,
        y: (e.clientY - rect.top - zoomState.y) / zoomState.scale
    };
}

export function getCanvasCoords(e: { clientX: number; clientY: number }): Punto {
    const p = puntoCanvas(e);
    const gridSize = appSettings.grid.size;
    return {
        x: Math.round(p.x / gridSize) * gridSize,
        y: Math.round(p.y / gridSize) * gridSize
    };
}

// Coordinate assolute del pin di un estremo del livello aperto, dalla stessa geometria dei fili
function getEstremoCoords(ownerId: string, reqId: string, ownerType: TipoEstremo, graph: Grafo, percorso: readonly string[] = []): Punto | null {
    if (ownerType === 'parent') {
        const tipoPadre = tipoPadreCorrente();
        // Un requisito cliente si disegna solo se ha una posizione salvata
        if (tipoPadre === null && !graph.parentReqPositions?.[reqId]) return null;
        const idx = requisitiPadre(tipoPadre).findIndex((r) => r.id === reqId);
        return idx >= 0 ? getParentReqPinPos(graph, reqId, idx) : null;
    }
    return contestoCorrente?.centro('node', ownerId, reqId, percorso) ?? null;
}

/* --- PIN E DISEGNO DEI COLLEGAMENTI --- */

type FormaPin = 'porta' | 'capacita' | 'tondo' | 'tondo-capacita';

interface OpzioniPin {
    // La porta ha almeno un filo in questo livello (o sopra): quadratino pieno
    collegato: boolean;
    // Collegata solo a un livello sopra, attraverso il bordo del contenitore
    sopra: boolean;
    propagata: boolean;
    // Centro assoluto del pin (per la linea che segue il mouse)
    assoluto: Punto;
    etichette: string[];
}

// Vero se una porta del livello aperto è già collegata ai livelli sopra come porta propagata (spec 0035)
function collegataSopra(nodeId: string, reqId: string, percorso: readonly string[]): boolean {
    let proprietario = nodeId;
    let dentro = [...percorso];
    for (let i = pathStack.length - 1; i > 0; i--) {
        const contenitore = pathStack[i]!.parentNode;
        if (!contenitore) return false;
        dentro = [proprietario, ...dentro];
        proprietario = contenitore.id;
        const sopra = pathStack[i - 1]!.graph;
        if (estremiUsati(sopra).has(`${proprietario}|${chiavePorta(reqId, dentro)}`)) return true;
    }
    return false;
}

function createReqPin(cx: number, cy: number, req: Requisito, owner: Proprietario, forma: FormaPin, opzioni: OpzioniPin): SVGElement {
    const raggio = appSettings.requirements.radius;
    const colore = getColoreRequisito(req);
    const percorso = owner.percorso ?? [];
    const g = creaSvg('g', { class: `pin${opzioni.propagata ? ' propagata' : ''}`, 'data-nodo': owner.ownerId, 'data-porta': chiavePorta(req.id, percorso) });
    g.style.setProperty('--lc', colore);
    let pin: SVGElement;
    if (forma === 'porta' || forma === 'capacita') {
        // Area di presa più larga del quadratino
        g.appendChild(creaSvg('rect', { x: cx - 8, y: cy - 8, width: 16, height: 16, class: 'pin-hit' }));
        const lato = 4.5;
        pin = creaSvg('rect', { x: cx - lato, y: cy - lato, width: lato * 2, height: lato * 2 });
    } else if (forma === 'tondo') {
        pin = creaSvg('circle', { cx, cy, r: raggio });
    } else {
        pin = creaSvg('rect', { x: cx - raggio, y: cy - raggio, width: raggio * 2, height: raggio * 2 });
    }
    // L'alone sta sul pin solo per i requisiti dei blocchi; per i blocchi tondi sta sul cerchio
    const problema = owner.ownerType === 'node' && !percorso.length ? problemaPin(getCurrentLevel().graph, 'node', owner.ownerId, req.id) : null;
    let classe = 'node-req-pin';
    if (forma === 'porta') classe += ` porta-interfaccia port-sq ${opzioni.collegato ? 'on-if' : 'libera'}`;
    if (forma === 'capacita') classe += ` pin-capacita port-sq ${opzioni.collegato ? 'on-cat' : 'libera'}`;
    if (opzioni.propagata) classe += ' porta-propagata';
    if (opzioni.sopra) classe += ' collegata-sopra';
    if (problema) classe += ' problema-coerenza';
    pin.setAttribute('class', classe);
    if (forma === 'tondo' || forma === 'tondo-capacita') pin.setAttribute('fill', colore);
    // Gerarchia con una scelta: alone sui pin della catena, gli altri attenuati. Il pin di un blocco tondo
    // segue il suo gruppo (l'alone sta sul cerchio)
    if (catenaAttiva()) {
        if (owner.ownerType === 'node') {
            pin.classList.add(!percorso.length && occorrenzaInCatena(chiaveSulCanvas('node', owner.ownerId, req.id)) ? 'pin-catena' : 'fuori-catena');
        }
    } else if (!estremoIncluso(owner.ownerType, owner.ownerId, req.id, percorso)) {
        pin.classList.add('fuori-filtro');
    }
    g.appendChild(pin);

    const suggerimento = owner.ownerType !== 'node' ? '' : '\n[Shift+trascina per portare la porta sull\'altro lato]';
    const dove = (opzioni.propagata ? `\nPorta propagata da: ${opzioni.etichette.join(' › ')}` : '')
        + (opzioni.sopra ? '\nCollegata a un livello superiore: sale sul bordo del blocco che la contiene' : '');
    aggiungiTooltip(g, descriviRequisito(req) + dove + suggerimento + (problema ? `\n\n⚠️ ${problema}` : ''));

    g.addEventListener('mousedown', (e) => {
        if ((e as MouseEvent).shiftKey) return;
        e.stopPropagation();
        isDrawingEdge = true;
        edgeStartData = { ownerId: owner.ownerId, reqId: req.id, ownerType: owner.ownerType, ...(percorso.length ? { percorso: [...percorso] } : {}), x: opzioni.assoluto.x, y: opzioni.assoluto.y };
        svg.classList.add('collegamento');

        const temp = creaSvg('path', { class: 'temp-link', stroke: colore });
        // La linea segue il mouse: non deve intercettare il rilascio sul pin di destinazione
        temp.style.pointerEvents = 'none';
        edgesLayer.appendChild(temp);
        tempEdgePath = temp;
    });

    g.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        const inizio = edgeStartData;
        const stessoPin = !!inizio && inizio.ownerId === owner.ownerId &&
            inizio.ownerType === owner.ownerType && inizio.reqId === req.id &&
            chiavePorta(req.id, inizio.percorso ?? []) === chiavePorta(req.id, percorso);
        // Gerarchia: premi e rilascia sullo stesso pin sceglie il suo requisito, senza tirare un filo (AC-2)
        if (isDrawingEdge && stessoPin && gerarchiaAttiva()) {
            cleanupEdgeDrawing();
            if (!percorso.length) scegliDaCanvas(owner, req);
            return;
        }
        if (isDrawingEdge && inizio && !stessoPin) collega(inizio, { ...owner, percorso: [...percorso] }, req);
        cleanupEdgeDrawing();
        render();
    });

    return g;
}

// Crea il filo fra due pin del livello aperto, se la regola lo ammette
function collega(inizio: Proprietario & { reqId: string }, fine: Proprietario, req: Requisito): void {
    const graph = getCurrentLevel().graph;
    const pa = inizio.percorso ?? [];
    const pb = fine.percorso ?? [];
    const a: Estremo = { ownerId: inizio.ownerId, reqId: inizio.reqId, ownerType: inizio.ownerType, percorso: pa, req: trovaRequisito(inizio.ownerId, inizio.reqId, inizio.ownerType, pa) };
    const b: Estremo = { ownerId: fine.ownerId, reqId: req.id, ownerType: fine.ownerType, percorso: pb, req };

    const errore = verificaCollegamento(a, b, graph.edges);
    if (errore) {
        alert(`Impossibile collegare: ${errore}`);
        return;
    }
    // Una porta già usata ai livelli sopra come porta propagata: collegarla qui toglie quel filo dal bordo
    const sopra = [a, b].find((e) => e.ownerType === 'node' && collegataSopra(e.ownerId, e.reqId, e.percorso ?? []));
    if (sopra && !confirm(`La porta ${sopra.reqId} è già collegata a un livello superiore (sale sul bordo del blocco che la contiene). Collegandola qui non sale più e quel filo diventa da riparare. Collegare lo stesso?`)) return;
    // Una derivazione parte sempre dal requisito del padre
    const [sorgente, destinazione] = b.ownerType === 'parent' ? [b, a] : [a, b];
    const filo: Filo = {
        id: generaId('edge'),
        source: sorgente.ownerId,
        sourceHandle: sorgente.reqId,
        sourceType: sorgente.ownerType,
        target: destinazione.ownerId,
        targetHandle: destinazione.reqId,
        targetType: destinazione.ownerType,
        waypoints: []
    };
    if (sorgente.percorso?.length) filo.sourcePercorso = [...sorgente.percorso];
    if (destinazione.percorso?.length) filo.targetPercorso = [...destinazione.percorso];
    graph.edges.push(filo);
}

// Linea tratteggiata che segue il mouse mentre disegni un collegamento
window.addEventListener('mousemove', (e) => {
    if (!isDrawingEdge || !tempEdgePath || !edgeStartData) return;
    const p = puntoCanvas(e);
    const start = getEstremoCoords(edgeStartData.ownerId, edgeStartData.reqId, edgeStartData.ownerType, getCurrentLevel().graph, edgeStartData.percorso) || edgeStartData;
    tempEdgePath.setAttribute('d', `M ${start.x} ${start.y} L ${p.x} ${p.y}`);
});

export function cleanupEdgeDrawing(): void {
    isDrawingEdge = false; edgeStartData = null;
    svg.classList.remove('collegamento');
    if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
}

/* --- TRASCINAMENTI --- */

// Collega il trascinamento a window finché il tasto non si rilascia. Il rilascio si ascolta in cattura:
// un pin sotto il mouse ferma la propagazione del suo mouseup, e il trascinamento resterebbe agganciato
function trascina(drag: (ev: MouseEvent) => void): void {
    function endDrag(): void {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag, true);
    }
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag, true);
}

// Solo la larghezza: l'altezza del blocco viene dalle sue righe (spec 0035)
function startResizeDrag(e: MouseEvent, node: Nodo): void {
    e.stopPropagation();
    const startX = e.clientX;
    const def = getBlockDef(node.type);
    const initialW = def ? formaBlocco(node, def, appState.library, appSettings).larghezza : (node.width || appSettings.node.width);

    trascina((ev) => {
        const gridSize = appSettings.grid.size;
        node.width = Math.max(80, Math.round((initialW + (ev.clientX - startX) / zoomState.scale) / gridSize) * gridSize);
        render();
    });
}

// Shift+trascina una porta (o il pin di una capacità): passa sul lato sinistro o destro del blocco (spec 0035)
function startPortaLatoDrag(node: Nodo, forma: FormaBlocco, chiave: string): void {
    trascina((ev) => {
        const lato = latoDalPunto(node, forma, puntoCanvas(ev));
        if (node.pinPositions?.[chiave]?.side === lato) return;
        if (!node.pinPositions) node.pinPositions = {};
        node.pinPositions[chiave] = { side: lato, ratio: 0.5 };
        render();
    });
}

// Riposiziona le porte: l'istanza torna ai lati automatici (e dimentica i pin di capacità spostati prima della 2.3)
export function riposizionaPorte(node: Nodo): void {
    const lati = Object.keys(node.pinPositions ?? {}).length > 0;
    if (!lati && !node.capabilityPositions) return;
    node.pinPositions = {};
    delete node.capabilityPositions;
    render();
}

export function haPorteSpostate(node: Nodo | undefined): boolean {
    return !!node && (Object.keys(node.pinPositions ?? {}).length > 0 || Object.keys(node.capabilityPositions ?? {}).length > 0);
}

function startWaypointDrag(e: MouseEvent, waypoint: Punto): void {
    e.stopPropagation();
    trascina((ev) => {
        const coords = getCanvasCoords(ev);
        waypoint.x = coords.x;
        waypoint.y = coords.y;
        render();
    });
}

function enterNode(node: Nodo): void {
    if (!node.internal_graph) node.internal_graph = { nodes: [], edges: [] };
    pathStack.push({
        id: node.id,
        label: node.label || node.id,
        graph: node.internal_graph,
        parentNode: node
    });
    setActiveNodeId(null);
    renderUI();
    render();
}

function startDrag(e: MouseEvent, node: Nodo): void {
    e.stopPropagation();
    const startCoords = getCanvasCoords(e);
    const offset = { x: startCoords.x - node.position.x, y: startCoords.y - node.position.y };

    trascina((ev) => {
        const coords = getCanvasCoords(ev);
        node.position.x = coords.x - offset.x;
        node.position.y = coords.y - offset.y;
        render();
    });
}

/* --- LEGENDA, LAVAGNA VUOTA, PULSANTI DI VISTA E RICERCA DI UN BLOCCO (spec 0035) --- */

function aggiornaLegenda(graph: Grafo, contesto: ContestoFili, disegnati: Filo[]): void {
    const legenda = document.getElementById('legendaLavagna');
    if (!legenda) return;
    legenda.hidden = !vista.legenda || (!graph.nodes.length && !graph.edges.length);
    if (legenda.hidden) return;
    const perClasse = new Map<string, { colore: string; n: number; stile: string }>();
    let derivazioni = 0;
    disegnati.forEach((edge) => {
        const req = trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType, percorsoSorgente(edge));
        if (isDerivazione(edge)) {
            derivazioni++;
            return;
        }
        const classe = getClasseRequisito(req);
        const voce = perClasse.get(classe) ?? { colore: getColoreRequisito(req), n: 0, stile: stileFilo(edge, req) };
        voce.n++;
        perClasse.set(classe, voce);
    });
    let porteLibere = 0;
    let propagate = 0;
    graph.nodes.forEach((n) => (contesto.forma(n.id)?.righe ?? []).forEach((r) => {
        if (r.propagata) propagate++;
        const k = `${n.id}|${r.chiave}`;
        if (r.interfaccia && !porteCollegate.has(k) && !porteSopra.has(k)) porteLibere++;
    }));
    const campione = (colore: string, stile: string) => {
        const tratto = stile === 'interfaccia' ? 'stroke-dasharray="5 3" stroke-width="2.3"' : stile === 'derivazione' ? 'stroke-dasharray="2 3" stroke-width="2"' : 'stroke-width="1.6"';
        return `<svg width="26" height="8" aria-hidden="true"><line x1="1" y1="4" x2="25" y2="4" stroke="${colore}" ${tratto}/></svg>`;
    };
    const righe = [...perClasse.entries()].sort((a, b) => a[0].localeCompare(b[0], 'it'))
        .map(([classe, v]) => `<div class="lg-row">${campione(v.colore, v.stile)}${escapeHtml(classe)} (${v.n})</div>`);
    if (derivazioni) righe.push(`<div class="lg-row">${campione('#6a7585', 'derivazione')}Derivazioni (${derivazioni})</div>`);
    const fili = disegnati.length;
    const livello = getCurrentLevel();
    legenda.innerHTML = `<div class="lg-title">${escapeHtml(livello.parentNode ? livello.label : 'Radice')} · ${fili} ${fili === 1 ? 'filo' : 'fili'}</div>`
        + (righe.length ? righe.join('') : '<div class="lg-row muted">Nessun filo in questo livello</div>')
        + `<div class="lg-stats">${graph.nodes.length} ${graph.nodes.length === 1 ? 'blocco' : 'blocchi'} · ${porteLibere} ${porteLibere === 1 ? 'porta libera' : 'porte libere'}`
        + (propagate ? ` · ${propagate} ${propagate === 1 ? 'porta propagata' : 'porte propagate'}` : '') + '</div>';
}

function aggiornaVuoto(graph: Grafo): void {
    const vuoto = document.getElementById('lavagnaVuota');
    if (vuoto) vuoto.hidden = graph.nodes.length > 0 || graph.edges.length > 0 || pathStack.length > 1;
}

function aggiornaPulsantiVista(): void {
    const imposta = (id: string, acceso: boolean) => {
        const p = document.getElementById(id);
        if (!p) return;
        p.classList.toggle('on', acceso);
        p.setAttribute('aria-pressed', String(acceso));
    };
    imposta('btnMostraEtichette', vista.etichette);
    imposta('btnMostraLegenda', vista.legenda);
    // Blocchi del livello per la ricerca
    const elenco = document.getElementById('elencoBlocchiLivello');
    if (!elenco) return;
    const voci = getCurrentLevel().graph.nodes.map((n) => {
        const def = getBlockDef(n.type);
        return `<option value="${escapeHtml(n.label || n.id)}">${escapeHtml(def ? `${def.id} · ${def.titolo}` : n.type)}</option>`;
    }).join('');
    if (elenco.innerHTML !== voci) elenco.innerHTML = voci;
}

// Trova un blocco del livello per etichetta, id o tipo, lo centra e lo seleziona; falso se non c'è
export function trovaBlocco(testo: string): boolean {
    const t = testo.trim().toLowerCase();
    if (!t) return false;
    const nodi = getCurrentLevel().graph.nodes;
    const nodo = nodi.find((n) => (n.label || '').toLowerCase() === t)
        ?? nodi.find((n) => n.id.toLowerCase() === t || n.type.toLowerCase() === t)
        ?? nodi.find((n) => `${n.label} ${n.type} ${getBlockDef(n.type)?.titolo ?? ''}`.toLowerCase().includes(t));
    if (!nodo) return false;
    const c = centroNodo(nodo);
    centraVista(c.x, c.y);
    selectNode(nodo);
    return true;
}
