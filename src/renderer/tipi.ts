/* --- TIPI DEL MODELLO DATI: LIBRERIA, GRAFO, PROGETTO, CLIENTE, IMPOSTAZIONI (spec 0020) --- */

/* --- Libreria --- */

export interface TestoExport {
    testo: string;
    documento: string;
}

// Con tipologia è un requisito di interfaccia (porta sul bordo); con tipologia null è di capacità
export interface RequisitoLibreria {
    id: string;
    titolo: string;
    tipologia: string | null;
    metodoVerifica: string;
    testiExport: TestoExport[];
}

export interface Blocco {
    id: string;
    titolo: string;
    descrizione: string;
    categoria: string;
    sottocategoria: string;
    requisiti: RequisitoLibreria[];
}

// Chiave = id del blocco
export type Libreria = Record<string, Blocco>;

/* --- Requisiti cliente (spec 0003) --- */

export interface RequisitoCliente {
    id: string;
    idCliente: string;
    testo: string;
    titolo: string | null;
    note: string | null;
    sezione: string | null;
    tipologia: string | null;
    stato: 'attivo' | 'ritirato';
    modificato: boolean;
    precedente: { testo: string; titolo: string | null; tipologia: string | null } | null;
}

export interface UltimoImport {
    data: string;
    nomeFile: string;
    foglio: string;
    rigaIntestazione: number;
    modalita: 'sostituisci' | 'aggiungi';
    colonne: Record<string, string | null>;
    // Filtro delle righe (spec 0030); assente nei progetti della 2.1.0
    filtro?: { colonna: { nome: string; lettera: string } | null; testo: string } | null;
    conteggi: Record<string, number>;
}

export interface Cliente {
    prefisso: string;
    requisiti: RequisitoCliente[];
    ultimoImport: UltimoImport | null;
}

// Un requisito che può stare sul padre di un livello: di libreria o cliente (alla radice)
export type Requisito = RequisitoLibreria | RequisitoCliente;

/* --- Grafo --- */

export interface Punto {
    x: number;
    y: number;
}

export type LatoPorta = 'top' | 'bottom' | 'left' | 'right';

export interface PosizionePorta {
    side: LatoPorta;
    ratio: number;
}

export type TipoEstremo = 'node' | 'parent';

export interface Filo {
    id: string;
    source: string;
    sourceHandle: string;
    sourceType: TipoEstremo;
    target: string;
    targetHandle: string;
    targetType: TipoEstremo;
    waypoints: Punto[];
}

export interface Nodo {
    id: string;
    // Id del blocco di libreria
    type: string;
    label: string;
    width: number;
    height: number;
    position: Punto;
    internal_graph: Grafo;
    pinPositions?: Record<string, PosizionePorta>;
}

export interface Grafo {
    nodes: Nodo[];
    edges: Filo[];
    // Centri dei blocchi tondi (requisiti del padre) dentro questo livello
    parentReqPositions?: Record<string, Punto>;
}

// Un livello aperto: la radice o l'interno di un nodo
export interface Livello {
    id: string;
    label: string;
    graph: Grafo;
    parentNode: Nodo | null;
}

/* --- Progetto (file progetti/<slug>.json, spec 0001) --- */

export interface FileProgetto {
    formatVersion: 1 | 2;
    nome: string;
    libraryPath: string;
    workspace: Grafo;
    cliente?: Cliente;
    // Registro delle revisioni di ogni documento esportato (spec 0028), chiave = documento
    revisioniDocumenti?: Record<string, RevisioneDocumento[]>;
}

/* --- Impostazioni (settings.json, fuse con i predefiniti) --- */

export interface Impostazioni {
    libraryPath: string;
    progetti: { debounceMs: number; versioni: number };
    libreria: { versioni: number };
    aggiornamenti: { controllo: boolean; repository: string };
    cliente: { prefisso: string; maxFileMB: number; righeAnteprima: number; righePannello: number };
    coerenza: { righePerGruppo: number };
    gerarchia: { righeAperte: number };
    matrice: { gruppiVisibili: number };
    documentiExport: { anteprimaCaratteri: number; modello: ModelloAziendale };
    grid: { size: number };
    node: { width: number; height: number; selectedBorderColor: string };
    parentBlock: { radius: number };
    requirements: { radius: number; capabilityColor: string; typeColors: Record<string, string> };
    metodiVerifica: string[];
    documenti: string[];
    // Documenti ammessi per classe del requisito (spec 0027)
    documentiPerClasse: DocumentiPerClasse;
}

export type ClasseDocumenti = 'interfaccia' | 'capacita';

export type DocumentiPerClasse = Record<ClasseDocumenti, string[]>;

/* --- Ponte con il processo principale (preload, spec 0016 e 0019) --- */

export interface CartelleDesktop {
    lavoro: string;
    librerie: string;
}

export interface StatoCartelleDesktop {
    cartelle: CartelleDesktop | null;
    proposta: CartelleDesktop;
    motivo: string | null;
    settings: string | null;
}

export type EsitoApplica =
    | { esito: 'ok' }
    | { esito: 'da-creare'; cartelle: string[] }
    | { esito: 'errore'; messaggio: string };

export interface Desktop {
    chiediTesto(messaggio: string, predefinito: string): string | null;
    rispondiTesto(valore: string | null): void;
    cartelle: {
        stato(): Promise<StatoCartelleDesktop>;
        scegli(titolo: string, iniziale: string): Promise<string | null>;
        applica(cartelle: { lavoro: string; librerie: string | null }, crea: boolean): Promise<EsitoApplica>;
        apri(percorso: string): Promise<string>;
        analizzaV1(cartella: string): Promise<{ nuovi: number; uguali: number; diversi: string[] } | { errore: string }>;
        importaV1(cartella: string, sovrascrivi: boolean): Promise<{ copiati: number; saltati: number } | { errore: string }>;
    };
    documenti: {
        esporta(richiesta: RichiestaExport): Promise<EsitoExport>;
    };
}

/* --- Export Word e PDF (spec 0028) e diagrammi (spec 0029) --- */

export interface RevisioneDocumento {
    revisione: string;
    data: string;
    descrizione: string;
    autore: string;
}

export interface ModelloAziendale {
    azienda: string;
    logo: string;
    classificazione: string;
    piePagina: string;
    autore: string;
}

export interface ImmagineDiagramma {
    svg: string;
    png: Uint8Array;
    larghezza: number;
    altezza: number;
}

export interface RichiestaExport {
    formato: 'docx' | 'pdf';
    markdown: string;
    intestazione: { documento: string; titolo: string; progetto: string; data: string; libreria: string };
    modello: ModelloAziendale;
    revisioni: RevisioneDocumento[];
    immagini: Record<string, ImmagineDiagramma>;
}

export type EsitoExport = { ok: true; dati: Uint8Array; avviso: string | null } | { ok: false; messaggio: string };

declare global {
    interface Window {
        // Solo nell'app desktop (preload); nel browser della 1.x manca
        desktop?: Desktop;
    }
}

/* --- Estremo di un filo del livello di adesso, descritto dal renderer per l'ispettore (spec 0009) --- */

interface BaseEstremo {
    ownerId: string;
    reqId: string;
    ownerType: TipoEstremo;
}

export type EstremoDescritto = BaseEstremo & (
    | { mancante: true }
    // Blocco tondo: requisito del padre del livello (cliente alla radice)
    | { mancante?: false; req: Requisito; tondo: true; cliente: boolean; parentNode: Nodo | null }
    // Pin di un nodo del livello
    | { mancante?: false; req: RequisitoLibreria; tondo: false; cliente: false; nodo: Nodo; def: Blocco }
);
