# 0003. Import dei requisiti cliente da Excel o CSV in un blocco Cliente del progetto

**Date**: 2026-09-30
**Status**: Accepted

## Summary

Importi da un file Excel (`.xlsx`) o CSV le frasi del cliente, anche migliaia, scegliendo foglio, riga di intestazione e quali colonne sono ID, testo, titolo, note, sezione e tipologia. Il file lo legge `start.py` con la sola libreria standard di Python; tutto il resto (anteprima, confronto con l'import precedente, salvataggio) succede nel browser e finisce nel file del progetto, così autosalvataggio e Annulla funzionano da soli. I requisiti cliente vivono in una nuova scheda Cliente del pannello sinistro: da lì li trascini alla radice, dove diventano blocchi tondi padri del livello radice da cui tiri i fili verso i blocchi di sistema. Un secondo import aggiorna invece di duplicare: segna i modificati, ritira i mancanti e scarta le righe errate spiegandoti perché.

## Requirements

**User stories**:
- Come progettista voglio importare da Excel o CSV le frasi del cliente, anche migliaia, così parto dai suoi requisiti senza ricopiarli a mano.
- Come progettista voglio vedere prima di confermare cosa entra, cosa cambia, cosa sparisce e quali righe sono sbagliate, così un file del cliente fatto male non mi sporca il progetto.
- Come progettista voglio reimportare la revisione successiva del cliente senza duplicare nulla e senza perdere i fili già tirati.
- Come progettista voglio cercare tra migliaia di requisiti cliente e portare sul canvas solo quelli su cui sto lavorando.

**Acceptance criteria**:
- **AC-1**: Il pannello sinistro ha due schede, Libreria e Cliente. La scheda Cliente di un progetto senza requisiti cliente mostra solo il pulsante `Importa…` e una riga che spiega cosa fa. Un progetto salvato prima di questa funzionalità (senza la chiave `cliente`) si apre come prima, con la scheda Cliente vuota. Senza un progetto aperto la scheda dice solo "Apri un progetto".
- **AC-2**: `Importa…` apre la scelta del file (`.xlsx`, `.csv`). Un file più grande di `cliente.maxFileMB` è rifiutato prima dell'invio con un messaggio che dice il limite. Un `.xls` vecchio o un `.xlsx` protetto da password è rifiutato con il messaggio "Salva il file come .xlsx senza password e riprova". Un file illeggibile, o il server fermo, dà un messaggio con il motivo. In tutti questi casi il progetto non cambia.
- **AC-3**: Letto il file, la finestra di import mostra: il menu del foglio (il primo di default; un CSV ha un solo foglio), il numero della riga di intestazione (1 di default), e per ogni campo (ID e Testo obbligatori; Titolo, Note, Sezione, Tipologia facoltativi) un menu con le colonne di quella riga, scritte come lettera più nome (es. `B: Descrizione`, oppure `C: (senza nome)` se la cella è vuota). I campi facoltativi hanno anche la voce `(nessuna)`. Cambiando foglio o riga i menu si ricostruiscono; una riga di intestazione oltre la fine del foglio dà il messaggio "Il foglio ha solo N righe". I fogli nascosti compaiono nel menu con `(nascosto)`. L'anteprima e la conferma restano disattivate finché ID e Testo non sono mappati.
- **AC-4**: A un reimport la finestra propone il foglio salvato in `cliente.ultimoImport` (se c'è ancora un foglio con quel nome, altrimenti il primo), la riga di intestazione e, per ogni campo, la colonna salvata: si cerca per nome, e se il nome manca o compare più volte in quella riga si usa la lettera salvata; se nemmeno la lettera esiste il campo resta da scegliere.
- **AC-5**: Un CSV in UTF-8 (con o senza BOM) o in Windows-1252, separato da `;`, `,` o tabulazione, con virgolette e a capo dentro le celle, arriva con le lettere accentate giuste e ogni cella al suo posto. Un `.xlsx` o `.xlsm` (estensione con qualsiasi maiuscola) dà i testi (senza le letture fonetiche), i numeri interi senza `.0` (un ID `12` resta `12`), il valore calcolato delle formule (una formula senza valore salvato è una cella vuota), e le celle vuote in mezzo alla riga non spostano le colonne. Un file vuoto dà il messaggio "Il file è vuoto".
- **AC-6**: L'anteprima scarta una riga, indicando il numero di riga del file e un solo motivo, il primo che vale in quest'ordine: ID vuoto; testo vuoto; tipologia che non corrisponde a nessuna chiave di `requirements.typeColors` (confronto senza distinguere maiuscole; la tipologia vuota vuol dire capacità, non è un errore); ID che compare più volte nel file fra le righe con ID non vuoto (sono scartate tutte le copie, anche se una copia era già scartata per un altro motivo); id finale (prefisso più ID) uguale all'id di un requisito della libreria aperta. Le righe del tutto vuote sono ignorate senza segnalarle. ID e testi perdono gli spazi ai bordi; gli ID si confrontano come testo esatto (`12` e `012` sono diversi, e così `a1` e `A1`). Una tipologia valida è salvata scritta come in `typeColors`.
- **AC-7**: L'anteprima mostra in alto i conteggi (nuovi, modificati, riattivati, ritirati, invariati, scartati, fili che si perdono) e sotto quattro schede: Scartati (riga, ID, motivo), Modificati (prima e dopo di testo, titolo e tipologia), Ritirati (ID e titolo), Nuovi (le prime `cliente.righeAnteprima` righe, poi "e altri N").
- **AC-8**: L'anteprima offre due modalità, `Sostituisci l'insieme` (di default) e `Aggiungi e aggiorna`; cambiandola i conteggi e le schede si aggiornano. Sostituisci ritira ogni requisito attivo che manca nel file; Aggiungi e aggiorna non ritira nessuno. In entrambe, un requisito ritirato che ricompare nel file torna attivo.
- **AC-9**: La conferma è disattivata se il file non ha nessuna riga valida. Alla conferma, in un solo passo: i nuovi entrano attivi; i modificati (testo, titolo o tipologia diversi) prendono i valori nuovi, `modificato: true` e in `precedente` i valori di prima; i riattivati tornano attivi con `modificato: true` anche se il testo è identico, prendono i valori nuovi e contano solo come riattivati (non anche come modificati); i ritirati prendono `stato: 'ritirato'` e tengono i loro fili e la posizione sul canvas; note e sezione si aggiornano senza accendere `modificato`. Se un requisito era già `modificato` e cambia ancora, `precedente` conserva i valori più vecchi non ancora visti. `cliente.ultimoImport` registra data, nome del file, foglio, riga di intestazione, colonne, modalità e conteggi. Subito dopo la conferma il progetto è scritto su disco (senza aspettare l'attesa dell'autosalvataggio), così l'import è una versione a sé e Ctrl+Z lo annulla tutto in un passo, requisiti cliente e fili insieme.
- **AC-10**: L'id di un requisito cliente è `cliente.prefisso` più l'ID del file (es. `CLI-SSS-012`). Il prefisso è copiato da `cliente.prefisso` di `settings.json` al primo import e poi resta fisso nel progetto: cambiare l'impostazione non cambia gli id esistenti. Il reimport confronta sull'ID del file (`idCliente`), non sull'id con prefisso.
- **AC-11**: Se un requisito (attivo o ritirato) cambia tipologia (o la perde, o la acquista) e così un suo filo non rispetta più le regole di collegamento, alla conferma quel filo è rimosso; l'anteprima lo aveva già contato in "fili che si perdono", che conta esattamente i fili che saranno rimossi.
- **AC-12**: La scheda Cliente elenca i requisiti nell'ordine del file: ID del cliente, titolo (o l'inizio del testo se manca), e i segni Sul canvas, numero di fili, Modificato, Ritirato. Ha una ricerca su ID del cliente, titolo e testo (senza distinguere maiuscole), un filtro di stato (Tutti, Non collegati cioè attivi con zero fili, Modificati, Ritirati), un filtro per sezione (le sezioni presenti) e mostra al massimo `cliente.righePannello` righe con la scritta "N risultati, mostrati i primi M". Ha anche `Importa…` e `Segna tutti come visti` (spegne `modificato` su tutti, con conferma).
- **AC-13**: Trascinando una riga sul canvas mentre sei alla radice, il requisito diventa un blocco tondo con il centro sul punto di griglia più vicino al cursore, a qualsiasi zoom e pan, con lo stesso aspetto dei blocchi tondi di oggi e il colore della sua classe; la posizione è salvata. Un requisito è sul canvas se e solo se ha una posizione salvata; trascinato di nuovo sul canvas si sposta, non si duplica. A un livello interno il rilascio è rifiutato con il messaggio "I requisiti cliente si collegano solo alla radice".
- **AC-14**: Dal pin di un blocco tondo cliente tiri un filo verso un requisito di un blocco di sistema della radice, con le stesse regole della derivazione di oggi (interfaccia con interfaccia della stessa tipologia, capacità con capacità; due requisiti cliente non si collegano tra loro). Il filo e la posizione del blocco tondo restano dopo aver chiuso e riaperto il progetto. Il filtro per classe della barra vale anche per i blocchi tondi cliente e i loro fili, come per quelli di oggi. Il `Salva` di un blocco di libreria collegato a un requisito cliente non tocca i fili cliente ancora validi.
- **AC-15**: Un clic su una riga della scheda apre nell'ispettore a destra il dettaglio in sola lettura: ID del cliente, id, titolo, testo intero, note, sezione, classe, stato, numero di fili e, se modificato, il prima e dopo. Da lì `Segna come visto` spegne `modificato` e svuota `precedente`; `Togli dal canvas` toglie il blocco tondo (non il requisito) ed è attivo solo se è sul canvas e non ha fili. Se il requisito è sul canvas e sei alla radice, la vista si sposta (zoom invariato) per centrarlo e il blocco tondo si evidenzia. Aprire il dettaglio deseleziona il blocco selezionato. Un clic sul blocco tondo apre lo stesso dettaglio.
- **AC-16**: Un requisito ritirato sul canvas ha il cerchio grigio tratteggiato e i suoi fili restano; un nuovo filo da lui è rifiutato con il messaggio "Requisito cliente ritirato: non si collega". Un requisito modificato ha sul cerchio un segno che lo distingue finché non lo segni come visto.
- **AC-17**: Il `Salva` di un blocco nell'ispettore della libreria (blocco nuovo, modificato, rinominato o nato da `Crea copia`) rifiuta, con un messaggio e prima di scrivere su disco, ogni id di requisito uguale all'id di un requisito cliente del progetto aperto.
- **AC-18**: `Importa…` è disattivato, con il motivo nel suggerimento, mentre il progetto ha un conflitto non risolto (spec 0001) o nessun progetto è aperto.
- **AC-19**: I requisiti cliente seguono il progetto in ogni percorso della spec 0001: autosalvataggio (anche Segna come visto, Segna tutti come visti e Togli dal canvas vanno su disco), apertura, nuovo progetto (senza cliente), Salva con nome, Duplica, import e download del file, Annulla, Ripeti e Ricarica dopo un conflitto. Dopo un Annulla o un Ripeti, requisiti cliente e fili sono sempre dello stesso momento.
- **AC-20**: Un progetto con requisiti cliente è salvato con `formatVersion: 2`, così una versione vecchia dell'app lo rifiuta invece di perdere i requisiti cliente salvandolo; l'app legge sia 1 sia 2. All'apertura, un filo della radice che parte da un id cliente che non esiste più è rimosso, e un id cliente uguale a un id della libreria aperta produce un avviso nel banner con l'elenco degli id; nessuno dei due blocca l'apertura.

## Decision

**Chosen option**: Option 1: lettura del file in `start.py` con la libreria standard, confronto e salvataggio nel client dentro il file del progetto.

Una nuova rotta `POST /api/cliente/leggi` trasforma il file in fogli di celle di testo e non scrive nulla; il modulo nuovo `js/cliente.js` fa mappatura, validazione, confronto, anteprima, scheda Cliente e padre virtuale della radice, e scrive il risultato in `appState.cliente`, che il salvataggio del progetto porta su disco nella chiave `cliente`.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Invio del file**: JSON `{ nomeFile, contenuto }` con il contenuto in base64 (i byte scritti come testo), così la rotta passa per `leggi_corpo()` e `controlla_content_type()` come tutte le altre. Un file da 20 MB diventa circa 27 MB, sotto `MAX_CORPO` (50 MB). Scartato: corpo binario grezzo, che richiederebbe un secondo lettore del corpo e un'eccezione alla regola "le scritture sono JSON".
- **Limite del file**: `cliente.maxFileMB` controllato due volte, nel browser su `File.size` prima dell'invio (messaggio immediato) e in `start.py` sulla lunghezza del base64 prima di decodificarlo (massimo `ceil(maxFileMB × 1 048 576 / 3) × 4` caratteri), con errore `troppo_grande` e un messaggio che nomina il limite del file, non quello del progetto. `start.py` lo legge da `settings.json` solo all'avvio, come `progetti.versioni`. Scartato: solo nel browser, che lascerebbe il server senza difesa.
- **Lettura `.xlsx` e `.xlsm`**: `zipfile` più `xml.etree.ElementTree`. Fogli e loro percorsi da `xl/workbook.xml` e `xl/_rels/workbook.xml.rels` (un `Target` che comincia con `/` è relativo alla radice dello zip, altrimenti a `xl/`); solo le relazioni di tipo foglio di lavoro, non i fogli grafico; `state="hidden"` o `"veryHidden"` segna il foglio come nascosto. Testi da `xl/sharedStrings.xml`: si uniscono i `<t>` dei `<r>` e il `<t>` diretto di `<si>`, mai quelli dentro `<rPh>` (letture fonetiche). Per cella: `s` testo condiviso, `inlineStr` testo di `<is>`, `str` testo, `b` come `1` o `0`, `n` numero (intero senza decimali se `float(v).is_integer()`, altrimenti `repr(float(v))`), `e` errore come cella vuota; una cella senza `<v>` (anche una formula senza valore salvato) è vuota. La colonna viene dal riferimento `r` (es. `C5`), così le celle mancanti non spostano le altre. Le date restano il numero di Excel (limite accettato: ID e testi non sono date). Un file che comincia con la firma OLE (`D0 CF 11 E0`) è un `.xls` o un file cifrato, quindi `formato_non_supportato`. Difese: somma delle dimensioni decompresse delle parti lette al massimo 200 MB (contro gli zip bomba, file piccoli che si gonfiano), e un XML che contiene `<!DOCTYPE` è rifiutato come `file_illeggibile`. Scartato: `openpyxl`, una dipendenza da aggiungere all'exe.
- **Lettura CSV**: decodifica `utf-8-sig`, se fallisce `cp1252`; separatore da `csv.Sniffer` sui primi 64 KB, limitato a `;`, `,`, tabulazione, con `;` se non indovina (è il default dell'Excel italiano); `csv.field_size_limit` alzato a 10 MB per le celle lunghe; poi `csv.reader`. Il foglio ha il nome del file senza estensione. Un file senza celle non vuote è `file_vuoto`.
- **Dove vivono i requisiti cliente in memoria**: in `appState.cliente` (`null` se il progetto non ne ha), accanto a `appState.workspace`. `testoProgetto()` in `progetto.js` lo aggiunge al JSON, così il controllo "c'è qualcosa da salvare" vede ogni cambiamento. Ogni punto che oggi carica o sostituisce il workspace (`impostaProgetto()`, `sostituisciModello()`, apertura, nuovo progetto, Salva con nome, Duplica, import da file, Annulla, Ripeti, Ricarica) riceve e imposta anche `cliente`, e `problemaFileProgetto()` e `completaModello()` lo validano (forma dei campi, id unici, `prefisso` presente).
- **Versione del formato**: `FORMAT_VERSION` passa a 2 per ogni salvataggio; i lettori accettano 1 e 2. Un exe vecchio, che oggi rifiuta un formato sconosciuto, non può così aprire e riscrivere il file perdendo `cliente`. Scartato: restare a 1, più comodo ma con una strada per perdere dati in silenzio.
- **Padre virtuale della radice**: `pathStack[0].parentNode` resta `null`. L'estremo padre alla radice ha `ownerId` riservato `'__cliente__'` (costante `ID_CLIENTE` in `model.js`), quindi un filo cliente è `{ source: '__cliente__', sourceType: 'parent', sourceHandle: 'CLI-…' }`. `slugifyId()` e `generaId()` non producono mai quel valore; un blocco di libreria con quell'id è rifiutato. Le funzioni di `model.js` non leggono più `libreria[tipoPadre]` direttamente: ricevono una funzione `requisitoPadre(tipoPadre, reqId)` che alla radice (`tipoPadre === null`) cerca in `appState.cliente.requisiti` e altrove nella libreria. Scartato: un nodo Cliente finto nella libreria, che finirebbe nel file condiviso e nel changelog di tutti i progetti.
- **Punti del codice che oggi danno per scontato un padre in libreria** (tutti da aggiornare): `aggiornaRiferimentiRequisiti()` e la sua `visita(radice, null)` (altrimenti al primo `Salva` di un blocco collegato cancellerebbe tutti i fili cliente), `trovaRequisito()`, `getEstremoCoords()`, `render()` (oggi disegna i blocchi tondi solo se `pathStack.length > 1`), `renderParentBlocks()`, il trascinamento dei blocchi tondi e dei pin, `descriviRequisito()` e i suggerimenti (un requisito cliente non ha `metodoVerifica` né `testiExport` e può non avere `titolo`), `passaFiltro()` (il filtro per classe vale anche per il cliente), `omitUninvolved`. `isDerivazione()` guarda solo `sourceType` e resta com'è.
- **Chi sta sul canvas**: un requisito cliente è disegnato alla radice se e solo se ha una posizione in `workspace.parentReqPositions`; si tirano fili solo da blocchi disegnati, quindi un filo implica una posizione. Il rilascio la scrive, `Togli dal canvas` la toglie (solo senza fili). Se all'apertura un filo cliente non ha posizione (file modificato a mano), riceve una posizione di default in colonna a sinistra, salvata. Scartato: disegnarli tutti, illeggibile con migliaia di cerchi.
- **Rilascio sul canvas**: il trascinamento dalla scheda mette nel `dataTransfer` la chiave `requisitoCliente` con l'id; il gestore del `drop` in `app.js` controlla prima `blockType` (blocchi di oggi) e poi `requisitoCliente`. La posizione passa per `getCanvasCoords()`, quindi tiene conto di zoom e pan e cade sul punto di griglia (a differenza del rilascio dei blocchi di oggi, voce 11 dello scope).
- **Regole di confronto del reimport**: la chiave è `idCliente` come testo esatto. Un ritirato che ricompare conta solo come riattivato. `precedente` si scrive solo se era `null`, così dopo più import conserva i valori più vecchi non ancora visti. I fili dei ritirati sono rivalutati come quelli degli attivi quando cambia la tipologia.
- **Aggiornamento della scheda Cliente**: mai dentro `render()`, che gira a ogni movimento del mouse durante il trascinamento. `render()` segna solo la scheda come da aggiornare; l'aggiornamento avviene una volta per fotogramma (`requestAnimationFrame`) e solo se la scheda Cliente è visibile. La ricerca aspetta 200 ms dopo l'ultimo tasto. I conteggi dei fili passano per una mappa id → numero costruita una volta per aggiornamento, e `calcolaImport()` usa mappe per `idCliente` e per estremo dei fili, niente ricerche annidate.
- **Dettaglio nell'ispettore**: `mostraDettaglioCliente()` azzera `activeNodeId` e scrive in `#propsContent` come fa oggi il clic sul vuoto; non tocca il form della libreria. Segna come visto, Segna tutti come visti e Togli dal canvas cambiano `appState` e chiamano `render()`, quindi vanno su disco con l'autosalvataggio come ogni altra modifica.
- **Confronto puro**: una sola funzione `calcolaImport(cliente, righeValide, modalita, prefisso, workspace)` restituisce il nuovo `cliente.requisiti`, i conteggi, le liste delle schede e gli id dei fili che si perdono. L'anteprima la chiama a ogni cambio di mappatura o modalità, la conferma applica esattamente il suo risultato. Scartato: calcolare l'anteprima e poi rifare il lavoro alla conferma, due codici che possono divergere.
- **Ordine**: i requisiti presenti nel file seguono l'ordine del file; i ritirati mantengono la loro posizione relativa e vanno in coda dopo quelli del file.
- **Un import, un passo di Annulla**: la conferma cambia il modello, chiama `render()` una volta sola e poi forza subito il salvataggio (`svuota()` di `progetto.js`), così l'import diventa una versione a sé e non si fonde con un trascinamento fatto entro l'attesa dell'autosalvataggio. Scartato: un'API di import lato server, che dovrebbe riscrivere il progetto mentre il client lo autosalva.
- **Finestra di import**: una modale nuova `#importClienteModal` in `index.html`, non `#reportModal` (già condivisa da Apri e Changelog): l'import tiene stato tra più passi (file, mappatura, anteprima).
- **Aspetto**: ritirato = cerchio grigio tratteggiato con classe `parent-block-ritirato`; modificato = pallino arancione in alto a destra del cerchio (classe `segno-modificato`). Etichetta sotto il cerchio: `idCliente` e titolo, o i primi 30 caratteri del testo.
- **Limite di collegamento del ritirato**: il controllo sta in `verificaCollegamento()` di `model.js` (usata quando disegni un filo nuovo), mai in `verificaCompatibilita()`: quest'ultima serve alla pulizia dopo un `Salva` di libreria e dopo un import, e lì cancellerebbe i fili dei ritirati, che invece restano (AC-16).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (nel file `progetti/<slug>.json`, che da ora si salva con `formatVersion: 2`; si leggono 1 e 2; la chiave `cliente` è facoltativa; in memoria sta in `appState.cliente`):

```
progetto = { formatVersion: 2, nome, libraryPath, workspace, cliente? }

cliente = {
  prefisso: string,                 // es. "CLI-", copiato da settings al primo import, poi fisso
  requisiti: RequisitoCliente[],    // ordine del file, ritirati in coda
  ultimoImport: ImportInfo | null
}

RequisitoCliente = {
  id: string,                       // prefisso + idCliente, unico nel progetto e diverso da ogni id di libreria; è sourceHandle dei fili
  idCliente: string,                // ID del file, senza spazi ai bordi, unico in cliente.requisiti; chiave del reimport
  testo: string,                    // obbligatorio, non vuoto
  titolo: string | null,
  note: string | null,
  sezione: string | null,
  tipologia: string | null,         // null = capacità; altrimenti una chiave di requirements.typeColors
  stato: 'attivo' | 'ritirato',
  modificato: boolean,
  precedente: { testo, titolo, tipologia } | null   // valori prima della modifica; null quando modificato è false
}

ImportInfo = {
  data: string (ISO 8601), nomeFile: string, foglio: string, rigaIntestazione: number (da 1),
  modalita: 'sostituisci' | 'aggiungi',
  colonne: { id, testo, titolo, note, sezione, tipologia },   // ognuna { nome: string, lettera: string } o null (nessuna)
  conteggi: { nuovi, modificati, riattivati, ritirati, invariati, scartati, filiPersi }
}
```

Relazioni: `progetto` 1 a 0..1 `cliente`; `cliente` 1 a N `RequisitoCliente`; `cliente` 1 a 1 `ImportInfo`. Un `RequisitoCliente` 1 a N fili della radice (`workspace.edges` con `source: '__cliente__'`, `sourceType: 'parent'` e `sourceHandle` uguale al suo `id`); 1 a 0..1 posizione in `workspace.parentReqPositions[id]` (presente = sul canvas). Nessuna migrazione dei file: un progetto con `formatVersion: 1` e senza `cliente` è un progetto con zero requisiti cliente, e al primo salvataggio diventa `formatVersion: 2`.

**State transitions** (`RequisitoCliente.stato`, solo alla conferma di un import):
- (assente) → `attivo`: l'ID compare per la prima volta nel file.
- `attivo` → `ritirato`: modalità Sostituisci e l'ID manca nel file.
- `ritirato` → `attivo`: l'ID ricompare nel file (qualsiasi modalità); accende `modificato`.
- `modificato`: `false` → `true` quando testo, titolo o tipologia cambiano, o al ritorno da ritirato; `true` → `false` con Segna come visto o Segna tutti come visti. Nessuna eliminazione di un requisito cliente in questa funzionalità.

**API surface** (errori come `{ errore, messaggio }` in italiano, come 0001 e 0002; la rotta controlla `Host` e `Origin` e richiede `Content-Type: application/json`; non usa il lock perché non tocca il disco):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/cliente/leggi` | POST | `nomeFile`: string (req, estensione `.xlsx` o `.csv`), `contenuto`: string base64 (req) | `{ formato: 'xlsx' \| 'csv', fogli: [{ nome, righe: string[][] }] }`, righe vuote finali tolte | solo `localhost` (come tutte le `/api/`) | 413 `troppo_grande` (oltre `cliente.maxFileMB`, o più di 200 MB decompressi), 415 `formato_non_supportato` (`.xls`, cifrato, estensione diversa da `.xlsx`, `.xlsm`, `.csv` senza distinguere maiuscole), 422 `file_illeggibile` (zip o XML rotto, XML con `<!DOCTYPE`, CSV non decodificabile), 422 `file_vuoto`, 400 `richiesta_non_valida` |

Funzioni client nuove (in `js/cliente.js` salvo dove indicato):

| Funzione | Cosa fa |
|---|---|
| `leggiFileCliente(file)` | controlla `maxFileMB`, legge in base64, chiama `/api/cliente/leggi` tramite `chiamaApi()` |
| `estraiRighe(foglio, rigaIntestazione, colonne)` | righe dati mappate a `{ riga, idCliente, testo, titolo, note, sezione, tipologia }`, stringhe senza spazi ai bordi, vuote a `null` |
| `validaRighe(righe, prefisso, library)` | `{ valide, scartate: [{ riga, idCliente, motivo }] }` secondo AC-6 |
| `calcolaImport(cliente, valide, modalita, prefisso, workspace)` | funzione pura: nuovo elenco, conteggi, liste delle schede, id dei fili persi |
| `applicaImport(risultato, info)` | scrive `appState.cliente`, toglie i fili persi, `render()` una volta, poi `svuota()` |
| `requisitoPadre(tipoPadre, reqId)` e `requisitiPadre(tipoPadre)` (`model.js`, con `ID_CLIENTE`) | requisito o requisiti dei blocchi tondi: cliente quando `tipoPadre` è `null` (radice), libreria altrove; passati alle funzioni di `model.js` che oggi leggono `libreria[tipoPadre]` |
| `controllaClienteAllApertura()` | rimuove i fili cliente orfani, dà posizione ai fili senza posizione, avvisa delle collisioni con la libreria (AC-20) |
| `initSchedaCliente()` / `aggiornaSchedaCliente()` | scheda Cliente: elenco, ricerca, filtri, trascinamento |
| `mostraDettaglioCliente(id)` (`inspector.js`) | dettaglio in sola lettura, Segna come visto, Togli dal canvas |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Leggi file | limite in MB | `appSettings.cliente.maxFileMB` (client), `settings.json` letto all'avvio (server) |
| Leggi file | celle di ogni foglio | `/api/cliente/leggi` |
| Mappatura | nomi di colonna nei menu | riga `rigaIntestazione` del foglio scelto, lettera calcolata dall'indice |
| Mappatura al reimport | foglio, riga, colonne proposti | `cliente.ultimoImport` (colonna per nome, se ambiguo o assente per lettera) |
| Mappatura | fogli nascosti | attributo `state` in `xl/workbook.xml`, restituito dall'API come `nascosto: true` nel foglio |
| Validazione | tipologie ammesse | chiavi di `appSettings.requirements.typeColors` |
| Validazione | id di libreria da evitare | tutti i `requisiti[].id` di `appState.library` |
| Validazione | numero di riga nel messaggio | indice nel foglio più 1 (numerazione di Excel) |
| Import | `id` | `cliente.prefisso` + `idCliente`; al primo import `prefisso` = `appSettings.cliente.prefisso` |
| Import | `modificato`, `precedente` | confronto di testo, titolo, tipologia con il requisito esistente con lo stesso `idCliente` |
| Import | fili che si perdono | fili della radice con un estremo cliente la cui tipologia cambia, rivalutati con `verificaCompatibilita()` di `model.js` |
| Import | `ultimoImport.data` | `new Date().toISOString()` alla conferma |
| Import | `ultimoImport.nomeFile` | `File.name` scelto dall'utente |
| Scheda | numero di fili | conteggio in `workspace.edges` con `sourceType` o `targetType` `'parent'` e handle uguale all'id |
| Scheda | Sul canvas | presenza in `workspace.parentReqPositions` |
| Scheda | nessun progetto aperto | `progetto.slug` di `progetto.js` vuoto |
| Scheda | elenco sezioni | valori distinti non nulli di `sezione` |
| Scheda | quante righe | `appSettings.cliente.righePannello` |
| Anteprima | quante righe nella scheda Nuovi | `appSettings.cliente.righeAnteprima` |
| Canvas | colore del blocco tondo | `typeColors[tipologia]` o `capabilityColor`, come i blocchi tondi di oggi |
| Canvas | posizione al rilascio | `getCanvasCoords()` del punto di rilascio |
| Apertura | posizione di default (solo fili senza posizione) | colonna a sinistra con il passo di `getParentBlockCenter()` di oggi, a partire dal primo posto libero; salvata subito in `parentReqPositions` |
| Import disattivato | c'è un conflitto | stato del banner di `progetto.js` (conflitto di progetto aperto) |

**Key invariants**:
- `id` e `idCliente` sono unici dentro `cliente.requisiti`; `id` = `prefisso + idCliente` sempre.
- Nessun `id` cliente coincide con un id di requisito della libreria aperta (controllato all'import, AC-6, e al `Salva` della libreria, AC-17).
- `precedente` è `null` se e solo se `modificato` è `false`.
- `testo` non è mai vuoto; `tipologia` è `null` o una chiave di `typeColors` al momento dell'import.
- Ogni filo della radice con estremo `'parent'` punta a un `id` presente in `cliente.requisiti` e rispetta `verificaCompatibilita()` (dopo ogni conferma di import).
- `cliente.prefisso` non cambia dopo il primo import.
- Un requisito cliente con almeno un filo ha sempre una posizione in `workspace.parentReqPositions`.
- `appState.cliente` e `appState.workspace` sono sempre dello stesso momento: si caricano, si salvano, si annullano e si ripetono insieme.
- Nessun nodo né blocco di libreria ha id `__cliente__`.
- La rotta `/api/cliente/leggi` non scrive mai su disco.

**Security model**: un solo utente in locale. La rotta nuova passa per i controlli di tutte le `/api/` (`Host` e `Origin` solo `localhost`, nessun CORS), accetta solo JSON, ha un limite di dimensione, e non scrive né legge file sul disco: lavora solo sui byte ricevuti. Nessun percorso arriva dal client, quindi nessun rischio di uscire dalle cartelle ammesse. Il contenuto del file è dato non fidato: ogni testo del cliente messo in `innerHTML` passa per `escapeHtml()`. Il parser XML lavora su file dell'utente in locale; si usa `xml.etree.ElementTree`, che non risolve entità esterne. Nessun dato regolamentato.

**Configuration required** (nuove chiavi in `settings.json`, in `DEFAULT_SETTINGS` e nel merge annidato di `loadSettings()` in `js/state.js`):
- `cliente.prefisso`: `"CLI-"`, prefisso degli id cliente per i progetti che importano la prima volta.
- `cliente.maxFileMB`: `20`, dimensione massima del file; `start.py` lo legge all'avvio (riavvia il server dopo averlo cambiato).
- `cliente.righeAnteprima`: `200`, righe mostrate nella scheda Nuovi dell'anteprima.
- `cliente.righePannello`: `300`, righe mostrate nella scheda Cliente.

**Critical test scenarios**:
- Happy path: CSV di 3000 righe con `;` e accenti in Windows-1252, mappi ID e Testo, confermi; la scheda Cliente ne elenca 3000, ne trascini uno alla radice, tiri un filo verso un pin di capacità, chiudi e riapri: tutto c'è. Verifica **AC-1**, **AC-3**, **AC-5**, **AC-9**, **AC-12**, **AC-13**, **AC-14**.
- Reimport: secondo file con 5 testi cambiati, 3 righe tolte, 2 nuove, 1 ritirato che ricompare, 1 tipologia cambiata su un requisito collegato; l'anteprima conta 6 modificati (5 testi più 1 tipologia), 3 ritirati, 2 nuovi, 1 riattivato, 1 filo perso; in modalità Aggiungi i ritirati diventano 0. Verifica **AC-4**, **AC-7**, **AC-8**, **AC-9**, **AC-11**.
- Righe errate: file con un ID ripetuto 2 volte, una riga senza testo, una tipologia `Pneumatica`; 4 scartate con riga e motivo, le altre entrano. Verifica **AC-6**.
- Annulla: dopo un import sbagliato seguito subito da un trascinamento, Ctrl+Z annulla prima il trascinamento e poi l'import, con requisiti cliente e fili sempre allineati; Ripeti li rimette. Verifica **AC-9**, **AC-19**.
- Pulizia della libreria: con un filo cliente verso `cen_002`, modifichi e salvi il blocco `centralina` in libreria; il filo cliente resta. Verifica **AC-14**.
- Formato: un progetto con cliente si salva come `formatVersion: 2` e si riapre; un file con un filo verso un id cliente inesistente si apre senza quel filo. Verifica **AC-20**.
- Formati rifiutati: un `.xls`, un `.xlsx` con password, un file da 25 MB; messaggio chiaro e progetto invariato. Verifica **AC-2**.
- Regole: un filo da un ritirato è rifiutato; `Togli dal canvas` è spento se ci sono fili; il rilascio dentro un blocco è rifiutato; un `Salva` di libreria con id `CLI-SSS-012` è rifiutato. Verifica **AC-13**, **AC-15**, **AC-16**, **AC-17**.
- Accesso: una richiesta a `/api/cliente/leggi` con `Origin` di un altro sito riceve 403. Verifica la regola di sicurezza comune (nessun AC dedicato).

## Build plan

Tracer Bullet: il primo compito porta un CSV fino al canvas e al disco con il minimo, i successivi allargano formati, confronto e pannello.

1. **Filo minimo dal CSV al canvas e al disco, andata e ritorno**: chiavi `cliente` in `settings.json`, `DEFAULT_SETTINGS` e `loadSettings()`; `appState.cliente` letto e scritto da ogni percorso di `progetto.js` (`testoProgetto()`, apertura, nuovo, Salva con nome, Duplica, import e download, Annulla, Ripeti, Ricarica) con `formatVersion: 2`; rotta `/api/cliente/leggi` in `start.py` per il solo CSV (codifica, separatore, limite); `js/cliente.js` con lettura, mappatura di ID e Testo sulla riga 1 del foglio unico, conferma dei soli nuovi con il prefisso e `svuota()`; `ID_CLIENTE` e `requisitoPadre()` in `model.js`, passati ad `aggiornaRiferimentiRequisiti()` e alle altre funzioni, e usati in tutti i punti del renderer elencati nelle decisioni; schede Libreria e Cliente con elenco semplice e trascinamento sul canvas con `getCanvasCoords()`; fili dal cliente con le regole di derivazione. Satisfies **AC-1**, **AC-10**, **AC-13**, **AC-14**, **AC-19**, **AC-20** (e AC-3, AC-5 per il CSV).
2. **Excel, fogli, colonne e mappatura ricordata**: lettore `.xlsx` in `start.py` (fogli, testi condivisi, tipi di cella, riferimenti di colonna, firma OLE); finestra `#importClienteModal` con foglio, riga di intestazione, tutti e sei i campi; `ultimoImport` salvato e riproposto; errori del server e del formato. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**.
3. **Validazione, anteprima e reimport**: `validaRighe()` e `calcolaImport()`; conteggi e quattro schede; modalità Sostituisci e Aggiungi; modificati con `precedente`, ritirati, riattivati; fili persi rimossi alla conferma; un solo `render()` per l'Annulla in un passo. Satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-11**.
4. **Scheda Cliente completa, dettaglio e stati sul canvas**: ricerca, filtri di stato e sezione, limite di righe, segni; dettaglio nell'ispettore con Segna come visto, Togli dal canvas e centratura; Segna tutti come visti; ritirato tratteggiato e rifiutato in `verificaCollegamento()`, segno del modificato. Satisfies **AC-12**, **AC-15**, **AC-16**.
5. **Protezioni**: `Salva` della libreria che rifiuta un id cliente; `Importa…` disattivato durante un conflitto del progetto o senza progetto aperto. Satisfies **AC-17**, **AC-18**.

## Consequences

**Positive**:
- Nessuna dipendenza nuova: l'exe e la regola "niente npm" restano intatti.
- Autosalvataggio, versioni e Annulla della spec 0001 coprono l'import senza codice nuovo lato server.
- Il reimport è ripetibile: mappatura ricordata, confronto sull'ID del cliente, nessun filo perso tranne quelli diventati invalidi, e sempre annunciati prima.
- La radice ha finalmente un padre: gerarchia (voce 5), controllo di coerenza (voce 4) e matrice (voce 6) partono da un modello già completo.

**Negative / tradeoffs**:
- Il file del progetto cresce: 5000 requisiti con testi lunghi possono pesare qualche MB, e ogni autosalvataggio lo riscrive intero. Accettato per ora; se diventa lento, il rimedio è misurare e poi spostare `cliente` in un file a parte.
- Il lettore `.xlsx` scritto a mano copre i casi comuni ma non tutto il formato: date come numeri, niente `.xls`, niente file cifrati. Chi riceve un file strano lo risalva da Excel.
- Il prefisso rende gli id diversi da quelli che il cliente riconosce; la scheda e il dettaglio mostrano sempre anche l'ID originale.
- Il controllo contro gli id di libreria vale solo per la libreria del progetto aperto: un altro progetto con la stessa libreria non è controllato quando salvi un blocco.
- I requisiti ritirati non si eliminano mai in questa funzionalità: restano nel file finché non arriva un modo per ripulirli.

**Neutral**:
- `model.js` guadagna il concetto di padre della radice (`requisitiPadre()`), che le funzionalità di tracciabilità useranno.
- Nuovo modulo `js/cliente.js`, da aggiungere a `js/AGENTS.md` (lo fa `/sync`).
- `start.py` legge una chiave in più da `settings.json` all'avvio.
- Il formato del progetto passa a 2: un exe costruito prima di questa funzionalità non apre più i progetti salvati dopo. È voluto (meglio un rifiuto che una perdita), ma va ricordato quando si distribuisce l'exe.

## Follow-up

- [ ] Il rilascio dei blocchi di libreria ignora ancora zoom e pan (voce 11 dello scope); il rilascio dei requisiti cliente usa già `getCanvasCoords()`, la voce 11 può copiarne il modo.
- [ ] Decidere come eliminare davvero i requisiti ritirati (pulizia manuale o dopo N import), quando la lista diventa scomoda.
- [ ] Il Controllo di coerenza (voce 4) deve considerare "senza figli" solo i requisiti cliente attivi, e segnalare i fili che partono da un ritirato.
- [ ] Se servirà leggere i `.xls` vecchi o le date di Excel come date, riaprire la scelta del lettore (SheetJS copiata in `js/vendor/` era la seconda opzione).
