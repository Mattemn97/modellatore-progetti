# 0005. Gerarchia dei requisiti: contesto, opzioni e ragionamento

Decision record della spec [0005](index.md). `/develop` costruisce da `index.md`; questo file spiega il perché.

## Context

Con le spec 0003 e 0004 il modello ha una catena di tracciabilità completa e controllata: i requisiti cliente sono i padri della radice, ogni blocco aperto ha i suoi requisiti come padri del livello interno (i blocchi tondi), e la Coerenza dice cosa è scoperto. Manca la vista opposta: partire da un requisito e vedere tutta la sua catena, verso l'alto fino al cliente e verso il basso fino ai livelli più profondi. Oggi per seguirla devi entrare e uscire dai blocchi a mano e ricordarti i fili livello per livello.

La forza principale è la struttura del modello. Un blocco di libreria è condiviso per tipo (i suoi requisiti hanno gli stessi id in ogni istanza), ma ogni istanza ha il suo `internal_graph` e i suoi fili. Due Pompe dello stesso tipo possono derivare da clienti diversi e scendere in blocchi diversi. Un id di requisito da solo quindi non basta a dire "dove" sta un requisito nella catena: lo scope lo segnalava come la decisione da prendere.

Altre forze: il renderer ridisegna tutto a ogni `render()`, anche a ogni movimento del mouse, e non c'è un bus di eventi; ogni modifica al modello va su disco con l'autosalvataggio (spec 0001), quindi una vista non deve mai scrivere nel modello; la Coerenza contiene già una visita del modello che risolve gli estremi dei fili e decide cosa è una derivazione valida. Premere su un pin oggi inizia un filo, quindi scegliere un requisito sul canvas deve convivere con il disegno dei fili.

Senza questa funzionalità la Matrice (voce 6) e l'export MIL-STD-498 (voce 7) non hanno una definizione condivisa di "padre di un requisito" quando ci sono istanze multiple, e ognuna rischierebbe di inventarne una.

## Options considered

### Option 1: Indice completo delle occorrenze, rifatto una volta per fotogramma, su una visita condivisa

Una funzione pura visita tutto il modello (la stessa visita della Coerenza, spostata in `model.js`) e costruisce un indice di tutte le occorrenze con padri e figli. La catena del requisito scelto si ricava dall'indice; renderer e scheda la leggono.

**Pros**:
- Una sola definizione di filo valido e di derivazione per Coerenza, Gerarchia e Matrice.
- "La scelta non c'è più" e "la scelta segue il modello" vengono gratis: basta cercare la chiave nell'indice di adesso.
- Stesso schema, già verificato, della Coerenza: calcolo puro, risultato in variabili del modulo, scheda una volta per fotogramma.
- L'indice è già quello che servirà alla Matrice.

**Cons**:
- Visita completa una volta per fotogramma a modalità accesa, anche quando la catena è piccola.
- Spostare la visita tocca `coerenza.js`, che è già verificato.

### Option 2: Ricerca locale attorno al requisito scelto

Niente indice: si parte dalla scelta e si risale (fili del livello dove sta il pin) e si scende (fili del livello interno del blocco), livello per livello, solo lungo la catena.

**Pros**:
- Costo proporzionale alla catena, non al modello.
- Non tocca `coerenza.js`.

**Cons**:
- Una seconda logica di risoluzione degli estremi, che può dare un verdetto diverso dalla Coerenza.
- La Matrice avrà comunque bisogno di visitare tutto: si scrive due volte la stessa cosa.
- Capire se la scelta esiste ancora richiede una risoluzione del percorso a parte.

### Option 3: Gerarchia salvata nel file del progetto

Ogni requisito tiene nel modello l'elenco dei suoi padri e figli, aggiornato a ogni filo tirato o tolto.

**Pros**:
- Lettura immediata, nessun calcolo a ogni `render()`.
- Leggibile anche fuori dall'app, nel JSON.

**Cons**:
- Un valore derivato salvato invecchia: ogni punto che cambia fili, blocchi o libreria deve aggiornarlo, e senza un bus di eventi sono molti.
- Ogni aggiornamento è una scrittura su disco e un passo di Annulla per una cosa che è solo una vista.
- Un file modificato a mano o un `Salva` della libreria lo rendono falso senza che te ne accorga.

## Rationale

L'opzione 1 vince per la forza principale del contesto: serve una definizione unica di "padre" che regga le istanze multiple, e che Coerenza, Gerarchia, Matrice ed export condividano. Spostare la visita in `model.js` costa un intervento su codice già verificato, ma è l'unico modo per avere quella definizione in un punto solo; l'alternativa (opzione 2) è più economica oggi e crea due verità domani, proprio quando arriva la Matrice. Il costo della visita completa è già misurato per la Coerenza sullo stesso volume di AC-11, e il rimedio se scatta è noto.

L'opzione 3 va contro due regole del progetto: le viste non scrivono nel modello (ogni scrittura diventa una versione e un passo di Annulla) e non c'è un bus di eventi per tenere aggiornato un valore derivato. Calcolare a ogni lettura è più semplice e non può mentire.

L'unità della gerarchia è l'occorrenza (requisito più percorso dell'istanza), scelta nella conversazione. Coincide con come il modello è fatto davvero (fili e interni sono per istanza) e con come la Coerenza già valuta ogni istanza a sé. Far coincidere il pin di un blocco con il blocco tondo dello stesso requisito dentro quel blocco è ciò che collega i livelli: senza questa identità la catena si fermerebbe a ogni bordo di blocco.

Le altre scelte seguono la stessa linea: modalità esclusiva con la Coerenza, perché due evidenze sovrapposte e un clic con due significati rendono il canvas illeggibile; scelta con premi e rilascia sullo stesso pin, che oggi non fa nulla, così il disegno dei fili resta com'è e la vista si aggiorna mentre colleghi; catena che ignora il filtro per classe, perché le regole di collegamento la rendono tutta di una classe e attenuarla per un filtro diverso nasconderebbe proprio quello che hai chiesto di vedere.
