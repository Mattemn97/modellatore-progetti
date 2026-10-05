/* --- CONTROLLO DI COERENZA: REQUISITI SCOPERTI E DIFETTI DI INTEGRITÀ, SCHEDA COERENZA ED EVIDENZE SUL CANVAS --- */

// Spec 0004. Il calcolo è una funzione pura rifatta a ogni render() a modalità accesa.
// Modalità e risultato vivono solo in questo modulo: non finiscono mai nel file del progetto.

import { appState, appSettings, pathStack, getCurrentLevel, setActiveNodeId } from './state.js';
import { render, centraVista, evidenziaCliente, posizioneInColonna } from './renderer.js';
import { renderUI } from './app.js';
import { selectNode, mostraDettaglioCliente } from './inspector.js';
import { impostaSelezioneCliente } from './cliente.js';
import { mostraPannello, chiudiPannello, pannelloVisibile, allaVista, allaChiusura, aperturaDalMenu } from './pannelli.js';
import { apriPercorso } from './progetto.js';
import { visitaDerivazioni, getClasseRequisito, isRequisitoCliente, titoloRequisito, ID_CLIENTE, type ContestoLivello } from './model.js';
import { spegniGerarchia } from './gerarchia.js';
import { escapeHtml } from './utils.js';
import { classePassa, descriviClassi } from './filtri.js';
import type { Cliente, Grafo, Libreria, Nodo, Requisito, TipoEstremo } from './tipi.js';

export type TipoProblema = 'clienteSenzaFigli' | 'senzaPadre' | 'senzaFigli' | 'filoDaRitirato' | 'bloccoSenzaDefinizione' | 'filoNonValido';

export interface Problema {
    tipo: TipoProblema;
    chiave: string;
    // Dove sta: id dei nodi dalla radice, le loro etichette, il livello e la pila dei nodi aperti
    percorso: string[];
    etichette: string[];
    graph: Grafo;
    nodi: Nodo[];
    ownerType: TipoEstremo | null;
    ownerId: string | null;
    reqId: string | null;
    req: Requisito | null;
    nodeId: string | null;
    edgeId: string | null;
    numeroFili: number | null;
    motivo: string;
    // Classe del requisito per il filtro (null = passa sempre)
    classe: string | null;
    idVoce: string;
    titoloVoce: string;
    estremi?: [string, string];
}

export interface RisultatoCoerenza {
    problemi: Problema[];
    filtrati: Problema[];
    perLivello: Map<Grafo, Map<string, string>>;
    contatori: Map<Nodo, number>;
    senzaCliente: boolean;
    libreriaAssente: boolean;
}

interface StatoLivello {
    padriConFigli: Set<string>;
    figliConPadre: Set<string>;
    bloccoConDefinizione: boolean;
}

// Gruppi della scheda, nell'ordine di AC-7; Da riparare raccoglie blocchi senza definizione e fili non validi
const GRUPPI: Array<{ id: string; titolo: string; tipi: TipoProblema[] }> = [
    { id: 'clienteSenzaFigli', titolo: 'Cliente senza figli', tipi: ['clienteSenzaFigli'] },
    { id: 'senzaPadre', titolo: 'Requisiti senza padre', tipi: ['senzaPadre'] },
    { id: 'senzaFigli', titolo: 'Requisiti senza figli', tipi: ['senzaFigli'] },
    { id: 'filoDaRitirato', titolo: 'Fili da requisiti ritirati', tipi: ['filoDaRitirato'] },
    { id: 'daRiparare', titolo: 'Da riparare', tipi: ['bloccoSenzaDefinizione', 'filoNonValido'] }
];
const TIPI_CLIENTE = new Set<TipoProblema>(['clienteSenzaFigli', 'filoDaRitirato']);
const ATTESA_RICERCA = 200;
const MSG_SPARITO = "Questo elemento non c'è più";

let modalitaAttiva = false;
let ultimoRisultato: RisultatoCoerenza | null = null;

// Stato della scheda, fuori dalla parte ridisegnata: resta finché la pagina resta aperta
const gruppiAperti = new Set<string>();
let ricerca = '';
let timerRicerca: ReturnType<typeof setTimeout> | undefined;
let schedaDaAggiornare = false;
let fotogrammaRichiesto = false;
let ultimaImpronta: string | null = null;

/* --- CALCOLO --- */

function risultatoVuoto(extra: Partial<RisultatoCoerenza> = {}): RisultatoCoerenza {
    return {
        problemi: [], filtrati: [], perLivello: new Map(), contatori: new Map(),
        senzaCliente: false, libreriaAssente: false, ...extra
    };
}

function chiaveProblema(p: Omit<Problema, 'chiave'>): string {
    return [p.tipo, p.percorso.join('/'), p.ownerType, p.ownerId, p.reqId, p.nodeId, p.edgeId]
        .map((v) => v ?? '').join('|');
}

function plurale(n: number, uno: string, molti: string): string {
    return `${n} ${n === 1 ? uno : molti}`;
}

// Visita tutto il modello e restituisce l'elenco completo dei problemi (AC-2 … AC-6), nell'ordine di AC-7.
// Non cambia mai il modello. Filtro per classe e indici per il disegno li aggiunge applicaFiltro()
export function calcolaCoerenza(radice: Grafo, libreria: Libreria, cliente: Cliente | null): RisultatoCoerenza {
    if (!libreria || Object.keys(libreria).length === 0) return risultatoVuoto({ libreriaAssente: true });

    const requisitiCliente = cliente?.requisiti || [];
    const perTipo: Record<TipoProblema, Problema[]> = {
        clienteSenzaFigli: [], senzaPadre: [], senzaFigli: [], filoDaRitirato: [],
        bloccoSenzaDefinizione: [], filoNonValido: []
    };
    // Fili validi della radice per ogni requisito cliente (anche dei ritirati)
    const filiCliente = new Map<string, number>();

    function aggiungi(p: Omit<Problema, 'chiave'>): void {
        perTipo[p.tipo].push({ ...p, chiave: chiaveProblema(p) });
    }

    const base = (ctx: ContestoLivello<StatoLivello>) => ({ percorso: ctx.percorso, etichette: ctx.etichette, graph: ctx.graph, nodi: ctx.nodi });

    // La visita del modello è condivisa con la Gerarchia (model.js); qui solo le regole della Coerenza
    visitaDerivazioni<StatoLivello>(radice, libreria, cliente, {
        inizioLivello(ctx) {
            ctx.stato.padriConFigli = new Set();
            ctx.stato.figliConPadre = new Set();
            ctx.stato.bloccoConDefinizione = false;
        },

        filo(ctx, edge, esito) {
            if (esito.stato === 'ignorato') return; // lo copre la voce del blocco
            if (esito.stato === 'nonValido') {
                aggiungi({
                    ...base(ctx), tipo: 'filoNonValido', ownerType: null, ownerId: null, reqId: null, req: null,
                    nodeId: null, edgeId: edge.id, numeroFili: null, motivo: esito.motivo ?? '', classe: null,
                    idVoce: 'Filo', titoloVoce: `${edge.sourceHandle} → ${edge.targetHandle}`,
                    estremi: [esito.a.descrizione ?? '', esito.b.descrizione ?? '']
                });
                return;
            }
            if (!esito.derivazione || !esito.padre || !esito.figlio) return; // collegamento tra blocchi: non dà padre né figli

            const { padre, figlio } = esito;
            if (ctx.tipoPadre === null) filiCliente.set(padre.reqId, (filiCliente.get(padre.reqId) || 0) + 1);
            // Alla radice un ritirato non fa da padre (il filo resta valido, spec 0003)
            if (ctx.tipoPadre === null && !(isRequisitoCliente(padre.req) && padre.req.stato === 'attivo')) return;
            ctx.stato.padriConFigli.add(padre.reqId);
            ctx.stato.figliConPadre.add(`${figlio.ownerId}|${figlio.reqId}`);
        },

        // Blocchi senza definizione e requisiti senza padre di questo livello
        nodo(ctx, nodo, def) {
            if (!def) {
                aggiungi({
                    ...base(ctx), tipo: 'bloccoSenzaDefinizione', ownerType: null, ownerId: null, reqId: null, req: null,
                    nodeId: nodo.id, edgeId: null, numeroFili: null, classe: null,
                    motivo: `Il blocco "${nodo.type}" non esiste nella libreria aperta: ripristinalo in libreria. Il suo contenuto non è controllato.`,
                    idVoce: nodo.type, titoloVoce: nodo.label || nodo.id
                });
                return;
            }
            ctx.stato.bloccoConDefinizione = true;
            def.requisiti.forEach((req) => {
                if (ctx.stato.figliConPadre.has(`${nodo.id}|${req.id}`)) return;
                aggiungi({
                    ...base(ctx), tipo: 'senzaPadre', ownerType: 'node', ownerId: nodo.id, reqId: req.id, req,
                    nodeId: null, edgeId: null, numeroFili: null, classe: getClasseRequisito(req),
                    motivo: 'Senza padre: nessun filo di derivazione valido da un blocco tondo',
                    idVoce: req.id, titoloVoce: titoloRequisito(req)
                });
            });
        },

        // Requisiti del blocco che contiene il livello che non scendono a nessun figlio (solo livelli con contenuto)
        fineLivello(ctx) {
            if (!ctx.nodoPadre || !ctx.stato.bloccoConDefinizione || ctx.tipoPadre === null) return;
            (libreria[ctx.tipoPadre]?.requisiti || []).forEach((req) => {
                if (ctx.stato.padriConFigli.has(req.id)) return;
                aggiungi({
                    ...base(ctx), tipo: 'senzaFigli', ownerType: 'parent', ownerId: ctx.ownerPadre, reqId: req.id, req,
                    nodeId: null, edgeId: null, numeroFili: null, classe: getClasseRequisito(req),
                    motivo: 'Senza figli: non scende a nessun blocco di questo livello',
                    idVoce: req.id, titoloVoce: titoloRequisito(req)
                });
            });
        }
    });

    // Requisiti cliente, nell'ordine del file
    const baseRadice = { percorso: [], etichette: [], graph: radice, nodi: [] };
    requisitiCliente.forEach((req) => {
        const fili = filiCliente.get(req.id) || 0;
        const comune = {
            ...baseRadice, ownerType: 'parent' as const, ownerId: ID_CLIENTE, reqId: req.id, req,
            nodeId: null, edgeId: null, classe: getClasseRequisito(req),
            idVoce: req.idCliente, titoloVoce: titoloRequisito(req)
        };
        if (req.stato === 'attivo' && fili === 0) {
            aggiungi({ ...comune, tipo: 'clienteSenzaFigli', numeroFili: 0,
                motivo: 'Cliente senza figli: nessun filo valido verso un requisito di sistema' });
        } else if (req.stato === 'ritirato' && fili > 0) {
            aggiungi({ ...comune, tipo: 'filoDaRitirato', numeroFili: fili,
                motivo: `Requisito ritirato con ${plurale(fili, 'filo valido', 'fili validi')}` });
        }
    });

    const problemi = GRUPPI.flatMap((g) => g.tipi.flatMap((t) => perTipo[t]));
    return { ...risultatoVuoto(), problemi, senzaCliente: requisitiCliente.length === 0 };
}

// Filtro per classe della barra: unica fonte di pulsante, contatori ed evidenze. Da riparare passa sempre
function passaClasse(p: Problema): boolean {
    return classePassa(p.classe);
}

function applicaFiltro(risultato: RisultatoCoerenza): RisultatoCoerenza {
    const filtrati = risultato.problemi.filter(passaClasse);
    const perLivello = new Map<Grafo, Map<string, string>>();
    const contatori = new Map<Nodo, number>();
    filtrati.forEach((p) => {
        if (p.ownerType) {
            let livello = perLivello.get(p.graph);
            if (!livello) {
                livello = new Map();
                perLivello.set(p.graph, livello);
            }
            livello.set(`${p.ownerType}|${p.ownerId}|${p.reqId}`, p.motivo);
        }
        p.nodi.forEach((nodo) => contatori.set(nodo, (contatori.get(nodo) || 0) + 1));
    });
    return { ...risultato, filtrati, perLivello, contatori };
}

/* --- LETTURA DA RENDERER E SCHEDA --- */

export function coerenzaAttiva(): boolean {
    return modalitaAttiva;
}

// Chiamata da render() a modalità accesa: rifà il calcolo e aggiorna il numero sul pulsante
export function aggiornaCoerenza(): RisultatoCoerenza {
    const risultato = applicaFiltro(calcolaCoerenza(pathStack[0]!.graph, appState.library, appState.cliente));
    ultimoRisultato = risultato;
    aggiornaPulsante();
    return risultato;
}

export function problemiFiltrati(): Problema[] {
    return ultimoRisultato?.filtrati || [];
}

export function problemiScheda(): Problema[] {
    const query = ricerca.trim().toLowerCase();
    if (!query) return problemiFiltrati();
    return problemiFiltrati().filter((p) =>
        [p.reqId, isRequisitoCliente(p.req) ? p.req.idCliente : null, p.req ? titoloRequisito(p.req) : null, p.idVoce, p.titoloVoce]
            .some((v) => (v || '').toLowerCase().includes(query)));
}

// Motivo del problema di un pin o di un blocco tondo nel livello 'graph', o null
export function problemaPin(graph: Grafo, ownerType: TipoEstremo, ownerId: string, reqId: string): string | null {
    if (!modalitaAttiva || !ultimoRisultato) return null;
    return ultimoRisultato.perLivello.get(graph)?.get(`${ownerType}|${ownerId}|${reqId}`) || null;
}

// Problemi visibili (filtro per classe) nel contenuto di un blocco, a qualsiasi profondità
export function contatoreBlocco(node: Nodo): number {
    if (!modalitaAttiva || !ultimoRisultato) return 0;
    return ultimoRisultato.contatori.get(node) || 0;
}

/* --- PULSANTE E MODALITÀ --- */

function aggiornaPulsante(): void {
    const pulsante = document.getElementById('btnDRC');
    if (!pulsante) return;
    pulsante.classList.toggle('attivo', modalitaAttiva);
    pulsante.setAttribute('aria-pressed', String(modalitaAttiva));
    const numero = modalitaAttiva && ultimoRisultato && !ultimoRisultato.libreriaAssente
        ? ` (${ultimoRisultato.filtrati.length})` : '';
    pulsante.textContent = `⚠️ Verifica Coerenza${numero}`;
}

// Spegne la modalità con pannello, pulsante e risultato, senza render(): lo fa chi la chiama (spec 0005, 0021)
export function spegniCoerenza(): void {
    if (!modalitaAttiva) return;
    modalitaAttiva = false;
    ultimoRisultato = null;
    chiudiPannello('coerenza');
    aggiornaPulsante();
}

export function cambiaModalitaCoerenza(): void {
    if (modalitaAttiva) {
        spegniCoerenza();
    } else {
        // Coerenza e Gerarchia non sono mai accese insieme
        spegniGerarchia();
        modalitaAttiva = true;
        ultimaImpronta = null;
        aggiornaCoerenza();
        mostraPannello('coerenza');
    }
    render();
}

/* --- SCHEDA COERENZA --- */

function schedaVisibile(): boolean {
    return modalitaAttiva && pannelloVisibile('coerenza');
}

// Chiamata da render(): l'aggiornamento vero avviene una volta per fotogramma e solo se la scheda si vede
export function segnaSchedaCoerenzaDaAggiornare(): void {
    schedaDaAggiornare = true;
    if (fotogrammaRichiesto) return;
    fotogrammaRichiesto = true;
    requestAnimationFrame(() => {
        fotogrammaRichiesto = false;
        if (schedaDaAggiornare && schedaVisibile()) aggiornaSchedaCoerenza();
    });
}

function percorsoMostrato(p: Problema): string {
    return [pathStack[0]!.label, ...p.etichette].join(' › ');
}

function rigaVoce(p: Problema): string {
    const rimuovi = p.tipo === 'filoNonValido'
        ? `<button class="pulsante-rimuovi-coerenza" data-rimuovi="${escapeHtml(p.chiave)}" title="Toglie il filo dal modello">Rimuovi</button>` : '';
    return `<div class="voce-coerenza" data-chiave="${escapeHtml(p.chiave)}" title="${escapeHtml(p.motivo)}">
        <div class="voce-coerenza-testa">
            <span class="voce-coerenza-id">${escapeHtml(p.idVoce)}</span>
            <span class="voce-coerenza-titolo">${escapeHtml(p.titoloVoce)}</span>
            ${rimuovi}
        </div>
        <div class="voce-coerenza-percorso">${escapeHtml(percorsoMostrato(p))}</div>
        ${TIPI_CLIENTE.has(p.tipo) || p.tipo === 'senzaPadre' || p.tipo === 'senzaFigli' ? '' : `<div class="voce-coerenza-motivo">${escapeHtml(p.motivo)}</div>`}
        ${p.tipo === 'filoDaRitirato' ? `<div class="voce-coerenza-motivo">${escapeHtml(plurale(p.numeroFili ?? 0, 'filo valido', 'fili validi'))}</div>` : ''}
    </div>`;
}

// forza: ridisegna anche se l'impronta non è cambiata (apertura della scheda, gruppi, ricerca)
export function aggiornaSchedaCoerenza(forza = false): void {
    schedaDaAggiornare = false;
    const contenitore = document.getElementById('coerenzaGruppi');
    const avviso = document.getElementById('coerenzaAvviso');
    const casella = document.getElementById('coerenzaRicerca');
    if (!contenitore || !avviso || !casella || !modalitaAttiva) return;
    const r = ultimoRisultato ?? aggiornaCoerenza();

    if (r.libreriaAssente) {
        if (!forza && ultimaImpronta === 'libreriaAssente') return;
        ultimaImpronta = 'libreriaAssente';
        casella.hidden = true;
        avviso.hidden = true;
        contenitore.innerHTML = '<div class="empty-props">Libreria non caricata: il controllo riparte quando la carichi</div>';
        return;
    }

    const filtrati = problemiFiltrati();
    const scheda = problemiScheda();
    const conRicerca = ricerca.trim() !== '';
    const limite = appSettings.coerenza.righePerGruppo;
    const gruppi = GRUPPI.map((g) => {
        const tipi = new Set(g.tipi);
        const voci = scheda.filter((p) => tipi.has(p.tipo));
        const totale = filtrati.reduce((n, p) => n + (tipi.has(p.tipo) ? 1 : 0), 0);
        return { ...g, voci, totale, aperto: gruppiAperti.has(g.id) };
    });

    // Impronta di ciò che si vede: conteggi e voci dei gruppi aperti. Se non cambia, il DOM non si tocca
    const impronta = [
        descriviClassi(), ricerca, pathStack[0]!.label, r.senzaCliente, filtrati.length,
        ...gruppi.map((g) => `${g.id}:${g.aperto}:${g.voci.length}:${g.totale}:` + (g.aperto
            ? g.voci.slice(0, limite).map((p) => `${p.chiave}~${p.titoloVoce}~${p.motivo}~${p.etichette.join('/')}`).join(';')
            : ''))
    ].join('\n');
    if (!forza && impronta === ultimaImpronta) return;
    ultimaImpronta = impronta;

    casella.hidden = false;
    const classi = descriviClassi();
    avviso.hidden = !classi;
    avviso.textContent = classi ? `Filtro attivo: ${classi}` : '';

    if (filtrati.length === 0) {
        contenitore.innerHTML = '<div class="empty-props">Nessun problema: ogni requisito è collegato</div>';
        return;
    }

    contenitore.innerHTML = gruppi.map((g) => {
        const conteggio = conRicerca ? `${g.voci.length} di ${g.totale}` : `${g.totale}`;
        let corpo = '';
        if (g.aperto) {
            const nota = g.id === 'senzaPadre' && r.senzaCliente
                ? '<div class="nota-coerenza">Nessun requisito cliente importato</div>' : '';
            const altri = g.voci.length > limite ? `<div class="altri-coerenza">e altri ${g.voci.length - limite}</div>` : '';
            corpo = `<div class="gruppo-coerenza-voci">${nota}${g.voci.slice(0, limite).map(rigaVoce).join('')}${altri}</div>`;
        }
        return `<div class="gruppo-coerenza">
            <button class="gruppo-coerenza-testa" data-gruppo="${g.id}" aria-expanded="${g.aperto}">
                <span>${g.aperto ? '▾' : '▸'} ${escapeHtml(g.titolo)}</span>
                <span class="conteggio-coerenza">${escapeHtml(conteggio)}</span>
            </button>
            ${corpo}
        </div>`;
    }).join('');
}

/* --- NAVIGAZIONE E RIMUOVI --- */

// Problema di adesso per chiave: ricalcola, così non usa mai un modello sostituito da Annulla, Ripeti o Ricarica
function problemaAttuale(chiave: string): Problema | null {
    return aggiornaCoerenza().problemi.find((p) => p.chiave === chiave) || null;
}

function elementoSparito(): void {
    alert(MSG_SPARITO);
    render();
    aggiornaSchedaCoerenza(true);
}

function scriviIspettore(html: string): void {
    const propsContent = document.getElementById('propsContent');
    if (propsContent) propsContent.innerHTML = html;
}

// Livello raggiunto seguendo gli id dalla radice, senza cambiare la vista; null se un id manca
function livelloDaPercorso(ids: string[]): Grafo | null {
    let graph = pathStack[0]!.graph;
    for (const id of ids) {
        const nodo = graph.nodes.find((n) => n.id === id);
        if (!nodo?.internal_graph) return null;
        graph = nodo.internal_graph;
    }
    return graph;
}

export function vaiAlProblema(chiave: string): void {
    const p = problemaAttuale(chiave);
    if (!p) return elementoSparito();

    impostaSelezioneCliente(null);
    evidenziaCliente(null);

    // Requisito cliente: alla radice se è sul canvas (il dettaglio centra ed evidenzia), altrimenti solo il dettaglio
    if (TIPI_CLIENTE.has(p.tipo)) {
        if (p.reqId && pathStack[0]!.graph.parentReqPositions?.[p.reqId]) {
            apriPercorso([]);
            setActiveNodeId(null);
            renderUI();
        }
        mostraDettaglioCliente(p.reqId);
        return;
    }

    if (!apriPercorso(p.percorso)) return elementoSparito();
    setActiveNodeId(null);
    const livello = getCurrentLevel();
    const graph = livello.graph;
    const centroBlocco = (nodo: Nodo) => ({
        x: nodo.position.x + (nodo.width || appSettings.node.width) / 2,
        y: nodo.position.y + (nodo.height || appSettings.node.height) / 2
    });

    if (p.tipo === 'senzaPadre' || p.tipo === 'bloccoSenzaDefinizione') {
        const nodo = graph.nodes.find((n) => n.id === (p.ownerId ?? p.nodeId));
        if (!nodo) return elementoSparito();
        const centro = centroBlocco(nodo);
        centraVista(centro.x, centro.y);
        if (p.tipo === 'senzaPadre') {
            selectNode(nodo);
        } else {
            scriviIspettore(`<div class="prop-item"><strong>Blocco senza definizione</strong>${escapeHtml(nodo.label || nodo.id)}</div>
                <div class="empty-props">${escapeHtml(p.motivo)}</div>`);
        }
    } else if (p.tipo === 'senzaFigli') {
        const tipoPadre = livello.parentNode?.type;
        const requisiti = (tipoPadre ? appState.library[tipoPadre]?.requisiti : null) || [];
        const indice = requisiti.findIndex((r) => r.id === p.reqId);
        if (indice < 0 || !p.reqId) return elementoSparito();
        const centro = graph.parentReqPositions?.[p.reqId] || posizioneInColonna(indice);
        centraVista(centro.x, centro.y);
        scriviIspettore('<div class="empty-props">Seleziona un blocco o creane uno nuovo...</div>');
    } else if (p.tipo === 'filoNonValido') {
        if (!graph.edges.some((e) => e.id === p.edgeId)) return elementoSparito();
        const [da = '', a = ''] = p.estremi ?? [];
        scriviIspettore(`<div style="display:flex; flex-direction:column; gap:4px;">
            <h4 style="margin:0 0 6px;">Collegamento non valido</h4>
            <div class="prop-item"><strong>Da</strong>${escapeHtml(da)}</div>
            <div class="prop-item"><strong>A</strong>${escapeHtml(a)}</div>
            <div class="prop-item"><strong>Motivo</strong>${escapeHtml(p.motivo)}</div>
        </div>`);
    }
    renderUI();
    render();
}

export function rimuoviFiloNonValido(chiave: string): void {
    if (!confirm('Vuoi eliminare questo collegamento non valido?')) return;
    const p = problemaAttuale(chiave);
    const graph = p ? livelloDaPercorso(p.percorso) : null;
    if (!p || p.tipo !== 'filoNonValido' || !graph || !graph.edges.some((e) => e.id === p.edgeId)) return elementoSparito();
    graph.edges = graph.edges.filter((e) => e.id !== p.edgeId);
    render();
}

/* --- INIZIALIZZAZIONE --- */

export function initCoerenza(): void {
    document.getElementById('btnDRC')?.addEventListener('click', cambiaModalitaCoerenza);
    // Pannello e modalità vanno insieme: aprirlo dal menu accende, chiuderlo con la ✕ spegne (spec 0021, AC-5)
    aperturaDalMenu('coerenza', cambiaModalitaCoerenza);
    allaVista('coerenza', () => { if (modalitaAttiva) aggiornaSchedaCoerenza(true); });
    allaChiusura('coerenza', () => {
        if (!modalitaAttiva) return;
        spegniCoerenza();
        render();
    });

    document.getElementById('coerenzaRicerca')?.addEventListener('input', (e) => {
        clearTimeout(timerRicerca);
        const valore = (e.target as HTMLInputElement).value;
        timerRicerca = setTimeout(() => {
            ricerca = valore;
            aggiornaSchedaCoerenza(true);
        }, ATTESA_RICERCA);
    });

    document.getElementById('coerenzaGruppi')?.addEventListener('click', (e) => {
        const bersaglio = e.target as Element;
        const rimuovi = bersaglio.closest<HTMLElement>('[data-rimuovi]');
        if (rimuovi) {
            e.stopPropagation();
            rimuoviFiloNonValido(rimuovi.dataset.rimuovi ?? '');
            return;
        }
        const testa = bersaglio.closest<HTMLElement>('[data-gruppo]');
        if (testa) {
            const id = testa.dataset.gruppo ?? '';
            if (gruppiAperti.has(id)) gruppiAperti.delete(id);
            else gruppiAperti.add(id);
            aggiornaSchedaCoerenza(true);
            return;
        }
        const voce = bersaglio.closest<HTMLElement>('[data-chiave]');
        if (voce) vaiAlProblema(voce.dataset.chiave ?? '');
    });

    aggiornaPulsante();
}
