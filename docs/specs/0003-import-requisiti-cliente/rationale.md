# 0003. Import dei requisiti cliente: il perché

## Context

Il modellatore fa scendere i requisiti dal cliente fino ai blocchi che li coprono. Oggi manca l'inizio della catena: i requisiti del cliente non esistono nel modello, e la radice del progetto non ha un padre da cui derivare. Il cliente li manda come file Excel o CSV, spesso con migliaia di righe, con un cartiglio sopra la tabella, fogli multipli e revisioni successive dello stesso documento.

Le forze in gioco. Il progetto non ha npm né un passo di build, e l'exe deve restare autonomo: ogni libreria esterna va copiata a mano e tenuta aggiornata. Il file del progetto è già la fonte di verità, salvato da solo con versioni e Annulla (spec 0001). Il canvas ridisegna tutto a ogni `render()`, anche durante il trascinamento: migliaia di elementi in più lo renderebbero lento. I blocchi tondi di un livello vengono oggi dalla definizione in libreria del blocco padre, e la libreria è condivisa tra progetti (spec 0002), mentre i requisiti cliente appartengono a un solo progetto.

Il reimport è il punto delicato: il cliente rinumera, ritira e riscrive frasi tra una revisione e l'altra. Se il secondo import duplica, o cancella in silenzio i fili già tirati, il lavoro di tracciabilità si perde proprio quando serve. Senza questa funzionalità le voci 4, 5, 6 e 7 dello scope non hanno un punto di partenza.

## Options considered

### Option 1: lettura in `start.py` con la libreria standard, confronto nel client

`start.py` riceve il file e lo restituisce come fogli di celle di testo, usando `zipfile`, `xml.etree` e `csv`. Tutto il resto (mappatura, validazione, confronto, salvataggio) sta nel browser e finisce nel file del progetto.

**Pros**:
- Zero dipendenze: funziona nell'exe così com'è.
- Il modulo `csv` di Python gestisce bene virgolette, a capo nelle celle e separatori, dove un parser scritto a mano sbaglia di solito.
- Il salvataggio riusa autosalvataggio, versioni e Annulla della spec 0001.

**Cons**:
- Il lettore `.xlsx` va scritto (circa 100 righe) e copre solo i casi comuni: niente `.xls`, date lette come numeri.
- Il file viaggia al server in base64, un terzo più grande.

### Option 2: SheetJS copiata in `js/vendor/`

La libreria più diffusa per leggere fogli di calcolo nel browser, come file statico caricato da `index.html`.

**Pros**:
- Legge quasi tutto: `.xls`, `.xlsx`, `.ods`, date, celle unite.
- Niente rotta nuova sul server, niente upload.

**Cons**:
- Circa 900 KB da aggiornare a mano, senza npm che avvisi delle correzioni di sicurezza.
- Un secondo stile di codice (script globale) in un progetto a moduli ES.
- La distribuzione aggiornata non sta più sul registro npm pubblico, quindi va seguita a parte.

### Option 3: lettura nel browser senza librerie

`DecompressionStream` apre lo zip del `.xlsx`, `DOMParser` legge l'XML, il CSV è scritto a mano.

**Pros**:
- Nessuna dipendenza e nessun upload.

**Cons**:
- Lo zip va letto a mano (directory centrale, offset), e il CSV a mano è la fonte classica di bug con virgolette e a capo.
- Più codice da mantenere nel client, che è già il posto più affollato.

## Rationale

La scelta segue dai vincoli del progetto: niente npm, exe autonomo, file del progetto come fonte di verità. L'opzione 1 è l'unica che non aggiunge nulla da distribuire e mette la parte difficile (CSV con virgolette e codifiche di Windows) nelle mani di un modulo standard collaudato. Il lettore `.xlsx` a mano è poco codice perché serve solo il testo delle celle, non formattazione, formule o stili.

SheetJS vincerebbe se dovessimo leggere `.xls` vecchi o date: non è richiesto oggi, e se servirà lo si recupera (è in Follow-up). L'opzione 3 sposta lo stesso lavoro nel browser senza il vantaggio del modulo `csv`.

Il confronto nel client, e non sul server, è la conseguenza dello stile esistente: il progetto è di proprietà del client e l'autosalvataggio lo scrive intero. Un import lato server dovrebbe riscrivere il progetto in concorrenza con l'autosalvataggio e perderebbe l'Annulla in un passo. Le altre scelte (pannello più canvas, prefisso, ritiro invece di eliminazione, sola lettura) sono tue, fatte nella conversazione: tutte vanno verso "nessun lavoro perso, tutto visibile prima di confermare", che è la forza principale del Context.
