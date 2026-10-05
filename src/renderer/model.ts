/* --- MODELLO DATI: BLOCCHI, REQUISITI, TESTI DA ESPORTARE, REGOLE DI COLLEGAMENTO E MIGRAZIONE --- */

// Formato della libreria (chiave = id del blocco): vedi Libreria in tipi.ts.
// Un requisito con tipologia è di interfaccia; con tipologia null è di capacità.

import { appSettings, appState } from './state.js';
import type { Blocco, Cliente, Filo, Grafo, Libreria, Nodo, Requisito, RequisitoCliente, RequisitoLibreria, TestoExport, TipoEstremo } from './tipi.js';
import { generaId } from './utils.js';

export const CAPACITA = 'Capacità';

// Padre virtuale della radice: i requisiti cliente (spec 0003). È l'ownerId dei loro blocchi tondi e dei loro fili
export const ID_CLIENTE = '__cliente__';

type Grezzo = Record<string, unknown>;

// Un requisito cliente ha idCliente; uno di libreria no
export function isRequisitoCliente(req: Requisito | null | undefined): req is RequisitoCliente {
    return Boolean(req && (req as Partial<RequisitoCliente>).idCliente !== undefined);
}

// Titolo da mostrare: il titolo, o per un requisito cliente senza titolo l'inizio del testo
export function titoloRequisito(req: Requisito | null | undefined): string {
    if (!req) return '';
    if (req.titolo) return req.titolo;
    const testo = isRequisitoCliente(req) ? req.testo || '' : '';
    return testo.length > 30 ? `${testo.slice(0, 30)}…` : testo;
}

export function isInterfaccia(req: Requisito | null | undefined): req is Requisito & { tipologia: string } {
    return Boolean(req && req.tipologia);
}

// Classe usata da filtri e colori: la tipologia per l'interfaccia, 'Capacità' altrimenti
export function getClasseRequisito(req: Requisito | null | undefined): string {
    return isInterfaccia(req) ? req.tipologia : CAPACITA;
}

export function getTipologie(): string[] {
    return Object.keys(appSettings?.requirements?.typeColors || {});
}

export function getColoreRequisito(req: Requisito | null | undefined): string {
    const colori = appSettings.requirements;
    if (!isInterfaccia(req)) return colori.capabilityColor;
    return colori.typeColors[req.tipologia] || '#555';
}

export function descriviRequisito(req: Requisito): string {
    if (isRequisitoCliente(req)) {
        const stato = [req.stato === 'ritirato' ? 'Ritirato' : '', req.modificato ? 'Modificato' : ''].filter(Boolean).join(', ');
        return [
            `${req.idCliente} (${req.id})${req.titolo ? ` · ${req.titolo}` : ''}`,
            isInterfaccia(req) ? `Interfaccia: ${req.tipologia}` : 'Capacità',
            ...(stato ? [stato] : []),
            req.testo
        ].join('\n');
    }
    const righe = [
        `${req.id} · ${req.titolo || '(senza titolo)'}`,
        isInterfaccia(req) ? `Interfaccia: ${req.tipologia}` : 'Capacità',
        `Verifica: ${req.metodoVerifica || 'non definita'}`
    ];
    req.testiExport.forEach((t) => righe.push(`[${t.documento || '?'}] ${t.testo}`));
    return righe.join('\n');
}

/* --- MIGRAZIONE: accetta il formato vecchio (name/category/requirements/type),
       la bozza con chiavi con spazi ("metodo di verifica", export_text) e il formato nuovo --- */

function primoDefinito(...valori: unknown[]): unknown {
    return valori.find((v) => v !== undefined && v !== null);
}

function comeTesto(valore: unknown): string {
    return String(valore ?? '').trim();
}

function grezzo(valore: unknown): Grezzo {
    return valore !== null && typeof valore === 'object' ? valore as Grezzo : {};
}

export function normalizzaTestoExport(raw: unknown): TestoExport {
    const r = grezzo(raw);
    return {
        testo: comeTesto(primoDefinito(r.testo, r.description)),
        documento: comeTesto(primoDefinito(r.documento, r['documento di riferimento']))
    };
}

export function normalizzaRequisito(raw: unknown): RequisitoLibreria {
    const r = grezzo(raw);
    let tipologia: string | null = comeTesto(primoDefinito(r.tipologia, r.type)) || null;

    // La bozza usava un flag "interfaccia" esplicito: ora decide solo la tipologia
    if (r.interfaccia !== undefined) {
        const eInterfaccia = r.interfaccia === true || r.interfaccia === 'true';
        if (!eInterfaccia) {
            tipologia = null;
        } else if (!tipologia) {
            tipologia = getTipologie()[0] || null;
            console.warn(`Requisito '${String(r.id)}': era di interfaccia senza tipologia, assegnata '${tipologia}'. Controllala.`);
        }
    }

    let testi = primoDefinito(r.testiExport, r.export_text);
    if (!Array.isArray(testi)) {
        // Nel formato vecchio la descrizione era un solo testo senza documento
        testi = r.description ? [{ testo: r.description, documento: '' }] : [];
    }

    return {
        id: comeTesto(primoDefinito(r.id, generaId('req'))),
        titolo: comeTesto(primoDefinito(r.titolo, r.title, r.name)),
        tipologia,
        metodoVerifica: comeTesto(primoDefinito(r.metodoVerifica, r['metodo di verifica'])),
        testiExport: (testi as unknown[]).map(normalizzaTestoExport)
    };
}

export function normalizzaBlocco(chiave: string, raw: unknown): Blocco {
    const r = grezzo(raw);
    let categoria = comeTesto(primoDefinito(r.categoria, r.category));
    let sottocategoria = comeTesto(primoDefinito(r.sottocategoria, r['sotto-categoria']));

    // Formato vecchio: "Elettrica/Controllo" in un solo campo
    if (!sottocategoria && categoria.includes('/')) {
        const [prima = '', ...resto] = categoria.split('/');
        categoria = prima.trim();
        sottocategoria = resto.join('/').trim();
    }

    const requisiti = primoDefinito(r.requisiti, r.requirements, r.req);

    return {
        id: chiave,
        titolo: comeTesto(primoDefinito(r.titolo, r.title, r.name, chiave)),
        descrizione: comeTesto(primoDefinito(r.descrizione, r.description)),
        categoria,
        sottocategoria,
        requisiti: Array.isArray(requisiti) ? requisiti.map(normalizzaRequisito) : []
    };
}

// Accetta { library: {...} }, { libreria: {...} } oppure la mappa nuda
export function normalizzaLibreria(dati: unknown): Libreria {
    const d = grezzo(dati);
    const mappa = d.library || d.libreria || dati;
    if (!mappa || typeof mappa !== 'object' || Array.isArray(mappa)) {
        throw new Error('Il file non contiene una libreria di blocchi valida.');
    }
    const libreria: Libreria = {};
    Object.entries(mappa as Grezzo).forEach(([chiave, raw]) => {
        if (raw && typeof raw === 'object') libreria[chiave] = normalizzaBlocco(chiave, raw);
    });
    return libreria;
}

// Id requisito usati in più punti della libreria (devono essere univoci)
export function trovaIdRequisitiDuplicati(libreria: Libreria): string[] {
    const visti = new Map<string, string>();
    const duplicati: string[] = [];
    Object.values(libreria).forEach((blocco) => {
        blocco.requisiti.forEach((req) => {
            if (visti.has(req.id)) duplicati.push(`${req.id} (${visti.get(req.id)} e ${blocco.id})`);
            else visti.set(req.id, blocco.id);
        });
    });
    return duplicati;
}

// Primo id libero del tipo base_001, base_002, ... non presente in libreria né in 'occupatiExtra'
export function idRequisitoLibero(libreria: Libreria, base: string, occupatiExtra: Iterable<string> = []): string {
    const occupati = new Set(occupatiExtra);
    Object.values(libreria).forEach((b) => b.requisiti.forEach((r) => occupati.add(r.id)));
    for (let n = 1; ; n++) {
        const candidato = `${base}_${String(n).padStart(3, '0')}`;
        if (!occupati.has(candidato)) return candidato;
    }
}

/* --- REQUISITI DEI BLOCCHI TONDI: IL PADRE DI UN LIVELLO --- */

// Indice id → requisito cliente, ricostruito solo quando cambia l'elenco (import, apertura, annulla)
let indiceCliente: { elenco: RequisitoCliente[] | null; lunghezza: number; mappa: Map<string, RequisitoCliente> } = { elenco: null, lunghezza: 0, mappa: new Map() };

function mappaCliente(): Map<string, RequisitoCliente> {
    const elenco = appState.cliente?.requisiti || [];
    if (indiceCliente.elenco !== elenco || indiceCliente.lunghezza !== elenco.length) {
        indiceCliente = { elenco, lunghezza: elenco.length, mappa: new Map(elenco.map((r) => [r.id, r])) };
    }
    return indiceCliente.mappa;
}

// Requisiti dei blocchi tondi di un livello: tipoPadre null = radice, cioè i requisiti cliente
export function requisitiPadre(tipoPadre: string | null | undefined): Requisito[] {
    if (tipoPadre === null || tipoPadre === undefined) return appState.cliente?.requisiti || [];
    return appState.library[tipoPadre]?.requisiti || [];
}

export function requisitoPadre(tipoPadre: string | null | undefined, reqId: string): Requisito | null {
    if (tipoPadre === null || tipoPadre === undefined) return mappaCliente().get(reqId) || null;
    return appState.library[tipoPadre]?.requisiti.find((r) => r.id === reqId) || null;
}

/* --- REGOLE DI COLLEGAMENTO --- */

// Un estremo di un filo; req null se il requisito non esiste più
export interface Estremo {
    ownerId: string;
    reqId: string;
    ownerType: TipoEstremo;
    req: Requisito | null;
    descrizione?: string;
    mancante?: boolean;
    senzaDefinizione?: boolean;
}

// Restituisce il motivo per cui il collegamento non è ammesso, oppure null
export function verificaCompatibilita(a: Estremo, b: Estremo): string | null {
    if (!a.req || !b.req) return 'Uno dei due requisiti non esiste più.';
    if (a.ownerType === b.ownerType && a.ownerId === b.ownerId && a.reqId === b.reqId) {
        return 'Non puoi collegare un requisito a se stesso.';
    }
    if (a.ownerType === 'parent' && b.ownerType === 'parent') {
        return 'Due requisiti del blocco padre non si collegano tra loro.';
    }
    if (isInterfaccia(a.req) !== isInterfaccia(b.req)) {
        return 'Un requisito di interfaccia si collega solo a un altro requisito di interfaccia, uno di capacità solo a un altro di capacità.';
    }
    if (isInterfaccia(a.req) && a.req.tipologia !== b.req.tipologia) {
        return `Tipologie diverse: '${a.req.tipologia}' e '${String(b.req.tipologia)}'.`;
    }
    return null;
}

// Solo per i fili nuovi: la pulizia dopo un Salva o un import usa verificaCompatibilita, che tiene i fili dei ritirati
export function verificaCollegamento(a: Estremo, b: Estremo, edges: Filo[]): string | null {
    const errore = verificaCompatibilita(a, b);
    if (errore) return errore;
    if ([a, b].some((e) => e.ownerType === 'parent' && isRequisitoCliente(e.req) && e.req.stato === 'ritirato')) {
        return 'Requisito cliente ritirato: non si collega.';
    }
    const stessoEstremo = (edgeId: string, edgeHandle: string, edgeType: TipoEstremo, e: Estremo) =>
        edgeId === e.ownerId && edgeHandle === e.reqId && edgeType === e.ownerType;
    const esiste = edges.some((edge) =>
        (stessoEstremo(edge.source, edge.sourceHandle, edge.sourceType, a) && stessoEstremo(edge.target, edge.targetHandle, edge.targetType, b)) ||
        (stessoEstremo(edge.source, edge.sourceHandle, edge.sourceType, b) && stessoEstremo(edge.target, edge.targetHandle, edge.targetType, a))
    );
    return esiste ? 'Questi due requisiti sono già collegati.' : null;
}

// Un filo che parte da un requisito del blocco padre è una derivazione padre → figlio
export function isDerivazione(edge: Filo): boolean {
    return edge.sourceType === 'parent' || edge.targetType === 'parent';
}

/* --- VISITA DELLE DERIVAZIONI: LA USANO COERENZA E GERARCHIA (spec 0005) --- */

export interface ContestoLivello<S> {
    graph: Grafo;
    // Il nodo che contiene il livello (null alla radice)
    nodoPadre: Nodo | null;
    tipoPadre: string | null;
    ownerPadre: string;
    percorso: string[];
    etichette: string[];
    // Pila dei nodi aperti fino a qui
    nodi: Nodo[];
    // Oggetto vuoto per livello, a disposizione dell'osservatore
    stato: S;
}

export interface EsitoFilo {
    stato: 'valido' | 'nonValido' | 'ignorato';
    motivo: string | null;
    a: Estremo;
    b: Estremo;
    derivazione: boolean;
    // Solo per un filo valido di derivazione
    padre: Estremo | null;
    figlio: Estremo | null;
}

export interface Osservatore<S> {
    inizioLivello?(ctx: ContestoLivello<S>): void;
    filo?(ctx: ContestoLivello<S>, edge: Filo, esito: EsitoFilo): void;
    nodo?(ctx: ContestoLivello<S>, nodo: Nodo, def: Blocco | null): void;
    fineLivello?(ctx: ContestoLivello<S>): void;
}

// Percorre tutto il modello e riporta all'osservatore livelli, fili (con il loro esito) e nodi. Non cambia mai il modello
// e non ha regole sui ritirati: ognuno ci applica le sue. Per ogni livello, in quest'ordine (tutte facoltative):
// inizioLivello, filo per ogni filo, nodo per ogni nodo (def null se senza definizione), fineLivello,
// poi la discesa nei nodi con definizione e internal_graph, nell'ordine del file.
export function visitaDerivazioni<S extends object = Record<string, unknown>>(
    radice: Grafo, libreria: Libreria, cliente: Cliente | null, osservatore: Osservatore<S> = {}
): void {
    const mappaRequisitiCliente = new Map((cliente?.requisiti || []).map((r) => [r.id, r]));

    function visita(graph: Grafo, nodoPadre: Nodo | null, percorso: string[], etichette: string[], nodi: Nodo[]): void {
        const tipoPadre = nodoPadre ? nodoPadre.type : null;
        const ownerPadre = nodoPadre ? nodoPadre.id : ID_CLIENTE;
        const nodiLivello = graph.nodes || [];
        const perId = new Map(nodiLivello.map((n) => [n.id, n]));
        const ctx: ContestoLivello<S> = { graph, nodoPadre, tipoPadre, ownerPadre, percorso, etichette, nodi, stato: {} as S };

        const requisitoDelPadre = (reqId: string): Requisito | null => tipoPadre === null
            ? mappaRequisitiCliente.get(reqId) || null
            : libreria[tipoPadre]?.requisiti.find((r) => r.id === reqId) || null;

        // Estremo di un filo: con req, oppure mancante / senza definizione
        function estremo(ownerId: string, reqId: string, ownerType: TipoEstremo): Estremo {
            if (ownerType === 'parent') {
                return { ownerId, reqId, ownerType, req: requisitoDelPadre(reqId), descrizione: `blocco tondo · requisito ${reqId}` };
            }
            const nodo = perId.get(ownerId);
            if (!nodo) return { ownerId, reqId, ownerType, req: null, mancante: true, descrizione: `blocco ${ownerId} (non c'è più) · requisito ${reqId}` };
            const def = libreria[nodo.type];
            if (!def) return { ownerId, reqId, ownerType, req: null, senzaDefinizione: true, descrizione: `blocco ${nodo.label || nodo.id} · requisito ${reqId}` };
            return {
                ownerId, reqId, ownerType, req: def.requisiti.find((r) => r.id === reqId) || null,
                descrizione: `blocco ${nodo.label || nodo.id} · requisito ${reqId}`
            };
        }

        osservatore.inizioLivello?.(ctx);

        (graph.edges || []).forEach((edge) => {
            const a = estremo(edge.source, edge.sourceHandle, edge.sourceType);
            const b = estremo(edge.target, edge.targetHandle, edge.targetType);
            let stato: EsitoFilo['stato'] = 'valido';
            let motivo: string | null = null;
            if (a.mancante || b.mancante) {
                stato = 'nonValido';
                motivo = 'Il blocco collegato non esiste più.';
            } else if (a.senzaDefinizione || b.senzaDefinizione) {
                stato = 'ignorato';
            } else {
                motivo = verificaCompatibilita(a, b);
                if (motivo) stato = 'nonValido';
            }
            const derivazione = isDerivazione(edge);
            let padre: Estremo | null = null;
            let figlio: Estremo | null = null;
            if (stato === 'valido' && derivazione) [padre, figlio] = a.ownerType === 'parent' ? [a, b] : [b, a];
            osservatore.filo?.(ctx, edge, { stato, motivo, a, b, derivazione, padre, figlio });
        });

        nodiLivello.forEach((nodo) => osservatore.nodo?.(ctx, nodo, libreria[nodo.type] || null));
        osservatore.fineLivello?.(ctx);

        // In profondità, nell'ordine del file; il contenuto di un blocco senza definizione non è visitato
        nodiLivello.forEach((nodo) => {
            if (!libreria[nodo.type] || !nodo.internal_graph) return;
            visita(nodo.internal_graph, nodo, [...percorso, nodo.id], [...etichette, nodo.label || nodo.id], [...nodi, nodo]);
        });
    }

    visita(radice, null, [], [], []);
}

/* --- AGGIORNAMENTO DEI RIFERIMENTI DOPO LA MODIFICA DI UN BLOCCO DI LIBRERIA --- */

// Percorre tutto il modello (ogni livello annidato) e, per ogni riferimento ai requisiti del blocco 'blockId':
// rinomina gli id cambiati (mappaRinomina: vecchioId → nuovoId), toglie le posizioni dei pin non più validi
// e rimuove i fili che puntano a requisiti eliminati o non più compatibili. Restituisce i fili rimossi.
// trovaPadre(tipoPadre, reqId) dà il requisito di un blocco tondo: alla radice (tipoPadre null) è un requisito cliente
export function aggiornaRiferimentiRequisiti(
    radice: Grafo, libreria: Libreria, blockId: string, mappaRinomina: Record<string, string>,
    trovaPadre: (tipoPadre: string | null, reqId: string) => Requisito | null = requisitoPadre
): number {
    const rinomina = (id: string) => mappaRinomina[id] || id;
    const requisitiBlocco = libreria[blockId]?.requisiti || [];
    const trovaNelBlocco = (id: string) => requisitiBlocco.find((r) => r.id === id);
    let filiRimossi = 0;

    function riallineaMappa<V>(mappa: Record<string, V> | undefined, tieni: (req: RequisitoLibreria | undefined) => boolean): Record<string, V> | undefined {
        if (!mappa) return mappa;
        const nuova: Record<string, V> = {};
        Object.entries(mappa).forEach(([id, valore]) => {
            const nuovoId = rinomina(id);
            if (tieni(trovaNelBlocco(nuovoId))) nuova[nuovoId] = valore;
        });
        return nuova;
    }

    function visita(graph: Grafo, tipoPadre: string | null): void {
        const tipoEstremo = (ownerId: string, ownerType: TipoEstremo): string | null | undefined =>
            ownerType === 'parent' ? tipoPadre : graph.nodes.find((n) => n.id === ownerId)?.type;
        const reqEstremo = (ownerId: string, reqId: string, ownerType: TipoEstremo): Requisito | null => {
            if (ownerType === 'parent' && tipoPadre === null) return trovaPadre(null, reqId);
            const tipo = tipoEstremo(ownerId, ownerType);
            return (tipo ? libreria[tipo]?.requisiti.find((r) => r.id === reqId) : null) || null;
        };

        if (tipoPadre === blockId) {
            const mappa = riallineaMappa(graph.parentReqPositions, (req) => Boolean(req));
            if (mappa) graph.parentReqPositions = mappa;
        }

        graph.edges = graph.edges.filter((edge) => {
            const tocca = tipoEstremo(edge.source, edge.sourceType) === blockId ||
                          tipoEstremo(edge.target, edge.targetType) === blockId;
            if (!tocca) return true;

            if (tipoEstremo(edge.source, edge.sourceType) === blockId) edge.sourceHandle = rinomina(edge.sourceHandle);
            if (tipoEstremo(edge.target, edge.targetType) === blockId) edge.targetHandle = rinomina(edge.targetHandle);

            const a: Estremo = { ownerId: edge.source, reqId: edge.sourceHandle, ownerType: edge.sourceType, req: reqEstremo(edge.source, edge.sourceHandle, edge.sourceType) };
            const b: Estremo = { ownerId: edge.target, reqId: edge.targetHandle, ownerType: edge.targetType, req: reqEstremo(edge.target, edge.targetHandle, edge.targetType) };
            const valido = verificaCompatibilita(a, b) === null;
            if (!valido) filiRimossi++;
            return valido;
        });

        graph.nodes.forEach((node) => {
            if (node.type === blockId) {
                // Le porte sul bordo esistono solo per i requisiti di interfaccia
                const mappa = riallineaMappa(node.pinPositions, (req) => isInterfaccia(req));
                if (mappa) node.pinPositions = mappa;
            }
            if (node.internal_graph) visita(node.internal_graph, node.type);
        });
    }

    visita(radice, null);
    return filiRimossi;
}
