/* --- PONTE TEMPORANEO VERSO start.py (rimosso con la voce 20) --- */
// Libreria e lettura dei file del cliente le serve ancora start.py, avviato in silenzio come processo figlio su una porta libera.
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const ATTESA_AVVIO_MS = 15000;
const MAX_RIGHE_LOG = 40;

// Intestazioni che il server deve ricalcolare da sé, o che il suo controllo di origine rifiuterebbe
const INTESTAZIONI_SALTATE = new Set(['host', 'origin', 'referer', 'connection', 'content-length']);

export class ErrorePonte extends Error {
    constructor(messaggio: string, readonly dettagli: string) {
        super(messaggio);
    }
}

function portaLibera(): Promise<number> {
    return new Promise((risolvi, rifiuta) => {
        const server = net.createServer();
        server.unref();
        server.on('error', rifiuta);
        server.listen(0, '127.0.0.1', () => {
            const indirizzo = server.address();
            const porta = typeof indirizzo === 'object' && indirizzo ? indirizzo.port : 0;
            server.close(() => risolvi(porta));
        });
    });
}

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PontePython {
    private processo: ChildProcess | null = null;
    private porta = 0;
    private log: string[] = [];

    constructor(private readonly radice: string) {}

    private registra(testo: string): void {
        for (const riga of testo.split(/\r?\n/)) {
            if (!riga.trim()) continue;
            this.log.push(riga);
            if (this.log.length > MAX_RIGHE_LOG) this.log.shift();
        }
    }

    private lancia(eseguibile: string): ChildProcess {
        const script = path.join(this.radice, 'start.py');
        const figlio = spawn(eseguibile, [script, '--solo-api', '--porta', String(this.porta)], {
            cwd: this.radice,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
        });
        figlio.stdout?.on('data', (d: Buffer) => this.registra(d.toString('utf-8')));
        figlio.stderr?.on('data', (d: Buffer) => this.registra(d.toString('utf-8')));
        return figlio;
    }

    // Avvia start.py e aspetta che risponda; prova `python`, poi il launcher `py` di Windows
    async avvia(): Promise<void> {
        this.porta = await portaLibera();
        const candidati = process.env.MODELLATORE_PYTHON ? [process.env.MODELLATORE_PYTHON] : ['python', 'py'];
        let ultimoMotivo = '';
        for (const eseguibile of candidati) {
            const figlio = this.lancia(eseguibile);
            this.processo = figlio;
            let uscito = false;
            let erroreAvvio = '';
            figlio.on('error', (e) => { erroreAvvio = e.message; uscito = true; });
            figlio.on('exit', () => { uscito = true; });
            const scadenza = Date.now() + ATTESA_AVVIO_MS;
            while (Date.now() < scadenza && !uscito) {
                if (await this.risponde()) return;
                await attendi(200);
            }
            ultimoMotivo = erroreAvvio
                ? `${eseguibile}: ${erroreAvvio}`
                : uscito ? `${eseguibile} si è chiuso subito.` : `${eseguibile} non ha risposto entro ${ATTESA_AVVIO_MS / 1000} secondi.`;
            this.ferma();
            if (!erroreAvvio && !uscito) break;
        }
        throw new ErrorePonte(ultimoMotivo, this.log.join('\n'));
    }

    private async risponde(): Promise<boolean> {
        try {
            const r = await fetch(`http://127.0.0.1:${this.porta}/api/aggiornamento`, { signal: AbortSignal.timeout(1000) });
            return r.ok;
        } catch {
            return false;
        }
    }

    async inoltra(richiesta: Request, url: URL, corpo: ArrayBuffer | null): Promise<Response> {
        const intestazioni = new Headers();
        richiesta.headers.forEach((valore, nome) => {
            if (!INTESTAZIONI_SALTATE.has(nome.toLowerCase())) intestazioni.set(nome, valore);
        });
        try {
            const risposta = await fetch(`http://127.0.0.1:${this.porta}${url.pathname}${url.search}`, {
                method: richiesta.method,
                headers: intestazioni,
                body: corpo ?? (richiesta.method === 'DELETE' ? '' : undefined)
            });
            const senzaCorpo = risposta.status === 204 || risposta.status === 304;
            const uscita = new Headers(risposta.headers);
            uscita.delete('content-length');
            uscita.delete('content-encoding');
            uscita.delete('transfer-encoding');
            return new Response(senzaCorpo ? null : await risposta.arrayBuffer(), { status: risposta.status, headers: uscita });
        } catch (e) {
            const messaggio = 'Il servizio dei file non risponde. Chiudi e riapri il programma.';
            console.error('Ponte verso start.py:', e);
            return Response.json({ errore: 'servizio_non_disponibile', messaggio }, { status: 503 });
        }
    }

    ferma(): void {
        const figlio = this.processo;
        this.processo = null;
        if (figlio && figlio.exitCode === null && !figlio.killed) figlio.kill();
    }
}
