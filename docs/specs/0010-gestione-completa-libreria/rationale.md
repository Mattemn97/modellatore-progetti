# 0010. Rationale: gestione completa della libreria

## Context

La libreria condivisa (spec 0002) si modifica oggi solo salvando un blocco intero: si possono creare e cambiare blocchi, ma non eliminarli né cambiarne l'id, che nasce dal titolo alla creazione. Ogni scrittura passa dal server, che tiene versione semantica, changelog e copia di riferimento, con controllo di conflitto per impronta. Il progetto collega i nodi alla libreria per id (`node.type`), quindi eliminare o rinominare un blocco tocca anche le istanze. L'app conosce solo il progetto aperto; la libreria può essere usata da altri progetti.

## Options considered

### Option 1: rotte dedicate, eliminazione solo se non usato (scelta)
**Pros**: ogni operazione ha la sua validazione; la scrittura resta in un punto; nessun nodo orfano nel progetto aperto.
**Cons**: due rotte in più; per eliminare un blocco usato bisogna prima togliere le istanze a mano.

### Option 2: campo `operazione` sulla rotta `salva`
**Pros**: una sola rotta.
**Cons**: `salva()` già lungo diventa un ramo per ogni operazione; validazioni mescolate.

### Option 3: eliminazione con rimozione delle istanze
**Pros**: un clic.
**Cons**: cancella parti del progetto (con i loro fili e contenuti annidati) da un form di libreria; facile da fare per sbaglio.

## Rationale

Il rischio principale è rompere qualcosa in silenzio: le istanze del progetto aperto si proteggono (avviso e rifiuto per l'eliminazione, aggiornamento per la rinomina), gli altri progetti si avvisano con la versione major e il testo della conferma. Condividere `_applica()` con `salva()` garantisce che versione, changelog e riferimento seguano le stesse regole già verificate in spec 0002.

### Decisioni prese in autonomia

Spec scritta in modalità autonoma su richiesta dell'utente (opzione raccomandata a ogni scelta): rifiuto dell'eliminazione di un blocco usato, rotte dedicate, versione major automatica, `prompt` per il nuovo id, formato vecchio da convertire prima, nessun riferimento esterno.
