# Verify: Controllo di coerenza · spec 0004 · updated 2026-10-01
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] All'avvio il pulsante dice `⚠️ Verifica Coerenza` senza numero e la linguetta Coerenza non c'è → AC-1
- [x] Premi `⚠️ Verifica Coerenza`: il pulsante appare premuto con il totale `(N)`, la scheda Coerenza compare e si apre, il pannello sinistro si riapre se era chiuso → AC-1
- [x] Spegni la modalità: la scheda sparisce (torna Libreria se era aperta), il pulsante torna normale, il canvas non ha aloni né contatori; nessuna versione nuova in `progetti/_versioni/` → AC-1
- [x] Carica un percorso di libreria vuoto: la scheda dice "Libreria non caricata: il controllo riparte quando la carichi" e il pulsante non ha numero → AC-1
- [x] Progetto con 5 requisiti cliente: tira un filo da un cliente a un pin; la voce sparisce subito da Cliente senza figli e da Requisiti senza padre, senza ripremere il pulsante → AC-2, AC-3, AC-10
- [x] Un collegamento tra due blocchi fratelli non toglie i loro requisiti da Requisiti senza padre → AC-3
- [x] Progetto mai importato: i requisiti della radice sono in Requisiti senza padre con la riga "Nessun requisito cliente importato", che non conta nel numero → AC-3, AC-7
- [x] Due istanze dello stesso blocco, una collegata dentro e l'altra no, più un blocco foglia mai aperto: solo l'istanza scoperta compare in Requisiti senza figli, il foglio non produce voci → AC-4
- [x] Reimport che ritira un cliente con 2 fili: esce da Cliente senza figli, entra in Fili da requisiti ritirati con "2 fili validi", e i requisiti che derivavano solo da lui entrano in Requisiti senza padre → AC-3, AC-5
- [x] File modificato a mano con un nodo di tipo `inesistente` e un filo tra un'interfaccia `Elettrica` e una `Segnale`: entrambi in Da riparare (prima il blocco, poi il filo) con il motivo → AC-6
- [x] `Rimuovi` sul filo non valido: chiede conferma, il filo sparisce e va su disco; Ctrl+Z lo rimette → AC-6
- [x] I gruppi partono chiusi nell'ordine Cliente senza figli, Senza padre, Senza figli, Fili da ritirati, Da riparare; aperti restano aperti dopo un ridisegno → AC-7
- [x] Ogni voce mostra id (ID del cliente per il cliente), titolo e percorso come il breadcrumb (es. `Progetto › Centralina`) → AC-7
- [x] 3000 requisiti cliente non collegati: il gruppo mostra 200 voci e "e altri 2800"; la ricerca di un ID ne trova uno e i conteggi diventano "N di M" → AC-7
- [x] Senza problemi la scheda dice "Nessun problema: ogni requisito è collegato" e il pulsante `(0)` → AC-7, AC-1
- [x] Filtro `Elettrica`: riga "Filtro attivo: Elettrica", pulsante, contatori, aloni e scheda contano solo i problemi elettrici; le voci Da riparare restano → AC-8
- [x] La ricerca della scheda non cambia numero sul pulsante né contatori → AC-8
- [x] Con "Nascondi Non Coinvolti" i problemi dei blocchi nascosti restano nei conteggi ma nessun alone né contatore su di loro → AC-8
- [x] Pin senza padre con alone rosso, blocco tondo senza figli e cliente senza figli sul canvas con alone sul cerchio; il suggerimento aggiunge il motivo; un elemento attenuato dal filtro non ha alone → AC-9
- [x] Un blocco con problemi nel contenuto, a qualunque profondità, ha il contatore rosso in alto a destra; clic, doppio clic, trascinamento e ridimensionamento del blocco funzionano come prima → AC-9
- [x] Trascinamento di un blocco con la modalità accesa su un progetto con 3000 cliente e 200 blocchi: fluido come a modalità spenta → AC-10
- [x] Annulla, Ripeti, Ricarica, apertura di un altro progetto, `Salva` di un blocco di libreria e import cliente aggiornano da soli report e numero → AC-10
- [x] Dalla radice, clic su una voce Senza padre a tre livelli di profondità: livello giusto con breadcrumb, vista centrata a zoom invariato, blocco selezionato con il suo form → AC-11
- [x] Clic su una voce Senza figli: centra il blocco tondo; clic su un cliente sul canvas: va alla radice, centra, evidenzia e apre il dettaglio; clic su un cliente non sul canvas: solo il dettaglio → AC-11
- [x] Clic su un blocco senza definizione: apre il livello, centra la sua posizione, il motivo è nell'ispettore; clic su un filo non valido: estremi e motivo nell'ispettore → AC-11
- [x] Elimina un blocco, poi clicca subito una voce rimasta indietro che stava dentro di lui: "Questo elemento non c'è più" e la scheda si aggiorna → AC-11
- [x] Con la scheda aperta tira un filo, premi Ctrl+Z e subito clicca una voce o `Rimuovi`: agisce sul modello di adesso, mai su quello di prima → AC-6, AC-11

## Value sourcing
- [x] Cambia lo `stato` di un requisito cliente (reimport che lo ritira): passa da Cliente senza figli a Fili da ritirati, da `appState.cliente.requisiti` → AC-2, AC-5
- [x] Salva un blocco di libreria aggiungendo un requisito: compare subito in Senza padre per ogni istanza (`appState.library[node.type].requisiti`) → AC-3
- [x] Aggiungi un requisito al blocco padre di un livello con contenuto: compare in Senza figli (`requisitiPadre(tipoPadre)`) → AC-4
- [x] Un filo tra tipologie diverse è non valido con il motivo di `verificaCompatibilita()` → AC-6
- [x] Un filo tra due blocchi fratelli (non `isDerivazione`) non dà padre → AC-3
- [x] Svuota un livello interno: le sue voci Senza figli spariscono (`internal_graph.nodes.length`) → AC-4
- [x] Rinomina il progetto: il percorso nelle voci usa il nuovo nome; rinomina l'etichetta di un blocco: il percorso la segue → AC-7
- [x] Un ritirato con un filo valido e uno non valido: la voce dice "1 filo valido", il non valido sta solo in Da riparare → AC-5
- [x] Cambia `coerenza.righePerGruppo` in `settings.json` (es. 5) e ricarica la pagina: il gruppo mostra 5 voci e "e altri N" → AC-7
- [x] Il filtro per classe legge `appState.activeTypeFilter`: `Tutti` = nessun filtro → AC-8
- [x] Centratura di un blocco ridimensionato: usa `position` più metà di `width`/`height` → AC-11
- [x] Centratura di un blocco tondo mai spostato: usa la sua posizione in colonna → AC-11

## Commands
- [x] `python start.py` poi apri http://localhost:8080 → nessun errore in console oltre a eventuali 404 già presenti prima → AC-1

## Acceptance-criteria coverage
- AC-1: passi UI 1, 2, 3, 4, 15 e Commands · AC-2: UI 5, VS 1 · AC-3: UI 5, 6, 7, 9, VS 2, 5 · AC-4: UI 8, VS 3, 6 · AC-5: UI 9, VS 1, 8 · AC-6: UI 10, 11, 27, VS 4 · AC-7: UI 7, 12, 13, 14, 15, VS 7, 9 · AC-8: UI 16, 17, 18, VS 10 · AC-9: UI 19, 20 · AC-10: UI 5, 21, 22 · AC-11: UI 23, 24, 25, 26, 27, VS 11, 12
