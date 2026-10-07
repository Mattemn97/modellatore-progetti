/* --- DIAGRAMMI: UN LIVELLO DEL MODELLO COME SVG AUTONOMO E COME PNG (spec 0029) --- */
// Stessa geometria del canvas (renderer.ts usa le stesse funzioni di posizione), ma senza zoom, filtri, Gerarchia,
// selezione né gestori: un'immagine pulita di qualsiasi livello, anche non aperto, per l'export e per i documenti.

import { appSettings, appState, getCurrentLevel, pathStack } from './state.js';
import { infoProgetto } from './progetto.js';
import { scaricaFileTesto } from './storage.js';
import { isDerivazione, isInterfaccia, isRequisitoCliente, titoloRequisito } from './model.js';
import { escapeHtml, slugifyId } from './utils.js';
import { instrada, puntoDiUscita, type Direzione, type EstremoFilo, type Rettangolo } from './instradamento.js';
import type { Blocco, Cliente, Filo, Grafo, Impostazioni, Libreria, Nodo, Punto, Requisito, TipoEstremo } from './tipi.js';

type Geometria = Pick<Impostazioni, 'node' | 'parentBlock' | 'grid' | 'requirements'>;

// Distanza dal bordo inferiore interno a cui stanno i pin di capacità di un blocco
const MARGINE_PIN_CAPACITA = 12;
const MARGINE = 20;
const FONT = "'Segoe UI', Arial, sans-serif";

/* --- Geometria condivisa con il canvas --- */

// Posto idx della colonna a sinistra in cui stanno i blocchi tondi non ancora spostati
export function posizioneInColonna(idx: number, imp: Geometria = appSettings): Punto {
    const passo = imp.parentBlock.radius * 2 + imp.grid.size * 2;
    return { x: 60, y: 60 + idx * passo };
}

// Porta di interfaccia sul bordo, relativa al blocco: la posizione salvata, altrimenti alternata sinistra e destra
export function posizionePorta(node: Nodo, reqId: string, idx: number, totale: number, imp: Geometria = appSettings): Punto {
    const w = node.width || imp.node.width;
    const h = node.height || imp.node.height;
    const pin = node.pinPositions?.[reqId];
    if (pin) {
        switch (pin.side) {
            case 'top': return { x: pin.ratio * w, y: 0 };
            case 'bottom': return { x: pin.ratio * w, y: h };
            case 'left': return { x: 0, y: pin.ratio * h };
            case 'right': return { x: w, y: pin.ratio * h };
        }
    }
    const destra = idx % 2 === 1;
    return { x: destra ? w : 0, y: (h / (Math.ceil(totale / 2) + 1)) * (Math.floor(idx / 2) + 1) };
}

// Pin di capacità dentro il blocco, lungo il bordo inferiore, relativo al blocco: la disposizione automatica
export function posizioneCapacita(node: Nodo, idx: number, totale: number, imp: Geometria = appSettings): Punto {
    const w = node.width || imp.node.width;
    const h = node.height || imp.node.height;
    return { x: (w / (totale + 1)) * (idx + 1), y: h - MARGINE_PIN_CAPACITA };
}

// Un centro di pin di capacità riportato dentro il rettangolo del blocco (spec 0032, AC-3, AC-4)
export function limitaDentro(p: Punto, node: Nodo, imp: Geometria = appSettings): Punto {
    const w = node.width || imp.node.width;
    const h = node.height || imp.node.height;
    const m = imp.requirements.radius + 2;
    const dentro = (v: number, max: number) => (max < m ? max / 2 : Math.min(Math.max(v, m), max - m));
    return { x: dentro(p.x, w), y: dentro(p.y, h) };
}

// Due pin quadrati si sovrappongono se i loro centri distano meno di un lato su entrambi gli assi
export function pinSovrapposti(a: Punto, b: Punto, imp: Geometria = appSettings): boolean {
    const lato = imp.requirements.radius * 2;
    return Math.abs(a.x - b.x) < lato && Math.abs(a.y - b.y) < lato;
}

// Centri di tutti i pin di capacità di un blocco, relativi al blocco (spec 0032). ids: i requisiti di capacità
// nell'ordine della libreria. Senza posizioni salvate è la disposizione automatica di sempre, identica
export function posizioniCapacita(node: Nodo, ids: string[], imp: Geometria = appSettings): Record<string, Punto> {
    const salvate = node.capabilityPositions ?? {};
    const risultato: Record<string, Punto> = {};
    if (!ids.some((id) => salvate[id])) {
        ids.forEach((id, idx) => { risultato[id] = posizioneCapacita(node, idx, ids.length, imp); });
        return risultato;
    }
    const occupati: Punto[] = [];
    const libero = (p: Punto) => occupati.every((o) => !pinSovrapposti(o, p, imp));
    const passo = imp.grid.size;
    // La casella libera più vicina, per anelli di griglia sempre più larghi
    const cercaLibero = (p: Punto): Punto => {
        if (libero(p)) return p;
        for (let anello = 1; anello <= 30; anello++) {
            for (let dy = -anello; dy <= anello; dy++) {
                for (let dx = -anello; dx <= anello; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== anello) continue;
                    const q = limitaDentro({ x: p.x + dx * passo, y: p.y + dy * passo }, node, imp);
                    if (libero(q)) return q;
                }
            }
        }
        return p;
    };
    const piazza = (id: string, p: Punto) => {
        const q = cercaLibero(p);
        risultato[id] = q;
        occupati.push(q);
    };
    // Prima i pin spostati a mano (vincono loro), poi gli automatici al loro posto di sempre, se è libero
    ids.forEach((id) => { const p = salvate[id]; if (p) piazza(id, limitaDentro(p, node, imp)); });
    ids.forEach((id, idx) => { if (!salvate[id]) piazza(id, posizioneCapacita(node, idx, ids.length, imp)); });
    return risultato;
}

// Centro assoluto del pin di un requisito di un nodo: porta sul bordo per l'interfaccia, dentro per la capacità
export function puntoPin(node: Nodo, def: Blocco, reqId: string, imp: Geometria = appSettings): Punto | null {
    const req = def.requisiti.find((r) => r.id === reqId);
    if (!req) return null;
    let rel: Punto | undefined;
    if (isInterfaccia(req)) {
        const porte = def.requisiti.filter(isInterfaccia);
        rel = posizionePorta(node, reqId, porte.indexOf(req), porte.length, imp);
    } else {
        rel = posizioniCapacita(node, def.requisiti.filter((r) => !isInterfaccia(r)).map((r) => r.id), imp)[reqId];
    }
    return rel ? { x: node.position.x + rel.x, y: node.position.y + rel.y } : null;
}

/* --- Fili: estremi, ostacoli e percorso (spec 0033), uguali sul canvas e nei diagrammi --- */

// Altezza delle due righe di testo sotto un blocco tondo (id e titolo)
const TESTO_TONDO = 30;

export interface ContestoFili {
    ostacoli: Rettangolo[];
    margine: number;
    // Centro del pin di un estremo, o null se non si disegna
    centro(ownerType: TipoEstremo, ownerId: string, reqId: string): Punto | null;
    // Pin con verso di uscita e riquadro proprio; verso: l'altro estremo, per scegliere il lato di un pin di capacità
    estremo(ownerType: TipoEstremo, ownerId: string, reqId: string, verso: Punto | null): EstremoFilo | null;
}

// Requisiti del padre di un livello: del blocco che lo contiene, o i requisiti cliente alla radice
function requisitiDelPadre(padre: Nodo | null, libreria: Libreria, cliente: Cliente | null): Requisito[] {
    return padre ? libreria[padre.type]?.requisiti ?? [] : cliente?.requisiti ?? [];
}

// Centro del blocco tondo del requisito idx del padre: alla radice solo i requisiti cliente con una posizione salvata
function centroTondo(graph: Grafo, padre: Nodo | null, reqId: string, idx: number, imp: Geometria): Punto | null {
    const salvato = graph.parentReqPositions?.[reqId];
    if (!padre && !salvato) return null;
    return salvato ?? posizioneInColonna(idx, imp);
}

function riquadroNodo(node: Nodo, imp: Geometria): Rettangolo {
    const w = node.width || imp.node.width;
    const h = node.height || imp.node.height;
    return { x1: node.position.x, y1: node.position.y, x2: node.position.x + w, y2: node.position.y + h };
}

function riquadroTondo(centro: Punto, imp: Geometria): Rettangolo {
    const r = imp.parentBlock.radius;
    return { x1: centro.x - r, y1: centro.y - r, x2: centro.x + r, y2: centro.y + r + TESTO_TONDO };
}

export function contestoFili(graph: Grafo, padre: Nodo | null, libreria: Libreria, cliente: Cliente | null, imp: Geometria = appSettings): ContestoFili {
    const requisitiPadre = requisitiDelPadre(padre, libreria, cliente);
    const ownerPadre = padre ? padre.id : '__cliente__';
    const nodi = new Map(graph.nodes.map((n) => [n.id, n]));
    const ostacoli: Rettangolo[] = [];
    graph.nodes.forEach((n) => { if (libreria[n.type]) ostacoli.push(riquadroNodo(n, imp)); });
    requisitiPadre.forEach((req, idx) => {
        const c = centroTondo(graph, padre, req.id, idx, imp);
        if (c) ostacoli.push(riquadroTondo(c, imp));
    });

    const tondo = (reqId: string): Punto | null => {
        const idx = requisitiPadre.findIndex((r) => r.id === reqId);
        return idx >= 0 ? centroTondo(graph, padre, reqId, idx, imp) : null;
    };

    function centro(ownerType: TipoEstremo, ownerId: string, reqId: string): Punto | null {
        if (ownerType === 'parent') {
            if (ownerId !== ownerPadre) return null;
            const c = tondo(reqId);
            return c ? { x: c.x + imp.parentBlock.radius, y: c.y } : null;
        }
        const nodo = nodi.get(ownerId);
        const def = nodo ? libreria[nodo.type] : undefined;
        return nodo && def ? puntoPin(nodo, def, reqId, imp) : null;
    }

    function estremo(ownerType: TipoEstremo, ownerId: string, reqId: string, verso: Punto | null): EstremoFilo | null {
        const punto = centro(ownerType, ownerId, reqId);
        if (!punto) return null;
        if (ownerType === 'parent') {
            const c = tondo(reqId);
            return { punto, direzione: 'destra', proprio: c ? riquadroTondo(c, imp) : null };
        }
        const nodo = nodi.get(ownerId)!;
        const r = riquadroNodo(nodo, imp);
        const req = libreria[nodo.type]?.requisiti.find((x) => x.id === reqId);
        // Porta sul bordo: esce perpendicolare al suo lato
        if (isInterfaccia(req)) {
            const direzione: Direzione = punto.x <= r.x1 ? 'sinistra' : punto.x >= r.x2 ? 'destra' : punto.y <= r.y1 ? 'su' : 'giu';
            return { punto, direzione, proprio: r };
        }
        // Pin di capacità: il lato che porta più vicino all'altro estremo, a parità il più vicino al pin
        const lati: Direzione[] = ['giu', 'destra', 'sinistra', 'su'];
        let scelta: Direzione = 'giu';
        let migliore = Infinity;
        lati.forEach((direzione) => {
            const uscita = puntoDiUscita({ punto, direzione, proprio: r }, imp.grid.size);
            const tratto = Math.abs(uscita.x - punto.x) + Math.abs(uscita.y - punto.y);
            const resto = verso ? Math.abs(verso.x - uscita.x) + Math.abs(verso.y - uscita.y) : 0;
            if (tratto + resto < migliore) {
                migliore = tratto + resto;
                scelta = direzione;
            }
        });
        return { punto, direzione: scelta, proprio: r };
    }

    return { ostacoli, margine: imp.grid.size, centro, estremo };
}

// Spezzata di un filo: con snodi messi a mano retta per retta come sempre, senza snodi il percorso automatico
export function percorsoFilo(edge: Filo, contesto: ContestoFili): Punto[] | null {
    const p1 = contesto.centro(edge.sourceType, edge.source, edge.sourceHandle);
    const p2 = contesto.centro(edge.targetType, edge.target, edge.targetHandle);
    if (!p1 || !p2) return null;
    if (edge.waypoints?.length) return [p1, ...edge.waypoints, p2];
    const da = contesto.estremo(edge.sourceType, edge.source, edge.sourceHandle, p2);
    const a = contesto.estremo(edge.targetType, edge.target, edge.targetHandle, p1);
    if (!da || !a) return [p1, p2];
    return instrada(da, a, contesto.ostacoli, contesto.margine);
}

/* --- SVG di un livello --- */

export interface Diagramma {
    svg: string;
    larghezza: number;
    altezza: number;
}

class Riquadro {
    x1 = Infinity;
    y1 = Infinity;
    x2 = -Infinity;
    y2 = -Infinity;

    aggiungi(x1: number, y1: number, x2 = x1, y2 = y1): void {
        this.x1 = Math.min(this.x1, x1);
        this.y1 = Math.min(this.y1, y1);
        this.x2 = Math.max(this.x2, x2);
        this.y2 = Math.max(this.y2, y2);
    }

    vuoto(): boolean {
        return this.x1 === Infinity;
    }
}

const num = (n: number): string => String(Math.round(n * 100) / 100);
// Larghezza stimata di un testo, per il riquadro dell'immagine (non serve esatta: c'è il margine)
const larghezzaTesto = (testo: string, px: number): number => testo.length * px * 0.6;

// padre: il blocco di cui è l'interno (blocchi tondi dei suoi requisiti) oppure null alla radice (requisiti cliente
// con una posizione). Null se il livello è vuoto
export function svgDiagramma(graph: Grafo, padre: Nodo | null, libreria: Libreria, cliente: Cliente | null, imp: Geometria = appSettings): Diagramma | null {
    const raggio = imp.parentBlock.radius;
    const raggioPin = imp.requirements.radius;
    const colore = (req: Requisito | null | undefined): string => {
        if (!isInterfaccia(req)) return imp.requirements.capabilityColor;
        return imp.requirements.typeColors[req.tipologia] || '#555';
    };
    const riquadro = new Riquadro();
    const fili: string[] = [];
    const tondi: string[] = [];
    const blocchi: string[] = [];

    // Requisiti del padre del livello e dove stanno i loro blocchi tondi
    const requisitiPadre = requisitiDelPadre(padre, libreria, cliente);
    const ownerPadre = padre ? padre.id : '__cliente__';
    const nodi = new Map(graph.nodes.map((n) => [n.id, n]));
    const contesto = contestoFili(graph, padre, libreria, cliente, imp);

    function requisito(ownerType: TipoEstremo, ownerId: string, reqId: string): Requisito | null {
        if (ownerType === 'parent') return ownerId === ownerPadre ? requisitiPadre.find((r) => r.id === reqId) ?? null : null;
        const nodo = nodi.get(ownerId);
        return nodo ? libreria[nodo.type]?.requisiti.find((r) => r.id === reqId) ?? null : null;
    }

    function pin(x: number, y: number, req: Requisito, quadrato: boolean): string {
        riquadro.aggiungi(x - raggioPin, y - raggioPin, x + raggioPin, y + raggioPin);
        return quadrato
            ? `<rect x="${num(x - raggioPin)}" y="${num(y - raggioPin)}" width="${raggioPin * 2}" height="${raggioPin * 2}" fill="${colore(req)}" stroke="#ffffff" stroke-width="1.5"/>`
            : `<circle cx="${num(x)}" cy="${num(y)}" r="${raggioPin}" fill="${colore(req)}" stroke="#ffffff" stroke-width="1.5"/>`;
    }

    // Blocchi tondi: requisiti del padre (o cliente con posizione, alla radice)
    requisitiPadre.forEach((req, idx) => {
        const centro = centroTondo(graph, padre, req.id, idx, imp);
        if (!centro) return;
        const ritirato = isRequisitoCliente(req) && req.stato === 'ritirato';
        const etichetta = isRequisitoCliente(req) ? req.idCliente : req.id;
        const sottotitolo = isRequisitoCliente(req) ? titoloRequisito(req) : req.titolo;
        riquadro.aggiungi(centro.x - raggio, centro.y - raggio, centro.x + raggio, centro.y + raggio + 30);
        const meta = Math.max(larghezzaTesto(etichetta, 10), larghezzaTesto(sottotitolo || '', 10)) / 2;
        riquadro.aggiungi(centro.x - meta, centro.y, centro.x + meta, centro.y);
        tondi.push(`<g><circle cx="${num(centro.x)}" cy="${num(centro.y)}" r="${raggio}" fill="${ritirato ? '#f2f2f2' : '#ffffff'}" stroke="${ritirato ? '#9e9e9e' : colore(req)}" stroke-width="3"${ritirato ? ' stroke-dasharray="6,4"' : ''}/>`
            + `<text x="${num(centro.x)}" y="${num(centro.y + raggio + 14)}" text-anchor="middle" font-family="Consolas, monospace" font-size="10" font-weight="bold" fill="#333">${escapeHtml(etichetta)}</text>`
            + `<text x="${num(centro.x)}" y="${num(centro.y + raggio + 27)}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#555">${escapeHtml(sottotitolo || '')}</text>`
            + `${pin(centro.x + raggio, centro.y, req, !isInterfaccia(req))}</g>`);
    });

    // Fili con gli snodi o con il percorso automatico del canvas (spec 0033); tratteggiati quelli di derivazione
    graph.edges.forEach((edge) => {
        const sorgente = requisito(edge.sourceType, edge.source, edge.sourceHandle);
        const punti = sorgente ? percorsoFilo(edge, contesto) : null;
        if (!sorgente || !punti) return;
        punti.forEach((p) => riquadro.aggiungi(p.x, p.y));
        const d = punti.map((p, i) => `${i === 0 ? 'M' : 'L'} ${num(p.x)} ${num(p.y)}`).join(' ');
        fili.push(`<path d="${d}" fill="none" stroke="${colore(sorgente)}" stroke-width="2.5"${isDerivazione(edge) ? ' stroke-dasharray="8,4"' : ''}/>`);
    });

    // Blocchi con nome, porte sul bordo e pin di capacità
    graph.nodes.forEach((nodo) => {
        const def = libreria[nodo.type];
        if (!def) return;
        const w = nodo.width || imp.node.width;
        const h = nodo.height || imp.node.height;
        const { x, y } = nodo.position;
        riquadro.aggiungi(x, y, x + w, y + h);
        const nome = nodo.label || def.titolo || nodo.id;
        const parti = [
            `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="8" ry="8" fill="#ffffff" stroke="#333333" stroke-width="2"/>`,
            `<text x="${num(x + w / 2)}" y="${num(y + h / 2 + 5)}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="bold" fill="#333">${escapeHtml(nome)}</text>`
        ];
        const interfacce = def.requisiti.filter(isInterfaccia);
        interfacce.forEach((req, idx) => {
            const p = posizionePorta(nodo, req.id, idx, interfacce.length, imp);
            parti.push(pin(x + p.x, y + p.y, req, false));
        });
        const capacita = def.requisiti.filter((r) => !isInterfaccia(r));
        const posizioni = posizioniCapacita(nodo, capacita.map((r) => r.id), imp);
        capacita.forEach((req) => {
            const p = posizioni[req.id];
            if (p) parti.push(pin(x + p.x, y + p.y, req, true));
        });
        blocchi.push(`<g>${parti.join('')}</g>`);
    });

    if (riquadro.vuoto() || (!graph.nodes.length && !tondi.length)) return null;
    const larghezza = Math.ceil(riquadro.x2 - riquadro.x1 + MARGINE * 2);
    const altezza = Math.ceil(riquadro.y2 - riquadro.y1 + MARGINE * 2);
    const dx = num(MARGINE - riquadro.x1);
    const dy = num(MARGINE - riquadro.y1);
    // Ordine dei livelli come sul canvas: fili, blocchi tondi, blocchi
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezza}" height="${altezza}" viewBox="0 0 ${larghezza} ${altezza}">`
        + `<rect width="${larghezza}" height="${altezza}" fill="#ffffff"/>`
        + `<g transform="translate(${dx}, ${dy})">${fili.join('')}${tondi.join('')}${blocchi.join('')}</g></svg>`;
    return { svg, larghezza, altezza };
}

/* --- PNG (nella pagina: serve un canvas) --- */

export async function svgInPng(diagramma: Diagramma, scala = 2): Promise<Uint8Array> {
    const url = URL.createObjectURL(new Blob([diagramma.svg], { type: 'image/svg+xml' }));
    try {
        const immagine = new Image();
        immagine.src = url;
        await immagine.decode();
        const tela = document.createElement('canvas');
        tela.width = Math.ceil(diagramma.larghezza * scala);
        tela.height = Math.ceil(diagramma.altezza * scala);
        const contesto = tela.getContext('2d');
        if (!contesto) throw new Error('disegno non disponibile');
        contesto.fillStyle = '#ffffff';
        contesto.fillRect(0, 0, tela.width, tela.height);
        contesto.drawImage(immagine, 0, 0, tela.width, tela.height);
        const blob = await new Promise<Blob>((risolvi, rifiuta) => tela.toBlob((b) => (b ? risolvi(b) : rifiuta(new Error('PNG non creato'))), 'image/png'));
        return new Uint8Array(await blob.arrayBuffer());
    } finally {
        URL.revokeObjectURL(url);
    }
}

/* --- Diagrammi del progetto per i documenti --- */

// Il primo nodo (in ordine di visita) di ogni tipo di blocco con un interno non vuoto
export function interniDeiBlocchi(radice: Grafo): Map<string, Nodo> {
    const trovati = new Map<string, Nodo>();
    const visita = (graph: Grafo): void => graph.nodes.forEach((nodo) => {
        if (nodo.internal_graph?.nodes?.length && !trovati.has(nodo.type)) trovati.set(nodo.type, nodo);
        if (nodo.internal_graph) visita(nodo.internal_graph);
    });
    visita(radice);
    return trovati;
}

/* --- PULSANTE 🖼 IMMAGINE: IL LIVELLO APERTO COME SVG O PNG (AC-2) --- */

async function esportaLivello(formato: 'svg' | 'png'): Promise<void> {
    const livello = getCurrentLevel();
    const diagramma = svgDiagramma(livello.graph, livello.parentNode, appState.library, appState.cliente);
    if (!diagramma) {
        alert('Il livello è vuoto: niente da esportare.');
        return;
    }
    const info = infoProgetto();
    const progetto = info.slug || slugifyId(pathStack[0]!.label) || 'progetto';
    const nomeLivello = livello.parentNode ? slugifyId(livello.label) || 'livello' : 'radice';
    const nome = `${progetto}-${nomeLivello}.${formato}`;
    try {
        if (formato === 'svg') scaricaFileTesto(diagramma.svg, nome, 'image/svg+xml');
        else scaricaFileTesto(await svgInPng(diagramma) as Uint8Array<ArrayBuffer>, nome, 'image/png');
    } catch (e) {
        alert(`Immagine non esportata: ${e instanceof Error ? e.message : String(e)}`);
    }
}

export function initDiagrammi(): void {
    const pulsante = document.getElementById('btnImmagine');
    const menu = document.getElementById('menuImmagine');
    if (!pulsante || !menu) return;
    const chiudi = (): void => {
        menu.hidden = true;
        pulsante.setAttribute('aria-expanded', 'false');
    };
    pulsante.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        pulsante.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', (e) => {
        const voce = (e.target as Element).closest<HTMLElement>('[data-formato]');
        if (!voce) return;
        chiudi();
        void esportaLivello(voce.dataset.formato === 'png' ? 'png' : 'svg');
    });
    // Il canvas non si stacca mai: basta il document principale
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target as Node)) chiudi(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) chiudi(); });
}
