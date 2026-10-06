# Modellatore di Requisiti a Blocchi (MBSE): tutorial passo passo

Versione {VERSIONE}

Questo tutorial ti accompagna dall'installazione fino al primo documento generato. Ci vogliono circa 20 minuti. Segui i passi in ordine: ogni parte usa quello che hai fatto nella precedente.

Alla fine avrai costruito un piccolo modello di esempio: un impianto con una **Centralina** che contiene una **Pompa**, collegato a due requisiti del cliente.

---

## Parte 1. Installazione (senza diritti di amministratore)

Il programma si installa solo per te: non servono diritti di amministratore e Windows non chiede conferme di sicurezza (UAC).

1. Fai doppio clic su **`Modellatore-MBSE-Setup-{VERSIONE}.exe`**.
2. Se compare la finestra blu **"Windows ha protetto il PC"** (SmartScreen), è perché il setup non è firmato digitalmente. Clicca **Ulteriori informazioni** e poi **Esegui comunque**.
3. L'installazione dura pochi secondi e non fa domande. Alla fine trovi **Modellatore MBSE** nel menu Start e sul desktop.

Il programma finisce in `%LOCALAPPDATA%\Programs\modellatore-mbse\`. I tuoi dati **non** stanno lì: stanno nella cartella di lavoro che scegli al primo avvio (Parte 2), quindi disinstallare o reinstallare non li tocca mai.

Per disinstallare: **Impostazioni di Windows › App › App installate › Modellatore MBSE › Disinstalla**. Progetti, librerie e impostazioni restano dove sono; se reinstalli, l'app li ritrova.

---

## Parte 2. Primo avvio

1. Apri **Modellatore MBSE** dal menu Start o dal desktop.
2. Al primo avvio l'app ti propone la **cartella di lavoro**, di solito `Documenti\Modellatore MBSE`. Conferma: l'app la crea con dentro `progetti\`, la cartella delle librerie `shared\` con un blocco di esempio e `settings.json`. Puoi cambiarla quando vuoi da **`⚙ Impostazioni`**.
3. Trovi già aperto un progetto vuoto chiamato **"Nuovo progetto"**.
4. Parte da solo un **tour guidato**: lo schermo si scurisce tranne l'area spiegata e un fumetto ti racconta a cosa serve. Vai avanti con **Avanti** (o la freccia →), torna indietro con **Indietro** (←), esci quando vuoi con **Salta il tour** o **Esc**. Non riparte più da solo.

**Regole d'oro:**

* Non devi mai salvare a mano: il progetto si salva da solo circa un secondo dopo ogni modifica. In alto a destra il badge dice `Salvato` quando tutto è su disco.
* Si apre una sola finestra del programma: se lo lanci di nuovo, torna in primo piano quella già aperta.

> Usavi la versione 1 (lo zip con `start.exe`)? Da **`⚙ Impostazioni` › Importa dalla versione 1…** indichi la sua cartella e l'app copia progetti, librerie, changelog e impostazioni nella cartella di lavoro nuova, senza toccare quella vecchia.

---

## Parte 3. Conoscere la finestra

Prenditi un minuto per guardare la disposizione di partenza:

* **A sinistra**: i pannelli **Libreria** (il catalogo dei blocchi) e **Cliente** (i requisiti del cliente), impilati a schede.
* **Al centro**: il pannello **Canvas**, con la barra degli strumenti, dove disegni il modello.
* **A destra**: l'**Ispettore**, dove vedi e modifichi quello che hai selezionato.

**I pannelli si spostano come in un IDE:**

* **Trascina la scheda** di un pannello sopra un altro gruppo per impilarlo lì, oppure verso un bordo per metterlo di fianco, sopra o sotto. Tira i bordi tra i gruppi per ridimensionarli.
* La **✕** sulla scheda chiude un pannello (il Canvas no). Lo riapri dal menu **`🪟 Finestra`** in alto, che segna con ✓ i pannelli aperti.
* Il pulsante **`⧉`** a destra delle schede apre quel gruppo in una **finestra separata**, comoda su un secondo monitor; nella finestra staccata **`⤓`** lo rimette a posto (anche chiuderla lo riaggancia). Quello che fai in una finestra si vede subito nelle altre.
* La disposizione si salva da sola e la ritrovi al prossimo avvio. **`🪟 Finestra` → Ripristina layout** torna a quella di partenza.

Per muoverti sul canvas:

* **rotella del mouse**: zoom;
* **trascina lo sfondo vuoto**: sposta la vista;
* **`🔍 Reset Vista`**: torna alla vista iniziale.

**Aiuto dentro l'app:**

* Accanto a quasi ogni campo c'è una piccola **(i)** blu: passaci sopra con il mouse (o arrivaci con Tab) e ti dice cosa rappresenta quel campo. Anche i pulsanti spiegano cosa fanno se ti fermi sopra.
* Il menu **`❓ Aiuto`** in alto a destra rilancia il **Tour guidato** e con **Mostra le (i)** nasconde o rimette le icone.
* Matrice, Documenti, Import cliente e Filtri hanno un pulsante **`❓ Guida`** con un breve tour di quel pannello o di quella finestra.

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

1. In cima all'Ispettore premi **`+ Nuovo Blocco`**.
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

Il blocco compare nel pannello **Libreria**, sotto "Controllo".

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

1. Apri la scheda **`Cliente`** (a sinistra, accanto a Libreria) e premi **`Importa…`**.
2. Vai nella cartella `%LOCALAPPDATA%\Programs\modellatore-mbse\resources\esempi` (puoi incollare il percorso nella barra della finestra) e scegli `requisiti_cliente_esempio.csv`.
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

Nel pannello Cliente ora ci sono `SSS-001` (capacità, perché non ha tipologia) e `SSS-002` (Elettrica).

> Con un tuo file Excel il procedimento è lo stesso: scegli quali colonne contengono ID e testo, le altre sono facoltative. Quando il cliente manda una revisione, reimporta il file nuovo: l'app aggiorna i requisiti esistenti invece di duplicarli.

---

## Parte 7. Costruisci il modello alla radice

Sei alla **radice**, il livello più alto del modello.

1. **Posa la Centralina**: trascina `Centralina` dal pannello Libreria al centro del canvas.
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
2. Si apre il pannello **Coerenza**, accanto a Libreria. Se hai seguito tutti i passi, non ci sono problemi.
3. Per vedere come funziona, elimina il filo tra `SSS-001` e la Centralina (clic destro sul filo). Il pannello Coerenza mostra subito "Cliente senza figli" e "Requisiti senza padre".
4. Premi **`↶ Annulla`** in alto (oppure `Ctrl+Z`): il filo torna e i problemi spariscono.
5. Premi di nuovo **`⚠️ Verifica Coerenza`** (oppure chiudi il pannello Coerenza con la sua ✕) per spegnere la modalità.

> Annulla torna indietro fino a 3 passi, anche dopo aver chiuso e riaperto l'app.

---

## Parte 10. Segui una catena e guarda la matrice

**Gerarchia**

1. Premi **`🌳 Gerarchia`** nella barra del canvas.
2. Fai un clic (senza trascinare) sul cerchio `SSS-001`. Nel pannello **Gerarchia** vedi tutti i suoi discendenti, fino al requisito della Pompa dentro la Centralina.
3. Prova anche con un clic sul pin viola della Centralina: vedi i suoi antenati (il cliente) e i suoi discendenti (la Pompa).
4. Premi di nuovo **`🌳 Gerarchia`** per uscire.

**Matrice di tracciabilità**

1. Premi **`📊 Matrice Requisiti`**: sotto il canvas si apre il pannello con la tabella di tutte le coppie padre e figlio. Puoi tenerlo aperto mentre modelli: si aggiorna da solo a ogni modifica.
2. Con **`⬇ Esporta .md`** la scarichi come file Markdown, da allegare a un documento o aprire in un editor.

---

## Parte 11. Genera un documento

1. Premi **`📄 Documenti`**: si apre il pannello, accanto alla Matrice. Anche lui si aggiorna mentre modelli.
2. Nel selettore **Documento** scegli **SSS**.
3. Guarda l'anteprima: se nella Parte 5 hai scritto il testo da esportare, lo trovi nel capitolo delle capacità. I capitoli che il modello non può riempire restano con la scritta `_Da completare._`, da scrivere a mano.
4. Premi **`⬇ Esporta .md`** per scaricare il documento.

I documenti seguono lo schema MIL-STD-498 (SSS, SSDD, IRS, IDD, SRS, SDD). Ogni testo da esportare finisce nel documento che hai scelto per lui, e l'ispettore propone solo quelli giusti per il tipo del requisito: le interfacce vanno in IRS e IDD, le capacità in SSS, SSDD, SRS e SDD.

---

## Parte 12. Chiudere e riaprire

1. Controlla che il badge in alto dica **`Salvato`**.
2. Chiudi la finestra del programma (anche le finestre staccate si chiudono con lei). Se una modifica non è ancora su disco, l'app te lo chiede prima di chiudere.
3. La prossima volta apri **Modellatore MBSE** dal menu Start: riapre da solo l'ultimo progetto, con i pannelli come li avevi lasciati.

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

**Backup:** copia la cartella di lavoro (di solito `Documenti\Modellatore MBSE`, la vedi in **`⚙ Impostazioni`**) in un posto sicuro. Contiene progetti, librerie e impostazioni.

**Aggiornamento automatico:** all'avvio il programma controlla su GitHub se c'è una versione più recente. Se c'è, mostra un banner azzurro in cima:

- **Novità** mostra cosa cambia nella nuova versione.
- **Aggiorna e riavvia** salva il progetto, scarica il nuovo setup, ne controlla l'impronta (un file rovinato non viene mai installato), lo installa e riapre il programma. Il tuo lavoro non viene toccato, perché non sta nella cartella del programma.
- Se il download non riesce, il banner te lo dice e resti sulla versione di prima: puoi riprovare.
- **Più tardi** nasconde l'avviso fino al prossimo avvio.

Senza rete il programma parte come sempre, senza avvisi. Per spegnere il controllo apri `settings.json` (da **`⚙ Impostazioni`**) e metti `"controllo": false` nella sezione `"aggiornamenti"`, poi riavvia.

**Aggiornare a mano:** scarica il nuovo setup e avvialo: installa sopra la versione vecchia, senza toccare i tuoi dati.

---

## Problemi comuni

| Problema | Soluzione |
|---|---|
| Windows chiede di confermare il setup | È SmartScreen: **Ulteriori informazioni** → **Esegui comunque** |
| All'avvio compare la pagina di benvenuto invece dell'editor | La cartella di lavoro non c'è più (disco esterno, cartella spostata): sceglila di nuovo o creane una |
| Il badge è rosso, "Errore di salvataggio" | La cartella di lavoro non è scrivibile o non c'è più: leggi il banner e controlla **`⚙ Impostazioni`** |
| Il badge dice "Conflitto" | Il progetto è stato cambiato da fuori mentre era aperto: scegli **Ricarica dal disco** o **Sovrascrivi** |
| Non riesco a collegare due requisiti | Devono essere della stessa classe (stessa tipologia, oppure entrambi di capacità) |
| Ho perso un pannello o la disposizione è confusa | **`🪟 Finestra`** › il pannello che manca, oppure **Ripristina layout** |

## Requisiti di sistema

* Windows 10 o 11, 64 bit
* Circa 300 MB liberi per il programma
