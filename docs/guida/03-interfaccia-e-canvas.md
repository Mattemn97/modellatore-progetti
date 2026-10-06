# 3. Interfaccia e canvas

## Com'è fatta la finestra

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Indietro  Impianto / Centralina     [Salvato] ↶ Annulla ↷ Ripeti Progetto ▾│  header
├───────────────────────────────────────────────────────────────────────────┤
│ banner (solo quando c'è un errore, un conflitto o un avviso)              │
├──────────────┬───────────────────────────────────────┬────────────────────┤
│ Libreria     │ ☰ Libreria  🔎 Filtri  📊 Matrice  ...  ☰ Proprietà         │
│ Cliente      │                                       │ Ispettore &        │
│ (Coerenza)   │            canvas                     │ Gestione           │
│ (Gerarchia)  │                                       │ + Nuovo Blocco     │
│              │ riga di aiuto                     ✕   │                    │
└──────────────┴───────────────────────────────────────┴────────────────────┘
```

* **Header**: a sinistra il pulsante `← Indietro` (compare quando sei dentro un blocco) e il percorso dei livelli aperti. A destra il badge del salvataggio, `↶ Annulla`, `↷ Ripeti` e il menu `Progetto ▾`. Li trovi spiegati in [Progetti](05-progetti.md).
* **Banner**: una striscia sotto l'header che compare solo quando c'è qualcosa da sapere (salvataggio fallito, conflitto, avviso sulla libreria).
* **Colonna sinistra**: le schede `Libreria` e `Cliente`, più `Coerenza` e `Gerarchia` quando accendi quelle modalità.
* **Colonna centrale**: la barra degli strumenti e il canvas.
* **Colonna destra**: l'ispettore, dove vedi e modifichi quello che hai selezionato.

I pulsanti `☰ Libreria` e `☰ Proprietà` ai lati della barra chiudono e riaprono le due colonne laterali, se vuoi più spazio per il canvas.

## La barra degli strumenti

| Pulsante | Cosa fa | Capitolo |
|---|---|---|
| `🔎 Filtri` | Apre il pannello dei filtri del canvas | [Filtri](07-filtri.md) |
| `📊 Matrice Requisiti` | Apre la matrice di tracciabilità | [Matrice](10-matrice.md) |
| `📄 Documenti` | Apre la generazione dei documenti MIL-STD-498 | [Documenti](11-documenti.md) |
| `⚠️ Verifica Coerenza` | Accende o spegne il controllo di coerenza | [Coerenza](08-coerenza.md) |
| `🌳 Gerarchia` | Accende o spegne la vista della gerarchia | [Gerarchia](09-gerarchia.md) |
| `🖼 Immagine` | Scarica il livello aperto come immagine SVG o PNG | qui sotto |
| `🔍 Reset Vista` | Riporta zoom e spostamento ai valori iniziali | qui sotto |

## L'immagine di un livello

`🖼 Immagine` apre un menu con **SVG** (vettoriale, nitido a ogni zoom, si apre anche in un browser o in Inkscape) e **PNG** (un'immagine normale, al doppio della risoluzione dello schermo). Scarica il livello aperto come `<progetto>-<livello>.svg` o `.png` (`radice` per il livello principale). L'immagine mostra blocchi, porte, fili con gli snodi e blocchi tondi, senza filtri, evidenze o selezione. Su un livello vuoto l'app ti dice che non c'è niente da esportare.

Gli stessi diagrammi entrano da soli nei documenti Word e PDF (vedi [Documenti](11-documenti.md)).

## Muoversi sul canvas

* **Zoom**: rotella del mouse. Lo zoom si centra sul punto sotto il cursore e va da 0,3 a 3 volte.
* **Spostare la vista** (pan): trascina lo sfondo vuoto con il tasto sinistro, oppure trascina ovunque tenendo premuto il tasto centrale (la rotella).
* **Tornare alla vista iniziale**: `🔍 Reset Vista`.

Zoom e spostamento sono solo vista: non si salvano nel progetto.

## La libreria a sinistra

La scheda `Libreria` mostra il catalogo dei blocchi, raggruppato per categoria e poi per sottocategoria. Sopra trovi:

* la versione della libreria (es. `v1.3.0`) e il pulsante `📜 Changelog`;
* il campo `Percorso / URL Libreria` con il pulsante `🔄`, per caricare un'altra libreria;
* il campo `🔍 Cerca nella libreria...` che filtra l'elenco mentre scrivi.

Un clic su un blocco dell'elenco lo apre nell'ispettore per modificarlo. Tutto quello che riguarda la libreria è spiegato in [Libreria](04-libreria.md).

## Posare e gestire i blocchi

* **Aggiungere un blocco**: trascinalo dalla libreria sul canvas. Cade centrato sotto il cursore, con l'angolo agganciato alla griglia, a qualsiasi zoom.
* **Selezionare**: un clic sul blocco. Il bordo diventa blu e l'ispettore mostra il blocco di libreria da cui viene.
* **Spostare**: trascina il blocco. La posizione si aggancia alla griglia (20 pixel per impostazione).
* **Ridimensionare**: trascina il quadratino nell'angolo in basso a destra del blocco.
* **Entrare**: doppio clic sul blocco. Vedi il suo contenuto, con i suoi requisiti come blocchi tondi.
* **Risalire**: `← Indietro`, oppure un clic su un livello del percorso nell'header.
* **Togliere un blocco dal canvas**: selezionalo e, nell'ispettore, premi `🗑️ Elimina Blocco dal Grafico` e conferma. Il blocco resta in libreria; sparisce solo questa istanza, con il suo contenuto e i suoi fili.
* **Deselezionare**: un clic sullo sfondo vuoto.

Se passi il mouse sopra un blocco vedi la sua descrizione; sopra un pin o una porta vedi id, titolo e classe del requisito.

Se il progetto contiene un blocco il cui tipo non esiste più nella libreria aperta, quel blocco non viene disegnato. Il controllo di coerenza te lo segnala come "Da riparare".

## Porte e pin

* Le **porte** (requisiti di interfaccia) stanno sul bordo del blocco, colorate secondo la tipologia. Per spostarne una lungo il bordo, **tieni premuto Shift e trascinala**: con Shift premuto il cursore sopra la porta diventa la freccia di spostamento.
* I **pin quadrati** viola (requisiti di capacità) stanno dentro il rettangolo del blocco.
* Senza Shift, trascinare da una porta o da un pin serve a tirare un filo.

## Blocchi tondi

Dentro un blocco ogni suo requisito è un cerchio, del colore della sua classe, con un pin per tirare i fili. Puoi trascinare i cerchi dove ti è comodo: la loro posizione si salva per quel livello.

Alla radice i cerchi sono i requisiti del cliente che hai portato sul canvas. Un requisito cliente ritirato ha il cerchio grigio tratteggiato; uno modificato dall'ultimo import ha un segno sul cerchio finché non lo segni come visto (vedi [Requisiti cliente](06-requisiti-cliente.md)).

## Fili

* **Tirare un filo**: premi su un pin, una porta o il pin di un blocco tondo e trascina fino a un altro pin, poi rilascia. Se i due requisiti non sono compatibili, l'app non crea il filo e ti dice il motivo ("Impossibile collegare: …").
* **Selezionare un filo**: un clic sul filo. Diventa più spesso con un alone blu e l'ispettore mostra il dettaglio del collegamento (vedi sotto).
* **Aggiungere uno snodo**: doppio clic su un punto del filo. Lo snodo è un pallino che puoi trascinare per dare al filo la forma che vuoi.
* **Togliere uno snodo**: doppio clic sullo snodo.
* **Eliminare un filo**: clic destro sul filo e conferma, oppure dal pulsante dell'ispettore dei collegamenti.

## La riga di aiuto

In basso a sinistra del canvas c'è una riga che ricorda i gesti che non hanno un pulsante:

> Shift+trascina una porta per spostarla lungo il bordo · Doppio clic su un filo: aggiungi snodo · Clic destro su un filo: elimina · Doppio clic su un blocco: entra

La riga non blocca i clic sul canvas. Se non ti serve più, chiudila con `✕`: il browser se lo ricorda anche le volte successive.

## Ispettore dei collegamenti

Quando selezioni un filo, la colonna destra mostra il titolo `Collegamento` e:

* la **Relazione**: `Derivazione padre → figlio` se il filo parte da un blocco tondo, altrimenti `Collegamento tra blocchi`;
* due sezioni, `Padre` e `Figlio` per una derivazione, `Da` e `A` per un collegamento tra blocchi. Ciascuna riporta ID (per un requisito cliente l'ID del cliente), Titolo, Blocco, Classe, Metodo di verifica e i Testi da esportare con il loro documento.

Se un estremo non esiste più (blocco sparito, requisito cancellato) la sua sezione dice `Requisito non trovato: <id>`. Se il filo non rispetta più le regole di collegamento, sotto la Relazione compare `⚠️` con il motivo.

Il pulsante `🗑 Elimina collegamento` chiede conferma e toglie il filo. Un clic su un blocco, sullo sfondo o su `+ Nuovo Blocco`, oppure entrare o uscire da un livello, toglie la selezione del filo.

## L'ispettore in generale

La colonna destra cambia contenuto secondo quello che hai selezionato:

| Selezione | Cosa vedi |
|---|---|
| Niente | "Seleziona un blocco o creane uno nuovo..." |
| Un blocco sul canvas o nella libreria | Il form del blocco di libreria (vedi [Libreria](04-libreria.md)) |
| `+ Nuovo Blocco` | Il form vuoto per creare un blocco |
| Un requisito cliente (riga della scheda Cliente o cerchio sul canvas) | Il suo dettaglio in sola lettura (vedi [Requisiti cliente](06-requisiti-cliente.md)) |
| Un filo | Il dettaglio del collegamento, qui sopra |

## Tasti

| Tasto | Effetto |
|---|---|
| `Ctrl+Z` | Annulla l'ultima modifica al progetto |
| `Ctrl+Y` oppure `Ctrl+Shift+Z` | Ripeti |
| `Shift` + trascina una porta | Sposta la porta lungo il bordo |
| `Esc` | Con la Gerarchia accesa, toglie il requisito scelto |

Annulla, Ripeti ed Esc non agiscono mentre scrivi in un campo di testo o mentre è aperta una finestra (Apri, Changelog, Import cliente, Matrice, Documenti), così non cambi nulla per sbaglio dietro la finestra.
