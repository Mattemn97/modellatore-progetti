/* --- TEST: PERCORSI SERVITI DAL PROTOCOLLO (solo dentro out/renderer) --- */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { risolviFile } from '../../src/main/percorsi';

const radice = path.resolve('/app/out/renderer');

describe('risolviFile', () => {
    it('serve i file della cartella dell\'interfaccia', () => {
        expect(risolviFile(radice, '/index.html')).toBe(path.join(radice, 'index.html'));
        expect(risolviFile(radice, '/app.js')).toBe(path.join(radice, 'app.js'));
        expect(risolviFile(radice, '/app.js.map')).toBe(path.join(radice, 'app.js.map'));
    });

    it('la radice vuota diventa index.html', () => {
        expect(risolviFile(radice, '/')).toBe(path.join(radice, 'index.html'));
    });

    it('rifiuta i percorsi che escono dalla cartella', () => {
        expect(risolviFile(radice, '/%2e%2e/package.json')).toBeNull();
        expect(risolviFile(radice, '/../../segreto.txt')).toBeNull();
        expect(risolviFile(radice, '/%2e%2e%2f%2e%2e%2fsegreto.txt')).toBeNull();
    });

    it('rifiuta una codifica non valida', () => {
        expect(risolviFile(radice, '/%E0%A4%A')).toBeNull();
    });
});
