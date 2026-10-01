# 0006. Matrice di tracciabilità: decisione e ragioni

## Context

La voce 6 dello scope chiede una tabella padre → figli con i documenti di ciascun lato, a video e in Markdown, filtrabile per documento, che segnali i padri senza figli. Il pulsante `#btnReqMatrix` esiste in `index.html` da prima di questo flusso, senza gestore.

Le forze in gioco:
- **L'unità è l'occorrenza, i documenti no.** La spec 0005 ha deciso che la gerarchia è per istanza (un requisito in un punto preciso del modello), e ha costruito `calcolaGerarchia()`, l'indice completo delle occorrenze. Ma testi da esportare, documenti e metodo di verifica stanno nel requisito di libreria, uguali in ogni istanza. Una tabella pensata per i documenti (e per l'export MIL-STD-498 della voce 7) ragiona per id; una pensata per il modello ragiona per istanza. La spec 0005 ha lasciato aperta questa scelta.
- **Tre strumenti, una verità.** Coerenza (0004) e Gerarchia (0005) condividono `visitaDerivazioni()`. Se la matrice decidesse da sé cosa è un padre, un filo o un "senza figli", i tre strumenti potrebbero dire cose diverse sullo stesso modello.
- **Volumi.** L'import cliente prevede migliaia di requisiti (AC-11 della 0005 usa 3000 cliente e 200 blocchi): la tabella può arrivare a decine di migliaia di righe.
- **Vincoli del progetto.** Niente build, niente npm, un utente in locale, `start.py` come unico server; la vista non deve finire nel file del progetto (convenzione di `js/AGENTS.md`).

## Options considered

### Option 1: Matrice per id sopra l'indice della Gerarchia, calcolata all'apertura, finestra dedicata

`calcolaMatrice()` in `js/matrice.js` raggruppa per id l'indice di `calcolaGerarchia()` (esteso con i blocchi che hanno contenuto), calcola i problemi istanza per istanza, e tiene il risultato finché la finestra è aperta. Export generato nel browser.

**Pros**:
- Una sola visita e una sola regola di padre e figlio per tre strumenti.
- Le righe per id combaciano con documenti e testi, e con la voce 7.
- Nessun cambiamento al server o al formato del file.

**Cons**:
- Dipende da `gerarchia.js` (un import in più nel ciclo) e ne estende l'indice.
- Per id si perde a vista quale istanza dà quale coppia: compensato da Istanze, suggerimento e clic.

### Option 2: Visita propria in `matrice.js`

La matrice usa direttamente `visitaDerivazioni()` con un suo osservatore, senza passare dall'indice delle occorrenze.

**Pros**:
- Nessuna dipendenza da `gerarchia.js`, codice indipendente.

**Cons**:
- Ricostruisce chiavi delle occorrenze, padri e figli già calcolati nella 0005: due implementazioni della stessa logica che possono divergere.
- Il clic verso la Gerarchia avrebbe comunque bisogno delle chiavi della 0005.

### Option 3: Matrice generata dal server

`start.py` legge il file del progetto e la libreria, costruisce la matrice e scrive il `.md` in `progetti/`.

**Pros**:
- Il file resta accanto al progetto; si potrebbe generare anche senza aprire l'app.

**Cons**:
- Le regole del modello (compatibilità, derivazione, risoluzione degli estremi) vivono in JavaScript: andrebbero riscritte in Python e tenute allineate.
- Rotta nuova, sovrascritture da decidere, e la vista a video dovrebbe comunque essere fatta nel client.

### Option 4: Righe per occorrenza

Come l'Option 1, ma una riga per ogni filo di derivazione con il percorso dell'istanza.

**Pros**:
- Fedele alla Gerarchia: ogni riga dice esattamente dove sta.

**Cons**:
- Due istanze dello stesso blocco ripetono le stesse righe con gli stessi documenti: la tabella si allunga senza informazione nuova per i documenti.
- Per la voce 7 servirebbe comunque un raggruppamento per id.

## Rationale

L'Option 1 tiene insieme le due forze principali: riusa la visita e l'indice che già decidono padre e figlio per Coerenza e Gerarchia (nessuna seconda regola da tenere allineata), e presenta i dati alla grana dei documenti, che è quella che la matrice e la voce 7 devono servire. I problemi restano per istanza (nota "in X istanze su Y"), così la vista per id non nasconde un buco che la Coerenza vedrebbe.

Il calcolo all'apertura viene dal fatto che la finestra copre il canvas: il modello non può cambiare mentre la guardi, quindi una fotografia basta e costa una sola visita lineare, già misurata nella 0005 sui volumi attesi. Il limite di gruppi a video (con l'export sempre completo) tiene la finestra veloce senza la complessità dello scorrimento virtuale. Il download dal browser con `Blob` evita una rotta nuova e regge file grandi, dove l'URL `data:` di `downloadJsonFile()` rischia di essere troncato.

La forma raggruppata per padre l'ha scelta l'ingegnere al posto dell'elenco piatto di coppie che avevo proposto: a video si legge meglio, e il costo in Markdown (celle multiriga) è risolto scrivendo il padre solo sulla prima riga del gruppo, così il file resta una tabella vera.

## Decisioni prese nella conversazione

- Riga = coppia di id, istanze unite, con colonna Istanze (proposta accettata).
- Forma raggruppata per padre (scelta dell'ingegnere al posto dell'elenco piatto).
- Finestra grande dedicata, non `#reportModal` né una scheda del pannello.
- Senza figli con la regola della Coerenza, segno parziale per istanza; gruppo Senza padre in fondo, anche parziale.
- Documenti del cliente = `Cliente`; filtro documento con scelta del lato.
- Markdown: tabella unica con il padre solo sulla prima riga del gruppo.
- Colonne in più: Blocco (titolo di libreria, percorsi nel suggerimento), Istanze, Classe, Metodo di verifica.
- Ordine: cliente, poi livello, poi id; clic verso la Gerarchia sull'istanza.
- Filtri: documento e lato, ricerca, classe; limite di gruppi con "Mostra altri"; export = ciò che vedi, filtri compresi, tutte le righe.
- Calcolo all'apertura; nessuna sezione References.
