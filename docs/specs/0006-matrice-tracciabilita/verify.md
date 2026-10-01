# Verify: Matrice di tracciabilità · spec 0006 · updated 2026-10-01
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Modello di prova consigliato (lo scenario della spec): 4 requisiti cliente (1 Elettrica attivo, 2 Capacità attivo, 3 ritirato con un filo verso `CEN_002`, 4 ritirato senza fili); libreria con Centralina (`CEN_001` Elettrica, testo SSS; `CEN_002` Capacità, nessun testo; `CEN_010` Capacità, testi IRS e `XYZ`) e Pompa (`PMP_001` Elettrica, testo IRS). Alla radice: Centralina A con due Pompe derivate da `CEN_001`, Centralina B con una Pompa senza fili, una Centralina foglia; `CLI-1` verso `CEN_001` di A e B.

## UI / manual
- [x] Clic su `📊 Matrice Requisiti` → si apre la finestra grande con filtri, conteggi e tabella; Esc non la chiude, `✕` sì → AC-1
- [x] Apri, filtra, esporta e chiudi la matrice → il file in `progetti/` e `_versioni/` non cambiano, Coerenza e Gerarchia restano come erano → AC-1
- [x] Libreria assente (libreria vuota) → solo "Libreria non caricata: la matrice si calcola quando la carichi", export disattivato; modello senza derivazioni né problemi → "Nessuna derivazione nel modello" → AC-1
- [x] Le 13 intestazioni sono nell'ordine della spec; le celle del padre sono una volta sola per gruppo (rowspan); ID cliente = `idCliente`, Blocco cliente = `Cliente` → AC-2
- [x] Suggerimento della cella Blocco di `PMP_001` → `<progetto> › Centralina A › Pompa A`, … (massimo 10, poi "e altre N") → AC-2
- [x] Gruppo `1` → `CEN_001` con Istanze 2; gruppo `CEN_001` → `PMP_001` con Istanze 2; due fili paralleli nella stessa Pompa contano una volta → AC-3
- [x] Gruppo `3` (ritirato) ha ID e titolo barrati e nota "Ritirato"; `4` (ritirato senza fili) non compare → AC-3, AC-5
- [x] Documenti di `CEN_010` = `IRS, XYZ` (ordine di settings, poi il resto in ordine alfabetico); `CEN_002` vuota; ogni cliente `Cliente` → AC-4
- [x] `CEN_001` ha nota "Senza figli in 1 istanza su 2" (la Centralina foglia non conta); `CEN_002` "Senza figli" con una riga vuota; `2` "Senza figli" → AC-5
- [x] Gruppo Senza padre: `CEN_001` "Senza padre in 1 istanza su 3", `CEN_002` "Senza padre" (il suo unico padre è ritirato), `PMP_001` "Senza padre in 1 istanza su 3"; nessun cliente → AC-6
- [x] Ordine: clienti nell'ordine della lista, poi per livello e id naturale (`CEN_002` prima di `CEN_010`) → AC-7
- [x] Documento IRS lato Figlio → solo `CEN_001` → `PMP_001` e Senza padre `CEN_010`, `PMP_001`; lato Padre → solo `CEN_010` Senza figli; Documento `Cliente` lato Padre → i gruppi cliente → AC-8
- [x] Documento `Tutti` → Lato disattivato e non toglie nulla; `XYZ` compare tra Documento dopo le voci di settings e prima di `Cliente` → AC-8
- [x] Classe Elettrica più ricerca "pomp" si combinano; i conteggi seguono; ricerca "zzz" → "Nessuna riga con questi filtri" ed export disattivato; la ricerca si applica dopo 200 ms → AC-8
- [x] Progetto con 3000 requisiti cliente e 200 blocchi → 300 gruppi a video e "Mostra altri 300 gruppi", che ne aggiunge 300; cambiare un filtro torna ai primi 300 → AC-9
- [x] Clic su `PMP_001` in una riga → finestra chiusa, Gerarchia accesa (Coerenza spenta se era accesa), livello di Centralina A, Pompa A scelta; clic sul padre `CEN_001` → Centralina B (la prima senza figli); clic su `PMP_001` in Senza padre → Pompa C → AC-10
- [x] Istanza sparita prima del clic → "Questo elemento non c'è più" → AC-10
- [x] `⬇ Esporta .md` con Documento SSS → file `<slug>-matrice-sss.md` con titolo, Data e Libreria `<file> v<versione>`, Filtri, conteggi, padre solo sulla prima riga del gruppo, `|` scritto `\|`, a capo diventati spazi, sezione vuota "Nessuna voce" → AC-11
- [x] Export sul progetto grande → contiene tutti i gruppi del risultato filtrato, non solo i 300 visibili → AC-9, AC-11
- [x] Chiudi e riapri → filtri e ricerca restano; una tipologia tolta da settings torna a `Tutte`; con una scelta in Gerarchia, Esc a finestra aperta non la toglie; Ctrl+Z non agisce → AC-12
- [x] Progetto grande → apertura sotto il secondo, scrivere nella ricerca non blocca → AC-13

## Value sourcing
- [x] Rinomina un requisito di libreria e riapri → ID e titolo nuovi (la matrice si ricalcola all'apertura dall'indice di `calcolaGerarchia()`) → AC-1, AC-3
- [x] Togli tutti i blocchi dentro Centralina B → `CEN_001` passa da "Senza figli in 1 istanza su 2" a coperto (`percorsiConContenuto`) → AC-5
- [x] Rinomina il blocco di libreria Pompa → la colonna Blocco cambia (titolo del blocco di libreria, non l'etichetta dell'istanza) → AC-2
- [x] Imposta il metodo di `PMP_001` a vuoto → cella Metodo vuota → AC-2
- [x] Cambia la tipologia di `CEN_001` e `PMP_001` insieme → la colonna Classe e il filtro Classe seguono → AC-2, AC-8
- [x] Cambia `matrice.gruppiVisibili` in `settings.json` a 50 e ricarica la pagina → 50 gruppi a video → AC-9
- [x] Rinomina il progetto → il file scaricato usa il nuovo slug e il nuovo nome nel titolo → AC-11
- [x] Salva un blocco (la versione della libreria cresce) → la riga Libreria dell'export mostra la versione nuova → AC-11

## Acceptance-criteria coverage
- AC-1: UI 1, 2, 3 · AC-2: UI 4, 5 e Value sourcing 3, 4, 5 · AC-3: UI 6, 7 · AC-4: UI 8 · AC-5: UI 7, 9 e Value sourcing 2 · AC-6: UI 10 · AC-7: UI 11 · AC-8: UI 12, 13, 14 · AC-9: UI 15, 19 · AC-10: UI 16, 17 · AC-11: UI 18, 19 e Value sourcing 7, 8 · AC-12: UI 20 · AC-13: UI 21
