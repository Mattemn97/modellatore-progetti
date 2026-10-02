# 0005. Gerarchia dei requisiti per istanza, in una scheda e sul canvas

**Date**: 2026-10-01
**Status**: Accepted

## Summary

Il pulsante 🌳 Gerarchia accende una modalità in cui scegli un requisito (clic su un pin, una porta o un blocco tondo, oppure dal dettaglio di un requisito cliente) e vedi in una nuova scheda del pannello sinistro tutti i suoi antenati fino al cliente e tutti i suoi discendenti fino ai livelli più bassi. Sul canvas i fili e i pin della catena si evidenziano, il resto si attenua e i blocchi che contengono pezzi della catena mostrano quanti. Ogni istanza di un blocco di libreria è un ramo a sé (occorrenza, cioè un requisito in un punto preciso del modello), così due Pompe non si confondono. Tutto si ricalcola dal modello una volta per fotogramma mentre lavori e niente entra nel file del progetto; la visita del modello che oggi vive nella Coerenza si sposta in `model.js` e la usano entrambe.

## Requirements

**User stories**:
- Come progettista voglio scegliere un requisito e vedere da quali requisiti cliente discende, attraverso tutti i livelli, così so perché esiste.
- Come progettista voglio vedere fino a dove scende un requisito cliente, così so quali blocchi lo coprono.
- Come progettista voglio che la catena si veda sul canvas mentre lavoro, e che si aggiorni mentre tiro i fili.
- Come progettista voglio che due istanze dello stesso blocco di libreria restino distinte, perché hanno interni e collegamenti diversi.

**Acceptance criteria**:
- **AC-1**: Il pulsante `🌳 Gerarchia` (`#btnGerarchia`, accanto a `⚠️ Verifica Coerenza`) accende e spegne la modalità Gerarchia. Accesa: il pulsante appare premuto; nel pannello sinistro compare la scheda Gerarchia accanto a Libreria, Cliente (e Coerenza se accesa) e si apre (il pannello si riapre se era chiuso). Accendere Gerarchia spegne Coerenza e accendere Coerenza spegne Gerarchia, con tutto ciò che lo spegnimento comporta. Spenta: la scheda Gerarchia sparisce (se era aperta torna la scheda Libreria), la scelta si toglie e il canvas è come oggi. All'avvio della pagina la modalità è spenta. Se la libreria non è caricata la scheda dice solo "Libreria non caricata: la gerarchia riparte quando la carichi" e il canvas non ha evidenze. Accendere, spegnere, scegliere, aprire o chiudere rami e navigare non cambia il file del progetto e non crea versioni.
- **AC-2**: A modalità accesa, premere e rilasciare sullo stesso pin (porta di interfaccia, pin di capacità, pin di un blocco tondo) sceglie il suo requisito, senza tirare un filo; trascinare fino a un altro pin crea il filo come oggi. Anche premere e rilasciare sul cerchio di un blocco tondo senza spostarlo lo sceglie (se lo trascini, si sposta come oggi e non sceglie). Una nuova scelta sostituisce la precedente. Il pannello destro mostra il blocco del requisito scelto: per un requisito di un blocco del livello, come un clic sul blocco (`selectNode()`); per un blocco tondo di un livello interno, il blocco che contiene il livello aperto in libreria senza istanza (`openLibraryBlock(tipo)`) e nessun blocco selezionato; per un requisito cliente, il suo dettaglio come oggi e nessun blocco selezionato. Un blocco senza definizione in libreria non è disegnato, quindi i suoi requisiti non si possono scegliere.
- **AC-3**: Il dettaglio di un requisito cliente nell'ispettore ha il pulsante `🌳 Mostra gerarchia`: accende la modalità se è spenta (e spegne Coerenza), apre la scheda Gerarchia e sceglie quel requisito. Funziona anche per un requisito cliente non sul canvas e per un ritirato. Livello e vista non cambiano: il dettaglio resta aperto e, se sei alla radice e il cliente è sul canvas, il suo blocco tondo ha l'alone della catena; per andarci usi la sua riga (AC-9).
- **AC-4**: La gerarchia è per istanza. Un nodo della gerarchia è un'occorrenza: un requisito in un'istanza precisa, identificata dal percorso dei blocchi dalla radice al blocco che lo possiede. Il pin del requisito su un blocco e il blocco tondo dello stesso requisito dentro quel blocco sono la stessa occorrenza (è così che la catena scende di livello). Due istanze dello stesso blocco di libreria danno occorrenze e rami separati.
- **AC-5**: Padre e figlio vengono solo da fili di derivazione validi: `verificaCompatibilita()` dà `null` e `isDerivazione()` è vero, con le stesse regole di risoluzione degli estremi della Coerenza. Un collegamento tra blocchi fratelli e un filo non valido non entrano nella gerarchia. Il contenuto di un blocco senza definizione in libreria non è visitato. Un requisito cliente ritirato con fili validi è un padre come gli altri e la sua riga è barrata con il segno "ritirato". Un requisito può avere più padri.
- **AC-6**: La scheda Gerarchia, con una scelta, mostra dall'alto: la sezione **Antenati** (albero rovesciato: sotto ogni riga i suoi padri, fino ai requisiti cliente; ogni padre ha il suo ramo, e un antenato raggiunto da due strade compare in entrambe), la **barra del requisito scelto** (pallino della classe, id, titolo, blocco, pulsante `✕`), la sezione **Discendenti** (sotto ogni riga i suoi figli, fino in fondo). Ogni sezione ha titolo e numero di occorrenze diverse. Senza antenati la sezione dice "Nessun antenato" (per un requisito cliente "È un requisito cliente: la catena parte da qui"); senza discendenti "Nessun discendente". Senza scelta la scheda dice "Clicca un pin, una porta o un blocco tondo, oppure usa 🌳 Mostra gerarchia nel dettaglio di un requisito cliente".
- **AC-7**: Ogni riga mostra un pallino col colore della classe, l'id del requisito (l'ID del cliente per un requisito cliente), il titolo e l'etichetta del blocco che lo possiede (`Cliente` per un requisito cliente). Il suggerimento della riga è il percorso con le etichette del breadcrumb (es. `Progetto › Centralina › Pompa`). Una riga con figli nella sua sezione ha un segno ▸ o ▾ che la chiude o la apre.
- **AC-8**: Le due sezioni condividono un solo limite, `gerarchia.righeAperte`. Profondità 1 sono le righe subito sotto la barra (padri diretti in Antenati, figli diretti in Discendenti). Si sceglie la profondità massima `D` tale che le righe delle due sezioni con profondità fino a `D` restino entro il limite: le righe fino a `D` si vedono, quelle a profondità `D` con figli sono chiuse, quelle sopra sono aperte. La profondità 1 si vede sempre, anche oltre il limite. Aprire o chiudere un ramo a mano è un'eccezione alla regola che vale finché la scelta resta la stessa (la regola si ricalcola a ogni modifica, le eccezioni restano); una nuova scelta toglie le eccezioni. Le righe sotto un ramo chiuso non si costruiscono.
- **AC-9**: Un clic su una riga apre il livello dove l'occorrenza ha il suo pin (breadcrumb compreso; per un requisito cliente la radice), sposta la vista a zoom invariato per centrare il blocco che la possiede (per un cliente sul canvas, il suo blocco tondo), la rende la nuova scelta (l'albero si ricentra su di lei) e aggiorna il pannello destro come AC-2 (per un cliente non sul canvas apre solo il dettaglio). Se nel frattempo un blocco del percorso non esiste più, compare "Questo elemento non c'è più", il livello torna quello di prima del clic e la scheda si aggiorna.
- **AC-10**: Con una scelta, nel livello su cui ti trovi: i fili della catena (che portano dal requisito scelto ai suoi antenati o ai suoi discendenti) sono più spessi ed evidenziati; i pin e i blocchi tondi che sono occorrenze della catena hanno un alone; un blocco nel cui contenuto (strettamente dentro, a qualsiasi profondità; non i suoi pin) ci sono occorrenze della catena mostra in alto a sinistra un contatore col loro numero, nel colore della classe (grigio se la catena parte da un cliente ritirato scelto); un blocco può avere insieme pin con alone e contatore. Tutto il resto è attenuato, elemento per elemento: ogni filo, pin e blocco tondo fuori dalla catena, e il rettangolo con le scritte di un blocco senza pin della catena e senza contatore. I pin della catena su un blocco attenuato restano pieni. Gli elementi della catena non si attenuano mai per il filtro per classe, i fili della catena si disegnano anche se il filtro li nasconderebbe, e un blocco con pin della catena o contatore si disegna anche con "Nascondi Non Coinvolti". Senza scelta il canvas è come oggi.
- **AC-11**: Albero, conteggi ed evidenze si aggiornano da soli dopo ogni modifica (filo tirato o eliminato, blocco aggiunto, eliminato o modificato, `Salva` di un blocco di libreria, import cliente, Annulla, Ripeti, Ricarica, cambio del filtro), senza scegliere di nuovo. Su un progetto con 3000 requisiti cliente e 200 blocchi, il trascinamento di un blocco con la modalità accesa e una scelta resta fluido come a modalità spenta.
- **AC-12**: Se dopo una modifica (Annulla, Ricarica, blocco eliminato, `Salva` che toglie il requisito) l'occorrenza scelta non esiste più, la scheda dice "Il requisito scelto non c'è più" al posto delle sezioni, le evidenze spariscono e la modalità resta accesa. La scelta non si perde: se una modifica successiva la fa tornare (es. Ctrl+Z), la gerarchia ricompare da sola; una nuova scelta, `✕` o Esc tolgono il messaggio. Se un `Salva` di un blocco nell'ispettore ha solo rinominato l'id del requisito scelto, la scelta segue il nuovo id; una rinomina che arriva da una Ricarica della libreria non è seguita (la scelta risulta non più presente). Aprendo un altro progetto (o creandone o importandone uno) la scelta si toglie senza messaggio e la modalità resta com'è.
- **AC-13**: Il pulsante `✕` della barra e il tasto Esc tolgono la scelta (scheda nello stato senza scelta, canvas come oggi, modalità accesa). Esc non fa nulla se il fuoco è in un campo di testo, se è aperta una finestra (Apri, Changelog, Import cliente), se la modalità è spenta o se non c'è una scelta.
- **AC-14**: Dopo lo spostamento della visita in `model.js`, la Coerenza si comporta come prima: gli scenari critici della spec 0004 danno lo stesso risultato.

## Decision

**Chosen option**: Option 1: indice completo delle occorrenze rifatto una volta per fotogramma a modalità accesa, costruito con una visita del modello condivisa in `model.js`; catena, scheda ed evidenze in un modulo nuovo `js/gerarchia.js`.

La visita che oggi sta dentro `calcolaCoerenza()` diventa `visitaDerivazioni()` in `model.js`, neutrale (riporta livelli, nodi e l'esito di ogni filo, senza regole sui ritirati); Coerenza e Gerarchia ci applicano le loro regole. `calcolaGerarchia()` costruisce l'indice delle occorrenze, `catenaDi()` ne ricava antenati, discendenti, fili e contatori del requisito scelto; il renderer legge la catena, la scheda si ridisegna una volta per fotogramma come Cliente e Coerenza.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Chiave di un'occorrenza**: `percorso.join('/') + '|' + reqId`, dove `percorso` sono gli id dei nodi dalla radice al blocco che possiede il requisito, compreso; per un requisito cliente `__cliente__|<id>` (`ID_CLIENTE`). Sul canvas: il pin di un nodo `N` nel livello corrente ha percorso `[...idAperti, N.id]` (con `idAperti = pathStack.slice(1).map(l => l.id)`); un blocco tondo ha percorso `idAperti` (alla radice è un cliente). Così pin e blocco tondo dello stesso requisito coincidono. Si assume che gli id dei nodi non contengano `/` (vengono da `generaId()`); due nodi con lo stesso id nello stesso livello (file modificato a mano) danno una sola occorrenza. Scartato: chiave per id del requisito, che fonde le istanze (decisione della conversazione).
- **Visita condivisa**: `visitaDerivazioni(radice, libreria, cliente, osservatore)` in `model.js`, con la stessa risoluzione degli estremi e lo stesso ordine di oggi (fili del livello, poi nodi, poi fine livello, poi in profondità nei nodi con definizione e `internal_graph`). Per ogni livello, in quest'ordine: `osservatore.inizioLivello(ctx)`, `osservatore.filo(ctx, edge, esito)` per ogni filo, `osservatore.nodo(ctx, nodo, def)` per ogni nodo (`def` nullo se senza definizione), `osservatore.fineLivello(ctx)`, poi la discesa; tutte facoltative. `ctx = { graph, nodoPadre, tipoPadre, ownerPadre, percorso, etichette, nodi, stato }`, dove `stato` è un oggetto vuoto creato dalla visita per ogni livello, in cui l'osservatore tiene i suoi insiemi del livello (la Coerenza ci mette `padriConFigli`, `figliConPadre`, `bloccoConDefinizione`). `esito = { stato: 'valido' | 'nonValido' | 'ignorato', motivo, a, b, derivazione, padre, figlio }`: `a` e `b` sono gli estremi risolti (con `descrizione`, come oggi) e ci sono sempre, anche per `'ignorato'` (un estremo su un nodo senza definizione, con `senzaDefinizione: true`); `padre` e `figlio` sono valorizzati solo per un filo valido di derivazione. La regola del ritirato e il conteggio `filiCliente` restano in `coerenza.js`, dentro il suo `filo()`. Scartato: copiare la visita (le regole divergerebbero) o leggere l'indice dalla Coerenza (che è esclusiva con la Gerarchia).
- **Indice completo, non ricerca locale**: `calcolaGerarchia()` registra ogni occorrenza (ogni requisito di ogni nodo con definizione, a ogni livello, più ogni requisito cliente), anche senza fili, così una scelta senza fili è valida e "non c'è più" si decide con un `has()`. Costo lineare come la Coerenza. Scartato: risalire e scendere solo attorno alla scelta, più economico ma con una seconda logica di risoluzione per livello, e la Matrice (voce 6) avrà comunque bisogno dell'indice completo.
- **Catena**: `antenati` = visita all'indietro sui `padri` dalla scelta, `discendenti` = visita in avanti sui `figli`. Un filo `p → f` di un livello è nella catena se (`f` è la scelta o un antenato e `p` è un antenato) oppure (`p` è la scelta o un discendente e `f` è un discendente). I fili sono sempre tra un livello e quello subito dentro, quindi non ci sono cicli; per sicurezza le visite tengono un insieme dei già visti e il disegno dell'albero un insieme delle chiavi sul ramo.
- **Contatore**: per ogni occorrenza della catena con percorso `p`, si incrementa il contatore di ogni prefisso proprio di `p` (`p.slice(0, i + 1)` per `i < p.length - 1`): conta le occorrenze della catena strettamente dentro quel blocco (non i suoi pin), che siano antenati, scelta o discendenti. Il renderer chiede `contatoreGerarchia([...idAperti, node.id])`. Nota: conta anche antenati e scelta, non solo i discendenti, perché da un livello alto anche loro possono stare dentro un blocco e il segno deve dire dove entrare per seguire la catena.
- **Quando si calcola**: una volta per fotogramma, deciso ora e non in verifica. In `render()`, subito dopo la riga della Coerenza, `if (gerarchiaAttiva()) segnaGerarchiaDaRicalcolare();` chiede un `requestAnimationFrame` (uno solo per fotogramma). Nel fotogramma si rifanno indice e catena; se l'impronta della catena (scelta, sparita, chiavi di antenati e discendenti, fili, contatori) è cambiata, si chiama `render()` una volta (che ne chiede un altro: il calcolo seguente trova l'impronta uguale e si ferma). Durante un trascinamento quindi c'è al massimo una visita per fotogramma e nessun secondo `render()`. `scegli()`, l'accensione della modalità e la navigazione calcolano subito, prima del loro `render()`, così la scelta si vede senza attese. Il risultato sta in variabili del modulo (`ultimoIndice`, `ultimaCatena`), mai in `appState`.
- **Scelta sparita, derivata**: `sceltaSparita` non è uno stato: a ogni calcolo vale `chiaveScelta !== null && !indice.occorrenze.has(chiaveScelta)`. `chiaveScelta` resta finché non la cambia `scegli()`, `togliScelta()`, `azzeraSceltaGerarchia()` o lo spegnimento. Così un `render()` di passaggio (la libreria nuova con il modello di prima, durante Ricarica o `Salva`) non perde la scelta.
- **Clic sul canvas**: nel `mouseup` di `createReqPin()`, quando `stessoPin` e `gerarchiaAttiva()`, si chiama `scegliDaCanvas(owner, req)` invece di non fare nulla. (Premere, muoversi dentro lo stesso pin e rilasciare lì sceglie anche lui: accettato.) Sul cerchio di un blocco tondo non si usa l'evento `click`: `startParentBlockDrag()` chiama `render()` a ogni movimento e ricostruisce il DOM, quindi dopo il minimo tremolio il `click` non arriva. `startParentBlockDrag()` tiene invece un segno `spostato`, vero al primo `mousemove` che cambia la posizione dopo lo scatto alla griglia; nel suo `endDrag`, se non spostato e `gerarchiaAttiva()`, chiama `scegliDaCanvas({ ownerType: 'parent', ownerId }, req)`. Lo stesso segno vale per `alClic` del cliente, che oggi ha lo stesso difetto: lo si chiama da `endDrag` quando non spostato, al posto del `click`.
- **Esclusività con la Coerenza**: `cambiaModalitaGerarchia()` chiama `spegniCoerenza()` (nuova, esportata da `coerenza.js`) e `cambiaModalitaCoerenza()` chiama `spegniGerarchia()`. Le due `spegni` fanno tutto lo spegnimento (linguetta, scheda, pulsante, risultato) tranne `render()`, che resta a chi le chiama, così c'è un solo ridisegno. Scartato: le due insieme, canvas illeggibile e clic sui pin ambiguo.
- **Rinomina e cambio progetto**: in `inspector.js`, subito dopo `aggiornaRiferimentiRequisiti()` e prima di qualunque `render()`, si chiama `rinominaSceltaGerarchia(blockId, mappaRinomina)` (`mappaRinomina` è un oggetto `{ vecchioId: nuovoId }`): se la scelta non è un cliente, risolve il nodo che la possiede seguendo il percorso nel modello di adesso e, se il suo tipo è `blockId` e `mappaRinomina[reqId]` esiste, cambia la chiave. `sostituisciModello()` di `progetto.js` chiama `azzeraSceltaGerarchia()` quando `mantieniLivello` è falso (apertura, nuovo, import); con `mantieniLivello` vero (Annulla, Ripeti, Ricarica) la scelta resta e vale AC-12.
- **Costruzione dell'albero (AC-8)**: prima si contano le righe per profondità, sezione per sezione, senza costruirle: righe a profondità `k + 1` = somma, sulle righe a profondità `k`, del numero di padri (o figli) di ciascuna, saltando le chiavi già sul ramo; il conteggio si ferma appena il totale supera `righeAperte`. Da lì viene `D`. Poi si costruiscono solo le righe visibili: quelle sotto un ramo aperto (per regola o eccezione), mai sotto uno chiuso. Così un diamante che moltiplica i rami costa quanto le righe mostrate, non quanto l'albero intero. Eccezioni a mano: `ramiAperti` e `ramiChiusi`, insiemi di `data-ramo`, svuotati da `scegli()` con una chiave diversa.
- **Filtro e Nascondi Non Coinvolti**: in `render()` l'elenco `activeEdges` resta com'è (lo usa il controllo di Nascondi Non Coinvolti); si disegnano `activeEdges` più i fili del livello in `ultimaCatena.fili` che il filtro aveva tolto. Un nodo con pin della catena o contatore si disegna anche quando Nascondi Non Coinvolti lo salterebbe.
- **Scheda nel pannello**: un quarto bottone `.scheda-pannello` con `data-scheda="gerarchia"` e un contenitore `#schedaGerarchia`, nascosti a modalità spenta; `mostraScheda()` di `cliente.js` gestisce anche `gerarchia`. Le righe si ridisegnano con `segnaSchedaGerarchiaDaAggiornare()` chiamata da `render()`, una volta per fotogramma, solo se si vede e solo se l'impronta (chiave scelta, chiavi delle righe visibili, stato dei rami) è cambiata. Una riga porta `data-chiave` e `data-ramo` (le chiavi dalla radice della sezione alla riga, per aprire e chiudere quel ramo e non altri con la stessa chiave).
- **Navigazione da una riga**: la stessa sequenza di `vaiAlProblema()` (spec 0004). Risolve di nuovo l'occorrenza dalla chiave nell'indice di adesso; tiene gli id del livello attuale (`pathStack.slice(1).map(l => l.id)`); `impostaSelezioneCliente(null)`, `evidenziaCliente(null)`; `apriPercorso(percorso.slice(0, -1))` (`progetto.js`). Se restituisce `false`: `apriPercorso(idDiPrima)`, messaggio "Questo elemento non c'è più", `renderUI()`, `render()`. Altrimenti `selectNode(nodo)`, `centraVista()` sul centro del blocco, `scegli(chiave)` (che calcola subito), `renderUI()` e `render()`. Per un cliente: `apriPercorso([])`, `setActiveNodeId(null)`, `scegli(chiave)`, poi `mostraDettaglioCliente(id)`, che alla radice centra ed evidenzia da sé quando il cliente è sul canvas e altrimenti apre solo il dettaglio. Mai oggetti del modello tenuti da prima del clic.
- **Esc**: un listener `keydown` su `document`, aggiunto da `initGerarchia()`, agisce solo se `e.key === 'Escape'`, la modalità è accesa, c'è una `chiaveScelta`, il bersaglio non è dentro `input, textarea, select, [contenteditable]` e `modaleAperta()` è falso; allora `preventDefault()` e `togliScelta()`. `modaleAperta()` oggi è privata in `progetto.js`: diventa esportata. Oggi nessun altro gestore usa Esc.
- **Aspetto**: classe `catena-gerarchia` sui fili (tratto più spesso); classe `pin-catena` su pin e cerchi (alone sul modello di `.parent-block-evidenziato`); classe `fuori-catena` (opacità `0.25`) messa elemento per elemento su fili, pin, gruppi dei blocchi tondi e sul rettangolo e le scritte di un blocco, mai sul gruppo `g` del blocco (attenuerebbe anche i suoi pin della catena). Con una scelta, il renderer non mette l'opacità inline del filtro per classe (`style.opacity = '0.25'`): decide `fuori-catena` al suo posto. Senza scelta resta tutto come oggi; contatore `contatore-gerarchia` in alto a sinistra del blocco, cerchio nel colore della classe della scelta (`getColoreRequisito()`, grigio `#9e9e9e` come il suo cerchio se la scelta è un cliente ritirato), numero bianco, `99+` oltre 99, `pointer-events: none`. Il contatore della Coerenza sta in alto a destra e le due modalità non sono mai accese insieme. Pulsante con classe `pulsante-gerarchia` e variante `attivo`, come `pulsante-coerenza`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (solo in memoria, mai nel file del progetto; nessuna migrazione):

```
Occorrenza = {
  chiave: string,          // percorso.join('/') + '|' + reqId, oppure '__cliente__|' + id; unica nell'indice
  percorso: string[],      // id dei nodi dalla radice al blocco che possiede il requisito, compreso ([] per il cliente)
  etichette: string[],     // etichette dei nodi di percorso (node.label || node.id), per riga e suggerimento
  reqId: string,
  req: object,             // requisito di libreria o requisito cliente
  cliente: boolean,
  padri: Set<string>,      // chiavi, da fili di derivazione validi del livello dove sta il pin
  figli: Set<string>       // chiavi, da fili di derivazione validi del livello interno del blocco
}

IndiceGerarchia = {
  occorrenze: Map<string, Occorrenza>,
  filiPerLivello: Map<graph, Map<edgeId, { padre: string, figlio: string }>>,
  libreriaAssente: boolean
}

Catena = {                 // ricavata da IndiceGerarchia e chiaveScelta a ogni calcolo
  scelta: string,
  antenati: Set<string>,
  discendenti: Set<string>,
  fili: Map<graph, Set<edgeId>>,
  contatori: Map<string, number>   // chiave = percorso del blocco join('/')
}

Stato del modulo gerarchia.js (mai in appState):
  modalitaAttiva: boolean, chiaveScelta: string | null,
  ramiAperti: Set<ramo> / ramiChiusi: Set<ramo> (eccezioni a mano, solo per la scelta corrente)
  sceltaSparita: derivata a ogni calcolo (chiaveScelta presente e assente dall'indice), mai salvata a parte
```

Relazioni: Occorrenza N:M Occorrenza (padre, figlio), sempre tra un livello e quello subito dentro, quindi un grafo senza cicli. Ogni filo di derivazione valido dà esattamente una coppia padre e figlio. Un'occorrenza non possiede nulla del modello; tutto si ricostruisce da zero a ogni calcolo.

**State transitions**: la modalità è `spenta` → `accesa` → `spenta` (pulsante, `🌳 Mostra gerarchia`, oppure spenta dall'accensione della Coerenza). A modalità accesa la scelta è `nessuna` → `scelta` (clic, riga, dettaglio cliente) → `nessuna` (`✕`, Esc, cambio progetto). `sparita` non è uno stato a sé: è `scelta` con una chiave che l'indice di adesso non ha, e torna visibile da sola se la chiave ricompare. Spegnere la modalità riporta sempre a `nessuna`.

**API surface** (nessuna rotta server; funzioni client, in `js/gerarchia.js` salvo dove indicato):

| Funzione | Input | Output | Errori o casi |
|---|---|---|---|
| `visitaDerivazioni(radice, libreria, cliente, osservatore)` (`model.js`) | modello, callback facoltative | nessuno (chiama l'osservatore) | nodo senza definizione: `def` nullo, contenuto non visitato |
| `calcolaGerarchia(radice, libreria, cliente)` | modello | `IndiceGerarchia` | libreria vuota: `libreriaAssente: true` |
| `catenaDi(indice, chiave)` | indice, chiave scelta | `Catena`, o `null` se la chiave non c'è | |
| `gerarchiaAttiva()` / `cambiaModalitaGerarchia()` / `spegniGerarchia()` | | | accendere spegne la Coerenza (AC-1) |
| `segnaGerarchiaDaRicalcolare()` / `ricalcolaGerarchia()` | | uno per fotogramma: aggiorna `ultimoIndice`, `ultimaCatena`; `render()` di nuovo solo se l'impronta della catena cambia | la prima chiamata da `render()`, la seconda anche subito da `scegli()` (AC-11, AC-12) |
| `scegli(chiave)` | chiave | aggiorna scelta, rami, ispettore, `render()` | |
| `scegliDaCanvas(owner, req)` | `{ ownerType, ownerId }`, requisito | chiave dal livello corrente, poi `scegli()` (AC-2) | |
| `mostraGerarchiaDi(chiave)` | chiave | accende la modalità se serve, apre la scheda, `scegli()` (AC-3) | |
| `vaiAOccorrenza(chiave)` | chiave dalla riga | navigazione di AC-9 | percorso rotto: "Questo elemento non c'è più" |
| `togliScelta()` / `azzeraSceltaGerarchia()` | | | `✕`, Esc / cambio progetto (AC-12, AC-13) |
| `rinominaSceltaGerarchia(blockId, mappaRinomina)` | blocco salvato, mappa vecchio id → nuovo id | aggiorna `chiaveScelta` | chiamata da `inspector.js` dopo `aggiornaRiferimentiRequisiti()` |
| `filoInCatena(graph, edgeId)` / `occorrenzaInCatena(chiave)` / `contatoreGerarchia(percorso)` / `chiaveSulCanvas(ownerType, ownerId, reqId)` | | letture per il renderer (AC-10) | senza scelta: `false`, `0` |
| `segnaSchedaGerarchiaDaAggiornare()` / `aggiornaSchedaGerarchia()` | | ridisegno una volta per fotogramma (AC-6, AC-7, AC-8) | |
| `initGerarchia()` (chiamata da `initApp()`) | | gestori di `#btnGerarchia`, righe, `✕`, Esc | |
| `spegniCoerenza()` (`coerenza.js`, nuova) | | spegne la modalità Coerenza con i suoi effetti, senza `render()` | |
| `modaleAperta()` (`progetto.js`, ora esportata) | | `true` se è aperta la finestra Apri, Changelog o Import cliente | usata dal gestore di Esc |
| `startParentBlockDrag()` (`renderer.js`) | | segno `spostato`; da `endDrag` sceglie o chiama `alClic` se non spostato | |
| `mostraScheda(nome)` (`cliente.js`) | | gestisce anche `gerarchia` | |
| `mostraDettaglioCliente(id)` (`inspector.js`) | | aggiunge il pulsante `🌳 Mostra gerarchia` | |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Indice | occorrenze di blocco | `visitaDerivazioni()`: per ogni `nodo` con `def`, `def.requisiti`, percorso `[...ctx.percorso, nodo.id]` |
| Indice | occorrenze cliente | `appState.cliente.requisiti` (`id`, `idCliente`, `stato`) |
| Indice | padre e figlio di un filo | `esito.padre` / `esito.figlio` di `visitaDerivazioni()` (valido e di derivazione); padre alla radice `__cliente__|reqId`, dentro `ctx.percorso` più `reqId`; figlio `[...ctx.percorso, figlio.ownerId]` più `reqId` |
| Canvas | chiave di un pin o blocco tondo | `chiaveSulCanvas()`: `pathStack.slice(1)` più `ownerId` del pin; per `'parent'` solo `pathStack.slice(1)`, alla radice `ID_CLIENTE` |
| Canvas | filo della catena | `ultimaCatena.fili.get(getCurrentLevel().graph)` |
| Canvas | numero sul blocco | `ultimaCatena.contatori.get([...idAperti, node.id].join('/'))` |
| Canvas | colore del contatore | `getColoreRequisito(req della scelta)` |
| Ispettore | blocco di un pin | `selectNode(nodo)`, nodo del livello corrente con `ownerId` |
| Ispettore | blocco di un blocco tondo | `openLibraryBlock(pathStack.at(-1).parentNode.type)` |
| Scheda | riga: id | `req.idCliente` per il cliente, altrimenti `req.id` |
| Scheda | riga: titolo | `titoloRequisito(req)` |
| Scheda | riga: blocco | ultima voce di `etichette`, `Cliente` per il cliente |
| Scheda | riga: colore | `getColoreRequisito(req)` |
| Scheda | riga: ritirato | `req.stato === 'ritirato'` |
| Scheda | suggerimento con il percorso | `progetto.nome` più `etichette`, unite da ` › ` |
| Scheda | numero per sezione | `antenati.size` / `discendenti.size` |
| Scheda | limite di righe aperte | `appSettings.gerarchia.righeAperte` |
| Scheda | libreria non caricata | `Object.keys(appState.library).length === 0` |
| Navigazione | centro del blocco | `node.position` più metà di `node.width` / `node.height` (o `appSettings.node.width` / `height`) |
| Rinomina | nuovo id | `mappaRinomina` passata a `aggiornaRiferimentiRequisiti()` in `inspector.js` |
| Cambio progetto | scelta da togliere | `mantieniLivello` falso in `sostituisciModello()` |

**Key invariants**:
- Il calcolo non cambia mai il modello; nessuna azione di questa funzionalità scrive nel file del progetto.
- Modalità, scelta, rami e risultato non entrano mai in `appState` né in `testoProgetto()`.
- Un filo è padre e figlio solo se `verificaCompatibilita()` è `null` e `isDerivazione()` è vero; la stessa visita dà questo verdetto alla Coerenza e alla Gerarchia.
- Pin di un blocco e blocco tondo dello stesso requisito dentro quel blocco hanno sempre la stessa chiave.
- Gerarchia e Coerenza non sono mai accese insieme.
- Clic su una riga e navigazione risolvono dall'indice di adesso per chiave, mai da oggetti tenuti da prima.
- Un elemento della catena non è mai attenuato.

**Security model**: un solo utente in locale, nessuna rotta nuova, nessun dato nuovo su disco. Id, titoli ed etichette nella scheda sono testo dell'utente o del cliente: passano tutti per `escapeHtml()` prima di `innerHTML`, anche negli attributi `title` e `data-*`. Nessun dato regolamentato.

**Configuration required** (nuova chiave in `settings.json`, in `DEFAULT_SETTINGS` e nel merge annidato di `loadSettings()` in `js/state.js`):
- `gerarchia.righeAperte`: `300`, righe visibili al massimo prima che i livelli più bassi dell'albero partano chiusi.

**Critical test scenarios**:
- Happy path: 2 requisiti cliente, un blocco Centralina alla radice derivato dal primo, dentro due blocchi figli derivati da un requisito di Centralina, dentro uno di loro un nipote. Accendi la modalità, clicchi il pin di Centralina: Antenati mostra il cliente, Discendenti i due figli e il nipote; alla radice il filo cliente → Centralina è evidenziato, il resto attenuato, Centralina ha il contatore `3`; entri e vedi i due fili evidenziati. Il file non ha versioni nuove. Verifica **AC-1**, **AC-2**, **AC-6**, **AC-10**.
- Istanze: due Pompe dello stesso tipo, una derivata dal cliente A, l'altra dal cliente B, con interni diversi. Scegliere il pin della prima mostra solo A e solo i suoi discendenti; dentro la seconda nulla è evidenziato. Scegliere il blocco tondo dentro la prima dà la stessa gerarchia del suo pin fuori. Verifica **AC-4**.
- Più padri e ritirati: un requisito derivato da due blocchi tondi diversi, uno dei quali discende da un ritirato. Antenati mostra due rami, quello del ritirato barrato. Un filo tra due blocchi fratelli e un filo con tipologie diverse non compaiono. Verifica **AC-5**, **AC-6**.
- Volumi: un requisito cliente con 500 discendenti su 4 livelli; il primo livello si vede tutto, i livelli bassi partono chiusi secondo il limite; aprire un ramo a mano resta aperto dopo un filo tirato. Un diamante ripetuto su 6 livelli (ogni requisito con due padri) non blocca la scheda: si costruiscono solo le righe visibili. Con 3000 cliente e 200 blocchi il trascinamento resta fluido. Verifica **AC-8**, **AC-11**.
- Navigazione: clic sulla riga di un nipote a tre livelli apre il livello giusto, centra il blocco, lo seleziona e l'albero si ricentra; clic su un cliente non sul canvas apre solo il dettaglio; da un dettaglio cliente `🌳 Mostra gerarchia` accende la modalità e spegne la Coerenza. Verifica **AC-3**, **AC-9**, **AC-1**.
- Clic tremolante: a modalità accesa premi su un blocco tondo, muovi di un pixel senza cambiare casella della griglia e rilasci: sceglie; trascini di una casella: si sposta e non sceglie; alla radice lo stesso vale per il dettaglio cliente. Verifica **AC-2**.
- Scelta che sparisce: scegli un requisito, elimini il blocco: "Il requisito scelto non c'è più"; Ctrl+Z e la gerarchia ricompare da sola; rinomini l'id del requisito e salvi: la scelta segue; apri un altro progetto: scelta tolta, modalità accesa; Esc e `✕` tolgono la scelta, Esc dentro un campo di testo no. Verifica **AC-12**, **AC-13**.
- Filtro e Nascondi Non Coinvolti: catena di capacità, filtro `Elettrica` con Nascondi Non Coinvolti: i fili e i blocchi della catena restano disegnati e pieni, il resto come oggi. Verifica **AC-10**.
- Coerenza invariata: gli scenari critici della spec 0004 danno lo stesso risultato dopo lo spostamento della visita. Verifica **AC-14**.

## Build plan

Tracer Bullet: il primo compito porta una scelta dal clic sul pin all'indice, alla scheda e ai fili evidenziati; i successivi completano il canvas, l'albero e il ciclo di vita della scelta.

1. **Filo minimo dal clic alla scheda e al canvas**: chiave `gerarchia.righeAperte` in `settings.json`, `DEFAULT_SETTINGS` e `loadSettings()`; `visitaDerivazioni()` in `model.js` e `calcolaCoerenza()` riscritta sopra di lei senza cambiare comportamento; `js/gerarchia.js` con modalità, esclusività con la Coerenza (`spegniCoerenza()`), `calcolaGerarchia()`, `catenaDi()`, calcolo una volta per fotogramma da `render()` e subito da `scegli()`; `#btnGerarchia` con classe `pulsante-gerarchia`; quarta scheda in `index.html` e `mostraScheda()`; scelta con premi e rilascia sullo stesso pin in `createReqPin()`; scheda con barra e due sezioni tutte aperte; fili della catena evidenziati. Satisfies **AC-1**, **AC-4**, **AC-5**, **AC-11**, **AC-14**.
2. **Canvas completo**: segno `spostato` in `startParentBlockDrag()` con scelta e `alClic` da `endDrag`, pannello destro alla scelta, aloni, attenuazione del resto, contatori in `renderNode()`, regole con filtro per classe e Nascondi Non Coinvolti in `render()`. Satisfies **AC-2**, **AC-10**.
3. **Albero completo**: righe con pallino, id, titolo, blocco e suggerimento; ritirati barrati; testi delle sezioni vuote e dello stato senza scelta; rami apribili con `data-ramo`, regola di `righeAperte`, rami a mano; ridisegno solo a impronta cambiata. Satisfies **AC-6**, **AC-7**, **AC-8**.
4. **Navigazione e ciclo della scelta**: `vaiAOccorrenza()` dalle righe; `🌳 Mostra gerarchia` nel dettaglio cliente; `✕` ed Esc con `modaleAperta()` esportata; scelta sparita derivata; `rinominaSceltaGerarchia()` da `inspector.js`; `azzeraSceltaGerarchia()` da `sostituisciModello()`. Satisfies **AC-3**, **AC-9**, **AC-12**, **AC-13**.

## Consequences

**Positive**:
- Nessuna dipendenza, nessuna rotta e nessun formato nuovi: file del progetto e `start.py` non cambiano.
- Una sola visita decide cosa è un padre per Coerenza, Gerarchia e domani Matrice (voce 6): il verdetto non può divergere.
- La questione delle istanze multiple è chiusa per tutte le funzionalità di tracciabilità: l'occorrenza è l'unità, e la Matrice e l'export (voci 6 e 7) partono da lì.

**Negative / tradeoffs**:
- Spostare la visita tocca `coerenza.js`, già verificato: serve rifare i suoi scenari in `/check verify` (AC-14).
- A modalità accesa si rifà la visita completa e la catena una volta per fotogramma, anche durante un trascinamento che non cambia nulla della catena. Accettato perché lineare e già misurato per la Coerenza; il prezzo è che dopo un filo tirato le evidenze arrivano un fotogramma dopo, con un secondo `render()`.
- Il clic sul dettaglio cliente passa da `click` a `endDrag`: un cambio piccolo a un comportamento già verificato (spec 0003), da riprovare.
- Con più padri e diamanti (un requisito raggiunto da due strade) l'albero ripete righe: completo ma più lungo.
- Il contatore conta tutte le occorrenze della catena dentro un blocco, non solo i discendenti: più utile per orientarsi, ma diverso da come era stato descritto nella conversazione.
- Gerarchia e Coerenza non si vedono insieme: per sapere se un pezzo della catena ha problemi devi cambiare modalità.

**Neutral**:
- Nuovo modulo `js/gerarchia.js`, quarta scheda del pannello, nuove funzioni esportate in `model.js` e `coerenza.js`: da aggiungere a `js/AGENTS.md` (lo fa `/sync`).
- `mostraScheda()` di `cliente.js` commuta ora quattro schede: la 0004 suggeriva di spostarlo in `app.js` a questo punto; si può fare nello stesso compito 1 se resta piccolo.
- `renderer.js` e `gerarchia.js` si importano a vicenda: un ciclo in più, ammesso purché nessuna funzione importata sia chiamata al caricamento.

## Follow-up

- [ ] Misurare in `/check verify` il trascinamento con modalità accesa e scelta sul progetto di AC-11; se scatta anche con il calcolo per fotogramma, saltare il ricalcolo quando cambiano solo le posizioni.
- [ ] La Matrice di tracciabilità (voce 6) parte da `calcolaGerarchia()`: una riga per ogni coppia padre e figlio dell'indice. Decidere lì se la matrice mostra le occorrenze o le raggruppa per id.
- [ ] Valutare con l'uso se serve vedere i problemi di coerenza dentro l'albero (es. un segno sulle righe senza figli) invece di cambiare modalità.
