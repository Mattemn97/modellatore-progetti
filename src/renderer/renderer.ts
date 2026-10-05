/* --- MOTORE DI RENDERING, ZOOM/PAN, BLOCCHI TONDI DEL PADRE E COLLEGAMENTI --- */

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
import { generaId } from './utils.js';
import { filtriAttivi, modoNascondi, requisitoIncluso, bloccoPassa, bloccoIncluso, aggiornaRiepilogoFiltri } from './filtri.js';
import type { Blocco, EstremoDescritto, Filo, Grafo, Nodo, Punto, Requisito, TipoEstremo } from './tipi.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('workspaceSvg') as unknown as SVGSVGElement;
const viewport = document.getElementById('viewport') as unknown as SVGGElement;
const nodesLayer = document.getElementById('nodesLayer') as unknown as SVGGElement;
const edgesLayer = document.getElementById('edgesLayer') as unknown as SVGGElement;
const parentLayer = document.getElementById('parentLayer') as unknown as SVGGElement;

// Distanza dal bordo inferiore interno a cui stanno i pin di capacità di un blocco
const MARGINE_PIN_CAPACITA = 12;

interface Proprietario {
    ownerId: string;
    ownerType: TipoEstremo;
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

function updateViewportTransform(): void {
    viewport.setAttribute('transform', `translate(${zoomState.x}, ${zoomState.y}) scale(${zoomState.scale})`);
}

function creaSvg<K extends keyof SVGElementTagNameMap>(tag: K, attributi: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributi).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
}

function aggiungiTooltip(el: SVGElement, testo: string): void {
    const title = creaSvg('title');
    title.textContent = testo;
    el.appendChild(title);
}

// Eventi Zoom con Rotella e Pan con Click Centrale / Trascinamento Canvas
svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(0.3, zoomState.scale * zoomFactor), 3);

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    zoomState.x = mouseX - (mouseX - zoomState.x) * (newScale / zoomState.scale);
    zoomState.y = mouseY - (mouseY - zoomState.y) * (newScale / zoomState.scale);
    zoomState.scale = newScale;

    updateViewportTransform();
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
        svg.style.cursor = 'grabbing';
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
    svg.style.cursor = 'default';
});

/* --- RICERCA DEI REQUISITI NEL LIVELLO CORRENTE --- */

function getBlockDef(type: string | null | undefined): Blocco | null {
    return (type ? appState.library[type] : null) || null;
}

// Tipo del padre del livello corrente: null alla radice, dove il padre sono i requisiti cliente
function tipoPadreCorrente(): string | null {
    return getCurrentLevel().parentNode?.type ?? null;
}

// Requisito di un estremo: ownerType 'parent' = requisito del blocco che contiene il livello corrente
function trovaRequisito(ownerId: string, reqId: string, ownerType: TipoEstremo): Requisito | null {
    if (ownerType === 'parent') return requisitoPadre(tipoPadreCorrente(), reqId);
    const tipo = getCurrentLevel().graph.nodes.find((n) => n.id === ownerId)?.type;
    return getBlockDef(tipo)?.requisiti.find((r) => r.id === reqId) || null;
}

// Estremo di un filo del livello corrente per l'ispettore dei collegamenti (spec 0009): requisito, nodo e definizione,
// o mancante. I campi ownerId, reqId, ownerType servono a verificaCompatibilita()
export function descriviEstremo(ownerId: string, reqId: string, ownerType: TipoEstremo): EstremoDescritto {
    const base = { ownerId, reqId, ownerType };
    if (ownerType === 'parent') {
        const parentNode = getCurrentLevel().parentNode || null;
        const req = requisitoPadre(tipoPadreCorrente(), reqId);
        return req ? { ...base, req, tondo: true, cliente: !parentNode, parentNode } : { ...base, mancante: true };
    }
    const nodo = getCurrentLevel().graph.nodes.find((n) => n.id === ownerId) || null;
    const def = nodo ? getBlockDef(nodo.type) : null;
    const req = def?.requisiti.find((r) => r.id === reqId) || null;
    return req && nodo && def ? { ...base, req, nodo, def, tondo: false, cliente: false } : { ...base, mancante: true };
}

/* --- FILTRI (spec 0008): COSA È INCLUSO NEL LIVELLO --- */

const chiaveEstremo = (ownerType: TipoEstremo, ownerId: string, reqId: string) => `${ownerType}:${ownerId}:${reqId}`;

interface Inclusi {
    estremi: Set<string>;
    nodi: Set<string>;
    fili: Set<string>;
}

// Inclusi del livello, una volta per disegno: estremi (pin e blocchi tondi), nodi e fili. Funzione pura
function calcolaInclusi(graph: Grafo, parentNode: Nodo | null): Inclusi {
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
        def.requisiti.forEach((req) => {
            if (passa && (tutti || requisitoIncluso(req))) estremi.add(chiaveEstremo('node', node.id, req.id));
        });
    });
    // Un filo è incluso se almeno un estremo lo è; un estremo che non si trova non conta (AC-5, AC-10)
    (graph.edges || []).forEach((edge) => {
        if (estremi.has(chiaveEstremo(edge.sourceType, edge.source, edge.sourceHandle))
            || estremi.has(chiaveEstremo(edge.targetType, edge.target, edge.targetHandle))) fili.add(edge.id);
    });
    return { estremi, nodi, fili };
}

// Inclusi del disegno in corso e fili disegnati (per Nascondi: gli estremi dei fili disegnati restano)
let inclusi: Inclusi = { estremi: new Set(), nodi: new Set(), fili: new Set() };
let estremiDisegnati = new Set<string>();

function estremoIncluso(ownerType: TipoEstremo, ownerId: string, reqId: string): boolean {
    return inclusi.estremi.has(chiaveEstremo(ownerType, ownerId, reqId));
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

    risolviFiloSelezionato(currentGraph);

    // FILTRI: inclusi del livello, poi cosa si disegna (spec 0008, AC-5, AC-6, AC-11)
    inclusi = calcolaInclusi(currentGraph, currentLevel.parentNode);
    const nascondi = modoNascondi();
    const filiCatena = filiInCatena(currentGraph);
    // Un filo senza requisito di partenza non si è mai disegnato
    const candidati = currentGraph.edges.filter((edge) => trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType));
    const daDisegnare = candidati.filter((edge) => !nascondi || inclusi.fili.has(edge.id) || filiCatena.has(edge.id));
    estremiDisegnati = new Set();
    daDisegnare.forEach((edge) => {
        estremiDisegnati.add(chiaveEstremo(edge.sourceType, edge.source, edge.sourceHandle));
        estremiDisegnati.add(chiaveEstremo(edge.targetType, edge.target, edge.targetHandle));
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

    // RENDER FILI (EDGES)
    daDisegnare.forEach((edge) => renderEdge(edge, currentGraph));

    // RENDER NODI: con Nascondi un blocco escluso resta se è nella catena o estremo di un filo disegnato
    let blocchiEsclusi = 0;
    currentGraph.nodes.forEach((node) => {
        const blockDef = getBlockDef(node.type);
        if (!blockDef) return;
        const incluso = inclusi.nodi.has(node.id);
        if (!incluso) blocchiEsclusi++;
        if (nascondi && !incluso && !nodiDiFili.has(node.id) && !nodoNellaCatena(node, blockDef)) return;
        renderNode(node, blockDef);
    });
    aggiornaRiepilogoFiltri(blocchiEsclusi, candidati.filter((e) => !inclusi.fili.has(e.id)).length);

    renderUI();
    // La scheda Cliente si aggiorna al massimo una volta per fotogramma, mai qui dentro
    segnaSchedaClienteDaAggiornare();
    segnaSchedaCoerenzaDaAggiornare();
    segnaSchedaGerarchiaDaAggiornare();
    // Matrice e Documenti come pannelli: ricalcolo differito dopo una raffica di modifiche (spec 0022)
    segnaMatriceDaAggiornare();
    segnaDocumentiDaAggiornare();
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

function renderEdge(edge: Filo, currentGraph: Grafo): void {
    const startCoords = getEstremoCoords(edge.source, edge.sourceHandle, edge.sourceType, currentGraph);
    const endCoords = getEstremoCoords(edge.target, edge.targetHandle, edge.targetType, currentGraph);
    if (!startCoords || !endCoords) return;

    const srcReq = trovaRequisito(edge.source, edge.sourceHandle, edge.sourceType);
    const tgtReq = trovaRequisito(edge.target, edge.targetHandle, edge.targetType);
    const edgeColor = getColoreRequisito(srcReq);
    const derivazione = isDerivazione(edge);

    if (!edge.waypoints) edge.waypoints = [];
    const points = [startCoords, ...edge.waypoints, endCoords];
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Gerarchia con una scelta: i fili della catena evidenziati, tutti gli altri attenuati
    let classeCatena = '';
    if (catenaAttiva()) classeCatena = filoInCatena(currentGraph, edge.id) ? ' catena-gerarchia' : ' fuori-catena';
    // Senza catena attenua il filtro: un filo escluso si disegna solo con Attenua (spec 0008, AC-6)
    else if (!inclusi.fili.has(edge.id)) classeCatena = ' fuori-filtro';
    const selezionato = filoSelezionatoId() === edge.id ? ' filo-selezionato' : '';
    const path = creaSvg('path', {
        class: (derivazione ? 'edge-path edge-derivazione' : 'edge-path') + classeCatena + selezionato,
        d: pathData,
        stroke: edgeColor
    });

    const relazione = derivazione ? 'Derivazione padre → figlio' : 'Collegamento tra blocchi';
    aggiungiTooltip(path,
        `${relazione} [${getClasseRequisito(srcReq)}]\n` +
        `${srcReq?.id ?? edge.sourceHandle} ${titoloRequisito(srcReq)} → ${tgtReq?.id ?? edge.targetHandle} ${titoloRequisito(tgtReq)}\n` +
        'Clic: dettaglio · Doppio clic: aggiungi snodo · Clic destro: elimina');

    // Clic: seleziona il filo e ne mostra il dettaglio nell'ispettore (spec 0009)
    path.addEventListener('click', (e) => {
        e.stopPropagation();
        selezionaFilo(edge.id);
    });

    // Aggiungi Snodo con Doppio Clic
    path.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const coords = getCanvasCoords(e);
        edge.waypoints.push({ x: coords.x, y: coords.y });
        render();
    });

    // ELIMINAZIONE CAVO: Click Destro
    path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Vuoi eliminare questo collegamento?')) eliminaFilo(currentGraph, edge.id);
    });

    edgesLayer.appendChild(path);

    edge.waypoints.forEach((wp, idx) => {
        const handle = creaSvg('circle', {
            cx: wp.x, cy: wp.y, r: 5, fill: edgeColor, stroke: '#ffffff', 'stroke-width': '1.5'
        });
        // Gli snodi seguono il filo (AC-11)
        if (classeCatena === ' fuori-catena' || classeCatena === ' fuori-filtro') handle.setAttribute('class', classeCatena.trim());
        handle.style.cursor = 'move';
        handle.addEventListener('mousedown', (e) => startWaypointDrag(e, wp));
        handle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            edge.waypoints.splice(idx, 1);
            render();
        });
        edgesLayer.appendChild(handle);
    });
}

function renderNode(node: Nodo, blockDef: Blocco): void {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;

    const g = creaSvg('g', { transform: `translate(${node.position.x}, ${node.position.y})` });

    const rect = creaSvg('rect', { width: nodeW, height: nodeH, class: 'node-rect' });
    if (activeNodeId === node.id) {
        rect.style.stroke = appSettings.node.selectedBorderColor;
        rect.style.strokeWidth = '3px';
    }
    if (blockDef.descrizione) aggiungiTooltip(rect, blockDef.descrizione);

    const labelText = creaSvg('text', {
        x: nodeW / 2, y: nodeH / 2 + 5, 'text-anchor': 'middle', class: 'node-text'
    });
    labelText.textContent = node.label || blockDef.titolo || node.id;

    // Gerarchia: si attenuano rettangolo e scritta, mai il gruppo, così i pin della catena restano pieni
    const occorrenzeDentro = contatoreGerarchia(percorsoNodo(node));
    if (catenaAttiva() && occorrenzeDentro === 0 && !haPinInCatena(node, blockDef)) {
        rect.classList.add('fuori-catena');
        labelText.classList.add('fuori-catena');
    } else if (!catenaAttiva() && !inclusi.nodi.has(node.id)) {
        // Filtri: blocco escluso attenuato, i pin seguono solo la propria inclusione (spec 0008, AC-6, AC-11)
        rect.classList.add('fuori-filtro');
        labelText.classList.add('fuori-filtro');
    }

    g.appendChild(rect);
    g.appendChild(labelText);

    const resizeHandle = creaSvg('rect', {
        x: nodeW - 10, y: nodeH - 10, width: 10, height: 10, class: 'node-resize-handle'
    });
    resizeHandle.addEventListener('mousedown', (e) => startResizeDrag(e, node));
    g.appendChild(resizeHandle);

    // Problemi di coerenza nel contenuto del blocco: contatore in alto a destra, trasparente al mouse
    const problemi = contatoreBlocco(node);
    if (problemi > 0) {
        const contatore = creaSvg('g', { class: 'contatore-coerenza', transform: `translate(${nodeW}, 0)` });
        contatore.appendChild(creaSvg('circle', { r: 9 }));
        const numero = creaSvg('text', { 'text-anchor': 'middle', y: 3.5 });
        numero.textContent = problemi > 99 ? '99+' : String(problemi);
        contatore.appendChild(numero);
        g.appendChild(contatore);
    }

    // Occorrenze della catena nel contenuto del blocco: contatore in alto a sinistra, nel colore della classe della scelta
    if (occorrenzeDentro > 0) {
        const contatore = creaSvg('g', { class: 'contatore-gerarchia' });
        contatore.appendChild(creaSvg('circle', { r: 9, fill: coloreCatena() }));
        const numero = creaSvg('text', { 'text-anchor': 'middle', y: 3.5 });
        numero.textContent = occorrenzeDentro > 99 ? '99+' : String(occorrenzeDentro);
        contatore.appendChild(numero);
        g.appendChild(contatore);
    }

    // Interfaccia: porte sul bordo, spostabili con Shift+trascina
    const interfacce = blockDef.requisiti.filter(isInterfaccia);
    interfacce.forEach((req, idx) => {
        const pos = getReqPerimeterPos(node, req.id, idx, interfacce.length);
        const pin = createReqPin(pos.x, pos.y, req, { ownerId: node.id, ownerType: 'node' }, 'cerchio');
        // Con Shift premuto il cursore diventa quello di spostamento (spec 0011, AC-3)
        pin.classList.add('porta-interfaccia');
        pin.addEventListener('mousedown', (e) => {
            if (e.shiftKey) {
                e.stopPropagation();
                startPinPerimeterDrag(node, req.id);
            }
        });
        g.appendChild(pin);
    });

    // Capacità: pin quadrati all'interno del blocco, lungo il bordo inferiore
    const capacita = blockDef.requisiti.filter((r) => !isInterfaccia(r));
    capacita.forEach((req, idx) => {
        const pos = getCapacitaPos(node, idx, capacita.length);
        g.appendChild(createReqPin(pos.x, pos.y, req, { ownerId: node.id, ownerType: 'node' }, 'quadrato'));
    });

    g.addEventListener('mousedown', (e) => startDrag(e, node));
    g.addEventListener('dblclick', () => enterNode(node));
    g.addEventListener('click', (e) => { e.stopPropagation(); selectNode(node); });

    nodesLayer.appendChild(g);
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
    const passo = appSettings.parentBlock.radius * 2 + appSettings.grid.size * 2;
    return { x: 60, y: 60 + idx * passo };
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

    const idText = creaSvg('text', {
        x: centro.x, y: centro.y + raggio + 14, 'text-anchor': 'middle', class: 'parent-block-id'
    });
    idText.textContent = opzioni.etichetta;
    g.appendChild(idText);

    const titoloText = creaSvg('text', {
        x: centro.x, y: centro.y + raggio + 27, 'text-anchor': 'middle', class: 'parent-block-title'
    });
    titoloText.textContent = opzioni.sottotitolo || '';
    g.appendChild(titoloText);

    const pinPos = getParentReqPinPos(graph, req.id, idx);
    g.appendChild(createReqPin(pinPos.x, pinPos.y, req, { ownerId, ownerType: 'parent' }, isInterfaccia(req) ? 'cerchio' : 'quadrato'));

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

function getReqPerimeterPos(node: Nodo, reqId: string, idx: number, totalReqs: number): Punto {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;

    if (!node.pinPositions) node.pinPositions = {};
    const pin = node.pinPositions[reqId];
    if (pin) {
        switch (pin.side) {
            case 'top': return { x: pin.ratio * nodeW, y: 0 };
            case 'bottom': return { x: pin.ratio * nodeW, y: nodeH };
            case 'left': return { x: 0, y: pin.ratio * nodeH };
            case 'right': return { x: nodeW, y: pin.ratio * nodeH };
        }
    }

    const isRight = idx % 2 === 1;
    return {
        x: isRight ? nodeW : 0,
        y: (nodeH / (Math.ceil(totalReqs / 2) + 1)) * (Math.floor(idx / 2) + 1)
    };
}

function getCapacitaPos(node: Nodo, idx: number, totalReqs: number): Punto {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;
    return { x: (nodeW / (totalReqs + 1)) * (idx + 1), y: nodeH - MARGINE_PIN_CAPACITA };
}

// Coordinate assolute del pin di un requisito di un nodo (bordo per l'interfaccia, interno per la capacità)
export function getReqCoordinates(node: Nodo, reqId: string): Punto | null {
    const blockDef = getBlockDef(node.type);
    const req = blockDef?.requisiti.find((r) => r.id === reqId);
    if (!blockDef || !req) return null;

    const gruppo = blockDef.requisiti.filter((r) => isInterfaccia(r) === isInterfaccia(req));
    const idx = gruppo.indexOf(req);
    const relPos = isInterfaccia(req)
        ? getReqPerimeterPos(node, reqId, idx, gruppo.length)
        : getCapacitaPos(node, idx, gruppo.length);
    return { x: node.position.x + relPos.x, y: node.position.y + relPos.y };
}

function getEstremoCoords(ownerId: string, reqId: string, ownerType: TipoEstremo, graph: Grafo): Punto | null {
    if (ownerType === 'parent') {
        const tipoPadre = tipoPadreCorrente();
        // Un requisito cliente si disegna solo se ha una posizione salvata
        if (tipoPadre === null && !graph.parentReqPositions?.[reqId]) return null;
        const idx = requisitiPadre(tipoPadre).findIndex((r) => r.id === reqId);
        return idx >= 0 ? getParentReqPinPos(graph, reqId, idx) : null;
    }
    const node = graph.nodes.find((n) => n.id === ownerId);
    return node ? getReqCoordinates(node, reqId) : null;
}

/* --- PIN E DISEGNO DEI COLLEGAMENTI --- */

function createReqPin(cx: number, cy: number, req: Requisito, owner: Proprietario, forma: 'quadrato' | 'cerchio'): SVGElement {
    const raggio = appSettings.requirements.radius;
    const colore = getColoreRequisito(req);
    const pin: SVGElement = forma === 'quadrato'
        ? creaSvg('rect', { x: cx - raggio, y: cy - raggio, width: raggio * 2, height: raggio * 2 })
        : creaSvg('circle', { cx, cy, r: raggio });
    // L'alone sta sul pin solo per i requisiti dei blocchi; per i blocchi tondi sta sul cerchio
    const problema = owner.ownerType === 'node' ? problemaPin(getCurrentLevel().graph, 'node', owner.ownerId, req.id) : null;
    pin.setAttribute('class', problema ? 'node-req-pin problema-coerenza' : 'node-req-pin');
    pin.setAttribute('fill', colore);
    // Gerarchia con una scelta: alone sui pin della catena, gli altri attenuati. Il pin di un blocco tondo
    // segue il suo gruppo (l'alone sta sul cerchio)
    if (catenaAttiva()) {
        if (owner.ownerType === 'node') {
            pin.classList.add(occorrenzaInCatena(chiaveSulCanvas('node', owner.ownerId, req.id)) ? 'pin-catena' : 'fuori-catena');
        }
    } else if (!estremoIncluso(owner.ownerType, owner.ownerId, req.id)) {
        pin.classList.add('fuori-filtro');
    }

    const suggerimento = owner.ownerType === 'node' && isInterfaccia(req) ? '\n[Shift+trascina per spostare la porta]' : '';
    aggiungiTooltip(pin, descriviRequisito(req) + suggerimento + (problema ? `\n\n⚠️ ${problema}` : ''));

    pin.addEventListener('mousedown', (e) => {
        if ((e as MouseEvent).shiftKey) return;
        e.stopPropagation();
        isDrawingEdge = true;
        edgeStartData = { ownerId: owner.ownerId, reqId: req.id, ownerType: owner.ownerType, x: cx, y: cy };

        const temp = creaSvg('path', { class: 'edge-path', stroke: colore });
        temp.style.strokeDasharray = '4,4';
        // La linea segue il mouse: non deve intercettare il rilascio sul pin di destinazione
        temp.style.pointerEvents = 'none';
        edgesLayer.appendChild(temp);
        tempEdgePath = temp;
    });

    pin.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        const inizio = edgeStartData;
        const stessoPin = !!inizio && inizio.ownerId === owner.ownerId &&
            inizio.ownerType === owner.ownerType && inizio.reqId === req.id;
        // Gerarchia: premi e rilascia sullo stesso pin sceglie il suo requisito, senza tirare un filo (AC-2)
        if (isDrawingEdge && stessoPin && gerarchiaAttiva()) {
            cleanupEdgeDrawing();
            scegliDaCanvas(owner, req);
            return;
        }
        if (isDrawingEdge && inizio && !stessoPin) {
            const graph = getCurrentLevel().graph;
            const a: Estremo = { ownerId: inizio.ownerId, reqId: inizio.reqId, ownerType: inizio.ownerType, req: trovaRequisito(inizio.ownerId, inizio.reqId, inizio.ownerType) };
            const b: Estremo = { ownerId: owner.ownerId, reqId: req.id, ownerType: owner.ownerType, req };

            const errore = verificaCollegamento(a, b, graph.edges);
            if (errore) {
                alert(`Impossibile collegare: ${errore}`);
            } else {
                // Una derivazione parte sempre dal requisito del padre
                const [sorgente, destinazione] = b.ownerType === 'parent' ? [b, a] : [a, b];
                graph.edges.push({
                    id: generaId('edge'),
                    source: sorgente.ownerId,
                    sourceHandle: sorgente.reqId,
                    sourceType: sorgente.ownerType,
                    target: destinazione.ownerId,
                    targetHandle: destinazione.reqId,
                    targetType: destinazione.ownerType,
                    waypoints: []
                });
            }
        }
        cleanupEdgeDrawing();
        render();
    });

    return pin;
}

// Linea tratteggiata che segue il mouse mentre disegni un collegamento
window.addEventListener('mousemove', (e) => {
    if (!isDrawingEdge || !tempEdgePath || !edgeStartData) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - zoomState.x) / zoomState.scale;
    const y = (e.clientY - rect.top - zoomState.y) / zoomState.scale;
    const start = getEstremoCoords(edgeStartData.ownerId, edgeStartData.reqId, edgeStartData.ownerType, getCurrentLevel().graph) || edgeStartData;
    tempEdgePath.setAttribute('d', `M ${start.x} ${start.y} L ${x} ${y}`);
});

export function cleanupEdgeDrawing(): void {
    isDrawingEdge = false; edgeStartData = null;
    if (tempEdgePath) { tempEdgePath.remove(); tempEdgePath = null; }
}

/* --- TRASCINAMENTI --- */

// Collega il trascinamento a window finché il tasto non si rilascia
function trascina(drag: (ev: MouseEvent) => void): void {
    function endDrag(): void {
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', endDrag);
    }
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
}

function startResizeDrag(e: MouseEvent, node: Nodo): void {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = node.width || appSettings.node.width;
    const initialH = node.height || appSettings.node.height;

    trascina((ev) => {
        const gridSize = appSettings.grid.size;
        node.width = Math.max(80, Math.round((initialW + (ev.clientX - startX) / zoomState.scale) / gridSize) * gridSize);
        node.height = Math.max(40, Math.round((initialH + (ev.clientY - startY) / zoomState.scale) / gridSize) * gridSize);
        render();
    });
}

function startPinPerimeterDrag(node: Nodo, reqId: string): void {
    const nodeW = node.width || appSettings.node.width;
    const nodeH = node.height || appSettings.node.height;

    trascina((ev) => {
        const coords = getCanvasCoords(ev);
        const relX = coords.x - node.position.x;
        const relY = coords.y - node.position.y;

        const dTop = Math.abs(relY);
        const dBottom = Math.abs(relY - nodeH);
        const dLeft = Math.abs(relX);
        const dRight = Math.abs(relX - nodeW);

        const min = Math.min(dTop, dBottom, dLeft, dRight);
        if (!node.pinPositions) node.pinPositions = {};

        if (min === dTop) node.pinPositions[reqId] = { side: 'top', ratio: Math.max(0, Math.min(1, relX / nodeW)) };
        else if (min === dBottom) node.pinPositions[reqId] = { side: 'bottom', ratio: Math.max(0, Math.min(1, relX / nodeW)) };
        else if (min === dLeft) node.pinPositions[reqId] = { side: 'left', ratio: Math.max(0, Math.min(1, relY / nodeH)) };
        else node.pinPositions[reqId] = { side: 'right', ratio: Math.max(0, Math.min(1, relY / nodeH)) };

        render();
    });
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
