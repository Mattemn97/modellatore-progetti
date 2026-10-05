/* --- LETTURA DI UN FILE ZIP IN MEMORIA (solo ciò che serve per .xlsx) --- */
// Directory centrale, file salvati o compressi con deflate; niente ZIP64 né cifratura
import zlib from 'node:zlib';

export class ErroreZip extends Error {}
export class ZipTroppoGrande extends Error {}

interface Voce {
    metodo: number;
    cifrata: boolean;
    compressa: number;
    offsetLocale: number;
}

const FIRMA_FINE = 0x06054b50;
const FIRMA_CENTRALE = 0x02014b50;
const FIRMA_LOCALE = 0x04034b50;

export class ArchivioZip {
    private readonly voci = new Map<string, Voce>();

    constructor(private readonly dati: Buffer) {
        const fine = this.trovaFine();
        const quante = dati.readUInt16LE(fine + 10);
        let p = dati.readUInt32LE(fine + 16);
        for (let i = 0; i < quante; i++) {
            if (p + 46 > dati.length || dati.readUInt32LE(p) !== FIRMA_CENTRALE) throw new ErroreZip('directory centrale danneggiata');
            const flag = dati.readUInt16LE(p + 8);
            const metodo = dati.readUInt16LE(p + 10);
            const compressa = dati.readUInt32LE(p + 20);
            const lungNome = dati.readUInt16LE(p + 28);
            const lungExtra = dati.readUInt16LE(p + 30);
            const lungCommento = dati.readUInt16LE(p + 32);
            const offsetLocale = dati.readUInt32LE(p + 42);
            // Bit 11: nome in UTF-8, altrimenti cp437 (per i nomi ASCII di un xlsx è uguale)
            const nome = dati.toString((flag & 0x800) ? 'utf-8' : 'latin1', p + 46, p + 46 + lungNome);
            this.voci.set(nome, { metodo, cifrata: (flag & 1) === 1, compressa, offsetLocale });
            p += 46 + lungNome + lungExtra + lungCommento;
        }
    }

    private trovaFine(): number {
        const minimo = Math.max(0, this.dati.length - 22 - 65535);
        for (let p = this.dati.length - 22; p >= minimo; p--) {
            if (this.dati.readUInt32LE(p) === FIRMA_FINE) return p;
        }
        throw new ErroreZip('non è un file zip');
    }

    ha(nome: string): boolean {
        return this.voci.has(nome);
    }

    // Byte decompressi di una voce; ZipTroppoGrande se superano `massimo`
    leggi(nome: string, massimo: number): Buffer {
        const voce = this.voci.get(nome);
        if (!voce) throw new ErroreZip(`manca ${nome}`);
        if (voce.cifrata) throw new ErroreZip('voce cifrata');
        const p = voce.offsetLocale;
        if (p + 30 > this.dati.length || this.dati.readUInt32LE(p) !== FIRMA_LOCALE) throw new ErroreZip('intestazione locale danneggiata');
        const inizio = p + 30 + this.dati.readUInt16LE(p + 26) + this.dati.readUInt16LE(p + 28);
        const compressi = this.dati.subarray(inizio, inizio + voce.compressa);
        if (voce.metodo === 0) {
            if (compressi.length > massimo) throw new ZipTroppoGrande();
            return Buffer.from(compressi);
        }
        if (voce.metodo !== 8) throw new ErroreZip('compressione non supportata');
        try {
            return zlib.inflateRawSync(compressi, { maxOutputLength: Math.max(1, massimo) });
        } catch (e) {
            const codice = (e as NodeJS.ErrnoException).code;
            if (codice === 'ERR_BUFFER_TOO_LARGE' || (e instanceof RangeError)) throw new ZipTroppoGrande();
            throw new ErroreZip('dati compressi danneggiati');
        }
    }
}
