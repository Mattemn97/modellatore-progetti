/* --- TEST: PERCORSI SERVITI DAL PROTOCOLLO --- */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { risolviFile } from '../../src/main/percorsi';

const radice = path.resolve('/app');

describe('risolviFile', () => {
    it('serve i file ammessi della radice', () => {
        expect(risolviFile(radice, '/index.html')).toBe(path.join(radice, 'index.html'));
        expect(risolviFile(radice, '/js/app.js')).toBe(path.join(radice, 'js', 'app.js'));
        expect(risolviFile(radice, '/settings.json')).toBe(path.join(radice, 'settings.json'));
    });

    it('la radice vuota diventa index.html', () => {
        expect(risolviFile(radice, '/')).toBe(path.join(radice, 'index.html'));
    });

    it('rifiuta i percorsi che escono dalla radice', () => {
        expect(risolviFile(radice, '/js/%2e%2e/start.py')).toBeNull();
        expect(risolviFile(radice, '/js/../../segreto.txt')).toBeNull();
        expect(risolviFile(radice, '/%2e%2e%2fsegreto.txt')).toBeNull();
    });

    it('rifiuta i file della radice che la pagina non deve leggere', () => {
        expect(risolviFile(radice, '/start.py')).toBeNull();
        expect(risolviFile(radice, '/progetti/_ultimo.json')).toBeNull();
        expect(risolviFile(radice, '/shared/libreria.json')).toBeNull();
        expect(risolviFile(radice, '/package.json')).toBeNull();
    });

    it('rifiuta una codifica non valida', () => {
        expect(risolviFile(radice, '/js/%E0%A4%A')).toBeNull();
    });
});
