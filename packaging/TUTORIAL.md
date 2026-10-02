# Modellatore di Requisiti a Blocchi (MBSE): tutorial passo passo

Versione {VERSIONE}

Questo tutorial ti accompagna dall'estrazione dello zip fino al primo documento generato. Ci vogliono circa 20 minuti. Segui i passi in ordine: ogni parte usa quello che hai fatto nella precedente.

Alla fine avrai costruito un piccolo modello di esempio: un impianto con una **Centralina** che contiene una **Pompa**, collegato a due requisiti del cliente.

---

## Parte 1. Installazione (senza diritti di amministratore)

L'app non si installa: è una cartella che estrai e usi. Non servono diritti di amministratore.

1. Fai clic destro sul file `ModellatoreMBSE-{VERSIONE}.zip` e scegli **Estrai tutto…**.
2. Come destinazione scegli una cartella tua, per esempio `Documenti` o `Desktop`.
   **Non** estrarre in `C:\Programmi`: lì l'app non ha il permesso di salvare i progetti.
3. Premi **Estrai**. Nasce la cartella `ModellatoreMBSE` con questo contenuto:

   | Elemento | Cos'è |
   |---|---|
   | `start.exe` | Il programma da avviare (un piccolo server locale) |
   | `index.html`, `style.css`, `js\` | L'app vera e propria, che si apre nel browser |
   | `settings.json` | Le impostazioni (colori, tipologie, documenti…) |
   | `progetti\` | Qui finiscono i tuoi progetti |
   | `shared\` | Qui finiscono le librerie dei blocchi |
   | `esempi\` | Un file di requisiti cliente da usare in questo tutorial |
   | `TUTORIAL.md` | Questo file |
   | `VERSIONE.txt` | Il numero della versione |

> Non spostare `start.exe` fuori dalla cartella: ha bisogno dei file che ha accanto.

---

## Parte 2. Primo avvio

1. Apri la cartella `ModellatoreMBSE` e fai doppio clic su **`start.exe`**.
2. Se compare la finestra blu **"Windows ha protetto il PC"** (SmartScreen), è perché il programma non è firmato digitalmente. Clicca **Ulteriori informazioni** e poi **Esegui comunque**. Succede solo la prima volta.
3. Si apre una **finestra nera**: è il server. Dopo circa un secondo si apre il browser su `http://localhost:8080` con l'app.
4. Trovi già aperto un progetto vuoto chiamato **"Nuovo progetto"**.

**Regole d'oro:**

* La finestra nera deve restare aperta finché usi l'app. Puoi ridurla a icona, ma non chiuderla.
* Non devi mai salvare a mano: il progetto si salva da solo circa un secondo dopo ogni modifica. In alto a destra il badge dice `Salvato` quando tutto è su disco.
* Se chiudi per sbaglio la scheda del browser, riapri `http://localhost:8080`.

**Se il browser non si apre o dà errore:** probabilmente un altro programma usa la porta 8080. Chiudilo e riavvia `start.exe`.

---

## Parte 3. Conoscere la finestra

Prenditi un minuto per guardare le tre colonne:

* **A sinistra**: le schede **Libreria** (il catalogo dei blocchi) e **Cliente** (i requisiti del cliente).
* **Al centro**: la barra degli strumenti e il **canvas**, dove disegni il modello.
* **A destra**: l'**ispettore**, dove vedi e modifichi quello che hai selezionato.

Per muoverti sul canvas:

* **rotella del mouse**: zoom;
* **trascina lo sfondo vuoto**: sposta la vista;
* **`🔍 Reset Vista`**: torna alla vista iniziale.

---

## Parte 4. Dai un nome al progetto

1. In alto a destra apri il menu **`Progetto ▾`** e scegli **`Rinomina…`**.
2. Scrivi `Impianto di prova` e conferma.
3. Il nuovo nome compare in alto a sinistra, come radice del percorso.

---

## Parte 5. Crea i blocchi nella libreria

Un **blocco** è un componente del sistema. Ogni blocco ha dei **requisiti**, di due tipi:

* **di interfaccia** (con una tipologia: Elettrica, Segnale, Meccanica, Fluidica): appaiono come **porte colorate** sul bordo del blocco;
* **di capacità** (senza tipologia): una cosa che il blocco sa fare; appaiono come **pin quadrati viola** dentro il blocco.

Due requisiti si possono collegare solo se sono della stessa classe: Elettrica con Elettrica, capacità con capacità.

### 5.1 Il blocco Centralina

1. In cima alla colonna destra premi **`+ Nuovo Blocco`**.
2. **Titolo Blocco**: `Centralina`. L'ID si genera da solo.
3. **Categoria**: `Controllo` (facoltativa, serve a ordinare la libreria).
4. Premi **`+ Requisito`** e compila:
   * **Titolo**: `Alimentazione 24 V`
   * **Tipologia**: `Elettrica`
   * **Metodo di verifica**: `Test`
5. Premi di nuovo **`+ Requisito`** e compila:
   * **Titolo**: `Gestire la pompa`
   * **Tipologia**: `Capacità (nessuna tipologia)`
   * **Metodo di verifica**: `Dimostrazione`
6. Facoltativo: nel secondo requisito premi **`+ Testo da esportare`**, scegli il documento `SSS` e scrivi `La centralina deve comandare l'accensione e lo spegnimento della pompa.` Questo testo finirà nel documento SSS che genererai nella Parte 11.
7. Premi **`💾 Salva in Libreria`**.

Il blocco compare nella scheda **Libreria**, sotto "Controllo".

### 5.2 Il blocco Pompa

Ripeti gli stessi passi con questi dati:

* **Titolo Blocco**: `Pompa`, **Categoria**: `Idraulica`
* Requisito 1: titolo `Alimentazione pompa`, tipologia `Elettrica`, verifica `Test`
* Requisito 2: titolo `Pompare 10 l/min`, tipologia `Capacità (nessuna tipologia)`, verifica `Test`

Premi **`💾 Salva in Libreria`**.

> Per modificare un blocco già salvato: cliccalo nella libreria, cambia i campi e premi **`🔄 Aggiorna Blocco di Libreria`**. La modifica vale per tutte le copie del blocco nel progetto.

---

## Parte 6. Importa i requisiti del cliente

Di solito il cliente ti manda i requisiti in un foglio Excel. Per il tutorial usiamo il file di esempio incluso.

1. Nella colonna sinistra apri la scheda **`Cliente`** e premi **`Importa…`**.
2. Vai nella cartella `ModellatoreMBSE\esempi` e scegli `requisiti_cliente_esempio.csv`.
3. Nella finestra **Importa requisiti cliente** controlla le scelte:
   * **Foglio**: quello proposto;
   * **Riga di intestazione**: `1`;
   * **ID** → colonna `A: ID`
   * **Testo** → colonna `C: Testo`
   * **Titolo** → colonna `B: Titolo`
   * **Sezione** → colonna `D: Sezione`
   * **Tipologia** → colonna `E: Tipologia`
4. Nell'anteprima devi vedere **2 nuovi** e nessuno scartato.
5. Premi **`Conferma import`**.

Nella scheda Cliente ora ci sono `SSS-001` (capacità, perché non ha tipologia) e `SSS-002` (Elettrica).

> Con un tuo file Excel il procedimento è lo stesso: scegli quali colonne contengono ID e testo, le altre sono facoltative. Quando il cliente manda una revisione, reimporta il file nuovo: l'app aggiorna i requisiti esistenti invece di duplicarli.

---

## Parte 7. Costruisci il modello alla radice

Sei alla **radice**, il livello più alto del modello.

1. **Posa la Centralina**: trascina `Centralina` dalla scheda Libreria al centro del canvas.
2. **Posa i requisiti cliente**: torna alla scheda **Cliente** e trascina le righe `SSS-001` e `SSS-002` sul canvas, a sinistra della Centralina. Diventano due **cerchi** (blocchi tondi).
3. **Tira il primo filo**: premi sul pin del cerchio `SSS-001` e, tenendo premuto, trascina fino al pin quadrato viola **"Gestire la pompa"** della Centralina. Rilascia: compare il filo.
4. **Tira il secondo filo**: dal cerchio `SSS-002` alla porta rossa **"Alimentazione 24 V"** sul bordo della Centralina.

Hai appena detto che i requisiti della Centralina **derivano** da quelli del cliente.

**Prova un errore:** tira un filo da `SSS-001` (capacità) alla porta rossa della Centralina (Elettrica). L'app rifiuta e spiega perché: le classi sono diverse.

**Gesti utili sui fili:**

* clic sul filo: lo selezioni e a destra vedi padre e figlio;
* doppio clic su un punto del filo: aggiungi uno snodo da trascinare per dargli forma;
* clic destro sul filo: lo elimini;
* `Shift` + trascina una porta: la sposti lungo il bordo del blocco.

---

## Parte 8. Scendi dentro la Centralina

1. Fai **doppio clic** sulla Centralina. In alto il percorso diventa `Impianto di prova / Centralina`.
2. Sul canvas vedi due cerchi: sono i **requisiti della Centralina**, che ora fanno da padri per quello che metti dentro.
3. Trascina `Pompa` dalla libreria dentro questo livello.
4. Tira un filo dal cerchio **"Gestire la pompa"** al pin viola **"Pompare 10 l/min"** della Pompa.
5. Tira un filo dal cerchio **"Alimentazione 24 V"** alla porta rossa **"Alimentazione pompa"** della Pompa.
6. Torna su con **`← Indietro`** in alto a sinistra, oppure con un clic su `Impianto di prova` nel percorso.

Ora la catena è completa: cliente → Centralina → Pompa.

---

## Parte 9. Controlla cosa manca

1. Nella barra del canvas premi **`⚠️ Verifica Coerenza`**.
2. A sinistra si apre la scheda **Coerenza**. Se hai seguito tutti i passi, non ci sono problemi.
3. Per vedere come funziona, elimina il filo tra `SSS-001` e la Centralina (clic destro sul filo). La scheda Coerenza mostra subito "Cliente senza figli" e "Requisiti senza padre".
4. Premi **`↶ Annulla`** in alto (oppure `Ctrl+Z`): il filo torna e i problemi spariscono.
5. Premi di nuovo **`⚠️ Verifica Coerenza`** per spegnere la modalità.

> Annulla torna indietro fino a 3 passi, anche dopo aver chiuso e riaperto l'app.

---

## Parte 10. Segui una catena e guarda la matrice

**Gerarchia**

1. Premi **`🌳 Gerarchia`** nella barra del canvas.
2. Fai un clic (senza trascinare) sul cerchio `SSS-001`. Nella scheda **Gerarchia** a sinistra vedi tutti i suoi discendenti, fino al requisito della Pompa dentro la Centralina.
3. Prova anche con un clic sul pin viola della Centralina: vedi i suoi antenati (il cliente) e i suoi discendenti (la Pompa).
4. Premi di nuovo **`🌳 Gerarchia`** per uscire.

**Matrice di tracciabilità**

1. Premi **`📊 Matrice Requisiti`**: si apre la tabella di tutte le coppie padre e figlio.
2. Con **`⬇ Esporta .md`** la scarichi come file Markdown, da allegare a un documento o aprire in un editor.

---

## Parte 11. Genera un documento

1. Premi **`📄 Documenti`**.
2. Nel selettore **Documento** scegli **SSS**.
3. Guarda l'anteprima: se nella Parte 5 hai scritto il testo da esportare, lo trovi nel capitolo delle capacità. I capitoli che il modello non può riempire restano con la scritta `_Da completare._`, da scrivere a mano.
4. Premi **`⬇ Esporta .md`** per scaricare il documento.

I documenti seguono lo schema MIL-STD-498 (SSS, SSDD, IRS, IDD, SRS, SDD). Ogni testo da esportare finisce nel documento che hai scelto per lui.

---

## Parte 12. Chiudere e riaprire

1. Controlla che il badge in alto dica **`Salvato`**.
2. Chiudi la scheda del browser e poi la **finestra nera**.
3. La prossima volta fai doppio clic su `start.exe`: l'app riapre da sola l'ultimo progetto.

**Gestire più progetti** dal menu **`Progetto ▾`**:

| Voce | Cosa fa |
|---|---|
| `Nuovo…` | Crea un progetto vuoto |
| `Apri…` | Mostra l'elenco dei progetti e ne apre uno |
| `Salva una copia come…` | Duplica il progetto aperto |
| `Rinomina…` | Cambia il nome |
| `Elimina` | Sposta il progetto nel cestino (`progetti\_cestino\`), da cui puoi recuperarlo |
| `Importa JSON…` / `Scarica JSON` | Porta un progetto dentro o fuori dall'app come file |

---

## Backup e aggiornamenti

**Backup:** copia le cartelle `progetti\` e `shared\` in un posto sicuro. Contengono tutti i tuoi dati.

**Aggiornare a una nuova versione:**

1. Chiudi la finestra nera.
2. Se avevi modificato `settings.json`, salvane una copia.
3. Estrai il nuovo zip **nella stessa posizione** del precedente e conferma la sovrascrittura dei file.

I tuoi progetti e le tue librerie non vengono toccati: lo zip contiene `progetti\` e `shared\` vuote, quindi non sovrascrive nulla al loro interno.

---

## Problemi comuni

| Problema | Soluzione |
|---|---|
| Windows chiede di confermare l'avvio | È SmartScreen: **Ulteriori informazioni** → **Esegui comunque** |
| La finestra nera si chiude subito | La porta 8080 è occupata: chiudi l'altro programma o riavvia il PC |
| Il badge è rosso, "Errore di salvataggio" | Hai chiuso la finestra nera: riavvia `start.exe`, il salvataggio riparte da solo |
| Il badge dice "Conflitto" | Il progetto è aperto in due schede: tienine una e scegli **Ricarica dal disco** o **Sovrascrivi** |
| Non riesco a collegare due requisiti | Devono essere della stessa classe (stessa tipologia, oppure entrambi di capacità) |
| L'app non salva i progetti | La cartella è in una posizione protetta (es. `C:\Programmi`): spostala in `Documenti` |
| Ho aperto `index.html` con un doppio clic e non funziona | L'app va aperta sempre con `start.exe` |

## Requisiti di sistema

* Windows 10 o 11
* Un browser recente: Chrome, Edge o Firefox
* La porta 8080 libera
