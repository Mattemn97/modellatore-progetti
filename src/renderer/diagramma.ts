/* --- DIAGRAMMI: UN LIVELLO DEL MODELLO COME SVG AUTONOMO E COME PNG (spec 0029) --- */
// Stessa geometria del canvas (renderer.ts usa le stesse funzioni di posizione), ma senza zoom, filtri, Gerarchia,
// selezione né gestori: un'immagine pulita di qualsiasi livello, anche non aperto, per l'export e per i documenti.
// Dalla spec 0035 blocchi e fili hanno lo stile IDV: intestazione e righe dei requisiti, porte ai lati, etichette.

import { appSettings, appState, getCurrentLevel, pathStack } from './state.js';
import { infoProgetto } from './progetto.js';
import { scaricaFileTesto } from './storage.js';
import { isDerivazione, isInterfaccia, isRequisitoCliente, titoloRequisito } from './model.js';
import { escapeHtml, slugifyId } from './utils.js';
import { instrada, type Direzione, type EstremoFilo, type Rettangolo } from './instradamento.js';
import {
    ALTEZZA_RIGA, ALTEZZA_TESTA, coloreDaTesto, formaBlocco, larghezzaTesto, latoSalvato,
    puntoRiga, rigaDi, siglaClasse, tagliaTesto, type FormaBlocco, type Lato
} from './blocco.js';
import { chiavePorta, estremiUsati, percorsoDestinazione, percorsoSorgente } from './porte.js';
import { caviDi, geometriaCavi, percorsoCavo, type EstremiCavo } from './cavi.js';
import type { Cliente, Filo, Grafo, Impostazioni, Libreria, Nodo, Punto, Requisito, TipoEstremo } from './tipi.js';

type Geometria = Pick<Impostazioni, 'node' | 'parentBlock' | 'grid' | 'requirements'> & Partial<Pick<Impostazioni, 'cavi'>>;

const MARGINE = 20;
const FONT = "'Segoe UI', Arial, sans-serif";
const MONO = 'Consolas, monospace';

/* --- Geometria condivisa con il canvas --- */

// Posto idx della colonna a sinistra in cui stanno i blocchi tondi non ancora spostati
export function posizioneInColonna(idx: number, imp: Geometria = appSettings): Punto {
    const passo = imp.parentBlock.radius * 2 + imp.grid.size * 2;
    return { x: 60, y: 60 + idx * passo };
}

/* --- Fili: estremi, ostacoli e percorso (spec 0033), uguali sul canvas e nei diagrammi --- */

// Altezza delle due righe di testo sotto un blocco tondo (id e titolo)
const TESTO_TONDO = 30;

export type StileFilo = 'derivazione' | 'interfaccia' | 'capacita';

export interface ContestoFili {
    ostacoli: Rettangolo[];
    margine: number;
    // Forma del blocco (righe e misure) di un nodo del livello, null se senza definizione
    forma(nodeId: string): FormaBlocco | null;
    // Lato della porta di una riga: salvato o verso l'altro capo del suo primo filo
    lato(nodeId: string, chiave: string): Lato;
    // Centro del pin di un estremo, o null se non si disegna
    centro(ownerType: TipoEstremo, ownerId: string, reqId: string, percorso?: readonly string[]): Punto | null;
    // Pin con verso di uscita e riquadro proprio
    estremo(ownerType: TipoEstremo, ownerId: string, reqId: string, percorso?: readonly string[]): EstremoFilo | null;
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

function riquadroTondo(centro: Punto, imp: Geometria): Rettangolo {
    const r = imp.parentBlock.radius;
    return { x1: centro.x - r, y1: centro.y - r, x2: centro.x + r, y2: centro.y + r + TESTO_TONDO };
}

export function contestoFili(graph: Grafo, padre: Nodo | null, libreria: Libreria, cliente: Cliente | null, imp: Geometria = appSettings): ContestoFili {
    const requisitiPadre = requisitiDelPadre(padre, libreria, cliente);
    const ownerPadre = padre ? padre.id : '__cliente__';
    const nodi = new Map(graph.nodes.map((n) => [n.id, n]));
    const forme = new Map<string, FormaBlocco>();
    const ostacoli: Rettangolo[] = [];
    graph.nodes.forEach((n) => {
        const def = libreria[n.type];
        if (!def) return;
        const f = formaBlocco(n, def, libreria, imp);
        forme.set(n.id, f);
        ostacoli.push({ x1: n.position.x, y1: n.position.y, x2: n.position.x + f.larghezza, y2: n.position.y + f.altezza });
    });
    requisitiPadre.forEach((req, idx) => {
        const c = centroTondo(graph, padre, req.id, idx, imp);
        if (c) ostacoli.push(riquadroTondo(c, imp));
    });

    const tondo = (reqId: string): Punto | null => {
        const idx = requisitiPadre.findIndex((r) => r.id === reqId);
        return idx >= 0 ? centroTondo(graph, padre, reqId, idx, imp) : null;
    };
    const centroNodo = (id: string): Punto | null => {
        const n = nodi.get(id);
        const f = forme.get(id);
        return n && f ? { x: n.position.x + f.larghezza / 2, y: n.position.y + f.altezza / 2 } : null;
    };
    const verso = (ownerType: TipoEstremo, ownerId: string, reqId: string): Punto | null => {
        if (ownerType === 'parent') {
            if (ownerId !== ownerPadre) return null;
            const c = tondo(reqId);
            return c ? { x: c.x + imp.parentBlock.radius, y: c.y } : null;
        }
        return centroNodo(ownerId);
    };

    // Lati automatici: ogni porta guarda l'altro capo del suo primo filo (o lo snodo più vicino di un filo a mano)
    const automatici = new Map<string, Lato>();
    const scegli = (nodeId: string, chiave: string, altro: Punto | null) => {
        const k = `${nodeId}|${chiave}`;
        if (automatici.has(k) || !altro) return;
        const c = centroNodo(nodeId);
        if (c) automatici.set(k, altro.x < c.x ? 'left' : 'right');
    };
    graph.edges.forEach((e) => {
        const wp = e.waypoints ?? [];
        if (e.sourceType === 'node') scegli(e.source, chiavePorta(e.sourceHandle, percorsoSorgente(e)), wp[0] ?? verso(e.targetType, e.target, e.targetHandle));
        if (e.targetType === 'node') scegli(e.target, chiavePorta(e.targetHandle, percorsoDestinazione(e)), wp[wp.length - 1] ?? verso(e.sourceType, e.source, e.sourceHandle));
    });

    function lato(nodeId: string, chiave: string): Lato {
        const n = nodi.get(nodeId);
        return (n && latoSalvato(n, chiave)) || automatici.get(`${nodeId}|${chiave}`) || 'right';
    }

    function centro(ownerType: TipoEstremo, ownerId: string, reqId: string, percorso: readonly string[] = []): Punto | null {
        if (ownerType === 'parent') {
            if (ownerId !== ownerPadre) return null;
            const c = tondo(reqId);
            return c ? { x: c.x + imp.parentBlock.radius, y: c.y } : null;
        }
        const nodo = nodi.get(ownerId);
        const f = forme.get(ownerId);
        const riga = f ? rigaDi(f, reqId, percorso) : undefined;
        return nodo && f && riga ? puntoRiga(nodo, f, riga, lato(ownerId, riga.chiave)) : null;
    }

    function estremo(ownerType: TipoEstremo, ownerId: string, reqId: string, percorso: readonly string[] = []): EstremoFilo | null {
        const punto = centro(ownerType, ownerId, reqId, percorso);
        if (!punto) return null;
        if (ownerType === 'parent') {
            const c = tondo(reqId);
            return { punto, direzione: 'destra', proprio: c ? riquadroTondo(c, imp) : null };
        }
        const nodo = nodi.get(ownerId)!;
        const f = forme.get(ownerId)!;
        const r = { x1: nodo.position.x, y1: nodo.position.y, x2: nodo.position.x + f.larghezza, y2: nodo.position.y + f.altezza };
        const direzione: Direzione = lato(ownerId, chiavePorta(reqId, percorso)) === 'left' ? 'sinistra' : 'destra';
        return { punto, direzione, proprio: r };
    }

    return { ostacoli, margine: imp.grid.size, forma: (id) => forme.get(id) ?? null, lato, centro, estremo };
}

// Spezzata di un filo: con snodi messi a mano retta per retta come sempre, senza snodi il percorso automatico
export function percorsoFilo(edge: Filo, contesto: ContestoFili): Punto[] | null {
    const p1 = contesto.centro(edge.sourceType, edge.source, edge.sourceHandle, percorsoSorgente(edge));
    const p2 = contesto.centro(edge.targetType, edge.target, edge.targetHandle, percorsoDestinazione(edge));
    if (!p1 || !p2) return null;
    if (edge.waypoints?.length) return [p1, ...edge.waypoints, p2];
    const da = contesto.estremo(edge.sourceType, edge.source, edge.sourceHandle, percorsoSorgente(edge));
    const a = contesto.estremo(edge.targetType, edge.target, edge.targetHandle, percorsoDestinazione(edge));
    if (!da || !a) return [p1, p2];
    return instrada(da, a, contesto.ostacoli, contesto.margine);
}

// Stile IDV di un filo: derivazione (puntinata), interfaccia (tratteggiata) o capacità (continua)
export function stileFilo(edge: Filo, sorgente: Requisito | null): StileFilo {
    if (isDerivazione(edge)) return 'derivazione';
    return isInterfaccia(sorgente) ? 'interfaccia' : 'capacita';
}

export const TRATTI: Record<StileFilo, { tratteggio: string | null; spessore: number }> = {
    interfaccia: { tratteggio: '8,4', spessore: 2.3 },
    capacita: { tratteggio: null, spessore: 1.6 },
    derivazione: { tratteggio: '2,4', spessore: 2 }
};

// Punto in cui mettere l'etichetta: il centro del tratto più lungo, e se il tratto è orizzontale
export function puntoEtichetta(punti: Punto[]): { x: number; y: number; orizzontale: boolean } | null {
    let migliore = -1;
    let scelto: { x: number; y: number; orizzontale: boolean } | null = null;
    for (let i = 0; i < punti.length - 1; i++) {
        const a = punti[i]!;
        const b = punti[i + 1]!;
        const l = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (l > migliore) {
            migliore = l;
            scelto = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, orizzontale: Math.abs(a.y - b.y) < Math.abs(a.x - b.x) };
        }
    }
    return scelto;
}

// Testo dell'etichetta di un filo fra blocchi: l'id del requisito di partenza e la classe
export function testoEtichetta(sorgente: Requisito | null, edge: Filo): { id: string; classe: string } {
    const id = sorgente ? (isRequisitoCliente(sorgente) ? sorgente.idCliente : sorgente.id) : edge.sourceHandle;
    return { id, classe: isInterfaccia(sorgente) ? sorgente.tipologia : 'Capacità' };
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

export interface OpzioniDiagramma {
    // Etichette dei fili fra blocchi (id del requisito e classe), come sul canvas
    etichette?: boolean;
    // Strato (spec 0037): fili logici (predefinito) oppure solo i cavi fisici, mai insieme
    strato?: 'interfacce' | 'cavi';
}

// padre: il blocco di cui è l'interno (blocchi tondi dei suoi requisiti) oppure null alla radice (requisiti cliente
// con una posizione). Null se il livello è vuoto
export function svgDiagramma(graph: Grafo, padre: Nodo | null, libreria: Libreria, cliente: Cliente | null, imp: Geometria = appSettings, opzioni: OpzioniDiagramma = {}): Diagramma | null {
    const etichette = opzioni.etichette ?? true;
    const soloCavi = opzioni.strato === 'cavi';
    const raggio = imp.parentBlock.radius;
    const raggioPin = imp.requirements.radius;
    const colore = (req: Requisito | null | undefined): string => {
        if (!isInterfaccia(req)) return imp.requirements.capabilityColor;
        return imp.requirements.typeColors[req.tipologia] || '#555';
    };
    const riquadro = new Riquadro();
    const fili: string[] = [];
    const scritte: string[] = [];
    const tondi: string[] = [];
    const blocchi: string[] = [];

    // Requisiti del padre del livello e dove stanno i loro blocchi tondi
    const requisitiPadre = requisitiDelPadre(padre, libreria, cliente);
    const ownerPadre = padre ? padre.id : '__cliente__';
    const contesto = contestoFili(graph, padre, libreria, cliente, imp);
    // Strato Cavi: piene le porte con un filo cablato
    const dentroCavi = new Set(caviDi(graph).flatMap((c) => c.fili));
    const usati = soloCavi ? estremiUsati({ ...graph, edges: graph.edges.filter((e) => dentroCavi.has(e.id)) }) : estremiUsati(graph);

    function requisito(ownerType: TipoEstremo, ownerId: string, reqId: string, percorso: readonly string[]): Requisito | null {
        if (ownerType === 'parent') return ownerId === ownerPadre ? requisitiPadre.find((r) => r.id === reqId) ?? null : null;
        const f = contesto.forma(ownerId);
        return f ? rigaDi(f, reqId, percorso)?.req ?? null : null;
    }

    function pinTondo(x: number, y: number, req: Requisito): string {
        riquadro.aggiungi(x - raggioPin, y - raggioPin, x + raggioPin, y + raggioPin);
        return isInterfaccia(req)
            ? `<circle cx="${num(x)}" cy="${num(y)}" r="${raggioPin}" fill="${colore(req)}" stroke="#ffffff" stroke-width="1.5"/>`
            : `<rect x="${num(x - raggioPin)}" y="${num(y - raggioPin)}" width="${raggioPin * 2}" height="${raggioPin * 2}" fill="${colore(req)}" stroke="#ffffff" stroke-width="1.5"/>`;
    }

    // Blocchi tondi: requisiti del padre (o cliente con posizione, alla radice)
    requisitiPadre.forEach((req, idx) => {
        const centro = centroTondo(graph, padre, req.id, idx, imp);
        if (!centro || soloCavi) return;
        const ritirato = isRequisitoCliente(req) && req.stato === 'ritirato';
        const etichetta = isRequisitoCliente(req) ? req.idCliente : req.id;
        const sottotitolo = isRequisitoCliente(req) ? titoloRequisito(req) : req.titolo;
        riquadro.aggiungi(centro.x - raggio, centro.y - raggio, centro.x + raggio, centro.y + raggio + 30);
        const meta = Math.max(larghezzaTesto(etichetta, 10, true, true), larghezzaTesto(sottotitolo || '', 10)) / 2;
        riquadro.aggiungi(centro.x - meta, centro.y, centro.x + meta, centro.y);
        tondi.push(`<g><circle cx="${num(centro.x)}" cy="${num(centro.y)}" r="${raggio}" fill="${ritirato ? '#f2f2f2' : '#ffffff'}" stroke="${ritirato ? '#9e9e9e' : colore(req)}" stroke-width="2.5"${ritirato ? ' stroke-dasharray="6,4"' : ''}/>`
            + `<text x="${num(centro.x)}" y="${num(centro.y + raggio + 14)}" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="bold" fill="#16202d">${escapeHtml(etichetta)}</text>`
            + `<text x="${num(centro.x)}" y="${num(centro.y + raggio + 27)}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#445264">${escapeHtml(sottotitolo || '')}</text>`
            + `${pinTondo(centro.x + raggio, centro.y, req)}</g>`);
    });

    // Fili con gli snodi o con il percorso automatico del canvas (spec 0033), nello stile IDV (spec 0035)
    graph.edges.forEach((edge) => {
        if (soloCavi) return;
        const sorgente = requisito(edge.sourceType, edge.source, edge.sourceHandle, percorsoSorgente(edge));
        const punti = sorgente ? percorsoFilo(edge, contesto) : null;
        if (!sorgente || !punti) return;
        punti.forEach((p) => riquadro.aggiungi(p.x, p.y));
        const d = punti.map((p, i) => `${i === 0 ? 'M' : 'L'} ${num(p.x)} ${num(p.y)}`).join(' ');
        const stile = stileFilo(edge, sorgente);
        const tratto = TRATTI[stile];
        fili.push(`<path d="${d}" fill="none" stroke="${colore(sorgente)}" stroke-width="${tratto.spessore}"${tratto.tratteggio ? ` stroke-dasharray="${tratto.tratteggio}"` : ''} stroke-linejoin="round"/>`);
        if (!etichette || stile === 'derivazione') return;
        const posto = puntoEtichetta(punti);
        if (!posto) return;
        const { id, classe } = testoEtichetta(sorgente, edge);
        const largo = larghezzaTesto(id, 10, true, true) + larghezzaTesto(` ${classe}`, 10.5) + 12;
        const x = posto.x - largo / 2;
        const y = posto.y - 8;
        riquadro.aggiungi(x, y, x + largo, y + 16);
        scritte.push(`<g><rect x="${num(x)}" y="${num(y)}" width="${num(largo)}" height="16" rx="2" fill="#ffffff" stroke="${colore(sorgente)}" stroke-opacity="0.7" stroke-width="0.9"/>`
            + `<text x="${num(x + 6)}" y="${num(y + 11.5)}" font-family="${MONO}" font-size="10" font-weight="bold" fill="${colore(sorgente)}">${escapeHtml(id)}`
            + `<tspan font-family="${FONT}" font-size="10.5" font-weight="600" fill="#16202d"> ${escapeHtml(classe)}</tspan></text></g>`);
    });

    // Cavi fisici (spec 0036, 0037): tratto pieno, connettori quadrati, etichetta con sigla e fili
    const geometria = soloCavi ? geometriaCavi(graph, contesto) : new Map<string, EstremiCavo[]>();
    const coloreCavi = imp.cavi?.colore ?? '#37474f';
    caviDi(graph).forEach((cavo) => {
        const tratti = geometria.get(cavo.id);
        if (!tratti?.length) return;
        const percorsi = tratti.map((t) => percorsoCavo(t, contesto));
        percorsi.flat().forEach((p) => riquadro.aggiungi(p.x, p.y));
        const dPath = percorsi.map((pp) => pp.map((p, i) => `${i === 0 ? 'M' : 'L'} ${num(p.x)} ${num(p.y)}`).join(' ')).join(' ');
        fili.push(`<path d="${dPath}" fill="none" stroke="${coloreCavi}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`);
        tratti.flatMap((t) => [t.da, t.a]).forEach((e) => scritte.push(`<rect x="${num(e.punto.x - 5)}" y="${num(e.punto.y - 5)}" width="10" height="10" fill="${coloreCavi}" stroke="#ffffff" stroke-width="1.2"/>`));
        if (!etichette) return;
        const posto = puntoEtichetta(percorsi[Math.floor((percorsi.length - 1) / 2)]!);
        if (!posto) return;
        const n = cavo.fili.length;
        const testo = ` · ${n} ${n === 1 ? 'filo' : 'fili'}`;
        const largo = larghezzaTesto(cavo.sigla, 10, true, true) + larghezzaTesto(testo, 10.5) + 12;
        const x = posto.x - largo / 2;
        const y = posto.y - 8;
        riquadro.aggiungi(x, y, x + largo, y + 16);
        scritte.push(`<g><rect x="${num(x)}" y="${num(y)}" width="${num(largo)}" height="16" rx="2" fill="#ffffff" stroke="${coloreCavi}" stroke-opacity="0.7" stroke-width="0.9"/>`
            + `<text x="${num(x + 6)}" y="${num(y + 11.5)}" font-family="${MONO}" font-size="10" font-weight="bold" fill="${coloreCavi}">${escapeHtml(cavo.sigla)}`
            + `<tspan font-family="${FONT}" font-size="10.5" font-weight="600" fill="#16202d">${escapeHtml(testo)}</tspan></text></g>`);
    });

    // Blocchi come componenti IDV: intestazione, righe dei requisiti, porte ai lati
    graph.nodes.forEach((nodo) => {
        const def = libreria[nodo.type];
        const forma = contesto.forma(nodo.id);
        if (!def || !forma) return;
        const { larghezza: w, altezza: h } = forma;
        const { x, y } = nodo.position;
        riquadro.aggiungi(x - raggioPin, y, x + w + raggioPin, y + h);
        const nome = nodo.label || def.titolo || nodo.id;
        const categoria = [def.categoria, def.sottocategoria].filter(Boolean).join(' · ') || 'Senza categoria';
        const badge = tagliaTesto(def.id.toUpperCase(), 10.5, 70, true, true);
        const largoBadge = larghezzaTesto(badge, 10.5, true, true) + 10;
        const parti = [
            `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="#ffffff"/>`,
            `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${ALTEZZA_TESTA}" fill="#eef2f6"/>`,
            `<text x="${num(x + 10)}" y="${num(y + 18)}" font-family="${FONT}" font-size="12.5" font-weight="bold" fill="#111b28">${escapeHtml(tagliaTesto(nome, 12.5, w - largoBadge - 26, true))}</text>`,
            `<rect x="${num(x + 10)}" y="${num(y + 26)}" width="8" height="8" rx="1.5" fill="${coloreDaTesto(def.categoria || '-')}"/>`,
            `<text x="${num(x + 22)}" y="${num(y + 33.5)}" font-family="${FONT}" font-size="10.5" fill="#445264">${escapeHtml(tagliaTesto(categoria, 10.5, w - 34))}</text>`,
            `<rect x="${num(x + w - largoBadge - 8)}" y="${num(y + 6)}" width="${num(largoBadge)}" height="16" rx="2" fill="#ffffff" stroke="#3f4b59" stroke-width="1"/>`,
            `<text x="${num(x + w - largoBadge / 2 - 8)}" y="${num(y + 17.5)}" text-anchor="middle" font-family="${MONO}" font-size="10.5" font-weight="bold" fill="#14202d">${escapeHtml(badge)}</text>`,
            `<line x1="${num(x)}" y1="${num(y + ALTEZZA_TESTA)}" x2="${num(x + w)}" y2="${num(y + ALTEZZA_TESTA)}" stroke="#3f4b59" stroke-width="0.9"/>`
        ];
        if (!def.requisiti.length) {
            parti.push(`<text x="${num(x + 12)}" y="${num(y + ALTEZZA_TESTA + 14)}" font-family="${FONT}" font-size="11" font-style="italic" fill="#8a94a2">Nessun requisito</text>`);
        }
        if (forma.inizioPropagate !== null) {
            const yf = y + forma.inizioPropagate;
            parti.push(`<line x1="${num(x)}" y1="${num(yf)}" x2="${num(x + w)}" y2="${num(yf)}" stroke="#3f4b59" stroke-width="0.6" stroke-dasharray="3,2"/>`,
                `<text x="${num(x + 10)}" y="${num(yf + 12.5)}" font-family="${FONT}" font-size="9" font-weight="bold" letter-spacing="0.6" fill="#808b99">PORTE DAI BLOCCHI INTERNI</text>`);
        }
        forma.righe.forEach((riga, i) => {
            const cy = y + riga.y;
            if (i % 2 === 1) parti.push(`<rect x="${num(x)}" y="${num(cy - ALTEZZA_RIGA / 2)}" width="${num(w)}" height="${ALTEZZA_RIGA}" fill="#f6f8fa"/>`);
            const sigla = siglaClasse(riga.req);
            const largoSigla = larghezzaTesto(sigla, 9, true, true);
            const testo = riga.propagata ? `↳ ${riga.etichette.join(' › ')} · ${riga.req.titolo}` : riga.req.titolo;
            const largoId = larghezzaTesto(riga.reqId, 10.5, true, true);
            parti.push(`<text x="${num(x + 14)}" y="${num(cy + 3.8)}" font-family="${MONO}" font-size="10.5" font-weight="bold" fill="#1c2735">${escapeHtml(riga.reqId)}</text>`,
                `<text x="${num(x + 20 + largoId)}" y="${num(cy + 3.8)}" font-family="${FONT}" font-size="11" fill="#1c2735">${escapeHtml(tagliaTesto(testo, 11, w - largoId - largoSigla - 44))}</text>`,
                `<text x="${num(x + w - 14)}" y="${num(cy + 3.2)}" text-anchor="end" font-family="${MONO}" font-size="9" font-weight="bold" fill="#6d7887">${escapeHtml(sigla)}</text>`);
        });
        parti.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="none" stroke="#3f4b59" stroke-width="1.1"/>`);
        forma.righe.forEach((riga) => {
            const p = puntoRiga(nodo, forma, riga, contesto.lato(nodo.id, riga.chiave));
            const collegato = usati.has(`${nodo.id}|${riga.chiave}`);
            const c = colore(riga.req);
            const lato = 4.5;
            parti.push(`<rect x="${num(p.x - lato)}" y="${num(p.y - lato)}" width="${lato * 2}" height="${lato * 2}" fill="${collegato ? c : '#ffffff'}" stroke="${collegato ? c : '#5d6a79'}" stroke-width="1.1"${riga.propagata && !collegato ? ' stroke-dasharray="2,1.5"' : ''}/>`);
        });
        blocchi.push(`<g>${parti.join('')}</g>`);
    });

    if (riquadro.vuoto() || (!graph.nodes.length && !tondi.length)) return null;
    const larghezza = Math.ceil(riquadro.x2 - riquadro.x1 + MARGINE * 2);
    const altezza = Math.ceil(riquadro.y2 - riquadro.y1 + MARGINE * 2);
    const dx = num(MARGINE - riquadro.x1);
    const dy = num(MARGINE - riquadro.y1);
    // Ordine dei livelli come sul canvas: fili, blocchi tondi, blocchi, etichette
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezza}" height="${altezza}" viewBox="0 0 ${larghezza} ${altezza}">`
        + `<rect width="${larghezza}" height="${altezza}" fill="#ffffff"/>`
        + `<g transform="translate(${dx}, ${dy})">${fili.join('')}${tondi.join('')}${blocchi.join('')}${scritte.join('')}</g></svg>`;
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

/* --- PULSANTE IMMAGINE: IL LIVELLO APERTO COME SVG O PNG (AC-2) --- */

async function esportaLivello(formato: 'svg' | 'png', strato: 'interfacce' | 'cavi'): Promise<void> {
    const livello = getCurrentLevel();
    const diagramma = svgDiagramma(livello.graph, livello.parentNode, appState.library, appState.cliente, appSettings, { strato });
    if (!diagramma) {
        alert('Il livello è vuoto: niente da esportare.');
        return;
    }
    const info = infoProgetto();
    const progetto = info.slug || slugifyId(pathStack[0]!.label) || 'progetto';
    const nomeLivello = livello.parentNode ? slugifyId(livello.label) || 'livello' : 'radice';
    const nome = `${progetto}-${nomeLivello}${strato === 'cavi' ? '-cavi' : ''}.${formato}`;
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
        void esportaLivello(voce.dataset.formato === 'png' ? 'png' : 'svg', voce.dataset.strato === 'cavi' ? 'cavi' : 'interfacce');
    });
    // Il canvas non si stacca mai: basta il document principale
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target as Node)) chiudi(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) chiudi(); });
}
