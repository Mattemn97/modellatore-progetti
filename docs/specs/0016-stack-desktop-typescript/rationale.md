# 0016. Rationale: stack desktop

## Context

Il modellatore oggi è una pagina web servita da `start.py` (Python, `http.server`) su `localhost:8080`; il server esiste solo per dare alla pagina l'accesso ai file (progetti, librerie, changelog, versioni) e per l'aggiornamento automatico. L'utente vuole un programma desktop per Windows, in TypeScript, con interfaccia a pannelli agganciabili e staccabili in finestre separate, installabile per utente e senza il server locale.

Vincoli: tutte le funzionalità da 1 a 15 devono continuare a funzionare come adesso; i formati dei file restano gli stessi (l'import dalla 1.x deve bastare a copiare); la piattaforma è solo Windows; un solo utente, in locale; serve un aggiornamento automatico dalle Release di GitHub con verifica dell'impronta; servono test end to end automatici in CI.

Il codice attuale è circa 10.000 righe di JavaScript a moduli ES più 2.000 righe di Python. Una riscrittura in un colpo solo sarebbe il rischio più grande: per questo la decisione deve permettere di sostituire un pezzo alla volta (strangler, cioè far crescere il nuovo attorno al vecchio e ritirare il vecchio un tratto per volta).

## Options considered

### Option 1: Electron con TypeScript, esbuild e protocollo interno

Electron porta Chromium e Node.js. Il processo principale (TypeScript) legge e scrive i file con Node; la pagina si carica da uno schema `app://` il cui gestore risponde anche alle rotte `/api/*` con lo stesso contratto di oggi.

**Pros**:
- Tutto in TypeScript, la logica Python (diff, changelog, versioni, CSV) si porta in un linguaggio solo.
- Playwright pilota Electron ufficialmente: gli end to end girano in CI su Windows.
- Finestre multiple e comunicazione tra finestre già pronte (pannelli staccati).
- electron-builder fa un setup NSIS per utente senza UAC; electron-updater verifica l'impronta e aggiorna dalle Release di GitHub.
- Conservare `/api/*` lascia la pagina intatta durante la migrazione.

**Cons**:
- Installabile grande (circa 100 MB) e memoria più alta.
- Aggiornamenti di sicurezza di Electron da seguire.

### Option 2: Tauri con TypeScript

Guscio leggero che usa WebView2 di Windows e un processo principale in Rust.

**Pros**:
- Installabile piccolo (pochi MB), poca memoria.
- Updater con firma integrato.

**Cons**:
- La logica dei file andrebbe in Rust (un secondo linguaggio) o passerebbe da plugin con permessi da configurare.
- Gli end to end passano da WebDriver con `tauri-driver`, più fragili di Playwright.
- Finestre multiple sincronizzate richiedono più lavoro.

### Option 3: Electron con Vite (electron-vite)

Come l'opzione 1 ma con Vite per compilare e un server di sviluppo con ricarica a caldo.

**Pros**:
- Ricarica a caldo dell'interfaccia durante lo sviluppo.

**Cons**:
- Più configurazione e più dipendenze; il vantaggio conta poco finché la pagina resta JavaScript a moduli ES serviti così come sono.

### Option 4: Electron con chiamate IPC al posto del protocollo

Sostituire ogni `fetch('/api/...')` con funzioni esposte dal preload.

**Pros**:
- È la strada più comune nelle app Electron.

**Cons**:
- Bisogna toccare tutti i moduli che chiamano le API prima ancora di avere i test; il contratto HTTP di oggi, già collaudato, andrebbe riscritto.

## Rationale

Electron vince perché tiene tutto in un solo linguaggio e perché la richiesta "tutto funzionante come adesso" pesa più del peso dell'installabile: Playwright su Electron dà la rete di sicurezza end to end più solida, e le finestre staccate dei pannelli sono native. Tauri sarebbe la scelta per un'app da distribuire a molti con banda limitata, non per uno strumento di lavoro su un PC Windows.

Il protocollo `app://` con le rotte `/api/*` nel processo principale è la scelta che rende possibile la migrazione a strati: la pagina non sa che il server non c'è più, i test end to end scritti contro la 1.x restano validi, e ogni rotta si porta dal Python al TypeScript una alla volta. L'IPC arriva solo dove non c'è una richiesta da servire (finestre, dialoghi, eventi tra finestre).

esbuild al posto di Vite perché, finché la pagina è servita così com'è, basta compilare due file (principale e preload); quando la pagina diventa TypeScript (voce 23) esbuild compila anche quella con lo stesso comando. Il ponte temporaneo verso `start.py` è un debito voluto e breve: chiude il filo completo dal primo giorno, ed è rimosso alla voce 20.
