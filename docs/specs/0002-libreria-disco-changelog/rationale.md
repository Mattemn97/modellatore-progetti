# 0002. Rationale: libreria su disco con versione semver e changelog

Decision record della spec [index.md](index.md). `/develop` non ha bisogno di leggerlo.

## Context

Oggi la libreria vive solo in memoria. Il `Salva` dell'ispettore riscrive `appState.library[id]` e aggiorna subito il progetto aperto (rinomine degli id dei requisiti, fili diventati non validi), ma nessun file su disco cambia: `shared/libreria.json` resta quello caricato all'avvio. Con la spec 0001 il progetto si salva da solo a ogni modifica, quindi il disallineamento è diventato concreto: se rinomini un requisito, il progetto su disco usa il nuovo id mentre la libreria su disco ha ancora il vecchio, e al riavvio quel filo punta a un requisito inesistente. 0001 lo tampona con l'indicatore `libreriaModificata` e una conferma, e rimanda la soluzione a questa funzionalità.

La libreria è il catalogo condiviso tra progetti: uno stesso blocco è usato in più progetti, e i suoi requisiti finiscono nei documenti MIL-STD-498. In un processo MBSE (ingegneria di sistema basata su modelli) serve sapere quale versione della libreria ha prodotto un documento, e se una modifica può rompere i progetti che la usano. Rimuovere un requisito, cambiarne l'id o la tipologia rompe i collegamenti; aggiungere è compatibile; correggere un testo cambia solo i documenti.

Vincoli: un solo utente in locale; nessun build step, nessuna dipendenza nuova; server `start.py` con sola libreria standard, che con 0001 ha già un'API `/api/`, scrittura atomica, impronta SHA1 per i conflitti e un lucchetto. La libreria può essere modificata anche a mano (è un JSON leggibile), da una seconda scheda o da un altro progetto che la usa. L'exe deve funzionare su una macchina qualsiasi, anche senza git. Esistono formati vecchi della libreria che solo il client sa normalizzare (`normalizzaLibreria` in `js/model.js`).

Senza decidere, ogni modifica alla libreria resta fragile (si perde alla chiusura o al cambio di progetto) e non esiste nessuna traccia di cosa è cambiato tra una versione e l'altra dei documenti.

## Options considered

### Option 1: API di libreria in `start.py`, salvataggio per blocco, confronto e versione nel server

Il client invia solo il blocco salvato con le rinomine; il server lo confronta con il disco, calcola livello e versione, scrive libreria, changelog e riferimento sotto il lucchetto, e restituisce la libreria intera. Stesso schema di 0001 (impronta, scrittura atomica, copie).

**Pros**:
- Un solo punto calcola il confronto, per le modifiche dall'app e per quelle esterne.
- `Sovrascrivi` sostituisce solo il blocco toccato: le modifiche esterne agli altri blocchi sopravvivono.
- Riusa tutta l'infrastruttura di 0001; nessuna dipendenza.

**Cons**:
- Il server deve conoscere un minimo della forma di blocchi e requisiti (id, `requisiti`, `tipologia`), cioè un secondo posto dove vive il modello dati.
- I formati vecchi richiedono che il client invii la libreria normalizzata al primo salvataggio.
- `start.py` cresce ancora.

### Option 2: il client scrive la libreria intera e calcola il changelog

Il client tiene il confronto (ha già blocco vecchio e nuovo in memoria) e invia al server la libreria intera più la voce di changelog pronta; il server fa solo scrittura atomica, impronta e copie, come un `PUT` di 0001.

**Pros**:
- Server generico e piccolo; tutta la logica del modello resta in JS, accanto a `normalizzaLibreria`.
- Nessun problema di formati vecchi.

**Cons**:
- Le modifiche esterne non possono essere confrontate dal client senza il contenuto precedente: servirebbe comunque un riferimento e un secondo codice di confronto.
- `Sovrascrivi` riscrive tutta la libreria e cancella le modifiche esterne agli altri blocchi.
- Il changelog arriva dal client: una scheda con codice vecchio può scrivere voci incoerenti.

### Option 3: storico affidato a git

Ogni `Salva` scrive la libreria e fa un commit in un repository git dentro `shared/`; il changelog è il log di git, la versione un tag.

**Pros**:
- Storico completo con i valori, confronto tra qualsiasi coppia di versioni, strumenti esterni già pronti.

**Cons**:
- Richiede git installato sulla macchina dell'utente; l'exe non lo include.
- Livello major, minor o patch e voci per requisito vanno calcolati comunque; git dà righe cambiate, non requisiti.
- Leggere il log dall'app significa lanciare processi dal server e interpretarne l'output.

### Option 4: libreria dentro il file progetto

Ogni progetto contiene la sua copia della libreria con il changelog; il file condiviso diventa solo un modello di partenza.

**Pros**:
- Progetto e libreria non possono più disallinearsi; un solo file da salvare, già coperto da 0001.

**Cons**:
- La libreria smette di essere condivisa: una correzione a un blocco va ripetuta in ogni progetto.
- Contraddice lo scope (libreria su disco con changelog versionato, riusata tra progetti).

## Rationale

La forza principale è l'allineamento tra libreria e progetto: per questo il salvataggio va prima su disco e solo dopo in memoria, e deve essere un'azione esplicita (il `Salva`) invece di un salvataggio automatico, così ogni azione diventa esattamente una voce. Tra le opzioni che rispettano questo vincolo, l'opzione 1 è l'unica in cui un solo codice confronta sia le modifiche fatte dall'app sia quelle fatte a mano, che hai chiesto di registrare. Nell'opzione 2 il confronto delle modifiche esterne andrebbe comunque nel server, con due implementazioni dello stesso confronto in due linguaggi. La conoscenza del modello che il server deve avere è minima e generica (confronto chiave per chiave, con solo `tipologia` trattata in modo speciale), quindi un campo nuovo in futuro non richiede di toccare il server.

Il salvataggio per blocco è ciò che rende sicuro `Sovrascrivi` con la regola "blocca e chiedi" che hai scelto: il tuo blocco vince, ma le altre modifiche esterne restano e vengono registrate come voce `esterna` prima della tua. Git (opzione 3) darebbe uno storico più ricco, ma impone una dipendenza esterna a chi usa l'exe e non risolve il calcolo del livello per requisito. La libreria nel progetto (opzione 4) elimina il disallineamento ma distrugge la condivisione, che è lo scopo della libreria.

Sulla versione hai chiesto sia data e ora sia `MAJOR.MINOR.PATCH`. Il livello calcolato con la possibilità di alzarlo dà un'indicazione affidabile (non puoi chiamare patch una modifica che rompe i progetti) senza impedirti di marcare una revisione importante. La fonte di verità della versione è il changelog, non il campo nel file, perché all'apertura non si riscrive mai la libreria: solo così una modifica esterna può avanzare la versione senza che l'app tocchi un file che non hai salvato. Il changelog registra solo i nomi dei campi, come hai scelto, quindi il contenuto precedente sta nelle 3 copie di sicurezza e nel riferimento, non nel changelog.

Il principale rischio accettato è che una modifica major aggiorni solo il progetto aperto: gli altri progetti che usano la stessa libreria restano con i vecchi id. Il livello major rende il rischio visibile; gestirlo davvero (elenco dei progetti coinvolti) spetta alla funzionalità 10.
