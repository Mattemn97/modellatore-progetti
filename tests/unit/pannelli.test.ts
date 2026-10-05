/* --- TEST: CONVALIDA DEL LAYOUT SALVATO DEI PANNELLI (spec 0021, AC-4) --- */
import { describe, expect, it } from 'vitest';
import { layoutValido } from '../../src/renderer/pannelli';

const layout = (panels: Record<string, unknown>, versione: unknown = 1) => ({
    versione,
    layout: { grid: { root: { type: 'branch', data: [] }, width: 800, height: 600, orientation: 'HORIZONTAL' }, panels }
});

describe('layoutValido', () => {
    it('accetta un layout con pannelli noti e il Canvas', () => {
        expect(layoutValido(layout({ canvas: {}, libreria: {}, ispettore: {} }))).toBe(true);
    });

    it('rifiuta versione diversa, pannello sconosciuto, Canvas mancante e dati non validi', () => {
        expect(layoutValido(layout({ canvas: {} }, 2))).toBe(false);
        expect(layoutValido(layout({ canvas: {}, sconosciuto: {} }))).toBe(false);
        expect(layoutValido(layout({ libreria: {} }))).toBe(false);
        expect(layoutValido({ versione: 1, layout: { panels: { canvas: {} } } })).toBe(false);
        expect(layoutValido(null)).toBe(false);
        expect(layoutValido('{"versione":1}')).toBe(false);
    });
});
