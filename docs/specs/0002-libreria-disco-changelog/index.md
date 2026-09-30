# 0002. Libreria su disco con versione semver e changelog

**Date**: 2026-09-30
**Status**: Accepted

## Summary

Ogni `Salva` nell'ispettore scrive il blocco nella libreria su disco (dentro `shared/`) prima di toccare la memoria e il progetto, così libreria e progetto non si disallineano più. Il server `start.py` confronta il blocco nuovo con quello su disco, calcola se la modifica è major, minor o patch (versione semantica, cioè `MAJOR.MINOR.PATCH`), avanza la versione e aggiunge una voce a `<nome>.changelog.json` con data, autore, livello, nota facoltativa e l'elenco di cosa è cambiato. Anche le modifiche fatte a mano al file vengono riconosciute e registrate. Il changelog si legge in una finestra dell'app, anche filtrata sul singolo blocco.

## Requirements

**User stories**:
- Come progettista voglio che ogni blocco salvato finisca subito nella libreria su disco, così riavviando ritrovo la libreria come l'ho lasciata e il progetto non punta a requisiti che su disco non esistono.
- Come progettista voglio che ogni modifica alla libreria avanzi una versione `MAJOR.MINOR.PATCH` con data e ora, così capisco a colpo d'occhio se una modifica rompe i progetti.
- Come progettista voglio leggere nell'app cosa è cambiato, quando, da chi e perché, per tutta la libreria o per un solo blocco.
- Come progettista voglio che una modifica fatta a mano al file non passi inosservata.

**Acceptance criteria**:
- **AC-1**: Il `Salva` dell'ispettore (blocco nuovo, blocco modificato, blocco nato da `Crea copia`) scrive la libreria su disco e solo dopo la risposta positiva aggiorna `appState.library`, il progetto (rinomine, fili rimossi, etichetta del nodo) e il pannello libreria. Il file ha la forma `{ formatVersion: 1, versione, library }`. Riavviando `start.py` il blocco salvato c'è.
- **AC-2**: Se la scrittura fallisce o viene rifiutata (server fermo, file bloccato, errore di disco, percorso non scrivibile, id del blocco o di un requisito già presente su disco, rinomine non più valide) compare un messaggio con il motivo; il form dell'ispettore resta aperto con i dati inseriti, e `appState.library`, il progetto e i file su disco restano come prima.
- **AC-3**: Ogni `Salva` che cambia il contenuto aggiunge in fondo a `<nome>.changelog.json` (accanto alla libreria) una voce con: `versione`, `data` (ISO 8601 con fuso), `autore` (utente di Windows), `origine: "app"`, `livello`, `livelloCalcolato`, `nota`, `impronta` e `improntaContenuto` del file scritto e `modifiche`: per il blocco id, titolo, tipo (`creato` o `modificato`), nomi dei campi del blocco cambiati, e per ogni requisito toccato id, tipo (`aggiunto`, `modificato`, `rimosso`, `rinominato` con `idPrecedente`) e nomi dei campi cambiati. Nessun valore vecchio o nuovo viene registrato.
- **AC-4**: Il livello calcolato è **major** se un requisito è rimosso o rinominato o cambia `tipologia` (compreso il passaggio tra interfaccia e capacità), o se un blocco è eliminato; **minor** se nasce un blocco o si aggiunge un requisito; **patch** per tutto il resto (titolo, descrizione, categoria, sottocategoria, metodo di verifica, testi da esportare, ordine dei requisiti). Accanto a `Salva` il selettore `Livello` (`Automatico`, `Patch`, `Minor`, `Major`, predefinito `Automatico`) permette di alzarlo; un livello scelto più basso del calcolato viene ignorato e si usa il calcolato. La versione avanza secondo semver: major → `(M+1).0.0`, minor → `M.(m+1).0`, patch → `M.m.(p+1)`.
- **AC-5**: Un `Salva` che non cambia nulla rispetto al disco non scrive nessun file, non avanza la versione e mostra "Nessuna modifica da salvare".
- **AC-6**: Il campo `Motivo della modifica` nell'ispettore è facoltativo; il testo finisce in `nota` (vuoto ammesso). Livello e motivo tornano ai valori predefiniti dopo ogni `Salva` riuscito.
- **AC-7**: Se `libreria.json` è cambiata su disco dopo che l'app l'ha letta, il `Salva` non scrive: compare un banner "La libreria è cambiata su disco" con `Ricarica la libreria` (ricarica dal disco, riapre il blocco nell'ispettore e perde solo le modifiche del form) e `Sovrascrivi` (scrive il tuo blocco sopra la versione attuale su disco; gli altri blocchi restano quelli del disco). Finché il progetto (0001) è in `Conflitto`, `Salva` è bloccato con il messaggio "Risolvi prima il conflitto del progetto".
- **AC-8**: Quando il contenuto dei blocchi su disco (`library`, confrontato in forma canonica) non corrisponde più all'ultima voce del changelog (modifica a mano o scrittura interrotta), all'apertura della libreria o prima del successivo salvataggio il server aggiunge una voce `origine: "esterna"` con il confronto per blocco e per requisito rispetto all'ultimo contenuto noto (i requisiti con id cambiato risultano `rimosso` più `aggiunto`), calcola il livello con le regole di AC-4 e avanza la versione. L'app mostra un avviso "La libreria è stata modificata fuori dall'app: registrata come versione X", che resta visibile fino al caricamento successivo. Cambiare solo spazi, a capo, ordine delle chiavi o i campi `versione` e `formatVersion` non produce voci.
- **AC-9**: Alla prima apertura di una libreria scrivibile senza changelog il server crea solo `<nome>.changelog.json` con una voce `origine: "iniziale"` (versione `1.0.0`, oppure il campo `versione` del file se è già un semver valido) senza modificare il file della libreria. I formati vecchi (mappa semplice come `shared/libreria.json` oggi, oppure `{ library }`) vengono convertiti a `{ formatVersion: 1, versione, library }` al primo `Salva`; la conversione in sé non è una modifica e non compare nel changelog.
- **AC-10**: Prima di ogni scrittura della libreria la versione precedente del file passa in `<cartella>/_versioni/<nome>.1.json`, spostando le più vecchie in `.2` e `.3`; non esistono mai più di `libreria.versioni` copie (predefinito 3). Nell'app non c'è un Annulla della libreria.
- **AC-11**: Una libreria caricata da un percorso fuori da `shared/` (o da un indirizzo web), con `formatVersion` maggiore di 1 o con un changelog non leggibile è in sola lettura: nel pannello libreria compare l'etichetta `Sola lettura`, `Salva` e `Crea copia` sono disabilitati con il motivo nel suggerimento, i blocchi si trascinano nel progetto come sempre. La versione mostrata è l'ultima voce del changelog se esiste, altrimenti il campo `versione` del file, altrimenti "n/d".
- **AC-12**: Il pulsante `📜 Changelog` nel pannello libreria apre una finestra con le voci dalla più recente, ciascuna con versione, data e ora locali, autore, origine, livello, nota e l'elenco delle modifiche. Un campo filtro mostra solo le voci che toccano un blocco (id o titolo) o un id requisito. Nell'ispettore di un blocco esistente il collegamento `Storia` apre la stessa finestra già filtrata su quel blocco.
- **AC-13**: Il pannello libreria mostra la versione corrente (`v1.3.0`) accanto al titolo, aggiornata dopo ogni `Salva` e ogni caricamento.
- **AC-14**: Il server rifiuta: un `percorso` assoluto, con `..`, che non finisce in `.json`, che termina in `.changelog.json` o che risolto sul disco esce dalla cartella dell'app o entra in `progetti/` (400 `percorso_non_valido`); una scrittura fuori da `shared/` o dentro `_versioni/` (403 `percorso_non_scrivibile`); un blocco o un campo non valido (400); un id requisito già usato da un altro blocco (400 `id_duplicato`). Valgono i controlli di 0001 su `Content-Type`, `Host`, `Origin` e dimensione del corpo.
- **AC-15**: L'indicatore `libreriaModificata` e la conferma "Le modifiche alla libreria non salvate andranno perse" di 0001 non esistono più: cambiare progetto o libreria non chiede conferma per la libreria.

## Decision

**Chosen option**: Option 1: API di libreria in `start.py`, salvataggio per blocco, confronto e versione calcolati dal server.

Il client invia al server solo il blocco salvato (con le rinomine dei requisiti, il livello scelto e la nota); il server, sotto il lucchetto di 0001, lo confronta con il blocco su disco, calcola livello e versione, scrive in modo atomico libreria, changelog e copia di riferimento, e restituisce la libreria intera che il client adotta.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Modulo client**: nuovo `js/libreria.js` (stato della libreria su disco: percorso, versione, impronta, scrivibile, formato; chiamate API; banner di conflitto; finestra Changelog). `builder.js` resta per l'albero; `loadLibraryFromPath()` passa per `libreria.js`. Alternativa: allargare `progetto.js`, già grande (868 righe) e con un altro compito.
- **Prima il disco, poi la memoria**: il gestore di `btnSaveBlockToLib` in `inspector.js` diventa asincrono; valida come oggi, disabilita `Salva` durante la richiesta, chiama `salvaBloccoLibreria()`, e solo in caso di successo esegue `impostaLibreria(risposta.libreria)` (che già ridisegna l'albero), `aggiornaRiferimentiRequisiti(...)` con la mappa delle rinomine, l'etichetta del nodo, `render()` (che fa partire il salvataggio automatico del progetto di 0001) e `openLibraryBlock()`. Alternativa scartata: applicare subito e ritentare, che lascia il progetto con id che su disco non esistono.
- **Salvataggio per blocco**: il corpo porta solo `blocco`, non la libreria intera. Così `Sovrascrivi` sostituisce solo il tuo blocco e non riporta indietro gli altri, e il confronto riguarda esattamente ciò che hai toccato. Alternativa: inviare tutta la libreria, più semplice ma con `Sovrascrivi` che cancellerebbe le modifiche esterne agli altri blocchi.
- **Confronto e livello nel server**: il server è l'unico punto che vede sia il disco sia la modifica, e lo stesso codice serve per le voci `esterna`. Le rinomine arrivano dal client (`rinomine: { vecchioId: nuovoId }`, dalla stessa mappa `_idOriginale` che l'ispettore già costruisce), perché dal solo confronto una rinomina è indistinguibile da rimozione più aggiunta. Il confronto dei campi è generico (tutte le chiavi tranne `id` e `requisiti` per il blocco, tutte tranne `id` per il requisito, uguaglianza JSON), così un campo aggiunto in futuro è coperto senza toccare il server.
- **Formati vecchi**: la normalizzazione resta solo in JS (`normalizzaLibreria`). Se `apri` risponde `formato: 0` (file senza `formatVersion`), il primo `salva` include `base`: la libreria intera già normalizzata dal client. Il server la usa al posto del contenuto su disco solo se `improntaAttesa` coincide con il disco (quindi `base` rappresenta proprio quel file), e il blocco precedente per il confronto è `base[id]`, non il blocco grezzo su disco: così i nomi vecchi dei campi o `tipologia` mancante invece di `null` non generano modifiche fantasma. Alternativa: portare `normalizzaLibreria` in Python, logica duplicata in due lingue.
- **Versione corrente**: la fonte di verità è la `versione` dell'ultima voce del changelog; il campo `versione` nel file della libreria la rispecchia a ogni scrittura dall'app. Una voce `esterna` non riscrive il file della libreria (all'apertura non si tocca mai il file), quindi il campo nel file può restare indietro fino al successivo `Salva`. Una modifica a mano del solo campo `versione` viene ignorata (vedi le due impronte).
- **Due impronte**: `impronta` è lo SHA1 dei byte del file e serve solo come gettone di conflitto (`improntaAttesa`), come in 0001. `improntaContenuto` è lo SHA1 di `json.dumps(library, sort_keys=True, ensure_ascii=False, separators=(',', ':'))` e serve a riconoscere le modifiche esterne. Così la conversione dal formato vecchio, un editor che salva con a capo di Windows o con un'altra indentazione, o una modifica del solo campo `versione` non creano voci `esterna` fantasma. Alternativa scartata: una sola impronta sui byte, che confonde forma e contenuto.
- **Contenuto di riferimento**: dopo ogni voce il server salva una copia della libreria in `_versioni/<nome>.riferimento.json`. Serve a calcolare il confronto delle modifiche esterne; le copie `.1`…`.3` non bastano perché contengono la versione precedente, non quella attuale. Se il riferimento manca, la voce `esterna` ha `modifiche: []` e nota "Contenuto precedente non disponibile", con livello `patch`.
- **Ordine delle scritture** (sotto il lucchetto): 1) eventuale voce `esterna`; 2) rotazione delle copie e copia del file attuale in `.1`; 3) `scrivi_atomico` della libreria; 4) `scrivi_atomico` del changelog con la nuova voce; 5) copia di riferimento. Se il processo si interrompe dopo il passo 3, la libreria è nuova ma il changelog no: alla prossima apertura il contenuto non coincide con l'ultima voce e la modifica viene registrata come `esterna` (AC-8). Se il passo 4 o 5 fallisce con un errore (non un'interruzione), il server risponde comunque 200 con `libreria`, `versione` precedente, la nuova `impronta`, `voce: null` e `avviso` "La libreria è salvata ma il changelog non è stato aggiornato: la modifica verrà registrata come modifica esterna"; il client adotta la libreria come per un successo e mostra l'avviso. Se il changelog manca, `salva` crea prima la voce `iniziale` (sul contenuto attuale) e poi la sua. Nessun passo lascia un file JSON rovinato.
- **Apertura con effetti**: `POST /api/libreria/apri`, non `GET`, perché può scrivere il changelog (voce iniziale o esterna); così passa per il controllo `Content-Type` di 0001 e una pagina estranea non può farlo scattare con un semplice link.
- **Percorso**: il progetto conserva il `libraryPath` come l'hai scritto. Se inizia con `http:`, `https:` o `//`, il client carica con `fetch` statico come oggi e marca la libreria in sola lettura, senza chiamare l'API. Altrimenti il client lo normalizza per l'API (`\` diventa `/`, si tolgono `./` e `/` iniziali, si tolgono `?…` e `#…`) e chiama `apri`; se `apri` risponde 400 `percorso_non_valido`, ripiega sul `fetch` statico in sola lettura con il motivo nel suggerimento. `apri` accetta qualsiasi `.json` dentro la cartella dell'app (tranne `progetti/`) e risponde `scrivibile: true` solo dentro `shared/` (sottocartelle comprese, escluse `_versioni/`).
- **Stato della libreria nel client**: `libreria.js` tiene `percorso` (normalizzato), `versione`, `impronta`, `scrivibile`, `formato`, `motivoSolaLettura`. Lo stato cambia solo quando un caricamento riesce: se 🔄 verso un nuovo percorso fallisce, restano libreria e stato precedenti, così un `Salva` non può mai scrivere in un file diverso da quello in memoria. Il pulsante 🔄 richiama sempre `apri`, anche con lo stesso percorso (serve a riallineare impronta e versione); il salto `percorso === libreriaCaricata` di `caricaLibreria` in `progetto.js` resta solo per l'apertura dei progetti.
- **Regole del confronto**: prima si applicano le rinomine (il vecchio requisito `a` diventa il requisito `rinomine[a]`), poi si confrontano i requisiti per id nuovo: così anche uno scambio di id (`a`→`b`, `b`→`a`) dà due `rinominato`. Un requisito rinominato elenca in `campi` anche gli altri campi cambiati. `ordineRequisiti` compare in `campiBlocco` ogni volta che l'ordine degli id presenti prima e dopo cambia, anche insieme ad altre modifiche. `testiExport` è un campo unico (l'intero elenco). Un semver valido rispetta `^\d+\.\d+\.\d+$`.
- **Autore**: `getpass.getuser()` letto dal server a ogni voce; se fallisce, `"sconosciuto"`.
- **Data**: `datetime.now().astimezone().isoformat(timespec='seconds')` nel server (ora locale con fuso). La finestra la mostra con `toLocaleString('it-IT')`.
- **Conflitto**: `improntaAttesa` è l'impronta SHA1 ricevuta dall'ultimo `apri` o `salva`. Il server confronta con i byte attuali; diversa e senza `forza` → 409 `conflitto`. Il banner è quello di `progetto.js` (`aggiornaBanner()`), che riceve due stati in più esportati da un setter `impostaStatoLibreriaBanner({ conflitto, avviso })`: la priorità diventa conflitto del progetto, poi conflitto della libreria, poi errore di salvataggio del progetto, poi avvisi (libreria non caricata, modifica esterna, sola lettura per changelog illeggibile); due nuove azioni `data-banner` (`ricaricaLibreria`, `sovrascriviLibreria`) in `AZIONI_BANNER`. L'avviso di modifica esterna non si azzera con il caricamento riuscito che lo ha prodotto, ma solo al caricamento successivo. `Sovrascrivi` ripete lo stesso corpo del `salva` rifiutato (tenuto in `libreria.js` insieme al blocco e al nodo aperti) con `forza: true`; se ora risponde 409 `esiste`, 400 `rinomine_non_valide` o `id_duplicato`, compare il messaggio, il banner sparisce e il form resta aperto; il server prima registra la voce `esterna` per ciò che è cambiato su disco (se il disco non coincide con l'ultima voce), poi applica il blocco sulla libreria attuale. `Ricarica la libreria` chiama `apri` e riapre il blocco dall'elenco aggiornato (o svuota l'ispettore se non esiste più); il progetto non viene toccato, anche se su disco un requisito ha cambiato id. Un `Salva` della libreria è bloccato mentre il progetto è in `Conflitto` (le modifiche al progetto che ne derivano non potrebbero essere salvate); in `Errore` del progetto è permesso, perché i ritentativi di 0001 porteranno su disco anche quelle modifiche.
- **Selettore di livello e motivo**: `<select id="edtLivello">` e `<input id="edtNotaModifica">` nella parte bassa del form, sopra `Salva`. Valori: `Automatico` → `auto`, `Patch` → `patch`, `Minor` → `minor`, `Major` → `major`. Il livello effettivo è deciso dal server (`max(scelto, calcolato)`); il messaggio di conferma lo riporta: "Blocco salvato. Libreria v1.3.0 (minor)." più l'eventuale frase sui fili rimossi di oggi.
- **Finestra Changelog**: riusa `#reportModal` (come l'elenco Apri di 0001) con titolo "Changelog · <nome file> · v<versione>". I dati arrivano da `GET /api/libreria/changelog` all'apertura della finestra, mai prima (il changelog cresce e non serve al caricamento). Filtro sul testo, senza distinzione tra maiuscole e minuscole, su `blocco`, `titolo` e ogni `id`/`idPrecedente` di requisito. Tipi e livelli sono mostrati in italiano.
- **Copie di sicurezza**: stessa rotazione di 0001, nella cartella `_versioni/` accanto alla libreria; massimo da `settings.json` `libreria.versioni` letto da `start.py`. Nessun Annulla: rimettere una libreria indietro tocca ogni progetto che la usa e merita una funzionalità a sé.
- **Pulizia di 0001**: si tolgono `libreriaModificata`, `segnaLibreriaModificata()` e `confermaCambioLibreria()` da `progetto.js` e la chiamata in `inspector.js` (follow up di 0001).

## Rationale

Ragionamento e opzioni: vedi [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| File | Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|---|
| `shared/<…>/<nome>.json` | `formatVersion` | intero | sì | `1`. File senza → formato vecchio (`0`), convertito al primo `Salva` |
| | `versione` | stringa `MAJOR.MINOR.PATCH` | sì | rispecchia l'ultima voce del changelog dopo ogni scrittura dall'app |
| | `library` | mappa `{ [id]: blocco }` | sì | blocchi e requisiti nella forma attuale di `js/AGENTS.md`, invariata |
| `<nome>.changelog.json` | `formatVersion` | intero | sì | `1` |
| | `voci` | array di Voce | sì | dalla più vecchia; si aggiunge solo in fondo |
| Voce | `versione` | stringa semver | sì | versione dopo questa voce |
| | `data` | stringa ISO 8601 con fuso | sì | ora del server |
| | `autore` | stringa | sì | `getpass.getuser()` |
| | `origine` | `app` · `esterna` · `iniziale` | sì | |
| | `livello` | `major` · `minor` · `patch` · null | sì | effettivo; null solo per `iniziale` |
| | `livelloCalcolato` | come sopra | sì | null solo per `iniziale` |
| | `nota` | stringa | sì | vuota ammessa, massimo 2000 caratteri |
| | `impronta` | SHA1 esadecimale | sì | dei byte della libreria dopo questa voce (gettone di conflitto) |
| | `improntaContenuto` | SHA1 esadecimale | sì | di `library` in forma canonica dopo questa voce (riconosce le modifiche esterne) |
| | `modifiche` | array di Modifica blocco | sì | vuoto per `iniziale` |
| Modifica blocco | `blocco` | stringa | sì | id del blocco |
| | `titolo` | stringa | sì | titolo dopo la modifica (prima, se eliminato) |
| | `tipo` | `creato` · `modificato` · `eliminato` | sì | `eliminato` solo da voci `esterna` per ora (e dalla funzionalità 10) |
| | `campiBlocco` | array di stringhe | sì | nomi dei campi del blocco cambiati; `ordineRequisiti` se cambia solo l'ordine |
| | `requisiti` | array di Modifica requisito | sì | |
| Modifica requisito | `id` | stringa | sì | id dopo la modifica (prima, se rimosso) |
| | `tipo` | `aggiunto` · `modificato` · `rimosso` · `rinominato` | sì | `rinominato` solo da voci `app` |
| | `idPrecedente` | stringa | solo `rinominato` | |
| | `campi` | array di stringhe | sì | nomi dei campi cambiati; vuoto per `aggiunto` e `rimosso` |
| `_versioni/<nome>.N.json` | (intero file libreria) | | | N = 1 (più recente) … `libreria.versioni` |
| `_versioni/<nome>.riferimento.json` | (intero file libreria) | | | ultimo contenuto registrato nel changelog |

Relazioni: una libreria ↔ un changelog (stesso nome, suffisso `.changelog.json`, stessa cartella); una voce → N modifiche di blocco → N modifiche di requisito; molti progetti → una libreria (via `libraryPath`, invariato da 0001). Formato su disco: `json.dump(..., ensure_ascii=False, indent=2)` in UTF-8, come 0001.

Regole del livello (applicate a ogni blocco toccato, il livello della voce è il massimo): major se un requisito è `rimosso` o `rinominato`, se `tipologia` è tra i `campi` di un requisito, o se un blocco è `eliminato`; minor se un blocco è `creato` o un requisito `aggiunto`; altrimenti patch. Ordine: `patch` < `minor` < `major`.

**State transitions** (stato della libreria nel client):

`Caricata` → (Salva) → `Salvataggio…` → `Caricata` (versione nuova) · → (errore) → `Caricata` con messaggio, form intatto · → (409) → `Conflitto` → (Ricarica la libreria) → `Caricata` · (Sovrascrivi riuscito) → `Caricata`

`Sola lettura`: nessuna transizione di scrittura. In `Conflitto` il `Salva` di qualunque blocco è disabilitato finché non scegli.

**API surface** (risposte JSON; errori come `{ errore, messaggio }` in italiano, come 0001; tutte le rotte `/api/` controllano `Host` e `Origin`; le scritture richiedono `Content-Type: application/json`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/libreria/apri` | POST | `percorso`: str (req) | `{ libreria, versione, impronta, scrivibile, formato, vociAggiunte: [voce], avviso? }` (`libreria` è il contenuto grezzo: mappa, `{ library }` o formato 1; il client lo passa a `impostaLibreria`) | solo locale | 400 `percorso_non_valido`, 404 `non_trovata`, 422 `json_non_valido`, 503 `file_bloccato` |
| `/api/libreria/salva` | POST | `percorso`: str (req), `blocco`: obj (req), `nuovo`: bool (req), `rinomine`: obj (opt, `{}`), `livello`: `auto`·`patch`·`minor`·`major` (req), `nota`: str (opt), `improntaAttesa`: str (req), `forza`: bool (opt), `base`: obj (req se `formato` era 0) | `{ libreria, versione, impronta, voce, avviso? }` (`voce: null` con `avviso` se il changelog non è stato aggiornato) oppure `{ invariata: true, versione, impronta }` | solo locale | 400 `percorso_non_valido`, `blocco_non_valido`, `rinomine_non_valide`, `livello_non_valido`, `id_duplicato`, `base_mancante`; 409 `esiste`; 403 `percorso_non_scrivibile`; 404 `non_trovata`; 409 `conflitto` (con `impronta` attuale); 422 `changelog_non_valido`; 503 `file_bloccato`; 500 `errore_scrittura` |
| `/api/libreria/changelog` | GET | `percorso`: str (query, req) | `{ versione, voci }` (`voci: []` se il file manca) | solo locale | 400 `percorso_non_valido`, 422 `changelog_non_valido` |

Comportamento del server (sempre sotto il lucchetto di 0001):
- **Validazione del percorso** (`risolvi_libreria(percorso)`): stringa non vuota, relativa, senza segmenti `..`, senza `\`, che termina in `.json` e non in `.changelog.json`; `os.path.realpath` dentro la cartella dell'app e fuori da `progetti/` → altrimenti 400. `scrivibile` = realpath dentro `<base>/shared/` e non dentro una cartella `_versioni`.
- **apri**: legge i byte (404 se manca, 422 se JSON non valido); `formato` = 1 se l'oggetto ha `formatVersion` 1, altrimenti 0; `formatVersion` maggiore di 1 → 200 con `scrivibile: false` e `avviso` "Libreria creata da una versione più recente dell'app: aperta in sola lettura", senza toccare il changelog. Se `scrivibile`: changelog assente → voce `iniziale` + riferimento; changelog presente e `improntaContenuto` attuale ≠ quella dell'ultima voce → voce `esterna` (vedi sotto); se differisce solo `impronta` (forma del file), nessuna voce. Changelog illeggibile → risponde comunque con la libreria, `scrivibile: false` e `avviso` "Il changelog non è leggibile: correggilo o spostalo per poter salvare". `versione` = ultima voce del changelog, altrimenti campo del file, altrimenti `1.0.0`.
- **Voce esterna**: confronta `riferimento` (convertito in mappa: `library` se c'è, altrimenti l'oggetto stesso) con il contenuto attuale, blocco per blocco per id: blocco nuovo → `creato` con tutti i suoi requisiti `aggiunto`; blocco sparito → `eliminato`; blocco presente → confronto dei campi e dei requisiti per id. Nota automatica "Modifica fatta fuori dall'app". Poi aggiorna il riferimento.
- **salva**: valida il blocco (oggetto; `id` stringa non vuota massimo 200 caratteri; `titolo` stringa non vuota; `requisiti` array di oggetti con `id` stringa non vuota, unici nel blocco) → 400 `blocco_non_valido`. Con `nuovo: true` e un blocco con lo stesso id già su disco → 409 `esiste` ("Un blocco con ID … esiste già nella libreria su disco"), anche con `forza`. Valida `rinomine` (ogni chiave è un id del blocco su disco, ogni valore un id del blocco nuovo) → 400 `rinomine_non_valide`. Controlla l'impronta (409 salvo `forza`). Changelog assente → crea prima la voce `iniziale` sul contenuto attuale. Con `forza` e `improntaContenuto` del disco ≠ ultima voce, registra prima la voce `esterna`. Base: `base` se il file è di formato 0 (400 `base_mancante` se assente), altrimenti `library` del disco. Sostituisce o aggiunge il blocco; controlla che nessun id requisito del blocco sia usato da un altro blocco → 400 `id_duplicato`. Confronta con il blocco precedente; nessuna differenza e formato già 1 → `invariata` senza scritture. Nessuna differenza ma formato 0 → converte il file senza voce (AC-9): copia in `.1`, scrive il file, aggiorna il riferimento; `improntaContenuto` non cambia, quindi nessuna voce fantasma alla prossima apertura. Altrimenti calcola il livello, la versione, e scrive nell'ordine della Decisione.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Caricamento libreria | percorso | `progetto.libraryPath` (0001) o `#libPathInput` al clic su 🔄 |
| Caricamento libreria | contenuto, versione, impronta, scrivibile, formato | risposta di `POST /api/libreria/apri`; per un indirizzo web: `fetch` statico, versione mostrata come "n/d", `scrivibile: false` |
| Caricamento libreria | avviso di modifica esterna | `vociAggiunte` con `origine: "esterna"` → versione dell'ultima |
| Pannello libreria | versione mostrata | `versione` dell'ultima risposta `apri` o `salva` |
| Pannello libreria | etichetta `Sola lettura` e motivo | `scrivibile: false`; motivo: fuori da `shared/`, indirizzo web, percorso rifiutato dall'API, o `avviso` del server |
| Pannello libreria (sola lettura) | versione mostrata | ultima voce del changelog se esiste, altrimenti `versione` del file, altrimenti "n/d" |
| Chiamata API | percorso normalizzato | `libraryPath` con `\` → `/`, senza `./`, `/` iniziali, `?…` e `#…` |
| Sovrascrivi | corpo da ripetere | ultimo corpo `salva` rifiutato con 409, tenuto in `libreria.js` |
| Salva bloccato | stato del progetto | stato di salvataggio di `progetto.js` = `Conflitto` |
| Salva | `blocco` | form dell'ispettore, come oggi (`{ id, titolo, descrizione, categoria, sottocategoria, requisiti }` senza `_idOriginale`) |
| Salva | `nuovo` | `data.isNew` del form dell'ispettore (vero anche per `Crea copia`) |
| Salva | `rinomine` | `currentReqs` con `_idOriginale` diverso da `id` (stessa mappa di oggi) |
| Salva | `livello` | `#edtLivello` (`auto` predefinito) |
| Salva | `nota` | `#edtNotaModifica` ripulito dagli spazi ai lati |
| Salva | `improntaAttesa` | `impronta` dell'ultima risposta `apri` o `salva` |
| Salva | `base` | `appState.library` quando l'ultimo `apri` ha dato `formato: 0` |
| Salva | livello calcolato | confronto nel server tra blocco su disco e blocco ricevuto, con le regole di AC-4 |
| Salva | livello effettivo | `max(livello scelto, livello calcolato)` nel server; `auto` = calcolato |
| Salva | nuova versione | versione corrente (ultima voce) avanzata del livello effettivo |
| Voce | `data` | orologio del server con fuso locale |
| Voce | `autore` | `getpass.getuser()`, altrimenti `"sconosciuto"` |
| Voce | `impronta` | SHA1 dei byte della libreria appena scritti |
| Voce | `improntaContenuto` | SHA1 della forma canonica di `library` appena scritta |
| Modifica esterna | trigger | `improntaContenuto` del file attuale ≠ quella dell'ultima voce |
| Voce esterna | modifiche | confronto tra `_versioni/<nome>.riferimento.json` e il file attuale |
| Voce iniziale | versione | `versione` del file se semver valido, altrimenti `1.0.0` |
| Dopo Salva | libreria in memoria | `libreria` della risposta → `impostaLibreria()` |
| Dopo Salva | messaggio | `versione` e `voce.livello` della risposta, `filiRimossi` da `aggiornaRiferimentiRequisiti` |
| Conflitto | impronta attuale | `impronta` nel corpo del 409 |
| Copie di sicurezza | numero massimo | `settings.json` `libreria.versioni` letto da `start.py` (predefinito 3, minimo 1) |
| Finestra Changelog | voci | `GET /api/libreria/changelog` all'apertura |
| Finestra Changelog | filtro iniziale | vuoto dal pulsante; id del blocco aperto dal collegamento `Storia` |
| Finestra Changelog | data mostrata | `new Date(voce.data).toLocaleString('it-IT')` |

**Key invariants**:
- `appState.library` cambia per un `Salva` solo dopo che il server ha confermato la scrittura; il progetto riceve rinomine e rimozioni di fili solo nello stesso momento.
- Il server scrive solo dentro `<base>/shared/` (libreria, changelog, `_versioni/`), mai i file dell'app né `progetti/` tramite queste rotte.
- Ogni scrittura della libreria dall'app aggiunge esattamente una voce `app`; nessuna voce senza una scrittura che cambia il contenuto (salvo `iniziale` ed `esterna`).
- Il changelog si modifica solo aggiungendo in fondo; le voci esistenti non cambiano mai.
- Le versioni nel changelog crescono strettamente in ordine semver.
- Dopo ogni voce scritta con successo, `impronta` e `improntaContenuto` dell'ultima voce coincidono con il file della libreria su disco e il riferimento ne è una copia.
- Lo stato di `libreria.js` (percorso, impronta, scrivibile) descrive sempre la libreria in memoria: cambia solo con un caricamento o un salvataggio riuscito.
- Gli id dei requisiti restano unici in tutta la libreria (controllo nel client come oggi e nel server).
- Aprire una libreria non modifica mai il file della libreria.
- Tutte le operazioni sulle librerie sono serializzate dallo stesso lucchetto dei progetti.

**Security model**:
- Un solo utente in locale, nessuna autenticazione; si riusano le difese di 0001 (`127.0.0.1`, `Host`, `Origin`, `Content-Type` sulle scritture, OPTIONS → 405, limite 50 MB).
- Le scritture sono confinate a `shared/` con `realpath` (blocca `..`, collegamenti e maiuscole diverse); la lettura tramite `apri` è confinata alla cartella dell'app, escluso `progetti/`.
- L'autore registrato è il nome utente del sistema: informazione locale, nessun dato regolamentato.

**Configuration required**:
- `settings.json` → `"libreria": { "versioni": 3 }`. Aggiungere la chiave a `DEFAULT_SETTINGS` in `js/state.js` e al merge annidato di `loadSettings()`. Nessuna variabile d'ambiente.
- `.gitignore`: nessuna modifica (`shared/` resta versionabile se vuoi; `_versioni/` è rigenerabile, puoi aggiungerla).

**Critical test scenarios**:
- Happy path: libreria `shared/libreria.json` in formato vecchio senza changelog → all'apertura nasce `libreria.changelog.json` con voce iniziale `1.0.0` e il file libreria ha la stessa impronta di prima; aggiungi un requisito a `centralina` e salvi → il file diventa formato 1 con `versione: "1.1.0"`, il changelog ha una voce `minor` con il requisito `aggiunto`, c'è `_versioni/libreria.1.json`; riavvii e ritrovi tutto, verifica **AC-1**, **AC-3**, **AC-4**, **AC-9**, **AC-10**, **AC-13**.
- Rinomina: cambi l'id di un requisito collegato nel progetto e salvi con livello `Patch` → versione `2.0.0` (il calcolato `major` vince), voce con `rinominato` e `idPrecedente`, il filo del progetto segue il nuovo id e il progetto su disco si aggiorna, verifica **AC-1**, **AC-3**, **AC-4**.
- Nessuna modifica: riapri un blocco e premi `Salva` senza cambiare nulla → messaggio, nessun file toccato (impronta e numero di copie invariati), verifica **AC-5**.
- Server fermo: fermi `start.py`, modifichi un titolo e salvi → messaggio, il form conserva il titolo nuovo, l'albero mostra ancora il vecchio; riavvii e salvi → riesce, verifica **AC-2**.
- Conflitto: con l'app aperta modifichi a mano la descrizione di un altro blocco nel file, poi salvi un blocco → banner; `Sovrascrivi` → nel changelog prima una voce `esterna` (patch, blocco modificato con `descrizione`) poi la tua voce; il blocco modificato a mano conserva la sua descrizione, verifica **AC-7**, **AC-8**.
- Modifica esterna all'avvio: a app chiusa elimini un requisito dal file, avvii → avviso e voce `esterna` `major` con il requisito `rimosso`, il file libreria non è stato riscritto, verifica **AC-8**.
- Solo forma: apri `libreria.json` in un editor, cambia l'indentazione o il campo `versione` e salva con a capo di Windows → alla riapertura nessuna voce `esterna`; il primo `Salva` dopo la conversione dal formato vecchio non produce voci `esterna` alla riapertura successiva, verifica **AC-8**, **AC-9**.
- Conflitto del progetto: con il progetto in `Conflitto` (0001) premi `Salva` su un blocco → messaggio, nessun file della libreria toccato, verifica **AC-7**.
- Percorso sbagliato: con 🔄 carichi `shared/inesistente.json` → messaggio, resta la libreria precedente e un `Salva` scrive ancora nel file precedente, verifica **AC-2**, **AC-11**.
- Nota e storia: salvi con motivo "Richiesta cliente 12", apri `Storia` dal blocco → la finestra è filtrata sul blocco e mostra la nota; filtri per un id requisito di un altro blocco → vedi solo quelle voci, verifica **AC-6**, **AC-12**.
- Sola lettura: carichi con 🔄 una libreria in `docs/` (dentro la cartella dell'app ma fuori da `shared/`) → etichetta `Sola lettura`, `Salva` disabilitato, trascinamento funzionante, verifica **AC-11**.
- Accesso negato: `salva` con `percorso` `../settings.json`, `settings.json`, `shared/../index.json`, `shared/_versioni/libreria.1.json`, `shared/libreria.changelog.json` → 400 o 403, nessun file toccato; un blocco con un id requisito di un altro blocco → 400 `id_duplicato`, verifica **AC-14**.
- Cambio di progetto: dopo un `Salva` apri un progetto con un'altra libreria → nessuna conferma sulla libreria, verifica **AC-15**.

## Build plan

Ordine Tracer Bullet: prima un filo completo dal `Salva` al file su disco con la sua voce di changelog, poi lo si irrobustisce e si aggiunge la lettura.

1. **Filo minimo dal Salva al disco con una voce.** `start.py`: `risolvi_libreria` con i controlli di percorso e `scrivibile`; `POST /api/libreria/apri` (lettura, `formato`, `versione`, impronta) e `POST /api/libreria/salva` con validazione del blocco, di `nuovo` e delle rinomine, controllo `id_duplicato` ed `esiste`, uso di `base` (e di `base[id]` come blocco precedente) per il formato 0, regole del confronto, livello calcolato, avanzamento semver, conversione a `{ formatVersion: 1, versione, library }`, voce `iniziale` se il changelog manca, voce `app` con `data`, `autore`, `impronta` e `improntaContenuto`, scrittura atomica di libreria e changelog, risposta `invariata` e risposta con `avviso` se il changelog non si scrive. Client: nuovo `js/libreria.js` (stato aggiornato solo in caso di successo, normalizzazione del percorso, `apriLibreria`, `salvaBloccoLibreria`), `loadLibraryFromPath()` passa per `apriLibreria` e 🔄 lo richiama sempre; il `Salva` dell'ispettore diventa asincrono con ordine disco poi memoria e messaggio con versione e livello; rimozione di `libreriaModificata`, `segnaLibreriaModificata` e `confermaCambioLibreria`. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4** (livello calcolato), **AC-5**, **AC-14**, **AC-15**.
2. **Livello scelto, motivo e versione a vista.** `#edtLivello` e `#edtNotaModifica` nel form con ritorno ai predefiniti dopo il successo; `max(scelto, calcolato)` e `nota` (massimo 2000 caratteri) nel server; versione `v…` nel titolo del pannello libreria, aggiornata a ogni `apri` e `salva`. Satisfies **AC-4**, **AC-6**, **AC-13**.
3. **Conflitti, modifiche esterne e copie di sicurezza.** Impronta `improntaAttesa` e 409 `conflitto`; stati della libreria in `aggiornaBanner()` con la nuova priorità e il setter esportato, azioni `ricaricaLibreria` e `sovrascriviLibreria` (`forza: true` sul corpo tenuto), `Salva` bloccato in conflitto della libreria o del progetto; voce `iniziale` alla prima apertura, riferimento `_versioni/<nome>.riferimento.json`, voce `esterna` su `improntaContenuto` all'apertura e prima di un `salva` forzato, avviso nel client da `vociAggiunte` che resta fino al caricamento successivo; rotazione delle copie `_versioni/<nome>.N.json` con `libreria.versioni` da `settings.json` (chiave anche in `state.js`); pulizia dei `.tmp` in `shared/` e `shared/_versioni/` all'avvio. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**.
4. **Sola lettura.** Caricamento statico per indirizzi web e per percorsi rifiutati dall'API; etichetta `Sola lettura` con motivo e versione mostrata; `Salva` e `Crea copia` disabilitati con suggerimento; changelog illeggibile e `formatVersion` maggiore di 1 aperti in sola lettura con `avviso` (risposta 200). Satisfies **AC-11**, **AC-14**.
5. **Finestra Changelog e Storia.** `GET /api/libreria/changelog`; pulsante `📜 Changelog` nel pannello libreria; finestra su `#reportModal` con voci dalla più recente, tipi e livelli in italiano, campo filtro; collegamento `Storia` nell'ispettore dei blocchi esistenti che apre la finestra filtrata. Satisfies **AC-12**.

## Consequences

**Positive**:
- La libreria su disco è sempre allineata a ciò che vedi, e il progetto non salva più id che la libreria su disco non conosce (chiude il rischio segnalato in 0001).
- Ogni cambiamento ha versione, data, autore e motivo, e il livello major segnala da solo le modifiche che rompono i progetti che usano la libreria.
- Le modifiche fatte a mano non passano inosservate, e il changelog non ha buchi nemmeno dopo un'interruzione a metà scrittura.
- Nessuna nuova dipendenza: solo libreria standard Python e JS nativo; l'exe si ricompila senza cambiare `start.spec`.

**Negative / tradeoffs**:
- `Salva` ora dipende dal server: con `start.py` fermo non puoi modificare la libreria (prima potevi, solo in memoria).
- Il changelog registra solo i nomi dei campi: dal changelog sai che un testo è cambiato ma non cosa diceva prima; per il contenuto precedente restano solo le ultime 3 copie in `_versioni/`.
- Una modifica esterna o un `Ricarica la libreria` non aggiornano il progetto aperto: se su disco un requisito ha cambiato id, i fili che lo usano non si vedono finché non li ricolleghi.
- Una rinomina fatta a mano nel file risulta `rimosso` più `aggiunto`, quindi major, anche se era solo un nuovo id.
- Il livello major dice che una modifica può rompere i progetti, ma solo il progetto aperto viene aggiornato (rinomine e fili rimossi); gli altri progetti che usano la stessa libreria restano con i vecchi id finché non li apri e li correggi.
- L'Annulla del progetto (0001) non tocca la libreria: annullare dopo una rinomina di requisito riporta nel progetto il vecchio id, che nella libreria non esiste più, e quel filo non si vede finché non lo ricolleghi.
- Il campo `versione` nel file può restare indietro rispetto al changelog dopo una modifica esterna, fino al successivo `Salva`: la versione vera è sempre quella del changelog.
- Due file in più per libreria (`.changelog.json` e il riferimento) più le copie: chi copia a mano la libreria deve copiare anche il changelog.

**Neutral**:
- `shared/libreria.json` passa dal formato mappa semplice al formato 1 al primo `Salva`; i caricatori leggono già entrambi.
- Il changelog cresce senza limite, ma si legge solo all'apertura della finestra; con migliaia di voci resta nell'ordine dei megabyte.
- La funzionalità 10 (Gestione completa della libreria) userà la stessa rotta `salva` o una sorella per `eliminato` e per la rinomina dell'id del blocco; il formato del changelog prevede già `eliminato`.

## Migration plan

**Strategy**: no migration needed (conversione pigra, un file alla volta).
**Phases**:
1. Alla prima apertura di ogni libreria in `shared/` nasce il changelog con la voce iniziale; il file libreria non cambia.
2. Al primo `Salva` il file passa al formato 1 (la versione precedente resta in `_versioni/<nome>.1.json`).
**Rollback**: tornare al commit precedente; il formato 1 è già letto dai caricatori esistenti (`{ library }`), e il campo `versione` in più è ignorato. I file `.changelog.json` restano innocui.
**Risks**: una libreria dentro una cartella sincronizzata (OneDrive) può dare `file_bloccato` per qualche secondo; il `Salva` va ripetuto a mano (nessun ritentativo automatico, perché il form resta aperto).

## Follow-up

- [ ] `/sync` dopo la costruzione: aggiornare `js/AGENTS.md` (nuovo `js/libreria.js`, `Salva` asincrono con ordine disco poi memoria, formato 1 della libreria, changelog) e i Gotchas di `AGENTS.md` (l'app scrive in `shared/`; `start.py` ha le rotte `/api/libreria/...`).
- [ ] Da decidere con la funzionalità 10: come registrare l'eliminazione di un blocco e la rinomina del suo id, e se avvisare quando una modifica major tocca blocchi usati in altri progetti.
- [ ] Da valutare: un Annulla della libreria (ripristino di una copia con voce di changelog), escluso da questa spec.
