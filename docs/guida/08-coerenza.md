# 8. Controllo di coerenza

Il controllo di coerenza cerca in tutto il modello, a ogni livello, i requisiti rimasti scoperti e i fili rotti. Ti serve per rispondere a due domande: "ho coperto tutti i requisiti del cliente?" e "c'è qualche requisito che non deriva da nulla?".

## Accenderlo

Premi **`⚠️ Verifica Coerenza`** nella barra del canvas. La modalità si accende:

* il pulsante appare premuto e mostra il numero di problemi, per esempio `⚠️ Verifica Coerenza (12)`;
* nella colonna sinistra compare e si apre la scheda **Coerenza** (la colonna si riapre se l'avevi chiusa);
* il canvas evidenzia i problemi.

Premi di nuovo per spegnerla. Coerenza e Gerarchia non stanno accese insieme: accendere una spegne l'altra.

Il controllo si rifà da solo a ogni modifica: tiri un filo e il problema sparisce dall'elenco, senza ripremere nulla. Accendere, spegnere, cercare e navigare non cambiano il progetto.

Se la libreria non è caricata, la scheda dice "Libreria non caricata: il controllo riparte quando la carichi".

## I cinque tipi di problema

| Gruppo | Cosa segnala |
|---|---|
| **Cliente senza figli** | Un requisito cliente attivo che non ha nessun filo valido verso il modello. Conta anche se non l'hai portato sul canvas. |
| **Requisiti senza padre** | Un requisito di un blocco, a qualsiasi livello e per ogni istanza, che in quel livello non riceve nessun filo di derivazione valido da un blocco tondo. Alla radice il padre deve essere un requisito cliente attivo. |
| **Requisiti senza figli** | Dentro un blocco che contiene altri blocchi, un suo requisito (blocco tondo) che non scende a nessun requisito dei blocchi interni |
| **Fili da requisiti ritirati** | Un requisito cliente ritirato che ha ancora fili validi. Una voce per requisito, con il numero di fili. |
| **Da riparare** | Un blocco il cui tipo non esiste nella libreria aperta, oppure un filo non valido (blocco collegato sparito, requisito che non esiste più, interfaccia con capacità, tipologie diverse) |

Qualche precisazione:

* Un collegamento tra due blocchi dello stesso livello non dà un padre: solo una derivazione da un blocco tondo lo fa.
* Un filo non valido non dà padre né figli a nessuno.
* Un blocco "foglia" (che non contiene altri blocchi) non produce voci "senza figli": è normale che i suoi requisiti finiscano lì.
* Ogni istanza di un blocco è valutata a sé: una Pompa può essere coperta e un'altra no.
* Un progetto senza requisiti cliente segnala comunque i requisiti della radice come senza padre, con la riga "Nessun requisito cliente importato" in cima al gruppo.

## La scheda Coerenza

I gruppi compaiono nell'ordine della tabella, ciascuno con titolo e conteggio. Partono chiusi: un clic sul titolo li apre o li chiude.

Ogni voce mostra l'id del requisito (per il cliente l'ID del cliente), il titolo e il percorso del livello, per esempio `Impianto › Centralina › Pompa`. Un gruppo mostra al massimo 200 voci, poi "e altri N".

* La **ricerca** in alto filtra le voci di tutti i gruppi per id, ID del cliente o titolo; i conteggi diventano "N di M".
* Senza problemi la scheda dice "Nessun problema: ogni requisito è collegato".

### Rimuovere un filo non valido

Le voci "Da riparare" che riguardano un filo hanno il pulsante **`Rimuovi`**. Dopo una conferma toglie il filo dal modello. È una modifica come le altre: si salva e si può annullare.

## Andare al problema

Un clic su una voce ti porta dove sta il problema: apre il livello giusto (percorso compreso), sposta la vista per centrare l'elemento (lo zoom non cambia) e:

* per un requisito senza padre seleziona il suo blocco;
* per un requisito senza figli centra il suo blocco tondo;
* per un requisito cliente sul canvas va alla radice, centra il blocco tondo e ne apre il dettaglio; se non è sul canvas apre solo il dettaglio;
* per un blocco senza definizione centra la sua posizione e scrive il motivo nell'ispettore (il blocco non è disegnato);
* per un filo non valido scrive nell'ispettore i due estremi e il motivo.

Se nel frattempo un blocco del percorso è sparito, vedi "Questo elemento non c'è più" e la scheda si aggiorna.

## Le evidenze sul canvas

Con la modalità accesa, in ogni livello:

* il pin di un requisito senza padre ha un **alone rosso**;
* un blocco tondo senza figli, un requisito cliente senza figli e un ritirato con fili hanno un alone rosso sul cerchio;
* passando il mouse sopra, il suggerimento aggiunge il motivo;
* un blocco che contiene problemi al suo interno, a qualsiasi profondità, mostra in alto a destra un **contatore rosso** con il loro numero. Così sai in quale blocco entrare.

## Con i filtri

Se nel pannello Filtri hai scelto delle classi, il controllo conta solo i problemi di quelle classi: report, conteggi, numero sul pulsante e contatori. In cima alla scheda compare "Filtro attivo: …". Le voci "Da riparare" si vedono sempre.

La ricerca della scheda filtra solo la scheda, non il pulsante né il canvas. Un elemento attenuato o nascosto dai filtri non ha alone né contatore, ma i suoi problemi restano nella scheda.
