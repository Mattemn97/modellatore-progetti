# Verify: Gerarchia dei requisiti · spec 0005 · updated 2026-10-01
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Modello di prova consigliato (lo scenario felice della spec): 2 requisiti cliente sul canvas (CLI-0, CLI-1), alla radice un blocco Centralina derivato da CLI-0; dentro Centralina due blocchi Figlio derivati da un requisito di Centralina; dentro il primo Figlio un Nipote.

## UI / manual
- [x] Apri la pagina → `🌳 Gerarchia` non premuto, nessuna scheda Gerarchia → AC-1
- [x] Premi `🌳 Gerarchia` → pulsante premuto, scheda Gerarchia visibile e aperta (anche se il pannello sinistro era chiuso), testo "Clicca un pin, una porta o un blocco tondo…" → AC-1, AC-6
- [x] Con la libreria vuota la scheda dice "Libreria non caricata: la gerarchia riparte quando la carichi" e il canvas non ha evidenze → AC-1
- [x] Premi e rilascia sul pin di Centralina → nessun filo nuovo; Antenati: CLI-0 (1 occorrenza); Discendenti: i due Figli e il Nipote (3 occorrenze); ispettore sul blocco Centralina → AC-2, AC-6
- [x] Alla radice: il filo CLI-0 → Centralina è spesso ed evidenziato, CLI-1 attenuato, CLI-0 con alone, contatore `3` in alto a sinistra di Centralina, nel colore della classe → AC-10
- [x] Trascina da un pin a un altro compatibile → il filo si crea come prima e la scheda si aggiorna da sola (antenati 2) → AC-2, AC-11
- [x] Entra in Centralina → i due fili verso i Figli sono evidenziati → AC-10
- [x] Dentro Centralina, premi sul blocco tondo, muovi di un pixel senza cambiare casella e rilascia → sceglie, stessa gerarchia del pin di Centralina vista da fuori → AC-2, AC-4
- [x] Trascina lo stesso blocco tondo di una casella → si sposta e non sceglie → AC-2
- [x] Due istanze dello stesso blocco di libreria, una derivata da CLI-0 e l'altra da CLI-1, con interni diversi: scegliere la prima mostra solo CLI-0 e i suoi discendenti; dentro la seconda nulla è evidenziato → AC-4
- [x] Un requisito derivato da due blocchi tondi diversi, uno dei quali discende da un cliente ritirato → Antenati con due rami, la riga del ritirato barrata con il segno "ritirato"; un filo tra due blocchi fratelli e un filo con tipologie diverse non compaiono → AC-5, AC-6
- [x] Ogni riga: pallino del colore della classe, id (l'ID del cliente per un cliente), titolo, blocco (`Cliente` per un cliente); suggerimento con il percorso `Progetto › Centralina › …`; ▸ ▾ solo sulle righe con figli → AC-7
- [x] Un cliente con 500 discendenti su 4 livelli → la profondità 1 si vede tutta, i livelli bassi partono chiusi; apri un ramo a mano, tira un filo → il ramo resta aperto; una nuova scelta toglie le eccezioni → AC-8
- [x] Diamante ripetuto su 6 livelli (ogni requisito con più padri) → la scheda non si blocca → AC-8
- [x] Clic sulla riga del Nipote → si apre il livello del primo Figlio (breadcrumb compreso), vista centrata sul Nipote, Nipote selezionato, l'albero si ricentra su di lui → AC-9
- [x] Clic sulla riga di un cliente non sul canvas → si apre solo il suo dettaglio → AC-9
- [x] Dal dettaglio di un requisito cliente premi `🌳 Mostra gerarchia` (con la Coerenza accesa) → Coerenza spenta, Gerarchia accesa, quel cliente scelto, dettaglio ancora aperto, livello e vista invariati → AC-3, AC-1
- [x] Con la Gerarchia accesa premi `⚠️ Verifica Coerenza` → Gerarchia spenta, la sua scheda sparisce → AC-1
- [x] Filtro `Elettrica` con Nascondi Non Coinvolti e una catena di capacità scelta → fili e blocchi della catena restano disegnati e pieni, il resto come prima → AC-10
- [x] Scegli un requisito, elimina il suo blocco → "Il requisito scelto non c'è più", evidenze sparite, modalità accesa; Ctrl+Z → la gerarchia ricompare da sola → AC-12
- [x] Rinomina nell'ispettore l'id del requisito scelto e premi `Aggiorna Blocco di Libreria` → la scelta segue il nuovo id → AC-12
- [x] Apri un altro progetto → scelta tolta senza messaggio, modalità ancora accesa → AC-12
- [x] `✕` sulla barra ed Esc tolgono la scelta; Esc dentro un campo di testo o con la finestra Apri aperta non fa nulla → AC-13
- [x] Spegni la modalità → canvas come prima, scheda sparita; il clic tremolante su un cliente alla radice apre ancora il suo dettaglio → AC-1, AC-2
- [x] Accendere, spegnere, scegliere, aprire rami e navigare non crea versioni nuove del progetto (Annulla resta com'era) → AC-1
- [x] Gli scenari critici della spec 0004 (`docs/specs/0004-controllo-coerenza/`) danno lo stesso risultato → AC-14

## Value sourcing
- [x] Occorrenze di blocco: un blocco con 2 requisiti dà 2 righe distinte, ciascuna col suo blocco → Indice / occorrenze di blocco
- [x] Occorrenze cliente: un cliente senza fili, scelto da `🌳 Mostra gerarchia`, mostra "Nessun discendente" (non "non c'è più") → Indice / occorrenze cliente
- [x] Padre e figlio: un filo cliente → blocco alla radice e un filo blocco tondo → figlio dentro un blocco danno entrambi la coppia giusta → Indice / padre e figlio
- [x] Chiave sul canvas: pin di Centralina fuori e blocco tondo dentro danno la stessa scheda → Canvas / chiave
- [x] Fili della catena: solo i fili del livello aperto sono evidenziati → Canvas / filo della catena
- [x] Numero sul blocco: `3` su Centralina per una scelta di CLI-0 → Canvas / numero
- [x] Colore del contatore: scelta di capacità viola, di interfaccia il colore della tipologia, di un cliente ritirato grigio → Canvas / colore
- [x] Ispettore: pin → il blocco con quell'istanza; blocco tondo interno → il blocco che contiene il livello, senza blocco selezionato; cliente → il dettaglio → Ispettore
- [x] Righe: id, titolo, blocco, colore, segno ritirato, suggerimento col nome del progetto → Scheda
- [x] Numero per sezione = occorrenze diverse, anche se una compare in due rami → Scheda / numero
- [x] Cambia `gerarchia.righeAperte` in `settings.json` (es. 10) e ricarica la pagina → partono chiusi più livelli → Scheda / limite
- [x] Navigazione: il blocco finisce al centro della vista, a zoom invariato → Navigazione / centro
- [x] Rinomina da Ricarica della libreria → la scelta risulta non più presente → Rinomina
- [x] Annulla e Ricarica tengono la scelta; Apri, Nuovo e Importa la tolgono → Cambio progetto

## Commands
- [x] `node --check` su ogni file di `js/` → nessun errore di sintassi → tutti
- [x] Trascina un blocco con modalità accesa e una scelta, su un progetto con 3000 requisiti cliente e 200 blocchi → fluido come a modalità spenta → AC-11

## Acceptance-criteria coverage
- AC-1 … accensione, libreria vuota, esclusività, spegnimento, nessuna versione · AC-2 … pin, tremolio, trascinamento, ispettore · AC-3 … Mostra gerarchia · AC-4 … istanze, pin e blocco tondo · AC-5 … più padri, ritirato, fili esclusi · AC-6 … sezioni e testi vuoti · AC-7 … righe · AC-8 … limite, rami a mano, diamante · AC-9 … navigazione · AC-10 … evidenze, contatore, filtro · AC-11 … aggiornamento e fluidità · AC-12 … sparita, rinomina, cambio progetto · AC-13 … ✕ ed Esc · AC-14 … scenari 0004
