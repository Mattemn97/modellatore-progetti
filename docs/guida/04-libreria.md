# 4. Libreria dei blocchi

La libreria è il catalogo dei blocchi che usi nei progetti. Vive in un file JSON dentro `shared/` (quella predefinita è `shared/libreria.json`) e ha una sua versione e un suo changelog, indipendenti dai progetti.

## Il pannello Libreria

Nella scheda `Libreria` della colonna sinistra trovi:

* il titolo con la **versione** corrente, per esempio `Libreria Blocchi v1.3.0`;
* il pulsante **`📜 Changelog`**, che apre la storia delle modifiche;
* l'etichetta **`Sola lettura`**, solo quando l'app non può scrivere quella libreria (il motivo è nel suggerimento);
* il campo **`Percorso / URL Libreria`** con il pulsante `🔄` per caricare un'altra libreria;
* la **ricerca** e l'**albero dei blocchi**, raggruppati per categoria e sottocategoria.

Ogni progetto ricorda il percorso della sua libreria: quando apri un progetto si carica la libreria giusta.

## Creare un blocco

1. Premi `+ Nuovo Blocco` in cima alla colonna destra.
2. Scrivi il **Titolo Blocco**. L'**ID** si genera da solo dal titolo (minuscole, senza accenti, con `_` al posto di spazi e simboli) e non si modifica qui.
3. Se vuoi, aggiungi **Descrizione**, **Categoria** e **Sottocategoria**. Servono per ordinare l'albero e per i filtri. Senza categoria il blocco va in "Generali".
4. Aggiungi i requisiti con `+ Requisito` (vedi sotto).
5. Premi `💾 Salva in Libreria`.

Il blocco compare nell'albero e puoi trascinarlo sul canvas. L'id `__cliente__` è riservato e non si può usare.

## I requisiti di un blocco

Ogni requisito è una scheda con:

| Campo | A cosa serve |
|---|---|
| **ID univoco** | Proposto in automatico (es. `centralina_001`), puoi cambiarlo. Deve essere unico in tutta la libreria e diverso dagli id dei requisiti cliente del progetto aperto. |
| **Titolo** | Il nome breve del requisito |
| **Tipologia** | Una tipologia (Elettrica, Segnale, Meccanica, Fluidica…) lo rende un requisito di interfaccia, con una porta sul bordo. `Capacità (nessuna tipologia)` lo rende un requisito di capacità, con un pin quadrato interno. |
| **Metodo di verifica** | Ispezione, Analisi, Dimostrazione o Test (l'elenco viene da `settings.json`). Finisce nella matrice e nelle disposizioni di qualifica dei documenti. |
| **Testi da esportare** | Con `+ Testo da esportare` aggiungi un paragrafo e scegli il documento di destinazione (SSS, SSDD, IRS, IDD, SRS, SDD). Puoi averne più di uno, anche per documenti diversi. |

La `✕` accanto al titolo elimina il requisito (con conferma); la `✕` accanto a un testo elimina quel testo. I testi lasciati del tutto vuoti non vengono salvati.

## Modificare un blocco esistente

Apri il blocco con un clic nell'albero della libreria oppure con un clic su una sua istanza nel canvas. Cambia quello che serve e premi `🔄 Aggiorna Blocco di Libreria`.

Cosa succede quando salvi:

* La libreria si scrive **prima su disco**. Solo se il server conferma, l'app aggiorna la memoria, il progetto e l'albero. Se la scrittura fallisce ricevi un messaggio con il motivo e il form resta aperto con i tuoi dati: nulla è cambiato.
* La modifica vale per **tutte le istanze** del blocco nel progetto, perché condividono la definizione.
* Se hai **cambiato l'id** di un requisito, i fili e le posizioni delle porte seguono il nuovo id.
* I **fili non più validi** (requisito eliminato, tipologia cambiata) vengono tolti, e il messaggio finale ti dice quanti.
* L'etichetta dell'istanza selezionata prende il nuovo titolo.
* Se non hai cambiato nulla rispetto al disco, vedi "Nessuna modifica da salvare" e non si crea nessuna versione.

Alla fine vedi un messaggio come `Blocco salvato. Libreria v1.4.0 (minor).`

### Livello e motivo della modifica

Sopra il pulsante di salvataggio ci sono due campi facoltativi:

* **Livello**: `Automatico` (predefinito), `Patch`, `Minor` o `Major`. Serve se vuoi alzare il livello della versione rispetto a quello calcolato. Un livello più basso del calcolato viene ignorato.
* **Motivo della modifica**: una frase libera che finisce nel changelog.

Dopo ogni salvataggio riuscito i due campi tornano ai valori predefiniti.

## Copiare un blocco

`📋 Salva come Nuovo Blocco Simile` prepara un blocco nuovo con gli stessi dati, il titolo con " Copia" in fondo e **id nuovi** per tutti i requisiti (perché gli id devono restare unici). Modifica quello che vuoi e premi `💾 Salva in Libreria`.

## Rinominare l'id di un blocco

Nel form di un blocco esistente, accanto a "ID Blocco di Libreria", c'è il collegamento `✏️ Rinomina ID`.

1. Scrivi il nuovo id. Può contenere solo lettere, cifre, `_`, `-` e `.`, al massimo 200 caratteri, e non può essere già usato da un altro blocco (senza distinguere maiuscole e minuscole).
2. Se il server conferma, il blocco prende il nuovo id nella libreria e **tutte le istanze del progetto aperto lo seguono**, a ogni livello. Il progetto si salva da solo.
3. Vedi un messaggio come `ID rinominato: pompa → pompa_principale. 3 istanze aggiornate. Libreria v2.0.0 (major).`

La rinomina è sempre una modifica major: gli altri progetti che usano il vecchio id vedranno quel blocco come "senza definizione".

## Eliminare un blocco dalla libreria

Nel form di un blocco esistente premi `🗑 Elimina dalla libreria`.

* Se il blocco è **usato nel progetto aperto**, l'app non lo elimina e ti mostra l'elenco delle istanze con il loro percorso (fino a 20). Toglile prima dal canvas.
* Se **non è usato**, ti chiede conferma ricordandoti che è una modifica major e che gli altri progetti che lo usano lo vedranno senza definizione. Confermando il blocco sparisce dalla libreria.

Non confondere questo pulsante con `🗑️ Elimina Blocco dal Grafico`, che toglie solo l'istanza dal canvas.

## Versioni

Ogni modifica salvata fa avanzare la versione della libreria nella forma `MAJOR.MINOR.PATCH` (versionamento semantico). Il livello lo calcola il server confrontando il blocco nuovo con quello su disco:

| Livello | Quando | Esempio di avanzamento |
|---|---|---|
| **Major** | Un requisito è rimosso o rinominato, cambia tipologia (anche da interfaccia a capacità o viceversa), un blocco è eliminato o rinominato | `1.4.2` → `2.0.0` |
| **Minor** | Nasce un blocco o si aggiunge un requisito | `1.4.2` → `1.5.0` |
| **Patch** | Tutto il resto: titolo, descrizione, categoria, sottocategoria, metodo di verifica, testi da esportare, ordine dei requisiti | `1.4.2` → `1.4.3` |

Un cambio major ti avvisa che un progetto costruito sulla versione precedente potrebbe avere fili o istanze da sistemare.

## Changelog

Il pulsante `📜 Changelog` apre una finestra con tutte le voci, dalla più recente. Ogni voce riporta versione, data e ora, autore (il tuo utente di Windows), origine (`App`, `Modifica esterna` o `Voce iniziale`), livello, motivo e l'elenco di cosa è cambiato: per ogni blocco se è stato creato, modificato, rinominato o eliminato, quali campi sono cambiati, e per ogni requisito se è stato aggiunto, modificato, rimosso o rinominato.

Il changelog registra **quali** campi sono cambiati, non i valori vecchi e nuovi.

Un campo di filtro in alto mostra solo le voci che toccano un blocco (per id o titolo) o un id di requisito; trova le rinomine anche con il vecchio id.

Nel form di un blocco esistente il collegamento **`📜 Storia`** apre la stessa finestra già filtrata su quel blocco.

Il changelog si salva accanto alla libreria, come `<nome>.changelog.json` (per esempio `shared/libreria.changelog.json`).

## Modifiche fatte fuori dall'app

Se qualcuno modifica a mano il file della libreria (o una scrittura si interrompe), il server se ne accorge confrontando il contenuto con l'ultima voce del changelog. All'apertura della libreria, o prima del salvataggio successivo, aggiunge una voce con origine `Modifica esterna`, calcola il livello con le stesse regole e avanza la versione. L'app ti mostra l'avviso "La libreria è stata modificata fuori dall'app: registrata come versione X".

Cambiare solo spazi, a capo o l'ordine delle chiavi non conta come modifica.

Alla prima apertura di una libreria senza changelog il server crea il changelog con una voce iniziale (versione `1.0.0`, oppure la versione già scritta nel file), senza toccare la libreria. Una libreria nel formato vecchio (una semplice mappa di blocchi) viene convertita al formato nuovo al primo salvataggio.

## Conflitti

Se la libreria è cambiata su disco dopo che l'app l'ha letta (per esempio l'hai modificata da un'altra scheda del browser), il salvataggio non la sovrascrive. Compare il banner "La libreria è cambiata su disco" con due scelte:

* **`Ricarica la libreria`**: rilegge il disco e riapre il blocco nell'ispettore. Perdi solo le modifiche nel form.
* **`Sovrascrivi`**: scrive il tuo blocco sopra la versione su disco. Gli altri blocchi restano quelli del disco.

Lo stesso vale per eliminazione e rinomina. Finché il progetto è in conflitto (vedi [Progetti](05-progetti.md)) il salvataggio della libreria è bloccato con il messaggio "Risolvi prima il conflitto del progetto".

## Sola lettura

L'app scrive solo le librerie dentro `shared/`. Una libreria è in sola lettura quando:

* sta fuori da `shared/` oppure arriva da un indirizzo web;
* è scritta in un formato più nuovo di quello che l'app conosce;
* il suo changelog non si riesce a leggere;
* il server delle librerie non risponde.

In sola lettura vedi l'etichetta `Sola lettura`, i pulsanti per salvare, copiare, rinominare ed eliminare sono disattivati (il motivo è nel suggerimento), ma puoi trascinare i blocchi nel progetto come sempre.

## Copie di sicurezza

Prima di ogni scrittura il server mette la versione precedente del file in `shared/_versioni/<nome>.1.json`, spostando le più vecchie in `.2` e `.3`. Ne tiene al massimo 3 (puoi cambiare il numero in `settings.json`, chiave `libreria.versioni`).

Dentro l'app **non c'è un Annulla della libreria**. Se devi tornare indietro, puoi copiare a mano una di quelle copie al posto della libreria: il server registrerà il cambiamento come modifica esterna.

## Caricare un'altra libreria

Scrivi il percorso nel campo `Percorso / URL Libreria` (per esempio `shared/altra_libreria.json`) e premi `🔄`. Se il caricamento riesce, quella diventa la libreria del progetto aperto e il progetto ricorda il nuovo percorso. Se fallisce, restano libreria e stato di prima.

Il server accetta solo percorsi relativi alla cartella dell'app che finiscono in `.json`, mai dentro `progetti/`.
