/* --- TEST: MACCHINA A STATI DELL'AGGIORNAMENTO DESKTOP CON UN AGGIORNATORE FINTO (spec 0025) --- */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServizioAggiornamento, type Aggiornatore } from '../../src/main/aggiornamento';
import { ErroreApi } from '../../src/main/api/errori';

type Ascoltatori = Record<string, (arg?: unknown) => void>;

function finto(controllo: () => Promise<unknown>, download: () => Promise<unknown> = () => Promise.resolve()) {
    const ascoltatori: Ascoltatori = {};
    const aggiornatore = {
        checkForUpdates: vi.fn(controllo),
        downloadUpdate: vi.fn(download),
        quitAndInstall: vi.fn(),
        on: (evento: string, f: (arg?: unknown) => void) => { ascoltatori[evento] = f; }
    };
    return { aggiornatore: aggiornatore as unknown as Aggiornatore & typeof aggiornatore, emetti: (e: string, arg?: unknown) => ascoltatori[e]?.(arg) };
}

afterEach(() => { vi.useRealTimers(); });

describe('ServizioAggiornamento', () => {
    it('disponibile → download → installazione → riavvio con setup silenzioso', () => {
        vi.useFakeTimers();
        const { aggiornatore, emetti } = finto(() => new Promise(() => {}));
        const s = new ServizioAggiornamento({ versione: '2.0.0', aggiornatore });
        s.controlla();
        expect(s.leggi().stato).toBe('controllo');
        emetti('update-available', { version: '2.0.1', releaseNotes: '<p>Novità</p>' });
        expect(s.leggi()).toMatchObject({ stato: 'disponibile', nuova: '2.0.1', note: 'Novità', installabile: true });
        expect(() => s.installa('2.0.2')).toThrow(ErroreApi);
        s.installa('2.0.1');
        expect(s.leggi().stato).toBe('download');
        emetti('update-downloaded');
        expect(s.leggi().stato).toBe('installazione');
        vi.runAllTimers();
        expect(s.leggi().stato).toBe('riavvio');
        expect(aggiornatore.quitAndInstall).toHaveBeenCalledWith(true, true);
    });

    it('senza rete al controllo resta muto; un download fallito lo dice e resta sulla versione', async () => {
        const { aggiornatore, emetti } = finto(() => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')));
        const s = new ServizioAggiornamento({ versione: '2.0.0', aggiornatore });
        s.controlla();
        await Promise.resolve();
        expect(s.leggi()).toMatchObject({ stato: 'nessuno', motivo: null });

        emetti('update-available', { version: '2.0.1' });
        s.installa('2.0.1');
        emetti('error', new Error('sha512 checksum mismatch'));
        expect(s.leggi().stato).toBe('errore');
        expect(String(s.leggi().motivo)).toContain('Resti sulla versione 2.0.0');
        expect(aggiornatore.quitAndInstall).not.toHaveBeenCalled();
    });

    it('spento: nessun controllo, installa rifiutato', () => {
        const s = new ServizioAggiornamento({ versione: '2.0.0', aggiornatore: null, motivoSpento: 'spento' });
        s.controlla();
        expect(s.leggi()).toMatchObject({ stato: 'disattivato', motivo: 'spento' });
        expect(() => s.installa('2.0.1')).toThrow(ErroreApi);
    });
});
