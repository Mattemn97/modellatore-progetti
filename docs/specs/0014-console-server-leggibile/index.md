# 0014. Console del server più leggibile con rich

**Date**: 2026-10-02
**Status**: Accepted

## Summary

La finestra nera che si apre con `start.exe` diventa chiara a colpo d'occhio: un riquadro con nome, versione, il link dell'app ben evidenziato (cliccabile dove il terminale lo permette) e le cartelle dei dati. Gli avvisi e gli errori hanno un colore loro, e le righe di ogni richiesta del browser non coprono più il riquadro. Usiamo la libreria Python `rich`, inclusa nell'exe; chi lancia `start.py` senza averla installata vede le stesse informazioni in testo semplice.

## Requirements

**User stories**:
- Come utente voglio vedere subito il link su cui lavorare e la versione in uso, senza cercarli tra righe tecniche.
- Come sviluppatore della funzionalità 15 voglio un modo unico per scrivere un avviso evidente in console (per esempio "aggiornamento disponibile").

**Acceptance criteria**:
- **AC-1**: Con `rich` disponibile, all'avvio la console mostra un riquadro con titolo `Modellatore MBSE` e cinque righe etichetta e valore, nell'ordine e con queste etichette: `Versione:`, `Apri l'app:` (il link, in grassetto colorato e come collegamento cliccabile OSC 8 dove il terminale lo supporta), `Cartella dell'app:`, `Progetti:`, `Librerie:` (la cartella `shared/`). Sotto il riquadro: `Chiudi questa finestra per fermare il server.`
- **AC-2**: Il link è sempre scritto per intero come testo (`http://localhost:<PORT>`) su una sola riga, mai tagliato né spezzato, così si legge e si copia anche dove il collegamento cliccabile non funziona e quando l'uscita è rediretta. Le etichette sono sempre intere (colonna con larghezza minima); i percorsi lunghi vanno a capo dentro la loro colonna. Se la finestra è più stretta della riga del link (etichette, spazio, URL, bordi e margini), al posto del riquadro escono righe libere `<etichetta> <valore>` che il terminale manda a capo senza tagliarle.
- **AC-3**: Senza `rich` (import fallito, o errore nel creare la console), `start.py` parte comunque e scrive in testo semplice: una riga di 55 `=`, ` Modellatore MBSE`, poi le cinque righe dell'AC-1 nella forma ` <etichetta> <valore>`, la riga ` Chiudi questa finestra per fermare il server.` e un'altra riga di `=`. Se una stampa con `rich` fallisce (per esempio un carattere non codificabile), la stessa informazione esce in testo semplice e l'avvio continua.
- **AC-4**: Con la variabile d'ambiente `NO_COLOR` impostata, o con l'uscita rediretta su file o pipe, la console non contiene sequenze di escape ANSI (`[`), ma contiene tutte le informazioni dell'AC-1. Con l'uscita rediretta `start.py` la riconfigura in UTF-8 con `errors="replace"` (`sys.stdout.reconfigure`, solo se `not sys.stdout.isatty()`), così i bordi del riquadro e le lettere accentate non fanno fallire l'avvio, e dopo il riquadro svuota il buffer (`flush`), così chi legge l'uscita la trova subito.
- **AC-5**: La versione è il contenuto di `VERSIONE.txt` nella cartella dell'app, senza spazi ai bordi; se il file manca o è vuoto la versione è `sviluppo`. La legge `leggi_versione(base_dir)` in `start.py`.
- **AC-6**: `start.py` ha `stampa_avviso(testo)` (giallo, prefisso `Attenzione:`) e `stampa_errore(testo)` (rosso, prefisso `Errore:`); senza `rich` scrivono lo stesso prefisso in testo semplice. I messaggi di oggi passano da lì: `Impossibile creare settings.json: …` è un errore; `Impostazioni create da settings.predefinite.json` è una riga informativa (`stampa_info`, testo semplice attenuato). Tutte le funzioni di stampa si possono chiamare anche prima di `main()`: la console `rich` si crea all'import del modulo, dentro un `try`.
- **AC-7**: Le richieste del browser riuscite (codice sotto 400) non scrivono più una riga in console. Le richieste con codice 400 o più scrivono una sola riga attenuata `<METODO> <percorso> → <codice>`, tranne `GET /favicon.ico` con 404. `log_error` ignora i messaggi che `send_error` genera (quelli che iniziano con `code `, già coperti dalla riga di `log_request`) e passa gli altri (per esempio un timeout) a `stampa_errore`; `log_message` passa da `stampa_info`.
- **AC-8**: `requirements.txt` nella radice contiene esattamente `pyinstaller==6.22.3` e `rich==14.3.2`; il passo del workflow di rilascio che oggi installa PyInstaller diventa `python -m pip install -r requirements.txt`; `start.spec` include i sottomoduli caricati al volo da `rich` (`hiddenimports=collect_submodules('rich._unicode_data')`). La prova di avvio nel workflow avvia `start.exe` con l'uscita rediretta su file e, dopo la risposta HTTP 200, controlla che il file (letto in UTF-8) contenga `http://localhost:8080` e il bordo verticale del riquadro `│` (rich lo disegna sia con gli angoli arrotondati di un terminale moderno sia con quelli squadrati della modalità Windows classica; prova che l'exe usa davvero `rich` e non la riserva in testo semplice). La versione nel riquadro dell'exe viene da `VERSIONE.txt`, che `crea-pacchetto.ps1` scrive già con il parametro `-Versione`.

## Decision

**Chosen option**: `rich` con import facoltativo e testo semplice come riserva, tutto dentro `start.py`.

**Decisioni di dettaglio**:
- Libreria: `rich` (14.3.2). Scartato `colorama`: dà solo i colori, non riquadri, collegamenti cliccabili né il riconoscimento automatico di `NO_COLOR` e dell'uscita non interattiva, che andrebbero scritti a mano.
- Import facoltativo: `try: from rich.console import Console ... except ImportError: Console = None`. `python start.py` resta lanciabile con la sola libreria standard, come dice `AGENTS.md`.
- Un solo `Console()` di modulo (`CONSOLE`), creato all'import dentro un `try` (`None` se `rich` manca o la creazione fallisce); `rich` decide da sé colori e collegamenti dal terminale. Collegamento con il markup `[link=URL]URL[/link]`, così il testo visibile è sempre l'URL intero (AC-2).
- Riquadro: `rich.panel.Panel` con una `rich.table.Table.grid` di due colonne (etichetta attenuata, valore). Nessun disegno ASCII a mano.
- Log delle richieste: `log_request(code, size)` sovrascritto nel gestore, scrive solo se `int(code) >= 400` e non è il 404 di `/favicon.ico`; `log_message` passa da `stampa_info` attenuata; `log_error` da `stampa_errore`. Scartato: lasciare il log completo (il riquadro sparisce dopo pochi clic).
- Tutto resta in `start.py` (nessun modulo nuovo): `start.spec` analizza già `start.py` e PyInstaller include `rich` da solo perché è importato lì.

**Implementation skills**: none.

## Rationale

Ragionamento e opzioni: vedi [rationale.md](rationale.md).

## Feature design

**Data model sketch**: nessun dato. Un file letto: `VERSIONE.txt` (scritto da `crea-pacchetto.ps1`).

**API surface** (funzioni in `start.py`):

| Funzione | Input | Output |
|---|---|---|
| `leggi_versione(base_dir)` | cartella dell'app | stringa versione o `sviluppo` |
| `stampa_avvio(versione, url, base_dir, cartella_progetti, cartella_librerie)` | valori del riquadro | riquadro (rich) o righe semplici |
| `stampa_info(testo)` | testo | riga attenuata |
| `stampa_avviso(testo)` | testo | riga gialla `Attenzione: …` |
| `stampa_errore(testo)` | testo | riga rossa `Errore: …` |

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Avvio | versione | `VERSIONE.txt` in `get_base_dir()`, altrimenti `sviluppo` |
| Avvio | url | `f"http://localhost:{PORT}"` |
| Avvio | cartella dell'app | `get_base_dir()` |
| Avvio | progetti | `archivio.cartella` |
| Avvio | librerie | `os.path.join(base_dir, "shared")` (dove `ensure_shared_library` crea la libreria) |
| Avvio | colori sì o no, collegamento sì o no | rilevamento automatico di `rich.console.Console` (terminale, `NO_COLOR`, uscita rediretta) |
| Log | codice e percorso | argomenti di `log_request` e `self.path` / `self.command` |

**Key invariants**:
- L'avvio non dipende da `rich`: senza la libreria il server parte uguale.
- L'URL completo è sempre visibile come testo.

**Security model**: nessun dato nuovo; meno righe di log non tolgono informazioni di sicurezza (gli errori restano visibili).

**Configuration required**: nessuna chiave in `settings.json`. Nuovo file `requirements.txt` per chi costruisce l'exe.

**Critical test scenarios**:
- `start.py` in un terminale con `rich`: riquadro con versione, link, cartelle; screenshot o cattura con `force_terminal`. Verifica **AC-1**, **AC-2**.
- `start.py` con un Python senza `rich` (`.venv` senza la libreria): righe semplici, server che risponde. Verifica **AC-3**.
- Uscita rediretta su file e con `NO_COLOR=1`: nessun `\x1b[`, tutte le informazioni presenti. Verifica **AC-4**.
- Cartella con `VERSIONE.txt` = `1.2.3` e senza: `Versione 1.2.3` e `Versione sviluppo`. Verifica **AC-5**.
- `settings.json` mancante: riga informativa; copia impossibile: riga `Errore:`. Verifica **AC-6**.
- Pagina caricata, poi una richiesta a un file che non esiste: nessuna riga per le richieste riuscite, una riga per il 404, nessuna per `favicon.ico`. Verifica **AC-7**.
- `pip install -r requirements.txt`, `crea-pacchetto.ps1`, avvio di `start.exe` in una console: riquadro colorato; uscita rediretta contiene l'URL. Verifica **AC-8**.

## Build plan

1. `leggi_versione`, funzioni di stampa con import facoltativo di `rich` e riserva in testo semplice, riconfigurazione UTF-8 dell'uscita rediretta, riquadro di avvio al posto delle righe di `=`, messaggi delle impostazioni sulle nuove funzioni. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**.
2. Log delle richieste filtrato nel gestore. Satisfies **AC-7**.
3. `requirements.txt`, `hiddenimports` in `start.spec`, workflow che installa da lì e controlla l'uscita di `start.exe` (URL e bordo `│`), exe ricostruito e provato. Satisfies **AC-8**.

## Consequences

**Positive**:
- Il link e la versione si vedono subito; la console resta pulita durante il lavoro.
- La funzionalità 15 ha `stampa_avviso` pronta.

**Negative / tradeoffs**:
- L'exe cresce di qualche centinaio di KB per `rich`.
- Una dipendenza esterna in più da tenere aggiornata, fissata in `requirements.txt`.
- Chi lancia `start.py` senza `rich` vede la versione semplice: va bene, ma le due uscite vanno tenute allineate.

**Neutral**:
- `pip install -r requirements.txt` sostituisce `pip install pyinstaller` nei comandi di `AGENTS.md` (lo aggiorna `/sync`).

## Follow-up

- [ ] Registrare in `AGENTS.md` che per `rich` non si installano Agent Skills (candidati trovati poco usati e di terze parti).
