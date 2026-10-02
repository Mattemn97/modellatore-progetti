# 6. Requisiti cliente

I requisiti cliente sono le frasi che ti arrivano dal cliente, spesso in un foglio Excel con centinaia o migliaia di righe. L'app le importa nel progetto: diventano i blocchi tondi della radice, cioè i padri di tutto il modello, e da lì tiri i fili verso i requisiti dei blocchi di sistema.

I requisiti cliente appartengono al progetto, non alla libreria. Ogni progetto ha i suoi.

## La scheda Cliente

Nella colonna sinistra apri la scheda `Cliente`.

* Senza un progetto aperto dice "Apri un progetto".
* In un progetto senza requisiti cliente trovi solo `Importa…` e una riga che spiega a cosa serve.
* Dopo un import trovi l'elenco, con ricerca e filtri (vedi più sotto).

## Importare un file

1. Nella scheda Cliente premi **`Importa…`** e scegli un file `.xlsx`, `.xlsm` o `.csv`.
2. Si apre la finestra **Importa requisiti cliente**. Scegli:
   * il **Foglio** (per un CSV ce n'è uno solo; i fogli nascosti sono segnati "(nascosto)");
   * la **Riga di intestazione**, cioè la riga con i nomi delle colonne (1 per impostazione);
   * per ogni campo, la colonna da cui leggerlo. Le colonne sono scritte come lettera più nome, per esempio `B: Descrizione`.

   | Campo | Obbligatorio | Uso |
   |---|---|---|
   | ID | sì | L'identificativo del cliente (es. `SSS-012`) |
   | Testo | sì | La frase del requisito |
   | Titolo | no | Un nome breve; se manca si usa l'inizio del testo |
   | Note | no | Annotazioni libere |
   | Sezione | no | Il capitolo o gruppo del documento del cliente; diventa un filtro nella scheda |
   | Tipologia | no | Se c'è, il requisito è di interfaccia di quella tipologia; se è vuota, è di capacità |

3. Guarda l'**anteprima** (vedi sotto) e scegli la **modalità**.
4. Premi **`Conferma import`**.

Il progetto si salva subito dopo la conferma. Tutto l'import è un solo passo di Annulla: se il risultato non ti piace, `Ctrl+Z` lo toglie interamente.

### Che file vanno bene

* **CSV** in UTF-8 (con o senza BOM) o in Windows-1252, separato da `;`, `,` o tabulazione. Virgolette e a capo dentro le celle sono gestiti, e le lettere accentate arrivano giuste.
* **Excel** `.xlsx` o `.xlsm`. Arrivano i testi, i numeri interi senza `.0` (un ID `12` resta `12`) e il valore calcolato delle formule. Le celle vuote in mezzo a una riga non spostano le colonne.
* Il file non può superare 20 MB (`cliente.maxFileMB` in `settings.json`).

Non sono supportati i vecchi `.xls` né i file protetti da password: l'app ti chiede di "salvare il file come .xlsx senza password e riprovare". Le date di Excel arrivano come numeri: non usarle come ID o testo.

### L'anteprima

Prima di confermare vedi esattamente cosa succederà. In alto ci sono i conteggi: nuovi, modificati, riattivati, ritirati, invariati, scartati e fili che si perdono. Sotto, quattro schede:

* **Scartati**: le righe che non entrano, con numero di riga, ID e motivo;
* **Modificati**: il prima e dopo di testo, titolo e tipologia;
* **Ritirati**: i requisiti che spariranno dall'insieme attivo;
* **Nuovi**: i requisiti che entrano (le prime 200 righe, poi "e altri N").

Una riga viene scartata, con un solo motivo, il primo che vale in quest'ordine:

1. ID vuoto;
2. testo vuoto;
3. tipologia che non corrisponde a nessuna tipologia di `settings.json` (maiuscole e minuscole non contano; vuota va bene e vuol dire capacità);
4. ID ripetuto nel file (vengono scartate tutte le copie);
5. id finale uguale all'id di un requisito della libreria aperta.

Le righe del tutto vuote sono ignorate senza segnalarle. ID e testi perdono gli spazi ai bordi. Gli ID si confrontano come testo esatto: `12` e `012` sono diversi, e così `a1` e `A1`.

La conferma è disattivata se il file non ha nessuna riga valida.

## Reimportare una revisione

Quando il cliente ti manda la revisione successiva, importa di nuovo. L'app confronta il file con quello che c'è già, usando l'ID del cliente, e **aggiorna invece di duplicare**.

La finestra ripropone le scelte dell'ultima volta: stesso foglio (se esiste ancora), stessa riga di intestazione, stesse colonne (cercate per nome, oppure per lettera se il nome manca o è ripetuto).

Puoi scegliere tra due modalità, e i conteggi si aggiornano mentre cambi:

| Modalità | Effetto |
|---|---|
| **Sostituisci l'insieme** (predefinita) | Chi manca nel file diventa **ritirato** |
| **Aggiungi e aggiorna** | Nessuno viene ritirato: entrano i nuovi e si aggiornano gli esistenti |

In entrambe:

* un requisito con testo, titolo o tipologia diversi diventa **modificato**: prende i valori nuovi e ricorda quelli di prima;
* un requisito ritirato che ricompare nel file torna **attivo** (riattivato) ed è segnato come modificato;
* note e sezione si aggiornano senza segnare il requisito come modificato;
* un requisito ritirato **tiene i suoi fili** e la sua posizione sul canvas, così non perdi il lavoro fatto;
* se un requisito cambia tipologia e un suo filo non rispetta più le regole di collegamento, quel filo viene tolto. L'anteprima te lo dice prima, in "fili che si perdono".

Se un requisito era già modificato e cambia ancora, il "prima" conserva i valori più vecchi che non hai ancora visto.

## Gli id dei requisiti cliente

L'id di un requisito cliente è un prefisso più l'ID del file, per esempio `CLI-SSS-012`. Il prefisso viene da `settings.json` (`cliente.prefisso`, predefinito `CLI-`) al primo import e poi resta fisso nel progetto: cambiare l'impostazione non tocca gli id già esistenti.

Gli id dei requisiti cliente non possono coincidere con quelli della libreria. Il salvataggio di un blocco di libreria con un id di requisito uguale a un requisito cliente del progetto aperto viene rifiutato con un messaggio.

## Cercare e filtrare

La scheda Cliente elenca i requisiti nell'ordine del file. Ogni riga mostra l'ID del cliente, il titolo e alcuni segni: se è sul canvas, quanti fili ha, se è modificato, se è ritirato.

* **Ricerca** su ID, titolo e testo, senza distinguere maiuscole e minuscole.
* **Stato**: `Tutti`, `Non collegati` (attivi con zero fili), `Modificati`, `Ritirati`.
* **Sezione**: le sezioni presenti nel file.
* Si vedono al massimo 300 righe alla volta, con la scritta "N risultati, mostrati i primi M": restringi la ricerca per trovare il resto.
* **`Segna tutti come visti`** (con conferma) toglie il segno Modificato a tutti i requisiti.

`Importa…` è disattivato, con il motivo nel suggerimento, se nessun progetto è aperto o se il progetto è in conflitto.

## Portare un requisito sul canvas

1. Vai alla **radice** del progetto.
2. Trascina una riga della scheda Cliente sul canvas. Il requisito diventa un blocco tondo, centrato sul punto di griglia più vicino al cursore, nel colore della sua classe.
3. Dal pin del blocco tondo tira un filo verso un requisito di un blocco di sistema della radice, con le solite regole: stessa classe, e mai tra due requisiti cliente.

Un requisito è sul canvas solo se lo hai trascinato. Trascinarlo di nuovo lo sposta, non lo duplica. Ai livelli interni il rilascio è rifiutato con il messaggio "I requisiti cliente si collegano solo alla radice".

Non serve portare tutto sul canvas: con migliaia di requisiti conviene trascinare solo quelli su cui stai lavorando.

## Il dettaglio di un requisito cliente

Un clic su una riga della scheda, o sul suo blocco tondo, apre il dettaglio nella colonna destra, in sola lettura: ID del cliente, id, titolo, testo intero, note, sezione, classe, stato, numero di fili e, se è modificato, il prima e dopo.

Se il requisito è sul canvas e sei alla radice, la vista si sposta per centrarlo (lo zoom non cambia) e il blocco tondo si evidenzia.

Dal dettaglio puoi:

* **`✔ Segna come visto`**: toglie il segno Modificato e dimentica il "prima";
* **`Togli dal canvas`**: toglie il blocco tondo, non il requisito. Funziona solo se il requisito è sul canvas e non ha fili;
* **`🌳 Mostra gerarchia`**: accende la Gerarchia su quel requisito (vedi [Gerarchia](09-gerarchia.md)).

## Come appaiono sul canvas

* Un requisito **ritirato** ha il cerchio grigio tratteggiato. I suoi fili restano, ma non puoi tirarne di nuovi: l'app risponde "Requisito cliente ritirato: non si collega".
* Un requisito **modificato** ha un segno sul cerchio finché non lo segni come visto.
* I filtri del canvas valgono anche per i blocchi tondi cliente e i loro fili.

## Compatibilità dei file

L'app salva i progetti nel formato 2. Le versioni dell'app precedenti ai requisiti cliente rifiutano questi file invece di aprirli e perdere i requisiti cliente al primo salvataggio. L'app attuale legge sia il formato 1 sia il 2, quindi i progetti vecchi si aprono come sempre.
