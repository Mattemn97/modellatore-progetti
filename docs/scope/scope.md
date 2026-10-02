# Scope: Modellatore di Requisiti a Blocchi (MBSE)

Editor web di sistemi a blocchi annidati, collegati da fili che rappresentano i requisiti. Parte dai requisiti cliente, li fa scendere fino ai blocchi che li coprono e genera i documenti formali MIL-STD-498 (SSS, SSDD, IRS, IDD…) con la matrice di tracciabilità. Un utente, in locale.

**Build approach:** Tracer Bullet (ogni funzionalità completa e funzionante, dai dati al canvas al file, prima della successiva).
**Workflow:** Alpha (dopo `/develop` si esegue `/check verify` sull'app vera). È il livello di rigore predefinito. `/architect` è la prima tappa consigliata per una funzionalità con una decisione da prendere, ma puoi saltarla se sai già come costruirla. Ogni funzionalità può avere un suo tag (es. `· Beta`) per fare di più o di meno.

_Sono consigli per costruire con ordine, non obblighi. Salta quello che non ti serve: se sai già come costruire una funzionalità, usa `/develop` e salta `/architect`. Decidi tu quando una funzionalità è `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Editor a blocchi annidati | Esistente | existing |
| B | Modello dati interfaccia e capacità | Esistente | existing |
| C | Import ed export JSON manuale | Esistente | existing |
| 1 | Salvataggio automatico del progetto | Foundation | done |
| 2 | Libreria su disco con changelog | Foundation | done |
| 3 | Import requisiti cliente | Slice 1 | done |
| 4 | Controllo di coerenza | Slice 2 | done |
| 5 | Gerarchia dei requisiti | Slice 3 | done |
| 6 | Matrice di tracciabilità | Slice 3 | done |
| 7 | Export documenti MIL-STD-498 | Slice 3 | done |
| 8 | Filtri avanzati | Slice 4 | done |
| 9 | Ispettore dei collegamenti | Slice 4 | done |
| 10 | Gestione completa della libreria | Slice 4 | done |
| 11 | Rifiniture dell'editor | Slice 4 | done |
| 12 | Tutorial e aiuto contestuale | Slice 5 | done |
| 13 | Protezione dei dati negli aggiornamenti | Slice 6 | in-progress |
| 14 | Console del server più leggibile | Slice 6 | planned |
| 15 | Controllo e aggiornamento automatico | Slice 6 | planned |

## Già presente

### A. Editor a blocchi annidati · existing
Canvas SVG: trascini i blocchi dalla libreria, li sposti e ridimensioni, entri in un blocco con doppio clic (effetto matriosca, breadcrumb per risalire). Zoom con la rotella verso il cursore, pan con trascinamento. Porte spostabili lungo il bordo (Shift+trascina), snodi sui fili (doppio clic). code in `js/renderer.js`, `js/app.js`

### B. Modello dati interfaccia e capacità · existing
Blocco con id, titolo, descrizione, categoria, sottocategoria e requisiti; requisito con id univoco, titolo, tipologia, metodo di verifica e testi da esportare (testo + documento). Con tipologia è di interfaccia (porta sul bordo), senza è di capacità (pin quadrato interno). Dentro un blocco i suoi requisiti diventano blocchi tondi, padri dei requisiti dei figli. Collegamenti solo interfaccia con interfaccia della stessa tipologia, capacità con capacità. Conversione automatica dei file vecchi. Scelta da confermare: i pin di capacità di un blocco figlio sono visibili dentro il suo rettangolo, altrimenti non si potrebbero collegare al padre. code in `js/model.js`, `js/inspector.js`

### C. Import ed export JSON manuale · existing
Esporta modello, libreria e standalone come download; carica libreria o progetto standalone da file. code in `js/storage.js`

## Foundations

### 1. Salvataggio automatico del progetto · done
Ogni modifica riscrive su disco il file del progetto su cui stai lavorando, così non perdi mai il lavoro e il JSON resta la fonte di verità.
**Done when:** apri un progetto dalla cartella, ogni modifica (blocco, filo, porta, testo) lo aggiorna su disco entro pochi secondi, e se il salvataggio fallisce lo vedi subito.
spec [0001](../specs/0001-salvataggio-automatico-progetto/index.md) · code in `start.py`, `js/progetto.js`
- [x] Design it (spec): `/architect salvataggio automatico del progetto`
- [x] Build it: `/develop salvataggio automatico del progetto`
  - [x] Filo minimo dal canvas al disco: API in `start.py`, `js/progetto.js`, salvataggio a debounce, badge (AC-1, AC-3, AC-4, AC-5, AC-16, AC-17)
  - [x] Riapertura dell'ultimo progetto e libreria del progetto (AC-2, AC-3, AC-15)
  - [x] Errori e conflitti: banner, ritentativi, Ricarica o Sovrascrivi (AC-6, AC-7)
  - [x] Versioni, Annulla e Ripeti (AC-8, AC-9, AC-10)
  - [x] Menu Progetto e rimozione dei vecchi pulsanti (AC-11, AC-12, AC-13, AC-14, AC-15)
- [x] Verify it: `/check verify salvataggio automatico del progetto`

### 2. Libreria su disco con changelog · done
Ogni modifica alla libreria la salva su disco e aggiunge una voce a un changelog versionato, così sai sempre cosa è cambiato, quando e in quale versione.
**Done when:** salvando un blocco la libreria si aggiorna su disco, la versione avanza e il changelog registra blocco, requisiti toccati e tipo di modifica; puoi leggere il changelog dall'app.
spec [0002](../specs/0002-libreria-disco-changelog/index.md) · code in `start.py`, `js/libreria.js`
- [x] Design it (spec): `/architect libreria su disco con changelog`
- [x] Build it: `/develop libreria su disco con changelog`
  - [x] Filo minimo dal Salva al disco con una voce: API `apri` e `salva` in `start.py`, `js/libreria.js`, Salva prima su disco poi in memoria, pulizia di `libreriaModificata` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-14, AC-15)
  - [x] Livello scelto, motivo e versione a vista (AC-4, AC-6, AC-13)
  - [x] Conflitti, modifiche esterne e copie di sicurezza (AC-7, AC-8, AC-9, AC-10)
  - [x] Sola lettura (AC-11, AC-14)
  - [x] Finestra Changelog e Storia (AC-12)
- [x] Verify it: `/check verify libreria su disco con changelog`

## Slice 1: Requisiti cliente

### 3. Import requisiti cliente · done
Importi da Excel o CSV le frasi del cliente (anche migliaia). Diventano i requisiti di un blocco Cliente che fa da padre del livello radice: ognuna è un blocco tondo da cui tiri fili verso i blocchi di sistema.
**Done when:** scegli un file, mappi le colonne (ID, testo, eventuali note), vedi un'anteprima con errori e duplicati, e dopo l'import i requisiti cliente compaiono come blocchi tondi alla radice; un secondo import dello stesso file aggiorna invece di duplicare.
spec [0003](../specs/0003-import-requisiti-cliente/index.md) · code in `start.py`, `js/cliente.js`, `js/model.js`, `js/renderer.js`, `js/progetto.js`
- [x] Design it (spec): `/architect import requisiti cliente`
- [x] Build it: `/develop import requisiti cliente`
  - [x] Filo minimo dal CSV al canvas e al disco: `appState.cliente` in ogni percorso del progetto, formato 2, API CSV, padre `__cliente__` in `model.js` e nel renderer, schede Libreria e Cliente, trascinamento e fili (AC-1, AC-10, AC-13, AC-14, AC-19, AC-20)
  - [x] Excel, fogli, colonne e mappatura ricordata (AC-2, AC-3, AC-4, AC-5)
  - [x] Validazione, anteprima e reimport: scarti, conteggi, modalità, modificati, ritirati, fili persi (AC-6, AC-7, AC-8, AC-9, AC-11)
  - [x] Scheda Cliente completa, dettaglio nell'ispettore e stati sul canvas (AC-12, AC-15, AC-16)
  - [x] Protezioni: id cliente nel Salva della libreria, import durante un conflitto (AC-17, AC-18)
- [x] Verify it: `/check verify import requisiti cliente`

## Slice 2: Coerenza

### 4. Controllo di coerenza · done
Il pulsante Verifica Coerenza evidenzia i requisiti non collegati, sul canvas e in un elenco, così vedi subito cosa manca per coprire il cliente.
**Done when:** un requisito cliente senza figli, o un requisito di blocco senza padre, è evidenziato sul canvas in ogni livello e compare nel report con il percorso del blocco; un clic sulla voce ti porta al blocco.
spec [0004](../specs/0004-controllo-coerenza/index.md) · code in `js/coerenza.js`, `js/renderer.js`, `js/progetto.js`, `js/cliente.js`
- [x] Design it (spec): `/architect controllo di coerenza`
- [x] Build it: `/develop controllo di coerenza`
  - [x] Filo minimo dal modello al pulsante, alla scheda e al canvas: `js/coerenza.js`, cliente senza figli e requisiti senza padre, modalità e scheda Coerenza, alone sui pin (AC-1, AC-2, AC-3, AC-10)
  - [x] Altri tipi di problema: senza figli, fili da ritirati, Da riparare con Rimuovi, contatore sui blocchi (AC-4, AC-5, AC-6, AC-9)
  - [x] Report completo e filtro per classe: gruppi, limite, ricerca (AC-7, AC-8)
  - [x] Navigazione dalla voce al livello, con `apriPercorso()` (AC-11)
- [x] Verify it: `/check verify controllo di coerenza`

## Slice 3: Tracciabilità ed export

### 5. Gerarchia dei requisiti · done
Ricostruisce l'albero dei requisiti dal cliente fino ai livelli più bassi, attraversando i blocchi annidati, e lo mostra: scegli un requisito e vedi i suoi antenati e discendenti. Un blocco di libreria usato più volte dà rami separati: l'unità è l'occorrenza (requisito più percorso dell'istanza).
**Done when:** scelto un requisito vedi la catena completa padre → figli su tutti i livelli, e sul canvas si evidenziano i fili coinvolti.
spec [0005](../specs/0005-gerarchia-requisiti/index.md) · code in `js/gerarchia.js`, `js/model.js`, `js/coerenza.js`, `js/renderer.js`, `js/inspector.js`, `js/cliente.js`, `js/progetto.js`
- [x] Design it (spec): `/architect gerarchia dei requisiti`
- [x] Build it: `/develop gerarchia dei requisiti`
  - [x] Filo minimo dal clic sul pin alla scheda e ai fili evidenziati: visita condivisa in `model.js` con la Coerenza sopra, `js/gerarchia.js`, pulsante e scheda (AC-1, AC-4, AC-5, AC-11, AC-14)
  - [x] Canvas completo: clic sui blocchi tondi, pannello destro, aloni, attenuazione, contatori, filtro (AC-2, AC-10)
  - [x] Albero completo: righe, ritirati, rami apribili con il limite (AC-6, AC-7, AC-8)
  - [x] Navigazione e ciclo della scelta: righe, dettaglio cliente, ✕ ed Esc, scelta sparita, rinomina, cambio progetto (AC-3, AC-9, AC-12, AC-13)
- [x] Verify it: `/check verify gerarchia dei requisiti`

### 6. Matrice di tracciabilità · done
Tabella padre → figli con i documenti di ciascun lato, a video (pulsante Matrice Requisiti) ed esportabile in Markdown, filtrabile per documento.
**Done when:** la matrice elenca ogni derivazione con id, titolo e documenti di padre e figlio, segnala i padri senza figli, ed è esportabile in `.md`.
spec [0006](../specs/0006-matrice-tracciabilita/index.md) · code in `js/matrice.js`, `js/gerarchia.js`, `js/progetto.js`, `js/libreria.js`, `js/storage.js`, `index.html`
- [x] Design it (spec): `/architect matrice di tracciabilità`
- [x] Build it: `/develop matrice di tracciabilità`
  - [x] Filo minimo dal modello alla finestra e al file: `js/matrice.js`, `#matriceModal`, tabella raggruppata, export `.md` (AC-1, AC-3, AC-4, AC-11)
  - [x] Colonne complete e problemi: blocco, metodo, classe, istanze, senza figli e senza padre per istanza, ritirati, ordine (AC-2, AC-5, AC-6, AC-7)
  - [x] Filtri, volumi ed export completo: documento e lato, classe, ricerca, conteggi, Mostra altri, filtri ricordati (AC-8, AC-9, AC-11, AC-12, AC-13)
  - [x] Dalla matrice alla Gerarchia: clic su un requisito, `apriGerarchiaSu()` (AC-10)
- [x] Verify it: `/check verify matrice di tracciabilità`

### 7. Export documenti MIL-STD-498 · done · Beta
Genera un file Markdown per documento (SSS, SSDD, IRS, IDD…) con la capitolazione formale del DID, mettendo ogni testo da esportare al suo posto (es. capacità e interfacce in capitoli diversi, metodi di verifica nelle disposizioni di qualifica, tracciabilità nel suo capitolo). Riferimento indicato da te: https://github.com/bradfa/MIL-STD-498
**Done when:** scegli un documento e ottieni un `.md` con i capitoli del DID, i testi dei requisiti nei capitoli giusti, il metodo di verifica di ognuno e la sezione di tracciabilità verso il livello padre.
spec [0007](../specs/0007-export-documenti-mil-std-498/index.md) · code in `js/documenti.js`, `js/matrice.js`, `js/utils.js`, `js/progetto.js`, `index.html`
- [x] Design it (spec): `/architect export documenti MIL-STD-498`
- [x] Build it: `/develop export documenti MIL-STD-498`
  - [x] Filo minimo dal modello al file SSS: `js/documenti.js`, finestra, selettore, anteprima ed export (AC-1, AC-2, AC-3, AC-4, AC-6, AC-11, AC-13)
  - [x] Tutti i DID: SRS, IRS, SSDD, SDD, IDD e altro, componenti per blocco, riferimenti, note (AC-4, AC-5, AC-7, AC-10)
  - [x] Qualifica e tracciabilità (AC-8, AC-9, AC-11)
  - [x] Riepilogo, troncamento e volumi (AC-12, AC-14)
- [x] Verify it: `/check verify export documenti MIL-STD-498`
- [ ] Test it: `/test export documenti MIL-STD-498` (saltato: nessun test runner per scelta del progetto, il controllo è `/check verify`)

## Slice 4: Editor rifinito

### 8. Filtri avanzati · done
Filtri su categoria, sottocategoria, documento e classe (capacità o tipologia di interfaccia), applicati a blocchi e fili, combinabili.
**Done when:** puoi combinare più filtri, blocchi e fili esclusi si attenuano o si nascondono, e i filtri restano attivi quando entri o esci da un blocco.
spec [0008](../specs/0008-filtri-avanzati/index.md) · code in `js/filtri.js`, `js/renderer.js`, `js/coerenza.js`, `js/builder.js`, `index.html`
- [x] Design it (spec): `/architect filtri avanzati`
- [x] Build it: `/develop filtri avanzati`
  - [x] Filo minimo: pannello con Classe e Attenua al posto del filtro di oggi, Coerenza sulla classe (AC-1, AC-3, AC-5, AC-6, AC-7)
  - [x] Tutti i gruppi: Documento, Categoria, Sottocategoria, Azzera (AC-2, AC-3, AC-4)
  - [x] Nascondi, riepilogo e catena della Gerarchia (AC-6, AC-7, AC-8, AC-10, AC-11)
  - [x] Persistenza tra livelli e riallineamento alla libreria (AC-9)
- [x] Verify it: `/check verify filtri avanzati`

### 9. Ispettore dei collegamenti · done
Clic su un filo: nel pannello a destra vedi i due requisiti collegati, la loro classe, il tipo di relazione (derivazione o collegamento tra blocchi) e puoi eliminarlo.
**Done when:** selezionando un filo l'ispettore mostra id, titolo, classe e testi dei due requisiti e il tipo di relazione; il filo selezionato è evidenziato.
spec [0009](../specs/0009-ispettore-collegamenti/index.md) · code in `js/renderer.js`, `js/inspector.js`
- [x] Design it (spec): `/architect ispettore dei collegamenti`
- [x] Build it: `/develop ispettore dei collegamenti`
  - [x] Selezione ed evidenza del filo, deselezione (AC-1, AC-7)
  - [x] Dettaglio dei due requisiti, estremi mancanti e validità (AC-2, AC-3, AC-4)
  - [x] Eliminazione e risoluzione per id dopo Annulla e Ricarica (AC-5, AC-6)
- [x] Verify it: `/check verify ispettore dei collegamenti`

### 10. Gestione completa della libreria · done
Completa la modifica della libreria: eliminare un blocco (avvisandoti se è usato nel progetto) e rinominarne l'id senza rompere le istanze.
**Done when:** elimini un blocco non usato, ricevi un avviso con l'elenco delle istanze se è usato, e rinominando l'id tutte le istanze lo seguono.
spec [0010](../specs/0010-gestione-completa-libreria/index.md) · code in `start.py`, `js/libreria.js`, `js/inspector.js`
- [x] Design it (spec): `/architect gestione completa della libreria`
- [x] Build it: `/develop gestione completa della libreria`
  - [x] Server: rotte elimina e rinomina con la scrittura condivisa (AC-6, AC-7)
  - [x] Client libreria: rotta nel conflitto, funzioni nuove, changelog (AC-1, AC-7, AC-8)
  - [x] Ispettore: elimina con avviso delle istanze, rinomina con aggiornamento dei nodi (AC-1, AC-2, AC-3, AC-4, AC-5)
- [x] Verify it: `/check verify gestione completa della libreria`

### 11. Rifiniture dell'editor · done
Piccoli difetti trovati nel codice: il rilascio di un blocco ignora zoom e pan, e lo spostamento delle porte con Shift non si scopre da soli.
**Done when:** un blocco rilasciato cade sotto il cursore a qualsiasi zoom, e lo spostamento delle porte è indicato nell'interfaccia.
spec [0011](../specs/0011-rifiniture-editor/index.md) · code in `js/app.js`, `js/renderer.js`, `index.html`, `style.css`
- [x] Design it (spec): `/architect rifiniture dell'editor`
- [x] Build it: `/develop rifiniture dell'editor`
  - [x] Rilascio centrato sotto il cursore (AC-1)
  - [x] Riga di aiuto e cursore con Shift sulle porte (AC-2, AC-3)
- [x] Verify it: `/check verify rifiniture dell'editor`

## Slice 5: Aiuto in app

### 12. Tutorial e aiuto contestuale · done
Un tour guidato a passi, con overlay e popup, che ti spiega ogni area dell'interfaccia; e una (i) accanto ai campi che, al passaggio del mouse, ti dice cosa rappresenta quel campo.
**Done when:** al primo avvio (o dal pulsante di aiuto) parte un tour che evidenzia una area alla volta con un popup Avanti, Indietro, Salta; ogni campo dell'ispettore e delle finestre principali ha una (i) con un suggerimento chiaro al passaggio del mouse.
spec [0012](../specs/0012-tutorial-aiuto-contestuale/index.md) · code in `js/aiuto.js`, `js/tour.js`, `js/aiuto-testi.js`, `index.html`, `style.css`, `js/inspector.js`, `js/cliente.js`, `js/filtri.js`, `js/libreria.js`, `js/progetto.js`, `js/app.js`
- [x] Design it (spec): `/architect tutorial e aiuto contestuale`
- [x] Build it: `/develop tutorial e aiuto contestuale`
  - [x] Filo minimo: menu ❓, una (i) con il suggerimento, tour corto con riflettore e tastiera (AC-1, AC-3, AC-4, AC-9, AC-11, AC-12, AC-13)
  - [x] Tour principale completo: 17 passi, pannelli e schede ripristinati, primo avvio (AC-2, AC-5, AC-6, AC-7)
  - [x] Inventario completo delle (i) e dei suggerimenti sui pulsanti (AC-9, AC-10, AC-11, AC-13)
  - [x] Mini tour delle finestre e tutorial esterno (AC-8, AC-14)
- [x] Verify it: `/check verify tutorial e aiuto contestuale`

## Slice 6: Aggiornamenti

### 13. Protezione dei dati negli aggiornamenti · in-progress
Una regola unica su cosa appartiene all'app e cosa alle persone: progetti, librerie, versioni, cestino e impostazioni personali non vengono mai sovrascritti né cancellati da un aggiornamento. Oggi lo zip contiene `settings.json`, quindi estrarlo sopra un'installazione sostituisce le impostazioni dell'utente.
**Done when:** aggiornando un'installazione (estraendo lo zip a mano o con l'aggiornamento automatico) `progetti/`, `shared/` e le impostazioni modificate dall'utente restano identiche, e le chiavi nuove delle impostazioni arrivano comunque con il loro valore predefinito.
spec [0013](../specs/0013-protezione-dati-aggiornamenti/index.md) · code in `start.py`, `packaging/crea-pacchetto.ps1`, `.github/workflows/rilascio.yml`, `packaging/TUTORIAL.md`
- [x] Design it (spec): `/architect protezione dei dati negli aggiornamenti`
- [x] Build it: `/develop protezione dei dati negli aggiornamenti`
  - [x] `start.py`: `PERCORSI_UTENTE` e creazione di `settings.json` dai predefiniti solo se manca (AC-2, AC-3, AC-5, AC-6)
  - [x] Pacchetto e rilascio: `settings.predefinite.json`, controllo dei percorsi utente, prova di avvio (AC-1, AC-8)
  - [x] Tutorial e prova di aggiornamento sopra un'installazione piena di dati (AC-4, AC-7)
- [ ] Verify it: `/check verify protezione dei dati negli aggiornamenti`

### 14. Console del server più leggibile · planned · needs a decision
La finestra nera all'avvio diventa chiara a colpo d'occhio: il link su cui lavorare ben evidenziato e cliccabile, le cartelle dei dati, la versione in uso ed eventuali avvisi (come un aggiornamento disponibile) a colori. Da decidere la libreria (rich o colorama) e come entra nell'exe.
**Done when:** avviando `start.py` o `start.exe` vedi a colori versione, link dell'app e cartelle dei dati, il link si apre con un clic dove il terminale lo permette, e la console resta leggibile anche dove i colori non sono supportati.
- [ ] Design it (spec): `/architect console del server più leggibile`

### 15. Controllo e aggiornamento automatico · planned · needs a decision
All'avvio il programma chiede alla repo GitHub se c'è una Release più recente; se c'è te lo dice nella console e con un banner nell'app e, se confermi, scarica la nuova versione, sostituisce i file dell'app e riparte, rispettando le regole della funzionalità 13.
**Done when:** con una Release più recente vedi l'avviso in console e nell'app con le note della versione; confermando, l'app si aggiorna e riparte con progetti, librerie e impostazioni intatti; senza rete, o se il download si interrompe, l'app parte comunque con la versione di prima e te lo dice.
- [ ] Design it (spec): `/architect controllo e aggiornamento automatico`

## Deferred
Fuori da questo giro, tenuti qui perché il piano resti onesto.
- **Export Word o PDF**: i documenti MIL-STD-498 anche in formato Word · needs a decision
- **Libreria condivisa tra più persone**: cartella di rete con gestione dei conflitti · needs a decision
- **Coerenza avanzata**: metodo di verifica mancante, testi senza documento, requisiti orfani per documento, esenzioni "va bene senza padre" con una nota, from spec 0004 · needs a decision
- **Annulla della libreria**: ripristinare una copia di `_versioni/` con la sua voce di changelog, from spec 0002 · needs a decision
- **Distribuzione dell'exe**: pacchetto pronto con tutti i file accanto a `start.exe`
- **Pulizia dei requisiti cliente ritirati**: eliminarli davvero quando la lista diventa scomoda, from spec 0003 · needs a decision
- **Coerenza dentro la gerarchia**: un segno sulle righe dell'albero con problemi di coerenza, invece di cambiare modalità, from spec 0005 · needs a decision
- **Matrice per occorrenza**: righe per istanza con il percorso, accanto alla vista per id, from spec 0006 · needs a decision
- **Lettura di `.xls` e date di Excel**: riaprire la scelta del lettore (SheetJS in `js/vendor/`), from spec 0003 · needs a decision

## Legend

**La casella di decisione.** Ogni funzionalità ne ha una, quella che finisce con `(spec)`. Il testo può variare, quindi le skill la trovano dal suffisso `(spec)`, mai dal testo esatto. Tutte le altre caselle sono di esecuzione e `/architect` non le spunta mai.

**Ciclo di vita di una funzionalità**:

| Stato | Chi lo imposta | Cosa mostra |
|---|---|---|
| `planned` · needs a decision | `/scope` | una casella: `Design it (spec): /architect <funzionalità>` |
| `in-progress` (progettata) | `/architect` alla cattura della spec | `Design it` spuntata, spec collegata, `Build it: /develop <funzionalità>` con 2 a 5 tappe, poi `Verify it` (Alpha e oltre), `Test it` (Beta e oltre) |
| `in-progress` (in costruzione) | `/develop` | le tappe si spuntano una alla volta, compare il puntatore al codice |
| `in-progress` (verificata) | `/check verify` | `Build it` e `Verify it` spuntate |
| `done` | tu, quando decidi; `/sync` riallinea | Alpha: dopo `/check verify`; Beta: dopo `/test` |

- **Prossimo passo** = la prima casella non spuntata.
- **needs a decision** = prima `/architect`, altrimenti direttamente `/develop`.
- I compiti di dettaglio stanno nel `## Build plan` della spec, non qui.
- **Status**: `planned` → `in-progress` → `done`, più `existing` (fatto prima di questo flusso) e `dropped` (tolto dal piano, tenuto per storia).
- **Tag di livello** accanto al titolo (es. `· Beta`): più o meno rigore per quella sola funzionalità. Senza tag vale il predefinito (Alpha).
- **Workflow**: Prototype = niente dopo `/develop`; Alpha = `/check verify`; Beta = `/check verify` poi `/test`; GA = aggiunge `/check review` e `/document`.
- **Riga puntatore** (`spec <n> · code in <path>`): la spec la aggiunge `/architect`, il codice `/develop`.
