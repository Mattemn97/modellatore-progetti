# 0021. Pannelli agganciabili con dockview

**Date**: 2026-10-05
**Status**: Proposed

## Summary

L'interfaccia a tre colonne fisse diventa un layout a pannelli come in un IDE: Libreria, Cliente, Coerenza, Gerarchia, Canvas e Ispettore si trascinano, si affiancano, si impilano a schede, si ridimensionano, si chiudono e si riaprono da un menu Finestra. Il lavoro di aggancio lo fa `dockview-core` (libreria MIT senza dipendenze, in TypeScript puro); il contenuto dei pannelli resta quello di oggi, con gli stessi id, spostato dentro i pannelli. Il layout si salva in `localStorage` e si riapre uguale; Ripristina layout torna alla disposizione predefinita.

## Requirements

**User stories**:
- Come progettista, voglio disporre i pannelli come mi servono (per esempio Cliente accanto all'Ispettore) e ritrovarli così alla riapertura, per lavorare senza ricomporre lo schermo ogni volta.
- Come progettista, voglio riaprire un pannello chiuso per sbaglio e tornare alla disposizione di partenza con un clic.

**Acceptance criteria**:
- **AC-1**: Al primo avvio (o senza layout salvato) la disposizione è quella di oggi: a sinistra un gruppo con le schede Libreria (attiva) e Cliente, largo circa il 20%; al centro il Canvas; a destra l'Ispettore, largo circa il 20%.
- **AC-2**: Ogni pannello si trascina per la sua scheda in un altro gruppo (diventa una scheda di quel gruppo) o sul bordo di un gruppo (lo affianca); i separatori ridimensionano i gruppi. Il Canvas si sposta e si ridimensiona ma non ha la ✕.
- **AC-3**: Un menu **🪟 Finestra** nella testata, accanto ad Aiuto, elenca i sei pannelli con una spunta su quelli aperti; scegliere un pannello chiuso lo riapre (nel gruppo di Libreria se c'è, altrimenti a sinistra del Canvas), scegliere uno aperto lo porta in primo piano. In fondo al menu c'è **Ripristina layout**, che torna alla disposizione di AC-1 senza toccare il progetto né le modalità.
- **AC-4**: Il layout (posizioni, dimensioni, schede attive, pannelli chiusi) si salva a ogni cambiamento e si riapre uguale dopo un riavvio. Un layout salvato illeggibile, di una versione diversa, senza Canvas o con pannelli sconosciuti viene ignorato: l'app parte con la disposizione di AC-1, senza errori.
- **AC-5**: Coerenza e Gerarchia restano modalità. Il pulsante della barra (o il menu Finestra) accende la modalità e apre il pannello in primo piano; spegnere la modalità dal pulsante chiude il pannello; chiudere il pannello con la ✕ spegne la modalità (il pulsante torna non premuto, i segni sul canvas spariscono). All'avvio le modalità sono spente come oggi, quindi i due pannelli non vengono riaperti anche se erano nel layout salvato.
- **AC-6**: Tutto quello che le schede fanno oggi resta uguale: Cliente e Coerenza si aggiornano quando il modello cambia, un clic su un requisito in Coerenza o Gerarchia porta in primo piano il pannello giusto, l'Ispettore mostra la selezione, il trascinamento dalla Libreria e dal Cliente sul canvas funziona, i pulsanti ☰ Libreria e ☰ Proprietà della barra aprono o chiudono i pannelli Libreria e Ispettore.
- **AC-7**: Il tour guidato e i mini tour non si rompono: un passo che spiega un pannello chiuso lo apre, e alla fine del tour i pannelli aperti apposta si richiudono.

## Decision

**Chosen option**: Option 1, `dockview-core` con i nodi DOM di oggi spostati dentro i pannelli.

Si aggiunge `dockview-core` (versione 8.x) alle dipendenze; un nuovo modulo `src/renderer/pannelli.ts` crea il layout, possiede l'elenco dei pannelli e offre agli altri moduli poche funzioni per aprirli, chiuderli e sapere se sono aperti.

**Decisioni di dettaglio** (prese qui, con il motivo):
- **Contenuto dei pannelli: spostato, non ridisegnato.** I contenitori di oggi (`#schedaLibreria`, `#schedaCliente`, `#schedaCoerenza`, `#schedaGerarchia`, `#canvasContainer`, `#propertiesPanel`) restano in `index.html` dentro un contenitore nascosto `#pannelliParcheggiati`. Quando dockview crea un pannello, il nodo viene spostato nel pannello; quando il pannello si chiude, torna nel parcheggio. Così ogni `getElementById` dei moduli continua a trovare il suo elemento anche a pannello chiuso e nessun modulo cambia il modo in cui disegna. In alternativa si poteva ricreare il contenuto a ogni apertura: molto più codice e ascoltatori da ricollegare.
- **Salvataggio in `localStorage`** con la chiave `modellatore.layout` e il valore `{ "versione": 1, "layout": <toJSON di dockview> }`, scritto dopo `onDidLayoutChange` con un ritardo di 300 ms. `localStorage` vive in `userData`, quindi sopravvive agli aggiornamenti e i test lo isolano già con `MODELLATORE_DATI_UTENTE`. In alternativa `configurazione.json` nel processo principale: un canale IPC in più per un dato che serve solo alla pagina.
- **Convalida del layout salvato** in una funzione pura `layoutValido(dato: unknown): boolean` (in `pannelli.ts`, testabile senza DOM): versione 1, un oggetto `layout` con `grid` e `panels`, tutte le chiavi di `panels` tra i sei id noti, `canvas` presente. Se `fromJSON` lancia comunque un errore, si usa la disposizione predefinita e si cancella la chiave.
- **Id dei pannelli**: `libreria`, `cliente`, `coerenza`, `gerarchia`, `canvas`, `ispettore`. Titoli delle schede: Libreria, Cliente, Coerenza, Gerarchia, Canvas, Ispettore.
- **Modalità e pannelli**: `coerenza.ts` e `gerarchia.ts` chiamano `mostraPannello()` e `chiudiPannello()` al posto di `mostraScheda()` e del controllo su `.scheda-pannello[hidden]`; registrano con `allaChiusura(id, funzione)` lo spegnimento della modalità. `chiudiPannello()` fatto dal codice e la ✕ dell'utente passano dallo stesso evento `onDidRemovePanel`, con una protezione contro la doppia chiamata (spegnere la modalità chiude il pannello che spegne la modalità). Al ripristino del layout, Coerenza e Gerarchia vengono chiuse senza chiamare le funzioni di chiusura.
- **Barra delle schede di oggi** (`.schede-pannello`, `mostraScheda` in `cliente.ts`) sparisce: `mostraScheda(nome)` diventa `mostraPannello(nome)` in tutti i chiamanti (cliente, coerenza, gerarchia, tour).
- **Pulsanti ☰ Libreria e ☰ Proprietà**: restano con i loro `data-aiuto`, ora aprono o chiudono i pannelli `libreria` e `ispettore`. Le classi `.side-panel`, `.collapsed` e le larghezze fisse spariscono dal CSS.
- **Stile**: tema chiaro di dockview (`dockview-theme-light`) con le variabili CSS ritoccate sui colori di oggi (bordi `#ddd`, scheda attiva in `#0078d4`). Il CSS di dockview entra nel bundle con un `import` in `avvio.ts`: esbuild produce `out/renderer/app.css`, collegato in `index.html` prima di `style.css`. Il protocollo serve già qualunque file di `out/renderer/`.
- **Dimensioni minime**: 180 px di larghezza per i pannelli laterali, 300 px per il Canvas, per evitare pannelli schiacciati a zero.
- **Pannelli staccati**: non in questa voce (voce 26), ma la scelta di dockview li rende possibili senza cambiare libreria.

## Feature design

**Modulo `src/renderer/pannelli.ts`** (interfaccia verso gli altri moduli):

| Funzione | Cosa fa |
|---|---|
| `avviaPannelli(): void` | crea il `DockviewComponent` in `#areaPannelli`, ripristina il layout salvato o quello predefinito, collega salvataggio e menu Finestra |
| `mostraPannello(id): void` | apre il pannello se è chiuso (posizione di AC-3) e lo porta in primo piano |
| `chiudiPannello(id): void` | chiude il pannello se è aperto (il Canvas no) |
| `pannelloAperto(id): boolean` | dice se il pannello è nel layout |
| `allaChiusura(id, funzione): void` | registra cosa fare quando il pannello si chiude |
| `ripristinaLayout(): void` | torna alla disposizione di AC-1 e cancella il layout salvato |
| `layoutValido(dato: unknown): boolean` | convalida pura del layout salvato (AC-4) |

**Struttura della pagina**: la testata, i banner e le finestre modali restano dove sono; `.main-area` contiene solo `#areaPannelli` (dockview occupa tutto lo spazio). Il menu Finestra usa gli stessi stili di `.menu-progetto` e `.menu-progetto-voci`, con `data-aiuto="header.finestra"` e il suo testo in `aiuto-testi.ts`.

**Value sourcing**:
| Azione | Valore | Da dove viene |
|---|---|---|
| Avvio | disposizione | `localStorage['modellatore.layout']` se `layoutValido`, altrimenti quella predefinita costruita in codice |
| Riapertura dal menu | posizione del pannello | gruppo del pannello `libreria` se aperto, altrimenti a sinistra del `canvas` |
| Spunte del menu | pannelli aperti | `pannelloAperto(id)` letto all'apertura del menu |
| Stato delle modalità | acceso o spento | i moduli `coerenza.ts` e `gerarchia.ts`, come oggi |

**Key invariants**:
- Il pannello `canvas` è sempre nel layout.
- Ogni nodo di contenuto sta in un solo posto: nel suo pannello o nel parcheggio.
- Modalità Coerenza accesa se e solo se il pannello `coerenza` è aperto; lo stesso per Gerarchia.

**Critical test scenarios** (pochi e leggeri, come chiesto):
- Unitario (`tests/unit/pannelli.test.ts`): `layoutValido` accetta un layout buono e rifiuta versione sbagliata, pannello sconosciuto, Canvas mancante, testo non JSON, verifica **AC-4**.
- End to end (`tests/e2e/ui/pannelli.spec.ts`, due test): chiudi Cliente con la ✕ e Ispettore dal menu, ricarica la pagina, sono ancora chiusi; riaprili dal menu Finestra, poi Ripristina layout riporta la disposizione predefinita; verifica **AC-1**, **AC-3**, **AC-4**. Accendi Coerenza, chiudi il suo pannello con la ✕, il pulsante della barra torna non premuto; verifica **AC-5**.
- La suite end to end esistente resta verde dopo aver sostituito i selettori `[data-scheda=...]` con le schede di dockview; verifica **AC-6**, **AC-7**.
- Il trascinamento a mano dei pannelli (AC-2) è compito di dockview: si controlla a mano in `/check verify`, senza un test end to end fragile.

## Build plan

1. Dipendenza `dockview-core`, modulo `pannelli.ts` con i sei pannelli e la disposizione predefinita, nodi spostati dal parcheggio, CSS nel bundle, colonne fisse e barra delle schede tolte; `mostraScheda` sostituita da `mostraPannello`; suite end to end verde con i selettori aggiornati, satisfies **AC-1**, **AC-2**, **AC-6**
2. Coerenza e Gerarchia legate ai loro pannelli (apertura, ✕ che spegne, ripristino che non le riapre); pulsanti ☰ sui pannelli; tour adattato, satisfies **AC-5**, **AC-6**, **AC-7**
3. Menu Finestra con spunte e Ripristina layout, salvataggio in `localStorage` con `layoutValido` e ricaduta sulla disposizione predefinita; aiuto del menu, satisfies **AC-3**, **AC-4**
4. Test: `tests/unit/pannelli.test.ts` e `tests/e2e/ui/pannelli.spec.ts`, satisfies **AC-3**, **AC-4**, **AC-5**

## Consequences

**Positive**:
- Disposizione libera e ricordata; la base per la voce 25 (Matrice, Documenti e Changelog come pannelli) e la 26 (finestre staccate) è già pronta.
- I moduli dell'editor quasi non cambiano: cambia chi decide dove stanno i loro contenitori.

**Negative / tradeoffs**:
- Una dipendenza in più nell'interfaccia (circa 100 kB compressi meno, senza dipendenze a sua volta), da aggiornare con le altre.
- Il layout salvato dipende dal formato `toJSON` di dockview: un aggiornamento importante della libreria può invalidarlo; in quel caso la convalida riparte dalla disposizione predefinita e si alza `versione`.

**Neutral**:
- I test end to end che cliccano le schede cambiano selettore.
- `docs`, `AGENTS.md` di `src/renderer` e il tutorial vanno aggiornati (il tutorial nella voce 27).

## Rationale

Vedi [rationale.md](rationale.md).
