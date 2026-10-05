# Scope · Epic v2: applicazione desktop Windows in TypeScript

La riscrittura 2.0.0: lo stesso modellatore, ora programma desktop per Windows scritto in TypeScript, con l'interfaccia a pannelli agganciabili (ogni scheda e ogni finestra di oggi diventa un pannello), file letti e scritti direttamente senza server locale, installabile per utente e aggiornamento automatico. Regola che vale per ogni voce: tutto quello che fanno le funzionalità A, B, C e da 1 a 15 ([v1-web.md](v1-web.md)) deve continuare a funzionare come adesso.

Livello predefinito di questo epic: **Beta** (dopo `/develop`, `/check verify` poi `/test`). Quadro generale e legenda in [index.md](index.md).

**Branch:** ogni voce parte da `develop` (`feat/<nome>`) e ci torna con un merge; la CI gira su `develop`. `main` resta la 1.x finché l'epic non è completo, poi il merge di `develop` in `main` pubblica la 2.0.0.

## Foundations

### 16. Stack desktop e struttura TypeScript · done
Sceglie il guscio desktop, la compilazione TypeScript e la struttura delle cartelle, e fa partire il codice di oggi così com'è dentro una finestra desktop: il primo filo che attraversa tutto.
**Done when:** la scelta è in una spec, `develop` esiste, e lanciando l'app in sviluppo si apre una finestra Windows con l'editor attuale che disegna canvas e libreria; il controllo dei tipi gira (anche se il codice è ancora JavaScript).
spec [0016](../specs/0016-stack-desktop-typescript/index.md) · code in `src/main/`, `src/preload/`, `scripts/build.mjs`, `package.json`, `start.py`
- [x] Decide the stack (spec): `/architect stack desktop e struttura TypeScript`
- [x] Scaffold from the decision: `/develop stack desktop e struttura TypeScript`
- [x] Verify it: `/check verify stack desktop e struttura TypeScript`
- [x] Test it: `/test stack desktop e struttura TypeScript` (`tests/e2e/guscio.spec.ts`, `tests/unit/percorsi.test.ts`)

### 17. Standard, strumenti e CI su develop · done
Aggiorna `AGENTS.md` alle nuove regole (TypeScript, niente server, comandi nuovi), installa controllo dei tipi, lint, test unitari ed end to end, e una GitHub Action che li fa girare a ogni push e pull request verso `develop`.
**Done when:** `AGENTS.md` descrive lo stack reale, i comandi di typecheck, lint e test girano puliti in locale, e la CI su `develop` è verde.
code in `AGENTS.md`, `package.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `tests/`, `.github/workflows/ci.yml`
- [x] Capture conventions + tooling choices: `/audit`
- [x] Install the tooling: typecheck, lint, Vitest, Playwright su Electron, CI su `develop`
- [x] Check it runs clean: `npm run verifica` in locale e CI verde

### 18. Rete di sicurezza end to end · done
Prima di toccare il codice, una suite di test end to end fissa il comportamento di oggi nei percorsi principali (blocchi, fili, gerarchia di livelli, libreria e changelog, import cliente, coerenza, gerarchia, matrice, documenti, filtri, Annulla e Ripeti), così ogni passo successivo dimostra di non aver rotto niente.
**Done when:** la suite copre i percorsi principali delle funzionalità da 1 a 15, gira contro l'app desktop sia in locale sia in CI, ed è verde sul codice di partenza.
spec [0017](../specs/0017-rete-sicurezza-e2e/index.md) · code in `tests/e2e/`
- [x] Design it (spec): `/architect rete di sicurezza end to end`
- [x] Build it: `/develop rete di sicurezza end to end`
  - [x] Copia isolata con dati di prova, helper `api()`, dialoghi, richiesta di testo e download (AC-5)
  - [x] Contratto delle API: progetti, libreria, import cliente con xlsx di riferimento (AC-1, AC-2, AC-3)
  - [x] Percorsi dell'interfaccia delle funzionalità da 1 a 12 (AC-4)
  - [x] Suite verde in locale (53 test e2e, circa 1 minuto) e in CI (AC-6, AC-7)
- [x] Verify it: `/check verify rete di sicurezza end to end`
- [x] Test it: la voce è la suite stessa
- Trovato e corretto: `window.prompt` non esiste in Electron (Nuovo, Rinomina, Salva una copia, Rinomina ID), sostituito da `chiediTesto()` (spec 0016, AC-8)

## Slice 1: Niente server, file diretti

### 19. Progetti su disco senza server · needs a decision
Il salvataggio automatico, le versioni, Annulla e Ripeti, il cestino, l'ultimo progetto aperto e i conflitti passano dalle chiamate HTTP a `start.py` a operazioni dirette sui file fatte dal processo desktop, con la stessa serializzazione delle scritture di oggi.
**Done when:** tutto quello che fa la funzionalità 1 funziona senza alcun server in ascolto, i file su disco hanno lo stesso formato di oggi, e i test end to end dei progetti sono verdi.
- [ ] Design it (spec): `/architect progetti su disco senza server`

### 20. Libreria, changelog e import senza server · needs a decision
Apri, salva, elimina e rinomina della libreria, il calcolo delle differenze e il changelog versionato, le copie in `_versioni/` e la lettura di CSV ed Excel per l'import cliente passano dal Python al codice dell'app desktop. Alla fine `start.py` non serve più per far funzionare l'app.
**Done when:** le funzionalità 2, 3 e 10 fanno esattamente quello che fanno oggi (stesse versioni, stesse voci di changelog, stessi conflitti e sola lettura) senza server, e i loro test end to end sono verdi.
- [ ] Design it (spec): `/architect libreria, changelog e import senza server`

### 21. Impostazioni e cartelle di lavoro · needs a decision
Una sezione Impostazioni dove indichi dove trovare librerie, progetti e gli altri dati. Se le cartelle indicate non esistono, l'app ti propone di crearle e ci prepara la struttura di base (come oggi `shared/libreria.json` con un blocco di esempio). Le impostazioni dell'utente vivono fuori dalla cartella del programma, così un aggiornamento non le tocca mai.
**Done when:** al primo avvio, senza cartelle configurate, l'app propone una posizione e la crea su conferma; dalle Impostazioni cambi le cartelle e l'app riapre dati da lì; una cartella sparita o non scrivibile ti viene segnalata con la proposta di sceglierne o crearne un'altra; le impostazioni di oggi (griglia, colori, tipologie, documenti) restano modificabili e con i loro valori predefiniti.
- [ ] Design it (spec): `/architect impostazioni e cartelle di lavoro`

### 22. Import dei dati dalla versione 1
Dalle Impostazioni indichi la cartella di una vecchia installazione 1.x e l'app copia (senza spostare né cancellare) progetti, librerie, changelog, versioni, cestino e impostazioni personali nelle cartelle di lavoro nuove.
**Done when:** puntando a una cartella 1.x piena di dati ritrovi nell'app nuova gli stessi progetti e librerie con versioni e changelog; la cartella vecchia resta identica; un file che esiste già nella destinazione non viene sovrascritto senza chiedertelo.
- [ ] Build it: `/develop import dei dati dalla versione 1`

## Slice 2: TypeScript

### 23. Passaggio del codice a TypeScript · needs a decision
Ogni modulo di `js/` diventa TypeScript, con tipi espliciti per il modello dati (libreria, grafo, livelli, cliente, impostazioni) e per i contratti con il processo desktop. Un modulo alla volta, con l'app sempre funzionante.
**Done when:** nel sorgente non resta JavaScript scritto a mano, il controllo dei tipi in modalità rigorosa passa senza errori, i test unitari coprono le regole pure (modello, coerenza, gerarchia, matrice, documenti, filtri) e la suite end to end è verde.
- [ ] Design it (spec): `/architect passaggio del codice a TypeScript`

## Slice 3: Interfaccia a pannelli

### 24. Sistema a pannelli agganciabili · needs a decision
L'interfaccia diventa un layout a pannelli come in un IDE: Libreria, Cliente, Coerenza, Gerarchia, Canvas e Ispettore sono pannelli che trascini, affianchi, impili a schede, ridimensioni, chiudi e riapri da un menu Finestra. Il layout si ricorda tra un avvio e l'altro e c'è Ripristina layout.
**Done when:** ogni scheda di oggi è un pannello spostabile e ridimensionabile, il layout resta uguale dopo un riavvio, Ripristina layout riporta la disposizione predefinita, e tutti i comportamenti delle schede di oggi (aggiornamento di Coerenza e Cliente, scelta della Gerarchia, ispettore) restano uguali.
- [ ] Design it (spec): `/architect sistema a pannelli agganciabili`

### 25. Matrice, Documenti e Changelog come pannelli
Le finestre modali di oggi (Matrice Requisiti, Documenti MIL-STD-498, Changelog e Apri progetto) diventano pannelli che puoi tenere aperti accanto al canvas mentre lavori, aggiornati quando il modello cambia. L'import cliente resta una procedura guidata in finestra.
**Done when:** apri Matrice, Documenti e Changelog come pannelli agganciabili, si aggiornano dopo una modifica al modello, i loro filtri ed export `.md` funzionano come oggi, ed Esc, Ctrl+Z e Ctrl+Y si comportano bene con il pannello attivo.
- [ ] Build it: `/develop matrice, documenti e changelog come pannelli`

### 26. Pannelli in finestre staccate · needs a decision
Puoi staccare un pannello in una finestra separata di Windows (per esempio la Matrice sul secondo monitor) e riagganciarlo; le finestre staccate restano sincronizzate con il progetto aperto.
**Done when:** stacchi e riagganci qualunque pannello tranne il Canvas principale, una modifica in una finestra si vede subito nelle altre, chiudendo l'app le finestre staccate si chiudono con lei, e alla riapertura il layout (comprese le finestre staccate e il loro monitor) torna com'era.
- [ ] Design it (spec): `/architect pannelli in finestre staccate`

### 27. Tour, aiuto e tutorial sui pannelli
Il tour guidato, le (i) e il tutorial utente seguono la nuova interfaccia: un passo del tour apre o mette in primo piano il pannello che spiega, anche se l'hai chiuso o spostato.
**Done when:** il tour principale e i mini tour funzionano con qualunque layout, ogni campo nuovo (Impostazioni, menu Finestra) ha la sua (i), e `packaging/TUTORIAL.md` con la guida descrivono l'installazione e i pannelli.
- [ ] Build it: `/develop tour, aiuto e tutorial sui pannelli`

## Slice 4: Distribuzione Windows

### 28. Installabile Windows per utente · needs a decision
Un setup che installa per il solo utente senza permessi di amministratore (niente UAC), crea i collegamenti nel menu Start e sul desktop, si disinstalla da Impostazioni di Windows e non tocca mai le cartelle di lavoro.
**Done when:** il setup si installa su un Windows pulito senza richiesta UAC, l'app parte dal menu Start, la disinstallazione toglie il programma ma lascia progetti, librerie e impostazioni, e reinstallando ritrovi tutto.
- [ ] Design it (spec): `/architect installabile Windows per utente`

### 29. Aggiornamento automatico della versione desktop · needs a decision
Il controllo della funzionalità 15 portato nell'app desktop: all'avvio guarda l'ultima Release di GitHub, ti mostra le novità, e con un clic scarica il nuovo setup, ne verifica l'impronta, si aggiorna e riparte, sempre senza toccare i dati.
**Done when:** con una Release più recente vedi l'avviso con le novità; confermando l'app si aggiorna e riparte con dati e layout intatti; senza rete o con un download interrotto l'app resta sulla versione di prima e te lo dice; si prova contro un finto server di Release come oggi.
- [ ] Design it (spec): `/architect aggiornamento automatico della versione desktop`

### 30. Rilascio 2.0.0 e passaggio dalla 1.x · needs a decision
Il workflow di rilascio su `main` costruisce, prova e pubblica il setup Windows; `start.py`, `start.spec`, `requirements.txt` e lo zip vengono ritirati. L'ultima 1.x, trovando la 2.0.0, non prova a installarla come uno zip ma ti porta al setup e ti ricorda l'import dei dati.
**Done when:** il merge di `develop` in `main` pubblica la Release 2.0.0 con il setup e le note; una 1.x installata mostra l'avviso con il link al setup senza rompersi; nel repository non restano il server Python né il pacchetto zip; i segreti necessari (se servono) sono elencati nella documentazione.
- [ ] Design it (spec): `/architect rilascio 2.0.0 e passaggio dalla 1.x`

## Deferred
Fuori da questo giro, tenuti qui perché il piano resti onesto.
- **Firma del codice del setup**: certificato per evitare l'avviso di SmartScreen al primo download · needs a decision
- **macOS e Linux**: altri sistemi operativi, oggi esclusi perché il lavoro si fa su Windows · needs a decision
- **Layout con nome**: salvare più disposizioni (modellazione, revisione, export) e passare dall'una all'altra · needs a decision
