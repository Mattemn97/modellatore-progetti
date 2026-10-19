/* --- TABELLE IDV: COMPONENTI, INTERFACCE, REQUISITI, DASHBOARD E CONTATORI DELLA TESTATA (spec 0035) --- */
// Le sezioni a tabella dell'IDV Interface Manager sul modello del Modellatore: ogni istanza di blocco, ogni filo e ogni
// requisito di libreria di tutto il progetto, a ogni livello. I calcoli sono puri (elenco*, riepilogo*); i pannelli
// si ridisegnano dopo una raffica di modifiche e solo se si vedono, come la Matrice (spec 0022).

import { appState, appSettings, pathStack, getCurrentLevel } from './state.js';
import { render, centraVista, centroNodo, selezionaFilo, selezionaCavo, impostaStrato } from './renderer.js';
import { cavoDelFilo, elencoCavi, statoCablaggio, type RigaCavo } from './cavi.js';
import { apriPercorso } from './progetto.js';
import { openLibraryBlock, selectNode } from './inspector.js';
import { calcolaCoerenza, cambiaModalitaCoerenza, coerenzaAttiva, type TipoProblema } from './coerenza.js';
import { allaVista, mostraPannello, pannelloAperto, pannelloVisibile, type IdPannello } from './pannelli.js';
import { CAPACITA, getClasseRequisito, getColoreRequisito, isDerivazione, isInterfaccia, isRequisitoCliente, titoloRequisito, visitaDerivazioni, type Estremo } from './model.js';
import { coloreDaTesto } from './blocco.js';
import { percorsoDestinazione, percorsoSorgente, portePropagate, risolviPorta } from './porte.js';
import { scaricaFileTesto } from './storage.js';
import { escapeHtml } from './utils.js';
import type { Blocco, Cliente, Filo, Grafo, Libreria, Nodo, RequisitoLibreria } from './tipi.js';

/* --- CALCOLI PURI --- */

interface LivelloVisitato {
    graph: Grafo;
    // Id dei nodi aperti dalla radice fino a questo livello, e le loro etichette
    percorso: string[];
    etichette: string[];
    padre: Nodo | null;
}

function visitaLivelli(radice: Grafo, azione: (livello: LivelloVisitato) => void): void {
    const visita = (graph: Grafo, percorso: string[], etichette: string[], padre: Nodo | null): void => {
        azione({ graph, percorso, etichette, padre });
        (graph.nodes ?? []).forEach((n) => {
            if (n.internal_graph) visita(n.internal_graph, [...percorso, n.id], [...etichette, n.label || n.id], n);
        });
    };
    visita(radice, [], [], null);
}

// Ogni estremo di filo che usa un requisito di un nodo, a qualsiasi livello: "idNodoProprietario|reqId"
// (per una porta propagata il proprietario è il blocco interno, spec 0035)
export function requisitiUsati(radice: Grafo, libreria: Libreria): Set<string> {
    const usati = new Set<string>();
    visitaLivelli(radice, ({ graph }) => {
        const perId = new Map((graph.nodes ?? []).map((n) => [n.id, n]));
        (graph.edges ?? []).forEach((e) => {
            const segna = (tipo: Filo['sourceType'], id: string, reqId: string, percorso: string[]) => {
                if (tipo !== 'node') return;
                const nodo = perId.get(id);
                if (!nodo) return;
                const proprietario = percorso.length ? risolviPorta(nodo, reqId, percorso, libreria)?.proprietario : nodo;
                if (proprietario) usati.add(`${proprietario.id}|${reqId}`);
            };
            segna(e.sourceType, e.source, e.sourceHandle, percorsoSorgente(e));
            segna(e.targetType, e.target, e.targetHandle, percorsoDestinazione(e));
        });
    });
    return usati;
}

export interface RigaComponente {
    chiave: string;
    // Id dei nodi aperti fino al livello del blocco (per apriPercorso) e le loro etichette
    percorso: string[];
    livello: string;
    nodo: Nodo;
    def: Blocco | null;
    interfacce: Array<{ id: string; titolo: string; usata: boolean; tipologia: string }>;
    capacita: number;
    porteLibere: number;
    propagate: number;
    fili: number;
    interni: number;
}

export function elencoComponenti(radice: Grafo, libreria: Libreria, nomeRadice = 'Radice'): RigaComponente[] {
    const usati = requisitiUsati(radice, libreria);
    const righe: RigaComponente[] = [];
    visitaLivelli(radice, ({ graph, percorso, etichette }) => {
        (graph.nodes ?? []).forEach((nodo) => {
            const def = libreria[nodo.type] ?? null;
            const reqs = def?.requisiti ?? [];
            const interfacce = reqs.filter(isInterfaccia).map((r) => ({ id: r.id, titolo: r.titolo, usata: usati.has(`${nodo.id}|${r.id}`), tipologia: r.tipologia ?? '' }));
            righe.push({
                chiave: [...percorso, nodo.id].join('/'),
                percorso,
                livello: etichette.length ? etichette.join(' › ') : nomeRadice,
                nodo, def, interfacce,
                capacita: reqs.length - interfacce.length,
                porteLibere: interfacce.filter((p) => !p.usata).length,
                propagate: def ? portePropagate(nodo, libreria).length : 0,
                fili: (graph.edges ?? []).filter((e) => (e.sourceType === 'node' && e.source === nodo.id) || (e.targetType === 'node' && e.target === nodo.id)).length,
                interni: nodo.internal_graph?.nodes?.length ?? 0
            });
        });
    });
    return righe;
}

export interface LatoInterfaccia {
    blocco: string;
    reqId: string;
    titolo: string;
    // Nodi interni attraversati da una porta propagata (vuoto altrimenti)
    dentro: string[];
    tondo: boolean;
}

export interface RigaInterfaccia {
    chiave: string;
    percorso: string[];
    livello: string;
    edge: Filo;
    tipo: 'derivazione' | 'interfaccia' | 'capacita';
    classe: string;
    colore: string;
    da: LatoInterfaccia;
    a: LatoInterfaccia;
    propagata: boolean;
    valido: boolean;
    motivo: string;
    manuale: boolean;
    // Sigla del cavo che contiene il filo (spec 0036), vuota se nessuno
    cavo: string;
}

export function elencoInterfacce(radice: Grafo, libreria: Libreria, cliente: Cliente | null, nomeRadice = 'Radice'): RigaInterfaccia[] {
    const righe: RigaInterfaccia[] = [];
    visitaDerivazioni(radice, libreria, cliente, {
        filo(ctx, edge, esito) {
            const perId = new Map(ctx.graph.nodes.map((n) => [n.id, n]));
            const lato = (e: Estremo): LatoInterfaccia => {
                const reqId = e.reqId;
                const titolo = titoloRequisito(e.req);
                const id = e.req && isRequisitoCliente(e.req) ? e.req.idCliente : reqId;
                if (e.ownerType === 'parent') {
                    return { blocco: ctx.nodoPadre ? `${ctx.nodoPadre.label || ctx.nodoPadre.id} (padre)` : 'Cliente', reqId: id, titolo, dentro: [], tondo: true };
                }
                const nodo = perId.get(e.ownerId);
                const dentro = nodo && e.percorso?.length ? risolviPorta(nodo, reqId, e.percorso, libreria)?.etichette ?? e.percorso : [];
                return { blocco: nodo ? nodo.label || nodo.id : e.ownerId, reqId: id, titolo, dentro, tondo: false };
            };
            const sorgente = esito.a.req;
            const derivazione = isDerivazione(edge);
            righe.push({
                chiave: [...ctx.percorso, edge.id].join('/'),
                percorso: ctx.percorso,
                livello: ctx.etichette.length ? ctx.etichette.join(' › ') : nomeRadice,
                edge,
                tipo: derivazione ? 'derivazione' : isInterfaccia(sorgente) ? 'interfaccia' : 'capacita',
                classe: sorgente ? getClasseRequisito(sorgente) : '—',
                colore: sorgente ? coloreClasse(getClasseRequisito(sorgente)) : '#8a94a2',
                da: lato(esito.a),
                a: lato(esito.b),
                propagata: percorsoSorgente(edge).length > 0 || percorsoDestinazione(edge).length > 0,
                valido: esito.stato !== 'nonValido',
                motivo: esito.motivo ?? '',
                manuale: (edge.waypoints?.length ?? 0) > 0,
                cavo: cavoDelFilo(ctx.graph, edge.id)?.sigla ?? ''
            });
        }
    });
    return righe;
}

function coloreClasse(classe: string): string {
    if (classe === CAPACITA) return appSettings?.requirements.capabilityColor ?? '#8e44ad';
    return appSettings?.requirements.typeColors[classe] ?? '#555';
}

export interface RigaRequisito {
    chiave: string;
    blocco: Blocco;
    req: RequisitoLibreria;
    classe: string;
    documenti: string[];
    istanze: number;
    collegate: number;
}

export function elencoRequisiti(radice: Grafo, libreria: Libreria): RigaRequisito[] {
    const usati = requisitiUsati(radice, libreria);
    const istanze = new Map<string, Nodo[]>();
    visitaLivelli(radice, ({ graph }) => (graph.nodes ?? []).forEach((n) => {
        const elenco = istanze.get(n.type) ?? [];
        elenco.push(n);
        istanze.set(n.type, elenco);
    }));
    const righe: RigaRequisito[] = [];
    Object.values(libreria).forEach((blocco) => blocco.requisiti.forEach((req) => {
        const nodi = istanze.get(blocco.id) ?? [];
        righe.push({
            chiave: `${blocco.id}/${req.id}`,
            blocco, req,
            classe: getClasseRequisito(req),
            documenti: [...new Set(req.testiExport.map((t) => t.documento).filter(Boolean))],
            istanze: nodi.length,
            collegate: nodi.filter((n) => usati.has(`${n.id}|${req.id}`)).length
        });
    }));
    return righe;
}

export interface RiepilogoDashboard {
    blocchiLibreria: number;
    requisitiLibreria: number;
    istanze: number;
    livelli: number;
    fili: number;
    derivazioni: number;
    porteLibere: number;
    porteInterfaccia: number;
    propagate: number;
    clienteTotale: number;
    clienteCoperti: number;
    problemi: Record<string, number>;
    totaleProblemi: number;
    perClasse: Array<{ classe: string; colore: string; fili: number }>;
    perCategoria: Array<{ categoria: string; colore: string; istanze: number }>;
}

// Gruppi della scheda Coerenza nella Dashboard: stesso ordine e stessi nomi (spec 0004)
export const GRUPPI_PROBLEMI: Array<{ id: string; titolo: string; tipi: TipoProblema[]; gravita: 'error' | 'warning' }> = [
    { id: 'clienteSenzaFigli', titolo: 'Requisiti cliente senza figli', tipi: ['clienteSenzaFigli'], gravita: 'error' },
    { id: 'senzaPadre', titolo: 'Requisiti senza padre', tipi: ['senzaPadre'], gravita: 'warning' },
    { id: 'senzaFigli', titolo: 'Requisiti senza figli', tipi: ['senzaFigli'], gravita: 'warning' },
    { id: 'filoDaRitirato', titolo: 'Fili da requisiti ritirati', tipi: ['filoDaRitirato'], gravita: 'warning' },
    { id: 'daRiparare', titolo: 'Da riparare (fili e blocchi)', tipi: ['bloccoSenzaDefinizione', 'filoNonValido'], gravita: 'error' }
];

export function riepilogoDashboard(radice: Grafo, libreria: Libreria, cliente: Cliente | null): RiepilogoDashboard {
    const componenti = elencoComponenti(radice, libreria);
    const interfacce = elencoInterfacce(radice, libreria, cliente);
    let livelli = 0;
    visitaLivelli(radice, ({ graph }) => { if (graph.nodes?.length) livelli++; });
    const coerenza = calcolaCoerenza(radice, libreria, cliente);
    const problemi: Record<string, number> = {};
    GRUPPI_PROBLEMI.forEach((g) => { problemi[g.id] = coerenza.problemi.filter((p) => g.tipi.includes(p.tipo)).length; });
    const perClasse = new Map<string, { colore: string; fili: number }>();
    interfacce.filter((r) => r.tipo !== 'derivazione').forEach((r) => {
        const v = perClasse.get(r.classe) ?? { colore: r.colore, fili: 0 };
        v.fili++;
        perClasse.set(r.classe, v);
    });
    const perCategoria = new Map<string, number>();
    componenti.forEach((c) => {
        const cat = c.def?.categoria || 'Senza categoria';
        perCategoria.set(cat, (perCategoria.get(cat) ?? 0) + 1);
    });
    const attivi = (cliente?.requisiti ?? []).filter((r) => r.stato === 'attivo');
    const senzaFigli = new Set(coerenza.problemi.filter((p) => p.tipo === 'clienteSenzaFigli').map((p) => p.reqId));
    return {
        blocchiLibreria: Object.keys(libreria).length,
        requisitiLibreria: Object.values(libreria).reduce((n, b) => n + b.requisiti.length, 0),
        istanze: componenti.length,
        livelli,
        fili: interfacce.length,
        derivazioni: interfacce.filter((r) => r.tipo === 'derivazione').length,
        porteLibere: componenti.reduce((n, c) => n + c.porteLibere, 0),
        porteInterfaccia: componenti.reduce((n, c) => n + c.interfacce.length, 0),
        propagate: componenti.reduce((n, c) => n + c.propagate, 0),
        clienteTotale: attivi.length,
        clienteCoperti: attivi.filter((r) => !senzaFigli.has(r.id)).length,
        problemi,
        totaleProblemi: coerenza.problemi.length,
        perClasse: [...perClasse.entries()].map(([classe, v]) => ({ classe, ...v })).sort((a, b) => b.fili - a.fili || a.classe.localeCompare(b.classe, 'it')),
        perCategoria: [...perCategoria.entries()].map(([categoria, istanze]) => ({ categoria, istanze, colore: coloreDaTesto(categoria) })).sort((a, b) => b.istanze - a.istanze)
    };
}

// Matrice N² di un livello: per ogni coppia di blocchi le classi dei fili che li collegano (porte propagate comprese)
export function matriceN2(graph: Grafo, libreria: Libreria): { nodi: Nodo[]; celle: Map<string, Map<string, number>> } {
    const nodi = (graph.nodes ?? []).filter((n) => libreria[n.type]);
    const celle = new Map<string, Map<string, number>>();
    const perId = new Map(nodi.map((n) => [n.id, n]));
    (graph.edges ?? []).forEach((e) => {
        if (e.sourceType !== 'node' || e.targetType !== 'node' || !perId.has(e.source) || !perId.has(e.target)) return;
        const nodo = perId.get(e.source)!;
        const req = percorsoSorgente(e).length
            ? risolviPorta(nodo, e.sourceHandle, percorsoSorgente(e), libreria)?.req
            : libreria[nodo.type]?.requisiti.find((r) => r.id === e.sourceHandle);
        const classe = req ? getClasseRequisito(req) : '?';
        for (const [x, y] of [[e.source, e.target], [e.target, e.source]] as const) {
            const k = `${x}|${y}`;
            const cella = celle.get(k) ?? new Map<string, number>();
            cella.set(classe, (cella.get(classe) ?? 0) + 1);
            celle.set(k, cella);
        }
    });
    return { nodi, celle };
}

/* --- TABELLA GENERICA: ORDINAMENTO PER COLONNA, CLIC SULLA RIGA, CSV --- */

interface Colonna<R> {
    chiave: string;
    titolo: string;
    // Valore per ordinare, cercare ed esportare
    valore: (r: R) => string | number;
    html?: (r: R) => string;
    classe?: string;
}

interface StatoTabella {
    ordine: { chiave: string; verso: 1 | -1 } | null;
    ricerca: string;
}

const confronto = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

function ordina<R>(righe: R[], colonne: Colonna<R>[], stato: StatoTabella): R[] {
    const ordine = stato.ordine;
    const col = ordine ? colonne.find((c) => c.chiave === ordine.chiave) : undefined;
    if (!ordine || !col) return righe;
    return [...righe].sort((a, b) => {
        const va = col.valore(a);
        const vb = col.valore(b);
        const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : confronto.compare(String(va), String(vb));
        return d * ordine.verso;
    });
}

function cerca<R>(righe: R[], colonne: Colonna<R>[], testo: string): R[] {
    const t = testo.trim().toLowerCase();
    if (!t) return righe;
    return righe.filter((r) => colonne.some((c) => String(c.valore(r)).toLowerCase().includes(t)));
}

function disegnaTabella<R>(contenitore: HTMLElement, colonne: Colonna<R>[], righe: R[], stato: StatoTabella, vuoto: string, alClic: (r: R) => void, ridisegna: () => void): void {
    if (!righe.length) {
        contenitore.innerHTML = `<div class="empty">${escapeHtml(vuoto)}</div>`;
        return;
    }
    const testa = colonne.map((c) => {
        const segno = stato.ordine?.chiave === c.chiave ? (stato.ordine.verso === 1 ? '▲' : '▼') : '↕';
        return `<th><button type="button" class="th-btn" data-colonna="${escapeHtml(c.chiave)}">${escapeHtml(c.titolo)} <span class="sort">${segno}</span></button></th>`;
    }).join('');
    const corpo = righe.map((r, i) => `<tr data-indice="${i}">${colonne.map((c) =>
        `<td${c.classe ? ` class="${c.classe}"` : ''}>${c.html ? c.html(r) : escapeHtml(String(c.valore(r)))}</td>`).join('')}</tr>`).join('');
    contenitore.innerHTML = `<table class="grid"><thead><tr>${testa}</tr></thead><tbody>${corpo}</tbody></table>`;
    contenitore.querySelectorAll<HTMLElement>('[data-colonna]').forEach((b) => b.addEventListener('click', () => {
        const chiave = b.dataset.colonna ?? '';
        stato.ordine = stato.ordine?.chiave === chiave ? { chiave, verso: stato.ordine.verso === 1 ? -1 : 1 } : { chiave, verso: 1 };
        ridisegna();
    }));
    contenitore.querySelector('tbody')?.addEventListener('click', (e) => {
        const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-indice]');
        const riga = tr ? righe[Number(tr.dataset.indice)] : undefined;
        if (riga) alClic(riga);
    });
}

function inCsv<R>(colonne: Colonna<R>[], righe: R[]): string {
    const cella = (v: string | number) => {
        const s = String(v);
        return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '﻿' + [colonne.map((c) => cella(c.titolo)).join(';'), ...righe.map((r) => colonne.map((c) => cella(c.valore(r))).join(';'))].join('\r\n');
}

/* --- PANNELLI --- */

const el = <T extends HTMLElement = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
const valoreSelect = (id: string): string => el<HTMLSelectElement>(id)?.value ?? 'tutti';

// Opzioni di un filtro, tenendo la scelta se c'è ancora
function riempiSelect(id: string, valori: string[], etichettaTutti: string): void {
    const s = el<HTMLSelectElement>(id);
    if (!s) return;
    const attuale = s.value || 'tutti';
    const html = `<option value="tutti">${escapeHtml(etichettaTutti)}</option>` + valori.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (s.innerHTML !== html) s.innerHTML = html;
    s.value = [...s.options].some((o) => o.value === attuale) ? attuale : 'tutti';
}

function nomeRadice(): string {
    return pathStack[0]?.label || 'Radice';
}

// Apre il livello del percorso; vero se c'è ancora
function vaiAlLivello(percorso: string[]): boolean {
    const ok = apriPercorso(percorso);
    if (!ok) {
        alert("Questo elemento non c'è più: la tabella si aggiorna.");
        apriPercorso([]);
    }
    mostraPannello('canvas');
    render();
    return ok;
}

const chip = (testo: string, classe = '', colore?: string) =>
    `<span class="chip ${classe}">${colore ? `<span class="swatch" style="background:${escapeHtml(colore)}"></span>` : ''}${testo}</span>`;
const swatch = (colore: string) => `<span class="swatch" style="background:${escapeHtml(colore)}"></span>`;

/* Componenti */

const statoComponenti: StatoTabella = { ordine: null, ricerca: '' };
let ultimiComponenti: RigaComponente[] = [];

const COLONNE_COMPONENTI: Colonna<RigaComponente>[] = [
    { chiave: 'tipo', titolo: 'ID tipo', valore: (r) => r.nodo.type, classe: 'id' },
    { chiave: 'nome', titolo: 'Nome', valore: (r) => r.nodo.label || r.nodo.id, html: (r) => `<b>${escapeHtml(r.nodo.label || r.nodo.id)}</b>${r.def ? '' : ' <span class="pill err">non in libreria</span>'}` },
    { chiave: 'categoria', titolo: 'Categoria', valore: (r) => [r.def?.categoria, r.def?.sottocategoria].filter(Boolean).join(' · '), html: (r) => r.def ? `${swatch(coloreDaTesto(r.def.categoria || '-'))}${escapeHtml([r.def.categoria, r.def.sottocategoria].filter(Boolean).join(' · ') || '—')}` : '—' },
    { chiave: 'livello', titolo: 'Livello', valore: (r) => r.livello },
    { chiave: 'porte', titolo: 'Porte di interfaccia', valore: (r) => r.interfacce.map((p) => p.id).join(' '), html: (r) => r.interfacce.map((p) => chip(`<b>${escapeHtml(p.id)}</b> ${escapeHtml(p.titolo)}`, p.usata ? 'link' : '', getColoreRequisito({ id: p.id, titolo: '', tipologia: p.tipologia, metodoVerifica: '', testiExport: [] }))).join('') || '<span class="muted">—</span>' },
    { chiave: 'capacita', titolo: 'Capacità', valore: (r) => r.capacita, classe: 'num' },
    { chiave: 'libere', titolo: 'Libere', valore: (r) => r.porteLibere, classe: 'num', html: (r) => r.porteLibere ? `<span class="ico-warn" title="Porte di interfaccia senza filo">${r.porteLibere}</span>` : '0' },
    { chiave: 'propagate', titolo: 'Propagate', valore: (r) => r.propagate, classe: 'num' },
    { chiave: 'fili', titolo: 'Fili', valore: (r) => r.fili, classe: 'num' },
    { chiave: 'interni', titolo: 'Blocchi dentro', valore: (r) => r.interni, classe: 'num' }
];

function righeComponenti(): RigaComponente[] {
    const categoria = valoreSelect('filtroCategoriaComponenti');
    const soloAperto = valoreSelect('filtroLivelloComponenti') === 'aperto';
    const aperto = pathStack.slice(1).map((l) => l.id).join('/');
    let righe = ultimiComponenti;
    if (categoria !== 'tutti') righe = righe.filter((r) => (r.def?.categoria || 'Senza categoria') === categoria);
    if (soloAperto) righe = righe.filter((r) => r.percorso.join('/') === aperto);
    return ordina(cerca(righe, COLONNE_COMPONENTI, statoComponenti.ricerca), COLONNE_COMPONENTI, statoComponenti);
}

function disegnaComponenti(): void {
    const contenitore = el('tabellaComponenti');
    if (!contenitore) return;
    ultimiComponenti = elencoComponenti(appState.workspace, appState.library, nomeRadice());
    riempiSelect('filtroCategoriaComponenti', [...new Set(ultimiComponenti.map((r) => r.def?.categoria || 'Senza categoria'))].sort(confronto.compare), 'Tutte');
    const righe = righeComponenti();
    const conta = el('contaComponenti');
    if (conta) conta.textContent = String(righe.length);
    disegnaTabella(contenitore, COLONNE_COMPONENTI, righe, statoComponenti, 'Nessun blocco nel progetto. Trascina un blocco dalla Libreria sulla lavagna.', (r) => {
        if (!vaiAlLivello(r.percorso)) return;
        const nodo = getCurrentLevel().graph.nodes.find((n) => n.id === r.nodo.id);
        if (!nodo) return;
        const c = centroNodo(nodo);
        centraVista(c.x, c.y);
        selectNode(nodo);
        render();
    }, disegnaComponenti);
}

/* Interfacce */

const statoInterfacce: StatoTabella = { ordine: null, ricerca: '' };
let ultimeInterfacce: RigaInterfaccia[] = [];

const descriviLato = (l: LatoInterfaccia) => `${l.blocco}${l.dentro.length ? ` › ${l.dentro.join(' › ')}` : ''} · ${l.reqId} ${l.titolo}`;
const htmlLato = (l: LatoInterfaccia) => `${escapeHtml(l.blocco)}${l.dentro.length ? ` <span class="chip propagata">↳ ${escapeHtml(l.dentro.join(' › '))}</span>` : ''}<br><span class="mono"><b>${escapeHtml(l.reqId)}</b></span> <span class="muted">${escapeHtml(l.titolo)}</span>`;
const TIPI_FILO = { interfaccia: 'Interfaccia', capacita: 'Capacità', derivazione: 'Derivazione' } as const;

const COLONNE_INTERFACCE: Colonna<RigaInterfaccia>[] = [
    { chiave: 'classe', titolo: 'Classe', valore: (r) => r.classe, html: (r) => `${swatch(r.colore)}<b>${escapeHtml(r.classe)}</b>`, classe: 'nowrap' },
    { chiave: 'tipo', titolo: 'Tipo', valore: (r) => TIPI_FILO[r.tipo], html: (r) => `<span class="pill ${r.tipo === 'derivazione' ? 'neutro' : 'info'}">${TIPI_FILO[r.tipo]}</span>` },
    { chiave: 'da', titolo: 'Da', valore: (r) => descriviLato(r.da), html: (r) => htmlLato(r.da), classe: 'text' },
    { chiave: 'a', titolo: 'A', valore: (r) => descriviLato(r.a), html: (r) => htmlLato(r.a), classe: 'text' },
    { chiave: 'livello', titolo: 'Livello', valore: (r) => r.livello },
    { chiave: 'percorso', titolo: 'Percorso', valore: (r) => (r.manuale ? 'A mano' : 'Automatico') },
    { chiave: 'cavo', titolo: 'Cavo', valore: (r) => r.cavo, html: (r) => (r.cavo ? `<span class="mono"><b>${escapeHtml(r.cavo)}</b></span>` : '<span class="muted">—</span>') },
    { chiave: 'stato', titolo: 'Stato', valore: (r) => (r.valido ? 'OK' : `Da riparare: ${r.motivo}`), html: (r) => (r.valido ? '<span class="pill ok">OK</span>' : `<span class="pill err" title="${escapeHtml(r.motivo)}">Da riparare</span>`) }
];

function righeInterfacce(): RigaInterfaccia[] {
    const classe = valoreSelect('filtroClasseInterfacce');
    const tipo = valoreSelect('filtroTipoInterfacce');
    let righe = ultimeInterfacce;
    if (classe !== 'tutti') righe = righe.filter((r) => r.classe === classe);
    if (tipo === 'blocchi') righe = righe.filter((r) => r.tipo !== 'derivazione');
    if (tipo === 'derivazioni') righe = righe.filter((r) => r.tipo === 'derivazione');
    if (tipo === 'propagate') righe = righe.filter((r) => r.propagata);
    if (tipo === 'problemi') righe = righe.filter((r) => !r.valido);
    return ordina(cerca(righe, COLONNE_INTERFACCE, statoInterfacce.ricerca), COLONNE_INTERFACCE, statoInterfacce);
}

function disegnaInterfacce(): void {
    const contenitore = el('tabellaInterfacce');
    if (!contenitore) return;
    ultimeInterfacce = elencoInterfacce(appState.workspace, appState.library, appState.cliente, nomeRadice());
    riempiSelect('filtroClasseInterfacce', [...new Set(ultimeInterfacce.map((r) => r.classe))].sort(confronto.compare), 'Tutte');
    const righe = righeInterfacce();
    const conta = el('contaInterfacce');
    if (conta) conta.textContent = String(righe.length);
    disegnaTabella(contenitore, COLONNE_INTERFACCE, righe, statoInterfacce, 'Nessun filo. Trascina da una porta a un\'altra sulla lavagna per collegare due blocchi.', (r) => {
        if (vaiAlLivello(r.percorso)) selezionaFilo(r.edge.id);
    }, disegnaInterfacce);
}

/* Cavi (spec 0036, AC-7) */

const statoCavi: StatoTabella = { ordine: null, ricerca: '' };
let ultimiCavi: RigaCavo[] = [];

const COLONNE_CAVI: Colonna<RigaCavo>[] = [
    { chiave: 'sigla', titolo: 'ID cavo', valore: (r) => r.cavo.sigla, html: (r) => `<span class="mono"><b>${escapeHtml(r.cavo.sigla)}</b></span>`, classe: 'nowrap' },
    { chiave: 'da', titolo: 'Comp. A', valore: (r) => r.da },
    { chiave: 'a', titolo: 'Comp. B', valore: (r) => r.a },
    { chiave: 'livello', titolo: 'Livello', valore: (r) => r.livello },
    { chiave: 'tipo', titolo: 'Tipo di cavo', valore: (r) => r.cavo.tipo ?? '' },
    { chiave: 'connA', titolo: 'Connettore A', valore: (r) => r.cavo.connettoreDa ?? '' },
    { chiave: 'connB', titolo: 'Connettore B', valore: (r) => r.cavo.connettoreA ?? '' },
    { chiave: 'lunghezza', titolo: 'Lunghezza (m)', valore: (r) => r.cavo.lunghezza ?? '', classe: 'num' },
    { chiave: 'pn', titolo: 'Specifica / P/N', valore: (r) => r.cavo.pn ?? '' },
    { chiave: 'nfili', titolo: 'N. fili', valore: (r) => r.fili.length, classe: 'num' },
    { chiave: 'fili', titolo: 'Fili (interfacce)', valore: (r) => r.fili.join(', '), html: (r) => r.fili.map((f) => `<span class="mono">${escapeHtml(f)}</span>`).join('<br>') || '<span class="muted">vuoto</span>', classe: 'text' },
    { chiave: 'note', titolo: 'Note', valore: (r) => r.cavo.note ?? '', classe: 'text' }
];

function righeCavi(): RigaCavo[] {
    return ordina(cerca(ultimiCavi, COLONNE_CAVI, statoCavi.ricerca), COLONNE_CAVI, statoCavi);
}

function disegnaCavi(): void {
    const contenitore = el('tabellaCavi');
    if (!contenitore) return;
    ultimiCavi = elencoCavi(appState.workspace, nomeRadice());
    const righe = righeCavi();
    const conta = el('contaCavi');
    if (conta) conta.textContent = String(righe.length);
    const s = statoCablaggio(appState.workspace, appState.library);
    const riepilogo = el('riepilogoCavi');
    if (riepilogo) riepilogo.textContent = `${s.cablati} fili di interfaccia su ${s.cablabili} stanno in un cavo`;
    disegnaTabella(contenitore, COLONNE_CAVI, righe, statoCavi, 'Nessun cavo. Sulla lavagna passa allo strato Cavi e trascina la maniglia di un blocco su un altro blocco.', (r) => {
        if (!vaiAlLivello(r.percorso)) return;
        impostaStrato(true);
        selezionaCavo(r.cavo.id);
    }, disegnaCavi);
}

/* Requisiti */

const statoRequisiti: StatoTabella = { ordine: null, ricerca: '' };
let ultimiRequisiti: RigaRequisito[] = [];

const COLONNE_REQUISITI: Colonna<RigaRequisito>[] = [
    { chiave: 'id', titolo: 'ID', valore: (r) => r.req.id, classe: 'id' },
    { chiave: 'titolo', titolo: 'Titolo', valore: (r) => r.req.titolo, classe: 'text' },
    { chiave: 'blocco', titolo: 'Blocco', valore: (r) => r.blocco.titolo || r.blocco.id, html: (r) => `${escapeHtml(r.blocco.titolo || r.blocco.id)} <span class="chip mono">${escapeHtml(r.blocco.id)}</span>` },
    { chiave: 'classe', titolo: 'Classe', valore: (r) => r.classe, html: (r) => `${swatch(getColoreRequisito(r.req))}${escapeHtml(r.classe)}`, classe: 'nowrap' },
    { chiave: 'metodo', titolo: 'Verifica', valore: (r) => r.req.metodoVerifica || '—' },
    { chiave: 'documenti', titolo: 'Documenti', valore: (r) => r.documenti.join(' '), html: (r) => r.documenti.map((d) => chip(escapeHtml(d), 'mono')).join('') || '<span class="muted">—</span>' },
    { chiave: 'istanze', titolo: 'Istanze', valore: (r) => r.istanze, classe: 'num' },
    { chiave: 'collegate', titolo: 'Con filo', valore: (r) => r.collegate, classe: 'num', html: (r) => (r.istanze && r.collegate < r.istanze ? `<span class="ico-warn" title="Istanze senza filo su questo requisito">${r.collegate}</span>` : String(r.collegate)) }
];

function righeRequisiti(): RigaRequisito[] {
    const classe = valoreSelect('filtroClasseRequisiti');
    const uso = valoreSelect('filtroUsoRequisiti');
    let righe = ultimiRequisiti;
    if (classe !== 'tutti') righe = righe.filter((r) => r.classe === classe);
    if (uso === 'usati') righe = righe.filter((r) => r.istanze > 0);
    if (uso === 'liberi') righe = righe.filter((r) => r.istanze > r.collegate);
    if (uso === 'inutilizzati') righe = righe.filter((r) => r.istanze === 0);
    return ordina(cerca(righe, COLONNE_REQUISITI, statoRequisiti.ricerca), COLONNE_REQUISITI, statoRequisiti);
}

function disegnaRequisiti(): void {
    const contenitore = el('tabellaRequisiti');
    if (!contenitore) return;
    ultimiRequisiti = elencoRequisiti(appState.workspace, appState.library);
    riempiSelect('filtroClasseRequisiti', [...new Set(ultimiRequisiti.map((r) => r.classe))].sort(confronto.compare), 'Tutte');
    const righe = righeRequisiti();
    const conta = el('contaRequisiti');
    if (conta) conta.textContent = String(righe.length);
    disegnaTabella(contenitore, COLONNE_REQUISITI, righe, statoRequisiti, 'La libreria aperta non ha requisiti.', (r) => {
        openLibraryBlock(r.blocco.id);
        mostraPannello('ispettore');
    }, disegnaRequisiti);
}

/* Dashboard */

function disegnaDashboard(): void {
    const contenitore = el('contenutoDashboard');
    if (!contenitore) return;
    const d = riepilogoDashboard(appState.workspace, appState.library, appState.cliente);
    const percentuale = d.clienteTotale ? Math.round((d.clienteCoperti / d.clienteTotale) * 100) : 0;
    const cablaggio = statoCablaggio(appState.workspace, appState.library);
    const tile = (sezione: IdPannello, etichetta: string, valore: string | number, sotto: string) =>
        `<button type="button" class="tile" data-vai="${sezione}"><div class="t-label">${escapeHtml(etichetta)}</div><div class="t-value">${escapeHtml(String(valore))}</div><div class="t-sub">${escapeHtml(sotto)}</div></button>`;
    const kpi = [
        tile('libreria', 'Blocchi in libreria', d.blocchiLibreria, `${d.requisitiLibreria} requisiti`),
        tile('componenti', 'Istanze nel progetto', d.istanze, `${d.livelli} ${d.livelli === 1 ? 'livello' : 'livelli'} con blocchi`),
        tile('interfacce', 'Fili', d.fili, `${d.derivazioni} derivazioni`),
        tile('cavi', 'Cablaggio', `${cablaggio.cablati} / ${cablaggio.cablabili}`, `interfacce in un cavo · ${cablaggio.cavi} ${cablaggio.cavi === 1 ? 'cavo' : 'cavi'}`),
        tile('componenti', 'Porte libere', d.porteLibere, `su ${d.porteInterfaccia} porte di interfaccia`),
        tile('componenti', 'Porte propagate', d.propagate, 'dai blocchi interni (matrioska)'),
        tile('cliente', 'Requisiti cliente coperti', d.clienteTotale ? `${percentuale}%` : '—', d.clienteTotale ? `${d.clienteCoperti} su ${d.clienteTotale} attivi` : 'nessun requisito cliente'),
        tile('coerenza', 'Problemi di coerenza', d.totaleProblemi, d.totaleProblemi ? 'apri la scheda Coerenza' : 'nessun problema')
    ].join('');
    const controlli = GRUPPI_PROBLEMI.map((g) => {
        const n = d.problemi[g.id] ?? 0;
        const classe = n === 0 ? 'ok' : g.gravita;
        const icona = n === 0 ? '✓' : '!';
        return `<button type="button" class="check ${classe}" data-vai="coerenza"><span class="c-ico">${icona}</span><span><div class="c-label">${escapeHtml(g.titolo)}</div><div class="c-sev">${n === 0 ? 'Superato' : g.gravita === 'error' ? 'Errore' : 'Avviso'}</div></span><span class="c-count">${n}</span></button>`;
    }).join('');
    const massimoClasse = Math.max(1, ...d.perClasse.map((c) => c.fili));
    const classi = d.perClasse.length ? d.perClasse.map((c) =>
        `<div class="meter-row"><span class="m-label">${swatch(c.colore)}${escapeHtml(c.classe)}</span><span class="m-val">${c.fili}</span><div class="meter"><span style="width:${(c.fili / massimoClasse) * 100}%; background:${escapeHtml(c.colore)}"></span></div></div>`).join('')
        : '<div class="muted">Nessun filo fra blocchi.</div>';
    const massimoCategoria = Math.max(1, ...d.perCategoria.map((c) => c.istanze));
    const categorie = d.perCategoria.length ? d.perCategoria.map((c) =>
        `<div class="meter-row"><span class="m-label">${swatch(c.colore)}${escapeHtml(c.categoria)}</span><span class="m-val">${c.istanze}</span><div class="meter"><span style="width:${(c.istanze / massimoCategoria) * 100}%; background:${escapeHtml(c.colore)}"></span></div></div>`).join('')
        : '<div class="muted">Nessun blocco nel progetto.</div>';
    const livello = getCurrentLevel();
    const n2 = matriceN2(livello.graph, appState.library);
    let tabellaN2 = '<div class="muted">Servono almeno due blocchi nel livello aperto.</div>';
    if (n2.nodi.length >= 2) {
        const nome = (n: Nodo) => escapeHtml((n.label || n.id).slice(0, 14));
        tabellaN2 = `<div class="n2-wrap"><table class="n2"><thead><tr><th></th>${n2.nodi.map((n) => `<th title="${escapeHtml(n.label || n.id)}">${nome(n)}</th>`).join('')}</tr></thead><tbody>`
            + n2.nodi.map((r) => `<tr><th title="${escapeHtml(r.label || r.id)}">${nome(r)}</th>${n2.nodi.map((c) => {
                if (r.id === c.id) return `<td class="diag">${nome(r)}</td>`;
                const cella = n2.celle.get(`${r.id}|${c.id}`);
                if (!cella) return '<td></td>';
                return `<td class="has">${[...cella.entries()].map(([classe, k]) => chip(`${escapeHtml(classe)}${k > 1 ? ` ×${k}` : ''}`, '', coloreClasse(classe))).join('')}</td>`;
            }).join('')}</tr>`).join('') + '</tbody></table></div>';
    }
    contenitore.innerHTML = `
        <div class="section-head"><h1>Dashboard</h1><span class="count">${escapeHtml(nomeRadice())}</span></div>
        <p class="section-desc">Lo stato del progetto in un colpo d'occhio: numeri, controlli di coerenza, fili per classe e la matrice N² del livello aperto. Clic su un riquadro per aprire la sezione.</p>
        <div class="kpis">${kpi}</div>
        <h2 class="dash-h2">Controlli di coerenza</h2>
        <div class="checks">${controlli}</div>
        <div class="dash-grid">
            <div>
                <div class="card"><div class="card-head">Matrice N² · ${escapeHtml(livello.parentNode ? livello.label : 'Radice')}<span class="spacer"></span><span class="muted small">fili fra i blocchi del livello aperto</span></div><div class="card-body">${tabellaN2}</div></div>
            </div>
            <div>
                <div class="card"><div class="card-head">Fili per classe</div><div class="card-body">${classi}</div></div>
                <div class="card"><div class="card-head">Istanze per categoria</div><div class="card-body">${categorie}</div></div>
            </div>
        </div>`;
    contenitore.querySelectorAll<HTMLElement>('[data-vai]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.vai as IdPannello;
        if (id === 'coerenza' && !coerenzaAttiva()) cambiaModalitaCoerenza();
        else mostraPannello(id);
    }));
}

/* --- CONTATORI DELLA TESTATA E AGGIORNAMENTO DIFFERITO --- */

const RITARDO = 250;
let timer: ReturnType<typeof setTimeout> | null = null;
const daRifare = new Set<IdPannello>();
const PANNELLI_TABELLA: Array<[IdPannello, () => void]> = [
    ['componenti', disegnaComponenti], ['interfacce', disegnaInterfacce], ['cavi', disegnaCavi], ['requisiti', disegnaRequisiti], ['dashboard', disegnaDashboard]
];

function aggiornaContatori(): void {
    const imposta = (chiave: string, valore: number, allarme = false) => {
        const c = document.querySelector<HTMLElement>(`#navSezioni [data-conta="${chiave}"]`);
        if (!c) return;
        c.textContent = String(valore);
        c.classList.toggle('alert', allarme && valore > 0);
    };
    let istanze = 0;
    let fili = 0;
    let cavi = 0;
    visitaLivelli(appState.workspace, ({ graph }) => {
        istanze += graph.nodes?.length ?? 0;
        fili += graph.edges?.length ?? 0;
        cavi += graph.cavi?.length ?? 0;
    });
    imposta('libreria', Object.keys(appState.library).length);
    imposta('componenti', istanze);
    imposta('interfacce', fili);
    imposta('cavi', cavi);
    imposta('requisiti', Object.values(appState.library).reduce((n, b) => n + b.requisiti.length, 0));
    imposta('cliente', appState.cliente?.requisiti.length ?? 0);
    imposta('problemi', calcolaCoerenza(appState.workspace, appState.library, appState.cliente).problemi.length, true);
    // Nome del progetto sotto il marchio
    const nome = el('nomeProgettoTestata');
    if (nome && nome.textContent !== nomeRadice()) {
        nome.textContent = nomeRadice();
        nome.title = `Progetto aperto: ${nomeRadice()} · clic per aprirne un altro`;
    }
}

// Chiamata da render(): contatori e tabelle visibili si rifanno una volta dopo una raffica di modifiche
export function segnaTabelleDaAggiornare(): void {
    PANNELLI_TABELLA.forEach(([id]) => daRifare.add(id));
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
        timer = null;
        try {
            aggiornaContatori();
        } catch (e) {
            console.error('Contatori della testata non aggiornati', e);
        }
        PANNELLI_TABELLA.forEach(([id, disegna]) => {
            if (!daRifare.has(id) || !pannelloAperto(id) || !pannelloVisibile(id)) return;
            daRifare.delete(id);
            disegna();
        });
    }, RITARDO);
}

export function initTabelle(): void {
    PANNELLI_TABELLA.forEach(([id, disegna]) => allaVista(id, () => {
        daRifare.delete(id);
        disegna();
    }));
    const ricerca = (campo: string, stato: StatoTabella, disegna: () => void) => {
        let attesa: ReturnType<typeof setTimeout> | null = null;
        el<HTMLInputElement>(campo)?.addEventListener('input', (e) => {
            stato.ricerca = (e.target as HTMLInputElement).value;
            if (attesa) clearTimeout(attesa);
            attesa = setTimeout(disegna, 150);
        });
    };
    ricerca('cercaComponenti', statoComponenti, disegnaComponenti);
    ricerca('cercaInterfacce', statoInterfacce, disegnaInterfacce);
    ricerca('cercaCavi', statoCavi, disegnaCavi);
    ricerca('cercaRequisiti', statoRequisiti, disegnaRequisiti);
    ['filtroCategoriaComponenti', 'filtroLivelloComponenti'].forEach((id) => el(id)?.addEventListener('change', disegnaComponenti));
    ['filtroClasseInterfacce', 'filtroTipoInterfacce'].forEach((id) => el(id)?.addEventListener('change', disegnaInterfacce));
    ['filtroClasseRequisiti', 'filtroUsoRequisiti'].forEach((id) => el(id)?.addEventListener('change', disegnaRequisiti));
    // Nome del file: progetto-sezione.csv, con le righe filtrate e ordinate come a schermo
    const progetto = () => (pathStack[0]?.label || 'progetto').replace(/[^\p{L}\p{N}_-]+/gu, '_');
    const scarica = (pulsante: string, nome: string, csv: () => string) => el(pulsante)?.addEventListener('click', () => {
        scaricaFileTesto(csv(), `${progetto()}-${nome}.csv`, 'text/csv;charset=utf-8');
    });
    scarica('btnCsvComponenti', 'componenti', () => inCsv(COLONNE_COMPONENTI, righeComponenti()));
    scarica('btnCsvInterfacce', 'interfacce', () => inCsv(COLONNE_INTERFACCE, righeInterfacce()));
    scarica('btnCsvCavi', 'cavi', () => inCsv(COLONNE_CAVI, righeCavi()));
    scarica('btnCsvRequisiti', 'requisiti', () => inCsv(COLONNE_REQUISITI, righeRequisiti()));
}
