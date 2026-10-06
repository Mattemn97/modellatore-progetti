/* --- DIAGRAMMI: UN LIVELLO DEL MODELLO COME SVG AUTONOMO E COME PNG (spec 0029) --- */
// Stessa geometria del canvas (renderer.ts usa le stesse funzioni di posizione), ma senza zoom, filtri, Gerarchia,
// selezione né gestori: un'immagine pulita di qualsiasi livello, anche non aperto, per l'export e per i documenti.

import { appSettings, appState, getCurrentLevel, pathStack } from './state.js';
import { infoProgetto } from './progetto.js';
import { scaricaFileTesto } from './storage.js';
import { isDerivazione, isInterfaccia, isRequisitoCliente, titoloRequisito } from './model.js';
import { escapeHtml, slugifyId } from './utils.js';
import type { Cliente, Grafo, Impostazioni, Libreria, Nodo, Punto, Requisito, TipoEstremo } from './tipi.js';

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

// Pin di capacità dentro il blocco, lungo il bordo inferiore, relativo al blocco
export function posizioneCapacita(node: Nodo, idx: number, totale: number, imp: Geometria = appSettings): Punto {
    const w = node.width || imp.node.width;
    const h = node.height || imp.node.height;
    return { x: (w / (totale + 1)) * (idx + 1), y: h - MARGINE_PIN_CAPACITA };
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
    const requisitiPadre: Requisito[] = padre ? libreria[padre.type]?.requisiti ?? [] : cliente?.requisiti ?? [];
    const ownerPadre = padre ? padre.id : '__cliente__';
    const centroTondo = (req: Requisito, idx: number): Punto | null => {
        const salvato = graph.parentReqPositions?.[req.id];
        if (!padre && !salvato) return null;
        return salvato ?? posizioneInColonna(idx, imp);
    };
    const nodi = new Map(graph.nodes.map((n) => [n.id, n]));

    function requisito(ownerType: TipoEstremo, ownerId: string, reqId: string): Requisito | null {
        if (ownerType === 'parent') return ownerId === ownerPadre ? requisitiPadre.find((r) => r.id === reqId) ?? null : null;
        const nodo = nodi.get(ownerId);
        return nodo ? libreria[nodo.type]?.requisiti.find((r) => r.id === reqId) ?? null : null;
    }

    function punto(ownerType: TipoEstremo, ownerId: string, reqId: string): Punto | null {
        if (ownerType === 'parent') {
            const idx = requisitiPadre.findIndex((r) => r.id === reqId);
            const req = requisitiPadre[idx];
            const centro = req ? centroTondo(req, idx) : null;
            return centro ? { x: centro.x + raggio, y: centro.y } : null;
        }
        const nodo = nodi.get(ownerId);
        const def = nodo ? libreria[nodo.type] : undefined;
        const req = def?.requisiti.find((r) => r.id === reqId);
        if (!nodo || !def || !req) return null;
        const gruppo = def.requisiti.filter((r) => isInterfaccia(r) === isInterfaccia(req));
        const idx = gruppo.indexOf(req);
        const rel = isInterfaccia(req) ? posizionePorta(nodo, reqId, idx, gruppo.length, imp) : posizioneCapacita(nodo, idx, gruppo.length, imp);
        return { x: nodo.position.x + rel.x, y: nodo.position.y + rel.y };
    }

    function pin(x: number, y: number, req: Requisito, quadrato: boolean): string {
        riquadro.aggiungi(x - raggioPin, y - raggioPin, x + raggioPin, y + raggioPin);
        return quadrato
            ? `<rect x="${num(x - raggioPin)}" y="${num(y - raggioPin)}" width="${raggioPin * 2}" height="${raggioPin * 2}" fill="${colore(req)}" stroke="#ffffff" stroke-width="1.5"/>`
            : `<circle cx="${num(x)}" cy="${num(y)}" r="${raggioPin}" fill="${colore(req)}" stroke="#ffffff" stroke-width="1.5"/>`;
    }

    // Blocchi tondi: requisiti del padre (o cliente con posizione, alla radice)
    requisitiPadre.forEach((req, idx) => {
        const centro = centroTondo(req, idx);
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

    // Fili con gli snodi; tratteggiati quelli di derivazione
    graph.edges.forEach((edge) => {
        const sorgente = requisito(edge.sourceType, edge.source, edge.sourceHandle);
        const inizio = punto(edge.sourceType, edge.source, edge.sourceHandle);
        const fine = punto(edge.targetType, edge.target, edge.targetHandle);
        if (!sorgente || !inizio || !fine) return;
        const punti = [inizio, ...(edge.waypoints || []), fine];
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
        capacita.forEach((req, idx) => {
            const p = posizioneCapacita(nodo, idx, capacita.length, imp);
            parti.push(pin(x + p.x, y + p.y, req, true));
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
