# 0004. Controllo di coerenza: contesto, opzioni e ragionamento

Decision record della spec [0004](index.md). `/develop` costruisce da `index.md`; questo file spiega il perché.

## Context

Dopo la spec 0003 il modello ha una catena completa: i requisiti cliente sono i padri della radice, e ogni blocco aperto ha i suoi requisiti come padri del livello interno (i blocchi tondi). La tracciabilità si costruisce tirando fili di derivazione da un padre al requisito di un blocco figlio. Con migliaia di requisiti cliente e blocchi annidati su più livelli, non c'è oggi nessun modo di sapere cosa è rimasto scoperto: la scheda Cliente conta i cliente senza fili, ma niente guarda dentro i blocchi.

Le forze in gioco: il modello è un albero di `internal_graph` per istanza (lo stesso blocco di libreria usato due volte ha due interni separati), quindi un buco va trovato e mostrato per istanza, con il suo percorso. Il renderer ridisegna tutto a ogni `render()`, anche a ogni movimento del mouse durante un trascinamento, e non esiste un bus di eventi: chi vuole sapere che il modello è cambiato ha solo `render()`. L'app è un solo utente in locale, senza build e senza dipendenze, e ogni modifica al modello finisce su disco con l'autosalvataggio della spec 0001, quindi un controllo che scrivesse nel modello creerebbe versioni e passi di Annulla.

Alcuni difetti oggi sono invisibili: un blocco il cui tipo è sparito dalla libreria non si disegna, e un filo con un estremo che non esiste più non si disegna. Restano nel file senza che tu lo sappia.

Senza questa funzionalità il progettista scopre i buchi solo quando genera la matrice o i documenti (voci 6 e 7), cioè troppo tardi e senza un modo per arrivare al punto da sistemare.

## Options considered

### Option 1: Calcolo puro dal vivo in un modulo nuovo, evidenze nel renderer, scheda nel pannello

`js/coerenza.js` espone una funzione pura che visita tutto il modello e restituisce i problemi e gli indici per il disegno. `render()` la chiama a modalità accesa; renderer e scheda Coerenza leggono il risultato.

**Pros**:
- Il report non mente mai: è sempre il modello di adesso.
- Una sola fonte di verità per scheda, pulsante, contatori ed evidenze.
- Nessun punto di mutazione da toccare: basta che tutto passi già per `render()`, ed è la regola del progetto.
- Funzione pura, facile da provare con modelli costruiti a mano.

**Cons**:
- Rifà la visita a ogni `render()`, anche durante il trascinamento; serve tenerla lineare e misurarla.
- Il renderer impara un concetto in più (alone e contatore).

### Option 2: Istantanea al clic in `#reportModal`

Il pulsante calcola una volta e apre la finestra già condivisa da Apri e Changelog con l'elenco; le evidenze restano fino al prossimo clic.

**Pros**:
- La più semplice: nessun costo durante il lavoro, nessuna scheda nuova.
- Riusa una finestra che esiste.

**Cons**:
- Dopo ogni correzione l'elenco e le evidenze sono vecchi finché non ripremi.
- La finestra copre il canvas: per ogni voce la chiudi, sistemi, la riapri.
- `#reportModal` è già condivisa da due usi; un terzo con stato proprio (gruppi aperti, ricerca) la complica.

### Option 3: Indice incrementale aggiornato a ogni modifica

Un indice dei collegamenti per requisito aggiornato da ogni punto che cambia il modello (filo tirato, filo eliminato, blocco aggiunto, Salva della libreria, import, Annulla).

**Pros**:
- Costo per modifica minimo, anche su modelli molto grandi.

**Cons**:
- Senza bus di eventi va toccato ogni punto di mutazione, in sei moduli; uno dimenticato e l'indice diverge in silenzio.
- Annulla, Ripeti e Ricarica sostituiscono il modello intero: lì l'indice va comunque ricostruito da zero.
- Ottimizza un costo che nessuno ha misurato.

## Rationale

L'Option 1 vince perché il progettista usa il controllo mentre lavora: tira un filo e vuole vedere la voce sparire. Un'istantanea (Option 2) rende il report sbagliato proprio nel momento in cui lo usi, e la finestra sopra il canvas spezza il giro "leggo la voce, vado, sistemo". La scheda nel pannello sinistro segue lo schema già collaudato della scheda Cliente: ridisegno una volta per fotogramma e solo se si vede.

L'indice incrementale (Option 3) è la risposta giusta a un problema che non c'è. La visita è lineare (livelli, blocchi, requisiti, fili, con mappe per gli estremi) e, con le dimensioni attese (migliaia di requisiti cliente, centinaia di blocchi), resta nell'ordine dei millisecondi; in cambio l'Option 3 chiede di toccare ogni punto di mutazione in un codice che non ha un bus di eventi, e diverge alla prima dimenticanza. Se `/check verify` misura scatti nel trascinamento, il primo rimedio (calcolo una volta per fotogramma) resta dentro l'Option 1.

Le regole (solo derivazione conta come padre, il ritirato non è un padre, un filo non valido non conta, i livelli vuoti non producono voci "senza figli") vengono dalle risposte del progettista e riusano `verificaCompatibilita()` e `isDerivazione()` di `model.js`, così il controllo non può dare un verdetto diverso dall'editor. Il filtro per classe è applicato in un solo punto (`problemiFiltrati()`, da cui la scheda aggiunge solo la ricerca) per lo stesso motivo: quattro viste dello stesso risultato non devono poter divergere.

Il controllo incrociato con un altro modello ha trovato 15 lacune (funzioni non esportate, il pulsante con stile scritto nel tag, libreria non caricata, riferimenti al modello che Annulla rende vecchi, ridisegno della scheda durante il trascinamento). Il progettista ha accettato le soluzioni consigliate, ora scritte in `index.md`. Il revisore suggeriva anche di togliere ricerca e contatore dalla prima versione; sono rimasti perché li ha scelti il progettista e con migliaia di requisiti cliente la ricerca serve davvero.
