# 0001. Salvataggio automatico del progetto su disco con 3 versioni annullabili

**Date**: 2026-09-30
**Status**: Accepted

## Summary

Ogni progetto diventa un file JSON nella cartella `progetti/` accanto all'exe, e l'app lo riscrive da sola circa un secondo dopo ogni tua modifica. Il server `start.py` impara a scrivere solo dentro quella cartella, tramite pochi indirizzi `/api/...`, e tiene le ultime 3 versioni del file così puoi annullare (Ctrl+Z) e ripetere (Ctrl+Y). Un menu Progetto sostituisce i tre vecchi pulsanti di import ed export. Se il salvataggio fallisce lo vedi subito con un badge e un banner rosso.

## Requirements

**User stories**:
- Come progettista voglio che ogni modifica finisca su disco da sola, così non perdo mai il lavoro e il JSON resta la fonte di verità.
- Come progettista voglio riaprire l'app e ritrovarmi nell'ultimo progetto, con la sua libreria.
- Come progettista voglio annullare fino a 3 passi anche dopo aver chiuso l'app, perché il salvataggio automatico rende permanente anche un errore.
- Come progettista voglio creare, aprire, copiare, rinominare, eliminare, importare e scaricare progetti da un unico menu.

**Acceptance criteria**:
- **AC-1**: Al primo avvio con `progetti/` vuota l'app crea e apre `progetti/nuovo_progetto.json` (nome "Nuovo progetto", workspace vuoto).
- **AC-2**: All'avvio l'app riapre il progetto indicato in `progetti/_ultimo.json` e carica la libreria dal suo `libraryPath`. Se `_ultimo.json` manca, apre il progetto modificato più di recente. Se punta a un file che non esiste più ma ci sono altri progetti, si apre l'elenco dei progetti con il messaggio "L'ultimo progetto non è stato trovato".
- **AC-3**: Ogni modifica al modello (aggiungere, spostare, ridimensionare, eliminare un blocco; creare o eliminare un filo; spostare una porta; aggiungere o spostare uno snodo; un salvataggio dall'ispettore che cambia etichette, fili o id nel grafo; cambiare il percorso della libreria) aggiorna il file su disco entro 3 secondi dal rilascio del mouse o dall'ultima modifica. Una modifica che tocca solo la libreria non scrive il progetto (è compito della funzionalità 2).
- **AC-4**: Cambiare solo la vista (zoom, pan, entrare o uscire da un blocco, filtro tipologia, "Nascondi Non Coinvolti", ricerca in libreria, selezione) non scrive sul disco e non consuma versioni. Unica eccezione: la prima visita a un livello che non ha ancora le posizioni dei blocchi tondi le salva una volta.
- **AC-5**: Un badge nell'header mostra sempre lo stato: `Salvato`, `Modifiche in attesa`, `Salvataggio…`, `Errore di salvataggio`, `Conflitto`.
- **AC-6**: Se un salvataggio fallisce (server fermo, errore di disco, file bloccato da un altro programma, risposta 5xx) il badge diventa rosso e compare un banner rosso con il motivo e un pulsante `Riprova`. I tentativi automatici continuano; al primo successo il banner sparisce e il file contiene l'ultimo stato. Chiudere la scheda in `Modifiche in attesa`, `Salvataggio…`, `Errore` o `Conflitto` chiede conferma al browser.
- **AC-7**: Se il file su disco è cambiato dopo che l'app l'ha letto (modifica a mano, seconda scheda), il salvataggio non lo sovrascrive: il badge mostra `Conflitto` e il banner offre `Ricarica dal disco` (scarta le modifiche in memoria) e `Sovrascrivi`. Finché non scegli, il salvataggio automatico, Annulla, Ripeti e le operazioni del menu che cambiano progetto sono sospesi.
- **AC-8**: Prima di ogni scrittura che cambia il contenuto, la versione precedente del file passa in `progetti/_versioni/<slug>.1.json`, spostando le più vecchie in `.2` e `.3`; non esistono mai più di 3 versioni per progetto. Una scrittura identica al file attuale non crea versioni.
- **AC-9**: Ctrl+Z o il pulsante `↶ Annulla` riportano il modello e il file alla versione precedente, fino a 3 passi, anche dopo un riavvio; lo stato annullato resta recuperabile solo con Ripeti nella stessa sessione. Il pulsante è disabilitato quando non ci sono versioni o in `Conflitto`. Ctrl+Z non agisce mentre il cursore è in un campo di testo o una finestra è aperta. Nome e percorso della libreria non vengono annullati.
- **AC-10**: Ctrl+Y (o Ctrl+Shift+Z) o il pulsante `↷ Ripeti` riapplicano quanto annullato in questa sessione; una nuova modifica, l'apertura di un altro progetto o `Ricarica dal disco` svuotano l'elenco di Ripeti.
- **AC-11**: Il menu `Progetto ▾` offre: `Nuovo…`, `Apri…` (elenco ordinato per ultima modifica), `Salva una copia come…`, `Rinomina…`, `Elimina`, `Importa JSON…`, `Scarica JSON`. Un nome il cui slug esiste già dà un messaggio e non sovrascrive nulla. `Elimina` chiede conferma, sposta il file in `progetti/_cestino/` e apre il progetto modificato più di recente (o ne crea uno nuovo se non ne restano). Annullare la richiesta del nome non fa nulla.
- **AC-12**: `Importa JSON…` accetta un `modello.json` (`{ workspace }`), uno `standalone.json` (`{ library, workspace }`, la libreria viene ignorata con un avviso) o un file progetto; ne nasce un nuovo progetto in `progetti/`. Un file senza `nodes` e `edges` validi è rifiutato con un messaggio; tipi di blocco assenti dalla libreria corrente sono elencati in un avviso.
- **AC-13**: `Scarica JSON` scarica il file del progetto corrente come `<slug>.json`.
- **AC-14**: I pulsanti `Esporta i 3 File`, `Carica Solo Libreria` e `Carica Standalone` non ci sono più.
- **AC-15**: La radice del breadcrumb mostra il nome del progetto aperto, aggiornato anche dopo Rinomina.
- **AC-16**: Il server rifiuta: uno slug non valido o un nome riservato di Windows (400, nessun file toccato fuori da `progetti/`), una scrittura senza `Content-Type: application/json` (415), una richiesta `/api/` con `Host` o `Origin` diversi da `localhost`/`127.0.0.1` sulla porta del server (403), un corpo oltre 50 MB (413). La cartella `progetti/` non è servita come file statici (404).
- **AC-17**: Il file salvato ha la forma `{ formatVersion: 1, nome, libraryPath, workspace }`. Aprire un file con `formatVersion` maggiore di 1, o con JSON non valido, mostra un messaggio, non lo sovrascrive e lascia aperto il progetto precedente.

## Decision

**Chosen option**: Option 1: API di progetto in `start.py` con salvataggio automatico a debounce e 3 versioni su disco.

Il browser salva tramite nuovi endpoint `/api/progetti` e `/api/ultimo` aggiunti al `CustomHandler` di `start.py` (solo libreria standard), che scrivono in modo atomico dentro `progetti/`; il client rileva le modifiche confrontando il JSON del progetto quando smetti di modificare.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Modulo client**: nuovo `js/progetto.js` (stato del progetto, chiamate API, salvataggio, annulla e ripeti, menu, finestra Apri). Tiene separato il lavoro su disco dal resto; alternativa: allargare `storage.js`, che oggi ha un altro compito.
- **Aggancio a `render()`**: `render()` chiama `pianificaSalvataggio()` dopo il controllo `if (!appSettings) return`. La funzione riavvia un timer di `debounceMs`, ma non lo avvia finché un pulsante del mouse è premuto (trascinamento in corso); un `mouseup` su `window` lo riavvia. Così un trascinamento diventa sempre un solo salvataggio, anche con pause. Il confronto del JSON avviene solo allo scadere del timer.
- **Completamento dei valori predefiniti** (`completaModello(graph)`): `render()` e `enterNode` scrivono nel modello campi mancanti solo per ciò che è a schermo (`edge.waypoints`, `node.pinPositions`, `node.internal_graph`). Perché la sola vista non generi scritture, ogni modello caricato (apertura, import, annulla, ripeti, ricarica dal disco) passa prima da una visita ricorsiva di tutti i livelli che imposta `waypoints: []`, `pinPositions: {}`, `internal_graph: { nodes: [], edges: [] }` e `parentReqPositions: {}` dove mancano; solo dopo, e dopo la prima render, si calcola `ultimoTestoSalvato`. Le posizioni predefinite dei blocchi tondi (`parentReqPositions[id]`) si calcolano solo a schermo e restano l'unica scrittura accettata alla prima visita di un livello. Alternativa scartata: un confronto che ignora i campi vuoti, più fragile.
- **Una sola richiesta alla volta**: se arrivano modifiche mentre un salvataggio è in corso, al termine si confronta di nuovo e si pianifica un altro salvataggio.
- **Ritentativi**: dopo un errore si riprova a 2, 4, 8, 16, poi ogni 30 secondi; `Riprova` salva subito.
- **Svuotare prima di cambiare**: prima di Annulla, Ripeti, Nuovo, Apri, Salva una copia, Rinomina, Elimina e Importa si salva subito quanto in attesa (e si attende un salvataggio in corso). Se lo stato è `Errore` o `Conflitto`, o il salvataggio immediato fallisce, l'azione è annullata con un messaggio. Così Ctrl+Z subito dopo un'azione annulla proprio quell'azione.
- **Annulla**: la pila Ripeti riceve il testo attuale del progetto (dopo lo svuotamento); il server ripristina solo il `workspace` di `.1`, mantenendo `nome` e `libraryPath` attuali. Così una rinomina non si mescola con le versioni.
- **Ripeti**: pila in memoria di al massimo 3 testi JSON per progetto. Ripeti ricarica il testo in cima e lo salva con la normale scrittura (che crea una versione), marcata da un indicatore `daRipeti` perché non svuoti la pila. Qualunque altro salvataggio svuota la pila, e così l'apertura di un progetto, `Ricarica dal disco`, Rinomina ed Elimina.
- **Livello aperto dopo Annulla, Ripeti o Ricarica**: si ricostruisce il breadcrumb seguendo gli id dei nodi nel nuovo modello (etichetta `node.label || node.id`, `parentNode` = il nodo trovato) e ci si ferma al primo livello che non esiste più; `activeNodeId` si azzera se il nodo non c'è. Alternativa: tornare sempre alla radice, più semplice ma scomodo quando lavori dentro un blocco.
- **Ricarica dal disco**: `GET` del progetto, `completaModello`, sostituzione del modello, ricarica della libreria se `libraryPath` è cambiato, ricostruzione del breadcrumb, svuotamento di Ripeti, nuova impronta e nuovo `ultimoTestoSalvato`. **Sovrascrivi**: `PUT` con `forza: true`; il file modificato a mano finisce in `.1`, quindi resta recuperabile con Annulla.
- **Impronta del file** (il gettone che rileva i conflitti): SHA1 del contenuto del file in esadecimale, non l'ora di modifica, che su dischi FAT o cartelle di rete ha una risoluzione di 2 secondi e cambia anche quando un programma tocca il file senza modificarlo. L'ora di modifica (`modificato`, millisecondi) serve solo per ordinare e mostrare l'elenco.
- **Ultimo progetto**: il client chiama `PUT /api/ultimo` dopo ogni apertura o creazione riuscita (Nuovo, copia, import); il server lo aggiorna su Rinomina e lo azzera su Elimina.
- **Ordine di avvio**: `loadSettings()` → `GET /api/ultimo` → `GET` del progetto (oppure creazione o elenco, vedi AC-1 e AC-2) → `loadLibraryFromPath(progetto.libraryPath)` → `#libPathInput` = `libraryPath` → `completaModello` → `pathStack` alla radice con etichetta `nome` → `renderUI()` e `render()` → `ultimoTestoSalvato` → `PUT /api/ultimo`. Se la libreria non si carica: banner di avviso, resta la libreria predefinita, il salvataggio automatico resta attivo (salva solo il workspace, `libraryPath` invariato). Il vecchio caricamento da `appSettings.libraryPath` in `initApp()` viene tolto.
- **Pulsante 🔄 della libreria**: aggiorna `libraryPath` del progetto solo se il caricamento riesce; se il percorso è identico non cambia nulla nel testo, quindi non si scrive.
- **Cambio di libreria con modifiche in memoria**: finché la funzionalità 2 non c'è, aprire un progetto con un `libraryPath` diverso quando la libreria in memoria è stata modificata dall'ispettore chiede `confirm()` ("Le modifiche alla libreria non salvate andranno perse"). Il client tiene un indicatore `libreriaModificata`, impostato dal salvataggio dell'ispettore e azzerato a ogni caricamento della libreria.
- **Chiusura della scheda**: `beforeunload` chiede conferma in ogni stato diverso da `Salvato`; su `pagehide` si tenta un ultimo `PUT` con `fetch(..., { keepalive: true })` se ci sono modifiche in attesa (funziona solo sotto i 64 KB circa del limite del browser; oltre, resta la conferma).
- **Scorciatoie**: un `keydown` su `document` agisce solo se `e.target.closest('input, textarea, select, [contenteditable]')` è nullo e nessuna finestra (`#reportModal`) è aperta; chiama `preventDefault()` solo quando agisce (Ctrl+Y in alcuni browser apre la cronologia).
- **Nomi**: chiesti con `prompt()`, coerente con `alert()`/`confirm()` già in uso. Testo proposto: vuoto per Nuovo, "Copia di <nome>" per la copia, il nome attuale per Rinomina, il nome dal file per Importa. `null` (Annulla) non fa nulla. Slug = `slugifyId(nome)` troncato a 80 caratteri e ripulito da `_` finali; slug vuoto o riservato → "Il nome deve contenere almeno una lettera o cifra e non può essere un nome riservato di Windows". Slug già esistente → messaggio e nuova richiesta del nome.
- **Libreria di un nuovo progetto**: `libraryPath` del progetto corrente (resti sulla libreria già caricata); al primo avvio `appSettings.libraryPath`.
- **Elenco Apri**: riusa `#reportModal` (oggi senza gestori) con titolo "Apri progetto"; ogni riga mostra nome, slug e data di ultima modifica; i file `danneggiato` sono mostrati in grigio con l'indicazione "file non leggibile" e aprirli dà il messaggio di AC-17.
- **Import**: accetta un oggetto con `workspace` oppure con `nodes` e `edges` alla radice; `nodes` ed `edges` devono essere array, altrimenti messaggio e nessun progetto creato. `formatVersion` maggiore di 1 → messaggio di AC-17. Dopo la creazione, `alert()` elenca i `type` dei nodi (a ogni livello) assenti dalla libreria corrente; restano nel file ma non si vedono sul canvas.
- **Server multithread con un lucchetto**: `ThreadingHTTPServer` con un solo `threading.Lock` attorno a ogni operazione su `progetti/`. Il server a thread singolo si blocca sui socket lasciati aperti da Chrome in anticipo; il lucchetto mantiene le scritture una alla volta. Il gestore imposta `timeout = 10`. Non impostare `protocol_version = "HTTP/1.1"`.
- **Cartella `progetti/`**: ignorata da git nel repository dell'app (sono dati dell'utente, non codice).

## Rationale

Ragionamento e opzioni: vedi [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| File | Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|---|
| `progetti/<slug>.json` | `formatVersion` | intero | sì | `1`. Mancante in lettura → trattato come 1 (scritto al primo salvataggio che cambia il file) |
| | `nome` | stringa | sì | nome leggibile; `slug = slugifyId(nome)` |
| | `libraryPath` | stringa | sì | percorso della libreria, caricata all'apertura |
| | `workspace` | grafo | sì | lo stesso `pathStack[0].graph` di oggi: `{ nodes, edges, parentReqPositions? }` con `internal_graph` annidati |
| `progetti/_ultimo.json` | `progetto` | stringa o null | sì | slug da riaprire all'avvio |
| `progetti/_versioni/<slug>.N.json` | (intero file progetto) | | | N = 1 (più recente) … 3 |
| `progetti/_cestino/<slug>_<AAAAMMGG_HHMMSS>[_N].json` | (intero file progetto) | | | progetti eliminati; `_N` solo se il nome esiste già |

Relazioni: molti progetti → una libreria (via `libraryPath`). Unicità: lo slug è unico nella cartella (è il nome del file). Sono progetti solo i file `progetti/*.json` il cui nome rispetta il formato dello slug; tutto il resto (file con `_` iniziale, copie in conflitto di OneDrive, `.tmp`) è ignorato. Nessun timestamp dentro il file.

Server, formato su disco: `json.dump(progetto, ensure_ascii=False, indent=2)` in UTF-8; l'impronta è lo SHA1 dei byte scritti.

**State transitions** (stato del salvataggio nel client, mostrato dal badge):

`Salvato` → (modifica rilevata) → `Modifiche in attesa` → (timer scaduto) → `Salvataggio…` → `Salvato`
`Salvataggio…` → (errore di rete, 5xx, 503 `file_bloccato`) → `Errore di salvataggio` → (ritentativo o Riprova riuscito) → `Salvato`
`Salvataggio…` → (409 `conflitto`) → `Conflitto` → (Ricarica dal disco) → `Salvato` · (Sovrascrivi riuscito) → `Salvato`

In `Conflitto` sono sospesi salvataggio automatico, Annulla, Ripeti e le operazioni del menu tranne Scarica; in `Errore` i ritentativi continuano e le operazioni che cambiano progetto sono bloccate.

**API surface** (risposte JSON; errori come `{ errore: "<codice>", messaggio: "<testo italiano>" }`; tutte le rotte `/api/` controllano `Host` e `Origin`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/progetti` | GET | nessuno | `{ progetti: [{ slug, nome, modificato, danneggiato }] }` ordinati per `modificato` (ms) decrescente | solo locale | nessuno (file illeggibile → `danneggiato: true`, `nome = slug`) |
| `/api/progetti` | POST | `slug`: str (req), `progetto`: obj (req) | 201 `{ slug, impronta, versioni: 0 }` | solo locale | 400 `slug_non_valido` o `progetto_non_valido`, 409 `esiste` |
| `/api/progetti/{slug}` | GET | slug | `{ progetto, impronta, versioni }` | solo locale | 404, 422 `json_non_valido` |
| `/api/progetti/{slug}` | PUT | `progetto`: obj (req), `improntaAttesa`: str (req), `forza`: bool (opt) | `{ impronta, versioni }` | solo locale | 404, 409 `conflitto` (con `impronta` attuale), 503 `file_bloccato`, 500 `errore_scrittura` |
| `/api/progetti/{slug}/annulla` | POST | `improntaAttesa`: str (req) | `{ progetto, impronta, versioni }` | solo locale | 409 `nessuna_versione`, 409 `conflitto`, 503 `file_bloccato` |
| `/api/progetti/{slug}/rinomina` | POST | `nuovoSlug`: str (req), `nome`: str (req), `improntaAttesa`: str (req) | `{ slug, impronta, versioni }` (impronta del file con il nuovo nome) | solo locale | 404, 409 `esiste`, 409 `conflitto` |
| `/api/progetti/{slug}` | DELETE | slug | 204 | solo locale | 404 |
| `/api/ultimo` | GET | nessuno | `{ progetto: slug o null }` | solo locale | nessuno (file assente o illeggibile → `null`) |
| `/api/ultimo` | PUT | `progetto`: str (req) | 204 | solo locale | 400 `slug_non_valido` |
| qualunque `/api/` | OPTIONS | | 405 senza intestazioni CORS | | |

Validazione comune delle scritture: `Content-Length` assente o negativo → 411/400; oltre 50 MB → 413 senza leggere il corpo; JSON non valido → 400 `json_non_valido`; `progetto` deve essere un oggetto con `nome` stringa non vuota, `libraryPath` stringa, `workspace` oggetto con `nodes` ed `edges` array, `formatVersion` intero uguale a 1 → altrimenti 400 `progetto_non_valido`. Lo slug nell'URL è decodificato dal formato percentuale prima della validazione; una `/` finale è rifiutata.

Comportamento del server (sempre sotto il lucchetto):
- **Scrittura atomica** (`scrivi_atomico`): scrive `<nome>.tmp` nella stessa cartella, poi `os.replace`; su `PermissionError` riprova 5 volte a 50 ms, poi cancella il `.tmp` e risponde 503 `file_bloccato` ("Il file è bloccato da un altro programma, ad esempio OneDrive, un antivirus o un editor").
- **PUT**: se `improntaAttesa` ≠ impronta attuale e `forza` non è vero → 409. Se il nuovo contenuto serializzato è identico ai byte attuali → risponde con impronta e versioni attuali, senza rotazione. Altrimenti, in quest'ordine: elimina `.3`, rinomina `.2`→`.3`, `.1`→`.2`, copia il file attuale in `.1`, poi scrive il file principale per ultimo con `scrivi_atomico`. Un'interruzione a metà può lasciare una versione mancante o doppia, mai il file principale rovinato.
- **annulla**: legge `.1`, ne prende il `workspace` e lo scrive con `nome` e `libraryPath` attuali (atomico), poi `.2`→`.1`, `.3`→`.2`. Non crea una nuova versione.
- **rinomina**: se `nuovoSlug` = slug aggiorna solo `nome` (come un PUT). Altrimenti scrive il file con il nuovo `nome` sotto `nuovoSlug`, rinomina le versioni, elimina il vecchio file e aggiorna `_ultimo.json` se puntava al vecchio slug.
- **DELETE**: sposta il file in `_cestino/<slug>_<AAAAMMGG_HHMMSS>.json` (con `_2`, `_3`… se esiste già), cancella le sue versioni e azzera `_ultimo.json` se puntava a quello slug.
- **Statici**: le richieste GET a `/progetti` o `/progetti/...` rispondono 404 (il file si legge solo tramite `/api/`).
- **Avvio**: `start.py` crea `progetti/`, `progetti/_versioni/`, `progetti/_cestino/` se mancano (come fa per `shared/`), cancella i `.tmp` rimasti in `progetti/` e `_versioni/`, e legge `progetti.versioni` da `settings.json` (intero, minimo 1; predefinito 3 se manca o non è valido). Se il valore scende, le versioni oltre il limite vengono cancellate alla successiva rotazione di quel progetto.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Avvio | progetto da riaprire | `GET /api/ultimo` → `progetto`; `null` → primo di `GET /api/progetti` |
| Avvio senza progetti | nome e slug del primo progetto | costante "Nuovo progetto" → `slugifyId` → `nuovo_progetto` (se esiste: `nuovo_progetto_2`, `_3`…) |
| Avvio senza progetti | `libraryPath` del primo progetto | `appSettings.libraryPath` |
| Apertura | libreria da caricare | `progetto.libraryPath` → `loadLibraryFromPath()` |
| Apertura, Rinomina | radice del breadcrumb | `progetto.nome` → `pathStack[0].label` |
| Rilevamento modifica | testo da confrontare | `JSON.stringify({ formatVersion: 1, nome, libraryPath, workspace: pathStack[0].graph })` vs `ultimoTestoSalvato` |
| Timer | ritardo del salvataggio | `appSettings.progetti.debounceMs` (1000) |
| Timer | trascinamento in corso | pulsante premuto: `mousedown`/`mouseup` su `window` |
| Salvataggio, annulla, rinomina | `improntaAttesa` | `impronta` dell'ultima risposta GET, POST, PUT, annulla o rinomina (stringa, confrontata solo per uguaglianza) |
| Salvataggio | numero massimo di versioni | `settings.json` `progetti.versioni` letto da `start.py` (3) |
| Badge | stato | macchina a stati sopra |
| Banner errore | motivo | `messaggio` della risposta, o "Server non raggiungibile" su errore di rete |
| Pulsante Annulla | abilitato o no | `versioni` > 0 dall'ultima risposta e stato diverso da `Conflitto` |
| Pulsante Ripeti | abilitato o no | pila Ripeti non vuota e stato diverso da `Conflitto` |
| Annulla | stato da mettere in Ripeti | testo del progetto dopo lo svuotamento |
| Ripeti | salvataggio che non svuota la pila | indicatore `daRipeti` sul salvataggio |
| Cambio percorso libreria | nuovo `libraryPath` | valore di `#libPathInput` dopo un `loadLibraryFromPath` riuscito |
| Cambio di progetto | avviso libreria non salvata | indicatore `libreriaModificata` (salvataggio dell'ispettore → vero; caricamento libreria → falso) |
| Nuovo | nome e slug | `prompt()` → `slugifyId`, massimo 80 caratteri |
| Nuovo | `libraryPath` | `libraryPath` del progetto corrente |
| Salva una copia | contenuto e nome proposto | progetto corrente con il nuovo `nome`; proposta "Copia di <nome>" |
| Rinomina | nome proposto | `nome` attuale |
| Importa | nome proposto | `nome` nel file se presente, altrimenti nome del file senza `.json` |
| Importa | `workspace` | `data.workspace`; se il file ha `nodes` e `edges` alla radice, il file stesso |
| Importa | `libraryPath` | `libraryPath` nel file se presente, altrimenti quello del progetto corrente |
| Importa | tipi mancanti | `type` di ogni nodo a ogni livello non presente in `appState.library` |
| Elenco Apri | nome, data, stato | `GET /api/progetti` (`nome`, `modificato` in ms → `new Date(modificato)`, `danneggiato`) |
| Elimina | progetto da aprire dopo | primo elemento di `GET /api/progetti`; lista vuota → crea "Nuovo progetto" |
| Scarica | nome del file | `<slug>.json` |

**Key invariants**:
- Il server scrive, sposta o cancella solo dentro `progetti/`; ogni slug ricevuto rispetta `^[a-z0-9]+(_[a-z0-9]+)*$` (lo stesso formato prodotto da `slugifyId`), massimo 80 caratteri, e non è un nome riservato di Windows (`con`, `prn`, `aux`, `nul`, `com1`…`com9`, `lpt1`…`lpt9`); quindi non può iniziare con `_` né contenere `/`, `\` o `..`.
- Il file principale di un progetto è sempre JSON completo (scrittura su `.tmp` poi `os.replace`, scritto per ultimo).
- Per ogni progetto esistono al massimo `progetti.versioni` (3) versioni, e due versioni consecutive non sono mai identiche al file attuale per effetto di una scrittura senza modifiche.
- Tutte le operazioni su `progetti/` sono serializzate dal lucchetto del server.
- Il client non ha mai più di una richiesta di salvataggio in volo, e non cambia progetto con modifiche non salvate.
- Nessuna scrittura se il testo del progetto è uguale a `ultimoTestoSalvato`.
- Ogni modello caricato passa da `completaModello` prima di calcolare `ultimoTestoSalvato`.
- Ogni mutazione del modello è seguita da `render()` (convenzione esistente in `js/AGENTS.md`, verificata su tutte le mutazioni del grafo); è ciò che fa partire il salvataggio.
- Il server non sovrascrive mai un file cambiato da quando il client l'ha letto, salvo `forza: true`.

**Security model**:
- Un solo utente in locale, nessuna autenticazione. Il server resta in ascolto solo su `127.0.0.1`.
- Difesa da pagine web estranee aperte nello stesso browser: le scritture (POST, PUT, DELETE) richiedono `Content-Type: application/json`, così un altro sito non può inviarle senza un controllo preventivo CORS, a cui il server risponde 405 senza intestazioni → 415 altrimenti. Su tutte le rotte `/api/`: `Host` deve essere `localhost:<PORT>` o `127.0.0.1:<PORT>` (evita il DNS rebinding, cioè un dominio esterno che punta a 127.0.0.1) e `Origin`, se presente, `http://localhost:<PORT>` o `http://127.0.0.1:<PORT>` → 403 altrimenti.
- `progetti/` non è servita come file statici; corpo limitato a 50 MB.
- Nessun dato regolamentato.

**Configuration required**:
- `settings.json` → `"progetti": { "debounceMs": 1000, "versioni": 3 }`. Aggiungere la stessa chiave a `DEFAULT_SETTINGS` in `js/state.js` e al merge annidato di `loadSettings()`. Nessuna variabile d'ambiente.
- `.gitignore` → aggiungere `progetti/`.

**Critical test scenarios**:
- Happy path: avvio a cartella vuota → nasce `nuovo_progetto.json`; trascini un blocco con una pausa a metà, dopo il rilascio e circa 1 s il file contiene il nodo e c'è una sola versione nuova; riavvii `start.py` e ritrovi il progetto, verifica **AC-1**, **AC-2**, **AC-3**.
- Solo vista: su un progetto con blocchi annidati già visitati, zoom, pan, entri in un blocco, cambi filtro e "Nascondi Non Coinvolti": l'impronta del file e il numero di versioni non cambiano, verifica **AC-4**, **AC-8**.
- Server fermo: fermi `start.py`, sposti un blocco → badge rosso e banner; riavvii il server → al ritentativo il banner sparisce e il file ha lo spostamento, verifica **AC-6**.
- File bloccato: apri il file del progetto in un programma che lo blocca, sposti un blocco → banner con il messaggio `file_bloccato`; lo chiudi → il ritentativo riesce, verifica **AC-6**.
- Conflitto: modifichi il file a mano con l'app aperta, poi sposti un blocco → `Conflitto`, Annulla disabilitato, il file a mano resta intatto; `Sovrascrivi` lo mette in `.1`, verifica **AC-7**.
- Annulla e ripeti: 4 modifiche separate → in `_versioni` ci sono 3 file; 3 Ctrl+Z riportano allo stato dopo la prima modifica, il quarto non fa nulla (pulsante disabilitato); Ctrl+Y riapplica; una nuova modifica disabilita Ripeti; Ctrl+Z dentro un campo dell'ispettore non tocca il modello, verifica **AC-8**, **AC-9**, **AC-10**.
- Rinomina e annulla: rinomini il progetto, poi Ctrl+Z → il modello torna indietro, il nome resta il nuovo, verifica **AC-9**, **AC-15**.
- Nome duplicato: `Salva una copia come` con il nome di un progetto esistente → messaggio e nuova richiesta, nessun file sovrascritto, verifica **AC-11**.
- Accesso negato: `PUT /api/progetti/..%2Fsettings` → 400; `PUT /api/progetti/con` → 400; `POST` con `Content-Type: text/plain` → 415; richiesta con `Origin: http://example.com` o `Host: evil.example:8080` → 403; `GET /progetti/nuovo_progetto.json` → 404, verifica **AC-16**.

## Build plan

Ordine Tracer Bullet: prima un filo completo dal canvas al file su disco, poi lo si irrobustisce e allarga.

1. **Filo minimo dal canvas al disco.** `start.py`: `ThreadingHTTPServer` con lucchetto e `timeout`, creazione di `progetti/` e sottocartelle, pulizia dei `.tmp`, lettura di `progetti.versioni` da `settings.json`, instradamento `/api/...` nel `CustomHandler` (`do_GET`, `do_PUT`, `do_POST`, `do_DELETE`, `do_OPTIONS`), blocco degli statici su `/progetti`, validazione di slug e nomi riservati, `Content-Type`, `Host`, `Origin`, dimensione e forma del corpo; `scrivi_atomico` con ritentativi; `GET /api/progetti`, `POST /api/progetti`, `GET` e `PUT /api/progetti/{slug}` con impronta SHA1 e controllo `improntaAttesa`. Client: chiave `progetti` in `settings.json` e `state.js`; nuovo `js/progetto.js` con `completaModello`, apertura, creazione di "Nuovo progetto" se la cartella è vuota, `pianificaSalvataggio()` in `render()` con sospensione durante il trascinamento, confronto del testo, badge di stato; `formatVersion` e JSON non valido gestiti all'apertura; `progetti/` in `.gitignore`. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-16**, **AC-17**.
2. **Riapertura e libreria del progetto.** `GET`/`PUT /api/ultimo`; nuovo ordine di avvio in `initApp()` (l'ultimo progetto, il più recente, o l'elenco se manca); libreria caricata da `progetto.libraryPath`; il pulsante 🔄 aggiorna `libraryPath` del progetto; indicatore `libreriaModificata` e conferma al cambio di libreria; nome del progetto come radice del breadcrumb. Satisfies **AC-2**, **AC-3**, **AC-15**.
3. **Errori e conflitti.** Banner rosso con `Riprova`, ritentativi a intervalli crescenti, `beforeunload` e salvataggio `keepalive` su `pagehide`; gestione del 409 con `Ricarica dal disco` e `Sovrascrivi` (`forza: true`), sospensione del salvataggio automatico e delle azioni che cambiano progetto. Satisfies **AC-6**, **AC-7**.
4. **Versioni, Annulla e Ripeti.** Rotazione delle versioni nel `PUT` (salvo contenuto identico); `POST /api/progetti/{slug}/annulla` che ripristina solo il workspace; pulsanti `↶ Annulla` e `↷ Ripeti` nell'header, scorciatoie Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z con le esclusioni per campi e finestre; svuotamento prima di annullare; pila Ripeti con indicatore `daRipeti`; ricostruzione del breadcrumb per id. Satisfies **AC-8**, **AC-9**, **AC-10**.
5. **Menu Progetto.** `POST .../rinomina` e `DELETE` (cestino con contatore, `_ultimo` aggiornato o azzerato); menu `Progetto ▾` con Nuovo, Apri (finestra su `#reportModal`, file danneggiati in grigio), Salva una copia come, Rinomina, Elimina, Importa JSON (validazione e avviso sui tipi mancanti), Scarica JSON, tutti preceduti dallo svuotamento; rimozione dei tre pulsanti e degli input file nascosti da `index.html` e delle funzioni `exportAllFormats`, `importProjectJson`, `importLibraryJson` da `storage.js` (restano `leggiFileJson` e `downloadJsonFile`, esportate e usate dal menu). Satisfies **AC-11**, **AC-12**, **AC-13**, **AC-14**, **AC-15**.

## Consequences

**Positive**:
- Il lavoro non si perde più e il file in `progetti/` è sempre la fonte di verità, leggibile e confrontabile.
- Tre passi di annullamento che sopravvivono al riavvio, senza toccare la logica di disegno dei moduli esistenti.
- Nessuna nuova dipendenza: solo libreria standard Python e JS nativo; l'exe si ricompila senza cambiare `start.spec`.

**Negative / tradeoffs**:
- L'app ora richiede che il server sia vivo per salvare; aprirla da un semplice server statico funziona ma non salva (lo segnala il banner).
- Annulla ha la granularità di un salvataggio: più azioni fatte entro un secondo diventano un solo passo.
- Solo 3 passi: un errore scoperto più tardi va recuperato a mano (dal cestino o da una copia). La prima visita a un livello senza posizioni dei blocchi tondi consuma una versione.
- Finché la funzionalità 2 non c'è, le modifiche alla libreria fatte dall'ispettore restano solo in memoria; se rinomini l'id di un requisito, il progetto salvato usa il nuovo id mentre `libreria.json` su disco ha ancora il vecchio. Cambiare progetto con una libreria diversa le perde (con conferma).
- `start.py` passa da semplice server di file a piccola applicazione multithread con API: va mantenuto e verificato come il resto.
- Se `progetti/` sta in una cartella sincronizzata (OneDrive), i blocchi temporanei del file sono frequenti: il salvataggio riprova, ma il banner può comparire per qualche secondo.

**Neutral**:
- Il confronto del JSON serializza l'intero modello una volta per ogni pausa, non per ogni render; con migliaia di requisiti resta nell'ordine dei millisecondi. Lo SHA1 lato server costa altrettanto poco.
- L'import di file vecchi ora passa dal menu Progetto e crea sempre un nuovo progetto invece di sostituire quello aperto.
- Un file senza `formatVersion` viene aggiornato al formato 1 solo al primo salvataggio che lo cambia.

## Follow-up

- [ ] Costruire la funzionalità 2 (Libreria su disco con changelog) subito dopo questa: senza, una modifica agli id dei requisiti in libreria può disallineare il progetto salvato dalla libreria su disco al riavvio. Quando arriva, rimuovere l'indicatore `libreriaModificata` e la sua conferma.
- [ ] `/sync` dopo la costruzione: aggiornare `js/AGENTS.md` (nuovo `js/progetto.js`, ruolo ridotto di `storage.js`, `render()` che pianifica il salvataggio, `completaModello`, formato del file progetto) e i Gotchas di `AGENTS.md` (l'exe crea `progetti/` accanto a sé; `start.py` ha un'API `/api/` multithread con lucchetto).
- [ ] Aggiornare il commento di intestazione di `js/storage.js` al nuovo ruolo (solo lettura file e download), per la regola `/* --- TITOLO --- */`.
