# 5. Progetti

Un progetto è il modello di un sistema: blocchi, fili, porte, snodi, contenuto di ogni blocco e requisiti del cliente. Ogni progetto è un file JSON nella cartella `progetti/`, e quel file è la fonte di verità: l'app lo riscrive da sola mentre lavori.

## Salvataggio automatico

Non devi mai salvare a mano. Circa un secondo dopo l'ultima modifica (o dopo che rilasci il mouse) l'app scrive il progetto su disco.

Si salvano tutte le modifiche al modello: aggiungere, spostare, ridimensionare o eliminare un blocco; creare o eliminare un filo; spostare una porta; aggiungere o spostare uno snodo; spostare un blocco tondo; un salvataggio dall'ispettore che cambia etichette, fili o id; cambiare il percorso della libreria; tutto quello che riguarda i requisiti cliente.

Non si salvano, e non consumano versioni, i cambi di sola vista: zoom, spostamento, entrare e uscire dai blocchi, filtri, ricerca, selezione, modalità Coerenza e Gerarchia.

### Il badge

Nell'header, a destra, un badge ti dice sempre a che punto è il salvataggio:

| Badge | Significato |
|---|---|
| `Salvato` | Il file su disco è uguale a quello che vedi |
| `Modifiche in attesa` | Hai appena modificato qualcosa, il salvataggio parte tra poco |
| `Salvataggio…` | La scrittura è in corso |
| `Errore di salvataggio` | L'ultima scrittura non è riuscita (badge rosso) |
| `Conflitto` | Il file su disco è cambiato da un'altra parte |

Se provi a chiudere la scheda del browser mentre il badge non dice `Salvato`, il browser ti chiede conferma.

### Quando il salvataggio fallisce

Se la cartella di lavoro non è raggiungibile, il disco dà errore o un altro programma tiene bloccato il file, il badge diventa rosso e sotto l'header compare un banner rosso con il motivo e il pulsante `Riprova`. L'app continua a riprovare da sola; al primo tentativo riuscito il banner sparisce e il file contiene l'ultimo stato.

Il caso più comune è una cartella di lavoro su un disco esterno o di rete che non è più collegato: ricollegalo e il salvataggio riparte, oppure scegli un'altra cartella da ⚙ Impostazioni.

## Annulla e Ripeti

* **`↶ Annulla`** (o `Ctrl+Z`) riporta il progetto alla versione precedente, fino a **3 passi**. Funziona anche dopo aver chiuso e riaperto l'app, perché le versioni sono file su disco.
* **`↷ Ripeti`** (o `Ctrl+Y`, o `Ctrl+Shift+Z`) riapplica quello che hai annullato **in questa sessione**.

Qualche dettaglio utile:

* Una nuova modifica, l'apertura di un altro progetto o `Ricarica dal disco` svuotano l'elenco di Ripeti.
* Nome del progetto e percorso della libreria non vengono annullati.
* Le modifiche alla libreria non si annullano da qui (vedi [Libreria](04-libreria.md#copie-di-sicurezza)).
* Un import di requisiti cliente è un unico passo: un solo Annulla lo toglie tutto, requisiti e fili insieme.
* `Ctrl+Z` non agisce mentre scrivi in un campo di testo o mentre è aperta una finestra.

Prima di ogni scrittura che cambia il contenuto, il server sposta la versione precedente in `progetti/_versioni/<nome>.1.json` e fa scorrere le più vecchie in `.2` e `.3`. Il numero di versioni si regola in `settings.json` (`progetti.versioni`).

## Il menu Progetto

Il menu `Progetto ▾` nell'header raccoglie tutte le operazioni sui file:

| Voce | Cosa fa |
|---|---|
| `Nuovo…` | Chiede un nome e crea un progetto vuoto, con la stessa libreria di quello aperto |
| `Apri…` | Mostra l'elenco dei progetti in `progetti/` (nome, file, ultima modifica), dal più recente. Un clic apre il progetto. Un file danneggiato è segnato "(file non leggibile)". |
| `Salva una copia come…` | Chiede un nome (propone "Copia di …"), crea un nuovo progetto uguale a quello aperto e lo apre |
| `Rinomina…` | Cambia nome e nome del file. Il nuovo nome compare subito come radice del percorso nell'header. |
| `Elimina` | Dopo una conferma sposta il file in `progetti/_cestino/` e apre il progetto modificato più di recente (o ne crea uno nuovo se non ne restano) |
| `Importa JSON…` | Crea un nuovo progetto da un file JSON (vedi sotto) |
| `Scarica JSON` | Scarica una copia del progetto aperto come `<nome>.json` |

Dal nome che scrivi l'app ricava il nome del file (minuscole, senza accenti, `_` al posto degli spazi). Se esiste già un progetto con lo stesso nome di file ricevi un messaggio e nulla viene sovrascritto. Se annulli la richiesta del nome non succede niente.

Un progetto eliminato non è perso: lo ritrovi in `progetti/_cestino/` e puoi rimetterlo in `progetti/` a mano.

### Importa JSON

Accetta tre tipi di file:

* un file di progetto di questa app;
* un `modello.json` con la sola chiave `workspace` (formato delle versioni precedenti);
* uno `standalone.json` con `library` e `workspace`: il progetto viene importato e la libreria contenuta nel file è ignorata, con un avviso.

Un file senza un grafo valido (`nodes` ed `edges`) viene rifiutato con un messaggio. Se il progetto usa blocchi che non ci sono nella libreria aperta, un avviso te li elenca.

## Conflitti

Se il file del progetto cambia sul disco dopo che l'app l'ha letto (lo hai modificato a mano, oppure hai lo stesso progetto aperto in due schede), l'app non lo sovrascrive. Il badge diventa `Conflitto` e il banner ti offre:

* **`Ricarica dal disco`**: scarta le modifiche in memoria e riprende il file com'è sul disco;
* **`Sovrascrivi`**: scrive la tua versione sopra quella del disco.

Finché non scegli, sono sospesi il salvataggio automatico, Annulla, Ripeti, le voci del menu che cambiano progetto (resta solo `Scarica JSON`), il salvataggio della libreria e l'import dei requisiti cliente.

Il consiglio è di tenere aperto ogni progetto in una sola scheda del browser.

## All'avvio

L'app riapre l'ultimo progetto su cui hai lavorato (lo ricorda in `progetti/_ultimo.json`) e la sua libreria. Se quel file manca, apre il progetto modificato più di recente; se non ci sono progetti ne crea uno nuovo, "Nuovo progetto".

Se un file di progetto non è un JSON valido, o è stato scritto da una versione più nuova dell'app, ricevi un messaggio: il file non viene toccato e resta aperto il progetto precedente.

## Avvisi all'apertura

Aprendo un progetto l'app fa un po' di pulizia e te lo dice nel banner:

* un filo della radice che parte da un requisito cliente che non esiste più viene tolto;
* se un id di requisito cliente coincide con un id della libreria aperta, ricevi un avviso con l'elenco degli id.

Nessuno dei due blocca l'apertura.
