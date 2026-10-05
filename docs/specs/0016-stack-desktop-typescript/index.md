# 0016. Stack desktop: Electron con TypeScript e protocollo interno al posto del server

**Date**: 2026-10-05
**Status**: In Progress

## Summary

Il modellatore diventa un programma desktop per Windows costruito con Electron (un guscio che unisce il motore di Chrome, per l'interfaccia, e Node.js, per leggere e scrivere i file). Il codice nuovo è in TypeScript. L'interfaccia di oggi si carica da un indirizzo interno `app://` invece che da `http://localhost:8080`, e le chiamate `/api/...` che oggi vanno a `start.py` le risponde il processo principale del programma, senza alcuna porta di rete. In questa prima voce quelle chiamate passano ancora, per poco, a `start.py` avviato in silenzio dietro le quinte; le voci 19 e 20 le riscrivono in TypeScript e il Python sparisce.

## Requirements

**User stories**:
- Come utente voglio aprire il modellatore come un normale programma Windows, in una sua finestra, senza browser né finestra nera.
- Come sviluppatore voglio una struttura TypeScript pronta, con i comandi di avvio e di controllo dei tipi, su cui costruire le voci successive senza rompere niente.

**Acceptance criteria**:
- **AC-1**: `npm install` seguito da `npm run dev` compila il processo principale e il preload e apre una finestra Windows con titolo `Modellatore MBSE` che mostra l'editor di oggi (canvas, libreria, ispettore) con la libreria di `shared/` e l'ultimo progetto aperto, come fa oggi `python start.py` nel browser. Nessuna scheda del browser si apre e nessuna console resta visibile.
- **AC-2**: La pagina si carica da `app://modellatore/index.html`. Lo schema `app` è registrato come standard e sicuro, con `fetch`, `localStorage` e `sessionStorage` funzionanti. Ogni file richiesto si risolve dentro la cartella dell'app; un percorso che esce da quella cartella (per esempio con `..`) risponde 404.
- **AC-3**: Ogni richiesta `app://modellatore/api/...` della pagina arriva al processo principale con metodo, corpo e intestazioni, e riceve stato, corpo e intestazioni della risposta. In questa voce il processo principale le inoltra a `start.py` avviato come processo figlio con `--solo-api --porta <porta libera scelta dal sistema>` su `127.0.0.1`; `start.py` in quel modo non apre il browser, non controlla gli aggiornamenti e accetta l'origine del processo principale. Tutte le funzioni da 1 a 15 che passano dalle API (salvataggio, versioni, Annulla e Ripeti, libreria, changelog, import cliente) funzionano come oggi.
- **AC-4**: Se `start.py` non parte entro 15 secondi (Python mancante, errore) la finestra mostra una pagina di errore in italiano con il motivo e il comando per avviarlo a mano; chiudendo il programma il processo figlio viene terminato sempre, anche dopo un errore.
- **AC-5**: Si può aprire un solo modellatore alla volta: un secondo avvio porta in primo piano la finestra già aperta ed esce (al posto della porta esclusiva di oggi).
- **AC-6**: La finestra ha `contextIsolation` attivo, `nodeIntegration` spento e `sandbox` attivo. Un link verso l'esterno (per esempio "Apri la pagina della versione") si apre nel browser di sistema, mai in una finestra del programma; la pagina non può navigare fuori da `app://modellatore/`.
- **AC-7**: Gli export che oggi scaricano un file (JSON della libreria e del modello, `.md` di matrice e documenti) aprono la finestra di Windows Salva con nome e scrivono il file scelto.
- **AC-8**: `alert`, `confirm`, scorciatoie (Esc, Ctrl+Z, Ctrl+Y), trascinamento dei blocchi, rotella e tour guidato funzionano come nel browser. La barra dei menu predefinita di Electron è nascosta; F12 apre gli strumenti per sviluppatori solo in `npm run dev`.
- **AC-9**: `npm run typecheck` controlla tutto il TypeScript (`src/`) in modalità `strict` e passa senza errori. Il codice JavaScript di `js/` resta com'è e non è ancora controllato.
- **AC-10**: `python start.py` continua a funzionare esattamente come oggi (browser su `localhost:8080`), così `main` e la 1.x non cambiano finché la v2 non è pronta.

## Decision

**Chosen option**: Option 1: Electron, TypeScript compilato con esbuild, protocollo interno `app://` che conserva il contratto `/api/*`.

Il guscio è Electron; il codice del processo principale e del preload è TypeScript compilato da esbuild e controllato da `tsc`; la pagina di oggi si serve da uno schema `app://` il cui gestore risponde anche alle rotte `/api/*`, inoltrate a `start.py` solo finché le voci 19 e 20 non le riscrivono in TypeScript.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Guscio desktop | Electron (ultima stabile, 44.x al momento) | Un solo linguaggio (TypeScript) per interfaccia e file, finestre multiple per i pannelli staccati, test end to end ufficiali con Playwright, installer e aggiornamento maturi. |
| Linguaggio | TypeScript in `strict` per `src/`; `js/` resta JavaScript fino alla voce 23 | Si passa a TypeScript un modulo alla volta senza fermare l'app. |
| Compilazione | esbuild (processo principale in ESM, preload in CommonJS perché il preload in sandbox lo richiede) | Un solo strumento piccolo e velocissimo, nessun server di sviluppo da configurare. |
| Controllo dei tipi | `tsc --noEmit` (TypeScript 7) | esbuild non controlla i tipi: lo fa `tsc` come comando separato e in CI. |
| Caricamento interfaccia | Schema `app://modellatore/` con `protocol.handle` | Moduli ES, `fetch` e storage funzionano come su HTTP, senza porte né `file://`. |
| Accesso ai dati | Rotte `/api/*` gestite nel processo principale con lo stesso contratto JSON di `start.py` | La pagina non cambia; i test end to end restano validi mentre sotto si sostituisce il Python. |
| Ponte temporaneo | `start.py --solo-api --porta N` come processo figlio, solo fino alle voci 19 e 20 | Tracer Bullet: il filo completo funziona subito, poi si sostituisce un tratto alla volta. |
| Comunicazione tra finestre | IPC di Electron via preload (`contextBridge`), introdotto quando serve (voci 21 e 26) | Il protocollo copre i dati; l'IPC copre ciò che non è una richiesta (finestre, dialoghi, eventi). |
| Gestore pacchetti | npm con `package-lock.json` | Già installato (Node 24), nessun altro strumento. |
| Test | Vitest per le regole pure, Playwright con il supporto Electron per gli end to end (dettagli nelle voci 17 e 18) | Entrambi parlano TypeScript senza configurazioni extra. |
| Installer e aggiornamento | electron-builder (NSIS per utente) e electron-updater con le Release di GitHub (decisi nelle voci 28 e 29) | Direzione indicata qui perché vincola la struttura; la scelta definitiva è nelle loro spec. |

**Struttura delle cartelle**:
- `src/main/`: processo principale (finestra, protocollo, rotte `/api`, ponte, istanza unica).
- `src/preload/`: preload (vuoto o quasi in questa voce).
- `index.html`, `style.css`, `settings.json`, `js/`: restano dove sono fino alla voce 23, che li sposta in `src/renderer/`.
- `out/`: risultato della compilazione (ignorato da git). `release/`: installabili (ignorato, voce 28).
- `package.json` alla radice con gli script `dev`, `build`, `typecheck`, `start`.

**Dove sono i dati in questa voce**: nella cartella del repository (`progetti/`, `shared/`), come con `python start.py`. Le cartelle di lavoro configurabili arrivano con la voce 21.

**Regole che cambiano** (da riportare in `AGENTS.md` con `/sync`): c'è un passo di build per il codice TypeScript; si apre l'app con `npm run dev`, non più con `start.py`; npm è il gestore pacchetti.

## Consequences

**Positive**:
- La pagina di oggi gira subito nella finestra desktop senza modifiche; ogni voce successiva sostituisce un pezzo mentre tutto il resto continua a funzionare.
- Un solo linguaggio per tutto quando il Python sarà ritirato.
- Niente porte di rete: niente conflitti di porta, niente controlli di origine, niente firewall.

**Negative / tradeoffs**:
- L'installabile pesa circa 100 MB (Chromium incluso), contro i circa 15 MB dell'exe Python di oggi.
- Fino alla voce 20 lo sviluppo richiede ancora Python per far rispondere le API.
- Un passo di build in più per il codice TypeScript (esbuild, pochi decimi di secondo).

**Neutral**:
- La regola "nessun build step e nessun npm" di `AGENTS.md` decade per la v2 (decisione dell'utente del 2026-10-05).
- `start.py` riceve `--solo-api` e `--porta`, rimossi con il Python alla voce 30.

## Follow-up

- [ ] Aggiornare `AGENTS.md` con stack, comandi e regole nuove (voce 17, `/audit`, poi `/sync`).
- [ ] Controllare che `typescript-eslint` supporti TypeScript 7 quando si sceglie il lint (voce 17); altrimenti fissare TypeScript alla 5.x.

## Rationale

Vedi [rationale.md](rationale.md).
