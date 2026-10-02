# 0010. Gestione completa della libreria: eliminare un blocco e rinominarne l'id

**Date**: 2026-10-02
**Status**: In Progress

## Summary

Nel form di un blocco di libreria compaiono due azioni nuove: `🗑 Elimina dalla libreria` e `✏️ Rinomina ID`. Eliminare è permesso solo se il blocco non è usato nel progetto aperto; se è usato ricevi l'elenco delle istanze con il loro percorso e nulla cambia. Rinominare l'id sposta il blocco sotto il nuovo id nel file della libreria e aggiorna tutte le istanze del progetto. Il server ha due rotte nuove, `/api/libreria/elimina` e `/api/libreria/rinomina`, che registrano nel changelog una versione major (un blocco eliminato o con id nuovo rompe gli altri progetti che lo usano), con gli stessi controlli di conflitto e sola lettura del salvataggio di oggi.

## Requirements

**User stories**:
- Come progettista voglio eliminare dalla libreria un blocco che non uso più, e sapere dove è usato se provo a eliminarne uno in uso.
- Come progettista voglio correggere l'id di un blocco senza ricostruire le istanze a mano.

**Acceptance criteria**:
- **AC-1**: Nel form di un blocco di libreria già esistente (non nel form di un blocco nuovo) ci sono il collegamento `✏️ Rinomina ID` accanto all'etichetta "ID Blocco di Libreria" e il pulsante rosso `🗑 Elimina dalla libreria` sotto `📋 Salva come Nuovo Blocco Simile`. Entrambi sono disattivati, con il motivo nel suggerimento, quando la libreria è in sola lettura, in conflitto o durante un salvataggio (le stesse condizioni di `🔄 Aggiorna Blocco di Libreria`).
- **AC-2**: `🗑 Elimina dalla libreria` su un blocco usato nel progetto aperto (almeno un nodo con `type` uguale all'id, a qualsiasi livello) non chiama il server e mostra: `Il blocco "<titolo>" è usato in <N> istanze nel progetto e non si può eliminare. Togli prima le istanze:` seguito da una riga per istanza `- <percorso>` (etichette dal nome della radice del breadcrumb fino all'istanza, unite da ` › `), al massimo 20, poi `… e altre <M>`.
- **AC-3**: Su un blocco non usato chiede conferma con `Eliminare il blocco "<titolo>" (<id>) dalla libreria? La libreria passa a una nuova versione major; gli altri progetti che lo usano lo vedranno come blocco senza definizione.` Su conferma chiama `/api/libreria/elimina`; se riesce il blocco sparisce dalla libreria (albero a sinistra compreso), il pannello torna a `Seleziona un blocco o creane uno nuovo...` e compare `Blocco eliminato. Libreria v<versione> (major).` Livello e Motivo del form vanno nella richiesta come per il salvataggio.
- **AC-4**: `✏️ Rinomina ID` chiede il nuovo id con `prompt` (precompilato con l'id attuale). Annulla, vuoto o uguale all'attuale non fanno nulla. Un id che non rispetta `^[A-Za-z0-9_.-]+$` o supera 200 caratteri dà `L'ID può contenere solo lettere, cifre, underscore, trattino e punto (al massimo 200 caratteri).`; un id già usato da un altro blocco (senza distinguere le maiuscole) dà `Un blocco con ID "<id>" esiste già nella libreria.`. In entrambi i casi nulla cambia.
- **AC-5**: Con un id valido chiama `/api/libreria/rinomina`; se riesce: nella libreria il blocco sta sotto il nuovo id (stesso posto nell'ordine del file, campo `id` aggiornato, requisiti e testi invariati), ogni nodo del progetto aperto con `type` uguale al vecchio id passa al nuovo (a ogni livello), il progetto si salva in automatico, il form si riapre sul nuovo id e compare `ID rinominato: <vecchio> → <nuovo>. <N> istanze aggiornate. Libreria v<versione> (major).`
- **AC-6**: Server, `POST /api/libreria/elimina` con `{ percorso, idBlocco, improntaAttesa, livello, nota, forza? }` e `POST /api/libreria/rinomina` con `{ percorso, idBlocco, nuovoId, improntaAttesa, livello, nota, forza? }`: stessi controlli del salvataggio su percorso scrivibile (403), formato futuro (403), `livello` e `nota` (400), impronta diversa senza `forza` (409 `conflitto` con l'impronta attuale); in più `idBlocco` assente nel file (404 `non_trovato`), libreria in formato vecchio (409 `formato_vecchio`: `Salva prima una modifica di un blocco: converte la libreria al formato nuovo.`), e per la rinomina `nuovoId` non valido (400 `id_non_valido`), uguale a quello di adesso (400 `id_uguale`) o già usato da un altro blocco senza distinguere le maiuscole (409 `esiste`). La risposta ha la stessa forma di `/api/libreria/salva` (`libreria`, `impronta`, `formato`, `versione`, `voce`, `vociAggiunte`, `avviso` se la scrittura del changelog o del riferimento fallisce).
- **AC-7**: Changelog: l'eliminazione registra la modifica `{ blocco, titolo, tipo: 'eliminato', requisiti: [ogni requisito 'rimosso'] }` (già prodotta da `confronta_blocco`); la rinomina registra `{ blocco: <nuovo>, idPrecedente: <vecchio>, titolo, tipo: 'rinominato', campiBlocco: ['id'], requisiti: [] }`. Entrambe sono `major` per il calcolo automatico. La finestra Changelog mostra la rinomina come `<titolo> <nuovo> rinominato (prima <vecchio>)` e il filtro trova la voce anche con il vecchio id.
- **AC-8**: Un conflitto su una delle due rotte apre il banner della libreria come oggi; `Sovrascrivi` rimanda la stessa richiesta, alla stessa rotta, con `forza: true`; `Ricarica` ricarica la libreria e chiude il form se il blocco non c'è più.

## Decision

**Chosen option**: due rotte server dedicate che condividono con `salva()` la parte di scrittura (versione, changelog, riferimento), e due funzioni client in `libreria.js` sopra lo stesso `invia()`, che ora riceve la rotta.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Eliminazione solo se non usato**: il controllo è sul progetto aperto (l'unico che l'app conosce). Scartato: eliminare comunque lasciando nodi senza definizione (il progetto si romperebbe in silenzio) o togliere anche le istanze (operazione distruttiva sul progetto, da un form di libreria).
- **Server**: `salva()` si divide in controlli e in `_applica(f, dati, oggetto, contenuto, changelog, library_nuova, modifica, livello, nota)` che allinea il changelog (`allinea`), calcola il livello (`livello_di`, che ora tratta `tipo == 'rinominato'` come major), scrive libreria, voce e riferimento e costruisce la risposta. `elimina()` e `rinomina_blocco()` in `Librerie` fanno i loro controlli e chiamano `_applica()`. La rinomina ricostruisce il dizionario della libreria mantenendo l'ordine delle chiavi. Instradamento in `instrada()` accanto a `salva`.
- **Client**: `invia(rotta, corpo, record)`; `conflitto = { rotta, corpo, ...record }`; `sovrascriviLibreria()` usa `conflitto.rotta`. Nuove `eliminaBloccoLibreria(idBlocco, opzioni, alSuccesso)` e `rinominaBloccoLibreria(idBlocco, nuovoId, opzioni, alSuccesso)` con gli stessi controlli iniziali di `salvaBloccoLibreria()`; `aggiornaPulsantiLibreria()` gestisce anche `#btnEliminaBloccoLib` e `#lnkRinominaBlocco`.
- **Istanze**: una funzione `istanzeDelBlocco(idBlocco)` in `inspector.js` percorre `pathStack[0].graph` e i loro `internal_graph` e restituisce `{ nodo, percorso }` per ogni nodo con quel `type`; la rinomina la usa per aggiornare `node.type`.
- **Changelog client**: `htmlModifica()` aggiunge ` (prima <code>…</code>)` quando la modifica ha `idPrecedente`; `toccaFiltro()` guarda anche `m.idPrecedente`.

**Implementation skills**: none.

## Feature design

**Data model sketch**: nessun campo nuovo. La modifica di changelog `rinominato` di un blocco aggiunge `idPrecedente` (stesso nome già usato per i requisiti).

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|
| `/api/libreria/elimina` | POST | percorso, idBlocco, improntaAttesa, livello, nota, forza? | libreria, impronta, formato, versione, voce, vociAggiunte | 403, 400, 404 `non_trovato`, 409 `conflitto` / `formato_vecchio` |
| `/api/libreria/rinomina` | POST | percorso, idBlocco, nuovoId, improntaAttesa, livello, nota, forza? | come sopra | 400 `id_non_valido` / `id_uguale`, 404, 409 `esiste` / `conflitto` / `formato_vecchio` |

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Elimina | istanze e percorsi | `istanzeDelBlocco()` su `pathStack[0].graph`, etichette `node.label` o id, radice `pathStack[0].label` |
| Elimina / Rinomina | livello e motivo | `#edtLivello`, `#edtNotaModifica` del form |
| Rinomina | nuovo id | `prompt()` |
| Server | versione | `avanza_versione(ultima voce, livello effettivo)` come `salva()` |
| Messaggi | versione e livello | risposta: `versione`, `voce.livello` |

**Key invariants**: un blocco si elimina solo se nessun nodo del progetto aperto lo usa; dopo una rinomina riuscita nessun nodo del progetto aperto ha più il vecchio `type`; disco prima, poi memoria (convenzione di `js/AGENTS.md`); ogni modifica della libreria passa per il changelog.

**Security model**: un utente locale; le rotte scrivono solo in `shared/` come `salva` (stessi controlli `risolvi()` e `scrivibile`); id e titoli nei messaggi sono testo, non HTML.

**Configuration required**: nessuna.

**Critical test scenarios**:
- Blocco usato in due istanze (una annidata): l'avviso elenca `Progetto › Centralina A` e `Progetto › Centralina A › Pompa B`; il file della libreria non cambia. Verifica **AC-2**.
- Blocco non usato: conferma, eliminato, versione major, voce `eliminato` nel changelog, albero aggiornato. Verifica **AC-3**, **AC-7**.
- Rinomina di Pompa in `pompa_idraulica`: due istanze aggiornate, progetto salvato con il nuovo `type`, libreria con la chiave nuova nello stesso posto, changelog `rinominato (prima pompa)`, filtro "pompa" la trova. Verifica **AC-5**, **AC-7**.
- Rinomina verso un id esistente o non valido: messaggi e nulla cambia. Verifica **AC-4**.
- Server: chiamate dirette con impronta vecchia (409), id inesistente (404), id uguale (400), id in conflitto (409). Verifica **AC-6**.
- Conflitto: libreria cambiata su disco, Elimina → banner; Sovrascrivi elimina. Verifica **AC-8**.
- Sola lettura: pulsanti disattivati. Verifica **AC-1**.

## Build plan

1. Server: divisione di `salva()` in controlli e `_applica()`; `elimina()`, `rinomina_blocco()`, `livello_di` con `rinominato`, instradamento. Satisfies **AC-6**, **AC-7**.
2. Client libreria: `invia()` con rotta e conflitto con rotta, `eliminaBloccoLibreria()`, `rinominaBloccoLibreria()`, pulsanti in `aggiornaPulsantiLibreria()`, changelog con `idPrecedente`. Satisfies **AC-7**, **AC-8**, **AC-1**.
3. Ispettore: pulsante e collegamento, `istanzeDelBlocco()`, flussi di eliminazione e rinomina con messaggi, aggiornamento dei nodi. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**.

## Consequences

**Positive**: la libreria si pulisce dall'app con traccia nel changelog; la rinomina non lascia istanze rotte nel progetto aperto.

**Negative / tradeoffs**:
- Gli altri progetti che usano lo stesso blocco non vengono aggiornati: dopo una rinomina o un'eliminazione i loro nodi diventano blocchi senza definizione. È il motivo della versione major e del testo di conferma.
- Annulla del progetto dopo una rinomina riporta i nodi al vecchio id, che nella libreria non esiste più (Annulla non tocca la libreria, come già per le rinomine dei requisiti).
- Le librerie in formato vecchio vanno prima convertite con un salvataggio qualsiasi.

**Neutral**: `start.py` cambia (riavvia il server dopo l'aggiornamento); nuove esportazioni in `libreria.js`; da riportare in `AGENTS.md` (rotte) e `js/AGENTS.md`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
