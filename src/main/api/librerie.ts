/* --- LIBRERIE SU DISCO: APERTURA, SALVATAGGIO, ELIMINA, RINOMINA, CHANGELOG (spec 0002, 0010, 0018) --- */
// Porta fedele di ArchivioLibrerie di start.py
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { avanzaVersione, confrontaBlocco, confrontaLibrerie, livelloDi, livelloMaggiore, ORDINE_LIVELLI, requisitiDi, titoloDi, type Livello, type Modifica } from './confronto.js';
import { ErroreApi } from './errori.js';
import {
    decodificaUtf8, eFile, eOggetto, formaCanonica, improntaDi, interpretaJson, leggiBytes, pulisciTemporanei, ruotaCopie,
    scriviAtomico, serializza, valoriUguali
} from './file.js';

type Oggetto = Record<string, unknown>;

const FORMATO_LIBRERIA = 1;
const FORMATO_SEMVER = /^\d+\.\d+\.\d+$/;
const LUNGHEZZA_MAX_NOTA = 2000;
const LUNGHEZZA_MAX_ID_BLOCCO = 200;
const FORMATO_ID_BLOCCO = /^[A-Za-z0-9_.-]+$/;
const SUFFISSO_CHANGELOG = '.changelog.json';
const MSG_CHANGELOG_ILLEGGIBILE = 'Il changelog non è leggibile: correggilo o spostalo per poter salvare';
const MSG_FORMATO_FUTURO = "Libreria creata da una versione più recente dell'app: aperta in sola lettura";
const MSG_SOLO_SHARED = "L'app scrive solo librerie dentro shared/ (escluse le cartelle _versioni).";

// Libreria creata all'avvio se manca (stesso testo di ensure_shared_library in start.py)
const LIBRERIA_DI_ESEMPIO = `{
  "centralina_condivisa": {
    "id": "centralina_condivisa",
    "titolo": "Centralina Condivisa",
    "descrizione": "Blocco di esempio creato all'avvio",
    "categoria": "Elettrica",
    "sottocategoria": "Controllo",
    "requisiti": [
      {
        "id": "cen_condivisa_001",
        "titolo": "Alimentazione 24V",
        "tipologia": "Elettrica",
        "metodoVerifica": "Test",
        "testiExport": [
          { "testo": "La centralina deve essere alimentata a 24V", "documento": "IRS" }
        ]
      }
    ]
  }
}`;

export interface Voce {
    versione: string;
    data: string;
    autore: string;
    origine: 'iniziale' | 'esterna' | 'app';
    livello: Livello | null;
    livelloCalcolato: Livello | null;
    nota: string;
    impronta: string;
    improntaContenuto: string;
    modifiche: Modifica[];
}

interface Changelog {
    formatVersion: 1;
    voci: Voce[];
}

// Lunghezza in punti di codice, come len() di Python
const lunghezza = (testo: string): number => Array.from(testo).length;

function semverValido(valore: unknown): valore is string {
    return typeof valore === 'string' && FORMATO_SEMVER.test(valore);
}

function formatoDi(oggetto: Oggetto): number {
    const v = oggetto.formatVersion;
    return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0;
}

// Formato 1 e { library }: la mappa dei blocchi è in library; il formato vecchio è la mappa stessa
export function contenutoDi(oggetto: Oggetto): Oggetto {
    for (const chiave of ['library', 'libreria']) {
        const valore = oggetto[chiave];
        if (eOggetto(valore)) return valore;
    }
    return oggetto;
}

function autoreCorrente(): string {
    try {
        return os.userInfo().username || 'sconosciuto';
    } catch {
        return 'sconosciuto';
    }
}

// datetime.now().astimezone().isoformat(timespec='seconds'): 2026-10-05T10:11:12+02:00
export function dataLocaleIso(d = new Date()): string {
    const due = (n: number) => String(Math.abs(n)).padStart(2, '0');
    const scarto = -d.getTimezoneOffset();
    const segno = scarto >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}:${due(d.getSeconds())}`
        + `${segno}${due(Math.trunc(scarto / 60))}:${due(scarto % 60)}`;
}

function nuovaVoce(origine: Voce['origine'], versione: string, livello: Livello | null, livelloCalcolato: Livello | null,
    nota: string, dati: Buffer, library: Oggetto, modifiche: Modifica[]): Voce {
    return {
        versione, data: dataLocaleIso(), autore: autoreCorrente(), origine, livello, livelloCalcolato, nota,
        impronta: improntaDi(dati), improntaContenuto: improntaDi(formaCanonica(library)), modifiche
    };
}

function controllaBlocco(blocco: unknown): asserts blocco is Oggetto & { id: string; requisiti: Array<Oggetto & { id: string }> } {
    const rifiuta = (messaggio: string): never => { throw new ErroreApi(400, 'blocco_non_valido', messaggio); };
    if (!eOggetto(blocco)) rifiuta('Il blocco deve essere un oggetto.');
    const b = blocco as Oggetto;
    const id = b.id;
    if (typeof id !== 'string' || !id.trim() || lunghezza(id) > LUNGHEZZA_MAX_ID_BLOCCO) {
        rifiuta(`L'ID del blocco deve essere un testo non vuoto di al massimo ${LUNGHEZZA_MAX_ID_BLOCCO} caratteri.`);
    }
    if (typeof b.titolo !== 'string' || !b.titolo.trim()) rifiuta('Il titolo del blocco non può essere vuoto.');
    if (!Array.isArray(b.requisiti)) rifiuta('I requisiti del blocco devono essere un elenco.');
    const visti = new Set<string>();
    for (const req of b.requisiti as unknown[]) {
        if (!eOggetto(req) || typeof req.id !== 'string' || !req.id.trim()) rifiuta('Ogni requisito deve essere un oggetto con un ID non vuoto.');
        const idReq = (req as Oggetto).id as string;
        if (visti.has(idReq)) rifiuta(`L'ID "${idReq}" è usato due volte in questo blocco.`);
        visti.add(idReq);
    }
}

// os.path.normcase su Windows: minuscole e barre rovesciate
function normcase(p: string): string {
    return process.platform === 'win32' ? p.replace(/\//g, '\\').toLowerCase() : p;
}

function dentro(percorso: string, cartella: string): boolean {
    return normcase(percorso).startsWith(normcase(cartella) + path.sep);
}

// os.path.realpath non rigoroso: risolve la parte che esiste e aggiunge il resto
function percorsoReale(p: string): string {
    const assoluto = path.resolve(p);
    let esistente = assoluto;
    const resto: string[] = [];
    while (!fs.existsSync(esistente)) {
        const genitore = path.dirname(esistente);
        if (genitore === esistente) return assoluto;
        resto.unshift(path.basename(esistente));
        esistente = genitore;
    }
    try {
        return path.join(fs.realpathSync.native(esistente), ...resto);
    } catch {
        return assoluto;
    }
}

class FileLibreria {
    readonly nome: string;
    readonly changelog: string;
    readonly cartellaVersioni: string;
    readonly riferimento: string;

    constructor(readonly percorso: string, readonly scrivibile: boolean) {
        const cartella = path.dirname(percorso);
        this.nome = path.basename(percorso).slice(0, -5);
        this.changelog = path.join(cartella, this.nome + SUFFISSO_CHANGELOG);
        this.cartellaVersioni = path.join(cartella, '_versioni');
        this.riferimento = path.join(this.cartellaVersioni, `${this.nome}.riferimento.json`);
    }
}

export class ArchivioLibrerie {
    private readonly base: string;
    private readonly cartellaShared: string;
    private readonly cartellaProgetti: string;

    // Il prefisso shared/ dei percorsi punta alla cartella delle librerie (spec 0019), che può stare altrove
    constructor(cartellaLavoro: string, cartellaLibrerie: string, private readonly maxVersioni: number) {
        this.base = percorsoReale(cartellaLavoro);
        this.cartellaShared = percorsoReale(cartellaLibrerie);
        this.cartellaProgetti = path.join(this.base, 'progetti');
    }

    // Crea shared/ e una libreria di esempio se mancano; toglie i .tmp di scritture interrotte
    prepara(): void {
        fs.mkdirSync(this.cartellaShared, { recursive: true });
        const libreria = path.join(this.cartellaShared, 'libreria.json');
        if (!fs.existsSync(libreria)) fs.writeFileSync(libreria, LIBRERIA_DI_ESEMPIO, 'utf-8');
        pulisciTemporanei(this.cartellaShared, true);
    }

    private risolvi(percorso: unknown): FileLibreria {
        const nonValido = new ErroreApi(400, 'percorso_non_valido',
            "Percorso della libreria non valido: serve un file .json relativo alla cartella dell'app, fuori da progetti/.");
        if (typeof percorso !== 'string' || !percorso || percorso.includes('\\') || percorso.includes(':') || percorso.startsWith('/')) throw nonValido;
        const segmenti = percorso.split('/');
        const minuscolo = percorso.toLowerCase();
        if (segmenti.some((s) => s === '' || s === '.' || s === '..') || !minuscolo.endsWith('.json') || minuscolo.endsWith(SUFFISSO_CHANGELOG)) {
            throw nonValido;
        }
        // shared/...: nella cartella delle librerie, l'unica scrivibile (escluse le _versioni)
        if (normcase(segmenti[0] ?? '') === 'shared' && segmenti.length > 1) {
            const reale = percorsoReale(path.join(this.cartellaShared, ...segmenti.slice(1)));
            if (!dentro(reale, this.cartellaShared)) throw nonValido;
            const cartelleIntermedie = path.relative(this.cartellaShared, reale).split(path.sep).slice(0, -1).map(normcase);
            return new FileLibreria(reale, !cartelleIntermedie.includes('_versioni'));
        }
        // Altri percorsi: dalla cartella di lavoro, in sola lettura, mai da progetti/
        const reale = percorsoReale(path.join(this.base, ...segmenti));
        if (!dentro(reale, this.base) || dentro(reale, this.cartellaProgetti)) throw nonValido;
        return new FileLibreria(reale, false);
    }

    /* --- Lettura --- */

    private leggiLibreria(f: FileLibreria, percorso: string): { dati: Buffer; oggetto: Oggetto; formato: number } {
        if (!eFile(f.percorso)) throw new ErroreApi(404, 'non_trovata', `La libreria "${percorso}" non esiste.`);
        const dati = leggiBytes(f.percorso);
        const oggetto = interpretaJson(dati, `Il file della libreria "${percorso}" non è JSON valido.`);
        const formato = formatoDi(oggetto);
        if (formato === FORMATO_LIBRERIA && !eOggetto(oggetto.library)) {
            throw new ErroreApi(422, 'json_non_valido', `Il file della libreria "${percorso}" non contiene la mappa "library".`);
        }
        return { dati, oggetto, formato };
    }

    // null se il file manca; 422 se esiste ma non ha la forma attesa
    private leggiChangelog(f: FileLibreria): Changelog | null {
        if (!eFile(f.changelog)) return null;
        const nonValido = new ErroreApi(422, 'changelog_non_valido', MSG_CHANGELOG_ILLEGGIBILE);
        let dati: unknown;
        try {
            dati = JSON.parse(decodificaUtf8(leggiBytes(f.changelog)));
        } catch (e) {
            if (e instanceof ErroreApi) throw e;
            throw nonValido;
        }
        const voci = eOggetto(dati) ? dati.voci : null;
        if (!eOggetto(dati) || dati.formatVersion !== 1 || !Array.isArray(voci) || !voci.every(eOggetto)) throw nonValido;
        const ultima = voci.at(-1) as Oggetto | undefined;
        if (ultima && !(semverValido(ultima.versione) && typeof ultima.improntaContenuto === 'string')) throw nonValido;
        return dati as unknown as Changelog;
    }

    private leggiRiferimento(f: FileLibreria): Oggetto | null {
        try {
            const oggetto: unknown = JSON.parse(decodificaUtf8(leggiBytes(f.riferimento)));
            return eOggetto(oggetto) ? contenutoDi(oggetto) : null;
        } catch {
            return null;
        }
    }

    /* --- Scrittura --- */

    // Il changelog cresce solo in fondo; restituisce il changelog nuovo solo se è su disco
    private aggiungiVoce(f: FileLibreria, changelog: Changelog | null, voce: Voce): Changelog {
        const nuovo: Changelog = { formatVersion: 1, voci: [...(changelog?.voci ?? []), voce] };
        scriviAtomico(f.changelog, serializza(nuovo));
        return nuovo;
    }

    private aggiornaRiferimento(f: FileLibreria, dati: Buffer): void {
        fs.mkdirSync(f.cartellaVersioni, { recursive: true });
        scriviAtomico(f.riferimento, dati);
    }

    // La versione precedente passa in _versioni/<nome>.1.json prima di sostituire il file
    private scriviLibreria(f: FileLibreria, attuali: Buffer, nuovi: Buffer): void {
        fs.mkdirSync(f.cartellaVersioni, { recursive: true });
        ruotaCopie(f.cartellaVersioni, f.nome, attuali, this.maxVersioni);
        scriviAtomico(f.percorso, nuovi);
    }

    // Voce iniziale se il changelog manca, voce esterna se il contenuto non è quello dell'ultima voce
    private allinea(f: FileLibreria, oggetto: Oggetto, dati: Buffer, contenuto: Oggetto, changelog: Changelog | null): { changelog: Changelog; voci: Voce[] } {
        const voci = changelog?.voci ?? [];
        const ultima = voci.at(-1);
        let voce: Voce;
        if (!ultima) {
            const versione = semverValido(oggetto.versione) ? oggetto.versione : '1.0.0';
            voce = nuovaVoce('iniziale', versione, null, null, '', dati, contenuto, []);
        } else if (improntaDi(formaCanonica(contenuto)) !== ultima.improntaContenuto) {
            const riferimento = this.leggiRiferimento(f);
            let modifiche: Modifica[] = [];
            let livello: Livello = 'patch';
            let nota = 'Contenuto precedente non disponibile';
            if (riferimento !== null) {
                modifiche = confrontaLibrerie(riferimento, contenuto);
                livello = livelloDi(modifiche);
                nota = "Modifica fatta fuori dall'app";
            }
            voce = nuovaVoce('esterna', avanzaVersione(ultima.versione, livello), livello, livello, nota, dati, contenuto, modifiche);
        } else {
            return { changelog: changelog as Changelog, voci: [] };
        }
        const nuovo = this.aggiungiVoce(f, changelog, voce);
        this.aggiornaRiferimento(f, dati);
        return { changelog: nuovo, voci: [voce] };
    }

    /* --- API --- */

    apri(percorso: unknown): Oggetto {
        const f = this.risolvi(percorso);
        const { dati, oggetto, formato } = this.leggiLibreria(f, percorso as string);
        const versioneFile = semverValido(oggetto.versione) ? oggetto.versione : null;
        const risposta: Oggetto = { libreria: oggetto, impronta: improntaDi(dati), scrivibile: f.scrivibile, formato, vociAggiunte: [] };
        let changelog: Changelog | null;
        try {
            changelog = this.leggiChangelog(f);
        } catch (e) {
            if (!(e instanceof ErroreApi)) throw e;
            return { ...risposta, scrivibile: false, avviso: e.message, versione: versioneFile };
        }
        if (formato > FORMATO_LIBRERIA) {
            risposta.scrivibile = false;
            risposta.avviso = MSG_FORMATO_FUTURO;
        } else if (f.scrivibile) {
            // Aprire non modifica mai il file della libreria: si scrivono solo changelog e riferimento
            try {
                const esito = this.allinea(f, oggetto, dati, contenutoDi(oggetto), changelog);
                changelog = esito.changelog;
                risposta.vociAggiunte = esito.voci;
            } catch (e) {
                if (!(e instanceof ErroreApi)) throw e;
                risposta.avviso = `Il changelog non è stato aggiornato: ${e.message}`;
            }
        }
        const voci = changelog?.voci ?? [];
        risposta.versione = voci.at(-1)?.versione ?? versioneFile ?? (risposta.scrivibile ? '1.0.0' : null);
        return risposta;
    }

    salva(corpo: Oggetto): Oggetto {
        const percorso = corpo.percorso;
        const f = this.risolvi(percorso);
        if (!f.scrivibile) throw new ErroreApi(403, 'percorso_non_scrivibile', MSG_SOLO_SHARED);
        const blocco = corpo.blocco;
        controllaBlocco(blocco);
        const nuovo = corpo.nuovo;
        if (typeof nuovo !== 'boolean') throw new ErroreApi(400, 'richiesta_non_valida', 'Il campo "nuovo" deve essere vero o falso.');
        const rinomine = (corpo.rinomine || {}) as unknown;
        if (!eOggetto(rinomine) || !Object.values(rinomine).every((v) => typeof v === 'string')) {
            throw new ErroreApi(400, 'rinomine_non_valide', 'Le rinomine dei requisiti non sono valide.');
        }
        const livello = this.livello(corpo.livello);
        const nota = this.nota(corpo.nota);
        const forza = corpo.forza === true;

        const { dati, oggetto, formato } = this.leggiLibreria(f, percorso as string);
        if (formato > FORMATO_LIBRERIA) throw new ErroreApi(403, 'percorso_non_scrivibile', MSG_FORMATO_FUTURO);
        const contenuto = contenutoDi(oggetto);
        let changelog = this.leggiChangelog(f);
        const idBlocco = blocco.id;
        if (nuovo && Object.hasOwn(contenuto, idBlocco)) throw new ErroreApi(409, 'esiste', `Un blocco con ID "${idBlocco}" esiste già nella libreria su disco.`);
        const improntaAttuale = improntaDi(dati);
        const coincide = corpo.improntaAttesa === improntaAttuale;
        if (!coincide && !forza) {
            throw new ErroreApi(409, 'conflitto', "Il file della libreria è cambiato sul disco dopo che l'app l'ha letto.", { impronta: improntaAttuale });
        }

        // Formato vecchio: la libreria già normalizzata dal client, valida solo se rappresenta proprio questo file
        let prima = contenuto;
        if (formato === 0 && coincide) {
            if (!eOggetto(corpo.base)) throw new ErroreApi(400, 'base_mancante', 'Per convertire una libreria in formato vecchio serve la libreria normalizzata.');
            prima = corpo.base;
        }
        const bloccoPrima = prima[idBlocco];
        const idsPrima = new Set(requisitiDi(bloccoPrima).map((r) => r.id));
        const idsNuovi = new Set(blocco.requisiti.map((r) => r.id));
        const chiavi = Object.keys(rinomine);
        const valori = Object.values(rinomine) as string[];
        if ((nuovo && chiavi.length > 0) || !chiavi.every((k) => idsPrima.has(k)) || !valori.every((v) => idsNuovi.has(v)) || new Set(valori).size !== chiavi.length) {
            throw new ErroreApi(400, 'rinomine_non_valide', 'Le rinomine dei requisiti non corrispondono al blocco su disco: ricarica la libreria.');
        }
        for (const [altroId, altro] of Object.entries(prima)) {
            if (altroId === idBlocco) continue;
            for (const req of requisitiDi(altro)) {
                if (idsNuovi.has(req.id)) {
                    throw new ErroreApi(400, 'id_duplicato', `L'ID "${req.id}" è già usato dal blocco "${titoloDi(altro, altroId)}" nella libreria su disco.`);
                }
            }
        }

        // Da qui in poi si scrive: prima le voci iniziale o esterna, poi la modifica
        const allineata = this.allinea(f, oggetto, dati, contenuto, changelog);
        changelog = allineata.changelog;
        const versioneCorrente = changelog.voci.at(-1)?.versione ?? '1.0.0';
        const libraryNuova: Oggetto = { ...prima, [idBlocco]: blocco };
        const modifica = confrontaBlocco(idBlocco, bloccoPrima, blocco, rinomine as Record<string, string>);

        if (modifica === null) {
            // La conversione dal formato vecchio non è una modifica: si fa solo se non cambia il contenuto,
            // altrimenti la prossima apertura la registrerebbe come modifica esterna (resta per il prossimo Salva)
            if (formato === 0 && coincide && valoriUguali(prima, contenuto)) {
                const oggettoNuovo = { formatVersion: FORMATO_LIBRERIA, versione: versioneCorrente, library: prima };
                const nuovi = serializza(oggettoNuovo);
                this.scriviLibreria(f, dati, nuovi);
                try { this.aggiornaRiferimento(f, nuovi); } catch (e) { if (!(e instanceof ErroreApi)) throw e; }
                return { invariata: true, versione: versioneCorrente, impronta: improntaDi(nuovi), libreria: oggettoNuovo, formato: FORMATO_LIBRERIA, vociAggiunte: allineata.voci };
            }
            return { invariata: true, versione: versioneCorrente, impronta: improntaAttuale, libreria: oggetto, formato, vociAggiunte: allineata.voci };
        }
        return this.applica(f, dati, changelog, allineata.voci, libraryNuova, modifica, livello, nota);
    }

    // Scrittura comune a salva, elimina e rinomina: versione, file, voce di changelog e riferimento
    private applica(f: FileLibreria, dati: Buffer, changelog: Changelog, vociAggiunte: Voce[], libraryNuova: Oggetto,
        modifica: Modifica, livello: Livello | 'auto', nota: string): Oggetto {
        const versioneCorrente = changelog.voci.at(-1)?.versione ?? '1.0.0';
        const calcolato = livelloDi([modifica]);
        const effettivo = livello === 'auto' ? calcolato : livelloMaggiore(livello, calcolato);
        const versioneNuova = avanzaVersione(versioneCorrente, effettivo);
        const oggettoNuovo = { formatVersion: FORMATO_LIBRERIA, versione: versioneNuova, library: libraryNuova };
        const nuovi = serializza(oggettoNuovo);
        this.scriviLibreria(f, dati, nuovi);
        const risposta: Oggetto = { libreria: oggettoNuovo, impronta: improntaDi(nuovi), formato: FORMATO_LIBRERIA, vociAggiunte };
        const voce = nuovaVoce('app', versioneNuova, effettivo, calcolato, nota, nuovi, libraryNuova, [modifica]);
        try {
            this.aggiungiVoce(f, changelog, voce);
        } catch (e) {
            if (!(e instanceof ErroreApi)) throw e;
            // Alla prossima apertura il contenuto non coincide con l'ultima voce: diventa una voce esterna
            return { ...risposta, versione: versioneCorrente, voce: null,
                avviso: 'La libreria è salvata ma il changelog non è stato aggiornato: la modifica verrà registrata come modifica esterna' };
        }
        try {
            this.aggiornaRiferimento(f, nuovi);
        } catch (e) {
            if (!(e instanceof ErroreApi)) throw e;
            risposta.avviso = 'La copia di riferimento in _versioni/ non è stata aggiornata: una futura modifica esterna potrebbe risultare incompleta nel changelog';
        }
        return { ...risposta, versione: versioneNuova, voce };
    }

    private livello(valore: unknown): Livello | 'auto' {
        if (valore !== 'auto' && !(typeof valore === 'string' && Object.hasOwn(ORDINE_LIVELLI, valore))) {
            throw new ErroreApi(400, 'livello_non_valido', 'Il livello deve essere auto, patch, minor o major.');
        }
        return valore as Livello | 'auto';
    }

    private nota(valore: unknown): string {
        const nota = valore || '';
        if (typeof nota !== 'string' || lunghezza(nota) > LUNGHEZZA_MAX_NOTA) {
            throw new ErroreApi(400, 'richiesta_non_valida', `Il motivo della modifica supera i ${LUNGHEZZA_MAX_NOTA} caratteri.`);
        }
        return nota.trim();
    }

    /* --- Eliminazione e rinomina di un blocco (spec 0010) --- */

    private preparaOperazione(corpo: Oggetto) {
        const percorso = corpo.percorso;
        const f = this.risolvi(percorso);
        if (!f.scrivibile) throw new ErroreApi(403, 'percorso_non_scrivibile', MSG_SOLO_SHARED);
        const livello = this.livello(corpo.livello);
        const nota = this.nota(corpo.nota);
        const idBlocco = corpo.idBlocco;
        if (typeof idBlocco !== 'string' || !idBlocco) throw new ErroreApi(400, 'richiesta_non_valida', "Manca l'ID del blocco.");
        const { dati, oggetto, formato } = this.leggiLibreria(f, percorso as string);
        if (formato > FORMATO_LIBRERIA) throw new ErroreApi(403, 'percorso_non_scrivibile', MSG_FORMATO_FUTURO);
        if (formato === 0) throw new ErroreApi(409, 'formato_vecchio', 'Salva prima una modifica di un blocco: converte la libreria al formato nuovo.');
        const contenuto = contenutoDi(oggetto);
        const changelog = this.leggiChangelog(f);
        const improntaAttuale = improntaDi(dati);
        if (corpo.improntaAttesa !== improntaAttuale && corpo.forza !== true) {
            throw new ErroreApi(409, 'conflitto', "Il file della libreria è cambiato sul disco dopo che l'app l'ha letto.", { impronta: improntaAttuale });
        }
        if (!Object.hasOwn(contenuto, idBlocco)) throw new ErroreApi(404, 'non_trovato', `Il blocco "${idBlocco}" non è nella libreria su disco.`);
        return { f, dati, oggetto, contenuto, changelog, idBlocco, livello, nota };
    }

    elimina(corpo: Oggetto): Oggetto {
        const op = this.preparaOperazione(corpo);
        const { changelog, voci } = this.allinea(op.f, op.oggetto, op.dati, op.contenuto, op.changelog);
        const libraryNuova = Object.fromEntries(Object.entries(op.contenuto).filter(([k]) => k !== op.idBlocco));
        const modifica = confrontaBlocco(op.idBlocco, op.contenuto[op.idBlocco], null) as Modifica;
        return this.applica(op.f, op.dati, changelog, voci, libraryNuova, modifica, op.livello, op.nota);
    }

    rinominaBlocco(corpo: Oggetto): Oggetto {
        const nuovoId = corpo.nuovoId;
        if (typeof nuovoId !== 'string' || !FORMATO_ID_BLOCCO.test(nuovoId) || lunghezza(nuovoId) > LUNGHEZZA_MAX_ID_BLOCCO) {
            throw new ErroreApi(400, 'id_non_valido', "L'ID può contenere solo lettere, cifre, underscore, trattino e punto "
                + `(al massimo ${LUNGHEZZA_MAX_ID_BLOCCO} caratteri).`);
        }
        const op = this.preparaOperazione(corpo);
        if (nuovoId === op.idBlocco) throw new ErroreApi(400, 'id_uguale', 'Il nuovo ID è uguale a quello di adesso.');
        if (Object.keys(op.contenuto).some((k) => k !== op.idBlocco && k.toLowerCase() === nuovoId.toLowerCase())) {
            throw new ErroreApi(409, 'esiste', `Un blocco con ID "${nuovoId}" esiste già nella libreria.`);
        }
        const { changelog, voci } = this.allinea(op.f, op.oggetto, op.dati, op.contenuto, op.changelog);
        const blocco = { ...(op.contenuto[op.idBlocco] as Oggetto), id: nuovoId };
        // Stesso posto nell'ordine del file
        const libraryNuova = Object.fromEntries(Object.entries(op.contenuto).map(([k, v]) => (k === op.idBlocco ? [nuovoId, blocco] : [k, v])));
        const modifica: Modifica = {
            blocco: nuovoId, idPrecedente: op.idBlocco, titolo: titoloDi(blocco, nuovoId), tipo: 'rinominato', campiBlocco: ['id'], requisiti: []
        };
        return this.applica(op.f, op.dati, changelog, voci, libraryNuova, modifica, op.livello, op.nota);
    }

    leggiVoci(percorso: unknown): Oggetto {
        const f = this.risolvi(percorso);
        const changelog = this.leggiChangelog(f);
        const voci = changelog?.voci ?? [];
        return { versione: voci.at(-1)?.versione ?? null, voci };
    }
}
