/* --- GERARCHIA DEI REQUISITI: INDICE DELLE OCCORRENZE, CATENA DELLA SCELTA, SCHEDA GERARCHIA ED EVIDENZE SUL CANVAS --- */

// Spec 0005. Un'occorrenza è un requisito in un'istanza precisa: chiave = percorso dei nodi dalla radice al blocco
// che lo possiede (compreso) + '|' + id del requisito; per un requisito cliente '__cliente__|<id>'.
// Indice e catena si rifanno una volta per fotogramma a modalità accesa; modalità, scelta e risultato vivono
// solo in questo modulo e non finiscono mai nel file del progetto.

import { appState, appSettings, pathStack, getCurrentLevel, setActiveNodeId } from './state.js';
import { render, centraVista, evidenziaCliente } from './renderer.js';
import { selectNode, openLibraryBlock, mostraDettaglioCliente } from './inspector.js';
import { impostaSelezioneCliente } from './cliente.js';
import { mostraPannello, chiudiPannello, pannelloVisibile, allaVista, allaChiusura, aperturaDalMenu } from './pannelli.js';
import { coerenzaAttiva, spegniCoerenza } from './coerenza.js';
import { apriPercorso, modaleAperta } from './progetto.js';
import { visitaDerivazioni, getColoreRequisito, isRequisitoCliente, titoloRequisito, ID_CLIENTE } from './model.js';
import { escapeHtml } from './utils.js';
import type { Cliente, Grafo, Libreria, Nodo, Requisito, TipoEstremo } from './tipi.js';

export interface Occorrenza {
    chiave: string;
    percorso: string[];
    etichette: string[];
    reqId: string;
    req: Requisito;
    cliente: boolean;
    padri: Set<string>;
    figli: Set<string>;
}

export interface IndiceGerarchia {
    occorrenze: Map<string, Occorrenza>;
    // Per livello: id del filo → chiavi del padre e del figlio
    filiPerLivello: Map<Grafo, Map<string, { padre: string; figlio: string }>>;
    percorsiConContenuto: Set<string>;
    libreriaAssente: boolean;
}

export interface Catena {
    scelta: string;
    antenati: Set<string>;
    discendenti: Set<string>;
    fili: Map<Grafo, Set<string>>;
    contatori: Map<string, number>;
    colore: string;
}

// Una voce dell'albero: la sua chiave e la voce sopra di lei sul ramo (null per le righe di profondità 1)
interface Voce {
    chiave: string;
    su: Voce | null;
}

type Lato = 'padri' | 'figli';

const MSG_SPARITO = "Questo elemento non c'è più";
const COLORE_RITIRATO = '#9e9e9e';

let modalitaAttiva = false;
let chiaveScelta: string | null = null;
// Eccezioni a mano alla regola dei rami aperti (AC-8): valgono solo per la scelta corrente
const ramiAperti = new Set<string>();
const ramiChiusi = new Set<string>();

// Ultimo calcolo: letto da renderer e scheda
let ultimoIndice: IndiceGerarchia | null = null;
let ultimaCatena: Catena | null = null;
let ultimaImprontaCatena: string | null = null;
let ultimoHtmlScheda: string | null = null;

let fotogrammaRichiesto = false;
let schedaDaAggiornare = false;

// Un numero per ogni oggetto livello, così l'impronta cambia quando Annulla o Ricarica sostituiscono il modello
const idLivelli = new WeakMap<Grafo, number>();
let prossimoIdLivello = 1;

function idLivello(graph: Grafo): number {
    let id = idLivelli.get(graph);
    if (id === undefined) {
        id = prossimoIdLivello++;
        idLivelli.set(graph, id);
    }
    return id;
}

/* --- CHIAVI --- */

function chiaveDi(percorso: string[], reqId: string): string {
    return `${percorso.join('/')}|${reqId}`;
}

function chiaveCliente(reqId: string): string {
    return `${ID_CLIENTE}|${reqId}`;
}

// Gli id dei nodi non contengono '|' (generaId), quindi la prima '|' separa il percorso dall'id del requisito
function scomponiChiave(chiave: string): { cliente: boolean; percorso: string[]; reqId: string } {
    const i = chiave.indexOf('|');
    const testa = chiave.slice(0, i);
    return { cliente: testa === ID_CLIENTE, percorso: testa ? testa.split('/') : [], reqId: chiave.slice(i + 1) };
}

function idAperti(): string[] {
    return pathStack.slice(1).map((l) => l.id);
}

// Chiave di un pin o di un blocco tondo del livello corrente: il pin di un nodo ha percorso [...idAperti, nodo],
// un blocco tondo idAperti (alla radice è un requisito cliente). Così pin e blocco tondo dello stesso requisito coincidono
export function chiaveSulCanvas(ownerType: TipoEstremo, ownerId: string, reqId: string): string {
    const aperti = idAperti();
    if (ownerType === 'parent') return aperti.length === 0 ? chiaveCliente(reqId) : chiaveDi(aperti, reqId);
    return chiaveDi([...aperti, ownerId], reqId);
}

/* --- CALCOLO --- */

// Indice completo delle occorrenze del modello, con padri e figli dai soli fili di derivazione validi (AC-4, AC-5).
// Non cambia mai il modello
// percorsiConContenuto: percorsi dei blocchi con almeno un blocco con definizione dentro (la condizione della Coerenza
// per "senza figli"), usati dalla matrice (spec 0006)
export function calcolaGerarchia(radice: Grafo, libreria: Libreria, cliente: Cliente | null): IndiceGerarchia {
    const occorrenze = new Map<string, Occorrenza>();
    const filiPerLivello = new Map<Grafo, Map<string, { padre: string; figlio: string }>>();
    const percorsiConContenuto = new Set<string>();
    if (!libreria || Object.keys(libreria).length === 0) {
        return { occorrenze, filiPerLivello, percorsiConContenuto, libreriaAssente: true };
    }

    function registra(chiave: string, percorso: string[], etichette: string[], req: Requisito, eCliente: boolean): void {
        if (occorrenze.has(chiave)) return; // due nodi con lo stesso id nello stesso livello: una sola occorrenza
        occorrenze.set(chiave, {
            chiave, percorso, etichette, reqId: req.id, req, cliente: eCliente, padri: new Set(), figli: new Set()
        });
    }

    (cliente?.requisiti || []).forEach((req) => registra(chiaveCliente(req.id), [], [], req, true));

    visitaDerivazioni(radice, libreria, cliente, {
        filo(ctx, edge, esito) {
            if (esito.stato !== 'valido' || !esito.padre || !esito.figlio) return;
            const padre = ctx.tipoPadre === null ? chiaveCliente(esito.padre.reqId) : chiaveDi(ctx.percorso, esito.padre.reqId);
            const figlio = chiaveDi([...ctx.percorso, esito.figlio.ownerId], esito.figlio.reqId);
            let fili = filiPerLivello.get(ctx.graph);
            if (!fili) {
                fili = new Map();
                filiPerLivello.set(ctx.graph, fili);
            }
            fili.set(edge.id, { padre, figlio });
        },
        nodo(ctx, nodo, def) {
            if (!def) return;
            if (ctx.percorso.length > 0) percorsiConContenuto.add(ctx.percorso.join('/'));
            const percorso = [...ctx.percorso, nodo.id];
            const etichette = [...ctx.etichette, nodo.label || nodo.id];
            def.requisiti.forEach((req) => registra(chiaveDi(percorso, req.id), percorso, etichette, req, false));
        }
    });

    // I fili di un livello arrivano prima dei suoi nodi: si collegano a indice completo
    filiPerLivello.forEach((fili) => fili.forEach(({ padre, figlio }) => {
        const p = occorrenze.get(padre);
        const f = occorrenze.get(figlio);
        if (!p || !f) return;
        p.figli.add(figlio);
        f.padri.add(padre);
    }));

    return { occorrenze, filiPerLivello, percorsiConContenuto, libreriaAssente: false };
}

// Tutte le chiavi raggiungibili da 'partenza' seguendo 'lato', partenza esclusa
function raggiungibili(occorrenze: Map<string, Occorrenza>, partenza: string, lato: Lato): Set<string> {
    const visti = new Set<string>();
    const pila = [partenza];
    while (pila.length) {
        const occ = occorrenze.get(pila.pop() as string);
        occ?.[lato].forEach((k) => {
            if (visti.has(k) || k === partenza) return;
            visti.add(k);
            pila.push(k);
        });
    }
    return visti;
}

function ritirato(occ: Occorrenza): boolean {
    return occ.cliente && isRequisitoCliente(occ.req) && occ.req.stato === 'ritirato';
}

// Antenati, discendenti, fili e contatori della chiave scelta; null se la chiave non è nell'indice
export function catenaDi(indice: IndiceGerarchia, chiave: string): Catena | null {
    const occorrenze = indice.occorrenze;
    const scelta = occorrenze.get(chiave);
    if (!scelta) return null;
    const antenati = raggiungibili(occorrenze, chiave, 'padri');
    const discendenti = raggiungibili(occorrenze, chiave, 'figli');

    const fili = new Map<Grafo, Set<string>>();
    indice.filiPerLivello.forEach((filiLivello, graph) => filiLivello.forEach(({ padre, figlio }, edgeId) => {
        const versoAntenati = (figlio === chiave || antenati.has(figlio)) && antenati.has(padre);
        const versoDiscendenti = (padre === chiave || discendenti.has(padre)) && discendenti.has(figlio);
        if (!versoAntenati && !versoDiscendenti) return;
        let insieme = fili.get(graph);
        if (!insieme) {
            insieme = new Set();
            fili.set(graph, insieme);
        }
        insieme.add(edgeId);
    }));

    // Ogni occorrenza della catena conta in ogni blocco che la contiene strettamente (non nei suoi pin)
    const contatori = new Map<string, number>();
    [chiave, ...antenati, ...discendenti].forEach((k) => {
        const percorso = occorrenze.get(k)?.percorso ?? [];
        for (let i = 0; i < percorso.length - 1; i++) {
            const prefisso = percorso.slice(0, i + 1).join('/');
            contatori.set(prefisso, (contatori.get(prefisso) || 0) + 1);
        }
    });

    const colore = ritirato(scelta) ? COLORE_RITIRATO : getColoreRequisito(scelta.req);
    return { scelta: chiave, antenati, discendenti, fili, contatori, colore };
}

function improntaCatena(): string {
    const sparita = sceltaSparita();
    const parti: Array<string | boolean> = [chiaveScelta ?? '', sparita, ultimoIndice?.libreriaAssente ?? ''];
    if (ultimaCatena) {
        const c = ultimaCatena;
        parti.push([...c.antenati].join(','), [...c.discendenti].join(','), c.colore,
            [...c.fili].map(([graph, ids]) => `${idLivello(graph)}:${[...ids].join(',')}`).join(';'),
            [...c.contatori].map(([k, n]) => `${k}=${n}`).join(','));
    }
    return parti.join('\n');
}

// Rifà indice e catena dal modello di adesso; true se ciò che si vede sul canvas è cambiato
export function ricalcolaGerarchia(): boolean {
    const indice = calcolaGerarchia(pathStack[0]!.graph, appState.library, appState.cliente);
    ultimoIndice = indice;
    ultimaCatena = chiaveScelta !== null && !indice.libreriaAssente ? catenaDi(indice, chiaveScelta) : null;
    const impronta = improntaCatena();
    const cambiata = impronta !== ultimaImprontaCatena;
    ultimaImprontaCatena = impronta;
    return cambiata;
}

// L'indice di adesso, ricalcolato se manca
function indice(): IndiceGerarchia {
    if (!ultimoIndice) ricalcolaGerarchia();
    return ultimoIndice as IndiceGerarchia;
}

// La scelta sparita non è uno stato: una chiave scelta che l'indice di adesso non ha (AC-12)
function sceltaSparita(): boolean {
    return chiaveScelta !== null && !!ultimoIndice && !ultimoIndice.libreriaAssente && !ultimoIndice.occorrenze.has(chiaveScelta);
}

/* --- UN FOTOGRAMMA: CALCOLO, SCHEDA E UN SOLO render() IN PIÙ SE SERVE --- */

function richiediFotogramma(): void {
    if (fotogrammaRichiesto) return;
    fotogrammaRichiesto = true;
    requestAnimationFrame(() => {
        fotogrammaRichiesto = false;
        if (!modalitaAttiva) return;
        const cambiata = ricalcolaGerarchia();
        if (schedaDaAggiornare && schedaVisibile()) aggiornaSchedaGerarchia();
        if (cambiata) render();
    });
}

// Chiamata da render() a modalità accesa: al massimo una visita del modello per fotogramma (AC-11)
export function segnaGerarchiaDaRicalcolare(): void {
    richiediFotogramma();
}

// Chiamata da render(): la scheda si ridisegna una volta per fotogramma, solo se si vede e se è cambiata
export function segnaSchedaGerarchiaDaAggiornare(): void {
    if (!modalitaAttiva) return;
    schedaDaAggiornare = true;
    richiediFotogramma();
}

/* --- LETTURE PER IL RENDERER (AC-10) --- */

export function gerarchiaAttiva(): boolean {
    return modalitaAttiva;
}

// Vero se c'è una catena da mostrare: allora tutto ciò che non ne fa parte si attenua
export function catenaAttiva(): boolean {
    return modalitaAttiva && ultimaCatena !== null;
}

export function filoInCatena(graph: Grafo, edgeId: string): boolean {
    return catenaAttiva() && !!ultimaCatena?.fili.get(graph)?.has(edgeId);
}

export function filiInCatena(graph: Grafo): Set<string> {
    return (catenaAttiva() && ultimaCatena?.fili.get(graph)) || new Set();
}

export function occorrenzaInCatena(chiave: string): boolean {
    if (!catenaAttiva() || !ultimaCatena) return false;
    return chiave === ultimaCatena.scelta || ultimaCatena.antenati.has(chiave) || ultimaCatena.discendenti.has(chiave);
}

// Occorrenze della catena strettamente dentro il blocco con questo percorso
export function contatoreGerarchia(percorso: string[]): number {
    if (!catenaAttiva() || !ultimaCatena) return 0;
    return ultimaCatena.contatori.get(percorso.join('/')) || 0;
}

export function coloreCatena(): string {
    return ultimaCatena?.colore || COLORE_RITIRATO;
}

/* --- PULSANTE E MODALITÀ (AC-1) --- */

function aggiornaPulsante(): void {
    const pulsante = document.getElementById('btnGerarchia');
    if (!pulsante) return;
    pulsante.classList.toggle('attivo', modalitaAttiva);
    pulsante.setAttribute('aria-pressed', String(modalitaAttiva));
}

function svuotaScelta(): void {
    chiaveScelta = null;
    ramiAperti.clear();
    ramiChiusi.clear();
}

function accendi(): void {
    if (modalitaAttiva) return;
    // Coerenza e Gerarchia non sono mai accese insieme
    if (coerenzaAttiva()) spegniCoerenza();
    modalitaAttiva = true;
    svuotaScelta();
    ultimaImprontaCatena = null;
    ultimoHtmlScheda = null;
    ricalcolaGerarchia();
    mostraPannello('gerarchia');
    aggiornaPulsante();
}

// Spegne la modalità con pannello, pulsante, scelta e risultato, senza render(): lo fa chi la chiama
export function spegniGerarchia(): void {
    if (!modalitaAttiva) return;
    modalitaAttiva = false;
    svuotaScelta();
    ultimoIndice = null;
    ultimaCatena = null;
    ultimaImprontaCatena = null;
    chiudiPannello('gerarchia');
    aggiornaPulsante();
}

export function cambiaModalitaGerarchia(): void {
    if (modalitaAttiva) spegniGerarchia();
    else accendi();
    render();
}

/* --- SCELTA --- */

// Nuova scelta: calcola subito, così la gerarchia si vede senza attendere il fotogramma
export function scegli(chiave: string): void {
    if (chiave !== chiaveScelta) {
        ramiAperti.clear();
        ramiChiusi.clear();
    }
    chiaveScelta = chiave;
    ricalcolaGerarchia();
    if (schedaVisibile()) aggiornaSchedaGerarchia(true);
    render();
}

// Premi e rilascia su un pin, una porta o un blocco tondo a modalità accesa (AC-2)
export function scegliDaCanvas(owner: { ownerType: TipoEstremo; ownerId: string }, req: Requisito): void {
    const chiave = chiaveSulCanvas(owner.ownerType, owner.ownerId, req.id);
    evidenziaCliente(null);
    const livello = getCurrentLevel();
    if (owner.ownerType === 'node') {
        impostaSelezioneCliente(null);
        const nodo = livello.graph.nodes.find((n) => n.id === owner.ownerId);
        if (nodo) selectNode(nodo);
    } else if (pathStack.length > 1 && livello.parentNode) {
        // Blocco tondo di un livello interno: il blocco che contiene il livello, aperto in libreria senza istanza
        impostaSelezioneCliente(null);
        setActiveNodeId(null);
        openLibraryBlock(livello.parentNode.type);
    } else {
        mostraDettaglioCliente(req.id);
    }
    scegli(chiave);
}

// Dal dettaglio di un requisito cliente: accende la modalità se serve, senza cambiare livello né vista (AC-3)
export function mostraGerarchiaCliente(reqId: string): void {
    mostraGerarchiaDi(chiaveCliente(reqId));
}

// Da una riga della matrice (spec 0006, AC-10): accende la modalità, apre la scheda e va all'istanza come un clic
// su una riga della scheda. Il pannello è esplicito perché accendi() esce subito a modalità già accesa
export function apriGerarchiaSu(chiave: string): void {
    accendi();
    mostraPannello('gerarchia');
    vaiAOccorrenza(chiave);
}

export function mostraGerarchiaDi(chiave: string): void {
    accendi();
    mostraPannello('gerarchia');
    scegli(chiave);
}

// ✕ ed Esc: scheda senza scelta, canvas come oggi, modalità accesa (AC-13)
export function togliScelta(): void {
    svuotaScelta();
    ricalcolaGerarchia();
    if (schedaVisibile()) aggiornaSchedaGerarchia(true);
    render();
}

// Apertura, creazione o import di un progetto: la scelta si toglie senza messaggio; il render() lo fa chi chiama
export function azzeraSceltaGerarchia(): void {
    svuotaScelta();
    ultimaCatena = null;
}

// Dopo un Salva nell'ispettore che ha rinominato id di requisiti del blocco 'blockId': la scelta segue il nuovo id (AC-12)
export function rinominaSceltaGerarchia(blockId: string, mappaRinomina: Record<string, string>): void {
    if (chiaveScelta === null) return;
    const { cliente, percorso, reqId } = scomponiChiave(chiaveScelta);
    const nuovoId = mappaRinomina[reqId];
    if (cliente || percorso.length === 0 || !nuovoId) return;
    let graph: Grafo | undefined = pathStack[0]!.graph;
    let nodo: Nodo | undefined;
    for (const id of percorso) {
        nodo = (graph?.nodes || []).find((n) => n.id === id);
        if (!nodo) return;
        graph = nodo.internal_graph;
    }
    if (nodo?.type === blockId) chiaveScelta = chiaveDi(percorso, nuovoId);
}

/* --- NAVIGAZIONE DA UNA RIGA (AC-9) --- */

function centroBlocco(nodo: Nodo): { x: number; y: number } {
    return {
        x: nodo.position.x + (nodo.width || appSettings.node.width) / 2,
        y: nodo.position.y + (nodo.height || appSettings.node.height) / 2
    };
}

export function vaiAOccorrenza(chiave: string): void {
    // Sempre dall'indice di adesso, mai da oggetti tenuti da prima del clic
    ricalcolaGerarchia();
    const occ = indice().occorrenze.get(chiave);
    const idDiPrima = idAperti();
    const sparito = (): void => {
        apriPercorso(idDiPrima);
        alert(MSG_SPARITO);
        ricalcolaGerarchia();
        if (schedaVisibile()) aggiornaSchedaGerarchia(true);
        render();
    };
    if (!occ) return sparito();

    impostaSelezioneCliente(null);
    evidenziaCliente(null);

    // Requisito cliente: la radice; il dettaglio centra ed evidenzia da sé se è sul canvas
    if (occ.cliente) {
        apriPercorso([]);
        setActiveNodeId(null);
        scegli(chiave);
        mostraDettaglioCliente(occ.reqId);
        return;
    }

    if (!apriPercorso(occ.percorso.slice(0, -1))) return sparito();
    const nodo = getCurrentLevel().graph.nodes.find((n) => n.id === occ.percorso.at(-1));
    if (!nodo) return sparito();
    selectNode(nodo);
    const centro = centroBlocco(nodo);
    centraVista(centro.x, centro.y);
    scegli(chiave);
}

/* --- SCHEDA GERARCHIA (AC-6, AC-7, AC-8) --- */

function schedaVisibile(): boolean {
    return modalitaAttiva && pannelloVisibile('gerarchia');
}

function plurale(n: number, uno: string, molti: string): string {
    return `${n} ${n === 1 ? uno : molti}`;
}

function sulRamo(voce: Voce | null, chiave: string): boolean {
    for (let v = voce; v; v = v.su) if (v.chiave === chiave) return true;
    return false;
}

function viciniDi(voce: Voce, lato: Lato): string[] {
    const occ = indice().occorrenze.get(voce.chiave);
    if (!occ) return [];
    return [...occ[lato]].filter((k) => !sulRamo(voce, k));
}

// Profondità massima D con le righe delle due sezioni fino a D entro il limite; la profondità 1 si vede sempre.
// Conta senza costruire le righe e si ferma appena il totale supera il limite
function profonditaAperta(radice: string, limite: number): number {
    const partenza: Voce = { chiave: radice, su: null };
    let fronti: Array<{ lato: Lato; voci: Voce[] }> = [
        { lato: 'padri', voci: [partenza] },
        { lato: 'figli', voci: [partenza] }
    ];
    let totale = 0;
    let profondita = 0;
    for (;;) {
        const prossimi = fronti.map((f) => ({
            lato: f.lato,
            voci: f.voci.flatMap((v) => viciniDi(v, f.lato).map((k) => ({ chiave: k, su: v })))
        }));
        const righe = prossimi.reduce((n, f) => n + f.voci.length, 0);
        if (righe === 0) return Math.max(1, profondita);
        totale += righe;
        if (totale > limite) return Math.max(1, profondita);
        profondita++;
        fronti = prossimi;
    }
}

function rigaAperta(ramo: string, profondita: number, D: number): boolean {
    if (ramiAperti.has(ramo)) return true;
    if (ramiChiusi.has(ramo)) return false;
    return profondita < D;
}

function etichettaBlocco(occ: Occorrenza): string {
    return occ.cliente ? 'Cliente' : occ.etichette.at(-1) || '';
}

function suggerimento(occ: Occorrenza): string {
    return [pathStack[0]!.label, ...occ.etichette].join(' › ');
}

function idMostrato(occ: Occorrenza): string {
    return isRequisitoCliente(occ.req) ? occ.req.idCliente : occ.reqId;
}

function contenutoRiga(occ: Occorrenza): string {
    return `<span class="pallino-classe" style="background:${escapeHtml(getColoreRequisito(occ.req))}"></span>
        <span class="riga-gerarchia-id">${escapeHtml(idMostrato(occ))}</span>
        <span class="riga-gerarchia-titolo">${escapeHtml(titoloRequisito(occ.req))}</span>
        <span class="riga-gerarchia-blocco">${escapeHtml(etichettaBlocco(occ))}</span>
        ${ritirato(occ) ? '<span class="segno-rit" title="Ritirato">ritirato</span>' : ''}`;
}

// Righe di una sezione, solo quelle visibili: sotto un ramo chiuso non si costruisce nulla
function righeSezione(sezione: string, radice: string, lato: Lato, D: number): string {
    const righe: string[] = [];
    function aggiungi(voce: Voce, profondita: number, chiaviRamo: string[]): void {
        const occ = indice().occorrenze.get(voce.chiave);
        if (!occ) return;
        const ramo = `${sezione}:${JSON.stringify(chiaviRamo)}`;
        const vicini = viciniDi(voce, lato);
        const aperta = vicini.length > 0 && rigaAperta(ramo, profondita, D);
        const segno = vicini.length === 0 ? '<span class="segno-ramo"></span>'
            : `<button class="segno-ramo" data-ramo="${escapeHtml(ramo)}" data-aperto="${aperta}" aria-expanded="${aperta}" title="${aperta ? 'Chiudi' : 'Apri'}">${aperta ? '▾' : '▸'}</button>`;
        righe.push(`<div class="riga-gerarchia${ritirato(occ) ? ' riga-gerarchia-ritirata' : ''}" data-chiave="${escapeHtml(voce.chiave)}"
            style="padding-left:${(profondita - 1) * 14 + 4}px" title="${escapeHtml(suggerimento(occ))}">${segno}${contenutoRiga(occ)}</div>`);
        if (aperta) vicini.forEach((k) => aggiungi({ chiave: k, su: voce }, profondita + 1, [...chiaviRamo, k]));
    }
    const partenza: Voce = { chiave: radice, su: null };
    viciniDi(partenza, lato).forEach((k) => aggiungi({ chiave: k, su: partenza }, 1, [k]));
    return righe.join('');
}

function htmlScheda(): string {
    const idx = indice();
    if (idx.libreriaAssente) {
        return '<div class="empty-props">Libreria non caricata: la gerarchia riparte quando la carichi</div>';
    }
    if (chiaveScelta === null) {
        return '<div class="empty-props">Clicca un pin, una porta o un blocco tondo, oppure usa 🌳 Mostra gerarchia nel dettaglio di un requisito cliente</div>';
    }
    const occ = idx.occorrenze.get(chiaveScelta);
    const c = ultimaCatena;
    if (sceltaSparita() || !c || !occ) {
        return '<div class="empty-props">Il requisito scelto non c\'è più</div>';
    }

    const D = profonditaAperta(chiaveScelta, appSettings.gerarchia.righeAperte);
    const antenati = c.antenati.size
        ? righeSezione('antenati', chiaveScelta, 'padri', D)
        : `<div class="vuoto-gerarchia">${occ.cliente ? 'È un requisito cliente: la catena parte da qui' : 'Nessun antenato'}</div>`;
    const discendenti = c.discendenti.size
        ? righeSezione('discendenti', chiaveScelta, 'figli', D)
        : '<div class="vuoto-gerarchia">Nessun discendente</div>';

    return `<div class="sezione-gerarchia">
            <div class="titolo-sezione-gerarchia"><span>Antenati</span><span class="conteggio-gerarchia" title="Occorrenze diverse">${escapeHtml(plurale(c.antenati.size, 'occorrenza', 'occorrenze'))}</span></div>
            ${antenati}
        </div>
        <div class="barra-gerarchia${ritirato(occ) ? ' riga-gerarchia-ritirata' : ''}" title="${escapeHtml(suggerimento(occ))}">
            ${contenutoRiga(occ)}
            <button id="btnTogliSceltaGerarchia" class="togli-gerarchia" title="Togli la scelta (Esc)">✕</button>
        </div>
        <div class="sezione-gerarchia">
            <div class="titolo-sezione-gerarchia"><span>Discendenti</span><span class="conteggio-gerarchia" title="Occorrenze diverse">${escapeHtml(plurale(c.discendenti.size, 'occorrenza', 'occorrenze'))}</span></div>
            ${discendenti}
        </div>`;
}

// forza: ridisegna anche se il contenuto non è cambiato (apertura della scheda, nuova scelta, rami)
export function aggiornaSchedaGerarchia(forza = false): void {
    schedaDaAggiornare = false;
    const contenitore = document.getElementById('gerarchiaContenuto');
    if (!contenitore || !modalitaAttiva) return;
    const html = htmlScheda();
    if (!forza && html === ultimoHtmlScheda) return;
    ultimoHtmlScheda = html;
    contenitore.innerHTML = html;
}

function cambiaRamo(ramo: string, aperto: boolean): void {
    if (aperto) {
        ramiAperti.delete(ramo);
        ramiChiusi.add(ramo);
    } else {
        ramiChiusi.delete(ramo);
        ramiAperti.add(ramo);
    }
    aggiornaSchedaGerarchia(true);
}

/* --- INIZIALIZZAZIONE --- */

export function initGerarchia(): void {
    document.getElementById('btnGerarchia')?.addEventListener('click', cambiaModalitaGerarchia);
    // Pannello e modalità vanno insieme: aprirlo dal menu accende, chiuderlo con la ✕ spegne (spec 0021, AC-5)
    aperturaDalMenu('gerarchia', cambiaModalitaGerarchia);
    allaVista('gerarchia', () => { if (modalitaAttiva) aggiornaSchedaGerarchia(true); });
    allaChiusura('gerarchia', () => {
        if (!modalitaAttiva) return;
        spegniGerarchia();
        render();
    });

    document.getElementById('gerarchiaContenuto')?.addEventListener('click', (e) => {
        const bersaglio = e.target as Element;
        if (bersaglio.closest('#btnTogliSceltaGerarchia')) {
            togliScelta();
            return;
        }
        const segno = bersaglio.closest<HTMLElement>('[data-ramo]');
        if (segno) {
            e.stopPropagation();
            cambiaRamo(segno.dataset.ramo ?? '', segno.dataset.aperto === 'true');
            return;
        }
        const riga = bersaglio.closest<HTMLElement>('.riga-gerarchia[data-chiave]');
        if (riga) vaiAOccorrenza(riga.dataset.chiave ?? '');
    });

    // Esc toglie la scelta: mai dentro un campo di testo, con una finestra aperta, a modalità spenta o senza scelta
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !modalitaAttiva || chiaveScelta === null) return;
        if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]') || modaleAperta()) return;
        e.preventDefault();
        togliScelta();
    });

    aggiornaPulsante();
}
