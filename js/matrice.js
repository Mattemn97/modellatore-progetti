/* --- MATRICE DI TRACCIABILITÀ: CALCOLO PER ID, FILTRI, FINESTRA ED EXPORT MARKDOWN --- */

// Spec 0006. La matrice si calcola all'apertura della finestra dall'indice delle occorrenze della Gerarchia (spec 0005)
// e raggruppa per id del requisito: coppie padre → figlio, padri senza figli e requisiti senza padre con le regole
// della Coerenza, istanza per istanza. Risultato, filtri e limite vivono solo in questo modulo, mai in appState.

import { appState, appSettings, pathStack } from './state.js';
import { calcolaGerarchia, apriGerarchiaSu } from './gerarchia.js';
import { infoProgetto } from './progetto.js';
import { infoLibreria } from './libreria.js';
import { scaricaFileTesto } from './storage.js';
import { CAPACITA, getTipologie, getClasseRequisito, titoloRequisito } from './model.js';
import { escapeHtml, slugifyId } from './utils.js';

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
const NOMI_LATO = { entrambi: 'uno dei due', padre: 'padre', figlio: 'figlio' };

// Uno solo, riusato: con migliaia di gruppi localeCompare ripetuto costa troppo
const collator = new Intl.Collator('it', { numeric: true });

let ultimaMatrice = null;
let ultimoFiltrato = null;
// documento '' = Tutti, classe '' = Tutte; restano tra un'apertura e l'altra finché la pagina è aperta (AC-12)
const filtri = { documento: '', lato: 'entrambi', classe: '', ricerca: '' };
let gruppiMostrati = 0;
let timerRicerca = null;

const modale = document.getElementById('matriceModal');

/* --- CALCOLO (AC-2 … AC-7) --- */

function plurale(n, uno, molti) {
    return `${n} ${n === 1 ? uno : molti}`;
}

// Documenti distinti dei testi da esportare, nell'ordine di settings; quelli fuori elenco in fondo, in ordine alfabetico (AC-4)
function documentiDi(req) {
    const ordine = appSettings.documenti || [];
    const documenti = [...new Set((req.testiExport || []).map(t => String(t.documento ?? '').trim()).filter(Boolean))];
    return documenti.sort((a, b) => {
        const ia = ordine.indexOf(a);
        const ib = ordine.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b, 'it');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

function nuovaVoce(occ, bloccoDi, ordineCliente) {
    const req = occ.req;
    const idMostrato = String((occ.cliente ? req.idCliente : req.id) ?? '');
    const titolo = titoloRequisito(req);
    const blocco = bloccoDi.get(occ.reqId);
    return {
        id: occ.reqId,
        idMostrato,
        titolo,
        cliente: occ.cliente,
        ritirato: occ.cliente && req.stato === 'ritirato',
        blocco: occ.cliente ? 'Cliente' : blocco?.titolo || blocco?.id || '',
        percorsi: [],
        classe: getClasseRequisito(req),
        metodo: occ.cliente ? '' : req.metodoVerifica || '',
        documenti: occ.cliente ? [DOC_CLIENTE] : documentiDi(req),
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
function confronta(a, b) {
    if (a.cliente !== b.cliente) return a.cliente ? -1 : 1;
    if (a.cliente) return a.ordineCliente - b.ordineCliente;
    return a.livello - b.livello || collator.compare(a.idMostrato, b.idMostrato);
}

// Funzione pura: non cambia mai il modello. nomeRadice serve solo ai suggerimenti dei percorsi
export function calcolaMatrice(indice, libreria, cliente, nomeRadice = '') {
    if (indice.libreriaAssente) return { libreriaAssente: true, gruppi: [], senzaPadre: [], documentiExtra: [] };

    // Gli id dei requisiti sono unici in tutta la libreria; per difesa, con un doppione vince il primo blocco
    const bloccoDi = new Map();
    Object.values(libreria).forEach(def => (def.requisiti || []).forEach(req => {
        if (!bloccoDi.has(req.id)) bloccoDi.set(req.id, def);
    }));
    const ordineCliente = new Map((cliente?.requisiti || []).map((r, i) => [r.id, i]));
    const occorrenze = indice.occorrenze;
    const eRitirato = occ => !!occ && occ.cliente && occ.req.stato === 'ritirato';

    // Una voce per id, con le sue occorrenze nell'ordine della visita
    const voci = new Map();
    const occorrenzeDi = new Map();
    occorrenze.forEach(occ => {
        if (!voci.has(occ.reqId)) {
            voci.set(occ.reqId, nuovaVoce(occ, bloccoDi, ordineCliente));
            occorrenzeDi.set(occ.reqId, []);
        }
        occorrenzeDi.get(occ.reqId).push(occ);
    });

    // Stati per istanza con le regole della Coerenza (AC-5, AC-6)
    voci.forEach(voce => {
        // sort è stabile: a parità di livello resta l'ordine della visita
        const lista = occorrenzeDi.get(voce.id).sort((a, b) => a.percorso.length - b.percorso.length);
        voce.occorrenze = lista.map(o => o.chiave);
        voce.livello = lista[0].percorso.length;
        voce.percorsi = voce.cliente ? [] : lista.map(o => [nomeRadice, ...o.etichette].join(' › '));
        lista.forEach(o => {
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
            if (!o.cliente && ![...o.padri].some(k => !eRitirato(occorrenze.get(k)))) {
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
    const coppie = new Map();
    indice.filiPerLivello.forEach(fili => fili.forEach(({ padre, figlio }) => {
        const p = occorrenze.get(padre);
        const f = occorrenze.get(figlio);
        if (!p || !f) return;
        if (!coppie.has(p.reqId)) coppie.set(p.reqId, new Map());
        const perFiglio = coppie.get(p.reqId);
        if (!perFiglio.has(f.reqId)) perFiglio.set(f.reqId, { chiavi: new Set(), chiaveFiglio: figlio });
        perFiglio.get(f.reqId).chiavi.add(figlio);
    }));

    const gruppi = [];
    voci.forEach(voce => {
        const perFiglio = coppie.get(voce.id);
        if (!perFiglio && voce.istanzeSenzaFigli === 0) return;
        const figli = perFiglio
            ? [...perFiglio].map(([id, c]) => ({ figlio: voci.get(id), istanze: c.chiavi.size, chiaveFiglio: c.chiaveFiglio }))
                .sort((a, b) => confronta(a.figlio, b.figlio))
            : [];
        const stato = voce.istanzeSenzaFigli === 0 ? 'coperto' : voce.istanzeConFigli > 0 ? 'parziale' : 'senzaFigli';
        const note = [];
        if (voce.ritirato) note.push('Ritirato');
        if (stato === 'senzaFigli') note.push('Senza figli');
        if (stato === 'parziale') {
            note.push(`Senza figli in ${plurale(voce.istanzeSenzaFigli, 'istanza', 'istanze')} su ${voce.istanzeConContenuto}`);
        }
        gruppi.push({ padre: voce, figli, stato, nota: note.join('; ') });
    });
    gruppi.sort((a, b) => confronta(a.padre, b.padre));

    const senzaPadre = [...voci.values()].filter(v => !v.cliente && v.istanzeSenzaPadre > 0).sort(confronta);

    // Documenti del modello assenti da settings, per il filtro (AC-8)
    const noti = new Set([...(appSettings.documenti || []), DOC_CLIENTE]);
    const extra = new Set();
    const raccogli = v => v.documenti.forEach(d => { if (!noti.has(d)) extra.add(d); });
    gruppi.forEach(g => { raccogli(g.padre); g.figli.forEach(r => raccogli(r.figlio)); });
    senzaPadre.forEach(raccogli);

    return {
        libreriaAssente: false,
        gruppi,
        senzaPadre,
        documentiExtra: [...extra].sort((a, b) => a.localeCompare(b, 'it'))
    };
}

/* --- FILTRI (AC-8) --- */

// Prima le righe di ogni gruppo e le voci Senza padre, poi i gruppi con almeno una riga.
// Un gruppo senza figli ha solo il lato padre, una voce Senza padre solo il lato figlio
export function filtraMatrice(matrice, f) {
    const documento = f.documento;
    const lato = f.lato;
    const testo = f.ricerca.trim().toLowerCase();
    const haDocumento = v => v.documenti.includes(documento);
    const haClasse = v => !f.classe || v.classe === f.classe;
    const trovata = v => !testo || v.testoRicerca.includes(testo);

    const gruppi = [];
    matrice.gruppi.forEach(gruppo => {
        const padre = gruppo.padre;
        if (gruppo.figli.length === 0) {
            const resta = (!documento || (lato !== 'figlio' && haDocumento(padre))) && haClasse(padre) && trovata(padre);
            if (resta) gruppi.push({ gruppo, righe: [] });
            return;
        }
        const padreTrovato = trovata(padre);
        const padreConDocumento = !!documento && lato !== 'figlio' && haDocumento(padre);
        const righe = gruppo.figli.filter(r => {
            if (documento && !padreConDocumento && !(lato !== 'padre' && haDocumento(r.figlio))) return false;
            return haClasse(r.figlio) && (padreTrovato || trovata(r.figlio));
        });
        if (righe.length) gruppi.push({ gruppo, righe });
    });

    const senzaPadre = matrice.senzaPadre.filter(v =>
        (!documento || (lato !== 'padre' && haDocumento(v))) && haClasse(v) && trovata(v));

    return {
        gruppi,
        senzaPadre,
        conteggi: {
            padri: gruppi.length,
            derivazioni: gruppi.reduce((n, g) => n + g.righe.length, 0),
            senzaFigli: gruppi.filter(g => g.gruppo.stato !== 'coperto').length,
            senzaPadre: senzaPadre.length
        }
    };
}

/* --- EXPORT MARKDOWN (AC-11) --- */

function cellaMd(valore) {
    return String(valore ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n|\r/g, ' ').trim();
}

function rigaMd(celle) {
    return `| ${celle.map(cellaMd).join(' | ')} |`;
}

function tabellaMd(intestazioni, righe) {
    return [rigaMd(intestazioni), `|${intestazioni.map(() => ' --- ').join('|')}|`, ...righe.map(rigaMd)];
}

function descriviFiltri(f) {
    const parti = [];
    if (f.documento) parti.push(`Documento ${f.documento} (lato ${NOMI_LATO[f.lato]})`);
    if (f.classe) parti.push(`Classe ${f.classe}`);
    if (f.ricerca.trim()) parti.push(`Ricerca "${f.ricerca.trim()}"`);
    return parti.length ? parti.join(' · ') : 'nessuno';
}

export function matriceInMarkdown(filtrata, { nome, data, libreria, filtri: f }) {
    const c = filtrata.conteggi;
    const testa = [
        `# Matrice di tracciabilità: ${nome}`,
        `Data: ${data} · Libreria: ${libreria.nomeFile}${libreria.versione ? ` v${libreria.versione}` : ''}`,
        `Filtri: ${descriviFiltri(f)}`,
        `Padri: ${c.padri} · Derivazioni: ${c.derivazioni} · Senza figli: ${c.senzaFigli} · Senza padre: ${c.senzaPadre}`
    ];

    const derivazioni = [];
    filtrata.gruppi.forEach(({ gruppo, righe }) => {
        const p = gruppo.padre;
        const celleP = [p.idMostrato, p.titolo, p.blocco, p.metodo, p.documenti.join(', ')];
        const vuotiP = ['', '', '', '', ''];
        if (righe.length === 0) {
            derivazioni.push([...celleP, p.classe, '', '', '', '', '', '', gruppo.nota]);
            return;
        }
        righe.forEach((r, i) => {
            const f = r.figlio;
            derivazioni.push([...(i === 0 ? celleP : vuotiP), f.classe,
                f.idMostrato, f.titolo, f.blocco, f.metodo, f.documenti.join(', '), r.istanze, i === 0 ? gruppo.nota : '']);
        });
    });
    const senzaPadre = filtrata.senzaPadre.map(v =>
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

function dataOggi() {
    const d = new Date();
    const due = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

function esporta() {
    applicaRicercaInSospeso();
    if (!ultimaMatrice || ultimaMatrice.libreriaAssente || !ultimoFiltrato) return;
    if (!ultimoFiltrato.gruppi.length && !ultimoFiltrato.senzaPadre.length) return;
    const info = infoProgetto();
    const nome = info.slug ? info.nome : pathStack[0].label;
    const slug = info.slug || slugifyId(nome) || 'matrice';
    const nomeFile = filtri.documento
        ? `${slug}-matrice-${slugifyId(filtri.documento) || 'documento'}.md`
        : `${slug}-matrice.md`;
    const testo = matriceInMarkdown(ultimoFiltrato, { nome, data: dataOggi(), libreria: infoLibreria(), filtri: { ...filtri } });
    scaricaFileTesto(testo, nomeFile, 'text/markdown;charset=utf-8');
}

/* --- TABELLA A VIDEO (AC-2, AC-9) --- */

function suggerimentoBlocco(v) {
    if (!v.percorsi.length) return '';
    const primi = v.percorsi.slice(0, MAX_PERCORSI);
    const altri = v.percorsi.length - primi.length;
    return [...primi, ...(altri > 0 ? [`e altre ${altri}`] : [])].join('\n');
}

// ID e titolo portano alla Gerarchia: la cella tiene solo la chiave dell'occorrenza (AC-10)
function cellaVai(v, chiave, campo, rowspan) {
    const classi = ['vai-matrice', campo === 'id' ? 'cella-id' : '', v.ritirato ? 'ritirato-matrice' : ''].filter(Boolean).join(' ');
    const testo = campo === 'id' ? v.idMostrato : v.titolo;
    return `<td${rowspan} class="${classi}" data-chiave="${escapeHtml(chiave)}" title="Mostra nella Gerarchia">${escapeHtml(testo)}</td>`;
}

function celleRequisito(v, chiave, rowspan = '') {
    return `${cellaVai(v, chiave, 'id', rowspan)}${cellaVai(v, chiave, 'titolo', rowspan)}
        <td${rowspan} title="${escapeHtml(suggerimentoBlocco(v))}">${escapeHtml(v.blocco)}</td>
        <td${rowspan}>${escapeHtml(v.metodo)}</td>
        <td${rowspan}>${escapeHtml(v.documenti.join(', '))}</td>`;
}

function htmlGruppo({ gruppo, righe }) {
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

function htmlSenzaPadre(v) {
    return `<tr>${cellaVai(v, v.chiaveSenzaPadre, 'id', '')}${cellaVai(v, v.chiaveSenzaPadre, 'titolo', '')}
        <td title="${escapeHtml(suggerimentoBlocco(v))}">${escapeHtml(v.blocco)}</td>
        <td>${escapeHtml(v.classe)}</td><td>${escapeHtml(v.metodo)}</td><td>${escapeHtml(v.documenti.join(', '))}</td>
        <td class="cella-nota">${escapeHtml(v.notaSenzaPadre)}</td></tr>`;
}

function intestazioniHtml(nomi) {
    return `<thead><tr>${nomi.map(n => `<th>${escapeHtml(n)}</th>`).join('')}</tr></thead>`;
}

// Senza padre conta come un gruppo per ogni sua voce; i gruppi oltre il limite si aggiungono con Mostra altri
function htmlTabella(filtrata) {
    const gruppiVisti = filtrata.gruppi.slice(0, gruppiMostrati);
    const senzaPadreVisti = filtrata.senzaPadre.slice(0, Math.max(0, gruppiMostrati - gruppiVisti.length));
    const restanti = filtrata.gruppi.length + filtrata.senzaPadre.length - gruppiVisti.length - senzaPadreVisti.length;
    const parti = [];
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

function htmlConteggi(c) {
    const chip = (etichetta, n, attenzione) =>
        `<span class="conteggio-import${attenzione && n > 0 ? ' conteggio-attenzione' : ''}">${etichetta}: ${n}</span>`;
    return chip('Padri', c.padri) + chip('Derivazioni', c.derivazioni)
        + chip('Senza figli', c.senzaFigli, true) + chip('Senza padre', c.senzaPadre, true);
}

function aggiorna() {
    const barra = document.getElementById('matriceFiltri');
    const conteggi = document.getElementById('matriceConteggi');
    const contenuto = document.getElementById('matriceContenuto');
    const pulsante = document.getElementById('btnEsportaMatrice');
    ultimoFiltrato = null;

    const messaggio = ultimaMatrice.libreriaAssente ? MSG_SENZA_LIBRERIA
        : !ultimaMatrice.gruppi.length && !ultimaMatrice.senzaPadre.length ? MSG_VUOTA : null;
    if (messaggio) {
        barra.hidden = true;
        conteggi.hidden = true;
        pulsante.disabled = true;
        contenuto.innerHTML = `<div class="empty-props">${escapeHtml(messaggio)}</div>`;
        return;
    }

    ultimoFiltrato = filtraMatrice(ultimaMatrice, filtri);
    const vuoto = !ultimoFiltrato.gruppi.length && !ultimoFiltrato.senzaPadre.length;
    barra.hidden = false;
    conteggi.hidden = false;
    conteggi.innerHTML = htmlConteggi(ultimoFiltrato.conteggi);
    pulsante.disabled = vuoto;
    contenuto.innerHTML = vuoto ? `<div class="empty-props">${MSG_NESSUNA_RIGA}</div>` : htmlTabella(ultimoFiltrato);
}

/* --- FILTRI A VIDEO (AC-8, AC-12) --- */

function opzioni(voci) {
    return voci.map(([valore, etichetta]) => `<option value="${escapeHtml(valore)}">${escapeHtml(etichetta)}</option>`).join('');
}

// Voci ricalcolate a ogni apertura; una scelta non più tra le voci torna a Tutti / Tutte
function popolaFiltri() {
    const documenti = [...new Set([...(appSettings.documenti || []), ...ultimaMatrice.documentiExtra, DOC_CLIENTE])];
    const classi = [CAPACITA, ...getTipologie()];
    if (!documenti.includes(filtri.documento)) filtri.documento = '';
    if (!classi.includes(filtri.classe)) filtri.classe = '';

    const selDocumento = document.getElementById('matriceDocumento');
    selDocumento.innerHTML = opzioni([['', 'Tutti'], ...documenti.map(d => [d, d])]);
    selDocumento.value = filtri.documento;
    const selClasse = document.getElementById('matriceClasse');
    selClasse.innerHTML = opzioni([['', 'Tutte'], ...classi.map(c => [c, c])]);
    selClasse.value = filtri.classe;
    document.getElementById('matriceRicerca').value = filtri.ricerca;
    aggiornaLato();
}

// Lato conta solo con un documento scelto: con Tutti è disattivato
function aggiornaLato() {
    const selLato = document.getElementById('matriceLato');
    selLato.value = filtri.lato;
    selLato.disabled = !filtri.documento;
}

// Cambiare un filtro riporta al primo blocco di gruppi (AC-9)
function filtriCambiati() {
    gruppiMostrati = appSettings.matrice.gruppiVisibili;
    aggiorna();
    document.getElementById('matriceContenuto').scrollTop = 0;
}

function applicaRicercaInSospeso() {
    if (timerRicerca === null) return;
    clearTimeout(timerRicerca);
    timerRicerca = null;
    filtri.ricerca = document.getElementById('matriceRicerca').value;
    filtriCambiati();
}

/* --- FINESTRA (AC-1) --- */

// Calcola dal modello di adesso, mai dall'indice della Gerarchia (che esiste solo a modalità accesa)
export function apriMatrice() {
    if (!modale) return;
    const indice = calcolaGerarchia(pathStack[0].graph, appState.library, appState.cliente);
    ultimaMatrice = calcolaMatrice(indice, appState.library, appState.cliente, pathStack[0].label);
    gruppiMostrati = appSettings.matrice.gruppiVisibili;
    popolaFiltri();
    modale.style.display = 'flex';
    aggiorna();
    document.getElementById('matriceContenuto').scrollTop = 0;
}

export function chiudiMatrice() {
    if (!modale) return;
    if (timerRicerca !== null) {
        clearTimeout(timerRicerca);
        timerRicerca = null;
        filtri.ricerca = document.getElementById('matriceRicerca').value;
    }
    modale.style.display = 'none';
    // Il risultato si rifà alla prossima apertura
    ultimaMatrice = null;
    ultimoFiltrato = null;
    document.getElementById('matriceContenuto').innerHTML = '';
}

/* --- INIZIALIZZAZIONE --- */

export function initMatrice() {
    document.getElementById('btnReqMatrix')?.addEventListener('click', apriMatrice);
    document.getElementById('btnChiudiMatrice')?.addEventListener('click', chiudiMatrice);

    document.getElementById('matriceDocumento')?.addEventListener('change', (e) => {
        filtri.documento = e.target.value;
        aggiornaLato();
        filtriCambiati();
    });
    document.getElementById('matriceLato')?.addEventListener('change', (e) => {
        filtri.lato = e.target.value;
        filtriCambiati();
    });
    document.getElementById('matriceClasse')?.addEventListener('change', (e) => {
        filtri.classe = e.target.value;
        filtriCambiati();
    });
    // La ricerca si applica 200 ms dopo l'ultimo tasto (AC-8, AC-13)
    document.getElementById('matriceRicerca')?.addEventListener('input', () => {
        clearTimeout(timerRicerca);
        timerRicerca = setTimeout(() => {
            timerRicerca = null;
            filtri.ricerca = document.getElementById('matriceRicerca').value;
            filtriCambiati();
        }, RITARDO_RICERCA);
    });

    document.getElementById('btnEsportaMatrice')?.addEventListener('click', esporta);

    document.getElementById('matriceContenuto')?.addEventListener('click', (e) => {
        if (e.target.closest('#btnAltriMatrice')) {
            gruppiMostrati += appSettings.matrice.gruppiVisibili;
            aggiorna();
            return;
        }
        const cella = e.target.closest('[data-chiave]');
        if (!cella) return;
        const chiave = cella.dataset.chiave;
        chiudiMatrice();
        apriGerarchiaSu(chiave);
    });
}
