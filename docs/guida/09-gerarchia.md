# 9. Gerarchia dei requisiti

La Gerarchia ricostruisce l'albero dei requisiti dal cliente fino ai livelli più bassi, attraversando i blocchi annidati. Scegli un requisito e vedi da dove viene (i suoi **antenati**) e fin dove arriva (i suoi **discendenti**), su tutti i livelli insieme, senza dover entrare e uscire dai blocchi.

## Accenderla

Premi **`🌳 Gerarchia`** nella barra del canvas. Il pulsante appare premuto e nella colonna sinistra compare e si apre la scheda **Gerarchia**. Accendere la Gerarchia spegne la Coerenza, e viceversa.

Premi di nuovo per spegnerla: la scelta si toglie e il canvas torna normale. Niente di quello che fai in Gerarchia cambia il progetto.

## Scegliere un requisito

Con la modalità accesa hai quattro modi:

* **premi e rilascia su un pin o una porta** senza trascinare (se trascini fino a un altro pin, tiri un filo come sempre);
* **premi e rilascia sul cerchio di un blocco tondo** senza spostarlo (se lo trascini, si sposta come sempre);
* nel dettaglio di un requisito cliente premi **`🌳 Mostra gerarchia`**: accende la modalità se è spenta e sceglie quel requisito, anche se non è sul canvas o è ritirato;
* dalla [Matrice](10-matrice.md), con un clic sull'ID o sul titolo di un requisito.

Una nuova scelta sostituisce la precedente. La colonna destra mostra il blocco del requisito scelto (o il dettaglio del requisito cliente).

## La scheda Gerarchia

Dall'alto in basso:

1. **Antenati**: un albero rovesciato. Sotto ogni riga ci sono i suoi padri, fino ai requisiti cliente. Se un requisito ha più padri, ognuno ha il suo ramo.
2. **La barra del requisito scelto**: pallino del colore della classe, id, titolo, blocco e il pulsante `✕` per togliere la scelta.
3. **Discendenti**: sotto ogni riga i suoi figli, fino in fondo.

Ogni sezione ha il titolo e il numero di occorrenze. Se non c'è nulla vedi "Nessun antenato" (per un requisito cliente "È un requisito cliente: la catena parte da qui") o "Nessun discendente".

Ogni riga mostra il pallino della classe, l'id (l'ID del cliente per un requisito cliente), il titolo e il blocco che lo possiede (`Cliente` per un requisito cliente). Passando il mouse sopra vedi il percorso completo. Un requisito cliente ritirato ha la riga barrata con il segno "ritirato".

### Rami aperti e chiusi

Le righe con figli hanno un segno ▸ o ▾ che chiude o apre il ramo. Per non riempire la scheda, l'app apre i rami fino alla profondità che sta in 300 righe in tutto (`gerarchia.righeAperte` in `settings.json`); i livelli più profondi partono chiusi. Il primo livello sotto la barra si vede sempre. Quello che apri o chiudi a mano resta così finché non scegli un altro requisito.

## Andare a un requisito dell'albero

Un clic su una riga apre il livello dove sta quel requisito (per un requisito cliente la radice), centra il blocco che lo possiede e **lo rende la nuova scelta**: l'albero si ricentra su di lui. Così puoi risalire o scendere la catena un passo alla volta.

Se nel frattempo un blocco del percorso non esiste più, vedi "Questo elemento non c'è più" e resti dove eri.

## Le evidenze sul canvas

Con una scelta attiva, nel livello che stai guardando:

* i **fili della catena** sono più spessi ed evidenziati;
* i pin e i blocchi tondi che fanno parte della catena hanno un **alone**;
* un blocco che contiene elementi della catena al suo interno mostra **in alto a sinistra un contatore** con il loro numero, nel colore della classe. Ti dice in quale blocco entrare per seguire la catena;
* **tutto il resto è attenuato**.

Gli elementi della catena si vedono sempre pieni, anche se i filtri li escluderebbero o li nasconderebbero.

## Come si costruisce la catena

* Padri e figli vengono solo da **fili di derivazione validi** (da un blocco tondo a un requisito di un blocco interno). I collegamenti tra blocchi dello stesso livello e i fili non validi non entrano.
* Il pin di un requisito su un blocco e il blocco tondo dello stesso requisito dentro quel blocco sono la stessa cosa: è così che la catena scende di livello.
* La gerarchia è **per istanza**: due istanze dello stesso blocco di libreria danno rami separati.
* Un requisito può avere più padri.
* Il contenuto di un blocco senza definizione in libreria non viene visitato.

## Quando la scelta cambia da sola

* Albero, conteggi ed evidenze si aggiornano a ogni modifica, senza scegliere di nuovo.
* Se una modifica fa sparire il requisito scelto (Annulla, blocco eliminato, requisito tolto), la scheda dice "Il requisito scelto non c'è più". La scelta non si perde: se una modifica successiva lo fa tornare (per esempio `Ctrl+Z`), la gerarchia ricompare da sola.
* Se rinomini l'id del requisito scelto salvando il blocco nell'ispettore, la scelta segue il nuovo id.
* Aprendo, creando o importando un altro progetto la scelta si toglie.

## Togliere la scelta

Usa il pulsante `✕` della barra oppure il tasto **Esc**. La modalità resta accesa. Esc non fa nulla mentre scrivi in un campo di testo o con una finestra aperta.
