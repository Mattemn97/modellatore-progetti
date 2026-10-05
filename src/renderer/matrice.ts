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

export interface FiltriMatrice {
    // '' = Tutti
    documento: string;
    lato: 'entrambi' | 'padre' | 'figlio';
    // '' = Tutte
    classe: string;
    ricerca: string;
}

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

const INTESTAZIONI = [
    'ID padre', 'Titolo padre', 'Blocco padre', 'Metodo padre', 'Documenti padre', 'Classe',
    'ID figlio', 'Titolo figlio', 'Blocco figlio', 'Metodo figlio', 'Documenti figlio', 'Istanze', 'Note'
];
const INTESTAZIONI_SENZA_PADRE = ['ID', 'Titolo', 'Blocco', 'Classe', 'Metodo', 'Documenti', 'Note'];
const NOMI_LATO: Record<FiltriMatrice['lato'], string> = { entrambi: 'uno dei due', padre: 'padre', figlio: 'figlio' };

// Uno solo, riusato: con migliaia di gruppi localeCompare ripetuto costa troppo
const collator = new Intl.Collator('it', { numeric: true });

let ultimaMatrice: Matrice | null = null;
let ultimoFiltrato: MatriceFiltrata | null = null;
// Restano tra un'apertura e l'altra finché la pagina è aperta (AC-12)
const filtri: FiltriMatrice = { documento: '', lato: 'entrambi', classe: '', ricerca: '' };
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

// Prima le righe di ogni gruppo e le voci Senza padre, poi i gruppi con almeno una riga.
// Un gruppo senza figli ha solo il lato padre, una voce Senza padre solo il lato figlio
export function filtraMatrice(matrice: Matrice, f: FiltriMatrice): MatriceFiltrata {
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
            if (resta) gruppi.push({ gruppo, righe: [] });
            return;
        }
        const padreTrovato = trovata(padre);
        const padreConDocumento = !!documento && lato !== 'figlio' && haDocumento(padre);
        const righe = gruppo.figli.filter((r) => {
            if (documento && !padreConDocumento && !(lato !== 'padre' && haDocumento(r.figlio))) return false;
            return haClasse(r.figlio) && (padreTrovato || trovata(r.figlio));
        });
        if (righe.length) gruppi.push({ gruppo, righe });
    });

    const senzaPadre = matrice.senzaPadre.filter((v) =>
        (!documento || (lato !== 'padre' && haDocumento(v))) && haClasse(v) && trovata(v));

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

function intestazioniHtml(nomi: string[]): string {
    return `<thead><tr>${nomi.map((n) => `<th>${escapeHtml(n)}</th>`).join('')}</tr></thead>`;
}

// Senza padre conta come un gruppo per ogni sua voce; i gruppi oltre il limite si aggiungono con Mostra altri
function htmlTabella(filtrata: MatriceFiltrata): string {
    const gruppiVisti = filtrata.gruppi.slice(0, gruppiMostrati);
    const senzaPadreVisti = filtrata.senzaPadre.slice(0, Math.max(0, gruppiMostrati - gruppiVisti.length));
    const restanti = filtrata.gruppi.length + filtrata.senzaPadre.length - gruppiVisti.length - senzaPadreVisti.length;
    const parti: string[] = [];
    if (gruppiVisti.length) {
        parti.push(`<table class="tabella-matrice">${intestazioniHtml(INTESTAZIONI)}${gruppiVisti.map(htmlGruppo).join('')}</table>`);
    }
    if (senzaPadreVisti.length) {
        parti.push(`<div class="titolo-sezione-matrice">Senza padre</div>
            <table class="tabella-matrice">${intestazioniHtml(INTESTAZIONI_SENZA_PADRE)}<tbody>${senzaPadreVisti.map(htmlSenzaPadre).join('')}</tbody></table>`);
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

/* --- PANNELLO (AC-1; spec 0022) --- */

// Calcola dal modello di adesso, mai dall'indice della Gerarchia (che esiste solo a modalità accesa).
// Filtri e scorrimento restano: serve anche per l'aggiornamento dopo una modifica al modello
function ricalcola(): void {
    daAggiornare = false;
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

    document.getElementById('matriceContenuto')?.addEventListener('click', (e) => {
        const bersaglio = e.target as Element;
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
