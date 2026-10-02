# 0008. Filtri avanzati del canvas: classe, documento, categoria e sottocategoria, combinabili, con attenua o nascondi

**Date**: 2026-10-02
**Status**: Accepted

## Summary

Il menu a tendina "Filtra Tipologia" e la casella "Nascondi Non Coinvolti" lasciano il posto a un pulsante 🔎 Filtri che apre un pannello con quattro gruppi di caselle: Classe (capacità o tipologia di interfaccia), Documento, Categoria e Sottocategoria del blocco. Dentro un gruppo basta una voce scelta (o), tra gruppi servono tutte (e); un gruppo senza voci scelte non filtra. Gli elementi esclusi (blocchi, pin, blocchi tondi e fili) si attenuano oppure si nascondono, a scelta, e i filtri restano gli stessi quando entri o esci da un blocco. I filtri sono solo vista: vivono in un modulo nuovo `js/filtri.js`, mai nel file del progetto.

## Requirements

**User stories**:
- Come progettista voglio vedere solo i requisiti di un documento (es. IRS) o di una classe, così controllo una parte del modello senza il rumore del resto.
- Come progettista voglio filtrare per categoria e sottocategoria dei blocchi e combinare più filtri insieme.
- Come progettista voglio scegliere se gli elementi esclusi restano attenuati (per non perdere il contesto) o spariscono, e ritrovare gli stessi filtri a ogni livello.

**Acceptance criteria**:
- **AC-1**: Nella barra del canvas, al posto di "Filtra Tipologia" e "Nascondi Non Coinvolti", c'è il pulsante `🔎 Filtri` (`#btnFiltri`). Con N gruppi attivi (un gruppo è attivo se ha almeno una voce scelta) il testo diventa `🔎 Filtri (N)` e il pulsante ha `aria-pressed="true"`; con nessun gruppo attivo `🔎 Filtri` e `aria-pressed="false"`. Il clic apre o chiude il pannello `#pannelloFiltri` sotto la barra; un clic fuori dal pannello e dal pulsante lo chiude. Il pannello non è una finestra modale: il canvas resta usabile e si aggiorna subito a ogni cambio.
- **AC-2**: Il pannello ha quattro gruppi di caselle, in quest'ordine, ognuno con titolo e lista a scorrimento (altezza massima 180 px): **Classe** (`Capacità`, poi ogni tipologia di `settings.requirements.typeColors`); **Documento** (ogni voce di `settings.documenti`, poi i documenti dei `testiExport` della libreria assenti da `settings` in ordine alfabetico, poi `Cliente`); **Categoria** (le categorie distinte dei blocchi della libreria in ordine alfabetico, più `(senza categoria)` se un blocco non ne ha); **Sottocategoria** (stesse regole sui valori di `sottocategoria`, più `(senza sottocategoria)`). Valori confrontati senza spazi ai bordi, maiuscole distinte. Sotto i gruppi: la scelta **Elementi esclusi** con `Attenua` (predefinita) e `Nascondi`, il pulsante `Azzera filtri` (toglie tutte le voci scelte, non cambia Attenua/Nascondi) e la riga di riepilogo di AC-8.
- **AC-3**: Regola di un requisito: passa i filtri di requisito se (Classe non attiva o la sua classe è tra quelle scelte) e (Documento non attivo o almeno uno dei suoi documenti è tra quelli scelti). I documenti di un requisito di libreria sono i `documento` non vuoti dei suoi `testiExport` (spazi tolti); di un requisito cliente sono sempre `Cliente`. La classe è quella di `getClasseRequisito()`.
- **AC-4**: Regola di un blocco (nodo con definizione in libreria): passa i filtri di blocco se (Categoria non attiva o la sua categoria, o `(senza categoria)` se vuota, è tra quelle scelte) e (Sottocategoria non attiva o lo stesso per la sottocategoria). Un blocco è **incluso** se passa i filtri di blocco e, quando Classe o Documento sono attivi, almeno uno dei suoi requisiti passa i filtri di requisito. Senza filtri attivi tutto è incluso.
- **AC-5**: Un **pin** di un requisito di un blocco è incluso se il blocco passa i filtri di blocco e il requisito passa i filtri di requisito. Un **blocco tondo** (requisito del blocco che contiene il livello, o requisito cliente alla radice) è incluso se il suo requisito passa i filtri di requisito: i filtri di blocco non si applicano al blocco in cui sei entrato. Un **filo** è incluso se almeno uno dei suoi due estremi (pin o blocco tondo) è incluso.
- **AC-6**: Con `Attenua` ogni elemento escluso (rettangolo e scritta del blocco, pin, blocco tondo, filo con i suoi snodi) si disegna con opacità 0,25; nulla sparisce. Con `Nascondi`: un filo escluso non si disegna; un blocco escluso non si disegna, salvo che sia estremo di un filo incluso (allora si disegna attenuato); un blocco tondo escluso non si disegna, salvo che sia estremo di un filo incluso (attenuato); un pin escluso di un blocco disegnato resta attenuato (non sparisce, per non spostare gli altri pin).
- **AC-7**: Con una scelta della Gerarchia attiva (spec 0005) decide la catena, come oggi: gli elementi della catena si disegnano pieni e quelli fuori catena attenuati, anche se i filtri li escluderebbero; con `Nascondi` gli elementi della catena si disegnano comunque. Il controllo di Coerenza (spec 0004) segue solo il gruppo Classe, come seguiva "Filtra Tipologia": un problema resta se non ha classe o la sua classe è tra quelle scelte (Classe non attiva: tutti); l'avviso della scheda Coerenza dice `Filtro attivo: <classi scelte separate da virgola>`. La Matrice e i Documenti (spec 0006, 0007) non seguono questi filtri.
- **AC-8**: In fondo al pannello la riga `In questo livello: <B> blocchi e <F> fili esclusi` conta, nel livello sul canvas, i blocchi (nodi con definizione) e i fili esclusi dai filtri, ignorando la Gerarchia; con nessun filtro attivo dice `Nessun filtro attivo`. Si aggiorna a ogni disegno del canvas.
- **AC-9**: Filtri e modalità restano gli stessi quando entri in un blocco, risali con il breadcrumb o Indietro, cambi progetto, usi Annulla e Ripeti; durano finché la pagina resta aperta e non entrano mai nel file del progetto (nessun salvataggio e nessuna versione per un cambio di filtro). Quando la libreria cambia (salvataggio di un blocco, ricarica, cambio di progetto) le voci si ricalcolano e una voce scelta che non c'è più si toglie dalla scelta.
- **AC-10**: Un blocco senza definizione in libreria si disegna come oggi (cioè non si disegna) e non entra nei conteggi. Un estremo di filo il cui requisito non si trova (`trovaRequisito()` nullo) o il cui blocco non ha definizione conta come non incluso. Un estremo di tipo `parent` è il blocco tondo: vale solo `requisitoIncluso(req)`, mai i filtri di blocco.
- **AC-11**: Gli snodi di un filo seguono il filo: attenuati se il filo è escluso con `Attenua`, non disegnati se il filo non si disegna, pieni se il filo è nella catena della Gerarchia. L'attenuazione di un pin dipende solo dall'inclusione del pin, mai da quella del suo blocco; un pin escluso resta collegabile come oggi. Con la catena attiva la classe del filtro non si aggiunge a nessun elemento (decide la catena); con `Nascondi` un filo si disegna se è nella catena o incluso, e un blocco si disegna se è nella catena (`nodoNellaCatena()`), incluso, o estremo di un filo disegnato.

## Decision

**Chosen option**: Option 1: un modulo nuovo `js/filtri.js` con lo stato dei filtri (fuori da `appState`), le regole pure di inclusione e il pannello; il renderer chiede a lui cosa è incluso, al posto di `passaFiltro()`.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Stato fuori da `appState`**: `js/filtri.js` tiene `stato = { classi: Set, documenti: Set, categorie: Set, sottocategorie: Set, modo: 'attenua' | 'nascondi' }`. È stato di sola vista (convenzione di `js/AGENTS.md`). `appState.activeTypeFilter` e `appState.omitUninvolved`, il `<select id="filterTypeSelect">`, `#chkOmitUninvolved`, `popolaFiltroTipologia()` e i loro gestori in `app.js` si tolgono. Scartato: tenerli in `appState` accanto ai nuovi (due fonti di verità).
- **Valori vuoti**: le voci `(senza categoria)` e `(senza sottocategoria)` hanno valore interno `''` (stringa vuota); in tutti i confronti si usa `String(valore ?? '').trim()`.
- **Interfaccia del modulo** (tutte pure salvo il pannello): `requisitoIncluso(req)`, `bloccoPassa(def)`, `bloccoIncluso(def)`, `filtriAttivi()` (numero di gruppi attivi), `modoNascondi()`, `classePassa(classe)` per la Coerenza, `descriviClassi()` per l'avviso, `riallineaFiltri()` (ricalcola le voci e toglie le scelte sparite), `aggiornaRiepilogoFiltri(blocchiEsclusi, filiEsclusi)`, `initFiltri()`.
- **Renderer**: una funzione pura `calcolaInclusi(graph, tipoPadre)` in `renderer.js` (usa le regole di `filtri.js` e `trovaRequisito()`) restituisce `{ estremi: Set<'ownerType:ownerId:reqId'>, nodi: Set<nodeId>, fili: Set<edgeId> }` per il livello (alla radice l'ownerId dei blocchi tondi è `ID_CLIENTE`); `render()` la chiama una volta e la usa sia per disegnare (AC-6, AC-7, AC-11) sia per i conteggi di AC-8. La classe CSS `.fuori-filtro { opacity: 0.25; }` sostituisce gli `style.opacity = '0.25'` di oggi. Se la catena della Gerarchia è attiva, la catena decide l'attenuazione (classi `fuori-catena`) e i filtri decidono solo cosa si nasconde con `Nascondi`, con la regola "un elemento della catena si disegna sempre". Scartato: far filtrare a ogni funzione di disegno per conto suo (regole sparse che divergono).
- **Fili**: oggi un filo escluso non si disegna mai; con `Attenua` (predefinito) ora si disegna attenuato. È il cambiamento voluto: nulla sparisce senza che tu lo chieda.
- **Coerenza**: `passaClasse()` e l'avviso in `coerenza.js` usano `classePassa()` e `descriviClassi()`; l'impronta della scheda usa `descriviClassi()` al posto di `appState.activeTypeFilter`.
- **Pannello**: `<div id="pannelloFiltri" class="pannello-filtri" hidden>` dentro `.canvas-toolbar` (posizione assoluta sotto il pulsante, sopra il canvas, `z-index` sopra l'SVG), griglia di quattro colonne che va a capo su schermi stretti. Ogni casella ha `data-gruppo` e `value`; un solo gestore `change` delegato sul pannello aggiorna lo stato e chiama `render()`. Le voci si ricostruiscono a ogni apertura del pannello e in `riallineaFiltri()`.
- **Riallineamento**: `riallineaFiltri()` si chiama da `initLibrary()` (`builder.js`), che gira a ogni cambio di libreria e di progetto (da verificare in build che il salvataggio di un blocco passi di lì; altrimenti si chiama anche dopo `salvaBloccoLibreria()`); se una scelta sparisce, chiama `render()` dopo averla tolta. Non si chiama mai dentro `render()`.
- **Salvataggio**: un cambio di filtro chiama `render()`, che ripianifica il salvataggio; `salva()` esce senza scrivere perché `testoProgetto()` non cambia. Effetto accettato: un clic sui filtri sposta di un `debounceMs` il salvataggio di una modifica vera in attesa.
- **Riepilogo per livello**: il renderer passa a `aggiornaRiepilogoFiltri()` i conteggi del livello appena disegnato, senza Gerarchia; il pannello scrive solo se aperto (testo in `textContent`).

**Implementation skills**: none (stack senza skill della comunità, vedi `AGENTS.md`).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (solo in memoria, mai nel file del progetto; nessuna migrazione):

```
StatoFiltri = {
  classi: Set<string>,          // 'Capacità' o una tipologia
  documenti: Set<string>,       // nomi di documento, 'Cliente' per i requisiti cliente
  categorie: Set<string>,       // '' = (senza categoria)
  sottocategorie: Set<string>,  // '' = (senza sottocategoria)
  modo: 'attenua' | 'nascondi'  // predefinito 'attenua'
}
VociFiltri = { classi: string[], documenti: string[], categorie: string[], sottocategorie: string[] }   // ricalcolate
```

Un gruppo è attivo se il suo Set non è vuoto. Relazioni: nessuna verso il modello; le regole leggono `req` e `def` al momento del disegno.

**State transitions**: pannello `chiuso` ↔ `aperto` (pulsante, clic fuori); `modo` `attenua` ↔ `nascondi`; ogni casella aggiunge o toglie una voce dal Set del suo gruppo; `Azzera filtri` svuota i quattro Set.

**API surface** (nessuna rotta server; funzioni client):

| Funzione | Input | Output | Casi |
|---|---|---|---|
| `requisitoIncluso(req)` (`filtri.js`) | requisito di libreria o cliente | booleano (AC-3) | `req` nullo: falso |
| `bloccoPassa(def)` / `bloccoIncluso(def)` (`filtri.js`) | definizione di libreria | booleano (AC-4) | `def` nullo: falso |
| `classePassa(classe)` (`filtri.js`) | classe o `null` | booleano (AC-7) | `null`: vero |
| `descriviClassi()` (`filtri.js`) | | `''` o le classi scelte separate da `, ` | |
| `filtriAttivi()`, `modoNascondi()` (`filtri.js`) | | numero, booleano | |
| `riallineaFiltri()` (`filtri.js`) | | ricalcola voci, toglie scelte sparite, `render()` se è cambiato qualcosa | |
| `aggiornaRiepilogoFiltri(b, f)` (`filtri.js`) | conteggi del livello | testo di AC-8 | |
| `initFiltri()` (`filtri.js`, chiamata da `initApp()`) | | gestori di `#btnFiltri`, pannello, clic fuori | |
| `render()` (`renderer.js`, cambia) | | applica AC-5, AC-6, AC-7, passa i conteggi | |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Voci | Classe | `CAPACITA` più `getTipologie()` |
| Voci | Documento | `appSettings.documenti`, poi `testiExport[].documento` di `appState.library` assenti da settings (alfabetico), poi `Cliente` |
| Voci | Categoria, Sottocategoria | `def.categoria`, `def.sottocategoria` di ogni blocco di `appState.library`, trim, distinti, alfabetico; `''` se vuoti |
| Regola | classe di un requisito | `getClasseRequisito(req)` |
| Regola | documenti di un requisito | `testiExport[].documento` trim non vuoti; `Cliente` se `isRequisitoCliente(req)` |
| Regola | categoria di un blocco | `appState.library[node.type].categoria` |
| Disegno | catena della Gerarchia | `catenaAttiva()`, `occorrenzaInCatena()`, `filoInCatena()`, `nodoNellaCatena()` (spec 0005) |
| Pulsante | N | `filtriAttivi()` |
| Riepilogo | blocchi e fili esclusi | conteggi di `render()` sul livello corrente |
| Coerenza | avviso | `descriviClassi()` |

**Key invariants**:
- Un cambio di filtro non tocca mai il modello e non fa partire il salvataggio (lo stato non è in `appState` né in `testoProgetto()`; `render()` pianifica il salvataggio, ma il testo del progetto non cambia e il server non scrive se l'impronta è uguale).
- Un filo con almeno un estremo incluso è sempre visibile; un blocco estremo di un filo visibile è sempre disegnato.
- La catena della Gerarchia è sempre visibile, qualunque filtro.
- La Coerenza vede solo il gruppo Classe.

**Security model**: un solo utente in locale, nessun dato nuovo, nessuna rotta. Le etichette delle voci vengono da testo dell'utente (categorie, documenti): passano per `escapeHtml()` nel pannello.

**Configuration required**: nessuna chiave nuova (l'opacità sta nel CSS, come `.fuori-catena`).

**Critical test scenarios**:
- Combinazione: libreria con Centralina (Elettrica/Controllo; `CEN_001` Capacità con testo SSS, `CEN_003` Elettrica con testo IRS) e Pompa (Fluidica/Idraulica; `PMP_001` Elettrica, IRS). Documento IRS: Centralina e Pompa incluse, pin `CEN_001` attenuato. Documento IRS più Categoria Fluidica: Centralina esclusa (attenuata), Pompa inclusa, il filo `CEN_003` → `PMP_001` incluso perché la Pompa è inclusa. Pulsante `🔎 Filtri (2)`. Verifica **AC-1**, **AC-3**, **AC-4**, **AC-5**.
- Nascondi: stessi filtri, `Nascondi`: la Centralina resta disegnata (attenuata) perché estremo di un filo incluso; un terzo blocco escluso senza fili sparisce; un filo escluso sparisce. Riepilogo `In questo livello: 2 blocchi e 1 fili esclusi`. Verifica **AC-6**, **AC-8**.
- Livelli: entra nella Centralina, i blocchi tondi seguono i filtri di requisito (non quelli di blocco); risali: i filtri sono gli stessi; Annulla non li cambia; nessuna versione nuova del progetto. Verifica **AC-5**, **AC-9**.
- Gerarchia e Coerenza: scelta in Gerarchia su `CEN_003`: la catena è piena anche con un filtro Capacità; Coerenza con Classe Elettrica conta solo i problemi elettrici e l'avviso dice `Filtro attivo: Elettrica`. Verifica **AC-7**.
- Libreria che cambia: scegli la categoria `Fluidica`, poi cambi la categoria della Pompa in `Idraulica` e salvi: la scelta `Fluidica` sparisce e tutto torna incluso. Verifica **AC-9**, **AC-2**.
- Voci: `(senza categoria)` compare solo se un blocco non ha categoria; `Cliente` è l'ultima voce di Documento; `Azzera filtri` toglie tutto ma lascia `Nascondi`. Verifica **AC-2**.

## Build plan

Tracer Bullet: prima il filo minimo dal pannello al canvas con il solo gruppo Classe e `Attenua` (sostituisce il filtro di oggi senza perdere nulla), poi gli altri gruppi, poi `Nascondi` e il riepilogo, poi Gerarchia, Coerenza e riallineamento.

1. **Filo minimo**: `js/filtri.js` con stato, `requisitoIncluso()` (sola classe), pannello con il gruppo Classe; `#btnFiltri` e `#pannelloFiltri` in `index.html`, stile `.pannello-filtri` e `.fuori-filtro`; renderer con la mappa degli estremi inclusi e `Attenua` su pin, blocchi tondi, blocchi e fili; rimozione di `filterTypeSelect`, `chkOmitUninvolved`, `activeTypeFilter`, `omitUninvolved`, `popolaFiltroTipologia()`; Coerenza su `classePassa()`. Satisfies **AC-1**, **AC-3**, **AC-5**, **AC-6**, **AC-7**.
2. **Tutti i gruppi**: Documento, Categoria, Sottocategoria con le voci di AC-2, `bloccoPassa()` e `bloccoIncluso()`, `Azzera filtri`. Satisfies **AC-2**, **AC-3**, **AC-4**.
3. **Nascondi e riepilogo**: regole di `Nascondi` con gli estremi dei fili inclusi, riepilogo per livello, catena della Gerarchia sempre disegnata. Satisfies **AC-6**, **AC-7**, **AC-8**, **AC-10**, **AC-11**.
4. **Persistenza e riallineamento**: `riallineaFiltri()` da `initLibrary()`, prove di livelli, cambio progetto, Annulla e Ripeti senza versioni nuove. Satisfies **AC-9**.

## Consequences

**Positive**:
- Un solo punto per le regole di filtro; il renderer non decide più da solo cosa passa.
- I filtri smettono di vivere in `appState`: non rischiano di finire nel file del progetto.
- Nessuna dipendenza o rotta nuova.

**Negative / tradeoffs**:
- Cambia un comportamento noto: i fili di un'altra classe oggi spariscono, ora di predefinito si attenuano (per farli sparire serve `Nascondi`).
- "Nascondi Non Coinvolti" sparisce come casella: chi la usava ora sceglie `Nascondi` nel pannello.
- Con Categoria attiva un filo verso un blocco escluso resta visibile se l'altro estremo è incluso: utile per il contesto, ma il canvas filtrato non è mai "solo" la categoria scelta.
- La Coerenza segue solo la classe: filtrando per documento la scheda Coerenza mostra ancora tutti i problemi.

**Neutral**:
- `render()` cambia in un punto già denso (Gerarchia, Coerenza, catena): vanno riprovati gli scenari di spec 0004 e 0005 legati all'attenuazione.
- Nuovo modulo `js/filtri.js` da riportare in `js/AGENTS.md`.

## Follow-up

- [ ] Valutare con l'uso se i filtri devono restare tra una sessione e l'altra (per esempio in `localStorage`).
- [ ] Valutare se la Matrice deve poter partire dai filtri del canvas.
