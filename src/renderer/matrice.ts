/* --- MATRICE DI TRACCIABILITÀ: CALCOLO PER ID, FILTRI, FINESTRA ED EXPORT MARKDOWN --- */

// Spec 0006. La matrice si calcola all'apertura della finestra dall'indice delle occorrenze della Gerarchia (spec 0005)
// e raggruppa per id del requisito: coppie padre → figlio, padri senza figli e requisiti senza padre con le regole
// della Coerenza, istanza per istanza. Risultato, filtri e limite vivono solo in questo modulo, mai in appState.

import { appState, appSettings, pathStack } from './state.js';
import { calcolaGerarchia, apriGerarchiaSu, type IndiceGerarchia, type Occorrenza } from './gerarchia.js';
import { infoProgetto } from './progetto.js';
import { infoLibreria } from './libreria.js';
import { scaricaFileTesto } from './storage.js';
import { CAPACITA, getTipologie, getClasseRequisito, isRequisitoCliente, titoloRequisito } from './model.js';
import { escapeHtml, slugifyId, dataOggi } from './utils.js';
import { mostraPannello, pannelloAperto, pannelloVisibile, allaVista, allaChiusura } from './pannelli.js';
import type { Blocco, Cliente, Libreria, RequisitoLibreria } from './tipi.js';

export interface VoceMatrice {
    id: string;
    idMostrato: string;
    titolo: string;
    cliente: boolean;
    ritirato: boolean;
    blocco: string;
    percorsi: string[];
    classe: string;
    metodo: string;
    documenti: string[];
    testoRicerca: string;
    ordineCliente: number;
    // Chiavi delle occorrenze, dalla meno profonda
    occorrenze: string[];
    livello: number;
    istanzeConContenuto: number;
    istanzeConFigli: number;
    istanzeSenzaFigli: number;
    chiaveSenzaFigli: string | null;
    istanzeSenzaPadre: number;
    chiaveSenzaPadre: string | null;
    notaSenzaPadre: string;
}

export interface RigaFiglio {
    figlio: VoceMatrice;
    istanze: number;
    chiaveFiglio: string;
}

export interface GruppoMatrice {
    padre: VoceMatrice;
    figli: RigaFiglio[];
    stato: 'coperto' | 'parziale' | 'senzaFigli';
    nota: string;
}

export interface Matrice {
    libreriaAssente: boolean;
    gruppi: GruppoMatrice[];
    senzaPadre: VoceMatrice[];
    documentiExtra: string[];
    voci: VoceMatrice[];
}

export type TabellaMatrice = 'derivazioni' | 'senzaPadre';

export interface OrdineColonna {
    colonna: string;
    verso: 'asc' | 'desc';
}

export interface FiltriMatrice {
    // '' = Tutti
    documento: string;
    lato: 'entrambi' | 'padre' | 'figlio';
    // '' = Tutte
    classe: string;
    ricerca: string;
    // Filtri di colonna (spec 0031): chiave della colonna → valori scelti; colonna assente = nessun filtro
    colonne?: Record<string, string[]>;
    // Un ordinamento per tabella; assente = ordine della spec 0006
    ordine?: Partial<Record<TabellaMatrice, OrdineColonna>>;
}

// Una riga della tabella delle derivazioni: la coppia padre → figlio, o il padre da solo (riga null)
export interface RigaDerivazione {
    gruppo: GruppoMatrice;
    riga: RigaFiglio | null;
}

interface ColonnaMatrice<T> {
    chiave: string;
    nome: string;
    // Sul padre si ordinano i gruppi, sul figlio le righe dentro i gruppi
    lato: 'padre' | 'figlio';
    // Valori della cella per filtro e ordinamento: più di uno solo per Documenti, [''] = cella vuota
    valori: (r: T) => string[];
}

const docs = (v: VoceMatrice) => v.documenti.length ? v.documenti : [''];

export const COLONNE_DERIVAZIONI: Array<ColonnaMatrice<RigaDerivazione>> = [
    { chiave: 'idPadre', nome: 'ID padre', lato: 'padre', valori: (r) => [r.gruppo.padre.idMostrato] },
    { chiave: 'titoloPadre', nome: 'Titolo padre', lato: 'padre', valori: (r) => [r.gruppo.padre.titolo] },
    { chiave: 'bloccoPadre', nome: 'Blocco padre', lato: 'padre', valori: (r) => [r.gruppo.padre.blocco] },
    { chiave: 'metodoPadre', nome: 'Metodo padre', lato: 'padre', valori: (r) => [r.gruppo.padre.metodo] },
    { chiave: 'documentiPadre', nome: 'Documenti padre', lato: 'padre', valori: (r) => docs(r.gruppo.padre) },
    { chiave: 'classe', nome: 'Classe', lato: 'figlio', valori: (r) => [r.riga ? r.riga.figlio.classe : r.gruppo.padre.classe] },
    { chiave: 'idFiglio', nome: 'ID figlio', lato: 'figlio', valori: (r) => [r.riga?.figlio.idMostrato ?? ''] },
    { chiave: 'titoloFiglio', nome: 'Titolo figlio', lato: 'figlio', valori: (r) => [r.riga?.figlio.titolo ?? ''] },
    { chiave: 'bloccoFiglio', nome: 'Blocco figlio', lato: 'figlio', valori: (r) => [r.riga?.figlio.blocco ?? ''] },
    { chiave: 'metodoFiglio', nome: 'Metodo figlio', lato: 'figlio', valori: (r) => [r.riga?.figlio.metodo ?? ''] },
    { chiave: 'documentiFiglio', nome: 'Documenti figlio', lato: 'figlio', valori: (r) => r.riga ? docs(r.riga.figlio) : [''] },
    { chiave: 'istanze', nome: 'Istanze', lato: 'figlio', valori: (r) => [r.riga ? String(r.riga.istanze) : ''] },
    { chiave: 'note', nome: 'Note', lato: 'padre', valori: (r) => [r.gruppo.nota] }
];

export const COLONNE_SENZA_PADRE: Array<ColonnaMatrice<VoceMatrice>> = [
    { chiave: 'spId', nome: 'ID', lato: 'padre', valori: (v) => [v.idMostrato] },
    { chiave: 'spTitolo', nome: 'Titolo', lato: 'padre', valori: (v) => [v.titolo] },
    { chiave: 'spBlocco', nome: 'Blocco', lato: 'padre', valori: (v) => [v.blocco] },
    { chiave: 'spClasse', nome: 'Classe', lato: 'padre', valori: (v) => [v.classe] },
    { chiave: 'spMetodo', nome: 'Metodo', lato: 'padre', valori: (v) => [v.metodo] },
    { chiave: 'spDocumenti', nome: 'Documenti', lato: 'padre', valori: docs },
    { chiave: 'spNote', nome: 'Note', lato: 'padre', valori: (v) => [v.notaSenzaPadre] }
];

export interface MatriceFiltrata {
    gruppi: Array<{ gruppo: GruppoMatrice; righe: RigaFiglio[] }>;
    senzaPadre: VoceMatrice[];
    conteggi: { padri: number; derivazioni: number; senzaFigli: number; senzaPadre: number };
}

const MSG_SENZA_LIBRERIA = 'Libreria non caricata: la matrice si calcola quando la carichi';
const MSG_VUOTA = 'Nessuna derivazione nel modello';
const MSG_NESSUNA_RIGA = 'Nessuna riga con questi filtri';
const DOC_CLIENTE = 'Cliente';
const MAX_PERCORSI = 10;
const RITARDO_RICERCA = 200;

const INTESTAZIONI = COLONNE_DERIVAZIONI.map((c) => c.nome);
const INTESTAZIONI_SENZA_PADRE = COLONNE_SENZA_PADRE.map((c) => c.nome);
const NOMI_VERSO: Record<OrdineColonna['verso'], string> = { asc: 'A→Z', desc: 'Z→A' };
const NOMI_LATO: Record<FiltriMatrice['lato'], string> = { entrambi: 'uno dei due', padre: 'padre', figlio: 'figlio' };

// Uno solo, riusato: con migliaia di gruppi localeCompare ripetuto costa troppo
const collator = new Intl.Collator('it', { numeric: true });

let ultimaMatrice: Matrice | null = null;
let ultimoFiltrato: MatriceFiltrata | null = null;
// Restano tra un'apertura e l'altra finché la pagina è aperta (AC-12)
const filtri: FiltriMatrice & Required<Pick<FiltriMatrice, 'colonne' | 'ordine'>> =
    { documento: '', lato: 'entrambi', classe: '', ricerca: '', colonne: {}, ordine: {} };
let gruppiMostrati = 0;
let timerRicerca: ReturnType<typeof setTimeout> | null = null;

let daAggiornare = false;
let timerModello: ReturnType<typeof setTimeout> | null = null;
const RITARDO_MODELLO = 250;

function campo<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

/* --- CALCOLO (AC-2 … AC-7) --- */

function plurale(n: number, uno: string, molti: string): string {
    return `${n} ${n === 1 ? uno : molti}`;
}

// Documenti distinti dei testi da esportare, nell'ordine di settings; quelli fuori elenco in fondo, in ordine alfabetico (AC-4)
function documentiDi(req: RequisitoLibreria): string[] {
    const ordine = appSettings.documenti || [];
    const documenti = [...new Set((req.testiExport || []).map((t) => String(t.documento ?? '').trim()).filter(Boolean))];
    return documenti.sort((a, b) => {
        const ia = ordine.indexOf(a);
        const ib = ordine.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b, 'it');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

function nuovaVoce(occ: Occorrenza, bloccoDi: Map<string, Blocco>, ordineCliente: Map<string, number>): VoceMatrice {
    const req = occ.req;
    const cliente = isRequisitoCliente(req);
    const idMostrato = String((cliente ? req.idCliente : req.id) ?? '');
    const titolo = titoloRequisito(req);
    const blocco = bloccoDi.get(occ.reqId);
    return {
        id: occ.reqId,
        idMostrato,
        titolo,
        cliente: occ.cliente,
        ritirato: occ.cliente && cliente && req.stato === 'ritirato',
        blocco: occ.cliente ? 'Cliente' : blocco?.titolo || blocco?.id || '',
        percorsi: [],
        classe: getClasseRequisito(req),
        metodo: cliente ? '' : req.metodoVerifica || '',
        documenti: cliente ? [DOC_CLIENTE] : documentiDi(req),
        testoRicerca: `${idMostrato}\n${titolo}`.toLowerCase(),
        ordineCliente: occ.cliente ? ordineCliente.get(occ.reqId) ?? 0 : 0,
        occorrenze: [],
        livello: 0,
        istanzeConContenuto: 0,
        istanzeConFigli: 0,
        istanzeSenzaFigli: 0,
        chiaveSenzaFigli: null,
        istanzeSenzaPadre: 0,
        chiaveSenzaPadre: null,
        notaSenzaPadre: ''
    };
}

// Prima i requisiti cliente nell'ordine della lista, poi per livello e id in ordine naturale (AC-7)
function confronta(a: VoceMatrice, b: VoceMatrice): number {
    if (a.cliente !== b.cliente) return a.cliente ? -1 : 1;
    if (a.cliente) return a.ordineCliente - b.ordineCliente;
    return a.livello - b.livello || collator.compare(a.idMostrato, b.idMostrato);
}

// Funzione pura: non cambia mai il modello. nomeRadice serve solo ai suggerimenti dei percorsi
export function calcolaMatrice(indice: IndiceGerarchia, libreria: Libreria, cliente: Cliente | null, nomeRadice = ''): Matrice {
    if (indice.libreriaAssente) return { libreriaAssente: true, gruppi: [], senzaPadre: [], documentiExtra: [], voci: [] };

    // Gli id dei requisiti sono unici in tutta la libreria; per difesa, con un doppione vince il primo blocco
    const bloccoDi = new Map<string, Blocco>();
    Object.values(libreria).forEach((def) => (def.requisiti || []).forEach((req) => {
        if (!bloccoDi.has(req.id)) bloccoDi.set(req.id, def);
    }));
    const ordineCliente = new Map((cliente?.requisiti || []).map((r, i) => [r.id, i]));
    const occorrenze = indice.occorrenze;
    const eRitirato = (occ: Occorrenza | undefined) => !!occ && occ.cliente && isRequisitoCliente(occ.req) && occ.req.stato === 'ritirato';

    // Una voce per id, con le sue occorrenze nell'ordine della visita
    const voci = new Map<string, VoceMatrice>();
    const occorrenzeDi = new Map<string, Occorrenza[]>();
    occorrenze.forEach((occ) => {
        if (!voci.has(occ.reqId)) {
            voci.set(occ.reqId, nuovaVoce(occ, bloccoDi, ordineCliente));
            occorrenzeDi.set(occ.reqId, []);
        }
        occorrenzeDi.get(occ.reqId)?.push(occ);
    });

    // Stati per istanza con le regole della Coerenza (AC-5, AC-6)
    voci.forEach((voce) => {
        // sort è stabile: a parità di livello resta l'ordine della visita
        const lista = (occorrenzeDi.get(voce.id) ?? []).sort((a, b) => a.percorso.length - b.percorso.length);
        voce.occorrenze = lista.map((o) => o.chiave);
        voce.livello = lista[0]?.percorso.length ?? 0;
        voce.percorsi = voce.cliente ? [] : lista.map((o) => [nomeRadice, ...o.etichette].join(' › '));
        lista.forEach((o) => {
            const haFigli = o.figli.size > 0;
            // Può avere figli: un cliente attivo, un blocco con almeno un blocco con definizione dentro
            const puoAvereFigli = haFigli || (o.cliente ? !eRitirato(o) : indice.percorsiConContenuto.has(o.percorso.join('/')));
            if (puoAvereFigli) voce.istanzeConContenuto++;
            if (haFigli) voce.istanzeConFigli++;
            else if (puoAvereFigli) {
                voce.istanzeSenzaFigli++;
                voce.chiaveSenzaFigli ??= o.chiave;
            }
            // Un ritirato non fa da padre
            if (!o.cliente && ![...o.padri].some((k) => !eRitirato(occorrenze.get(k)))) {
                voce.istanzeSenzaPadre++;
                voce.chiaveSenzaPadre ??= o.chiave;
            }
        });
        if (voce.istanzeSenzaPadre > 0) {
            const totale = voce.occorrenze.length;
            voce.notaSenzaPadre = voce.istanzeSenzaPadre === totale
                ? 'Senza padre'
                : `Senza padre in ${plurale(voce.istanzeSenzaPadre, 'istanza', 'istanze')} su ${totale}`;
        }
    });

    // Coppie di id dai fili validi di derivazione; Istanze = chiavi figlio distinte, il primo filo dà la chiave del clic (AC-3)
    const coppie = new Map<string, Map<string, { chiavi: Set<string>; chiaveFiglio: string }>>();
    indice.filiPerLivello.forEach((fili) => fili.forEach(({ padre, figlio }) => {
        const p = occorrenze.get(padre);
        const f = occorrenze.get(figlio);
        if (!p || !f) return;
        let perFiglio = coppie.get(p.reqId);
        if (!perFiglio) {
            perFiglio = new Map();
            coppie.set(p.reqId, perFiglio);
        }
        let coppia = perFiglio.get(f.reqId);
        if (!coppia) {
            coppia = { chiavi: new Set(), chiaveFiglio: figlio };
            perFiglio.set(f.reqId, coppia);
        }
        coppia.chiavi.add(figlio);
    }));

    const gruppi: GruppoMatrice[] = [];
    voci.forEach((voce) => {
        const perFiglio = coppie.get(voce.id);
        if (!perFiglio && voce.istanzeSenzaFigli === 0) return;
        const figli: RigaFiglio[] = perFiglio
            ? [...perFiglio].flatMap(([id, c]) => {
                const v = voci.get(id);
                return v ? [{ figlio: v, istanze: c.chiavi.size, chiaveFiglio: c.chiaveFiglio }] : [];
            }).sort((a, b) => confronta(a.figlio, b.figlio))
            : [];
        const stato: GruppoMatrice['stato'] = voce.istanzeSenzaFigli === 0 ? 'coperto' : voce.istanzeConFigli > 0 ? 'parziale' : 'senzaFigli';
        const note: string[] = [];
        if (voce.ritirato) note.push('Ritirato');
        if (stato === 'senzaFigli') note.push('Senza figli');
        if (stato === 'parziale') {
            note.push(`Senza figli in ${plurale(voce.istanzeSenzaFigli, 'istanza', 'istanze')} su ${voce.istanzeConContenuto}`);
        }
        gruppi.push({ padre: voce, figli, stato, nota: note.join('; ') });
    });
    gruppi.sort((a, b) => confronta(a.padre, b.padre));

    const senzaPadre = [...voci.values()].filter((v) => !v.cliente && v.istanzeSenzaPadre > 0).sort(confronta);

    // Documenti del modello assenti da settings, per il filtro (AC-8)
    const noti = new Set([...(appSettings.documenti || []), DOC_CLIENTE]);
    const extra = new Set<string>();
    const raccogli = (v: VoceMatrice) => v.documenti.forEach((d) => { if (!noti.has(d)) extra.add(d); });
    gruppi.forEach((g) => { raccogli(g.padre); g.figli.forEach((r) => raccogli(r.figlio)); });
    senzaPadre.forEach(raccogli);

    return {
        libreriaAssente: false,
        gruppi,
        senzaPadre,
        documentiExtra: [...extra].sort((a, b) => a.localeCompare(b, 'it')),
        // Tutte le voci, clienti compresi, nell'ordine dei gruppi: le usa l'export dei documenti (spec 0007)
        voci: [...voci.values()].sort(confronta)
    };
}

/* --- FILTRI (AC-8) --- */

type FiltroColonna<T> = { colonna: ColonnaMatrice<T>; scelti: Set<string> };

function filtriDiColonna<T>(colonne: Array<ColonnaMatrice<T>>, f: FiltriMatrice, senza: string | null): Array<FiltroColonna<T>> {
    const scelte = f.colonne ?? {};
    return colonne.filter((c) => c.chiave !== senza && Array.isArray(scelte[c.chiave]))
        .map((c) => ({ colonna: c, scelti: new Set(scelte[c.chiave]) }));
}

function passaColonne<T>(filtriColonna: Array<FiltroColonna<T>>, r: T): boolean {
    return filtriColonna.every(({ colonna, scelti }) => colonna.valori(r).some((v) => scelti.has(v)));
}

function chiaveOrdine<T>(colonna: ColonnaMatrice<T>, r: T): string {
    return colonna.valori(r).join(', ');
}

// Sulle colonne del figlio si ordinano le righe dei gruppi, poi i gruppi per la loro prima riga (spec 0031, AC-4)
function ordinaGruppi(gruppi: MatriceFiltrata['gruppi'], ordine: OrdineColonna | undefined): void {
    const colonna = ordine && COLONNE_DERIVAZIONI.find((c) => c.chiave === ordine.colonna);
    if (!ordine || !colonna) return;
    const segno = ordine.verso === 'desc' ? -1 : 1;
    const valore = (gruppo: GruppoMatrice, riga: RigaFiglio | null) => chiaveOrdine(colonna, { gruppo, riga });
    if (colonna.lato === 'figlio') {
        gruppi.forEach((g) => g.righe.sort((a, b) => segno * collator.compare(valore(g.gruppo, a), valore(g.gruppo, b))));
    }
    gruppi.sort((a, b) => segno * collator.compare(valore(a.gruppo, a.righe[0] ?? null), valore(b.gruppo, b.righe[0] ?? null)));
}

function ordinaSenzaPadre(voci: VoceMatrice[], ordine: OrdineColonna | undefined): void {
    const colonna = ordine && COLONNE_SENZA_PADRE.find((c) => c.chiave === ordine.colonna);
    if (!ordine || !colonna) return;
    const segno = ordine.verso === 'desc' ? -1 : 1;
    voci.sort((a, b) => segno * collator.compare(chiaveOrdine(colonna, a), chiaveOrdine(colonna, b)));
}

// Prima le righe di ogni gruppo e le voci Senza padre, poi i gruppi con almeno una riga.
// Un gruppo senza figli ha solo il lato padre, una voce Senza padre solo il lato figlio.
// Poi i filtri di colonna riga per riga e l'ordinamento (spec 0031); senzaColonna ignora il filtro di una colonna
// (serve all'elenco dei valori del suo menu)
export function filtraMatrice(matrice: Matrice, f: FiltriMatrice, senzaColonna: string | null = null): MatriceFiltrata {
    const filtriDerivazioni = filtriDiColonna(COLONNE_DERIVAZIONI, f, senzaColonna);
    const filtriSenzaPadre = filtriDiColonna(COLONNE_SENZA_PADRE, f, senzaColonna);
    const documento = f.documento;
    const lato = f.lato;
    const testo = f.ricerca.trim().toLowerCase();
    const haDocumento = (v: VoceMatrice) => v.documenti.includes(documento);
    const haClasse = (v: VoceMatrice) => !f.classe || v.classe === f.classe;
    const trovata = (v: VoceMatrice) => !testo || v.testoRicerca.includes(testo);

    const gruppi: MatriceFiltrata['gruppi'] = [];
    matrice.gruppi.forEach((gruppo) => {
        const padre = gruppo.padre;
        if (gruppo.figli.length === 0) {
            const resta = (!documento || (lato !== 'figlio' && haDocumento(padre))) && haClasse(padre) && trovata(padre);
            if (resta && passaColonne(filtriDerivazioni, { gruppo, riga: null })) gruppi.push({ gruppo, righe: [] });
            return;
        }
        const padreTrovato = trovata(padre);
        const padreConDocumento = !!documento && lato !== 'figlio' && haDocumento(padre);
        const righe = gruppo.figli.filter((r) => {
            if (documento && !padreConDocumento && !(lato !== 'padre' && haDocumento(r.figlio))) return false;
            return haClasse(r.figlio) && (padreTrovato || trovata(r.figlio)) && passaColonne(filtriDerivazioni, { gruppo, riga: r });
        });
        if (righe.length) gruppi.push({ gruppo, righe });
    });

    const senzaPadre = matrice.senzaPadre.filter((v) =>
        (!documento || (lato !== 'padre' && haDocumento(v))) && haClasse(v) && trovata(v) && passaColonne(filtriSenzaPadre, v));
    ordinaGruppi(gruppi, f.ordine?.derivazioni);
    ordinaSenzaPadre(senzaPadre, f.ordine?.senzaPadre);

    return {
        gruppi,
        senzaPadre,
        conteggi: {
            padri: gruppi.length,
            derivazioni: gruppi.reduce((n, g) => n + g.righe.length, 0),
            senzaFigli: gruppi.filter((g) => g.gruppo.stato !== 'coperto').length,
            senzaPadre: senzaPadre.length
        }
    };
}

export function tabellaDellaColonna(chiave: string): TabellaMatrice | null {
    if (COLONNE_DERIVAZIONI.some((c) => c.chiave === chiave)) return 'derivazioni';
    if (COLONNE_SENZA_PADRE.some((c) => c.chiave === chiave)) return 'senzaPadre';
    return null;
}

// Valori distinti di una colonna nelle righe che passano tutti gli altri filtri, in ordine naturale (spec 0031, AC-2)
export function valoriColonna(matrice: Matrice, f: FiltriMatrice, chiave: string): string[] {
    const filtrata = filtraMatrice(matrice, f, chiave);
    const valori = new Set<string>();
    const derivazione = COLONNE_DERIVAZIONI.find((c) => c.chiave === chiave);
    const senzaPadre = COLONNE_SENZA_PADRE.find((c) => c.chiave === chiave);
    if (derivazione) {
        filtrata.gruppi.forEach(({ gruppo, righe }) => {
            const tutte: RigaDerivazione[] = righe.length ? righe.map((riga) => ({ gruppo, riga })) : [{ gruppo, riga: null }];
            tutte.forEach((r) => derivazione.valori(r).forEach((v) => valori.add(v)));
        });
    } else if (senzaPadre) {
        filtrata.senzaPadre.forEach((v) => senzaPadre.valori(v).forEach((x) => valori.add(x)));
    }
    return [...valori].sort((a, b) => collator.compare(a, b));
}

export function nomeColonna(chiave: string): string {
    const derivazione = COLONNE_DERIVAZIONI.find((c) => c.chiave === chiave);
    if (derivazione) return derivazione.nome;
    const senzaPadre = COLONNE_SENZA_PADRE.find((c) => c.chiave === chiave);
    return senzaPadre ? `Senza padre › ${senzaPadre.nome}` : chiave;
}

// Qualcosa da pulire: un filtro globale, un filtro di colonna o un ordinamento
export function filtriAttivi(f: FiltriMatrice): boolean {
    return !!f.documento || !!f.classe || !!f.ricerca.trim() || f.lato !== 'entrambi'
        || Object.keys(f.colonne ?? {}).length > 0 || Object.values(f.ordine ?? {}).some(Boolean);
}

/* --- EXPORT MARKDOWN (AC-11) --- */

// cellaMd e tabellaMd servono anche all'export dei documenti (spec 0007)
export function cellaMd(valore: unknown): string {
    return String(valore ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n|\r/g, ' ').trim();
}

function rigaMd(celle: unknown[]): string {
    return `| ${celle.map(cellaMd).join(' | ')} |`;
}

export function tabellaMd(intestazioni: string[], righe: unknown[][]): string[] {
    return [rigaMd(intestazioni), `|${intestazioni.map(() => ' --- ').join('|')}|`, ...righe.map(rigaMd)];
}

function descriviFiltri(f: FiltriMatrice): string {
    const parti: string[] = [];
    if (f.documento) parti.push(`Documento ${f.documento} (lato ${NOMI_LATO[f.lato]})`);
    if (f.classe) parti.push(`Classe ${f.classe}`);
    if (f.ricerca.trim()) parti.push(`Ricerca "${f.ricerca.trim()}"`);
    Object.entries(f.colonne ?? {}).forEach(([chiave, valori]) => {
        parti.push(`${nomeColonna(chiave)}: ${valori.map((v) => v || '(vuote)').join(', ')}`);
    });
    (['derivazioni', 'senzaPadre'] as const).forEach((tabella) => {
        const ordine = f.ordine?.[tabella];
        if (ordine) parti.push(`Ordine: ${nomeColonna(ordine.colonna)} ${NOMI_VERSO[ordine.verso]}`);
    });
    return parti.length ? parti.join(' · ') : 'nessuno';
}

export interface InfoExport {
    nome: string;
    data: string;
    libreria: { nomeFile: string; versione: string | null };
    filtri: FiltriMatrice;
}

export function matriceInMarkdown(filtrata: MatriceFiltrata, { nome, data, libreria, filtri: f }: InfoExport): string {
    const c = filtrata.conteggi;
    const testa = [
        `# Matrice di tracciabilità: ${nome}`,
        `Data: ${data} · Libreria: ${libreria.nomeFile}${libreria.versione ? ` v${libreria.versione}` : ''}`,
        `Filtri: ${descriviFiltri(f)}`,
        `Padri: ${c.padri} · Derivazioni: ${c.derivazioni} · Senza figli: ${c.senzaFigli} · Senza padre: ${c.senzaPadre}`
    ];

    const derivazioni: unknown[][] = [];
    filtrata.gruppi.forEach(({ gruppo, righe }) => {
        const p = gruppo.padre;
        const celleP = [p.idMostrato, p.titolo, p.blocco, p.metodo, p.documenti.join(', ')];
        const vuotiP = ['', '', '', '', ''];
        if (righe.length === 0) {
            derivazioni.push([...celleP, p.classe, '', '', '', '', '', '', gruppo.nota]);
            return;
        }
        righe.forEach((r, i) => {
            const fi = r.figlio;
            derivazioni.push([...(i === 0 ? celleP : vuotiP), fi.classe,
                fi.idMostrato, fi.titolo, fi.blocco, fi.metodo, fi.documenti.join(', '), r.istanze, i === 0 ? gruppo.nota : '']);
        });
    });
    const senzaPadre = filtrata.senzaPadre.map((v) =>
        [v.idMostrato, v.titolo, v.blocco, v.classe, v.metodo, v.documenti.join(', '), v.notaSenzaPadre]);

    const blocchi = [
        ...testa,
        '## Derivazioni',
        derivazioni.length ? tabellaMd(INTESTAZIONI, derivazioni).join('\n') : 'Nessuna voce',
        '## Senza padre',
        senzaPadre.length ? tabellaMd(INTESTAZIONI_SENZA_PADRE, senzaPadre).join('\n') : 'Nessuna voce'
    ];
    return `${blocchi.join('\n\n')}\n`;
}

function esporta(): void {
    applicaRicercaInSospeso();
    if (!ultimaMatrice || ultimaMatrice.libreriaAssente || !ultimoFiltrato) return;
    if (!ultimoFiltrato.gruppi.length && !ultimoFiltrato.senzaPadre.length) return;
    const info = infoProgetto();
    const nome: string = info.slug ? info.nome : pathStack[0]!.label;
    const slug = info.slug || slugifyId(nome) || 'matrice';
    const nomeFile = filtri.documento
        ? `${slug}-matrice-${slugifyId(filtri.documento) || 'documento'}.md`
        : `${slug}-matrice.md`;
    const testo = matriceInMarkdown(ultimoFiltrato, { nome, data: dataOggi(), libreria: infoLibreria(), filtri: { ...filtri } });
    scaricaFileTesto(testo, nomeFile, 'text/markdown;charset=utf-8');
}

/* --- TABELLA A VIDEO (AC-2, AC-9) --- */

function suggerimentoBlocco(v: VoceMatrice): string {
    if (!v.percorsi.length) return '';
    const primi = v.percorsi.slice(0, MAX_PERCORSI);
    const altri = v.percorsi.length - primi.length;
    return [...primi, ...(altri > 0 ? [`e altre ${altri}`] : [])].join('\n');
}

// ID e titolo portano alla Gerarchia: la cella tiene solo la chiave dell'occorrenza (AC-10)
function cellaVai(v: VoceMatrice, chiave: string | null | undefined, campo: 'id' | 'titolo', rowspan: string): string {
    const classi = ['vai-matrice', campo === 'id' ? 'cella-id' : '', v.ritirato ? 'ritirato-matrice' : ''].filter(Boolean).join(' ');
    const testo = campo === 'id' ? v.idMostrato : v.titolo;
    return `<td${rowspan} class="${classi}" data-chiave="${escapeHtml(chiave)}" title="Mostra nella Gerarchia">${escapeHtml(testo)}</td>`;
}

function celleRequisito(v: VoceMatrice, chiave: string | null | undefined, rowspan = ''): string {
    return `${cellaVai(v, chiave, 'id', rowspan)}${cellaVai(v, chiave, 'titolo', rowspan)}
        <td${rowspan} title="${escapeHtml(suggerimentoBlocco(v))}">${escapeHtml(v.blocco)}</td>
        <td${rowspan}>${escapeHtml(v.metodo)}</td>
        <td${rowspan}>${escapeHtml(v.documenti.join(', '))}</td>`;
}

function htmlGruppo({ gruppo, righe }: { gruppo: GruppoMatrice; righe: RigaFiglio[] }): string {
    const p = gruppo.padre;
    // Padre con nota Senza figli (anche parziale): la prima istanza senza figli; altrimenti la sua prima istanza
    const chiavePadre = gruppo.stato === 'coperto' ? p.occorrenze[0] : p.chiaveSenzaFigli;
    const n = Math.max(1, righe.length);
    const rowspan = n > 1 ? ` rowspan="${n}"` : '';
    const celleP = celleRequisito(p, chiavePadre, rowspan);
    const nota = `<td${rowspan} class="cella-nota">${escapeHtml(gruppo.nota)}</td>`;
    if (righe.length === 0) {
        return `<tbody><tr>${celleP}<td>${escapeHtml(p.classe)}</td><td></td><td></td><td></td><td></td><td></td><td></td>${nota}</tr></tbody>`;
    }
    const tr = righe.map((r, i) => `<tr>${i === 0 ? celleP : ''}<td>${escapeHtml(r.figlio.classe)}</td>
        ${celleRequisito(r.figlio, r.chiaveFiglio)}<td class="cella-numero">${r.istanze}</td>${i === 0 ? nota : ''}</tr>`);
    return `<tbody>${tr.join('')}</tbody>`;
}

function htmlSenzaPadre(v: VoceMatrice): string {
    return `<tr>${cellaVai(v, v.chiaveSenzaPadre, 'id', '')}${cellaVai(v, v.chiaveSenzaPadre, 'titolo', '')}
        <td title="${escapeHtml(suggerimentoBlocco(v))}">${escapeHtml(v.blocco)}</td>
        <td>${escapeHtml(v.classe)}</td><td>${escapeHtml(v.metodo)}</td><td>${escapeHtml(v.documenti.join(', '))}</td>
        <td class="cella-nota">${escapeHtml(v.notaSenzaPadre)}</td></tr>`;
}

// Ogni intestazione ha il suo ▼ (spec 0031): evidenziato se la colonna è filtrata, con ↑ o ↓ se è ordinata
function intestazioniHtml(tabella: TabellaMatrice): string {
    const colonne = tabella === 'derivazioni' ? COLONNE_DERIVAZIONI : COLONNE_SENZA_PADRE;
    const ordine = filtri.ordine[tabella];
    const celle = colonne.map(({ chiave, nome }) => {
        const filtrata = Array.isArray(filtri.colonne[chiave]);
        const freccia = ordine?.colonna === chiave ? `<span class="ordine-colonna">${ordine.verso === 'asc' ? '↑' : '↓'}</span>` : '';
        return `<th class="${filtrata ? 'colonna-filtrata' : ''}"><span class="intestazione-matrice">${escapeHtml(nome)}${freccia}
            <button type="button" class="menu-colonna${filtrata ? ' filtrata' : ''}" data-colonna="${chiave}" data-aiuto="matrice.colonna"
                aria-label="Filtra e ordina la colonna ${escapeHtml(nome)}">${filtrata ? '⏷' : '▾'}</button></span></th>`;
    });
    return `<thead><tr>${celle.join('')}</tr></thead>`;
}

// Senza padre conta come un gruppo per ogni sua voce; i gruppi oltre il limite si aggiungono con Mostra altri
function htmlTabella(filtrata: MatriceFiltrata): string {
    const gruppiVisti = filtrata.gruppi.slice(0, gruppiMostrati);
    const senzaPadreVisti = filtrata.senzaPadre.slice(0, Math.max(0, gruppiMostrati - gruppiVisti.length));
    const restanti = filtrata.gruppi.length + filtrata.senzaPadre.length - gruppiVisti.length - senzaPadreVisti.length;
    const parti: string[] = [];
    if (gruppiVisti.length) {
        parti.push(`<table class="tabella-matrice">${intestazioniHtml('derivazioni')}${gruppiVisti.map(htmlGruppo).join('')}</table>`);
    }
    if (senzaPadreVisti.length) {
        parti.push(`<div class="titolo-sezione-matrice">Senza padre</div>
            <table class="tabella-matrice">${intestazioniHtml('senzaPadre')}<tbody>${senzaPadreVisti.map(htmlSenzaPadre).join('')}</tbody></table>`);
    }
    if (restanti > 0) {
        const altri = Math.min(restanti, appSettings.matrice.gruppiVisibili);
        parti.push(`<button id="btnAltriMatrice" class="pulsante-progetto altri-matrice">Mostra altri ${plurale(altri, 'gruppo', 'gruppi')}</button>`);
    }
    return parti.join('');
}

function htmlConteggi(c: MatriceFiltrata['conteggi']): string {
    const chip = (etichetta: string, n: number, attenzione = false) =>
        `<span class="conteggio-import${attenzione && n > 0 ? ' conteggio-attenzione' : ''}">${etichetta}: ${n}</span>`;
    return chip('Padri', c.padri) + chip('Derivazioni', c.derivazioni)
        + chip('Senza figli', c.senzaFigli, true) + chip('Senza padre', c.senzaPadre, true);
}

function aggiorna(): void {
    const barra = campo('matriceFiltri');
    const conteggi = campo('matriceConteggi');
    const contenuto = campo('matriceContenuto');
    const pulsante = campo<HTMLButtonElement>('btnEsportaMatrice');
    const pulisci = document.getElementById('btnPulisciMatrice') as HTMLButtonElement | null;
    if (pulisci) pulisci.disabled = !filtriAttivi(filtri);
    ultimoFiltrato = null;
    if (!ultimaMatrice) return;

    const messaggio = ultimaMatrice.libreriaAssente ? MSG_SENZA_LIBRERIA
        : !ultimaMatrice.gruppi.length && !ultimaMatrice.senzaPadre.length ? MSG_VUOTA : null;
    if (messaggio) {
        barra.hidden = true;
        conteggi.hidden = true;
        pulsante.disabled = true;
        contenuto.innerHTML = `<div class="empty-props">${escapeHtml(messaggio)}</div>`;
        return;
    }

    const filtrato = filtraMatrice(ultimaMatrice, filtri);
    ultimoFiltrato = filtrato;
    const vuoto = !filtrato.gruppi.length && !filtrato.senzaPadre.length;
    barra.hidden = false;
    conteggi.hidden = false;
    conteggi.innerHTML = htmlConteggi(filtrato.conteggi);
    pulsante.disabled = vuoto;
    contenuto.innerHTML = vuoto ? `<div class="empty-props">${MSG_NESSUNA_RIGA}</div>` : htmlTabella(filtrato);
}

/* --- FILTRI A VIDEO (AC-8, AC-12) --- */

function opzioni(voci: Array<[string, string]>): string {
    return voci.map(([valore, etichetta]) => `<option value="${escapeHtml(valore)}">${escapeHtml(etichetta)}</option>`).join('');
}

// Voci ricalcolate a ogni apertura; una scelta non più tra le voci torna a Tutti / Tutte
function popolaFiltri(matrice: Matrice): void {
    const documenti = [...new Set([...(appSettings.documenti || []), ...matrice.documentiExtra, DOC_CLIENTE])];
    const classi = [CAPACITA, ...getTipologie()];
    if (!documenti.includes(filtri.documento)) filtri.documento = '';
    if (!classi.includes(filtri.classe)) filtri.classe = '';

    const selDocumento = campo<HTMLSelectElement>('matriceDocumento');
    selDocumento.innerHTML = opzioni([['', 'Tutti'], ...documenti.map((d): [string, string] => [d, d])]);
    selDocumento.value = filtri.documento;
    const selClasse = campo<HTMLSelectElement>('matriceClasse');
    selClasse.innerHTML = opzioni([['', 'Tutte'], ...classi.map((c): [string, string] => [c, c])]);
    selClasse.value = filtri.classe;
    campo<HTMLInputElement>('matriceRicerca').value = filtri.ricerca;
    aggiornaLato();
}

// Lato conta solo con un documento scelto: con Tutti è disattivato
function aggiornaLato(): void {
    const selLato = campo<HTMLSelectElement>('matriceLato');
    selLato.value = filtri.lato;
    selLato.disabled = !filtri.documento;
}

// Cambiare un filtro riporta al primo blocco di gruppi (AC-9)
function filtriCambiati(): void {
    gruppiMostrati = appSettings.matrice.gruppiVisibili;
    aggiorna();
    campo('matriceContenuto').scrollTop = 0;
}

function applicaRicercaInSospeso(): void {
    if (timerRicerca === null) return;
    clearTimeout(timerRicerca);
    timerRicerca = null;
    filtri.ricerca = campo<HTMLInputElement>('matriceRicerca').value;
    filtriCambiati();
}

// Pulisci filtri: globali, di colonna e ordinamenti (spec 0031, AC-5)
function pulisciFiltri(): void {
    if (timerRicerca !== null) {
        clearTimeout(timerRicerca);
        timerRicerca = null;
    }
    chiudiMenuColonna();
    filtri.documento = '';
    filtri.lato = 'entrambi';
    filtri.classe = '';
    filtri.ricerca = '';
    filtri.colonne = {};
    filtri.ordine = {};
    if (ultimaMatrice) popolaFiltri(ultimaMatrice);
    filtriCambiati();
}

/* --- MENU DELLA COLONNA (spec 0031) --- */

// Oltre questo numero di valori il menu chiede di usare la ricerca
const MAX_VALORI_MENU = 1000;

interface StatoMenu {
    chiave: string;
    tabella: TabellaMatrice;
    valori: string[];
    scelti: Set<string>;
    ricerca: string;
}

let menu: StatoMenu | null = null;

// Il menu è figlio del pannello: si sposta con lui quando si stacca in un'altra finestra (spec 0023)
function elementoMenu(): HTMLElement | null {
    const pannello = document.getElementById('pannelloMatrice');
    if (!pannello) return null;
    let el = pannello.querySelector<HTMLElement>('#menuColonnaMatrice');
    if (!el) {
        el = pannello.ownerDocument.createElement('div');
        el.id = 'menuColonnaMatrice';
        el.className = 'menu-colonna-matrice';
        el.tabIndex = -1;
        el.hidden = true;
        el.setAttribute('role', 'dialog');
        pannello.appendChild(el);
        installaEventiMenu(el);
    }
    return el;
}

export function menuColonnaAperto(): boolean {
    return menu !== null;
}

function chiudiMenuColonna(): void {
    menu = null;
    const el = document.getElementById('pannelloMatrice')?.querySelector<HTMLElement>('#menuColonnaMatrice');
    if (el) {
        el.hidden = true;
        el.innerHTML = '';
    }
}

function valoriVisibili(s: StatoMenu): string[] {
    const testo = s.ricerca.trim().toLowerCase();
    return testo ? s.valori.filter((v) => (v || '(vuote)').toLowerCase().includes(testo)) : s.valori;
}

function htmlValori(s: StatoMenu): string {
    const visibili = valoriVisibili(s);
    const mostrati = visibili.slice(0, MAX_VALORI_MENU);
    const tutti = visibili.length > 0 && visibili.every((v) => s.scelti.has(v));
    const voci = mostrati.map((v) => `<label class="valore-menu-colonna"><input type="checkbox" data-valore="${escapeHtml(v)}" ${s.scelti.has(v) ? 'checked' : ''}>
        <span>${v ? escapeHtml(v) : '<em>(vuote)</em>'}</span></label>`).join('');
    const altri = visibili.length - mostrati.length;
    return `<label class="valore-menu-colonna"><input type="checkbox" data-tutti ${tutti ? 'checked' : ''}> <span>(Seleziona tutto)</span></label>
        ${voci || '<p class="empty-props">Nessun valore</p>'}
        ${altri > 0 ? `<p class="empty-props">e altri ${altri}: restringi con la ricerca</p>` : ''}`;
}

// Con una ricerca attiva valgono solo i valori spuntati fra quelli visibili (AC-2)
function sceltaDelMenu(s: StatoMenu): string[] {
    return valoriVisibili(s).filter((v) => s.scelti.has(v));
}

// Ridisegna l'elenco (solo dalla ricerca: il fuoco è nel campo, non su una casella che sparirebbe)
function aggiornaValoriMenu(el: HTMLElement, s: StatoMenu): void {
    const lista = el.querySelector<HTMLElement>('.valori-menu-colonna');
    if (lista) lista.innerHTML = htmlValori(s);
    sincronizzaCaselle(el, s);
}

// Dopo un clic su una casella: aggiorna le spunte e OK senza ricreare gli elementi
function sincronizzaCaselle(el: HTMLElement, s: StatoMenu): void {
    el.querySelectorAll<HTMLInputElement>('input[data-valore]').forEach((c) => { c.checked = s.scelti.has(c.dataset.valore ?? ''); });
    const visibili = valoriVisibili(s);
    const tutti = el.querySelector<HTMLInputElement>('input[data-tutti]');
    if (tutti) tutti.checked = visibili.length > 0 && visibili.every((v) => s.scelti.has(v));
    const ok = el.querySelector<HTMLButtonElement>('[data-azione="ok"]');
    if (ok) ok.disabled = sceltaDelMenu(s).length === 0;
}

function apriMenuColonna(pulsante: HTMLElement): void {
    const chiave = pulsante.dataset.colonna ?? '';
    const tabella = tabellaDellaColonna(chiave);
    const el = elementoMenu();
    if (!tabella || !el || !ultimaMatrice) return;
    if (menu?.chiave === chiave) {
        chiudiMenuColonna();
        return;
    }
    applicaRicercaInSospeso();
    const valori = valoriColonna(ultimaMatrice, filtri, chiave);
    const attuale = filtri.colonne[chiave];
    const s: StatoMenu = { chiave, tabella, valori, scelti: new Set(attuale ?? valori), ricerca: '' };
    menu = s;
    const ordine = filtri.ordine[tabella];
    const segno = (verso: OrdineColonna['verso']) => ordine?.colonna === chiave && ordine.verso === verso ? ' attivo' : '';
    el.innerHTML = `
        <div class="titolo-menu-colonna">${escapeHtml(nomeColonna(chiave))}</div>
        <button type="button" class="voce-menu-colonna${segno('asc')}" data-azione="asc">↑ Ordina A→Z</button>
        <button type="button" class="voce-menu-colonna${segno('desc')}" data-azione="desc">↓ Ordina Z→A</button>
        ${Array.isArray(attuale) ? '<button type="button" class="voce-menu-colonna" data-azione="togli">✕ Togli il filtro della colonna</button>' : ''}
        <input type="text" class="cerca-menu-colonna" placeholder="Cerca…" aria-label="Cerca fra i valori">
        <div class="valori-menu-colonna"></div>
        <div class="pulsanti-menu-colonna">
            <button type="button" class="pulsante-progetto pulsante-menu" data-azione="ok">OK</button>
            <button type="button" class="pulsante-progetto" data-azione="annulla">Annulla</button>
        </div>`;
    aggiornaValoriMenu(el, s);
    el.hidden = false;

    // Sotto il pulsante, dentro la finestra che contiene il pannello (fixed: il pannello taglia ciò che esce)
    const finestra = el.ownerDocument.defaultView ?? window;
    const r = pulsante.getBoundingClientRect();
    const larghezza = el.offsetWidth;
    const altezza = el.offsetHeight;
    el.style.left = `${Math.max(4, Math.min(r.left, finestra.innerWidth - larghezza - 4))}px`;
    el.style.top = `${r.bottom + altezza + 4 > finestra.innerHeight ? Math.max(4, finestra.innerHeight - altezza - 4) : r.bottom + 2}px`;
    el.querySelector<HTMLInputElement>('.cerca-menu-colonna')?.focus();
}

function applicaMenu(s: StatoMenu): void {
    const scelti = sceltaDelMenu(s);
    if (scelti.length === 0) return;
    // Tutti i valori spuntati = nessun filtro sulla colonna (AC-3)
    if (scelti.length === s.valori.length) delete filtri.colonne[s.chiave];
    else filtri.colonne[s.chiave] = scelti;
    chiudiMenuColonna();
    filtriCambiati();
}

function ordinaDaMenu(s: StatoMenu, verso: OrdineColonna['verso']): void {
    const ordine = filtri.ordine[s.tabella];
    // Lo stesso ordinamento una seconda volta lo toglie
    if (ordine?.colonna === s.chiave && ordine.verso === verso) delete filtri.ordine[s.tabella];
    else filtri.ordine[s.tabella] = { colonna: s.chiave, verso };
    chiudiMenuColonna();
    filtriCambiati();
}

function installaEventiMenu(el: HTMLElement): void {
    el.addEventListener('click', (e) => {
        const s = menu;
        const azione = (e.target as Element).closest<HTMLElement>('[data-azione]')?.dataset.azione;
        if (!s || !azione) return;
        if (azione === 'asc' || azione === 'desc') ordinaDaMenu(s, azione);
        else if (azione === 'ok') applicaMenu(s);
        else if (azione === 'annulla') chiudiMenuColonna();
        else if (azione === 'togli') {
            delete filtri.colonne[s.chiave];
            chiudiMenuColonna();
            filtriCambiati();
        }
    });
    el.addEventListener('change', (e) => {
        const s = menu;
        const casella = e.target as HTMLInputElement;
        if (!s || casella.type !== 'checkbox') return;
        if (casella.hasAttribute('data-tutti')) valoriVisibili(s).forEach((v) => (casella.checked ? s.scelti.add(v) : s.scelti.delete(v)));
        else if (casella.dataset.valore !== undefined) {
            if (casella.checked) s.scelti.add(casella.dataset.valore);
            else s.scelti.delete(casella.dataset.valore);
        }
        sincronizzaCaselle(el, s);
    });
    el.addEventListener('input', (e) => {
        const s = menu;
        const campoRicerca = e.target as HTMLInputElement;
        if (!s || !campoRicerca.classList.contains('cerca-menu-colonna')) return;
        s.ricerca = campoRicerca.value;
        aggiornaValoriMenu(el, s);
    });
    // Esc chiude senza applicare, Invio nella ricerca vale OK; i tasti non arrivano alle scorciatoie della pagina
    el.addEventListener('keydown', (e) => {
        const s = menu;
        if (!s) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            chiudiMenuColonna();
        } else if (e.key === 'Enter' && (e.target as HTMLElement).classList.contains('cerca-menu-colonna')) {
            e.preventDefault();
            applicaMenu(s);
        }
    });
    // Un clic fuori dal menu lo chiude senza applicare
    el.addEventListener('focusout', (e) => {
        const verso = (e as FocusEvent).relatedTarget as Node | null;
        if (menu && (!verso || !el.contains(verso)) && !(verso as HTMLElement | null)?.classList?.contains('menu-colonna')) chiudiMenuColonna();
    });
}

/* --- PANNELLO (AC-1; spec 0022) --- */

// Calcola dal modello di adesso, mai dall'indice della Gerarchia (che esiste solo a modalità accesa).
// Filtri e scorrimento restano: serve anche per l'aggiornamento dopo una modifica al modello
function ricalcola(): void {
    daAggiornare = false;
    chiudiMenuColonna();
    // Aperta da un layout salvato senza passare da apriMatrice()
    if (gruppiMostrati <= 0) gruppiMostrati = appSettings.matrice.gruppiVisibili;
    applicaRicercaInSospeso();
    const indice = calcolaGerarchia(pathStack[0]!.graph, appState.library, appState.cliente);
    const matrice = calcolaMatrice(indice, appState.library, appState.cliente, pathStack[0]!.label);
    ultimaMatrice = matrice;
    const contenuto = campo('matriceContenuto');
    const scorrimento = contenuto.scrollTop;
    popolaFiltri(matrice);
    aggiorna();
    contenuto.scrollTop = scorrimento;
}

// Il calcolo lo fa allaVista, quando il pannello compare
export function apriMatrice(): void {
    if (!pannelloAperto('matrice')) {
        gruppiMostrati = appSettings.matrice.gruppiVisibili;
        daAggiornare = true;
    }
    mostraPannello('matrice');
}

// Chiamata da render(): ricalcola una volta dopo una raffica di modifiche, solo se il pannello si vede (AC-2)
export function segnaMatriceDaAggiornare(): void {
    daAggiornare = true;
    if (!pannelloAperto('matrice')) return;
    if (timerModello !== null) clearTimeout(timerModello);
    timerModello = setTimeout(() => {
        timerModello = null;
        if (daAggiornare && pannelloVisibile('matrice')) ricalcola();
    }, RITARDO_MODELLO);
}

// Alla chiusura il risultato si butta; i filtri restano finché la pagina è aperta (AC-12)
function allaChiusuraMatrice(): void {
    if (timerRicerca !== null) {
        clearTimeout(timerRicerca);
        timerRicerca = null;
        filtri.ricerca = campo<HTMLInputElement>('matriceRicerca').value;
    }
    chiudiMenuColonna();
    ultimaMatrice = null;
    ultimoFiltrato = null;
    daAggiornare = false;
    campo('matriceContenuto').innerHTML = '';
}

/* --- INIZIALIZZAZIONE --- */

const LATI = new Set<string>(['entrambi', 'padre', 'figlio']);

export function initMatrice(): void {
    document.getElementById('btnReqMatrix')?.addEventListener('click', apriMatrice);
    // Aperta dal menu Finestra o da un layout salvato: si calcola quando si vede
    allaVista('matrice', () => { if (daAggiornare || !ultimaMatrice) ricalcola(); });
    allaChiusura('matrice', allaChiusuraMatrice);

    document.getElementById('matriceDocumento')?.addEventListener('change', (e) => {
        filtri.documento = (e.target as HTMLSelectElement).value;
        aggiornaLato();
        filtriCambiati();
    });
    document.getElementById('matriceLato')?.addEventListener('change', (e) => {
        const valore = (e.target as HTMLSelectElement).value;
        filtri.lato = LATI.has(valore) ? valore as FiltriMatrice['lato'] : 'entrambi';
        filtriCambiati();
    });
    document.getElementById('matriceClasse')?.addEventListener('change', (e) => {
        filtri.classe = (e.target as HTMLSelectElement).value;
        filtriCambiati();
    });
    // La ricerca si applica 200 ms dopo l'ultimo tasto (AC-8, AC-13)
    document.getElementById('matriceRicerca')?.addEventListener('input', () => {
        if (timerRicerca !== null) clearTimeout(timerRicerca);
        timerRicerca = setTimeout(() => {
            timerRicerca = null;
            filtri.ricerca = campo<HTMLInputElement>('matriceRicerca').value;
            filtriCambiati();
        }, RITARDO_RICERCA);
    });

    document.getElementById('btnEsportaMatrice')?.addEventListener('click', esporta);
    document.getElementById('btnPulisciMatrice')?.addEventListener('click', pulisciFiltri);

    document.getElementById('matriceContenuto')?.addEventListener('click', (e) => {
        const bersaglio = e.target as Element;
        const menuColonna = bersaglio.closest<HTMLElement>('.menu-colonna');
        if (menuColonna) {
            apriMenuColonna(menuColonna);
            return;
        }
        if (bersaglio.closest('#btnAltriMatrice')) {
            gruppiMostrati += appSettings.matrice.gruppiVisibili;
            aggiorna();
            return;
        }
        const cella = bersaglio.closest<HTMLElement>('[data-chiave]');
        if (!cella) return;
        // La Matrice resta aperta accanto alla Gerarchia (spec 0022, AC-4)
        apriGerarchiaSu(cella.dataset.chiave ?? '');
    });
}
