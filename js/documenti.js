/* --- DOCUMENTI MIL-STD-498: CAPITOLAZIONE DEI DID, GENERAZIONE MARKDOWN, FINESTRA ED EXPORT --- */

// Spec 0007. Un file Markdown per documento con i capitoli del suo DID (Data Item Description). Chi entra, padri,
// documenti e senza padre vengono dalla matrice (spec 0006), che si calcola una volta all'apertura della finestra;
// testi, blocco e descrizione dal requisito di libreria. Niente di questo modulo va in appState.

import { appState, appSettings, pathStack } from './state.js';
import { calcolaGerarchia } from './gerarchia.js';
import { calcolaMatrice, tabellaMd } from './matrice.js';
import { infoProgetto } from './progetto.js';
import { infoLibreria } from './libreria.js';
import { scaricaFileTesto } from './storage.js';
import { CAPACITA, getTipologie } from './model.js';
import { escapeHtml, slugifyId, dataOggi } from './utils.js';

const MSG_SENZA_LIBRERIA = 'Libreria non caricata: i documenti si generano quando la carichi';
const MSG_NESSUN_DOCUMENTO = 'Nessun documento disponibile: aggiungi documenti in settings.json o nei testi da esportare';
const DA_COMPLETARE = '_Da completare._';
const NESSUN_REQUISITO = 'Nessun requisito in questo documento.';
const DOC_CLIENTE = 'Cliente';

const collator = new Intl.Collator('it', { numeric: true });

/* --- CAPITOLAZIONE DEI DID (AC-5) --- */

// tipo: fisso (solo "Da completare"), identificazione, riferimenti, capacita, componenti, interfacce (inline: i suoi
// sottocapitoli entrano direttamente nel capitolo padre, come in IRS e IDD), altri (solo se ci sono capacità),
// qualifica, tracciabilita, contenitore (solo figli). I numeri li assegna numeraCapitoli()
const fisso = titolo => ({ titolo, tipo: 'fisso' });
const contenitore = (titolo, figli) => ({ titolo, tipo: 'contenitore', figli });

function inizio(panoramica) {
    return [
        contenitore('Scopo', [{ titolo: 'Identificazione', tipo: 'identificazione' }, fisso(panoramica), fisso('Panoramica del documento')]),
        { titolo: 'Documenti di riferimento', tipo: 'riferimenti' }
    ];
}

const QUALIFICA = { titolo: 'Disposizioni di qualifica', tipo: 'qualifica' };
const TRACCIABILITA = { titolo: 'Tracciabilità dei requisiti', tipo: 'tracciabilita' };
const NOTE = contenitore('Note', [fisso('Acronimi e glossario')]);

// SSS e SRS: stessa capitolazione, con "del CSCI" e due titoli diversi per il software
function didRequisiti(titolo, di, software) {
    return {
        titolo,
        capitoli: [
            ...inizio(software ? 'Panoramica del CSCI' : 'Panoramica del sistema'),
            contenitore('Requisiti', [
                fisso('Stati e modi richiesti'),
                { titolo: `Requisiti di capacità ${di}`, tipo: 'capacita' },
                { titolo: `Requisiti di interfaccia esterna ${di}`, tipo: 'interfacce' },
                fisso(`Requisiti di interfaccia interna ${di}`),
                fisso(`Requisiti dei dati interni ${di}`),
                fisso('Requisiti di adattamento'),
                fisso('Requisiti di sicurezza (safety)'),
                fisso('Requisiti di sicurezza e riservatezza (security e privacy)'),
                fisso(`Requisiti dell'ambiente ${di}`),
                fisso('Requisiti delle risorse di calcolo'),
                fisso(software ? 'Fattori di qualità del software' : 'Fattori di qualità del sistema'),
                fisso(software ? 'Vincoli di progetto e implementazione' : 'Vincoli di progetto e costruzione'),
                fisso('Requisiti relativi al personale'),
                fisso('Requisiti di addestramento'),
                fisso('Requisiti di supporto logistico'),
                fisso('Altri requisiti'),
                fisso('Requisiti di imballaggio'),
                fisso('Precedenza e criticità dei requisiti')
            ]),
            QUALIFICA,
            TRACCIABILITA,
            NOTE
        ]
    };
}

// SSDD e SDD: componenti per blocco (4.1) e interfacce (4.3); SDD ha in più il progetto di dettaglio
function didProgetto(titolo, di, livello, software) {
    return {
        titolo,
        capitoli: [
            ...inizio(software ? 'Panoramica del CSCI' : 'Panoramica del sistema'),
            fisso(`Decisioni di progetto ${livello}`),
            contenitore(`Progetto architetturale ${di}`, [
                { titolo: `Componenti ${di}`, tipo: 'componenti' },
                fisso('Concetto di esecuzione'),
                { titolo: 'Progetto delle interfacce', tipo: 'interfacce' }
            ]),
            ...(software ? [fisso('Progetto di dettaglio del CSCI')] : []),
            TRACCIABILITA,
            NOTE
        ]
    };
}

const DID = {
    SSS: didRequisiti('Specifica del sistema/sottosistema', 'del sistema', false),
    SRS: didRequisiti('Specifica dei requisiti software', 'del CSCI', true),
    IRS: {
        titolo: 'Specifica dei requisiti di interfaccia',
        capitoli: [
            ...inizio('Panoramica delle interfacce'),
            contenitore('Requisiti', [
                { titolo: '', tipo: 'interfacce', inline: true },
                { titolo: 'Altri requisiti', tipo: 'altri' },
                fisso('Precedenza e criticità dei requisiti')
            ]),
            QUALIFICA,
            TRACCIABILITA,
            NOTE
        ]
    },
    SSDD: didProgetto('Descrizione del progetto del sistema/sottosistema', 'del sistema', 'a livello di sistema', false),
    SDD: didProgetto('Descrizione del progetto software', 'del CSCI', 'a livello di CSCI', true),
    IDD: {
        titolo: 'Descrizione del progetto delle interfacce',
        capitoli: [
            ...inizio('Panoramica delle interfacce'),
            contenitore('Progetto delle interfacce', [
                { titolo: '', tipo: 'interfacce', inline: true },
                { titolo: 'Altri requisiti', tipo: 'altri' }
            ]),
            TRACCIABILITA,
            NOTE
        ]
    },
    ALTRO: {
        titolo: 'Documento di requisiti',
        capitoli: [
            ...inizio('Panoramica'),
            contenitore('Requisiti', [
                { titolo: 'Requisiti di capacità', tipo: 'capacita' },
                { titolo: 'Requisiti di interfaccia', tipo: 'interfacce' }
            ]),
            QUALIFICA,
            TRACCIABILITA,
            NOTE
        ]
    }
};

/* --- DATI (calcolati una volta all'apertura) --- */

const testoDocumento = t => String(t?.documento ?? '').trim();

// Mappa reqId → { req, def } di libreria (con un doppione vince il primo blocco, come la matrice) e padri di ogni
// requisito dai gruppi della matrice, nell'ordine dei gruppi
export function preparaDatiDocumenti(matrice, libreria) {
    const perId = new Map();
    Object.values(libreria || {}).forEach(def => (def.requisiti || []).forEach(req => {
        if (!perId.has(req.id)) perId.set(req.id, { req, def });
    }));
    const padriDi = new Map();
    matrice.gruppi.forEach(gruppo => gruppo.figli.forEach(({ figlio }) => {
        if (!padriDi.has(figlio.id)) padriDi.set(figlio.id, []);
        padriDi.get(figlio.id).push(gruppo.padre);
    }));
    const documentiLibreria = new Set();
    perId.forEach(({ req }) => (req.testiExport || []).forEach(t => {
        const doc = testoDocumento(t);
        if (doc) documentiLibreria.add(doc);
    }));
    return { matrice, perId, padriDi, documentiLibreria: [...documentiLibreria] };
}

// Voci del selettore: settings, poi i documenti dei testi assenti da settings in ordine alfabetico; mai Cliente (AC-2)
export function vociDocumento(dati) {
    const daSettings = (appSettings.documenti || []).map(d => String(d).trim()).filter(Boolean);
    const noti = new Set(daSettings);
    const extra = dati.documentiLibreria.filter(d => !noti.has(d)).sort((a, b) => a.localeCompare(b, 'it'));
    return [...new Set([...daSettings, ...extra])].filter(d => d !== DOC_CLIENTE);
}

/* --- GENERAZIONE (AC-3 … AC-11) --- */

const unaRiga = valore => String(valore ?? '').replace(/\s+/g, ' ').trim();

function ordinaDocumenti(insieme, voci) {
    const ordine = [DOC_CLIENTE, ...voci];
    const noti = ordine.filter(d => insieme.has(d));
    const altri = [...insieme].filter(d => !ordine.includes(d)).sort((a, b) => a.localeCompare(b, 'it'));
    return [...noti, ...altri];
}

// Funzione pura: dati, documento scelto e intestazione → testo del file e riepilogo
export function generaDocumento(dati, documento, { nome, data, libreria }) {
    const modello = DID[documento] || DID.ALTRO;
    const voci = vociDocumento(dati);
    const metodi = (appSettings.metodiVerifica || []).map(m => String(m).trim());
    const vociMatrice = new Set();

    // Requisiti del documento, nell'ordine della matrice (AC-3)
    const requisiti = [];
    dati.matrice.voci.forEach(voce => {
        if (voce.cliente) return;
        vociMatrice.add(voce.id);
        const trovato = dati.perId.get(voce.id);
        if (!trovato) return;
        const testi = (trovato.req.testiExport || [])
            .filter(t => testoDocumento(t) === documento && String(t.testo ?? '').trim())
            .map(t => String(t.testo).trim());
        if (!testi.length) return;
        requisiti.push({ voce, req: trovato.req, def: trovato.def, testi, padri: dati.padriDi.get(voce.id) || [], sezione: '' });
    });
    let nonUsati = 0;
    dati.perId.forEach(({ req }, id) => {
        if (vociMatrice.has(id)) return;
        if ((req.testiExport || []).some(t => testoDocumento(t) === documento && String(t.testo ?? '').trim())) nonUsati++;
    });
    const capacita = requisiti.filter(r => r.voce.classe === CAPACITA);
    const interfacce = requisiti.filter(r => r.voce.classe !== CAPACITA);

    // Interfacce per tipologia: prima quelle di settings, poi le altre in ordine alfabetico (AC-6)
    const perTipologia = new Map();
    interfacce.forEach(r => {
        if (!perTipologia.has(r.voce.classe)) perTipologia.set(r.voce.classe, []);
        perTipologia.get(r.voce.classe).push(r);
    });
    const tipologieNote = getTipologie();
    const tipologie = [
        ...tipologieNote.filter(t => perTipologia.has(t)),
        ...[...perTipologia.keys()].filter(t => !tipologieNote.includes(t)).sort((a, b) => a.localeCompare(b, 'it'))
    ];

    const nodoRequisito = r => ({
        titolo: r.voce.titolo ? `${r.voce.idMostrato} · ${r.voce.titolo}` : r.voce.idMostrato,
        requisito: r,
        corpo: () => [
            ...r.testi,
            [
                `- Metodo di verifica: ${unaRiga(r.voce.metodo) || 'non definito'}`,
                `- Blocco: ${unaRiga(r.voce.blocco)}`,
                `- Deriva da: ${r.padri.map(p => unaRiga(p.idMostrato)).join(', ') || 'nessun padre'}`
            ].join('\n')
        ]
    });

    function nodoIdentificazione() {
        if (!interfacce.length) return { titolo: 'Identificazione delle interfacce e diagrammi', corpo: [NESSUN_REQUISITO] };
        const righe = tipologie.map(t => {
            const blocchi = [...new Set(perTipologia.get(t).map(r => r.voce.blocco))];
            return [t, perTipologia.get(t).length, blocchi.join(', ')];
        });
        return {
            titolo: 'Identificazione delle interfacce e diagrammi',
            corpo: [tabellaMd(['Tipologia', 'Requisiti', 'Blocchi'], righe).join('\n'), '_Diagrammi da completare._']
        };
    }
    const nodiTipologie = () => tipologie.map(t => ({ titolo: `Interfaccia ${t}`, figli: perTipologia.get(t).map(nodoRequisito) }));

    // Blocchi di 4.1: per livello minimo dei loro requisiti, poi titolo naturale, poi id (AC-7)
    function nodiComponenti() {
        const perBlocco = new Map();
        capacita.forEach(r => {
            const id = r.def.id;
            if (!perBlocco.has(id)) perBlocco.set(id, { def: r.def, titolo: r.voce.blocco, livello: r.voce.livello, requisiti: [] });
            const b = perBlocco.get(id);
            b.livello = Math.min(b.livello, r.voce.livello);
            b.requisiti.push(r);
        });
        return [...perBlocco.values()].sort((a, b) =>
            a.livello - b.livello || collator.compare(a.titolo, b.titolo) || collator.compare(a.def.id, b.def.id));
    }

    // Tipo del DID → capitoli concreti { titolo, corpo, figli, requisito? }; un array vuoto toglie il capitolo
    function espandi(c) {
        switch (c.tipo) {
            case 'fisso':
                return [{ titolo: c.titolo, corpo: [DA_COMPLETARE] }];
            case 'contenitore':
                return [{ titolo: c.titolo, figli: c.figli.flatMap(espandi) }];
            case 'identificazione':
                return [{ titolo: c.titolo, corpo: [identificazione] }];
            case 'riferimenti':
                return [{ titolo: c.titolo, corpo: [riferimenti.length ? riferimenti.map(d => `- ${d}`).join('\n') : DA_COMPLETARE] }];
            case 'capacita':
                return [{ titolo: c.titolo, corpo: capacita.length ? [] : [NESSUN_REQUISITO], figli: capacita.map(nodoRequisito) }];
            case 'altri':
                return capacita.length ? [{ titolo: c.titolo, figli: capacita.map(nodoRequisito) }] : [];
            case 'interfacce':
                if (c.inline) return [nodoIdentificazione(), ...nodiTipologie()];
                if (!interfacce.length) return [{ titolo: c.titolo, corpo: [NESSUN_REQUISITO] }];
                return [{ titolo: c.titolo, figli: [nodoIdentificazione(), ...nodiTipologie()] }];
            case 'componenti': {
                if (!capacita.length) return [{ titolo: c.titolo, corpo: [NESSUN_REQUISITO] }];
                const blocchi = nodiComponenti();
                const tabella = tabellaMd(['Blocco', 'Categoria', 'Requisiti nel documento'],
                    blocchi.map(b => [b.titolo, b.def.categoria || '', b.requisiti.length])).join('\n');
                return [{
                    titolo: c.titolo,
                    corpo: [tabella],
                    figli: blocchi.map(b => ({
                        titolo: b.titolo,
                        corpo: String(b.def.descrizione ?? '').trim() ? [String(b.def.descrizione).trim()] : [],
                        figli: b.requisiti.map(nodoRequisito)
                    }))
                }];
            }
            case 'qualifica':
                return [{ titolo: c.titolo, corpo: corpoQualifica }];
            case 'tracciabilita':
                return [{ titolo: c.titolo, corpo: corpoTracciabilita }];
            default:
                return [];
        }
    }

    const versione = libreria.versione ? ` v${libreria.versione}` : '';
    const identificazione = `Questo documento (${documento}) riguarda il progetto ${nome}. È generato dal modello con la libreria ${libreria.nomeFile}${versione} il ${data}.`;
    const documentiPadri = new Set();
    requisiti.forEach(r => r.padri.forEach(p => p.documenti.forEach(d => documentiPadri.add(d))));
    documentiPadri.delete(documento);
    const riferimenti = ordinaDocumenti(documentiPadri, voci);

    // Le tabelle di qualifica e tracciabilità citano le sezioni: si scrivono dopo la numerazione, nell'ordine del file
    const ordineFile = [];
    function corpoQualifica() {
        if (!ordineFile.length) return [NESSUN_REQUISITO];
        const righe = ordineFile.map(r => {
            const metodo = String(r.voce.metodo ?? '').trim();
            const nota = !metodo ? 'Metodo non definito' : metodi.includes(metodo) ? '' : `Metodo: ${metodo}`;
            return [r.voce.idMostrato, r.voce.titolo, r.sezione, ...metodi.map(m => (m === metodo ? 'X' : '')), nota];
        });
        return [`Metodi di qualifica: ${metodi.join(', ')}.`, tabellaMd(['ID', 'Titolo', 'Sezione', ...metodi, 'Note'], righe).join('\n')];
    }
    function corpoTracciabilita() {
        if (!ordineFile.length) return [NESSUN_REQUISITO];
        const righe = ordineFile.map(r => {
            const padri = r.padri.map(p => `${p.idMostrato} ${p.titolo}`.trim()).join('; ') || '—';
            const docs = new Set();
            r.padri.forEach(p => p.documenti.forEach(d => docs.add(d)));
            const note = [r.voce.notaSenzaPadre, ...r.padri.filter(p => p.ritirato).map(p => `Padre ritirato: ${p.idMostrato}`)]
                .filter(Boolean).join('; ');
            return [r.voce.idMostrato, r.voce.titolo, r.sezione, padri, ordinaDocumenti(docs, voci).join(', '), note];
        });
        return [tabellaMd(['ID', 'Titolo', 'Sezione', 'Requisiti padre', 'Documenti padre', 'Note'], righe).join('\n')];
    }

    // Numerazione in un solo passo; ogni requisito prende la sua sezione (AC-4, AC-8, AC-9)
    const albero = modello.capitoli.flatMap(espandi);
    function numeraCapitoli(nodi, prefisso) {
        nodi.forEach((nodo, i) => {
            nodo.numero = prefisso ? `${prefisso}.${i + 1}` : String(i + 1);
            if (nodo.requisito) {
                nodo.requisito.sezione = nodo.numero;
                ordineFile.push(nodo.requisito);
            }
            numeraCapitoli(nodo.figli || [], nodo.numero);
        });
    }
    numeraCapitoli(albero, '');

    const blocchi = [
        `# ${unaRiga(documento)} · ${modello.titolo} · ${unaRiga(nome)}`,
        `Data: ${data} · Libreria: ${libreria.nomeFile}${versione}`
    ];
    function scrivi(nodi) {
        nodi.forEach(nodo => {
            const livelli = nodo.numero.split('.').length;
            const numero = livelli === 1 ? `${nodo.numero}.` : nodo.numero;
            blocchi.push(`${'#'.repeat(livelli + 1)} ${numero} ${unaRiga(nodo.titolo)}`);
            const corpo = typeof nodo.corpo === 'function' ? nodo.corpo() : nodo.corpo || [];
            blocchi.push(...corpo);
            scrivi(nodo.figli || []);
        });
    }
    scrivi(albero);
    blocchi.push(`Generato dal Modellatore di requisiti il ${data}. I capitoli con "Da completare" non sono coperti dal modello.`);

    return {
        testo: `${blocchi.join('\n\n')}\n`,
        riepilogo: {
            requisiti: requisiti.length,
            capacita: capacita.length,
            interfacce: interfacce.length,
            testi: requisiti.reduce((n, r) => n + r.testi.length, 0),
            senzaMetodo: requisiti.filter(r => !String(r.voce.metodo ?? '').trim()).length,
            senzaPadre: requisiti.filter(r => r.voce.notaSenzaPadre).length,
            nonUsati
        }
    };
}

/* --- FINESTRA (AC-1, AC-2, AC-12, AC-13) --- */

let ultimiDati = null;
let documentoScelto = null;
let ultimoTesto = null;

const modale = document.getElementById('documentiModal');

function intestazione() {
    const info = infoProgetto();
    return { nome: info.slug ? info.nome : pathStack[0].label, data: dataOggi(), libreria: infoLibreria() };
}

function mostraMessaggio(testo) {
    const messaggio = document.getElementById('documentiMessaggio');
    messaggio.textContent = testo;
    messaggio.hidden = false;
    document.getElementById('documentiBarra').hidden = !ultimiDati;
    document.getElementById('documentiRiepilogo').hidden = true;
    document.getElementById('anteprimaDocumento').hidden = true;
    document.getElementById('btnEsportaDocumento').disabled = true;
}

function aggiorna() {
    const riepilogo = document.getElementById('documentiRiepilogo');
    const anteprima = document.getElementById('anteprimaDocumento');
    const messaggio = document.getElementById('documentiMessaggio');
    const generato = generaDocumento(ultimiDati, documentoScelto, intestazione());
    ultimoTesto = generato.testo;
    const r = generato.riepilogo;

    riepilogo.hidden = false;
    riepilogo.innerHTML = escapeHtml(`Requisiti: ${r.requisiti} (capacità ${r.capacita}, interfacce ${r.interfacce}) · Testi: ${r.testi} · `
        + `Senza metodo: ${r.senzaMetodo} · Senza padre: ${r.senzaPadre} · Non usati nel progetto: ${r.nonUsati}`);
    if (r.requisiti === 0) {
        messaggio.textContent = `Nessun requisito ha testi per ${documentoScelto}: il file avrà solo i capitoli.`;
        messaggio.hidden = false;
    } else {
        messaggio.hidden = true;
    }
    const limite = appSettings.documentiExport.anteprimaCaratteri;
    anteprima.hidden = false;
    anteprima.textContent = ultimoTesto.length > limite
        ? `${ultimoTesto.slice(0, limite)}\n… anteprima troncata: il file scaricato contiene tutto il documento`
        : ultimoTesto;
    anteprima.scrollTop = 0;
    document.getElementById('btnEsportaDocumento').disabled = false;
}

// Calcola indice e matrice una volta; cambiare documento rigenera solo il testo dalla stessa fotografia (AC-1)
export function apriDocumenti() {
    if (!modale) return;
    ultimiDati = null;
    ultimoTesto = null;
    modale.style.display = 'flex';
    const indice = calcolaGerarchia(pathStack[0].graph, appState.library, appState.cliente);
    const matrice = calcolaMatrice(indice, appState.library, appState.cliente, pathStack[0].label);
    if (matrice.libreriaAssente) {
        mostraMessaggio(MSG_SENZA_LIBRERIA);
        return;
    }
    ultimiDati = preparaDatiDocumenti(matrice, appState.library);
    const voci = vociDocumento(ultimiDati);
    const selettore = document.getElementById('documentiScelta');
    selettore.innerHTML = voci.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    if (!voci.length) {
        mostraMessaggio(MSG_NESSUN_DOCUMENTO);
        return;
    }
    if (!voci.includes(documentoScelto)) documentoScelto = voci[0];
    selettore.value = documentoScelto;
    document.getElementById('documentiBarra').hidden = false;
    aggiorna();
}

export function chiudiDocumenti() {
    if (!modale) return;
    modale.style.display = 'none';
    ultimiDati = null;
    ultimoTesto = null;
    document.getElementById('anteprimaDocumento').textContent = '';
}

function esporta() {
    if (!ultimiDati || ultimoTesto === null || !documentoScelto) return;
    const info = infoProgetto();
    const nome = info.slug ? info.nome : pathStack[0].label;
    const slug = info.slug || slugifyId(nome) || 'documento';
    const nomeFile = `${slug}-${slugifyId(documentoScelto) || 'documento'}.md`;
    scaricaFileTesto(ultimoTesto, nomeFile, 'text/markdown;charset=utf-8');
}

/* --- INIZIALIZZAZIONE --- */

export function initDocumenti() {
    document.getElementById('btnDocumenti')?.addEventListener('click', apriDocumenti);
    document.getElementById('btnChiudiDocumenti')?.addEventListener('click', chiudiDocumenti);
    document.getElementById('btnEsportaDocumento')?.addEventListener('click', esporta);
    document.getElementById('documentiScelta')?.addEventListener('change', (e) => {
        if (!ultimiDati) return;
        documentoScelto = e.target.value;
        aggiorna();
    });
}
