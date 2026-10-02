# 0015. Controllo e aggiornamento automatico dalle Release di GitHub

**Date**: 2026-10-02
**Status**: In Progress

## Summary

All'avvio `start.exe` chiede a GitHub se c'è una Release più recente della sua. Se c'è, lo dice in console e con un banner nell'app; con un clic su "Aggiorna e riavvia" scarica lo zip della nuova versione, controlla la sua impronta (SHA256), sostituisce solo i file dell'app (mai `progetti/`, `shared/` e `settings.json`), riparte e controlla che la nuova versione risponda. Se qualcosa va storto rimette i file di prima. Senza rete, o lanciando `start.py` a mano, l'app funziona come oggi.

## Requirements

**User stories**:
- Come utente voglio sapere all'avvio se esiste una versione nuova, e installarla con un clic senza perdere niente.
- Come utente senza rete voglio che l'app parta comunque, senza attese.

**Acceptance criteria**:
- **AC-1**: All'avvio, se `aggiornamenti.controllo` è `true` e la versione in uso (`leggi_versione()`, spec 0014) è nella forma `X.Y.Z`, `start.py` interroga in un thread separato `https://api.github.com/repos/<aggiornamenti.repository>/releases/latest` (timeout 5 secondi, intestazioni `Accept: application/vnd.github+json` e `User-Agent: ModellatoreMBSE/<versione>`). Il server risponde alle richieste dell'app mentre il controllo è in corso. Con versione `sviluppo`, una versione non `X.Y.Z` o `controllo: false`, nessuna richiesta parte e lo stato è `disattivato` con il motivo.
- **AC-2**: Una Release è più recente se il suo `tag_name` senza la `v` iniziale è `X.Y.Z` e, come tupla di interi, è maggiore della versione in uso. È installabile se ha un asset `ModellatoreMBSE-<X.Y.Z>.zip` con `digest` nella forma `sha256:<64 esadecimali>` e `browser_download_url` che inizia con `https://github.com/<repository>/releases/download/`, e se l'app gira come `start.exe` (`sys.frozen`). Altrimenti la versione si mostra con il solo link alla pagina della Release (`html_url`).
- **AC-3**: Con una versione più recente, la console scrive con `stampa_avviso` `È disponibile la versione <nuova> (hai la <attuale>). Apri l'app per aggiornare: <html_url>`. Se il controllo fallisce (rete, timeout, risposta non valida, limite di GitHub) la console scrive con `stampa_info` `Controllo aggiornamenti non riuscito: <motivo>` e l'app funziona normalmente; nessun banner.
- **AC-4**: `GET /api/aggiornamento` restituisce `{ stato, attuale, nuova, note, pagina, installabile, motivo }`. `stato` è uno tra `disattivato`, `controllo`, `aggiornato`, `disponibile`, `errore_controllo`, `download`, `verifica`, `installazione`, `riavvio`, `errore`. `note` è il `body` della Release tagliato a 5000 caratteri; `motivo` è il messaggio in italiano per `disattivato`, `errore_controllo`, `errore`, e per `installabile: false`.
- **AC-5**: Nell'app, con `stato: disponibile`, compare `#bannerAggiornamento` sotto l'intestazione: `È disponibile la versione <nuova> (hai la <attuale>).` con i pulsanti `Novità` (mostra e nasconde le note come testo, mai HTML), `Aggiorna e riavvia` (solo se `installabile`, altrimenti `Apri la pagina della versione` che apre `pagina` in una nuova scheda, con il `motivo` nel suggerimento) e `Più tardi` (nasconde il banner fino al prossimo avvio del server, ricordato in `sessionStorage` con la versione). Il banner non tocca `#bannerProgetto`. Mentre lo stato è `controllo` l'app richiede di nuovo lo stato ogni 2 secondi, per al massimo 30 secondi.
- **AC-6**: `Aggiorna e riavvia` chiede conferma (`confirm`) con il testo: la versione, che progetti, librerie e impostazioni non vengono toccati, che le modifiche non salvate di un blocco nell'ispettore vanno perse e che l'app si riavvia. Poi chiama `svuota()` di `progetto.js`: se il progetto non si salva (conflitto o errore) l'aggiornamento non parte. Poi `POST /api/aggiornamento/installa` con `{ "versione": "<nuova>" }`.
- **AC-7**: `POST /api/aggiornamento/installa` passa i controlli di origine e `Content-Type` di oggi; risponde 409 se lo stato non è `disponibile`, se `versione` non è la nuova, se non è installabile o se un'installazione è già in corso; altrimenti 202 e lavora in un thread. Durante il lavoro il banner mostra lo stato (`Scaricamento…`, `Verifica…`, `Installazione…`, `Riavvio…`) rileggendo lo stato ogni secondo, con i pulsanti disattivati.
- **AC-8**: Lo scaricamento va in `<cartella dell'app>/_aggiornamento/download.zip` a blocchi, si ferma oltre 200 MB, e il suo SHA256 deve essere uguale al `digest`; altrimenti stato `errore` con `L'impronta del file scaricato non corrisponde: aggiornamento annullato.` e nessun file dell'app toccato.
- **AC-9**: Prima di toccare qualsiasi file lo zip viene controllato: ogni voce inizia con `ModellatoreMBSE/`; nessuna voce ha un percorso assoluto, una lettera di unità o `..`; nessun file sta dentro un percorso di `PERCORSI_UTENTE` (le sole voci di cartella `progetti/` e `shared/` sono ammesse e ignorate); ci sono `start.exe`, `index.html` e `VERSIONE.txt` con la versione nuova; la somma delle dimensioni decompresse non supera `MAX_DECOMPRESSO`. Una violazione dà stato `errore` con il motivo e nessun file dell'app toccato. I file passano in `_aggiornamento/nuova/`.
- **AC-10**: L'elenco dei file da sostituire è esattamente l'elenco dei file dello zip (lista ammessa), mai "tutta la cartella tranne qualcosa". L'estrazione in `_aggiornamento/nuova/` crea le cartelle che servono. Per ognuno, nell'ordine dello zip ma con `start.exe` per ultimo: se esiste, il file attuale si sposta in `_aggiornamento/backup/` con lo stesso percorso relativo (anche lo `start.exe` in esecuzione, che Windows lascia rinominare), poi il nuovo prende il suo posto con `os.replace`; ogni spostamento si riprova fino a 5 volte ogni 0,5 secondi se il file è bloccato (per esempio da un antivirus). Un errore a metà rimette tutti i file spostati e toglie quelli nuovi senza copia: stato `errore` con il motivo, l'app resta alla versione di prima e continua a funzionare. I file dell'app che la nuova versione non contiene restano dove sono. Nessun percorso di `PERCORSI_UTENTE` viene scritto, spostato o cancellato.
- **AC-11**: Dopo la sostituzione: stato `riavvio`; un thread separato chiama `httpd.shutdown()` e poi `httpd.server_close()` (la risposta 202 è già partita; le richieste durante il riavvio falliscono e la pagina lo sa, AC-13). Poi avvia il nuovo `start.exe` (`sys.executable`) con `--dopo-aggiornamento <versione vecchia>`, `creationflags=CREATE_NEW_CONSOLE | CREATE_NEW_PROCESS_GROUP`, `close_fds=True` e l'ambiente con `PYINSTALLER_RESET_ENVIRONMENT=1` (così il nuovo exe estrae i suoi file e non riusa la cartella temporanea del vecchio). Ogni 0,5 secondi, per al massimo 60 secondi, interroga `http://127.0.0.1:<PORT>/api/aggiornamento` (timeout 1 secondo) finché `attuale` vale la versione nuova: allora il processo vecchio esce. Se il nuovo processo termina prima (`Popen.poll()` non è `None`) o i 60 secondi scadono: termina l'albero del nuovo processo (`taskkill /PID <pid> /T /F`), rimette i file di `_aggiornamento/backup/` (riprovando ogni spostamento per al massimo 10 secondi, finché i file del nuovo exe non sono più bloccati), avvia lo `start.exe` ripristinato con `--dopo-ripristino <versione nuova>` (stesse opzioni) ed esce.
- **AC-12**: Un `start.exe` lanciato con `--dopo-aggiornamento` o `--dopo-ripristino` riprova ad aprire la porta ogni 0,5 secondi per al massimo 15 secondi quando la porta è occupata (`OSError` con `errno.EADDRINUSE` o `winerror` 10048 o 10013); scaduto il tempo scrive con `stampa_errore` `La porta <PORT> è occupata: chiudi le altre finestre nere e avvia di nuovo start.exe.` ed esce con codice 1. Non apre una nuova scheda del browser. Scrive con `stampa_info` `Aggiornamento dalla versione <vecchia> completato.` oppure con `stampa_avviso` `La versione <nuova> non è partita: ripristinata la versione precedente.`; nel secondo caso `GET /api/aggiornamento` ha `stato: errore` con quel motivo (il banner lo mostra). Senza argomenti il comportamento di avvio è quello di oggi.
- **AC-13**: La pagina aperta, con stato `riavvio`, rilegge lo stato ogni secondo (gli errori di rete durante il cambio di processo sono attesi) e, quando `attuale` vale la versione nuova, ricarica la pagina; dopo 60 secondi senza risposta mostra `Il riavvio non risponde: chiudi la finestra nera e avvia di nuovo start.exe.`
- **AC-14**: All'avvio, 60 secondi dopo che il server risponde, `start.py` cancella la cartella `_aggiornamento/` se esiste e se il suo stato non è `download`, `verifica`, `installazione` o `riavvio` (riprova per al massimo 30 secondi se un file è ancora bloccato; se non ci riesce la lascia per il prossimo avvio).
- **AC-15**: `settings.json`, `DEFAULT_SETTINGS` e la fusione di `loadSettings()` hanno `aggiornamenti: { controllo: true, repository: "Mattemn97/modellatore-progetti" }`. Un `repository` che non è nella forma `proprietario/nome` (`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`) dà stato `disattivato`.
- **AC-16**: `packaging/TUTORIAL.md` spiega nella sezione "Backup e aggiornamenti" l'avviso, il pulsante `Aggiorna e riavvia`, cosa non viene toccato, il ripristino automatico e come spegnere il controllo (`aggiornamenti.controllo` in `settings.json`). Il banner e i suoi pulsanti hanno i suggerimenti dell'aiuto contestuale (`data-aiuto`, voci in `SUGGERIMENTI`).

## Decision

**Chosen option**: aggiornamento fatto da `start.py` stesso (niente programma esterno), con lista ammessa dallo zip, copie di sicurezza, controllo di salute del nuovo processo e ripristino automatico.

**Decisioni di dettaglio**:
- Sorgente: API pubblica delle Release di GitHub, `releases/latest` (la repo è pubblica, nessun token). Integrità: il `digest` SHA256 che GitHub calcola per ogni asset; senza `digest` niente installazione automatica, solo il link alla pagina. Scartato: scaricare senza impronta (un file troncato o alterato verrebbe installato).
- Conferma dell'utente nell'app, non in console: la console del server non legge la tastiera mentre serve l'app. La console informa e rimanda all'app.
- Installazione asincrona (202 più lettura dello stato), così il banner mostra le fasi e una richiesta lunga non resta appesa.
- Sostituzione file per file con `os.replace` e copia in `_aggiornamento/backup/`; lo `start.exe` in esecuzione si rinomina (Windows lo permette, non permette di sovrascriverlo). Scartato: un secondo programma "updater" (un file in più da costruire, firmare e aggiornare a sua volta).
- Controllo di salute: il processo vecchio libera la porta, avvia il nuovo e aspetta che risponda con la versione nuova; solo allora esce. È l'unico modo di accorgersi di un exe nuovo che non parte senza lasciare l'utente con un'installazione rotta.
- Solo `start.exe`: lanciando `start.py` (sviluppo) la versione è `sviluppo` e il controllo non parte; con un `VERSIONE.txt` accanto allo script il controllo parte ma `installabile` è `false` (`motivo`: `L'aggiornamento automatico funziona solo con start.exe.`).
- Banner separato `#bannerAggiornamento`, posseduto da un modulo nuovo `js/aggiornamento.js`: `#bannerProgetto` resta per conflitti ed errori di salvataggio, che non devono essere coperti da un avviso.
- Prove: la variabile d'ambiente `MODELLATORE_URL_RELEASE` (solo per `/check verify`, non documentata nel tutorial) sostituisce l'URL di `releases/latest`; in quel caso il prefisso ammesso per `browser_download_url` diventa schema e host di quell'URL più `/` (per esempio `http://127.0.0.1:8098/`). Senza la variabile vale solo `https://github.com/<repository>/releases/download/`. Scartato: provare solo contro GitHub vero (servirebbe pubblicare una Release finta).
- Stato del server in un dizionario protetto da un `threading.Lock` dedicato (`StatoAggiornamento`), separato dal lucchetto dei file di progetti e librerie.

**Implementation skills**: none.

## Rationale

Ragionamento e opzioni: vedi [rationale.md](rationale.md).

## Feature design

**Data model sketch**: nessun dato dell'utente. Stato in memoria del server:

| Campo | Tipo | Note |
|---|---|---|
| `stato` | stringa | uno dei valori dell'AC-4 |
| `attuale` | stringa | `leggi_versione(base_dir)` |
| `nuova` | stringa o `null` | `tag_name` senza `v` |
| `note` | stringa | `body` tagliato a 5000 caratteri |
| `pagina` | stringa o `null` | `html_url` |
| `installabile` | booleano | AC-2 |
| `motivo` | stringa | messaggio in italiano o vuoto |
| (interni) `url_zip`, `sha256` | stringhe | dall'asset; non esposti |

Cartella di lavoro `_aggiornamento/` nella cartella dell'app: `download.zip`, `nuova/`, `backup/`. È dell'app, non dell'utente; non è nel pacchetto.

**State transitions**: `disattivato` (finale) · `controllo` → `aggiornato` | `disponibile` | `errore_controllo` · `disponibile` → `download` → `verifica` → `installazione` → `riavvio` (il processo esce) · `download` | `verifica` | `installazione` → `errore` (file di prima intatti o rimessi) · `errore` → `download` (nuovo tentativo dal banner, se `installabile`). Un processo avviato con `--dopo-ripristino` parte in `errore`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/aggiornamento` | GET | nessuno | stato dell'AC-4 | controllo dell'host come le altre rotte | nessuno |
| `/api/aggiornamento/installa` | POST | `versione`: string (req) | 202 `{ stato }` | origine e `Content-Type: application/json` | 409 `aggiornamento_non_disponibile`, 409 `versione_diversa`, 409 `installazione_in_corso`, 409 `non_installabile` |

Argomenti di `start.exe`: `--dopo-aggiornamento <versione vecchia>`, `--dopo-ripristino <versione nuova>`.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Controllo | versione attuale | `leggi_versione(base_dir)` (`VERSIONE.txt`) |
| Controllo | repository, attivo sì o no | `aggiornamenti.repository`, `aggiornamenti.controllo` di `settings.json` letti all'avvio (riavviare dopo una modifica, come `progetti.versioni`); predefiniti se mancano |
| Controllo | versione nuova, note, pagina | `tag_name`, `body`, `html_url` della risposta |
| Controllo | URL e impronta dello zip | asset `ModellatoreMBSE-<nuova>.zip`: `browser_download_url`, `digest` |
| Controllo | gira come exe | `getattr(sys, 'frozen', False)` |
| Installa | cartella dell'app | `get_base_dir()` (cartella di `sys.executable` per l'exe) |
| Installa | file da sostituire | elenco dei file dello zip sotto `ModellatoreMBSE/` |
| Installa | percorsi vietati | `PERCORSI_UTENTE` (spec 0013) |
| Installa | limite decompresso | `MAX_DECOMPRESSO` già in `start.py` |
| Riavvio | exe da avviare | `sys.executable` (dopo la sostituzione è il file nuovo allo stesso percorso) |
| Riavvio | porta da interrogare | `PORT` |
| Riavvio | processo da terminare | `Popen.pid` del nuovo exe, terminato con il suo albero (`taskkill /T /F`: l'exe onefile ha un processo padre e un figlio Python) |
| Banner | testo, pulsanti | campi di `GET /api/aggiornamento` |
| Banner | "Più tardi" | `sessionStorage['modellatore.aggiornamentoRimandato'] === <nuova>` |

**Key invariants**:
- Nessun file di `PERCORSI_UTENTE` viene mai scritto, spostato o cancellato dall'aggiornamento.
- Nessun file dell'app cambia prima che impronta e contenuto dello zip siano stati controllati.
- In ogni momento, o i file sono tutti della versione vecchia, o sono tutti della nuova con la vecchia in `backup/` finché il controllo di salute non è passato.
- L'avvio non aspetta mai la rete.

**Security model**: tutto locale. Le scritture passano dai controlli di origine di oggi (un altro sito non può avviare un'installazione). Si scarica solo via HTTPS da `github.com/<repository>/releases/download/` (con i reindirizzamenti di GitHub) e si installa solo un file con l'impronta attesa. I testi della Release vanno nella pagina come testo (`textContent` o `escapeHtml`).

**Configuration required**: `aggiornamenti.controllo`, `aggiornamenti.repository` in `settings.json` (vedi AC-15). Nessun segreto.

**Critical test scenarios**:
- Exe 1.0.4 con un server finto delle Release che annuncia 1.0.5 con lo zip vero e la sua impronta: avviso in console, banner, `Aggiorna e riavvia`, riavvio, pagina ricaricata con 1.0.5; impronte dei file utente identiche. Verifica **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**, **AC-10**, **AC-11**, **AC-12**, **AC-13**.
- Impronta sbagliata: errore, nessun file cambiato. Verifica **AC-8**.
- Zip con `../fuori.txt`, con `ModellatoreMBSE/shared/x.json`, senza `start.exe`, con `VERSIONE.txt` diverso: errore, nessun file cambiato. Verifica **AC-9**.
- File bloccato a metà sostituzione: file rimessi, app alla versione di prima. Verifica **AC-10**.
- Nuova versione che non parte (exe che esce subito): ripristino, banner con l'errore. Verifica **AC-11**, **AC-12**.
- Rete assente e `controllo: false`: avvio immediato, nessun banner. Verifica **AC-1**, **AC-3**, **AC-15**.
- Progetto in conflitto: il pulsante non avvia nulla. Verifica **AC-6**.
- Cartella `_aggiornamento/` rimasta: sparisce dopo l'avvio. Verifica **AC-14**.

## Build plan

1. Stato e controllo: `StatoAggiornamento`, impostazioni `aggiornamenti` (con `settings.json`, `DEFAULT_SETTINGS`, `loadSettings()`), thread di controllo, confronto delle versioni, scelta dell'asset, messaggi in console, `GET /api/aggiornamento`. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-15**.
2. Banner nell'app: `js/aggiornamento.js`, `#bannerAggiornamento` in `index.html`, stile in `style.css`, Novità, Più tardi, Apri la pagina, suggerimenti. Satisfies **AC-5**, **AC-16** (aiuto).
3. Installazione: `POST /api/aggiornamento/installa`, scaricamento con impronta, controllo dello zip, estrazione, sostituzione con copie e ripristino, stati nel banner, conferma e `svuota()`. Satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**.
4. Riavvio: liberare la porta, avviare il nuovo exe, controllo di salute, ripristino, argomenti `--dopo-*`, riprova della porta, ricarica della pagina, pulizia di `_aggiornamento/`. Satisfies **AC-11**, **AC-12**, **AC-13**, **AC-14**.
5. Tutorial. Satisfies **AC-16**.

## Consequences

**Positive**:
- Aggiornare diventa un clic, con la stessa garanzia sui dati dell'utente dell'estrazione a mano (spec 0013) e in più il ripristino automatico.

**Negative / tradeoffs**:
- `start.py` cresce di una parte delicata (rete, file, processi) che non ha test automatici: la garanzia è `/check verify` con un server finto delle Release.
- Durante il riavvio l'app non risponde per qualche secondo.
- Dipende dal formato dell'API di GitHub (`tag_name`, `assets`, `digest`); se cambia, il controllo fallisce in silenzio (solo una riga in console) e resta l'aggiornamento a mano.
- Antivirus e SmartScreen possono trattare il nuovo `start.exe` come un programma nuovo (exe non firmato).

**Neutral**:
- `_aggiornamento/` compare per pochi minuti nella cartella dell'app dopo un aggiornamento.
- Le versioni minori e maggiori (tag a mano) seguono la stessa strada delle patch.

## Follow-up

- [ ] Firma digitale dell'exe, così SmartScreen non avvisa dopo ogni aggiornamento (fuori da questa spec).
