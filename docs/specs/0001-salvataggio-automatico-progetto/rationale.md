# 0001. Salvataggio automatico del progetto: ragionamento

Decision record della spec [index.md](index.md). `/develop` non lo legge.

## Context

> ⚠️ Premise note: il salvataggio automatico rende permanente anche un errore entro un secondo, e l'editor non ha un annullamento. Senza una rete di sicurezza la funzionalità aumenterebbe il rischio invece di ridurlo. Per questo le 3 versioni annullabili fanno parte della stessa decisione, non di una successiva. Inoltre questa funzionalità presuppone che la libreria venga salvata su disco (funzionalità 2, senza spec): finché non c'è, il progetto su disco e la libreria su disco possono disallinearsi.

Oggi il modello vive solo in memoria nel browser. L'unico modo di conservarlo è `Esporta i 3 File`, che scarica tre JSON nella cartella Download; chiudere la scheda o un crash del browser perde tutto il lavoro dall'ultima esportazione. Lo scope vuole che "il JSON resti la fonte di verità": il file su disco deve seguire il modello, non essere una copia occasionale.

Vincoli: l'app è JavaScript puro senza build, servita da `start.py` con `http.server` della libreria standard, che oggi risponde solo a letture. Un browser non può scrivere un file arbitrario senza un permesso esplicito, quindi serve un canale di scrittura. L'app va distribuita anche come exe PyInstaller, quindi niente dipendenze aggiuntive se evitabili. Un utente, in locale, su Windows.

Il codice mutua lo stato in place e chiama `render()`, che ricostruisce tutto l'SVG e gira a ogni mousemove durante i trascinamenti. Le mutazioni sono sparse in cinque moduli (`app`, `renderer`, `inspector`, `builder`, `storage`), senza store né eventi. Qualunque rilevamento delle modifiche deve funzionare con questa struttura.

## Options considered

### Option 1: API di progetto in `start.py` (scelta)

Il `CustomHandler` esistente riceve pochi endpoint `/api/progetti` e `/api/ultimo` che leggono e scrivono solo in `progetti/`, con scrittura atomica, controllo dei conflitti e rotazione di 3 versioni. Il client salva a debounce confrontando il JSON dopo `render()`.

**Pros**:
- Funziona in qualunque browser e senza permessi da concedere a ogni sessione.
- Il server può garantire atomicità, conflitti e versioni in un solo posto.
- Solo libreria standard; l'exe resta autosufficiente.

**Cons**:
- `start.py` diventa una piccola applicazione da mantenere, con una superficie di sicurezza (va protetto da pagine web estranee).
- Senza server attivo non si salva.

### Option 2: File System Access API nel browser

Il browser chiede di scegliere il file o la cartella e ci scrive direttamente, senza toccare il server.

**Pros**:
- Nessun codice server; il server resta un semplice servitore di file.

**Cons**:
- Solo Chrome ed Edge; il permesso va riconcesso a ogni sessione, quindi "riapri l'ultimo progetto" richiede comunque un clic.
- Versioni e rilevamento dei conflitti vanno scritti in JS con un'API meno diretta di `os.replace`.

### Option 3: Un solo PUT generico per qualunque percorso

Un endpoint che scrive il file indicato dal browser; la logica di versioni e progetti resta nel client.

**Pros**:
- Il codice server più corto possibile.

**Cons**:
- Un bug o un percorso sbagliato nel client può sovrascrivere `index.html`, `settings.json` o la libreria.
- Atomicità di più passi (rotazione delle versioni) impossibile da garantire lato client.

### Option 4: Salvataggio nel browser (localStorage o IndexedDB) più esportazione manuale

Il modello si salva automaticamente nella memoria del browser; su disco va solo quando esporti.

**Pros**:
- Nessuna modifica al server, implementazione minima.

**Cons**:
- Il file su disco non è la fonte di verità, contro l'obiettivo dello scope; pulire i dati del sito o cambiare browser perde tutto.

**Sotto decisioni con alternative valutate insieme a te**: cartella fissa `progetti/` (contro percorso libero o scelta dal browser); riapertura dell'ultimo progetto (contro elenco all'avvio); `{ workspace, libraryPath }` (contro libreria incorporata); debounce di 1 s (contro intervallo fisso o scrittura immediata); confronto del JSON (contro chiamate `markDirty()` sparse); versioni su disco (contro pila in memoria); conflitti rilevati e chiesti (contro "vince l'ultima scrittura"); cestino (contro eliminazione definitiva).

## Rationale

Il vincolo decisivo è che il file su disco sia la fonte di verità in un'app distribuita come exe: solo un canale di scrittura controllato dal server lo garantisce in ogni browser e senza permessi ripetuti, e `http.server` lo permette senza nuove dipendenze (contro l'Option 2 e l'Option 4). Tenere la logica di file nel server, e non in un PUT generico (Option 3), limita il danno di un bug del client alla sola cartella `progetti/` e rende atomiche le operazioni in più passi come la rotazione delle versioni.

Il confronto del JSON dopo `render()` è scelto perché le mutazioni sono sparse in cinque moduli senza un punto comune: una chiamata `markDirty()` dimenticata perderebbe lavoro in silenzio, mentre ogni mutazione passa già da `render()` per convenzione. Il costo della serializzazione è pagato una volta per pausa, non per render.

Le versioni stanno su disco perché il rischio che coprono (un errore reso permanente dal salvataggio automatico) sopravvive a un riavvio; una pila in memoria lo coprirebbe solo finché la scheda resta aperta. Tre versioni, come hai chiesto, bastano per gli errori immediati e tengono la cartella pulita; il cestino copre il caso più grave, l'eliminazione di un intero progetto.
