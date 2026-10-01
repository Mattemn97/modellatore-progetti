# 0004. Controllo di coerenza dei collegamenti tra requisiti, dal vivo su canvas e in una scheda

**Date**: 2026-10-01
**Status**: Accepted

## Summary

Il pulsante ⚠️ Verifica Coerenza accende una modalità che cerca, in tutto il modello e a ogni livello, i requisiti rimasti scoperti: requisiti cliente senza figli, requisiti di blocco senza padre, requisiti di un blocco che dentro di lui non scendono a nessun figlio, fili che partono da requisiti cliente ritirati, e i difetti di integrità (blocchi senza definizione, fili non validi). Li mostra in una nuova scheda Coerenza del pannello sinistro, raggruppati per tipo, e li evidenzia sul canvas con un alone rosso e un contatore sui blocchi che ne contengono. Il calcolo è una funzione pura (legge il modello, non lo cambia) rifatta a ogni `render()`, quindi tutto si aggiorna mentre lavori. Nulla finisce nel file del progetto: è una vista, come zoom e filtri.

## Requirements

**User stories**:
- Come progettista voglio vedere in un colpo quali requisiti cliente non ho ancora coperto, così so cosa manca per soddisfare il cliente.
- Come progettista voglio trovare i requisiti dei blocchi che non derivano da nulla, a qualunque profondità, così la tracciabilità non ha buchi.
- Come progettista voglio che l'elenco si aggiorni mentre tiro i fili, così vedo il lavoro che resta scendere senza ripremere nulla.
- Come progettista voglio saltare da una voce dell'elenco al punto del modello dove va sistemata.

**Acceptance criteria**:
- **AC-1**: Il pulsante `⚠️ Verifica Coerenza` (`#btnDRC`) accende e spegne la modalità Coerenza. Accesa: il pulsante appare premuto e mostra il numero dei problemi (es. `⚠️ Verifica Coerenza (12)`); nel pannello sinistro compare la scheda Coerenza accanto a Libreria e Cliente e si apre (il pannello si riapre se era chiuso); il canvas mostra le evidenze di AC-9. Spenta: la scheda Coerenza sparisce (se era aperta torna la scheda Libreria, altrimenti resta quella aperta), il pulsante torna normale e il canvas è come oggi. Con zero problemi il pulsante mostra `(0)`. Se la libreria non è caricata (nessun blocco), la scheda dice solo "Libreria non caricata: il controllo riparte quando la carichi", il pulsante non mostra numeri e il canvas non ha evidenze. All'avvio la modalità è spenta. Accenderla, spegnerla, cercare o navigare dalla scheda non cambia il file del progetto e non crea versioni (solo `Rimuovi` di AC-6 cambia il modello).
- **AC-2**: **Cliente senza figli**: un requisito cliente con `stato: 'attivo'` che non ha nessun filo valido (AC-6) alla radice. Conta che sia sul canvas o no. Un ritirato non è mai in questo gruppo.
- **AC-3**: **Requisiti senza padre**: un requisito di un blocco, a qualunque livello e per ogni istanza, che in quel livello non ha nessun filo di derivazione valido verso un blocco tondo. Un collegamento tra blocchi (filo tra due blocchi fratelli) non dà un padre. Alla radice il padre deve essere un requisito cliente attivo: un filo da un ritirato non conta, e il requisito è segnalato sia qui sia in AC-5. Un progetto senza requisiti cliente segnala comunque i requisiti della radice, e il gruppo ha in cima la riga "Nessun requisito cliente importato".
- **AC-4**: **Requisiti senza figli**: in un livello interno con almeno un blocco con definizione in libreria, un requisito del blocco che lo contiene (un blocco tondo) senza nessun filo di derivazione valido verso un requisito di un blocco di quel livello. Un livello interno vuoto (blocco foglia, mai aperto o svuotato), o con soli blocchi senza definizione, non produce voci. Ogni istanza di un blocco di libreria è valutata a sé.
- **AC-5**: **Fili da requisiti ritirati**: un requisito cliente ritirato che ha ancora almeno un filo valido (AC-6); una sola voce per requisito, che dice quanti fili validi ha. I suoi fili non validi stanno solo in Da riparare.
- **AC-6**: **Da riparare**: (a) un blocco il cui tipo non esiste nella libreria aperta, con il suo contenuto interno non valutato e i fili che lo toccano non segnalati a parte; (b) un filo con un estremo su un nodo che non è più nel livello (motivo "Il blocco collegato non esiste più"), o per cui `verificaCompatibilita()` restituisce un motivo (requisito che non esiste più, interfaccia con capacità, tipologie diverse), con quel motivo nella voce. Nel gruppo vengono prima i blocchi, poi i fili. Un filo valido è uno per cui `verificaCompatibilita()` restituisce `null`; un filo non valido non dà padre né figli a nessuno. Una voce di tipo (b) ha il pulsante `Rimuovi`, che dopo una conferma toglie il filo dal modello (va su disco ed è un passo di Annulla come ogni modifica). Le voci di tipo (a) non hanno azioni.
- **AC-7**: La scheda Coerenza mostra in quest'ordine i gruppi Cliente senza figli, Requisiti senza padre, Requisiti senza figli, Fili da requisiti ritirati, Da riparare. Ogni gruppo ha titolo e conteggio, parte chiuso e si apre e si chiude con un clic; lo stato aperto o chiuso resta finché la pagina resta aperta. Una voce mostra id del requisito (per il cliente l'ID del cliente), titolo e percorso del livello con le stesse etichette del breadcrumb (es. `Progetto › Centralina › Pompa`). La riga "Nessun requisito cliente importato" (AC-3) non conta nei conteggi e non sparisce con ricerca o filtro. Le voci seguono l'ordine del file per il cliente, e per gli altri l'ordine di visita del modello (radice, poi ogni blocco in profondità nell'ordine in cui sta nel file). Un gruppo mostra al massimo `coerenza.righePerGruppo` voci, poi "e altri N". Una ricerca (id, ID del cliente, titolo, senza distinguere maiuscole, 200 ms dopo l'ultimo tasto) filtra le voci di tutti i gruppi, e i conteggi diventano "N di M". Senza nessun problema la scheda dice "Nessun problema: ogni requisito è collegato".
- **AC-8**: Con il filtro per classe della barra diverso da `Tutti`, report, conteggi, numero sul pulsante e contatori sui blocchi contano solo i problemi la cui classe è quella scelta, e in cima alla scheda c'è la riga "Filtro attivo: <classe>". Le voci Da riparare si mostrano sempre, qualunque filtro. La ricerca della scheda filtra solo la scheda: pulsante, contatori ed evidenze seguono solo il filtro per classe. Con "Nascondi Non Coinvolti" i problemi dei blocchi nascosti restano nei conteggi e nella scheda, ma un blocco nascosto non ha alone né contatore.
- **AC-9**: Con la modalità accesa, in ogni livello su cui ti trovi: il pin di un requisito senza padre ha un alone rosso; un blocco tondo senza figli, un requisito cliente senza figli sul canvas e un ritirato con fili hanno un alone rosso sul cerchio; il suggerimento del pin o del cerchio aggiunge il motivo. Un blocco che contiene problemi nel suo contenuto, a qualsiasi profondità, mostra in alto a destra un contatore rosso con il loro numero. Un elemento attenuato dal filtro non ha alone.
- **AC-10**: Report, conteggi, numero sul pulsante, contatori ed evidenze si aggiornano da soli dopo ogni modifica (filo tirato o eliminato, blocco aggiunto, eliminato o modificato, `Salva` di un blocco di libreria, import cliente, Annulla, Ripeti, Ricarica, apertura di un altro progetto, cambio del filtro), senza ripremere il pulsante. Su un progetto con 3000 requisiti cliente e 200 blocchi, il trascinamento di un blocco con la modalità accesa resta fluido come a modalità spenta.
- **AC-11**: Un clic su una voce apre il livello dove sta il problema (breadcrumb compreso), sposta la vista a zoom invariato per centrare l'elemento e: per un requisito senza padre seleziona il blocco come un clic su di lui; per un requisito senza figli centra il suo blocco tondo; per un requisito cliente sul canvas (senza figli o ritirato) va alla radice, centra il blocco tondo e apre il suo dettaglio nell'ispettore (spec 0003). Un requisito cliente non sul canvas apre solo il dettaglio. Un blocco senza definizione apre il suo livello, centra la sua posizione e scrive nell'ispettore il motivo (non è disegnato); un filo non valido apre il suo livello e scrive nell'ispettore i due estremi e il motivo. Navigare dalla scheda spegne un dettaglio cliente o un'evidenza cliente rimasti aperti. Se nel frattempo un blocco del percorso non esiste più, compare il messaggio "Questo elemento non c'è più" e la scheda si aggiorna.

## Decision

**Chosen option**: Option 1: calcolo puro in un modulo nuovo `js/coerenza.js`, rifatto a ogni `render()` a modalità accesa; evidenze disegnate dal renderer, scheda aggiornata una volta per fotogramma.

Una funzione `calcolaCoerenza(radice, libreria, cliente)` visita tutto il modello e restituisce l'elenco dei problemi più due indici per il disegno; `render()` la chiama solo a modalità accesa, il renderer legge gli indici per aloni e contatori, la scheda Coerenza si ridisegna con lo stesso schema `requestAnimationFrame` della scheda Cliente.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Dove vive lo stato della modalità**: una variabile del modulo `coerenza.js` (`modalitaAttiva`, letta da `coerenzaAttiva()`), non `appState`. Così non può mai finire in `testoProgetto()` né far partire un salvataggio. Scartato: `appState.coerenzaAttiva`, comodo ma a un passo dall'essere serializzato per sbaglio.
- **Quando si calcola**: in `render()`, subito dopo `pianificaSalvataggio()` e prima di disegnare, solo se `coerenzaAttiva()`. Il risultato resta in una variabile del modulo (`ultimoRisultato`) che renderer e scheda leggono. Il calcolo è lineare (una visita di livelli, blocchi, requisiti e fili, con mappe per gli estremi, niente ricerche annidate); su 3000 cliente e 200 blocchi resta sotto pochi millisecondi. Se durante `/check verify` il trascinamento scatta, il rimedio è calcolare una volta per fotogramma e disegnare con il risultato precedente; non va fatto prima di misurare. Scartato: un indice aggiornato a ogni mutazione, che senza un bus di eventi richiede di toccare ogni punto che cambia il modello.
- **Risoluzione degli estremi di un filo**: la visita porta con sé `tipoPadre` (`null` alla radice) e risolve un estremo come fa `aggiornaRiferimentiRequisiti()`: `ownerType 'parent'` con `requisitoPadre(tipoPadre, reqId)`, `'node'` con il tipo del blocco nel livello e la sua definizione in libreria. Un estremo `'node'` il cui nodo non è nel livello rende il filo `filoNonValido` ("Il blocco collegato non esiste più"); un estremo su un nodo senza definizione rende il filo ignorato (lo copre la voce del blocco). Altrimenti il filo è valido se `verificaCompatibilita(a, b) === null`. Con `appState.library` vuota il calcolo non parte e restituisce `libreriaAssente: true` (AC-1). Si usa `verificaCompatibilita()`, non `verificaCollegamento()`: un filo da un ritirato è valido (resta, spec 0003) ma non dà un padre (AC-3).
- **Derivazione**: un filo valido con `isDerivazione(edge)` vero; l'estremo `'parent'` è il padre, l'altro il figlio. Un filo valido non di derivazione è un collegamento tra blocchi e non conta per padre né figli.
- **Chiave di un elemento sul canvas**: `"<ownerType>|<ownerId>|<reqId>"` per i pin e i blocchi tondi, la stessa forma che il renderer già passa a `createReqPin()` come `owner`. L'indice per livello è una `Map` dal `graph` (oggetto) a un `Set` di chiavi con il motivo; il renderer chiede `problemaPin(graph, ownerType, ownerId, reqId)` per l'alone e il suggerimento.
- **Contatore sui blocchi**: la visita porta con sé la pila degli oggetti `node` aperti; per ogni problema visibile (filtro per classe) si incrementa una `Map` dall'oggetto `node` al numero, per ogni nodo della pila. Si ricostruisce a ogni calcolo, quindi le chiavi sono sempre gli oggetti del modello di adesso.
- **Due filtri, un solo punto ciascuno**: `calcolaCoerenza()` produce sempre l'elenco completo con la classe di ogni problema (`getClasseRequisito(req)`). `problemiFiltrati()` applica il filtro per classe ed è l'unica fonte di pulsante, contatori ed evidenze (da lei si costruiscono `perLivello` e i contatori); `problemiScheda()` aggiunge la ricerca ed è usata solo dalla scheda. Le voci Da riparare hanno classe `null` e passano sempre il filtro per classe. Un cambio di filtro chiama già `render()` (`app.js`), quindi ricalcola tutto.
- **Chiave stabile di un problema**: `chiave = tipo|percorso.join('/')|ownerType|ownerId|reqId|nodeId|edgeId`, scritta nella riga della scheda come `data-chiave`. Al clic e a `Rimuovi` il problema si cerca di nuovo per chiave in `ultimoRisultato` e si risolve di nuovo dal percorso di id: mai con un riferimento a `graph` o `node` salvato prima, che Annulla, Ripeti e Ricarica (`sostituisciModello()` in `progetto.js`) rendono vecchio. Se la chiave non c'è più, messaggio di AC-11 e ridisegno della scheda.
- **Navigazione**: il ciclo che oggi in `sostituisciModello()` riapre i livelli per id (`progetto.js`, dopo `pathStack.push` della radice) diventa una funzione esportata `apriPercorso(ids)` in `progetto.js`: `pathStack.length = 1`, poi per ogni id cerca il nodo nel livello corrente e fa `push({ id, label: nodo.label || nodo.id, graph: nodo.internal_graph, parentNode: nodo })` (creando `internal_graph` vuoto se manca, come `enterNode()`); restituisce `false` se un id non c'è. `sostituisciModello()` la usa al posto del suo ciclo. `vaiAlProblema(chiave)` poi fa, in quest'ordine: `impostaSelezioneCliente(null)`, `evidenziaCliente(null)`, `apriPercorso(problema.percorso)`; per un requisito senza padre `selectNode(node)` (seleziona e apre il form, come un clic); `centraVista()` sul centro del blocco (`position` più metà di `width` e `height`) o del blocco tondo (`parentReqPositions[reqId]`, altrimenti `posizioneInColonna(indice)`); `renderUI()` e `render()`. Per un requisito cliente chiama invece `mostraDettaglioCliente(id)` di `inspector.js` dopo aver aperto la radice, che centra ed evidenzia da sé quando è sul canvas. Per blocco senza definizione e filo non valido scrive il motivo in `#propsContent` (con `escapeHtml()`).
- **Rimuovi su un filo non valido**: `confirm("Vuoi eliminare questo collegamento non valido?")`, poi risolve il livello dal percorso e fa `graph.edges = graph.edges.filter(e => e.id !== edgeId)` come l'eliminazione di oggi in `renderer.js`, quindi `render()`. È l'unica modifica al modello di questa funzionalità. Nessuna azione sui blocchi senza definizione: eliminarli perderebbe il loro contenuto interno; la voce dice di ripristinare il blocco in libreria.
- **Scheda nel pannello**: un terzo bottone `.scheda-pannello` con `data-scheda="coerenza"` e un contenitore `#schedaCoerenza`, nascosti a modalità spenta. `mostraScheda()` di `cliente.js` diventa esportata e gestisce anche `coerenza` (nasconde `#schedaCoerenza` per gli altri nomi, e per `coerenza` chiama `aggiornaSchedaCoerenza()`). Accendere la modalità toglie anche la classe `collapsed` da `#libraryPanel`. La casella di ricerca e lo stato aperto o chiuso dei gruppi stanno fuori dalla parte ridisegnata (contenitore `#coerenzaGruppi`). La scheda si ridisegna con `segnaSchedaCoerenzaDaAggiornare()` chiamata da `render()`, una volta per fotogramma e solo se si vede, come la scheda Cliente, e solo se l'impronta dell'elenco (numero di voci più le loro chiavi, dopo ricerca e filtro) è cambiata: un trascinamento che non cambia i problemi non tocca il DOM della scheda.
- **Aspetto**: alone = classe CSS `problema-coerenza` (bordo rosso e `drop-shadow` rossa, sul modello di `.parent-block-evidenziato`) su pin e cerchi; contatore = cerchio rosso con il numero bianco sull'angolo in alto a destra del blocco (lontano dalla maniglia di ridimensionamento in basso a destra), classe `contatore-coerenza` con `pointer-events: none`, così clic, doppio clic e trascinamento del blocco restano come oggi. Il pulsante: lo stile oggi scritto nel tag di `#btnDRC` passa in una classe `pulsante-coerenza` di `style.css`, con la variante `pulsante-coerenza attivo` (sfondo più scuro e bordo incassato) per lo stato acceso.
- **Percorso mostrato**: le etichette di `pathStack` (`progetto.nome` per la radice, poi `node.label || node.id`), così scheda e breadcrumb dicono la stessa cosa.
- **Moduli**: `renderer.js` importa da `coerenza.js` (`coerenzaAttiva`, `aggiornaCoerenza`, `problemaPin`, `contatoreBlocco`, `segnaSchedaCoerenzaDaAggiornare`) e `coerenza.js` importa da `renderer.js`, `inspector.js`, `cliente.js` e `progetto.js`: un ciclo in più, ammesso da `js/AGENTS.md` purché nessuna funzione importata sia chiamata al caricamento del modulo.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (solo in memoria, mai nel file del progetto; nessuna migrazione):

```
Problema = {
  chiave: string,              // tipo|percorso|ownerType|ownerId|reqId|nodeId|edgeId, unica nel risultato, stabile tra due calcoli
  tipo: 'clienteSenzaFigli' | 'senzaPadre' | 'senzaFigli' | 'filoDaRitirato' | 'bloccoSenzaDefinizione' | 'filoNonValido',
  percorso: string[],          // id dei nodi dalla radice al livello del problema ([] = radice)
  graph: object,               // il livello, valido solo dentro lo stesso calcolo (per disegno e contatori); clic e Rimuovi risolvono dal percorso
  ownerType: 'node' | 'parent' | null,   // null per bloccoSenzaDefinizione e filoNonValido
  ownerId: string | null,      // id del nodo, l'id del nodo padre del livello, o '__cliente__' alla radice
  reqId: string | null,
  req: object | null,          // requisito risolto, null se non esiste
  nodeId: string | null,       // per bloccoSenzaDefinizione
  edgeId: string | null,       // per filoNonValido
  numeroFili: number | null,   // per filoDaRitirato
  motivo: string,              // testo per voce e suggerimento (per filoNonValido il motivo di verificaCompatibilita)
  classe: string | null        // getClasseRequisito(req); null per Da riparare
}

RisultatoCoerenza = {
  problemi: Problema[],                        // elenco completo, ordine di AC-7
  filtrati: Problema[],                        // dopo il filtro per classe (pulsante, contatori, evidenze)
  perLivello: Map<graph, Map<chiavePin, motivo>>, // da filtrati; chiavePin "<ownerType>|<ownerId>|<reqId>"
  contatori: Map<node, number>,                // da filtrati
  senzaCliente: boolean,                       // appState.cliente assente o senza requisiti
  libreriaAssente: boolean                     // appState.library vuota: nessun calcolo
}
```

Relazioni: un `Problema` punta a un livello (`graph`) e a 0..1 requisito, nodo o filo del modello; non possiede nulla. Il risultato si ricalcola da zero a ogni `render()` e non si salva. Contatori e indici per livello si ricavano dall'elenco filtrato per classe, la scheda dall'elenco filtrato per classe e ricerca.

**State transitions**: la modalità è `spenta` → `accesa` → `spenta`, solo con `#btnDRC`; parte `spenta` a ogni caricamento della pagina e resta com'è quando cambi progetto. I problemi non hanno stati: esistono finché il modello li produce.

**API surface** (nessuna rotta server; funzioni client nuove in `js/coerenza.js` salvo dove indicato):

| Funzione | Cosa fa |
|---|---|
| `calcolaCoerenza(radice, libreria, cliente)` | funzione pura: visita il modello e restituisce `RisultatoCoerenza` (AC-2 … AC-6) |
| `coerenzaAttiva()` / `cambiaModalitaCoerenza()` | legge e inverte la modalità; mostra o nasconde la scheda, aggiorna il pulsante, chiama `render()` (AC-1) |
| `aggiornaCoerenza()` | chiamata da `render()` a modalità accesa: rifà il calcolo e aggiorna il numero sul pulsante (AC-10) |
| `problemiFiltrati()` / `problemiScheda()` | problemi dopo il filtro per classe (pulsante, contatori, evidenze) / dopo filtro e ricerca (scheda) (AC-7, AC-8) |
| `problemaPin(graph, ownerType, ownerId, reqId)` | motivo del problema di un pin o blocco tondo, o `null` (AC-9) |
| `contatoreBlocco(node)` | numero di problemi visibili dentro il blocco (AC-9) |
| `segnaSchedaCoerenzaDaAggiornare()` / `aggiornaSchedaCoerenza()` | ridisegno della scheda una volta per fotogramma, gruppi, limite, ricerca (AC-7) |
| `vaiAlProblema(chiave)` | navigazione di AC-11, risolvendo di nuovo il problema per chiave |
| `rimuoviFiloNonValido(chiave)` | conferma, toglie il filo dal livello risolto dal percorso, `render()` (AC-6) |
| `apriPercorso(ids)` (`progetto.js`, estratta da `sostituisciModello()`) | ricostruisce `pathStack` dalla radice seguendo gli id; `false` se un id manca (AC-11) |
| `initCoerenza()` (chiamata da `initApp()` in `app.js`) | gestore di `#btnDRC`, ricerca, clic sulle voci |
| `createReqPin()`, `disegnaBloccoTondo()`, `renderNode()` (`renderer.js`) | aggiungono alone, motivo nel suggerimento e contatore |
| `mostraScheda(nome)` (`cliente.js`, ora esportata) | gestisce anche `coerenza` |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Calcolo | requisiti cliente e loro stato | `appState.cliente.requisiti` (`stato`, `id`, `idCliente`) |
| Calcolo | requisiti di un blocco | `appState.library[node.type].requisiti` |
| Calcolo | requisiti dei blocchi tondi di un livello | `requisitoPadre(tipoPadre, reqId)` / `requisitiPadre(tipoPadre)` di `model.js` (`tipoPadre` = tipo del nodo che contiene il livello, `null` alla radice) |
| Calcolo | filo valido e suo motivo | `verificaCompatibilita()` di `model.js` |
| Calcolo | derivazione | `isDerivazione(edge)` di `model.js` |
| Calcolo | livello interno con contenuto | `node.internal_graph?.nodes.length > 0` |
| Calcolo | blocco senza definizione | `appState.library[node.type]` assente |
| Calcolo | "Nessun requisito cliente importato" | `appState.cliente` nullo o con `requisiti` vuoto |
| Scheda | percorso | `progetto.nome` per la radice, poi `node.label \|\| node.id` per ogni nodo di `percorso` (le etichette di `pathStack`) |
| Scheda | libreria non caricata | `Object.keys(appState.library).length === 0` |
| Scheda | id e titolo della voce | `req.idCliente` per il cliente, altrimenti `req.id`; `titoloRequisito(req)` |
| Scheda | numero di fili di un ritirato | conteggio dei fili validi della radice con estremo `'parent'` e handle uguale all'id (non `contaFiliCliente()`, che conta anche i non validi) |
| Scheda | quante voci per gruppo | `appSettings.coerenza.righePerGruppo` |
| Scheda, pulsante, contatori | classe del filtro | `appState.activeTypeFilter` (`'Tutti'` = nessun filtro) |
| Canvas | alone e motivo | `problemaPin()` sul livello corrente (`getCurrentLevel().graph`), da `perLivello` |
| Canvas | blocco nascosto da "Nascondi Non Coinvolti" | non disegnato da `render()`, quindi nessun alone né contatore; resta nei conteggi |
| Canvas | numero sul blocco | `contatoreBlocco(node)` |
| Navigazione | centro di un blocco | `node.position` più metà di `node.width` / `node.height` (o `appSettings.node.width` / `height`) |
| Navigazione | centro di un blocco tondo | `graph.parentReqPositions[reqId]`, altrimenti `posizioneInColonna(indice)` con l'indice del requisito in `requisitiPadre(tipoPadre)` |
| Navigazione | dettaglio cliente | `mostraDettaglioCliente(id)` di `inspector.js` |

**Key invariants**:
- `calcolaCoerenza()` non cambia mai il modello; l'unica scrittura della funzionalità è `Rimuovi` su un filo non valido.
- La modalità e il risultato non entrano mai in `testoProgetto()`: accendere, spegnere, cercare o navigare non produce versioni; solo `Rimuovi` cambia il file.
- Un filo conta come padre o figlio solo se `verificaCompatibilita()` è `null`, è una derivazione e, alla radice, l'estremo cliente è attivo.
- Numero sul pulsante, contatori ed evidenze leggono lo stesso elenco filtrato per classe; la scheda lo stesso elenco più la ricerca. Senza ricerca, il totale della scheda è uguale al numero sul pulsante.
- Clic e `Rimuovi` non usano mai riferimenti a oggetti del modello salvati prima del clic: risolvono dal percorso di id e dalla chiave.
- Un requisito ritirato non compare mai in Cliente senza figli.
- Nessun livello interno vuoto produce voci Requisiti senza figli.

**Security model**: un solo utente in locale, nessuna rotta nuova, nessun dato nuovo su disco. Id, titoli ed etichette nella scheda sono testo dell'utente o del cliente: passano tutti per `escapeHtml()` prima di `innerHTML`. Nessun dato regolamentato.

**Configuration required** (nuova chiave in `settings.json`, in `DEFAULT_SETTINGS` e nel merge annidato di `loadSettings()` in `js/state.js`):
- `coerenza.righePerGruppo`: `200`, voci mostrate al massimo per ogni gruppo della scheda Coerenza.

**Critical test scenarios**:
- Happy path: progetto con 5 requisiti cliente, 2 blocchi alla radice e un blocco aperto con 2 figli; accendi la modalità, il pulsante dice il totale, la scheda ha i gruppi giusti; tiri un filo da un cliente a un pin e la voce sparisce subito da Cliente senza figli e da Requisiti senza padre; spegni e il canvas è come prima, il file non ha versioni nuove. Verifica **AC-1**, **AC-2**, **AC-3**, **AC-10**.
- Livelli interni: un blocco con contenuto e un suo requisito non collegato dentro; un blocco foglia vuoto; due istanze dello stesso blocco di libreria, una collegata dentro e l'altra no. Solo il requisito del blocco con contenuto non collegato e solo l'istanza scoperta compaiono in Requisiti senza figli; alla radice il blocco ha il contatore. Verifica **AC-4**, **AC-9**.
- Ritirati: reimport che ritira un cliente con 2 fili; il cliente esce da Cliente senza figli, entra in Fili da requisiti ritirati con "2 fili", e i requisiti dei blocchi che derivavano solo da lui entrano in Requisiti senza padre. Verifica **AC-3**, **AC-5**.
- Integrità: file modificato a mano con un nodo di tipo `inesistente` e un filo tra un'interfaccia `Elettrica` e una `Segnale`; entrambi in Da riparare con il motivo; `Rimuovi` sul filo lo toglie, Ctrl+Z lo rimette. Verifica **AC-6**.
- Volumi e filtro: 3000 requisiti cliente non collegati; il gruppo mostra 200 voci e "e altri 2800"; la ricerca per ID ne trova uno; con il filtro `Elettrica` restano solo i problemi elettrici e la riga "Filtro attivo"; trascinare un blocco resta fluido. Verifica **AC-7**, **AC-8**, **AC-10**.
- Navigazione: dalla radice, clic su una voce a tre livelli di profondità apre il livello giusto con il breadcrumb, centra e seleziona il blocco; clic su un cliente non sul canvas apre solo il dettaglio; dopo aver eliminato il blocco in un'altra azione, un clic su una voce rimasta indietro dà "Questo elemento non c'è più". Verifica **AC-11**.
- Modello sostituito: con la scheda aperta tiri un filo, premi Ctrl+Z e subito clicchi una voce o `Rimuovi`; l'azione agisce sul modello di adesso (o dà "Questo elemento non c'è più"), mai su quello di prima. Con la libreria non caricata la scheda dice "Libreria non caricata" e il pulsante non ha numero. Verifica **AC-1**, **AC-6**, **AC-11**.
- Senza cliente: progetto mai importato; i requisiti della radice sono in Requisiti senza padre con la riga "Nessun requisito cliente importato". Verifica **AC-3**.

## Build plan

Tracer Bullet: il primo compito porta un caso (cliente senza figli e senza padre alla radice) dal modello al pulsante, alla scheda e al canvas; i successivi allargano i tipi di problema, il report e la navigazione.

1. **Filo minimo dal modello al pulsante, alla scheda e al canvas**: chiave `coerenza.righePerGruppo` in `settings.json`, `DEFAULT_SETTINGS` e `loadSettings()`; `js/coerenza.js` con la modalità, `calcolaCoerenza()` per Cliente senza figli e Requisiti senza padre (tutti i livelli, risoluzione degli estremi, regola del ritirato), `aggiornaCoerenza()` chiamata da `render()`; `#btnDRC` con lo stile spostato nella classe `pulsante-coerenza`, stato acceso e numero; messaggio "Libreria non caricata"; terza scheda in `index.html` e in `mostraScheda()` (esportata), apertura del pannello, elenco semplice; alone in `createReqPin()` e `disegnaBloccoTondo()` per il livello corrente. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-10**.
2. **Gli altri tipi di problema**: Requisiti senza figli (solo livelli con contenuto, per istanza), Fili da requisiti ritirati con il numero, Da riparare (blocco senza definizione con contenuto non visitato, filo non valido con il motivo) e `Rimuovi`; aloni sui blocchi tondi; contatore sui blocchi in `renderNode()`. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-9**.
3. **Report completo e filtro**: gruppi nell'ordine, chiusi e richiudibili, limite `righePerGruppo` con "e altri N", ricerca con conteggi "N di M", messaggio senza problemi, riga senza cliente; `problemiFiltrati()` (pulsante, contatori, evidenze) e `problemiScheda()` (più la ricerca); ridisegno della scheda solo a impronta cambiata; regola di "Nascondi Non Coinvolti". Satisfies **AC-7**, **AC-8**.
4. **Navigazione**: `apriPercorso(ids)` estratta da `sostituisciModello()` in `progetto.js` e usata da entrambi; `vaiAlProblema(chiave)` con il problema risolto di nuovo per chiave, spegnimento del dettaglio cliente, `selectNode()`, centratura del blocco e del blocco tondo, dettaglio cliente, motivo nell'ispettore per blocchi e fili non disegnati, elemento sparito. Satisfies **AC-11**.

## Consequences

**Positive**:
- Nessuna dipendenza, nessuna rotta e nessun formato nuovi: il file del progetto e `start.py` non cambiano.
- Il controllo usa le stesse regole di collegamento del disegno (`verificaCompatibilita()`, `isDerivazione()`, `requisitoPadre()`), quindi non può dare un verdetto diverso da quello che l'editor applica.
- La visita completa del modello e la ricostruzione del percorso servono anche alla Gerarchia (voce 5) e alla Matrice (voce 6).
- I difetti oggi invisibili (blocchi senza definizione, fili non validi che il renderer salta) diventano visibili e i fili si possono togliere.

**Negative / tradeoffs**:
- A modalità accesa ogni `render()`, anche a ogni movimento del mouse in un trascinamento, rifà la visita di tutto il modello. Accettato perché lineare e misurato in `/check verify`; se scatta, il calcolo passa a una volta per fotogramma.
- Senza esenzioni, un requisito che va bene senza padre (es. un requisito derivato da una scelta di progetto) resta segnalato per sempre; il conteggio non arriva mai a zero in quei progetti.
- Un progetto senza requisiti cliente mostra tutti i requisiti della radice come senza padre: rumore voluto, spiegato da una riga.
- Un blocco senza definizione non si ripara dalla scheda: serve ripristinarlo in libreria.

**Neutral**:
- Nuovo modulo `js/coerenza.js` e terza scheda del pannello, da aggiungere a `js/AGENTS.md` (lo fa `/sync`); `#btnDRC` smette di essere un pulsante senza gestore.
- `mostraScheda()` di `cliente.js` diventa il commutatore di tre schede: potrebbe meritare di spostarsi in `app.js` quando arriverà una quarta.
- Un requisito ritirato da cui deriva un blocco compare in due gruppi (Fili da ritirati e, per il figlio, Senza padre): voluto, sono due cose da sistemare.

## Follow-up

- [ ] Esenzioni ("va bene senza padre" con una nota, salvate nel progetto): restano in "Coerenza avanzata" nel Deferred dello scope.
- [ ] Misurare in `/check verify` il trascinamento a modalità accesa sul progetto di AC-10; se scatta, calcolare una volta per fotogramma.
- [ ] La Gerarchia (voce 5) e la Matrice (voce 6) possono riusare la visita di `calcolaCoerenza()` e `vaiAlProblema()` invece di riscriverle.
