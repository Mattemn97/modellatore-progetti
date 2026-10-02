# 1. Concetti di base

Prima di usare l'app ti conviene avere chiare poche idee. Tutto il resto della guida le dà per note.

## L'idea in una frase

Descrivi il sistema come blocchi dentro blocchi (come le matriosche). Ogni blocco ha dei requisiti. Un filo tra due requisiti dice che uno deriva dall'altro, oppure che due blocchi si parlano attraverso un'interfaccia. Seguendo i fili dall'alto in basso ottieni la tracciabilità completa, dal cliente fino al componente più piccolo.

## Libreria e progetto

L'app tiene separate due cose:

* **La libreria** è il catalogo dei blocchi riutilizzabili. Ogni blocco ha un id, un titolo, una descrizione, una categoria, una sottocategoria e un elenco di requisiti. La libreria è un file in `shared/` e può servire più progetti.
* **Il progetto** è il modello di un sistema concreto: quali blocchi usi, dove stanno, come sono collegati, cosa c'è dentro ciascuno, e i requisiti del cliente. È un file in `progetti/`.

Quando trascini un blocco dalla libreria sul canvas crei un'**istanza**. Le istanze di uno stesso blocco condividono i requisiti: se cambi un requisito nella libreria, cambia in tutte le istanze. Ogni istanza ha però la sua etichetta, la sua posizione e il suo contenuto interno.

## I due tipi di requisito

Ogni requisito ha un id univoco (unico in tutta la libreria), un titolo, un metodo di verifica e zero o più testi da esportare. Poi c'è la differenza che conta di più:

| | Requisito di interfaccia | Requisito di capacità |
|---|---|---|
| Quando | Ha una **tipologia** (es. Elettrica, Segnale, Meccanica, Fluidica) | Non ha tipologia |
| Cosa descrive | Uno scambio con l'esterno: alimentazione, segnali, collegamenti meccanici o di fluidi | Una cosa che il blocco sa fare |
| Come appare | Una **porta** tonda sul bordo del blocco, del colore della tipologia; puoi spostarla lungo il bordo | Un **pin quadrato** viola dentro il rettangolo del blocco |

La tipologia (oppure "Capacità" quando manca) si chiama **classe** del requisito. Tipologie e colori sono definiti in `settings.json`, quindi puoi aggiungerne di tue.

## Livelli e blocchi tondi

Il canvas mostra sempre un livello alla volta.

* La **radice** è il livello più alto: lì posi i blocchi principali del sistema e i requisiti del cliente.
* Con un **doppio clic** su un blocco entri nel suo contenuto. In alto, il percorso (breadcrumb) ti dice dove sei, per esempio `Impianto / Centralina / Pompa`, e ti permette di risalire con un clic su un livello.

Quando entri in un blocco, i suoi requisiti diventano **blocchi tondi** (cerchi) sul canvas interno. Sono i "padri" del livello: da lì tiri i fili verso i requisiti dei blocchi che metti dentro. Così un requisito della Centralina scende ai requisiti della Pompa e del Sensore che la compongono.

Alla radice i blocchi tondi sono i **requisiti del cliente**, che importi da Excel o CSV e trascini sul canvas.

## Due tipi di filo

| Filo | Tra cosa | Significato |
|---|---|---|
| **Derivazione** | Da un blocco tondo (padre) al requisito di un blocco del livello (figlio) | Il requisito figlio deriva dal padre. È la relazione che costruisce la tracciabilità. |
| **Collegamento tra blocchi** | Tra due requisiti di due blocchi dello stesso livello | I due blocchi si parlano attraverso quell'interfaccia. Non crea un rapporto padre e figlio. |

## Le regole di collegamento

Un filo è valido solo tra requisiti della **stessa classe**:

* interfaccia con interfaccia della stessa tipologia (Elettrica con Elettrica, Segnale con Segnale…);
* capacità con capacità.

Se provi a collegare due requisiti di classe diversa, l'app rifiuta il filo e ti dice perché. Due requisiti cliente non si collegano tra loro, e un requisito cliente ritirato non accetta fili nuovi.

Se una modifica successiva rende un filo non più valido (per esempio cambi la tipologia di un requisito), l'app lo toglie quando salvi il blocco, oppure te lo segnala nel controllo di coerenza come filo "da riparare".

## Occorrenze

Siccome lo stesso blocco può comparire più volte, lo stesso requisito può stare in più punti del modello. Un **requisito in un'istanza precisa** si chiama occorrenza ed è identificato dal percorso dei blocchi dalla radice. Due istanze della stessa Pompa danno due rami separati nella gerarchia: una può essere coperta e l'altra no.

Gerarchia e Coerenza ragionano per occorrenza. La Matrice di tracciabilità invece raggruppa per id del requisito e ti dice in quante istanze vale una certa coppia padre e figlio.

## Testi da esportare e documenti

A ogni requisito di libreria puoi associare uno o più **testi da esportare**. Ogni testo ha un documento di destinazione (SSS, SSDD, IRS, IDD, SRS, SDD, o altri che aggiungi). Quando generi un documento, l'app raccoglie i testi destinati a quel documento e li mette nel capitolo giusto secondo lo schema MIL-STD-498: le capacità in un capitolo, le interfacce in un altro, i metodi di verifica nelle disposizioni di qualifica, i padri nel capitolo di tracciabilità.

Lo stesso requisito può quindi avere un testo per l'SSS e un altro, più tecnico, per l'IRS.

## Cosa si salva e cosa no

* Tutto quello che cambia il modello (blocchi, fili, porte, snodi, requisiti cliente) si salva da solo nel file del progetto.
* Le modifiche alla libreria si salvano quando premi il pulsante di salvataggio nell'ispettore.
* Tutto quello che cambia solo la vista (zoom, spostamento, livello aperto, filtri, modalità Coerenza e Gerarchia, finestre aperte, selezione) non si salva e non consuma versioni.
