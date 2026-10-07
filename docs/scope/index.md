# Scope: Modellatore di Requisiti a Blocchi (MBSE)

Editor di sistemi a blocchi annidati, collegati da fili che rappresentano i requisiti. Parte dai requisiti cliente, li fa scendere fino ai blocchi che li coprono e genera i documenti formali MIL-STD-498 (SSS, SSDD, IRS, IDD…) con la matrice di tracciabilità. Un utente, in locale, su Windows.

**Build approach:** Tracer Bullet (ogni funzionalità completa e funzionante, dai dati all'interfaccia al file, prima della successiva). Nella riscrittura v2 vuol dire "a strati": prima il guscio desktop con il codice di oggi, poi i file senza server, poi TypeScript, poi i pannelli, con l'app sempre completa a ogni passo.
**Workflow:** Beta (dopo `/develop`, `/check verify` poi `/test`). È il livello di rigore predefinito dalla v2; le voci della v1 sono state chiuse con Alpha. `/architect` è la prima tappa consigliata per una funzionalità con una decisione da prendere, ma puoi saltarla se sai già come costruirla. Ogni funzionalità può avere un suo tag (es. `· GA`) per fare di più o di meno.

_Sono consigli per costruire con ordine, non obblighi. Salta quello che non ti serve: se sai già come costruire una funzionalità, usa `/develop` e salta `/architect`. Decidi tu quando una funzionalità è `done`._

## Epic

- [v1-web.md](v1-web.md): editor web con server locale (1.x). 18 voci, tutte `done` o `existing`.
- [v2-desktop.md](v2-desktop.md): app desktop Windows in TypeScript, pannelli agganciabili, installabile (2.0.0). 16 voci, tutte `done`.
- [feedback-utenti.md](feedback-utenti.md): blocco G, richieste di chi usa la 2.1.0 (pin di capacità, fili intorno ai blocchi, blocchi matrioska, filtri della Matrice, filtro dell'import cliente). Voci 57–62, release 2.2.0, tutte `planned`.
- **futuro** (voci 32–56, ancora senza file di epic): idee dopo la 2.0.0 divise in sei blocchi di rilascio, dalla 2.1.0 alla 2.7.0, descritte in "Idee future" qui sotto. Blocco A (32–34, 2.1.0) `done`, le altre `planned`. Il blocco G è entrato dopo il blocco A e ha spostato in avanti di una release i blocchi da B a F.

## At a glance

| # | Feature | Epic | Phase | Status |
|---|---------|------|-------|--------|
| A | Editor a blocchi annidati | v1 | Esistente | existing |
| B | Modello dati interfaccia e capacità | v1 | Esistente | existing |
| C | Import ed export JSON manuale | v1 | Esistente | existing |
| 1 | Salvataggio automatico del progetto | v1 | Foundation | done |
| 2 | Libreria su disco con changelog | v1 | Foundation | done |
| 3 | Import requisiti cliente | v1 | Slice 1 | done |
| 4 | Controllo di coerenza | v1 | Slice 2 | done |
| 5 | Gerarchia dei requisiti | v1 | Slice 3 | done |
| 6 | Matrice di tracciabilità | v1 | Slice 3 | done |
| 7 | Export documenti MIL-STD-498 | v1 | Slice 3 | done |
| 8 | Filtri avanzati | v1 | Slice 4 | done |
| 9 | Ispettore dei collegamenti | v1 | Slice 4 | done |
| 10 | Gestione completa della libreria | v1 | Slice 4 | done |
| 11 | Rifiniture dell'editor | v1 | Slice 4 | done |
| 12 | Tutorial e aiuto contestuale | v1 | Slice 5 | done |
| 13 | Protezione dei dati negli aggiornamenti | v1 | Slice 6 | done |
| 14 | Console del server più leggibile | v1 | Slice 6 | done |
| 15 | Controllo e aggiornamento automatico | v1 | Slice 6 | done |
| 16 | Stack desktop e struttura TypeScript | v2 | Foundation | done |
| 17 | Standard, strumenti e CI su develop | v2 | Foundation | done |
| 18 | Rete di sicurezza end to end | v2 | Foundation | done |
| 19 | Progetti su disco senza server | v2 | Slice 1 | done |
| 20 | Libreria, changelog e import senza server | v2 | Slice 1 | done |
| 21 | Impostazioni e cartelle di lavoro | v2 | Slice 1 | done |
| 22 | Import dei dati dalla versione 1 | v2 | Slice 1 | done |
| 23 | Passaggio del codice a TypeScript | v2 | Slice 2 | done |
| 24 | Sistema a pannelli agganciabili | v2 | Slice 3 | done |
| 25 | Matrice, Documenti e Changelog come pannelli | v2 | Slice 3 | done |
| 26 | Pannelli in finestre staccate | v2 | Slice 3 | done |
| 27 | Tour, aiuto e tutorial sui pannelli | v2 | Slice 3 | done |
| 28 | Installabile Windows per utente | v2 | Slice 4 | done |
| 29 | Aggiornamento automatico della versione desktop | v2 | Slice 4 | done |
| 30 | Rilascio 2.0.0 e passaggio dalla 1.x | v2 | Slice 4 | done |
| 31 | Documenti di export legati al tipo di requisito | v2 | Slice 5 · Blocco A (2.1.0) | done |
| 32 | Export Word e PDF dei documenti | futuro | Blocco A (2.1.0) | done |
| 33 | Immagini dei diagrammi | futuro | Blocco A (2.1.0) | done |
| 34 | Rilascio 2.1.0 | futuro | Blocco A (2.1.0) | done |
| 57 | Filtro delle righe nell'import cliente | feedback | Blocco G (2.2.0) | done |
| 58 | Filtri per colonna nella Matrice | feedback | Blocco G (2.2.0) | done |
| 59 | Pin di capacità spostabili | feedback | Blocco G (2.2.0) | planned |
| 60 | Instradamento automatico dei fili | feedback | Blocco G (2.2.0) | planned |
| 61 | Blocchi di libreria con l'interno (matrioska) | feedback | Blocco G (2.2.0) | planned |
| 62 | Rilascio 2.2.0 | feedback | Blocco G (2.2.0) | planned |
| 35 | Ricerca globale | futuro | Blocco B (2.3.0) | planned |
| 36 | Minimappa e panoramica dei livelli | futuro | Blocco B (2.3.0) | planned |
| 37 | Selezione multipla e allineamento | futuro | Blocco B (2.3.0) | planned |
| 38 | Copia e incolla di gruppi | futuro | Blocco B (2.3.0) | planned |
| 39 | Rilascio 2.3.0 | futuro | Blocco B (2.3.0) | planned |
| 40 | Attributi personalizzati dei requisiti | futuro | Blocco C (2.4.0) | planned |
| 41 | Re-import dei requisiti cliente con differenze | futuro | Blocco C (2.4.0) | planned |
| 42 | Verifica e VCRM | futuro | Blocco C (2.4.0) | planned |
| 43 | Analisi d'impatto | futuro | Blocco C (2.4.0) | planned |
| 44 | Rilascio 2.4.0 | futuro | Blocco C (2.4.0) | planned |
| 45 | Cestino e versioni sfogliabili | futuro | Blocco D (2.5.0) | planned |
| 46 | Baseline del progetto | futuro | Blocco D (2.5.0) | planned |
| 47 | Note di revisione sul canvas | futuro | Blocco D (2.5.0) | planned |
| 48 | Cruscotto di avanzamento | futuro | Blocco D (2.5.0) | planned |
| 49 | Rilascio 2.5.0 | futuro | Blocco D (2.5.0) | planned |
| 50 | Varianti di prodotto | futuro | Blocco E (2.6.0) | planned |
| 51 | Interoperabilità ReqIF e SysML v2 | futuro | Blocco E (2.6.0) | planned |
| 52 | Rilascio 2.6.0 | futuro | Blocco E (2.6.0) | planned |
| 53 | Tema scuro e accessibilità | futuro | Blocco F (2.7.0) | planned |
| 54 | Interfaccia e documenti in inglese | futuro | Blocco F (2.7.0) | planned |
| 55 | Libreria su cartella di rete condivisa | futuro | Blocco F (2.7.0) | planned |
| 56 | Rilascio 2.7.0 | futuro | Blocco F (2.7.0) | planned |

## Idee future: piano a blocchi di rilascio

Le voci 31–62 della tabella, raggruppate per area. Ogni area è un **blocco**: le sue voci si costruiscono insieme su `develop` e il blocco si chiude con una release minore. I numeri continuano quelli della tabella e danno l'ordine consigliato dentro il blocco; fra i blocchi conta l'ordine di questa tabella (il blocco G, arrivato dopo, viene subito dopo il blocco A). Quando parti con un blocco: `/scope <blocco>` gli crea il file di epic con i "Done when"; ogni voce resta `needs a decision` finché `/architect` non ne scrive la spec.

| Blocco | Area | Voci | Release |
|---|---|---|---|
| A | Documenti ed export | 31–34 | 2.1.0 |
| G | Feedback degli utenti ([feedback-utenti.md](feedback-utenti.md)) | 57–62 | 2.2.0 |
| B | Navigazione e modifica del canvas | 35–39 | 2.3.0 |
| C | Requisiti e tracciabilità | 40–44 | 2.4.0 |
| D | Versioni e revisioni | 45–49 | 2.5.0 |
| E | Configurazioni e interoperabilità | 50–52 | 2.6.0 |
| F | Interfaccia e lavoro condiviso | 53–56 | 2.7.0 |

**Come si chiude ogni blocco.** L'ultima voce di ogni blocco è il suo rilascio: si alza `version` in `package.json`, si scrivono le note in `packaging/note/<versione>.md` con le novità del blocco, si aggiornano `packaging/TUTORIAL.md` e `docs/guida/`, poi si fa il merge di `develop` in `main`. Il workflow di rilascio (spec 0026) pubblica la Release, e all'avvio successivo ogni copia installata mostra l'avviso di aggiornamento con le novità e il pulsante "Aggiorna e riavvia" (spec 0025). Vale per tutti i blocchi:
- progetti e librerie salvati con la versione precedente si aprono senza perdite (una nuova chiave ha un valore predefinito, un cambio di formato passa da `normalizzaLibreria()` o da un `formatVersion` nuovo);
- un layout dei pannelli salvato resta valido, oppure si torna in silenzio a quello predefinito (`layoutValido`), così l'app aggiornata non parte mai rotta;
- ogni nuova chiave di `settings.json` è anche in `DEFAULT_SETTINGS`, quindi le cartelle di lavoro già esistenti non vanno ritoccate a mano.

### Blocco A · Documenti ed export → 2.1.0
- **31. Documenti di export legati al tipo di requisito**: già nel piano (epic v2). Viene per prima perché le altre voci del blocco lavorano sugli stessi documenti.
- **32. Export Word e PDF dei documenti**: oltre al Markdown, i documenti MIL-STD-498 in `.docx` e PDF con un modello aziendale (intestazione, logo, tabella delle revisioni). `done` · spec [0028](../specs/0028-export-word-pdf.md) · code in `src/main/documenti/`, `src/renderer/documenti.ts`
- **33. Immagini dei diagrammi**: esportare un livello del canvas in SVG o PNG e inserirlo in automatico nel capitolo del documento che descrive quel blocco. `done` · spec [0029](../specs/0029-immagini-diagrammi.md) · code in `src/renderer/diagramma.ts`
- **34. Rilascio 2.1.0**: `done` · `version` 2.1.0, note in `packaging/note/2.1.0.md`, merge di `develop` in `main`

### Blocco G · Feedback degli utenti → 2.2.0
Viene subito dopo il blocco A: sono richieste di chi usa già l'app. Le voci, con i loro "Done when", sono in [feedback-utenti.md](feedback-utenti.md).
- **57. Filtro delle righe nell'import cliente**, **58. Filtri per colonna nella Matrice**, **59. Pin di capacità spostabili**, **60. Instradamento automatico dei fili**, **61. Blocchi di libreria con l'interno (matrioska)**, **62. Rilascio 2.2.0**

### Blocco B · Navigazione e modifica del canvas → 2.3.0
- **35. Ricerca globale**: Ctrl+F su blocchi, requisiti e testi di export di tutto il progetto, a ogni livello, con salto diretto al blocco o al filo trovato.
- **36. Minimappa e panoramica dei livelli**: una minimappa del livello aperto e un albero di tutti i livelli annidati per muoversi nei progetti grandi.
- **37. Selezione multipla e allineamento**: selezionare più blocchi con un riquadro, spostarli insieme, allinearli e distribuirli. Il percorso automatico dei fili intorno ai blocchi è passato alla voce 60 (blocco G).
- **38. Copia e incolla di gruppi**: duplicare un gruppo di blocchi con i fili interni e i loro livelli annidati, anche verso un altro livello o un altro progetto. Si appoggia alla selezione multipla della 37.
- **39. Rilascio 2.3.0**

### Blocco C · Requisiti e tracciabilità → 2.4.0
- **40. Attributi personalizzati dei requisiti**: campi in più (priorità, rischio, responsabile, stato di maturità) definiti in `settings.json`, filtrabili e visibili in Matrice e Documenti. Va per prima perché la 42 si appoggia agli stessi campi.
- **41. Re-import dei requisiti cliente con differenze**: un nuovo Excel del cliente mostra i requisiti nuovi, modificati e rimossi, e segnala i collegamenti rimasti orfani.
- **42. Verifica e VCRM**: per ogni requisito, oltre al metodo di verifica, uno stato (da verificare, superato, fallito) con il riferimento alla prova, e la Verification Cross Reference Matrix esportabile.
- **43. Analisi d'impatto**: scelto un requisito cliente o di libreria, vedere tutto quello che ne discende (blocchi, fili, testi, documenti) prima di modificarlo.
- **44. Rilascio 2.4.0**

### Blocco D · Versioni e revisioni → 2.5.0
- **45. Cestino e versioni sfogliabili**: una finestra per vedere i progetti nel cestino e le copie in `_versioni/`, con anteprima e ripristino in un clic. È la base della 46.
- **46. Baseline del progetto**: congelare una versione con nome (es. "PDR", "CDR") e confrontare due baseline con un diff di blocchi, fili e testi, evidenziato anche sul canvas.
- **47. Note di revisione sul canvas**: commenti ancorati a un blocco, un filo o un requisito, con stato aperto o chiuso, per le revisioni interne prima dell'emissione dei documenti.
- **48. Cruscotto di avanzamento**: percentuale di requisiti cliente coperti, problemi di coerenza aperti, requisiti non verificati (dalla 42) e note aperte (dalla 47), con l'andamento nel tempo letto dalle baseline.
- **49. Rilascio 2.5.0**

### Blocco E · Configurazioni e interoperabilità → 2.6.0
- **50. Varianti di prodotto**: blocchi e requisiti marcati per configurazione (es. versione base, versione estesa) e documenti generati per una sola variante.
- **51. Interoperabilità ReqIF e SysML v2**: import ed export dei requisiti in ReqIF (DOORS, Polarion) e dei blocchi in SysML v2 testuale, per scambiare il modello con altri strumenti; esporta anche attributi (40) e varianti (50).
- **52. Rilascio 2.6.0**

### Blocco F · Interfaccia e lavoro condiviso → 2.7.0
- **53. Tema scuro e accessibilità**: tema scuro, scala dell'interfaccia e uso completo da tastiera (navigazione fra blocchi e pin, collegamento senza mouse).
- **54. Interfaccia e documenti in inglese**: la lingua della UI e dei documenti esportati si sceglie nelle impostazioni, per i clienti esteri. Sta nell'ultimo blocco perché a quel punto i testi di tutti i blocchi precedenti sono stabili.
- **55. Libreria su cartella di rete condivisa**: più persone leggono la stessa libreria, con blocco in scrittura e avviso quando un collega la modifica.
- **56. Rilascio 2.7.0**

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
- **Tag di livello** accanto al titolo (es. `· Beta`): più o meno rigore per quella sola funzionalità. Senza tag vale il livello dell'epic: Alpha per v1, Beta per v2.
- **Workflow**: Prototype = niente dopo `/develop`; Alpha = `/check verify`; Beta = `/check verify` poi `/test`; GA = aggiunge `/check review` e `/document`.
- **Riga puntatore** (`spec <n> · code in <path>`): la spec la aggiunge `/architect`, il codice `/develop`.
