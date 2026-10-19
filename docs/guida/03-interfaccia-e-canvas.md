# 3. Interfaccia e lavagna

## Com'è fatta la finestra

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ IDV Modellatore  Lavagna Libreria(3) Componenti(4) Interfacce(2) …  ↶ ↷ ✓Salvato  │  testata
│ MBSE · Impianto  Requisiti(6) Cliente(2) Matrice Documenti Dashboard(1)  Progetto ▾│
├───────────────────────────────────────────────────────────────────────────────────┤
│ banner (solo quando c'è un errore, un conflitto o un avviso)                      │
├──────────────┬────────────────────────────────────────────┬───────────────────────┤
│ Libreria     │ ← Indietro  Impianto / Centralina  + Blocco │ Ispettore             │
│ Cliente      │ Adatta − 100% +  Filtri  Mostra ☑Etichette  │ Ispettore & Gestione  │
│ (Coerenza)   │            lavagna        [Instradamento]   │ + Nuovo Blocco        │
│ (Gerarchia)  │ legenda                   riga di aiuto  ✕  │                       │
│              ├────────────────────────────────────────────┤                       │
│              │ Matrice · Documenti · Componenti · …        │                       │
└──────────────┴────────────────────────────────────────────┴───────────────────────┘
```

* **Testata**: a sinistra il marchio e il nome del progetto aperto (un clic apre la finestra Apri progetto). Al centro le **sezioni**: ognuna apre il suo pannello o lo porta davanti, anche se l'hai staccato in un'altra finestra; quella del pannello attivo è sottolineata. I numeri contano blocchi in libreria, istanze, fili, requisiti, requisiti cliente e, in rosso, i problemi di coerenza. A destra `↶ Annulla`, `↷ Ripeti`, lo stato del salvataggio, i menu `Progetto ▾` e `Finestra ▾`, `⚙` (Impostazioni), `?` (Aiuto) e lo stato dell'app (`Attiva`, o `Errore` con i dettagli al clic). Li trovi spiegati in [Progetti](05-progetti.md).
* **Banner**: una striscia sotto la testata che compare solo quando c'è qualcosa da sapere (salvataggio fallito, conflitto, avviso sulla libreria).
* **Colonna sinistra**: le schede `Libreria` e `Cliente`, più `Coerenza` e `Gerarchia` quando accendi quelle modalità.
* **Al centro**: la **Lavagna**, con la sua barra degli strumenti; sotto, nello stesso gruppo, si aprono Matrice, Documenti, Changelog, Componenti, Interfacce, Requisiti e Dashboard.
* **Colonna destra**: l'ispettore, dove vedi e modifichi quello che hai selezionato.

Ogni pannello si trascina per la scheda, si affianca o si impila, e con `⧉` si stacca in una finestra separata, anche su un altro monitor. I pulsanti `☰ Libreria` e `Ispettore ☰` ai lati della barra chiudono e riaprono le due colonne laterali.

## Le sezioni a tabella e la Dashboard

* **Componenti**: ogni istanza di blocco del progetto, a ogni livello, con tipo, nome, categoria, livello, le porte di interfaccia (in blu quelle con un filo), il numero di capacità, di porte libere, di porte propagate (vedi sotto), di fili e di blocchi dentro. Filtri per categoria e per livello (tutti o solo quello aperto).
* **Interfacce**: ogni filo con classe, tipo (interfaccia, capacità, derivazione), i due estremi (le porte che salgono da un blocco interno hanno il percorso con `↳`), livello, percorso automatico o a mano e stato (`OK` o `Da riparare`, con il motivo sul segno). Filtri per classe e per tipo di filo.
* **Requisiti**: i requisiti di tutti i blocchi della libreria, con classe, metodo di verifica, documenti, quante istanze li portano e quante hanno un filo su quel requisito.
* In tutte e tre: ricerca su ogni colonna, ordinamento con un clic sull'intestazione, **`Esporta CSV`** (con il punto e virgola, per Excel) delle righe che vedi. Un clic su una riga apre il livello giusto e seleziona il blocco o il filo, oppure apre il blocco nell'ispettore.
* **Dashboard**: riquadri con i numeri del progetto, i controlli di coerenza per gruppo (un clic accende la Coerenza), i fili per classe, le istanze per categoria e la **matrice N²** del livello aperto (per ogni coppia di blocchi le classi dei fili che li collegano).

## La barra degli strumenti

| Pulsante | Cosa fa | Capitolo |
|---|---|---|
| `← Indietro` e il percorso | Risali di un livello o a un livello del percorso | qui sotto |
| `+ Blocco` | Apre nell'ispettore il form di un nuovo blocco di libreria | [Libreria](04-libreria.md) |
| `Adatta`, `−`, `100%`, `+`, `Reset vista` | Zoom e vista | qui sotto |
| `🔎 Filtri` | Apre il pannello dei filtri della lavagna | [Filtri](07-filtri.md) |
| Mostra `Etichette`, `Legenda` | Accende o spegne le scritte dei fili e la legenda (preferenza di questo PC) | qui sotto |
| `Trova blocco…` | Centra e seleziona un blocco del livello per nome | qui sotto |
| `📊 Matrice` | Apre la matrice di tracciabilità | [Matrice](10-matrice.md) |
| `📄 Documenti` | Apre la generazione dei documenti MIL-STD-498 | [Documenti](11-documenti.md) |
| `⚠️ Verifica Coerenza` | Accende o spegne il controllo di coerenza | [Coerenza](08-coerenza.md) |
| `🌳 Gerarchia` | Accende o spegne la vista della gerarchia | [Gerarchia](09-gerarchia.md) |
| `↻ Reinstrada` (riquadro Instradamento) | Toglie gli snodi a mano da tutti i fili del livello | qui sotto |
| `🖼 Immagine` (riquadro Instradamento) | Scarica il livello aperto come immagine SVG o PNG | qui sotto |

## L'immagine di un livello

`🖼 Immagine` apre un menu con **SVG** (vettoriale, nitido a ogni zoom, si apre anche in un browser o in Inkscape) e **PNG** (un'immagine normale, al doppio della risoluzione dello schermo). Scarica il livello aperto come `<progetto>-<livello>.svg` o `.png` (`radice` per il livello principale). L'immagine ha lo stesso stile della lavagna: blocchi con le righe dei requisiti, porte, fili (con gli snodi a mano o con lo stesso percorso automatico) con le etichette, e blocchi tondi, senza filtri, evidenze o selezione. Su un livello vuoto l'app ti dice che non c'è niente da esportare.

Gli stessi diagrammi entrano da soli nei documenti Word e PDF (vedi [Documenti](11-documenti.md)).

## Muoversi sulla lavagna

* **Zoom**: rotella del mouse (si centra sul punto sotto il cursore), oppure `−` e `+` (intorno al centro). Va da 0,2 a 3 volte; la percentuale nella barra lo mostra, e un clic su di lei torna al 100%.
* **Spostare la vista** (pan): trascina lo sfondo vuoto con il tasto sinistro, oppure trascina ovunque tenendo premuto il tasto centrale (la rotella).
* **Vedere tutto il livello**: `Adatta`. **Tornare alla vista iniziale**: `Reset vista`.
* **Trovare un blocco**: scrivi il nome (o l'id del tipo) in `Trova blocco…` e premi Invio: la vista si centra su di lui e lo seleziona.

Zoom e spostamento sono solo vista: non si salvano nel progetto.

## La libreria a sinistra

La scheda `Libreria` mostra il catalogo dei blocchi, raggruppato per categoria e poi per sottocategoria. Sopra trovi:

* la versione della libreria (es. `v1.3.0`) e il pulsante `Changelog`;
* il campo `Percorso della libreria` con il pulsante `↻`, per caricare un'altra libreria;
* il campo `Cerca nella libreria…` che filtra l'elenco mentre scrivi.

Un clic su un blocco dell'elenco lo apre nell'ispettore per modificarlo. Tutto quello che riguarda la libreria è spiegato in [Libreria](04-libreria.md).

## Posare e gestire i blocchi

Ogni blocco è disegnato come un componente: in alto il **nome**, la **categoria** con il suo colore e un riquadro con l'**ID del tipo** di libreria; una seconda riga dice il tipo (se hai rinominato l'istanza) o quanti blocchi ha dentro. Sotto c'è **una riga per requisito**, nell'ordine della libreria: ID, titolo e a destra la sigla della classe (`ELE`, `SEG`, … per le tipologie, `CAP` per la capacità). L'altezza viene dalle righe.

* **Aggiungere un blocco**: trascinalo dalla libreria sulla lavagna. Cade centrato sotto il cursore, con l'angolo agganciato alla griglia, a qualsiasi zoom.
* **Selezionare**: un clic sul blocco. Il contorno diventa blu e l'ispettore mostra il blocco di libreria da cui viene.
* **Spostare**: trascina il blocco. La posizione si aggancia alla griglia (20 pixel per impostazione).
* **Allargare**: trascina l'angolo in basso a destra (compare passandoci sopra). Il blocco non scende sotto i 200 pixel.
* **Entrare**: doppio clic sul blocco. Vedi il suo contenuto, con i suoi requisiti come blocchi tondi.
* **Risalire**: `← Indietro`, oppure un clic su un livello del percorso nella barra.
* **Togliere un blocco dalla lavagna**: selezionalo e, nell'ispettore, premi `🗑️ Elimina Blocco dal Grafico` e conferma. Il blocco resta in libreria; sparisce solo questa istanza, con il suo contenuto e i suoi fili.
* **Deselezionare**: un clic sullo sfondo vuoto.

Se passi il mouse sull'intestazione di un blocco vedi la sua descrizione; sopra una riga o una porta vedi id, titolo, classe e testi del requisito.

Se il progetto contiene un blocco il cui tipo non esiste più nella libreria aperta, quel blocco non viene disegnato. Il controllo di coerenza te lo segnala come "Da riparare".

## Porte

* Ogni riga ha la sua **porta**, un quadratino alla sua altezza sul lato sinistro o destro del blocco. Per un requisito di interfaccia sta sul bordo, nel colore della tipologia; per una capacità sta appena dentro il bordo, nel colore della capacità. È **pieno** se la porta ha almeno un filo in questo livello, **vuoto** se è libera.
* Il lato lo sceglie l'app: quello verso l'altro capo del filo (o verso il suo primo snodo), a destra se la porta è libera. Per portarla sull'altro lato **tieni premuto Shift e trascinala** verso l'altra metà del blocco: vale solo per quell'istanza. **`↺ Riposiziona le porte`** nella sezione *Questa istanza* dell'ispettore torna ai lati automatici.
* Senza Shift, trascinare da una porta serve a tirare un filo: mentre lo tiri il cursore diventa una croce.

## Porte che salgono dai blocchi interni (matrioska)

Un requisito di interfaccia di un blocco che sta **dentro** un altro, e che nessun filo usa nel suo livello, **sale sul bordo** del blocco che lo contiene. Lo vedi nella fascia **PORTE DAI BLOCCHI INTERNI**, sotto le righe del blocco, con il percorso dei blocchi da cui viene (`↳ Alimentatore › Sensore · titolo`) e il quadratino tratteggiato. Sale di piano in piano, fino al livello in cui un filo lo usa.

* Si collega come una porta qualsiasi, ma solo alla porta di un altro blocco (non a un blocco tondo: la derivazione dal padre si tira dentro, sul blocco che ha il requisito).
* Una volta collegata sopra, dentro il blocco quella porta si vede piena con il bordo tratteggiato: è collegata a un livello superiore.
* Se la colleghi **anche dentro**, l'app ti avvisa prima: la porta non sale più e il filo di sopra diventa **da riparare** (lo trovi in Coerenza, gruppo "Da riparare", e nella tabella Interfacce).
* La legenda conta le porte libere (senza filo né qui né sopra) e quelle propagate del livello.

## Blocchi tondi

Dentro un blocco ogni suo requisito è un cerchio, del colore della sua classe, con un pin per tirare i fili. Puoi trascinare i cerchi dove ti è comodo: la loro posizione si salva per quel livello.

Alla radice i cerchi sono i requisiti del cliente che hai portato sulla lavagna. Un requisito cliente ritirato ha il cerchio grigio tratteggiato; uno modificato dall'ultimo import ha un segno sul cerchio finché non lo segni come visto (vedi [Requisiti cliente](06-requisiti-cliente.md)).

## Fili

* **Tirare un filo**: premi su una porta o sul pin di un blocco tondo e trascina fino a un'altra porta, poi rilascia. Se i due requisiti non sono compatibili, l'app non crea il filo e ti dice il motivo ("Impossibile collegare: …").
* **Come si vedono**: colorati per classe; **tratteggiati** quelli fra interfacce, **continui** quelli fra capacità, **puntinati** le derivazioni dai blocchi tondi. A metà del tratto più lungo di ogni filo fra blocchi c'è un'**etichetta** con l'ID del requisito di partenza e la classe; un clic sull'etichetta seleziona il filo. `Etichette` nella barra le nasconde.
* **La legenda** in basso a sinistra elenca i fili del livello per classe e le derivazioni, poi blocchi, porte libere e porte propagate. `Legenda` nella barra la nasconde.
* **Selezionare un filo**: un clic sul filo (basta avvicinarsi). Diventa più spesso con un alone e l'ispettore mostra il dettaglio del collegamento (vedi sotto).
* **Percorso automatico**: un filo senza snodi non passa mai sotto i blocchi. L'app lo fa girare intorno ai blocchi e ai blocchi tondi con tratti orizzontali e verticali, scegliendo il percorso con meno curve, e lo ricalcola quando sposti un blocco. Ogni porta esce dal suo lato. Due fili che vanno alla stessa porta possono condividere l'ultimo tratto.
* **Aggiungere uno snodo**: doppio clic su un punto del filo. Su un filo automatico il doppio clic lo trasforma in un filo *a mano*: tiene gli angoli che aveva più il nuovo snodo, così il disegno non salta. Lo snodo è un pallino che puoi trascinare per dare al filo la forma che vuoi; un filo a mano non cambia più da solo.
* **Tornare al percorso automatico**: `↻ Reinstrada` nel dettaglio del filo toglie i suoi snodi; `↻ Reinstrada` nel riquadro Instradamento li toglie da tutti i fili del livello, dopo una conferma. Si annulla con `Ctrl+Z` come ogni modifica.
* **Togliere uno snodo**: doppio clic sullo snodo.
* **Eliminare un filo**: clic destro sul filo e conferma, oppure dal pulsante dell'ispettore dei collegamenti.

## La riga di aiuto

In basso a destra della lavagna c'è una riga che ricorda i gesti che non hanno un pulsante:

> Trascina da una porta (■) a un'altra per collegare · Shift+trascina una porta per portarla sull'altro lato · Doppio clic su un filo: aggiungi snodo · Clic destro su un filo: elimina · Doppio clic su un blocco: entra · Rotella: zoom

La riga non blocca i clic sulla lavagna. Se non ti serve più, chiudila con `✕`: l'app se lo ricorda anche le volte successive.

## Ispettore dei collegamenti

Quando selezioni un filo, la colonna destra mostra il titolo `Collegamento` e:

* la **Relazione**: `Derivazione padre → figlio` se il filo parte da un blocco tondo, altrimenti `Collegamento tra blocchi`;
* due sezioni, `Padre` e `Figlio` per una derivazione, `Da` e `A` per un collegamento tra blocchi. Ciascuna riporta ID (per un requisito cliente l'ID del cliente), Titolo, Blocco (per una porta propagata anche il percorso dei blocchi interni, `Centralina › Alimentatore`), Classe, Metodo di verifica e i Testi da esportare con il loro documento.

Se un estremo non esiste più (blocco sparito, requisito cancellato) la sua sezione dice `Requisito non trovato: <id>`. Se il filo non rispetta più le regole di collegamento, o una sua porta propagata non sale più, sotto la Relazione compare `⚠️` con il motivo.

Il pulsante `↻ Reinstrada` toglie gli snodi messi a mano (è spento se il filo è già automatico). Il pulsante `🗑 Elimina collegamento` chiede conferma e toglie il filo. Un clic su un blocco, sullo sfondo o su `+ Nuovo Blocco`, oppure entrare o uscire da un livello, toglie la selezione del filo.

## L'ispettore in generale

La colonna destra cambia contenuto secondo quello che hai selezionato:

| Selezione | Cosa vedi |
|---|---|
| Niente | "Seleziona un blocco o creane uno nuovo..." |
| Un blocco sulla lavagna, nella libreria o in una tabella | Il form del blocco di libreria (vedi [Libreria](04-libreria.md)) |
| `+ Nuovo Blocco` o `+ Blocco` | Il form vuoto per creare un blocco |
| Un requisito cliente (riga della scheda Cliente o cerchio sulla lavagna) | Il suo dettaglio in sola lettura (vedi [Requisiti cliente](06-requisiti-cliente.md)) |
| Un filo | Il dettaglio del collegamento, qui sopra |

## Tasti

| Tasto | Effetto |
|---|---|
| `Ctrl+Z` | Annulla l'ultima modifica al progetto |
| `Ctrl+Y` oppure `Ctrl+Shift+Z` | Ripeti |
| `Shift` + trascina una porta | Porta la porta (o il pin di una capacità) sull'altro lato del blocco |
| `Invio` in `Trova blocco…` | Centra e seleziona il blocco |
| `Esc` | Con la Gerarchia accesa, toglie il requisito scelto |

Annulla, Ripeti ed Esc non agiscono mentre scrivi in un campo di testo o mentre è aperta una finestra (Apri, Changelog, Import cliente, Matrice, Documenti), così non cambi nulla per sbaglio dietro la finestra.
