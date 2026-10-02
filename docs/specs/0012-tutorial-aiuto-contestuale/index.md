# 0012. Tutorial guidato e aiuto contestuale con le icone (i)

**Date**: 2026-10-02
**Status**: In Progress

## Summary

L'app ha molte aree e molti campi con un significato preciso (tipologia, metodo di verifica, documento, livello della versione…) che oggi si capiscono solo leggendo il tutorial esterno. Aggiungiamo due aiuti dentro l'app: un tour guidato a passi (lo schermo si scurisce tranne l'area spiegata, un fumetto accanto con Avanti, Indietro, Salta) che parte da solo al primo avvio e si rilancia dal nuovo menu ❓ Aiuto, più piccoli tour dentro Matrice, Documenti, Import cliente e Filtri; e una (i) accanto a ogni campo che, passandoci sopra con il mouse o con Tab, mostra cosa rappresenta quel campo. Tutto è scritto a mano in JS, senza librerie, e i testi stanno in un solo file `js/aiuto-testi.js`.

## Requirements

**User stories**:
- Come nuovo utente voglio un giro guidato dell'interfaccia, così capisco a cosa serve ogni area senza leggere un manuale.
- Come progettista voglio sapere cosa rappresenta un campo (per esempio "Tipologia" o "Livello") passandoci sopra, senza uscire da quello che sto facendo.
- Come utente esperto voglio poter nascondere le (i) e rivedere il tour solo quando lo chiedo.

**Acceptance criteria**:
- **AC-1**: Nell'header, a sinistra del menu Progetto, c'è il pulsante `❓ Aiuto ▾` che apre un menu con due voci: `Tour guidato` (avvia il tour principale) e `Mostra le (i)` con una spunta che riflette lo stato attuale. Il menu si chiude con un clic fuori o scegliendo una voce, come il menu Progetto.
- **AC-2**: Al primo avvio in un browser (chiave `modellatore.tourVisto` assente in `localStorage`) il tour principale parte da solo quando l'avvio è finito (progetto e libreria caricati) e nessuna finestra modale è aperta; se una finestra è aperta (per esempio Apri progetto), parte appena si chiude. Chiudere il tour in qualsiasi modo (Fine, Salta, ✕, Esc) scrive `modellatore.tourVisto = '1'` e il tour non riparte da solo. Senza `localStorage` il tour parte a ogni avvio (nessun errore).
- **AC-3**: Ogni passo del tour mostra: un riflettore sull'area spiegata (il resto dello schermo scurito), un fumetto accanto all'area con titolo, testo, `Passo N di M`, i pulsanti `Indietro` (disabilitato al primo passo), `Avanti` (`Fine` all'ultimo), `Salta il tour` e `✕`. Il fumetto resta tutto dentro la finestra del browser: si mette dal lato dell'area con più spazio. Un passo senza area (benvenuto, fine) mostra il fumetto al centro senza riflettore.
- **AC-4**: Durante il tour i clic fuori dal fumetto non arrivano all'app (niente modifiche al modello per errore). Da tastiera: `→` e `Invio` vanno avanti, `←` torna indietro, `Esc` chiude il tour; questi tasti non arrivano agli altri gestori (Esc della Gerarchia, Ctrl+Z e Ctrl+Y sono fermi per tutto il tour). Il fuoco va sul pulsante `Avanti` a ogni passo.
- **AC-5**: Il tour principale ha questi passi, in ordine: Benvenuto · percorso dei livelli (breadcrumb e Indietro) · salvataggio automatico, Annulla e Ripeti · menu Progetto · menu Aiuto · schede del pannello sinistro · Libreria (percorso, ricerca, albero da trascinare sul canvas, versione e Changelog) · scheda Cliente · canvas (zoom, pan, doppio clic per entrare, fili tra pin) · riga dei gesti · Filtri · Matrice Requisiti e Documenti · Verifica Coerenza · Gerarchia · Reset Vista e pulsanti ☰ dei pannelli · Ispettore e + Nuovo Blocco · Fine (ricorda le (i) e i tour delle finestre).
- **AC-6**: Se l'area di un passo è nascosta perché un pannello laterale è chiuso o un'altra scheda del pannello sinistro è attiva, il tour la rende visibile per quel passo (apre il pannello, attiva la scheda). Alla chiusura del tour i pannelli e la scheda attiva tornano come erano all'avvio del tour. Se l'area manca comunque (elemento assente o di dimensione zero), il passo mostra il fumetto al centro senza riflettore, senza errori.
- **AC-7**: Il riflettore e il fumetto seguono l'area quando la finestra del browser cambia dimensione o l'area scorre.
- **AC-8**: Le finestre Matrice, Documenti e Import cliente hanno un pulsante `❓` nella testata, accanto al ✕; il pannello Filtri ne ha uno in alto. Il `❓` avvia il mini tour di quella finestra (Matrice: filtri, conteggi, tabella, export · Documenti: scelta del documento, riepilogo, anteprima, export · Import cliente: file, foglio e riga di intestazione, mappatura delle colonne, modalità, anteprima, conferma · Filtri: gruppi, Attenua o Nascondi, Azzera). Nei mini tour un passo la cui area non c'è in quel momento viene saltato e il conteggio `Passo N di M` conta solo i passi presenti. I mini tour non toccano `modellatore.tourVisto`. Chiuso il mini tour, la finestra resta aperta com'era.
- **AC-9**: Accanto a ogni campo elencato nell'inventario (sezione *Inventario delle (i)*) c'è un'icona (i) piccola e rotonda. Passando il mouse sopra l'icona, dopo circa 300 ms, compare un suggerimento con il testo di quel campo; con Tab l'icona prende il fuoco e il suggerimento compare subito. Uscendo con il mouse, perdendo il fuoco, premendo Esc, scorrendo o cliccando altrove il suggerimento sparisce. Il suggerimento resta dentro la finestra del browser (sopra l'icona se c'è spazio, altrimenti sotto, spostato in orizzontale per non uscire dai bordi).
- **AC-10**: I pulsanti elencati nell'inventario mostrano lo stesso suggerimento ricco passandoci sopra o con il fuoco, senza (i); il loro vecchio attributo `title` viene tolto, così non compaiono due suggerimenti insieme.
- **AC-11**: Le (i) compaiono anche nei contenuti ridisegnati dal codice (ispettore, dettaglio cliente, dettaglio collegamento, import cliente, Filtri, Changelog) ogni volta che vengono ridisegnati, e il suggerimento funziona senza registrare ascoltatori nuovi a ogni ridisegno.
- **AC-12**: La voce `Mostra le (i)` toglie o rimette tutte le icone (i) in tutta l'app, anche in quelle disegnate dopo; la scelta resta per quel browser (`modellatore.iconeAiutoNascoste = '1'` quando nascoste). I suggerimenti dei pulsanti (AC-10) restano sempre attivi.
- **AC-13**: Ogni chiave usata da una (i), da un pulsante o da un passo di tour esiste in `js/aiuto-testi.js`; una chiave mancante non rompe nulla (nessun suggerimento, un `console.warn` con la chiave). I testi sono in italiano, spiegano cosa rappresenta il campo e, dove serve, l'effetto (per esempio "Tipologia: con una tipologia il requisito è di interfaccia, porta sul bordo; vuota è di capacità, pin quadrato interno").
- **AC-14**: Il tutorial esterno `packaging/TUTORIAL.md` cita il menu ❓ Aiuto, il tour e le (i).

## Decision

**Chosen option**: Opzione 2, due moduli scritti a mano (`js/aiuto.js` per suggerimenti e menu, `js/tour.js` per il tour) con tutti i testi e le liste dei passi come dati in `js/aiuto-testi.js`; le (i) sono `span` con `data-aiuto="chiave"`, gestite da un solo ascoltatore delegato sul `document`.

**Decisioni di dettaglio** (prese da me, con l'alternativa scartata):
- **Un solo elemento suggerimento** `#suggerimento` (`role="tooltip"`) creato una volta e riposizionato; il trigger riceve `aria-describedby="suggerimento"` mentre è visibile. Scartato: un suggerimento CSS puro per ogni icona (non si sposta ai bordi, non funziona bene dentro i pannelli che tagliano l'overflow).
- **Delega degli eventi**: `mouseover`, `mouseout`, `focusin`, `focusout` sul `document` cercano `closest('[data-aiuto]')`. Così il contenuto rifatto con `innerHTML` funziona da solo (AC-11). Scartato: ascoltatori a ogni ridisegno (si moltiplicano e si perdono).
- **Icona**: `iconaAiuto(chiave)` esportata da `aiuto.js` restituisce `<span class="icona-aiuto" data-aiuto="chiave" tabindex="0" role="button" aria-label="Informazioni: <titolo>">i</span>`; nell'HTML statico lo stesso markup scritto a mano. Per nasconderle: classe `senza-icone-aiuto` sul `body` e CSS `.senza-icone-aiuto .icona-aiuto { display: none; }` (vale anche per il contenuto disegnato dopo, AC-12).
- **Pulsanti**: `data-aiuto` direttamente sul pulsante, nessuna icona; il `title` viene tolto dall'HTML e dai template (AC-10). I pulsanti che cambiano `title` a runtime (`btnTogliCliente`) passano a una chiave scelta dal codice nello stesso punto.
- **Riflettore**: un `div` `#tourRiflettore` posizionato sul rettangolo dell'area (più 6 px di margine) con `box-shadow: 0 0 0 9999px rgba(0,0,0,.55)` e bordi arrotondati, sotto il fumetto, dentro un `#tourOverlay` fisso a tutto schermo che intercetta i clic (AC-4). Scartato: maschera SVG con un buco (più codice, stesso effetto).
- **Posizione del fumetto**: prova destra, sinistra, sotto, sopra dell'area, sceglie il primo lato dove entra tutto, altrimenti quello con più spazio, poi lo stringe dentro la finestra con 8 px di margine (AC-3). Ricalcolo su `resize` e su `scroll` in fase di cattura (AC-7).
- **Tastiera**: un ascoltatore `keydown` su `window` in fase di cattura, attivo solo durante il tour, che gestisce i tasti e chiama `stopPropagation()`; in più `modaleAperta()` di `progetto.js` restituisce `true` mentre il tour è aperto, così Ctrl+Z e l'Esc della Gerarchia restano fermi anche se un evento passasse (AC-4).
- **Preparazione dei passi** (AC-6): ogni passo ha un campo `prepara` facoltativo con un nome tra `pannelloSinistro`, `pannelloDestro`, `scheda:<nome>`; `tour.js` salva all'avvio le classi `collapsed` dei due pannelli e la scheda attiva, le applica per il passo, le ripristina alla chiusura. Le schede si cambiano con `mostraScheda()` di `cliente.js`. Le schede Coerenza e Gerarchia non sono usate come area (sono nascoste a modalità spenta): i passi puntano ai pulsanti della barra.
- **Primo avvio** (AC-2): `initAiuto()` dopo `avviaProgetti()`; se `tourVisto` manca e `modaleAperta()` è falso parte subito, altrimenti un controllo ogni 500 ms (fermato appena il tour parte) aspetta che la finestra si chiuda. Scartato: rimandare al prossimo avvio (al primo avvio l'utente potrebbe non vederlo mai).
- **Mini tour** (AC-8): stesso motore, lista di passi con `facoltativo: true` implicito: prima di mostrare il tour si filtrano i passi la cui area non c'è o ha dimensione zero; se non ne resta nessuno il pulsante ❓ mostra solo il passo di introduzione al centro.
- **Posto delle (i) nei form**: dentro l'etichetta, subito dopo il testo (`<strong>Tipologia <span class="icona-aiuto">…`); per i campi dei requisiti senza etichetta (le righe di `req-card`) una riga di piccole etichette con le (i) sopra la prima scheda requisito, non ripetuta in ogni scheda, così l'ispettore non si riempie di icone. Nei dettagli in sola lettura (`rigaDettaglio`) un parametro facoltativo `chiaveAiuto`.

**Implementation skills**: none.

## Feature design

**Data model sketch**: nessun dato nel modello del progetto o della libreria, nessuna scrittura su disco. Due chiavi per browser in `localStorage` (`modellatore.tourVisto`, `modellatore.iconeAiutoNascoste`), lette e scritte dentro `try/catch` come `modellatore.aiutoCanvasNascosto` di spec 0011. Stato di sola vista in variabili dei moduli (tour aperto, passo, stato da ripristinare), mai in `appState`.

Forma dei dati in `js/aiuto-testi.js`:
- `SUGGERIMENTI`: `{ [chiave]: { titolo: string, testo: string } }`; le chiavi sono a punti per area (`ispettore.tipologia`, `matrice.lato`, `barra.coerenza`…).
- `TOUR`: `{ principale: Passo[], matrice: Passo[], documenti: Passo[], importCliente: Passo[], filtri: Passo[] }` con `Passo = { area: string | null (selettore CSS), titolo: string, testo: string, prepara?: string }`.

**State transitions**: tour `chiuso → aperto(passo i) → chiuso`; da `aperto(i)`: Avanti → `aperto(i+1)` o `chiuso` all'ultimo, Indietro → `aperto(i-1)`, Salta, ✕, Esc → `chiuso`. Un tour per volta: avviarne uno con un altro aperto chiude il primo. Suggerimento: `nascosto → in attesa (300 ms, solo mouse) → visibile → nascosto`.

**API surface** (funzioni tra moduli, nessuna rotta nuova sul server):

| Funzione | Modulo | Input | Output | Note |
|---|---|---|---|---|
| `initAiuto()` | `aiuto.js` | nessuno | nessuno | crea `#suggerimento`, delega gli eventi, applica `senza-icone-aiuto`, collega il menu ❓ e i pulsanti ❓ delle finestre, avvia il tour al primo avvio |
| `iconaAiuto(chiave)` | `aiuto.js` | `chiave: string` | stringa HTML | usata nei template di `inspector.js`, `cliente.js`, `filtri.js`, `libreria.js` |
| `avviaTour(nome)` | `tour.js` | `nome: 'principale' \| 'matrice' \| 'documenti' \| 'importCliente' \| 'filtri'` | nessuno | nome sconosciuto: `console.warn`, niente |
| `tourAttivo()` | `tour.js` | nessuno | `boolean` | letta da `modaleAperta()` |

**Value sourcing**:

| Azione | Valore | Sorgente |
|---|---|---|
| Suggerimento | titolo e testo | `SUGGERIMENTI[el.dataset.aiuto]` |
| Suggerimento | posizione | `getBoundingClientRect()` del trigger e `window.innerWidth/innerHeight` |
| Passo | area | `document.querySelector(passo.area)` al momento del passo |
| Passo | `N di M` | indice nella lista dei passi del tour (nei mini tour, dopo il filtro dei passi presenti) |
| Primo avvio | già visto | `localStorage['modellatore.tourVisto'] === '1'` |
| Primo avvio | finestra aperta | `modaleAperta()` di `progetto.js` |
| (i) nascoste | stato | `localStorage['modellatore.iconeAiutoNascoste'] === '1'` |
| Ripristino | pannelli e scheda | classi `collapsed` di `#libraryPanel` e `#propertiesPanel` e `.scheda-pannello.attiva` letti all'avvio del tour |
| Testi delle (i) dei menu di import | etichetta | `CAMPI` di `cliente.js`, chiave `import.colonna.<chiave>` |

**Key invariants**:
- Il tour e i suggerimenti non cambiano mai `appState`, `pathStack` né i file su disco; chiudere il tour riporta la vista com'era.
- Esiste al più un tour aperto e un suggerimento visibile.
- Ogni `data-aiuto` nel codice ha una voce in `SUGGERIMENTI`; ogni testo è passato con `textContent`, mai `innerHTML` (niente HTML iniettato dai testi).

**Security model**: nessun dato dell'utente coinvolto; i testi sono statici. Le chiavi in `localStorage` contengono solo `'1'`.

**Configuration required**: nessuna voce nuova in `settings.json` (testi e passi non sono valori da regolare). Il ritardo di 300 ms e i margini sono costanti in `aiuto.js`.

**Inventario delle (i)** (campi con icona; i pulsanti con suggerimento sul pulsante sono in corsivo):
- Header: *Annulla*, *Ripeti*, badge del salvataggio, *Progetto ▾*, *❓ Aiuto ▾*.
- Libreria: Percorso / URL Libreria, *🔄 Ricarica*, ricerca, versione, *📜 Changelog*, etichetta Sola lettura.
- Cliente: *Importa…*, *Segna tutti come visti*, ricerca, Stato, Sezione.
- Coerenza: ricerca.
- Barra del canvas: *🔎 Filtri*, *📊 Matrice Requisiti*, *📄 Documenti*, *⚠️ Verifica Coerenza*, *🌳 Gerarchia*, *🔍 Reset Vista*, *☰ Libreria*, *☰ Proprietà*.
- Ispettore, blocco: Titolo Blocco, ID Blocco (con *Rinomina ID* e *Storia*), Descrizione, Categoria, Sottocategoria, Requisiti Blocco; nella riga di etichette dei requisiti: ID, Titolo, Tipologia, Metodo di verifica, Documento, Testo da esportare; Livello, Motivo della modifica; *+ Nuovo Blocco*, *+ Requisito*, *Salva / Aggiorna*, *Salva come Nuovo Blocco Simile*, *Elimina dalla libreria*, *Elimina Blocco dal Grafico*.
- Ispettore, requisito cliente: ID del cliente, Id nel modello, Sezione, Classe, Stato, Fili; *Mostra gerarchia*, *Segna come visto*, *Togli dal canvas*.
- Ispettore, collegamento: Relazione, Classe, Metodo di verifica, Testi da esportare; *Elimina collegamento*.
- Filtri: Classe, Documento, Categoria, Sottocategoria (sulle legende), Attenua o Nascondi, *Azzera*.
- Matrice: Documento, Lato, Classe, Ricerca, *Esporta .md*.
- Documenti: Documento, *Esporta .md*.
- Import cliente: Foglio, Riga di intestazione, ogni colonna di `CAMPI` (ID, Testo, Titolo, Note, Sezione, Tipologia), modalità Sostituisci o Aggiungi.
- Changelog: filtro.

**Critical test scenarios**:
- `localStorage` vuoto, avvio: il tour parte, 17 passi, Avanti fino a Fine; ricarica: non riparte; menu ❓ → Tour guidato: riparte. Verifica **AC-1**, **AC-2**, **AC-5**.
- Pannello destro chiuso e scheda Cliente attiva, tour fino al passo Ispettore e poi Esc: il pannello destro si apre per il passo; dopo Esc il pannello è di nuovo chiuso e la scheda Cliente è attiva. Verifica **AC-6**, **AC-4**.
- Finestra a 900×600: in ogni passo il fumetto è tutto dentro la finestra; ridimensionando, il riflettore segue l'area. Verifica **AC-3**, **AC-7**.
- Durante il tour: clic sul canvas e Ctrl+Z non cambiano il modello; Esc chiude solo il tour (una scelta della Gerarchia resta). Verifica **AC-4**.
- Hover sulla (i) di Tipologia in un blocco aperto: dopo circa 300 ms compare il testo; Tab fino all'icona: compare subito; Esc la chiude. Aggiungo un requisito (ridisegno): la (i) funziona ancora. Verifica **AC-9**, **AC-11**.
- Menu ❓ → togli la spunta: nessuna `.icona-aiuto` visibile, anche dopo aver aperto un altro blocco; ricarica: ancora nascoste; il pulsante Gerarchia mostra ancora il suo suggerimento e non ha `title`. Verifica **AC-10**, **AC-12**.
- Matrice aperta, ❓: mini tour sui passi presenti, alla chiusura la Matrice è ancora aperta; Import cliente aperto prima di scegliere un file: i passi senza area sono saltati e il conteggio è giusto. Verifica **AC-8**.
- Script che raccoglie ogni `data-aiuto` del DOM in ogni superficie e ogni `area` dei tour: tutte le chiavi esistono in `SUGGERIMENTI` e nessun `console.warn`. Verifica **AC-13**.

## Build plan

Tracer Bullet: prima un filo completo e sottile (menu, una (i), un tour corto) dal dato al comportamento, poi si allarga.

1. Filo minimo: `js/aiuto-testi.js` con le prime chiavi, `js/aiuto.js` con `#suggerimento`, delega degli eventi e `iconaAiuto()`, CSS in `style.css`, la (i) su Tipologia nell'ispettore; `js/tour.js` con overlay, riflettore, fumetto, tastiera e un tour principale di 3 passi; menu ❓ Aiuto nell'header con le due voci e `modaleAperta()` che conosce il tour. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-9**, **AC-11**, **AC-12**, **AC-13**.
2. Tour principale completo: i 17 passi e i loro testi, `prepara` e ripristino di pannelli e scheda, fallback al centro, riposizionamento su resize e scroll, avvio al primo avvio con l'attesa delle finestre. Satisfies **AC-2**, **AC-5**, **AC-6**, **AC-7**.
3. Inventario delle (i) e dei pulsanti: tutte le icone e i `data-aiuto` dell'inventario, tolti i `title`, la riga di etichette dei requisiti, `rigaDettaglio` con la chiave, i testi completi. Satisfies **AC-9**, **AC-10**, **AC-11**, **AC-13**.
4. Mini tour: pulsanti ❓ in Matrice, Documenti, Import cliente e Filtri, liste dei passi, filtro dei passi presenti. Satisfies **AC-8**.
5. Tutorial esterno: sezione su menu ❓, tour e (i) in `packaging/TUTORIAL.md`; `js/aiuto.js`, `js/tour.js`, `js/aiuto-testi.js` sono già copiati con `js/`. Satisfies **AC-14**.

## Consequences

**Positive**:
- L'app si spiega da sola; il tutorial esterno può restare più corto.
- I testi stanno in un file solo: si rivedono e si correggono senza cercare nel codice.

**Negative / tradeoffs**:
- I passi del tour dipendono da selettori CSS dell'interfaccia: rinominare un id o spostare un'area richiede di aggiornare `TOUR`. Il fallback al centro evita il crash ma il passo perde il riflettore.
- Ogni campo nuovo aggiunto in futuro deve ricevere la sua (i) e la sua chiave, o l'inventario si sgrana.
- L'ispettore diventa un po' più fitto di icone.

**Neutral**:
- Cambia `modaleAperta()` (ora include il tour) e `rigaDettaglio()` (parametro facoltativo).
- I `title` dei pulsanti dell'inventario spariscono a favore del suggerimento ricco.

## Follow-up

- [ ] Quando si aggiunge un campo all'interfaccia, aggiungere la (i) e la chiave in `js/aiuto-testi.js` (da annotare in `js/AGENTS.md` con `/sync`).

## Rationale

Ragionamento e opzioni: vedi [rationale.md](rationale.md).
