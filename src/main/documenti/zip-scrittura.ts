/* --- SCRITTURA DI UN FILE ZIP IN MEMORIA (per il .docx, spec 0028) --- */
// Voci compresse con deflate, nomi in UTF-8, data fissa: lo stesso contenuto dà sempre gli stessi byte
import zlib from 'node:zlib';

export interface VoceZip {
    nome: string;
    dati: Buffer;
}

// 1 gennaio 2020, 00:00 in formato DOS
const DATA_DOS = ((2020 - 1980) << 9) | (1 << 5) | 1;
const ORA_DOS = 0;

export function scriviZip(voci: VoceZip[]): Buffer {
    const locali: Buffer[] = [];
    const centrali: Buffer[] = [];
    let offset = 0;
    for (const voce of voci) {
        const nome = Buffer.from(voce.nome, 'utf-8');
        const compressi = zlib.deflateRawSync(voce.dati);
        const crc = zlib.crc32(voce.dati);

        const locale = Buffer.alloc(30);
        locale.writeUInt32LE(0x04034b50, 0);
        locale.writeUInt16LE(20, 4);
        locale.writeUInt16LE(0x0800, 6);
        locale.writeUInt16LE(8, 8);
        locale.writeUInt16LE(ORA_DOS, 10);
        locale.writeUInt16LE(DATA_DOS, 12);
        locale.writeUInt32LE(crc, 14);
        locale.writeUInt32LE(compressi.length, 18);
        locale.writeUInt32LE(voce.dati.length, 22);
        locale.writeUInt16LE(nome.length, 26);
        locale.writeUInt16LE(0, 28);
        locali.push(locale, nome, compressi);

        const centrale = Buffer.alloc(46);
        centrale.writeUInt32LE(0x02014b50, 0);
        centrale.writeUInt16LE(20, 4);
        centrale.writeUInt16LE(20, 6);
        centrale.writeUInt16LE(0x0800, 8);
        centrale.writeUInt16LE(8, 10);
        centrale.writeUInt16LE(ORA_DOS, 12);
        centrale.writeUInt16LE(DATA_DOS, 14);
        centrale.writeUInt32LE(crc, 16);
        centrale.writeUInt32LE(compressi.length, 20);
        centrale.writeUInt32LE(voce.dati.length, 24);
        centrale.writeUInt16LE(nome.length, 28);
        centrale.writeUInt32LE(offset, 42);
        centrali.push(centrale, nome);

        offset += 30 + nome.length + compressi.length;
    }
    const directory = Buffer.concat(centrali);
    const fine = Buffer.alloc(22);
    fine.writeUInt32LE(0x06054b50, 0);
    fine.writeUInt16LE(voci.length, 8);
    fine.writeUInt16LE(voci.length, 10);
    fine.writeUInt32LE(directory.length, 12);
    fine.writeUInt32LE(offset, 16);
    return Buffer.concat([...locali, directory, fine]);
}
