/* --- DOCUMENTI MIL-STD-498: CAPITOLAZIONE DEI DID, GENERAZIONE MARKDOWN, FINESTRA ED EXPORT --- */

// Spec 0007. Un file Markdown per documento con i capitoli del suo DID (Data Item Description). Chi entra, padri,
// documenti e senza padre vengono dalla matrice (spec 0006), che si calcola una volta all'apertura della finestra;
// testi, blocco e descrizione dal requisito di libreria. Niente di questo modulo va in appState.

import { appState, appSettings, pathStack } from './state.js';
import { calcolaGerarchia } from './gerarchia.js';
import { calcolaMatrice, tabellaMd, type Matrice, type VoceMatrice } from './matrice.js';
import { infoProgetto } from './progetto.js';
import { infoLibreria } from './libreria.js';
import { scaricaFileTesto } from './storage.js';
import { CAPACITA, getTipologie, documentiDellaClasse, motivoNonAmmesso, testiNonAmmessi } from './model.js';
import { escapeHtml, slugifyId, dataOggi } from './utils.js';
import { openLibraryBlock } from './inspector.js';
import { mostraPannello, pannelloAperto, pannelloVisibile, allaVista, allaChiusura } from './pannelli.js';
import { render } from './renderer.js';
import { interniDeiBlocchi, svgDiagramma, svgInPng } from './diagramma.js';
import type { Blocco, ClasseDocumenti, ImmagineDiagramma, Libreria, RequisitoLibreria, RevisioneDocumento, TestoExport } from './tipi.js';

const MSG_SENZA_LIBRERIA = 'Libreria non caricata: i documenti si generano quando la carichi';
const MSG_NESSUN_DOCUMENTO = 'Nessun documento disponibile: aggiungi documenti a documentiPerClasse in settings.json';
const DA_COMPLETARE = '_Da completare._';
const NESSUN_REQUISITO = 'Nessun requisito in questo documento.';
const DOC_CLIENTE = 'Cliente';

const collator = new Intl.Collator('it', { numeric: true });

/* --- CAPITOLAZIONE DEI DID (AC-5) --- */

// tipo: fisso (solo "Da completare"), identificazione, riferimenti, capacita, componenti, interfacce (inline: i suoi
// sottocapitoli entrano direttamente nel capitolo padre, come in IRS e IDD), altri (solo se ci sono capacità),
// qualifica, tracciabilita, contenitore (solo figli). I numeri li assegna numeraCapitoli()
type TipoCapitolo = 'fisso' | 'contenitore' | 'identificazione' | 'riferimenti' | 'capacita' | 'interfacce' | 'altri'
    | 'componenti' | 'qualifica' | 'tracciabilita';

interface CapitoloDid {
    titolo: string;
    tipo: TipoCapitolo;
    figli?: CapitoloDid[];
    inline?: boolean;
}

interface Did {
    titolo: string;
    capitoli: CapitoloDid[];
}

const fisso = (titolo: string): CapitoloDid => ({ titolo, tipo: 'fisso' });
const contenitore = (titolo: string, figli: CapitoloDid[]): CapitoloDid => ({ titolo, tipo: 'contenitore', figli });

function inizio(panoramica: string): CapitoloDid[] {
    return [
        contenitore('Scopo', [{ titolo: 'Identificazione', tipo: 'identificazione' }, fisso(panoramica), fisso('Panoramica del documento')]),
        { titolo: 'Documenti di riferimento', tipo: 'riferimenti' }
    ];
}

const QUALIFICA: CapitoloDid = { titolo: 'Disposizioni di qualifica', tipo: 'qualifica' };
const TRACCIABILITA: CapitoloDid = { titolo: 'Tracciabilità dei requisiti', tipo: 'tracciabilita' };
const NOTE = contenitore('Note', [fisso('Acronimi e glossario')]);

// SSS e SRS: stessa capitolazione, con "del CSCI" e due titoli diversi per il software
function didRequisiti(titolo: string, di: string, software: boolean): Did {
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
function didProgetto(titolo: string, di: string, livello: string, software: boolean): Did {
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

const DID: Record<string, Did> = {
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

// Titolo del DID di un documento, per il frontespizio di Word e PDF (spec 0028)
export function titoloDid(documento: string): string {
    return (DID[documento] || (DID.ALTRO as Did)).titolo;
}

/* --- DATI (calcolati una volta all'apertura) --- */

export interface DatiDocumenti {
    matrice: Matrice;
    perId: Map<string, { req: RequisitoLibreria; def: Blocco }>;
    padriDi: Map<string, VoceMatrice[]>;
}

const testoDocumento = (t: TestoExport | null | undefined): string => String(t?.documento ?? '').trim();

// Mappa reqId → { req, def } di libreria (con un doppione vince il primo blocco, come la matrice) e padri di ogni
// requisito dai gruppi della matrice, nell'ordine dei gruppi
export function preparaDatiDocumenti(matrice: Matrice, libreria: Libreria): DatiDocumenti {
    const perId = new Map<string, { req: RequisitoLibreria; def: Blocco }>();
    Object.values(libreria || {}).forEach((def) => (def.requisiti || []).forEach((req) => {
        if (!perId.has(req.id)) perId.set(req.id, { req, def });
    }));
    const padriDi = new Map<string, VoceMatrice[]>();
    matrice.gruppi.forEach((gruppo) => gruppo.figli.forEach(({ figlio }) => {
        let padri = padriDi.get(figlio.id);
        if (!padri) {
            padri = [];
            padriDi.set(figlio.id, padri);
        }
        padri.push(gruppo.padre);
    }));
    return { matrice, perId, padriDi };
}

// Voci del selettore: solo i documenti ammessi per almeno una classe (spec 0027, AC-8): prima quelli di settings
// nel loro ordine, poi quelli di documentiPerClasse (interfaccia, poi capacità); mai Cliente
export function vociDocumento(): string[] {
    const classificati = [...documentiDellaClasse('interfaccia'), ...documentiDellaClasse('capacita')];
    const daSettings = (appSettings.documenti || []).map((d) => String(d).trim()).filter((d) => classificati.includes(d));
    return [...new Set([...daSettings, ...classificati])].filter((d) => d !== DOC_CLIENTE);
}

// Classe a cui è destinato un capitolo del DID (spec 0027, AC-9)
function classeCapitolo(tipo: TipoCapitolo): ClasseDocumenti | null {
    if (tipo === 'capacita' || tipo === 'componenti') return 'capacita';
    if (tipo === 'interfacce') return 'interfaccia';
    return null;
}

/* --- GENERAZIONE (AC-3 … AC-11) --- */

interface RequisitoDocumento {
    voce: VoceMatrice;
    req: RequisitoLibreria;
    def: Blocco;
    testi: string[];
    padri: VoceMatrice[];
    // Numero del capitolo che lo contiene, assegnato dalla numerazione
    sezione: string;
}

// Capitolo concreto: corpo come testo o come funzione (qualifica e tracciabilità si scrivono dopo la numerazione)
interface Capitolo {
    titolo: string;
    corpo?: string[] | (() => string[]);
    figli?: Capitolo[];
    requisito?: RequisitoDocumento;
    numero?: string;
}

export interface IntestazioneDocumento {
    nome: string;
    data: string;
    libreria: { nomeFile: string; versione: string | null };
}

// Figure dei diagrammi (spec 0029): solo per Word e PDF. radice: il livello radice non è vuoto;
// blocchi: id dei blocchi con un interno non vuoto
export interface OpzioniDiagrammi {
    radice: boolean;
    blocchi: Set<string>;
}

export const CHIAVE_RADICE = 'radice';
export const chiaveBlocco = (id: string): string => `blocco:${encodeURIComponent(id)}`;
// Didascalia su una riga e senza parentesi quadre, che chiuderebbero il segnaposto
const didascalia = (testo: string): string => unaRiga(testo).replace(/[[\]]/g, '');
const figura = (testo: string, chiave: string): string => `![${didascalia(testo)}](diagramma:${chiave})`;

export interface DocumentoGenerato {
    testo: string;
    riepilogo: { requisiti: number; capacita: number; interfacce: number; testi: number; senzaMetodo: number; senzaPadre: number; nonUsati: number; esclusi: number };
}

const unaRiga = (valore: unknown): string => String(valore ?? '').replace(/\s+/g, ' ').trim();

function ordinaDocumenti(insieme: Set<string>, voci: string[]): string[] {
    const ordine = [DOC_CLIENTE, ...voci];
    const noti = ordine.filter((d) => insieme.has(d));
    const altri = [...insieme].filter((d) => !ordine.includes(d)).sort((a, b) => a.localeCompare(b, 'it'));
    return [...noti, ...altri];
}

// Funzione pura: dati, documento scelto e intestazione → testo del file e riepilogo
export function generaDocumento(dati: DatiDocumenti, documento: string, { nome, data, libreria }: IntestazioneDocumento,
    diagrammi: OpzioniDiagrammi | null = null): DocumentoGenerato {
    const modello = DID[documento] || (DID.ALTRO as Did);
    const voci = vociDocumento();
    const metodi = (appSettings.metodiVerifica || []).map((m) => String(m).trim());
    const vociMatrice = new Set<string>();

    // Requisiti del documento, nell'ordine della matrice (AC-3)
    const requisiti: RequisitoDocumento[] = [];
    dati.matrice.voci.forEach((voce) => {
        if (voce.cliente) return;
        vociMatrice.add(voce.id);
        const trovato = dati.perId.get(voce.id);
        if (!trovato) return;
        // Entra solo un testo ammesso per la classe del requisito (spec 0027, AC-9)
        if (motivoNonAmmesso(trovato.req, documento) !== null) return;
        const testi = (trovato.req.testiExport || [])
            .filter((t) => testoDocumento(t) === documento && String(t.testo ?? '').trim())
            .map((t) => String(t.testo).trim());
        if (!testi.length) return;
        requisiti.push({ voce, req: trovato.req, def: trovato.def, testi, padri: dati.padriDi.get(voce.id) || [], sezione: '' });
    });
    let nonUsati = 0;
    let esclusi = 0;
    dati.perId.forEach(({ req }, id) => {
        const conTesto = (req.testiExport || []).filter((t) => testoDocumento(t) === documento && String(t.testo ?? '').trim());
        if (motivoNonAmmesso(req, documento) !== null) {
            esclusi += conTesto.length;
            return;
        }
        if (!vociMatrice.has(id) && conTesto.length) nonUsati++;
    });

    // Documenti di un padre: Cliente, oppure i documenti ammessi dei testi non vuoti del suo requisito (AC-10)
    function documentiPadre(p: VoceMatrice): string[] {
        if (p.cliente) return [DOC_CLIENTE];
        const trovato = dati.perId.get(p.id);
        if (!trovato) return [];
        return (trovato.req.testiExport || [])
            .filter((t) => String(t.testo ?? '').trim() && testoDocumento(t) && motivoNonAmmesso(trovato.req, testoDocumento(t)) === null)
            .map(testoDocumento);
    }
    const capacita = requisiti.filter((r) => r.voce.classe === CAPACITA);
    const interfacce = requisiti.filter((r) => r.voce.classe !== CAPACITA);

    // Interfacce per tipologia: prima quelle di settings, poi le altre in ordine alfabetico (AC-6)
    const perTipologia = new Map<string, RequisitoDocumento[]>();
    interfacce.forEach((r) => {
        let gruppo = perTipologia.get(r.voce.classe);
        if (!gruppo) {
            gruppo = [];
            perTipologia.set(r.voce.classe, gruppo);
        }
        gruppo.push(r);
    });
    const tipologieNote = getTipologie();
    const tipologie = [
        ...tipologieNote.filter((t) => perTipologia.has(t)),
        ...[...perTipologia.keys()].filter((t) => !tipologieNote.includes(t)).sort((a, b) => a.localeCompare(b, 'it'))
    ];
    const diTipologia = (t: string): RequisitoDocumento[] => perTipologia.get(t) ?? [];

    const nodoRequisito = (r: RequisitoDocumento): Capitolo => ({
        titolo: r.voce.titolo ? `${r.voce.idMostrato} · ${r.voce.titolo}` : r.voce.idMostrato,
        requisito: r,
        corpo: () => [
            ...r.testi,
            [
                `- Metodo di verifica: ${unaRiga(r.voce.metodo) || 'non definito'}`,
                `- Blocco: ${unaRiga(r.voce.blocco)}`,
                `- Deriva da: ${r.padri.map((p) => unaRiga(p.idMostrato)).join(', ') || 'nessun padre'}`
            ].join('\n')
        ]
    });

    function nodoIdentificazione(): Capitolo {
        if (!interfacce.length) return { titolo: 'Identificazione delle interfacce e diagrammi', corpo: [NESSUN_REQUISITO] };
        const righe = tipologie.map((t) => {
            const blocchi = [...new Set(diTipologia(t).map((r) => r.voce.blocco))];
            return [t, diTipologia(t).length, blocchi.join(', ')];
        });
        return {
            titolo: 'Identificazione delle interfacce e diagrammi',
            corpo: [
                tabellaMd(['Tipologia', 'Requisiti', 'Blocchi'], righe).join('\n'),
                diagrammi?.radice ? figura(`Diagramma: ${nome}`, CHIAVE_RADICE) : '_Diagrammi da completare._'
            ]
        };
    }
    const nodiTipologie = (): Capitolo[] => tipologie.map((t) => ({ titolo: `Interfaccia ${t}`, figli: diTipologia(t).map(nodoRequisito) }));

    // Blocchi di 4.1: per livello minimo dei loro requisiti, poi titolo naturale, poi id (AC-7)
    function nodiComponenti(): Array<{ def: Blocco; titolo: string; livello: number; requisiti: RequisitoDocumento[] }> {
        const perBlocco = new Map<string, { def: Blocco; titolo: string; livello: number; requisiti: RequisitoDocumento[] }>();
        capacita.forEach((r) => {
            const id = r.def.id;
            let b = perBlocco.get(id);
            if (!b) {
                b = { def: r.def, titolo: r.voce.blocco, livello: r.voce.livello, requisiti: [] };
                perBlocco.set(id, b);
            }
            b.livello = Math.min(b.livello, r.voce.livello);
            b.requisiti.push(r);
        });
        return [...perBlocco.values()].sort((a, b) =>
            a.livello - b.livello || collator.compare(a.titolo, b.titolo) || collator.compare(a.def.id, b.def.id));
    }

    const versione = libreria.versione ? ` v${libreria.versione}` : '';
    const identificazione = `Questo documento (${documento}) riguarda il progetto ${nome}. È generato dal modello con la libreria ${libreria.nomeFile}${versione} il ${data}.`;
    const documentiPadri = new Set<string>();
    requisiti.forEach((r) => r.padri.forEach((p) => documentiPadre(p).forEach((d) => documentiPadri.add(d))));
    documentiPadri.delete(documento);
    const riferimenti = ordinaDocumenti(documentiPadri, voci);

    // Le tabelle di qualifica e tracciabilità citano le sezioni: si scrivono dopo la numerazione, nell'ordine del file
    const ordineFile: RequisitoDocumento[] = [];
    function corpoQualifica(): string[] {
        if (!ordineFile.length) return [NESSUN_REQUISITO];
        const righe = ordineFile.map((r) => {
            const metodo = String(r.voce.metodo ?? '').trim();
            const nota = !metodo ? 'Metodo non definito' : metodi.includes(metodo) ? '' : `Metodo: ${metodo}`;
            return [r.voce.idMostrato, r.voce.titolo, r.sezione, ...metodi.map((m) => (m === metodo ? 'X' : '')), nota];
        });
        return [`Metodi di qualifica: ${metodi.join(', ')}.`, tabellaMd(['ID', 'Titolo', 'Sezione', ...metodi, 'Note'], righe).join('\n')];
    }
    function corpoTracciabilita(): string[] {
        if (!ordineFile.length) return [NESSUN_REQUISITO];
        const righe = ordineFile.map((r) => {
            const padri = r.padri.map((p) => `${p.idMostrato} ${p.titolo}`.trim()).join('; ') || '—';
            const docs = new Set<string>();
            r.padri.forEach((p) => documentiPadre(p).forEach((d) => docs.add(d)));
            const note = [r.voce.notaSenzaPadre, ...r.padri.filter((p) => p.ritirato).map((p) => `Padre ritirato: ${p.idMostrato}`)]
                .filter(Boolean).join('; ');
            return [r.voce.idMostrato, r.voce.titolo, r.sezione, padri, ordinaDocumenti(docs, voci).join(', '), note];
        });
        return [tabellaMd(['ID', 'Titolo', 'Sezione', 'Requisiti padre', 'Documenti padre', 'Note'], righe).join('\n')];
    }

    // Tipo del DID → capitoli concreti; un array vuoto toglie il capitolo
    function espandi(c: CapitoloDid): Capitolo[] {
        // Capitolo di una classe che il documento non ammette: rinvio ai documenti giusti (spec 0027, AC-9)
        const classe = classeCapitolo(c.tipo);
        if (classe && !documentiDellaClasse(classe).includes(documento)) {
            const ammessi = documentiDellaClasse(classe);
            const nomeClasse = classe === 'interfaccia' ? 'interfaccia' : 'capacità';
            const corpo = [ammessi.length ? `I requisiti di ${nomeClasse} sono nei documenti ${ammessi.join(', ')}.` : NESSUN_REQUISITO];
            return [{ titolo: c.inline ? 'Identificazione delle interfacce e diagrammi' : c.titolo, corpo }];
        }
        switch (c.tipo) {
            case 'fisso':
                return [{ titolo: c.titolo, corpo: [DA_COMPLETARE] }];
            case 'contenitore':
                return [{ titolo: c.titolo, figli: (c.figli ?? []).flatMap(espandi) }];
            case 'identificazione':
                return [{ titolo: c.titolo, corpo: [identificazione] }];
            case 'riferimenti':
                return [{ titolo: c.titolo, corpo: [riferimenti.length ? riferimenti.map((d) => `- ${d}`).join('\n') : DA_COMPLETARE] }];
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
                    blocchi.map((b) => [b.titolo, b.def.categoria || '', b.requisiti.length])).join('\n');
                return [{
                    titolo: c.titolo,
                    corpo: diagrammi?.radice ? [tabella, figura(`Diagramma: ${nome}`, CHIAVE_RADICE)] : [tabella],
                    figli: blocchi.map((b) => ({
                        titolo: b.titolo,
                        corpo: [
                            ...(String(b.def.descrizione ?? '').trim() ? [String(b.def.descrizione).trim()] : []),
                            ...(diagrammi?.blocchi.has(b.def.id) ? [figura(`Diagramma interno: ${b.titolo}`, chiaveBlocco(b.def.id))] : [])
                        ],
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

    // Numerazione in un solo passo; ogni requisito prende la sua sezione (AC-4, AC-8, AC-9)
    const albero = modello.capitoli.flatMap(espandi);
    function numeraCapitoli(nodi: Capitolo[], prefisso: string): void {
        nodi.forEach((nodo, i) => {
            const numero = prefisso ? `${prefisso}.${i + 1}` : String(i + 1);
            nodo.numero = numero;
            if (nodo.requisito) {
                nodo.requisito.sezione = numero;
                ordineFile.push(nodo.requisito);
            }
            numeraCapitoli(nodo.figli || [], numero);
        });
    }
    numeraCapitoli(albero, '');

    const blocchi = [
        `# ${unaRiga(documento)} · ${modello.titolo} · ${unaRiga(nome)}`,
        `Data: ${data} · Libreria: ${libreria.nomeFile}${versione}`
    ];
    function scrivi(nodi: Capitolo[]): void {
        nodi.forEach((nodo) => {
            const numeroNodo = nodo.numero ?? '';
            const livelli = numeroNodo.split('.').length;
            const numero = livelli === 1 ? `${numeroNodo}.` : numeroNodo;
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
            senzaMetodo: requisiti.filter((r) => !String(r.voce.metodo ?? '').trim()).length,
            senzaPadre: requisiti.filter((r) => r.voce.notaSenzaPadre).length,
            nonUsati,
            esclusi
        }
    };
}

/* --- FINESTRA (AC-1, AC-2, AC-12, AC-13) --- */

let ultimiDati: DatiDocumenti | null = null;
let documentoScelto: string | null = null;
let ultimoTesto: string | null = null;

let daAggiornare = false;
let timerModello: ReturnType<typeof setTimeout> | null = null;
const RITARDO_MODELLO = 250;

function campo<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

function intestazione(): IntestazioneDocumento {
    const info = infoProgetto();
    return { nome: info.slug ? info.nome : pathStack[0]!.label, data: dataOggi(), libreria: infoLibreria() };
}

function mostraMessaggio(testo: string): void {
    const messaggio = campo('documentiMessaggio');
    messaggio.textContent = testo;
    messaggio.hidden = false;
    campo('documentiBarra').hidden = !ultimiDati;
    campo('documentiRiepilogo').hidden = true;
    campo('anteprimaDocumento').hidden = true;
    campo('revisioniDocumento').hidden = true;
    abilitaExport(false);
}

const PULSANTI_EXPORT = ['btnEsportaDocumento', 'btnEsportaWord', 'btnEsportaPdf'];
let exportInCorso = false;

function abilitaExport(attivi: boolean): void {
    PULSANTI_EXPORT.forEach((id) => { campo<HTMLButtonElement>(id).disabled = !attivi || exportInCorso; });
}

function aggiorna(): void {
    if (!ultimiDati || !documentoScelto) return;
    const riepilogo = campo('documentiRiepilogo');
    const anteprima = campo('anteprimaDocumento');
    const messaggio = campo('documentiMessaggio');
    const generato = generaDocumento(ultimiDati, documentoScelto, intestazione());
    const testo = generato.testo;
    ultimoTesto = testo;
    const r = generato.riepilogo;

    riepilogo.hidden = false;
    riepilogo.innerHTML = escapeHtml(`Requisiti: ${r.requisiti} (capacità ${r.capacita}, interfacce ${r.interfacce}) · Testi: ${r.testi} · `
        + `Senza metodo: ${r.senzaMetodo} · Senza padre: ${r.senzaPadre} · Non usati nel progetto: ${r.nonUsati} · Esclusi: ${r.esclusi}`);
    if (r.requisiti === 0) {
        messaggio.textContent = `Nessun requisito ha testi per ${documentoScelto}: il file avrà solo i capitoli.`;
        messaggio.hidden = false;
    } else {
        messaggio.hidden = true;
    }
    const limite = appSettings.documentiExport.anteprimaCaratteri;
    anteprima.hidden = false;
    anteprima.textContent = testo.length > limite
        ? `${testo.slice(0, limite)}\n… anteprima troncata: il file scaricato contiene tutto il documento`
        : testo;
    anteprima.scrollTop = 0;
    abilitaExport(true);
    aggiornaRevisioni();
}

/* --- REGISTRO DELLE REVISIONI (spec 0028, AC-6): nel progetto, una lista per documento --- */

// Dopo A viene B, dopo 3 viene 4; la prima è A; altrimenti vuota
export function revisioneSuccessiva(precedente: string | undefined): string {
    const p = (precedente ?? '').trim();
    if (!p) return 'A';
    if (/^\d+$/.test(p)) return String(Number(p) + 1);
    if (/^[A-Ya-y]$/.test(p)) return String.fromCharCode(p.charCodeAt(0) + 1);
    return '';
}

function revisioniDi(documento: string): RevisioneDocumento[] {
    return appState.revisioniDocumenti[documento] ?? [];
}

function aggiornaRevisioni(): void {
    const elenco = campo<HTMLDetailsElement>('revisioniDocumento');
    if (!documentoScelto) {
        elenco.hidden = true;
        return;
    }
    elenco.hidden = false;
    // Mentre scrivi in una riga la tabella non si ridisegna (il ricalcolo dopo render() toglierebbe il fuoco)
    if (elenco.contains(elenco.ownerDocument.activeElement)) return;
    const righe = revisioniDi(documentoScelto);
    campo('revisioniNomeDocumento').textContent = documentoScelto;
    campo('revisioniConteggio').textContent = String(righe.length);
    const campoRiga = (i: number, nome: keyof RevisioneDocumento, valore: string, etichetta: string): string =>
        `<td><input type="text" data-idx="${i}" data-campo="${nome}" value="${escapeHtml(valore)}" aria-label="${etichetta}"></td>`;
    campo('righeRevisioni').innerHTML = righe.map((r, i) => `<tr>${campoRiga(i, 'revisione', r.revisione, 'Revisione')}`
        + `${campoRiga(i, 'data', r.data, 'Data')}${campoRiga(i, 'descrizione', r.descrizione, 'Descrizione')}${campoRiga(i, 'autore', r.autore, 'Autore')}`
        + `<td><button data-togli="${i}" title="Togli la revisione" aria-label="Togli la revisione" class="pulsante-togli-revisione">✕</button></td></tr>`).join('');
}

// Ogni modifica passa da render(): salvataggio automatico, Annulla e Ripeti come il resto del modello
function modificaRevisioni(cambia: (righe: RevisioneDocumento[]) => void): void {
    if (!documentoScelto) return;
    const righe = [...revisioniDi(documentoScelto)];
    cambia(righe);
    if (righe.length) appState.revisioniDocumenti[documentoScelto] = righe;
    else delete appState.revisioniDocumenti[documentoScelto];
    render();
}

function nuovaRevisione(): void {
    modificaRevisioni((righe) => righe.push({
        revisione: revisioneSuccessiva(righe.at(-1)?.revisione),
        data: dataOggi(),
        descrizione: '',
        autore: appSettings.documentiExport.modello.autore
    }));
    campo<HTMLDetailsElement>('revisioniDocumento').open = true;
    (campo('revisioniDocumento').ownerDocument.activeElement as HTMLElement | null)?.blur();
    aggiornaRevisioni();
}

/* --- DIAGRAMMI DEL PROGETTO PER WORD E PDF (spec 0029, AC-3) --- */

// Quali figure esistono, e come prepararne SVG e PNG solo per le chiavi che il documento cita davvero
function diagrammiDelProgetto(): { opzioni: OpzioniDiagrammi; prepara: (markdown: string) => Promise<Record<string, ImmagineDiagramma>> } {
    const radice = pathStack[0]!.graph;
    const interni = interniDeiBlocchi(radice);
    const opzioni: OpzioniDiagrammi = { radice: radice.nodes.length > 0, blocchi: new Set(interni.keys()) };
    const prepara = async (markdown: string): Promise<Record<string, ImmagineDiagramma>> => {
        const chiavi = new Set([...markdown.matchAll(/\]\(diagramma:([^)\s]+)\)/g)].map((m) => m[1] ?? ''));
        const immagini: Record<string, ImmagineDiagramma> = {};
        for (const chiave of chiavi) {
            let diagramma = null;
            if (chiave === CHIAVE_RADICE) {
                diagramma = svgDiagramma(radice, null, appState.library, appState.cliente);
            } else {
                const nodo = interni.get(decodeURIComponent(chiave.slice('blocco:'.length)));
                if (nodo) diagramma = svgDiagramma(nodo.internal_graph, nodo, appState.library, appState.cliente);
            }
            if (diagramma) immagini[chiave] = { ...diagramma, png: await svgInPng(diagramma) };
        }
        return immagini;
    };
    return { opzioni, prepara };
}

/* --- WORD E PDF (spec 0028): il processo principale scrive il file dal Markdown --- */

async function esportaFormato(formato: 'docx' | 'pdf'): Promise<void> {
    if (!ultimiDati || !documentoScelto || exportInCorso) return;
    const desktop = window.desktop;
    if (!desktop?.documenti) {
        alert('Documento non esportato: Word e PDF si creano solo nella versione desktop.');
        return;
    }
    const documento = documentoScelto;
    const intest = intestazione();
    const pulsante = campo<HTMLButtonElement>(formato === 'docx' ? 'btnEsportaWord' : 'btnEsportaPdf');
    const etichetta = pulsante.textContent;
    exportInCorso = true;
    abilitaExport(false);
    pulsante.textContent = '…';
    const avviso = campo('documentiAvviso');
    avviso.hidden = true;
    try {
        const { opzioni, prepara } = diagrammiDelProgetto();
        const markdown = generaDocumento(ultimiDati, documento, intest, opzioni).testo;
        const immagini = await prepara(markdown);
        const versione = intest.libreria.versione ? ` v${intest.libreria.versione}` : '';
        const esito = await desktop.documenti.esporta({
            formato,
            markdown,
            intestazione: { documento, titolo: titoloDid(documento), progetto: intest.nome, data: intest.data, libreria: `${intest.libreria.nomeFile}${versione}` },
            modello: { ...appSettings.documentiExport.modello },
            revisioni: revisioniDi(documento).map((r) => ({ ...r })),
            immagini
        });
        if (!esito.ok) {
            alert(`Documento non esportato: ${esito.messaggio}`);
            return;
        }
        if (esito.avviso) {
            avviso.textContent = esito.avviso;
            avviso.hidden = false;
        }
        const tipo = formato === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
        scaricaFileTesto(esito.dati as Uint8Array<ArrayBuffer>, `${nomeBaseFile(documento)}.${formato}`, tipo);
    } catch (e) {
        alert(`Documento non esportato: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        exportInCorso = false;
        pulsante.textContent = etichetta;
        abilitaExport(!!ultimiDati);
    }
}

// Calcola indice e matrice una volta; cambiare documento rigenera solo il testo dalla stessa fotografia (AC-1).
// Rifatto anche dopo una modifica al modello, con lo stesso documento e lo stesso scorrimento (spec 0022)
function ricalcola(): void {
    daAggiornare = false;
    const anteprima = campo('anteprimaDocumento');
    const scorrimento = anteprima.scrollTop;
    ultimiDati = null;
    ultimoTesto = null;
    const indice = calcolaGerarchia(pathStack[0]!.graph, appState.library, appState.cliente);
    const matrice = calcolaMatrice(indice, appState.library, appState.cliente, pathStack[0]!.label);
    if (matrice.libreriaAssente) {
        mostraMessaggio(MSG_SENZA_LIBRERIA);
        return;
    }
    ultimiDati = preparaDatiDocumenti(matrice, appState.library);
    aggiornaElencoNonAmmessi();
    const voci = vociDocumento();
    const selettore = campo<HTMLSelectElement>('documentiScelta');
    selettore.innerHTML = voci.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    if (!voci.length) {
        mostraMessaggio(MSG_NESSUN_DOCUMENTO);
        return;
    }
    if (documentoScelto === null || !voci.includes(documentoScelto)) documentoScelto = voci[0] ?? null;
    selettore.value = documentoScelto ?? '';
    campo('documentiBarra').hidden = false;
    aggiorna();
    anteprima.scrollTop = scorrimento;
}

// Testi della libreria su documenti non ammessi (spec 0027, AC-11): elenco richiudibile sotto il riepilogo
function aggiornaElencoNonAmmessi(): void {
    const elenco = campo<HTMLDetailsElement>('elencoNonAmmessi');
    const righe = testiNonAmmessi(appState.library);
    elenco.hidden = !righe.length;
    campo('conteggioNonAmmessi').textContent = String(righe.length);
    campo('righeNonAmmessi').replaceChildren(...righe.map((t) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.dataset.blocco = t.blockId;
        link.textContent = `${t.reqId} · ${t.titoloBlocco} · ${t.documento} · ${t.motivo}`;
        li.appendChild(link);
        return li;
    }));
}

// Il calcolo lo fa allaVista, quando il pannello compare
export function apriDocumenti(): void {
    if (!pannelloAperto('documenti')) daAggiornare = true;
    mostraPannello('documenti');
}

// Chiamata da render(): ricalcola una volta dopo una raffica di modifiche, solo se il pannello si vede (AC-2)
export function segnaDocumentiDaAggiornare(): void {
    daAggiornare = true;
    if (!pannelloAperto('documenti')) return;
    if (timerModello !== null) clearTimeout(timerModello);
    timerModello = setTimeout(() => {
        timerModello = null;
        if (daAggiornare && pannelloVisibile('documenti')) ricalcola();
    }, RITARDO_MODELLO);
}

function allaChiusuraDocumenti(): void {
    ultimiDati = null;
    ultimoTesto = null;
    daAggiornare = false;
    campo('anteprimaDocumento').textContent = '';
}

// <progetto>-<documento>, senza estensione
function nomeBaseFile(documento: string): string {
    const info = infoProgetto();
    const nome: string = info.slug ? info.nome : pathStack[0]!.label;
    const slug = info.slug || slugifyId(nome) || 'documento';
    return `${slug}-${slugifyId(documento) || 'documento'}`;
}

function esporta(): void {
    if (!ultimiDati || ultimoTesto === null || !documentoScelto) return;
    scaricaFileTesto(ultimoTesto, `${nomeBaseFile(documentoScelto)}.md`, 'text/markdown;charset=utf-8');
}

/* --- INIZIALIZZAZIONE --- */

export function initDocumenti(): void {
    document.getElementById('btnDocumenti')?.addEventListener('click', apriDocumenti);
    allaVista('documenti', () => { if (daAggiornare || !ultimiDati) ricalcola(); });
    allaChiusura('documenti', allaChiusuraDocumenti);
    document.getElementById('btnEsportaDocumento')?.addEventListener('click', esporta);
    document.getElementById('btnEsportaWord')?.addEventListener('click', () => { void esportaFormato('docx'); });
    document.getElementById('btnEsportaPdf')?.addEventListener('click', () => { void esportaFormato('pdf'); });
    document.getElementById('btnNuovaRevisione')?.addEventListener('click', nuovaRevisione);
    const righeRevisioni = document.getElementById('righeRevisioni');
    righeRevisioni?.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        const idx = Number(input.dataset.idx);
        const nome = input.dataset.campo as keyof RevisioneDocumento | undefined;
        if (!nome || Number.isNaN(idx)) return;
        modificaRevisioni((righe) => {
            const riga = righe[idx];
            if (riga) righe[idx] = { ...riga, [nome]: input.value };
        });
    });
    righeRevisioni?.addEventListener('click', (e) => {
        const bottone = (e.target as Element).closest<HTMLElement>('[data-togli]');
        if (!bottone) return;
        const idx = Number(bottone.dataset.togli);
        modificaRevisioni((righe) => { righe.splice(idx, 1); });
        bottone.blur();
        aggiornaRevisioni();
    });
    // Sull'elemento, non su document: funziona anche a pannello staccato (spec 0023)
    document.getElementById('elencoNonAmmessi')?.addEventListener('click', (e) => {
        const link = (e.target as Element).closest<HTMLElement>('[data-blocco]');
        if (!link) return;
        e.preventDefault();
        openLibraryBlock(link.dataset.blocco ?? '');
        mostraPannello('ispettore');
    });
    document.getElementById('documentiScelta')?.addEventListener('change', (e) => {
        if (!ultimiDati) return;
        documentoScelto = (e.target as HTMLSelectElement).value;
        aggiorna();
    });
}
