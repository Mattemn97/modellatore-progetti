/* --- FILE DEL CLIENTE: .xlsx/.xlsm E .csv LETTI IN MEMORIA, SENZA TOCCARE IL DISCO (spec 0003, 0018) --- */
// Porta fedele di leggi_file_cliente, LettoreXlsx e leggi_csv di start.py
import path from 'node:path';
import { decodificaCsv, leggiRigheCsv, scegliSeparatore } from './csv.js';
import { ErroreApi } from './errori.js';
import { ArchivioZip, ErroreZip, ZipTroppoGrande } from './zip.js';
import { analizzaXml, attributo, ErroreXml, locale, tutti, type Elemento } from './xml.js';

const MAX_DECOMPRESSO = 200 * 1024 * 1024;
const FIRMA_OLE = Buffer.from('d0cf11e0', 'hex');
const ESTENSIONI_XLSX = ['.xlsx', '.xlsm'];
const MSG_FORMATO_CLIENTE = 'Salva il file come .xlsx senza password e riprova.';
const MSG_FILE_ILLEGGIBILE = 'Il file non è leggibile: è danneggiato o non è un file Excel o CSV valido.';

export interface Foglio {
    nome: string;
    nascosto: boolean;
    righe: string[][];
}

const illeggibile = () => new ErroreApi(422, 'file_illeggibile', MSG_FILE_ILLEGGIBILE);

function togliRigheVuoteFinali(righe: string[][]): string[][] {
    while (righe.length > 0 && !(righe.at(-1) as string[]).some((c) => c !== '')) righe.pop();
    return righe;
}

/* --- Numeri come float() e repr() di Python --- */

const NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const SPECIALE = /^([+-]?)(inf|infinity|nan)$/i;

function floatPython(testo: string): number | null {
    const t = testo.trim();
    if (NUMERO.test(t)) return Number(t);
    const s = SPECIALE.exec(t);
    if (!s) return null;
    if (s[2]?.toLowerCase() === 'nan') return Number.NaN;
    return s[1] === '-' ? -Infinity : Infinity;
}

// repr(float) di Python: cifre più corte, notazione esponenziale sotto 1e-4 o da 1e16 in su
function reprPython(n: number): string {
    if (Number.isNaN(n)) return 'nan';
    if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf';
    const [mantissa = '0', esp = '0'] = n.toExponential().split('e');
    const esponente = Number.parseInt(esp, 10);
    const segno = mantissa.startsWith('-') ? '-' : '';
    const cifre = mantissa.replace('-', '').replace('.', '');
    if (esponente < -4 || esponente >= 16) {
        const corpo = cifre.length > 1 ? `${cifre[0]}.${cifre.slice(1)}` : `${cifre}`;
        const segnoEsp = esponente < 0 ? '-' : '+';
        return `${segno}${corpo}e${segnoEsp}${String(Math.abs(esponente)).padStart(2, '0')}`;
    }
    if (esponente < 0) return `${segno}0.${'0'.repeat(-esponente - 1)}${cifre}`;
    const intera = cifre.slice(0, esponente + 1).padEnd(esponente + 1, '0');
    const decimali = cifre.slice(esponente + 1);
    return `${segno}${intera}.${decimali || '0'}`;
}

function interoPython(n: number): string {
    return Math.abs(n) < 1e21 ? String(n === 0 ? 0 : n) : BigInt(n).toString();
}

/* --- .xlsx --- */

class LettoreXlsx {
    private readonly zip: ArchivioZip;
    private letti = 0;

    constructor(dati: Buffer) {
        try {
            this.zip = new ArchivioZip(dati);
        } catch {
            throw illeggibile();
        }
    }

    // Legge una parte rispettando il limite complessivo dei byte decompressi (zip bomba)
    private parte(nome: string, obbligatoria = true): Buffer | null {
        if (!this.zip.ha(nome)) {
            if (obbligatoria) throw illeggibile();
            return null;
        }
        const rimasti = MAX_DECOMPRESSO - this.letti;
        let dati: Buffer;
        try {
            dati = this.zip.leggi(nome, rimasti);
        } catch (e) {
            if (e instanceof ZipTroppoGrande) throw new ErroreApi(413, 'troppo_grande', 'Il file decompresso supera il limite di 200 MB.');
            if (e instanceof ErroreZip) throw illeggibile();
            throw e;
        }
        if (dati.length > rimasti) throw new ErroreApi(413, 'troppo_grande', 'Il file decompresso supera il limite di 200 MB.');
        this.letti += dati.length;
        return dati;
    }

    private xml(nome: string, obbligatoria = true): Elemento | null {
        const dati = this.parte(nome, obbligatoria);
        if (dati === null) return null;
        // Niente DOCTYPE: nessuna entità definita dal file
        if (/<!DOCTYPE/i.test(dati.toString('latin1'))) throw illeggibile();
        try {
            return analizzaXml(new TextDecoder('utf-8', { fatal: true }).decode(dati));
        } catch (e) {
            if (e instanceof ErroreXml || e instanceof TypeError) throw illeggibile();
            throw e;
        }
    }

    // Testo di <si> o <is>: <t> diretto più i <t> dei <r>, mai le letture fonetiche in <rPh>
    private static testoRicco(el: Elemento): string {
        const parti: string[] = [];
        for (const figlio of el.figli) {
            const nome = locale(figlio.tag);
            if (nome === 't') parti.push(figlio.testo);
            else if (nome === 'r') parti.push(...figlio.figli.filter((t) => locale(t.tag) === 't').map((t) => t.testo));
        }
        return parti.join('');
    }

    private testiCondivisi(): string[] {
        const radice = this.xml('xl/sharedStrings.xml', false);
        if (!radice) return [];
        return radice.figli.filter((si) => locale(si.tag) === 'si').map((si) => LettoreXlsx.testoRicco(si));
    }

    // [nome, percorso nello zip, nascosto] nell'ordine di xl/workbook.xml, solo fogli di lavoro
    private fogliDichiarati(): Array<[string, string, boolean]> {
        const relazioni = new Map<string, string>();
        for (const rel of (this.xml('xl/_rels/workbook.xml.rels') as Elemento).figli) {
            if (locale(rel.tag) !== 'Relationship' || !(rel.attributi.Type ?? '').endsWith('/worksheet')) continue;
            const destinazione = rel.attributi.Target ?? '';
            const percorso = destinazione.startsWith('/')
                ? destinazione.replace(/^\/+/, '')
                : path.posix.normalize(path.posix.join('xl', destinazione));
            relazioni.set(rel.attributi.Id ?? '', percorso);
        }
        const fogli: Array<[string, string, boolean]> = [];
        for (const el of tutti(this.xml('xl/workbook.xml') as Elemento)) {
            if (locale(el.tag) !== 'sheet') continue;
            const percorso = relazioni.get(attributo(el, 'id') ?? '');
            if (percorso) {
                const stato = el.attributi.state;
                fogli.push([el.attributi.name || `Foglio${fogli.length + 1}`, percorso, stato === 'hidden' || stato === 'veryHidden']);
            }
        }
        return fogli;
    }

    // "C5" → 2; null se il riferimento non ha lettere
    private static indiceColonna(riferimento: string | undefined): number | null {
        const lettere = /^[A-Za-z]+/.exec(riferimento ?? '');
        if (!lettere) return null;
        let n = 0;
        for (const c of lettere[0].toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
        return n - 1;
    }

    private static valoreCella(c: Elemento, condivisi: string[]): string {
        const tipo = c.attributi.t || 'n';
        if (tipo === 'inlineStr') {
            const testo = c.figli.find((f) => locale(f.tag) === 'is');
            return testo ? LettoreXlsx.testoRicco(testo) : '';
        }
        const v = c.figli.find((f) => locale(f.tag) === 'v');
        // Una cella senza <v> (anche una formula senza valore salvato) è vuota
        if (!v || v.testo === '') return '';
        const grezzo = v.testo;
        if (tipo === 's') {
            const indice = floatIntero(grezzo);
            if (indice === null) return '';
            const i = indice < 0 ? condivisi.length + indice : indice;
            return condivisi[i] ?? '';
        }
        if (tipo === 'b') return grezzo.trim() === '1' ? '1' : '0';
        if (tipo === 'e') return '';
        if (tipo === 'n') {
            const numero = floatPython(grezzo);
            if (numero === null) return grezzo;
            if (Number.isFinite(numero) && Number.isInteger(numero)) return interoPython(numero);
            return reprPython(numero);
        }
        // str, d e tipi sconosciuti: il testo così com'è
        return grezzo;
    }

    private righeFoglio(percorso: string, condivisi: string[]): string[][] {
        const radice = this.xml(percorso) as Elemento;
        const righe: string[][] = [];
        let numeroRiga = 0;
        for (const riga of tutti(radice)) {
            if (locale(riga.tag) !== 'row') continue;
            const r = riga.attributi.r;
            const letto = r ? floatIntero(r) : null;
            numeroRiga = letto !== null && letto > 0 ? letto : numeroRiga + 1;
            // Le righe assenti nel file restano righe vuote: il numero di riga resta quello di Excel
            while (righe.length < numeroRiga) righe.push([]);
            const celle = righe[numeroRiga - 1] as string[];
            let colonna = -1;
            for (const c of riga.figli) {
                if (locale(c.tag) !== 'c') continue;
                const indice = LettoreXlsx.indiceColonna(c.attributi.r);
                colonna = indice !== null ? indice : colonna + 1;
                const valore = LettoreXlsx.valoreCella(c, condivisi);
                if (valore === '') continue;
                while (celle.length <= colonna) celle.push('');
                celle[colonna] = valore;
            }
        }
        return togliRigheVuoteFinali(righe);
    }

    leggi(): Foglio[] {
        const condivisi = this.testiCondivisi();
        return this.fogliDichiarati().map(([nome, percorso, nascosto]) => ({ nome, nascosto, righe: this.righeFoglio(percorso, condivisi) }));
    }
}

// int() di Python su un testo di sole cifre (con spazi e segno); null se non è un intero
function floatIntero(testo: string): number | null {
    const t = testo.trim();
    return /^[+-]?\d+$/.test(t) ? Number.parseInt(t, 10) : null;
}

/* --- .csv --- */

function leggiCsv(dati: Buffer, nomeFile: string): Foglio[] {
    // utf-8-sig: TextDecoder toglie già il BOM
    const testo = decodificaCsv(dati);
    const righe = leggiRigheCsv(testo, scegliSeparatore(testo));
    return [{ nome: path.parse(nomeFile).name || 'CSV', nascosto: false, righe: togliRigheVuoteFinali(righe) }];
}

/* --- Rotta /api/cliente/leggi --- */

// Formato numerico {:g} di Python per il messaggio del limite
function formatoG(n: number): string {
    return String(Number(n.toPrecision(6)));
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function leggiFileCliente(corpo: Record<string, unknown>, maxMb: number): { formato: 'csv' | 'xlsx'; fogli: Foglio[] } {
    const nomeGrezzo = corpo.nomeFile;
    const contenuto = corpo.contenuto;
    if (typeof nomeGrezzo !== 'string' || !nomeGrezzo.trim() || typeof contenuto !== 'string') {
        throw new ErroreApi(400, 'richiesta_non_valida', 'Servono nomeFile e contenuto (base64).');
    }
    const nomeFile = path.posix.basename(nomeGrezzo.trim().replace(/\\/g, '/'));
    const estensione = path.extname(nomeFile).toLowerCase();
    if (!ESTENSIONI_XLSX.includes(estensione) && estensione !== '.csv') throw new ErroreApi(415, 'formato_non_supportato', MSG_FORMATO_CLIENTE);
    // Il limite si controlla sul base64, prima di decodificarlo
    if (contenuto.length > Math.ceil(maxMb * 1048576 / 3) * 4) {
        throw new ErroreApi(413, 'troppo_grande', `Il file supera il limite di ${formatoG(maxMb)} MB (cliente.maxFileMB in settings.json).`);
    }
    if (contenuto.length % 4 !== 0 || !BASE64.test(contenuto)) {
        throw new ErroreApi(400, 'richiesta_non_valida', 'Il contenuto del file non è base64 valido.');
    }
    const dati = Buffer.from(contenuto, 'base64');
    // bytes.strip() di Python: solo gli spazi ASCII
    if (dati.every((b) => b === 0x20 || (b >= 0x09 && b <= 0x0d))) {
        throw new ErroreApi(422, 'file_vuoto', 'Il file è vuoto.');
    }
    // Firma OLE: un .xls vecchio o un .xlsx protetto da password
    if (dati.subarray(0, 4).equals(FIRMA_OLE)) throw new ErroreApi(415, 'formato_non_supportato', MSG_FORMATO_CLIENTE);
    const formato = estensione === '.csv' ? 'csv' : 'xlsx';
    const fogli = formato === 'csv' ? leggiCsv(dati, nomeFile) : new LettoreXlsx(dati).leggi();
    if (!fogli.some((f) => f.righe.some((r) => r.some((c) => c !== '')))) throw new ErroreApi(422, 'file_vuoto', 'Il file è vuoto.');
    return { formato, fogli };
}
