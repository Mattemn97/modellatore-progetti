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
| 3 | Import requisiti cliente | Slice 1 | planned |
| 4 | Controllo di coerenza | Slice 2 | planned |
| 5 | Gerarchia dei requisiti | Slice 3 | planned |
| 6 | Matrice di tracciabilità | Slice 3 | planned |
| 7 | Export documenti MIL-STD-498 | Slice 3 | planned |
| 8 | Filtri avanzati | Slice 4 | planned |
| 9 | Ispettore dei collegamenti | Slice 4 | planned |
| 10 | Gestione completa della libreria | Slice 4 | planned |
| 11 | Rifiniture dell'editor | Slice 4 | planned |

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

### 3. Import requisiti cliente · needs a decision
Importi da Excel o CSV le frasi del cliente (anche migliaia). Diventano i requisiti di un blocco Cliente che fa da padre del livello radice: ognuna è un blocco tondo da cui tiri fili verso i blocchi di sistema.
**Done when:** scegli un file, mappi le colonne (ID, testo, eventuali note), vedi un'anteprima con errori e duplicati, e dopo l'import i requisiti cliente compaiono come blocchi tondi alla radice; un secondo import dello stesso file aggiorna invece di duplicare.
- [ ] Design it (spec): `/architect import requisiti cliente`

## Slice 2: Coerenza

### 4. Controllo di coerenza · needs a decision
Il pulsante Verifica Coerenza evidenzia i requisiti non collegati, sul canvas e in un elenco, così vedi subito cosa manca per coprire il cliente.
**Done when:** un requisito cliente senza figli, o un requisito di blocco senza padre, è evidenziato sul canvas in ogni livello e compare nel report con il percorso del blocco; un clic sulla voce ti porta al blocco.
- [ ] Design it (spec): `/architect controllo di coerenza`

## Slice 3: Tracciabilità ed export

### 5. Gerarchia dei requisiti · needs a decision
Ricostruisce l'albero dei requisiti dal cliente fino ai livelli più bassi, attraversando i blocchi annidati, e lo mostra: scegli un requisito e vedi i suoi antenati e discendenti. Da decidere come trattare un blocco di libreria usato più volte (i suoi requisiti hanno gli stessi id in ogni istanza).
**Done when:** scelto un requisito vedi la catena completa padre → figli su tutti i livelli, e sul canvas si evidenziano i fili coinvolti.
- [ ] Design it (spec): `/architect gerarchia dei requisiti`

### 6. Matrice di tracciabilità · needs a decision
Tabella padre → figli con i documenti di ciascun lato, a video (pulsante Matrice Requisiti) ed esportabile in Markdown, filtrabile per documento.
**Done when:** la matrice elenca ogni derivazione con id, titolo e documenti di padre e figlio, segnala i padri senza figli, ed è esportabile in `.md`.
- [ ] Design it (spec): `/architect matrice di tracciabilità`

### 7. Export documenti MIL-STD-498 · needs a decision · Beta
Genera un file Markdown per documento (SSS, SSDD, IRS, IDD…) con la capitolazione formale del DID, mettendo ogni testo da esportare al suo posto (es. capacità e interfacce in capitoli diversi, metodi di verifica nelle disposizioni di qualifica, tracciabilità nel suo capitolo). Riferimento indicato da te: https://github.com/bradfa/MIL-STD-498
**Done when:** scegli un documento e ottieni un `.md` con i capitoli del DID, i testi dei requisiti nei capitoli giusti, il metodo di verifica di ognuno e la sezione di tracciabilità verso il livello padre.
- [ ] Design it (spec): `/architect export documenti MIL-STD-498`

## Slice 4: Editor rifinito

### 8. Filtri avanzati · needs a decision
Filtri su categoria, sottocategoria, documento e classe (capacità o tipologia di interfaccia), applicati a blocchi e fili, combinabili.
**Done when:** puoi combinare più filtri, blocchi e fili esclusi si attenuano o si nascondono, e i filtri restano attivi quando entri o esci da un blocco.
- [ ] Design it (spec): `/architect filtri avanzati`

### 9. Ispettore dei collegamenti
Clic su un filo: nel pannello a destra vedi i due requisiti collegati, la loro classe, il tipo di relazione (derivazione o collegamento tra blocchi) e puoi eliminarlo.
**Done when:** selezionando un filo l'ispettore mostra id, titolo, classe e testi dei due requisiti e il tipo di relazione; il filo selezionato è evidenziato.
- [ ] Build it: `/develop ispettore dei collegamenti`

### 10. Gestione completa della libreria
Completa la modifica della libreria: eliminare un blocco (avvisandoti se è usato nel progetto) e rinominarne l'id senza rompere le istanze.
**Done when:** elimini un blocco non usato, ricevi un avviso con l'elenco delle istanze se è usato, e rinominando l'id tutte le istanze lo seguono.
- [ ] Build it: `/develop gestione completa della libreria`

### 11. Rifiniture dell'editor
Piccoli difetti trovati nel codice: il rilascio di un blocco ignora zoom e pan, e lo spostamento delle porte con Shift non si scopre da soli.
**Done when:** un blocco rilasciato cade sotto il cursore a qualsiasi zoom, e lo spostamento delle porte è indicato nell'interfaccia.
- [ ] Build it: `/develop rifiniture dell'editor`

## Deferred
Fuori da questo giro, tenuti qui perché il piano resti onesto.
- **Export Word o PDF**: i documenti MIL-STD-498 anche in formato Word · needs a decision
- **Libreria condivisa tra più persone**: cartella di rete con gestione dei conflitti · needs a decision
- **Coerenza avanzata**: metodo di verifica mancante, testi senza documento, requisiti orfani per documento · needs a decision
- **Annulla della libreria**: ripristinare una copia di `_versioni/` con la sua voce di changelog, from spec 0002 · needs a decision
- **Distribuzione dell'exe**: pacchetto pronto con tutti i file accanto a `start.exe`

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
