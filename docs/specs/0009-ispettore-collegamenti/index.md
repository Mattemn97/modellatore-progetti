# 0009. Ispettore dei collegamenti: selezione di un filo e dettaglio dei due requisiti

**Date**: 2026-10-02
**Status**: Accepted

## Summary

Un clic su un filo lo seleziona: il filo si evidenzia e il pannello a destra mostra il tipo di relazione (derivazione padre → figlio o collegamento tra blocchi) e, per ciascuno dei due requisiti collegati, id, titolo, blocco, classe, metodo di verifica e testi da esportare, con un pulsante per eliminare il filo. La selezione vive in `renderer.js` come id del filo più percorso del livello, non come oggetto, così Annulla, Ripeti e Ricarica non la rompono. Niente di nuovo entra nel file del progetto.

## Requirements

**User stories**:
- Come progettista voglio cliccare un filo e vedere quali due requisiti collega, con classe e testi, così capisco una derivazione senza aprire i blocchi.
- Come progettista voglio eliminare il filo selezionato dal pannello, oltre che con il clic destro.

**Acceptance criteria**:
- **AC-1**: Un clic sinistro su un filo lo seleziona: il filo si disegna con la classe `filo-selezionato` (spessore 5 px e alone blu `#0078d4`), un solo filo alla volta. Selezionare un filo toglie la selezione del blocco (`activeNodeId` nullo) e del requisito cliente evidenziato. Un clic su un blocco, su un blocco tondo cliente (dettaglio), su `+ Nuovo Blocco`, o un clic sullo sfondo vuoto del canvas toglie la selezione del filo. Entrare in un blocco o risalire toglie la selezione.
- **AC-2**: Con un filo selezionato il pannello destro (`#propsContent`) mostra il titolo `Collegamento`, la riga **Relazione** (`Derivazione padre → figlio` se `isDerivazione(edge)`, altrimenti `Collegamento tra blocchi`) e due sezioni: per una derivazione `Padre` (l'estremo di tipo `parent`) e `Figlio`; per un collegamento tra blocchi `Da` (source) e `A` (target).
- **AC-3**: Ogni sezione mostra: **ID** (per un requisito cliente l'ID del cliente, `idCliente`, altrimenti l'id), **Titolo** (`titoloRequisito()`), **Blocco** (per un pin: etichetta dell'istanza e, se diverso, il titolo del blocco di libreria tra parentesi; per un blocco tondo dentro un blocco: `Blocco padre: <etichetta del blocco aperto>`; per un requisito cliente: `Cliente`), **Classe** (`getClasseRequisito()`), **Metodo di verifica** (solo libreria; `non definito` se vuoto), **Testi da esportare** (un elenco `[documento] testo`, `[?]` se senza documento; per un requisito cliente il suo testo come unica voce; `Nessun testo` se vuoto). Ogni testo dell'utente passa per `escapeHtml()`.
- **AC-4**: Se un estremo non si trova (blocco sparito, requisito cancellato, blocco senza definizione) la sua sezione dice `Requisito non trovato: <reqId>` al posto dei campi. Se il filo non è valido secondo `verificaCollegamento`/`verificaCompatibilita` (tipologie diverse, interfaccia con capacità) sotto la Relazione compare `⚠️ <motivo>`.
- **AC-5**: Il pulsante `🗑 Elimina collegamento` chiede `Vuoi eliminare questo collegamento?`; su conferma toglie il filo dal livello come il clic destro, toglie la selezione, ridisegna (il salvataggio automatico parte come per ogni modifica) e il pannello torna a `Seleziona un blocco o creane uno nuovo...`. Su annulla non cambia nulla.
- **AC-6**: La selezione si risolve a ogni disegno dagli id (percorso dei livelli aperti più id del filo). Se dopo Annulla, Ripeti, Ricarica, cambio di progetto o una modifica di libreria il filo non c'è più nel livello, la selezione si toglie e, se il pannello mostrava quel filo, torna al messaggio vuoto. Se c'è ancora, il pannello si aggiorna con i dati di adesso solo se mostrava quel filo.
- **AC-7**: Il doppio clic su un filo continua ad aggiungere uno snodo e il clic destro a eliminarlo; con la Gerarchia attiva il clic su un filo lo seleziona come sempre (non sceglie requisiti). Selezionare, mostrare e deselezionare un filo non cambia il file del progetto.

## Decision

**Chosen option**: selezione del filo in `renderer.js` (stato di sola vista per id) e dettaglio in una nuova `mostraDettaglioCollegamento(edge, graph, parentNode)` in `inspector.js`.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Stato**: `filoSelezionato = { percorso: string, edgeId }` in `renderer.js`, dove `percorso` è `pathStack.map(l => l.id).join('/')`. Esportate `selezionaFilo(edgeId)`, `togliSelezioneFilo()`, `filoSelezionatoId()`. Scartato: tenere l'oggetto `edge` (Annulla e Ricarica sostituiscono gli oggetti, convenzione di `js/AGENTS.md`).
- **Risoluzione in `render()`**: se il percorso non è quello del livello corrente o l'id non c'è tra i fili del livello, la selezione si toglie e, se `#propsContent` ha `data-filo` uguale a quell'id, il pannello torna al messaggio vuoto. Se c'è e `data-filo` coincide, il dettaglio si ridisegna al più una volta per fotogramma (`requestAnimationFrame`, come le schede), mai durante un trascinamento.
- **Clic**: un gestore `click` sul `path` del filo chiama `selezionaFilo(edge.id)` con `stopPropagation()`. Lo sfondo: nel gestore `mousedown` dello sfondo (`e.target === svg` o `#gridBackground`) si registra il punto; al `mouseup` senza spostamento (meno di 3 px) si toglie la selezione del filo (così il pan non deseleziona).
- **Deselezione dagli altri punti**: `selectNode()`, `mostraDettaglioCliente()`, `renderNewBlockForm()` (inspector) e `enterNode()` / Indietro / breadcrumb chiamano `togliSelezioneFilo()`; il ritorno al livello passa comunque da `render()`, che la toglie perché il percorso cambia.
- **Dettaglio**: `mostraDettaglioCollegamento()` riceve l'edge del livello di adesso; ricava gli estremi con una funzione esportata da `renderer.js`, `descriviEstremo(ownerId, reqId, ownerType)` → `{ req, nodo, def, tondo, cliente }` o `{ mancante: true, reqId }`. Validità con `verificaCompatibilita(a, b)` di `model.js` sugli estremi trovati. Il pannello porta `data-filo="<edgeId>"`.
- **Eliminazione**: la stessa operazione del clic destro, estratta in `eliminaFilo(graph, edgeId)` in `renderer.js` e usata da entrambi.
- **Stile**: `.edge-path.filo-selezionato { stroke-width: 5px; filter: drop-shadow(0 0 4px #0078d4); }`; con la Gerarchia attiva la classe si aggiunge alle altre.

**Implementation skills**: none.

## Feature design

**Data model sketch**: nessun dato nuovo nel modello. Stato di vista `filoSelezionato = { percorso: string, edgeId: string } | null` in `renderer.js`.

**State transitions**: `nessuna selezione` → `filo selezionato` (clic sul filo) → `nessuna selezione` (clic su blocco, cliente, nuovo blocco, sfondo, cambio livello, eliminazione, filo sparito).

**API surface** (funzioni client):

| Funzione | Input | Output | Casi |
|---|---|---|---|
| `selezionaFilo(edgeId)` (`renderer.js`) | id del filo del livello corrente | stato, `setActiveNodeId(null)`, dettaglio, `render()` | id sconosciuto: nulla |
| `togliSelezioneFilo()` (`renderer.js`) | | stato nullo | |
| `descriviEstremo(ownerId, reqId, ownerType)` (`renderer.js`) | estremo | `{ req, nodo, def, tondo, cliente }` o `{ mancante, reqId }` | |
| `eliminaFilo(graph, edgeId)` (`renderer.js`) | | toglie il filo, `render()` | |
| `mostraDettaglioCollegamento(edge)` (`inspector.js`) | filo del livello | HTML del pannello con `data-filo` | estremo mancante, filo non valido |

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Dettaglio | relazione | `isDerivazione(edge)` |
| Dettaglio | lati | `edge.sourceType` / `targetType` (`parent` = padre) |
| Dettaglio | ID, titolo, classe, metodo, testi | `req` da `descriviEstremo()`: `idCliente` o `id`, `titoloRequisito()`, `getClasseRequisito()`, `metodoVerifica`, `testiExport` (cliente: `testo`) |
| Dettaglio | blocco | `nodo.label`, `def.titolo`; blocco aperto `getCurrentLevel().parentNode.label`; `Cliente` alla radice |
| Dettaglio | motivo di non validità | `verificaCompatibilita(a, b)` |
| Selezione | percorso | `pathStack` ids |

**Key invariants**: la selezione non entra mai in `appState` né nel file del progetto; il dettaglio si costruisce sempre dal filo di adesso, mai da oggetti tenuti da prima; un solo filo selezionato.

**Security model**: un utente locale; tutto il testo dell'utente nel pannello passa per `escapeHtml()`.

**Configuration required**: nessuna.

**Critical test scenarios**:
- Clic sul filo di derivazione `1` → `CEN_001`: filo evidenziato, Relazione derivazione, Padre `1` (Cliente, testo), Figlio `CEN_001` (Centralina A (Centralina), Capacità, Test, testi). Verifica **AC-1**, **AC-2**, **AC-3**.
- Clic sul filo tra Centralina A e Pompa A: `Collegamento tra blocchi`, Da e A. Dentro un blocco: Padre `Blocco padre: Centralina A`. Verifica **AC-2**, **AC-3**.
- Elimina dal pannello con conferma: il filo sparisce, pannello vuoto; con annulla resta. Verifica **AC-5**.
- Annulla dopo l'eliminazione: il filo torna, nessuna selezione. Selezione, poi Ripeti di un'altra modifica: il dettaglio resta. Verifica **AC-6**.
- Clic su un blocco, sullo sfondo, Indietro: selezione tolta; pan dello sfondo non toglie la selezione. Verifica **AC-1**.
- Filo con tipologie diverse (scritto nel file): `⚠️` con il motivo. Verifica **AC-4**.

## Build plan

1. Stato, clic e stile: `filoSelezionato`, `selezionaFilo()`, `togliSelezioneFilo()`, classe `filo-selezionato`, deselezione da blocchi, cliente, nuovo blocco, sfondo, cambio livello. Satisfies **AC-1**, **AC-7**.
2. Dettaglio: `descriviEstremo()`, `mostraDettaglioCollegamento()` con relazione, lati, campi, mancanti e validità. Satisfies **AC-2**, **AC-3**, **AC-4**.
3. Eliminazione e risoluzione per id: `eliminaFilo()` condivisa con il clic destro, pulsante, risoluzione in `render()` dopo Annulla, Ripeti, Ricarica. Satisfies **AC-5**, **AC-6**.

## Consequences

**Positive**: si legge una derivazione con un clic; l'eliminazione dal pannello è più scopribile del clic destro.

**Negative / tradeoffs**: un clic sul filo non apre più nulla di diverso da prima ma ora cambia il pannello destro, perdendo un eventuale form di blocco aperto non salvato (come già succede cliccando un altro blocco). I fili sono sottili (2,5 px): selezionarli richiede precisione.

**Neutral**: nuove esportazioni in `renderer.js` e `inspector.js`, da riportare in `js/AGENTS.md`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
