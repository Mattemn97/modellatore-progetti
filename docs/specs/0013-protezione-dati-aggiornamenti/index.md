# 0013. Protezione dei dati negli aggiornamenti: impostazioni dell'utente fuori dal pacchetto

**Date**: 2026-10-02
**Status**: In Progress

## Summary

Un aggiornamento non deve mai toccare il lavoro delle persone. Progetti e librerie sono già al sicuro, perché il pacchetto contiene `progetti/` e `shared/` vuote. Le impostazioni invece no: lo zip contiene `settings.json`, quindi chi lo estrae sopra un'installazione perde le sue modifiche. D'ora in poi il pacchetto porta `settings.predefinite.json` (i valori di fabbrica) e mai `settings.json`. `start.py` crea `settings.json` copiandolo dai predefiniti solo quando manca, e non lo riscrive mai. Una lista unica in `start.py` dice quali percorsi appartengono all'utente, così l'aggiornamento automatico (funzionalità 15) sa cosa non toccare.

## Requirements

**User stories**:
- Come utente voglio aggiornare l'app estraendo lo zip nuovo senza perdere progetti, librerie e impostazioni, anche se non leggo le istruzioni.
- Come sviluppatore della funzionalità 15 voglio una lista unica nel codice dei percorsi che appartengono all'utente, per non doverla dedurre.

**Acceptance criteria**:
- **AC-1**: Lo zip prodotto da `packaging/crea-pacchetto.ps1` non contiene `settings.json`; contiene `settings.predefinite.json`, identico byte per byte al `settings.json` del repository; contiene `progetti/` e `shared/` vuote. Lo script si ferma con un errore se la cartella del pacchetto, prima della compressione, contiene un percorso di `PERCORSI_UTENTE` che sia un file (`settings.json`) o un qualsiasi file, anche nascosto e a qualsiasi profondità, dentro quelli che sono cartelle (`Get-ChildItem -Recurse -Force -File`). La lista la legge da `start.py` (AC-6) e si ferma con un errore anche se non la trova. L'uguaglianza con il file del repository si controlla con `Get-FileHash`.
- **AC-2**: All'avvio, se `settings.json` manca e `settings.predefinite.json` esiste, `start.py` copia `settings.predefinite.json` in `settings.json` prima di leggere qualsiasi impostazione, e scrive in console la riga `Impostazioni create da settings.predefinite.json`. La copia è fedele anche se il file predefinito non è JSON valido (quel caso dà i valori predefiniti come un `settings.json` rotto). Se la copia fallisce scrive `Impossibile creare settings.json: <motivo>` e l'avvio continua. Se mancano entrambi non crea nulla e l'app usa i valori predefiniti come oggi.
- **AC-3**: Se `settings.json` esiste, `start.py` non lo scrive, non lo sposta e non lo cancella mai, nemmeno se non è JSON valido: dopo l'avvio è identico byte per byte. Un `settings.json` non valido continua a dare i valori predefiniti, come oggi.
- **AC-4**: Estraendo lo zip nuovo sopra un'installazione che ha un `settings.json` modificato, progetti con versioni e cestino, librerie con changelog e copie in `shared/_versioni/`, dopo l'estrazione e un avvio di `start.exe` tutti quei file sono identici byte per byte, e l'app si apre con le impostazioni modificate.
- **AC-5**: Una chiave presente in `DEFAULT_SETTINGS` ma assente dal `settings.json` dell'utente vale il suo predefinito nell'app, e le chiavi lette da `start.py` (`progetti.versioni`, `libreria.versioni`, `cliente.maxFileMB`) valgono il loro predefinito Python. È il comportamento di oggi, da non rompere.
- **AC-6**: `start.py` definisce la costante `PERCORSI_UTENTE = ('progetti', 'shared', 'settings.json')` con un commento che la dichiara la lista dei percorsi che nessun aggiornamento può scrivere, spostare o cancellare.
- **AC-7**: La sezione "Backup e aggiornamenti" di `packaging/TUTORIAL.md` non chiede più di salvare `settings.json`; spiega che `settings.json`, `progetti\` e `shared\` non vengono mai toccati da un aggiornamento, che `settings.predefinite.json` contiene i valori di fabbrica (cancellando `settings.json` l'app lo ricrea da lì al prossimo avvio), e che i file di `esempi\` vengono sovrascritti a ogni aggiornamento (vanno copiati altrove prima di modificarli). La tabella del contenuto della cartella elenca `settings.predefinite.json`.
- **AC-8**: La prova di avvio nel workflow `.github/workflows/rilascio.yml` controlla anche, dopo la risposta HTTP 200 e prima di fermare il processo, che `settings.json` esista nella cartella del pacchetto e abbia lo stesso `Get-FileHash` di `settings.predefinite.json`.

## Decision

**Chosen option**: Option 2: File predefinito nel pacchetto e copia al primo avvio.

Il pacchetto porta `settings.predefinite.json` e mai `settings.json`; `start.py` crea `settings.json` solo se manca e non lo riscrive mai; `PERCORSI_UTENTE` in `start.py` è la lista unica dei percorsi dell'utente.

**Decisioni di dettaglio**:
- Copia con `shutil.copyfile` in una funzione `prepara_impostazioni(base_dir)` chiamata in `main()` subito dopo `os.chdir`, prima di `ensure_shared_library` e di ogni `leggi_max_*`. Il controllo è `os.path.exists` sul file (non `isfile`): se al posto di `settings.json` c'è qualcosa, non si tocca. Un errore di copia (`OSError`) scrive un avviso in console e l'avvio continua con i predefiniti. Scartato: generare `settings.json` da un dizionario dentro `start.py` (terza copia dei predefiniti da tenere allineata).
- Il controllo del pacchetto sta in `crea-pacchetto.ps1`, dopo la copia dei file e prima della compressione, e legge la tupla `PERCORSI_UTENTE` da `start.py` con una espressione regolare, così le due liste non si separano mai. Scartato: una lista locale nello script (si dimentica di aggiornarla); un controllo solo nel workflow (chi crea il pacchetto a mano lo salterebbe).
- `esempi/` resta un file dell'app: si sostituisce a ogni aggiornamento, e il tutorial lo dice. Scartato: proteggerla (l'utente lavora sulle copie importate nei progetti, non sui file di esempio).

**Implementation skills**: none.

## Rationale

Ragionamento e opzioni: vedi [rationale.md](rationale.md).

## Feature design

**Data model sketch**: nessun dato nuovo. Due file nella cartella dell'app:
- `settings.predefinite.json`: file dell'app, creato da `crea-pacchetto.ps1` come copia del `settings.json` del repository, sostituito a ogni aggiornamento.
- `settings.json`: file dell'utente, creato da `start.py` solo se manca, poi mai scritto dall'app.

**API surface**: nessuna rotta nuova. `/settings.json` resta servito come file statico.

| Funzione / costante | Dove | Cosa fa |
|---|---|---|
| `PERCORSI_UTENTE` | `start.py` | `('progetti', 'shared', 'settings.json')`, relativi alla cartella base |
| `prepara_impostazioni(base_dir)` | `start.py` | copia i predefiniti in `settings.json` se manca; restituisce `True` se ha copiato |

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Avvio | cartella base | `get_base_dir()` (cartella dell'exe o dello script) |
| Avvio | esiste `settings.json` | `os.path.exists(os.path.join(base_dir, 'settings.json'))` |
| Avvio | contenuto da copiare | `settings.predefinite.json` nella cartella base |
| Pacchetto | `settings.predefinite.json` | `settings.json` del repository, copiato da `crea-pacchetto.ps1` |
| App | chiave assente dal file utente | `DEFAULT_SETTINGS` in `js/state.js`; costanti `*_PREDEFINITO` / `VERSIONI_PREDEFINITE` in `start.py` |

**Key invariants**:
- Nessun codice dell'app scrive, sposta o cancella un percorso di `PERCORSI_UTENTE` durante un aggiornamento. L'app li scrive solo per il lavoro normale (salvataggi, versioni, cestino), come oggi.
- Il pacchetto non contiene mai un file dentro un percorso di `PERCORSI_UTENTE`.
- `settings.json` si crea solo se manca, mai si riscrive.

**Security model**: tutto locale, nessun dato nuovo esposto. `settings.predefinite.json` è servito come file statico, come `settings.json` oggi: contiene solo valori di interfaccia.

**Configuration required**: nessuna chiave nuova.

**Critical test scenarios**:
- Creare il pacchetto e aprire lo zip: niente `settings.json`, `settings.predefinite.json` uguale al file del repository, `progetti/` e `shared/` vuote. Mettere un file in `shared/` della cartella del pacchetto: lo script si ferma. Verifica **AC-1**.
- Cartella con solo `settings.predefinite.json`: avvio, `settings.json` creato uguale e riga in console. Senza nessuno dei due: avvio normale, nessun file creato. Verifica **AC-2**, **AC-8**.
- `settings.json` modificato e uno non valido: dopo l'avvio sono identici byte per byte. Verifica **AC-3**.
- Installazione piena di dati in una cartella di prova (il pacchetto vero estratto, poi `settings.json` con un colore cambiato, un progetto con `_versioni/` e `_cestino/`, una libreria con `.changelog.json` e `shared/_versioni/`), elenco SHA256 di `settings.json`, `progetti/**` e `shared/**`; estrazione dello zip nuovo sopra con `Expand-Archive -Force`; avvio su una porta di prova: elenco SHA256 identico, colore personalizzato visibile nell'app. Verifica **AC-4**.
- `settings.json` senza la sezione `matrice`: l'app usa `gruppiVisibili` 300. Verifica **AC-5**.

## Build plan

1. `PERCORSI_UTENTE` e `prepara_impostazioni()` in `start.py`, chiamata in `main()` prima di ogni lettura delle impostazioni, con la riga in console. Satisfies **AC-2**, **AC-3**, **AC-5**, **AC-6**.
2. `crea-pacchetto.ps1`: copia di `settings.json` come `settings.predefinite.json`, nessun `settings.json` nella cartella del pacchetto, lettura di `PERCORSI_UTENTE` da `start.py` con una espressione regolare e controllo dei percorsi dell'utente prima dello zip. Satisfies **AC-1**.
3. Prova di avvio del workflow: controllo di `settings.json` creato e uguale ai predefiniti. Satisfies **AC-8**.
4. Tutorial: sezione "Backup e aggiornamenti" e tabella della cartella. Satisfies **AC-7**.
5. Prova di aggiornamento sopra un'installazione piena di dati con il pacchetto creato davvero. Satisfies **AC-4**.

## Consequences

**Positive**:
- Estrarre lo zip sopra un'installazione non può più cancellare né sovrascrivere dati dell'utente.
- La funzionalità 15 parte da una regola scritta e da una lista nel codice.

**Negative / tradeoffs**:
- Un valore di fabbrica cambiato per una chiave esistente non raggiunge chi ha già `settings.json`; lo trova solo in `settings.predefinite.json`.
- La protezione vale per l'estrazione sopra l'installazione. Chi cancella la cartella e la estrae da capo, o usa un programma che svuota la cartella prima di estrarre, perde comunque i dati: il tutorial continua a consigliare il backup di `progetti\` e `shared\`.
- Le installazioni di oggi, al primo aggiornamento, tengono il loro `settings.json` ma ricevono anche `settings.predefinite.json`: due file con nomi simili nella cartella.

**Neutral**:
- Nessuna migrazione: un'installazione vecchia ha già il suo `settings.json`, lo zip nuovo semplicemente non lo contiene.
- Lo sviluppo non cambia: nel repository `settings.json` resta il file tracciato e `start.py` lanciato a mano lo trova già.

## Follow-up

- [ ] La funzionalità 15 deve sostituire solo un elenco esplicito di file dell'app (lista ammessa, non "tutto tranne `PERCORSI_UTENTE`"), così un file utente nuovo non elencato resta comunque al sicuro; `PERCORSI_UTENTE` resta il controllo di sicurezza in più.
- [ ] La funzionalità 15 deve gestire `start.exe` in uso (non si sovrascrive mentre gira: rinomina e riavvio).
