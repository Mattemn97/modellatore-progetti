# 0027. Documenti di export ammessi per classe del requisito, regola in settings.json

**Date**: 2026-10-06
**Status**: Proposed

## Summary

Ogni testo da esportare finisce in un documento, e da adesso il documento dipende dalla classe del requisito: un requisito di interfaccia (con tipologia) va solo nei documenti delle interfacce (IRS, IDD), uno di capacità solo negli altri (SSS, SSDD, SRS, SDD). La regola sta in una chiave nuova di `settings.json`. L'Ispettore propone solo i documenti ammessi e non salva un abbinamento sbagliato; le librerie già scritte si aprono come prima, e i testi sbagliati si vedono nell'Ispettore, nell'albero della libreria e nel pannello Documenti, che li lascia fuori dal file. Il formato della libreria non cambia e nessun testo si perde.

## Context

Oggi il menu Documento dell'Ispettore propone tutti i documenti di `settings.documenti` a qualsiasi requisito. Nulla impedisce di mettere un requisito di interfaccia in una SSS o una capacità in un'IRS, e la spec 0007 lo asseconda: mette le interfacce nel 3.3 della SSS e nel 4.3 della SSDD, e le capacità in "Altri requisiti" di IRS e IDD. Nella pratica del team gli abbinamenti sono fissi (interfacce in IRS e IDD, capacità negli altri), quindi ogni abbinamento diverso è un errore che arriva fino al documento consegnato.

I vincoli: le librerie esistenti (anche quelle importate dalla 1.x) possono già avere abbinamenti sbagliati e devono aprirsi senza perdere testi. Il file della libreria è condiviso con le versioni 1.x (impronte SHA1, changelog) e non deve cambiare formato. Matrice, Filtri e Documenti leggono gli stessi `testiExport`. I valori regolabili stanno in `settings.json` (regola di `AGENTS.md`).

## Requirements

**User stories**:
- Come progettista voglio che l'Ispettore mi proponga solo i documenti giusti per il tipo del requisito, così non metto per sbaglio un'interfaccia in un documento di capacità o il contrario.
- Come progettista voglio vedere subito quali testi di una libreria esistente sono su un documento sbagliato, così li correggo senza cercarli a mano.
- Come progettista voglio che il documento esportato contenga solo testi ammessi, così il file consegnato è corretto anche se la libreria ha ancora errori.
- Come responsabile della libreria voglio decidere in `settings.json` quale documento vale per quale classe.

**Acceptance criteria**:
- **AC-1**: `settings.json` ha la chiave `documentiPerClasse` con `interfaccia` e `capacita`, due liste di nomi di documento; il valore predefinito (in `settings.json` dell'app e in `DEFAULT_SETTINGS`) è `{ "interfaccia": ["IRS", "IDD"], "capacita": ["SSS", "SSDD", "SRS", "SDD"] }`. Un `settings.json` della cartella di lavoro senza la chiave, o con una delle due classi mancante o non fatta di stringhe, usa il valore predefinito per quella classe. Le voci si confrontano senza spazi ai bordi, distinguendo le maiuscole (anche le voci di `settings.documenti` si confrontano senza spazi ai bordi); una voce vuota si ignora, un doppione nella stessa lista vale una volta, una voce `Cliente` si ignora ovunque. Una lista vuota (`[]`) è valida e non ammette nessun documento per quella classe. `settings.documenti` non cambia.
- **AC-2**: La classe di un requisito di libreria è `interfaccia` se ha una tipologia, altrimenti `capacita` (come `isInterfaccia()`, anche per una tipologia assente da `settings`). Un testo con documento D (senza spazi ai bordi) è **ammesso** se D è nella lista della classe del suo requisito. Un documento presente in tutte e due le liste è ammesso per entrambe le classi. Un documento che non è in nessuna lista (per esempio `XYZ`, o una voce di `settings.documenti` non classificata) non è ammesso per nessuno. Un testo con documento vuoto non è valutato da questa regola (lo rifiuta già il controllo di salvataggio).
- **AC-3**: Nel form di un blocco dell'Ispettore il menu Documento di ogni testo propone, dopo `Documento...`, solo i documenti ammessi per la classe attuale del requisito: prima quelli di `settings.documenti`, nel loro ordine, poi quelli della lista della classe assenti da `settings.documenti`, nell'ordine della lista. Il menu confronta il documento salvato senza spazi ai bordi (un `"SSS "` salvato mostra `SSS` scelto) e il salvataggio toglie gli spazi ai bordi dal documento. Se il testo ha già un documento non ammesso, quel documento resta scelto e compare in fondo al menu come `<D> (non ammesso)`. Quando cambi la tipologia di un requisito, i menu dei suoi testi si ridisegnano subito con i documenti della nuova classe, senza perdere testi né documenti scelti, e il fuoco torna sul menu che hai appena cambiato. `📋 Crea copia` porta nella copia anche i testi non ammessi, con i loro avvisi: la copia si salva solo dopo averli corretti.
- **AC-4**: Nel form, un testo con documento non ammesso ha il menu con il bordo rosso e, sotto il menu, la riga `Documento non ammesso: <motivo>`. Il motivo è `"<D>" non è in documentiPerClasse di settings.json` per un documento non classificato, altrimenti `un requisito di interfaccia va solo in <lista>` o `un requisito di capacità va solo in <lista>` (lista nell'ordine di AC-3, separata da `, `; con lista vuota `nessun documento accetta requisiti di interfaccia` o `… di capacità`). La riga sparisce appena scegli un documento ammesso o togli il testo. Avviso e bordo valgono sia per un errore già nella libreria sia per uno nato da un cambio di tipologia.
- **AC-5**: `💾 Salva in libreria` rifiuta il blocco se un suo testo ha un documento non ammesso, con l'alert `Nel requisito "<id>" il testo per <D> non è ammesso: <motivo>.` (il primo trovato, nell'ordine dei requisiti e dei testi), e non scrive nulla su disco. Il controllo viene dopo quelli che esistono già (testo senza documento, documento senza testo).
- **AC-6**: Nell'albero della libreria un blocco con almeno un testo non ammesso (contati sui requisiti di quel blocco, testi vuoti compresi se hanno un documento) mostra, dopo il contatore dei requisiti, il segno `⚠` con `data-aiuto="libreria.nonAmmessi"` e `data-titolo-nativo="<K> testi su documenti non ammessi"` (`1 testo su un documento non ammesso` con K = 1), che il suggerimento mostra come riga in più (spec 0012). Il segno sparisce quando il blocco salvato non ne ha più.
- **AC-7**: Una libreria con testi non ammessi si apre, si mostra e si usa come oggi: nessun testo cambia o sparisce, in memoria o su disco, finché non salvi quel blocco correggendolo. Un blocco con un testo non ammesso, anche già scritto prima di questa versione, non si salva per nessuna modifica (nemmeno solo la descrizione) finché non correggi tutti i suoi testi non ammessi (AC-5); i blocchi senza testi non ammessi si salvano normalmente. L'import dalla versione 1 e l'apertura di una libreria non controllano la regola.
- **AC-8**: Il selettore del pannello Documenti propone solo i documenti ammessi per almeno una classe: prima le voci di `settings.documenti` classificate, nel loro ordine, poi i documenti di `documentiPerClasse` assenti da `settings.documenti` (prima quelli di `interfaccia`, poi quelli di `capacita`, ciascuno nell'ordine della sua lista), senza doppioni e mai `Cliente`. I documenti presenti solo nei testi non sono più voci (cambia AC-2 della spec 0007). Il resto della regola di scelta di AC-2 della spec 0007 vale come prima (ultimo documento scelto, altrimenti la prima voce, messaggio senza voci).
- **AC-9**: Generando il documento D, un testo con documento D entra solo se è ammesso: un requisito di libreria entra in D se ha almeno un testo ammesso e non vuoto per D (AC-3 della spec 0007 con questo filtro). Un capitolo destinato a una classe che D non ammette (`capacita` e `componenti` per la classe capacità, `interfacce` per la classe interfaccia, anche nella forma di IRS e IDD dove è il 3.1 Identificazione) non ha sottocapitoli e al posto di `Nessun requisito in questo documento.` dice `I requisiti di interfaccia sono nei documenti <lista>.` o `I requisiti di capacità sono nei documenti <lista>.` (lista di AC-3 della classe; con lista vuota resta `Nessun requisito in questo documento.`). `Altri requisiti` di IRS e IDD si comporta come prima: compare solo se il documento ha capacità ammesse. Con il valore predefinito: il 3.3 di SSS e SRS e il 4.3 di SSDD e SDD dicono `I requisiti di interfaccia sono nei documenti IRS, IDD.`, e IRS e IDD non hanno `Altri requisiti`. La numerazione segue le regole della spec 0007.
- **AC-10**: Nel file generato, `Documenti di riferimento` (cap. 2) e la colonna `Documenti padre` della Tracciabilità usano la stessa regola: per un padre di libreria contano i documenti dei suoi testi (requisito di `perId`, cioè il primo blocco con quell'id, come oggi) con testo non vuoto e ammessi; per un padre cliente resta `Cliente`; un padre senza voce in `perId` non porta documenti. Gli altri contenuti della spec 0007 non cambiano.
- **AC-11**: Il riepilogo del pannello Documenti aggiunge in fondo ` · Esclusi: K`, dove K conta i testi non vuoti con documento D dei requisiti di `perId` (tutta la libreria, usati nel progetto o no) che non sono ammessi; `Testi` (T) e `Non usati nel progetto` contano solo testi ammessi per D. Se la libreria ha testi non ammessi (su qualsiasi documento), sotto il riepilogo compare un elenco richiudibile, chiuso all'apertura, `Testi su documenti non ammessi: N` con un'icona (i) `documenti.nonAmmessi`; ogni riga è `<ID requisito> · <titolo del blocco> · <D> · <motivo di AC-4>`, ordinate per titolo del blocco (ordine naturale), poi per ordine dei requisiti e dei testi. L'elenco scorre ogni blocco con i suoi requisiti (un id doppio in due blocchi dà due righe) e comprende anche i testi vuoti con un documento. Un clic su una riga apre quel blocco nell'Ispettore esattamente come un clic nell'albero (`openLibraryBlock()`, stessa gestione del form aperto) e porta in vista il pannello Ispettore con `mostraPannello('ispettore')`, anche se uno dei due pannelli è staccato (il codice gira sempre nella pagina principale, spec 0023). Senza testi non ammessi l'elenco non c'è. L'elenco si aggiorna quando il pannello si ricalcola (spec 0022).
- **AC-12**: Matrice e Filtri non cambiano: mostrano e filtrano i documenti di tutti i testi, ammessi o no, e l'export Markdown della Matrice resta identico byte per byte.

## Options considered

### Option 1: Regola per classe in `settings.json`, controllo nell'Ispettore ed esclusione nel generatore

Una chiave `documentiPerClasse` decide quali documenti valgono per interfacce e capacità. L'Ispettore propone solo quelli e rifiuta il salvataggio sbagliato; gli errori già scritti restano su disco ma si vedono e non entrano nei documenti.

**Pros**:
- L'errore si ferma dove nasce (il form) e non arriva al file consegnato.
- Nessun cambio al formato della libreria: compatibilità con la 1.x e impronte intatte.

**Cons**:
- Il controllo vive in tre punti (Ispettore, albero, generatore) sopra una sola regola pura.
- Cambia comportamenti già verificati della spec 0007 (selettore, capitoli, riferimenti).

### Option 2: Solo filtro nel generatore

L'Ispettore resta com'è; il generatore scarta i testi sbagliati e li conta.

**Pros**:
- Un solo punto da cambiare.

**Cons**:
- L'errore nasce senza avviso e si scopre solo esportando, quando il testo manca dal documento.

### Option 3: Correggere le librerie all'apertura

Al caricamento i testi sbagliati si spostano o si tolgono e la libreria si risalva.

**Pros**:
- Dopo la prima apertura la libreria è pulita.

**Cons**:
- Un testo su un documento sbagliato non dice dove andava: lo spostamento indovina o il testo si perde. Scrive su disco senza che tu lo chieda, con changelog e versioni.

### Option 4: Regola per tipologia

Ogni tipologia (Elettrica, Segnale…) e la capacità hanno la propria lista di documenti.

**Pros**:
- Più flessibile (per esempio un ICD solo per le interfacce di Segnale).

**Cons**:
- La regola cresce a ogni tipologia e il bisogno di oggi è per classe.

## Decision

**Chosen option**: Option 1: Regola per classe in `settings.json`, controllo nell'Ispettore ed esclusione nel generatore.

La regola è una funzione pura in `model.ts` letta da Ispettore, albero della libreria e generatore; la libreria su disco non cambia e gli errori già scritti si mostrano senza correggerli da soli.

**Scelte fatte qui** (scelta, perché, alternativa scartata):
- **Regola pura in `model.ts`** (`classeDocumenti()`, `documentiDellaClasse()`, `motivoNonAmmesso()`, `testiNonAmmessi()`), con le impostazioni come parametro che vale `appSettings` se manca: la provano i test unitari senza pagina e tre moduli la condividono, come `verificaCompatibilita()` per i fili. Scartato: la regola dentro `inspector.ts` (il generatore dovrebbe copiarla).
- **Un motivo, non un sì o no**: `motivoNonAmmesso()` restituisce `null` se ammesso, altrimenti il motivo di AC-4. La stessa stringa serve alla riga dell'Ispettore, all'alert e all'elenco dei Documenti. Scartato: un booleano più i messaggi composti in ogni modulo.
- **Validazione nel merge di `loadSettings()`**: per ciascuna classe, un array di stringhe vince sul predefinito, altrimenti resta il predefinito; le voci si puliscono con `trim()` e le vuote cadono. Scartato: un valore errato che spegne la regola (un refuso in `settings.json` farebbe sparire tutti i documenti dal menu).
- **Ridisegno del form al cambio di tipologia o documento**: un ascoltatore `change` (non `input`, così le frecce su un menu aperto non ridisegnano a ogni passo) di `reqsContainer` chiama `renderReqRows()` dopo `tipologia` e `documento`, poi rimette il fuoco sull'elemento con gli stessi `data-idx`, `data-tidx` e `data-campo`. Testo, titolo e id restano su `input` senza ridisegno, per non perdere il fuoco mentre scrivi. Scartato: aggiornare a mano solo i menu della scheda toccata (più codice; il ridisegno intero c'è già per aggiungi e togli testo).
- **Valore non ammesso visibile nel menu**: una variante di `opzioni()` che aggiunge in fondo `<D> (non ammesso)` con `value` uguale a D, così il valore non si perde al ridisegno. Scartato: azzerare il menu (perderebbe l'informazione di cosa c'era scritto).
- **Segno nell'albero** in `initLibrary()` (`builder.ts`): `testiNonAmmessi(appState.library)` una volta per disegno, raggruppato per blocco; `<span class="lib-item-avviso" data-aiuto="libreria.nonAmmessi" data-titolo-nativo="…">⚠</span>` dopo `.lib-item-count`, stile in `style.css`. Il clic sul blocco resta quello di oggi.
- **Rinvio nei capitoli**: si decide in `espandi()` di `documenti.ts`, prima del caso "nessun requisito": se D non è in `documentiDellaClasse(classe)` il corpo è la frase di rinvio. Il DID non cambia. Scartato: togliere i capitoli (il DID non sarebbe più completo e la numerazione cambierebbe).
- **Documenti dei padri**: in `generaDocumento()` i documenti di un padre di libreria si filtrano con `motivoNonAmmesso()` sul requisito del padre (da `perId`); `VoceRequisito.documenti` della matrice non cambia. Scartato: filtrare nella matrice (cambierebbe Matrice e Filtri, AC-12).
- **`DatiDocumenti.documentiLibreria` si toglie**: con AC-8 nessuno lo legge più (nessun test lo usa).
- **Id doppi tra blocchi**: albero ed elenco guardano ogni blocco con i propri requisiti, perché è lì che correggi; generatore, `Esclusi` e documenti dei padri usano `perId` (primo blocco vince), come la matrice e la spec 0007. Un id doppio è già un errore che il salvataggio rifiuta.
- **Calcolo**: `generaDocumento()` calcola una volta `documentiDellaClasse()` per le due classi e le riusa per ogni testo; con 200 blocchi il costo resta trascurabile rispetto ad AC-14 della spec 0007.
- **Testi di aiuto** (`aiuto-testi.ts`):
  - `ispettore.req.documento`: "In quale documento finisce il testo sotto. Il menu propone solo i documenti ammessi per il tipo del requisito: con il valore predefinito un'interfaccia va in IRS o IDD, una capacità in SSS, SSDD, SRS o SDD. Un documento che non c'è va aggiunto a documentiPerClasse in settings.json, poi riavvia. Un requisito può avere più testi, uno per documento."
  - `libreria.nonAmmessi` (nuovo): titolo "Testi su documenti non ammessi", testo "Questo blocco ha testi in un documento che il tipo del requisito non ammette (regola documentiPerClasse di settings.json). Aprilo: i testi sbagliati sono in rosso. Finché non li correggi il blocco non si salva e quei testi restano fuori dai documenti."
  - `documenti.nonAmmessi` (nuovo): titolo "Testi su documenti non ammessi", testo "Testi della libreria in un documento che il tipo del requisito non ammette. Non entrano in nessun documento generato. Un clic apre il blocco nell'Ispettore per correggerli."
  - `barra.documenti`: aggiunge in fondo "Ogni testo entra solo se il suo documento è ammesso per il tipo del requisito."
- **Elenco dei non ammessi**: `<details id="elencoNonAmmessi">` nuovo in `#pannelloDocumenti` (`index.html`), riempito in `documenti.ts` con `textContent` per i testi dell'utente; un ascoltatore delegato sul `<details>` legge `data-blocco` e chiama `openLibraryBlock(id)` e `mostraPannello('ispettore')`. Funziona anche a pannello staccato perché l'ascoltatore sta sull'elemento, non su `document` (gotcha di `src/renderer/AGENTS.md`).

**Implementation skills**: nessuna (stack senza skill della comunità, vedi `AGENTS.md`).

## Rationale

La regola deve fermare l'errore dove nasce, perché un testo sbagliato scoperto solo all'export è già costato lavoro: per questo l'Ispettore filtra il menu e blocca il salvataggio (Option 2 lo scoprirebbe tardi). Le librerie esistenti però non si toccano: il formato è condiviso con la 1.x e un testo su un documento sbagliato non dice dove doveva andare, quindi correggerlo da solo (Option 3) vorrebbe dire indovinare o perdere testo. Restano su disco, visibili in tre punti, ed esclusi solo dal documento generato, così il file consegnato è sempre corretto.

La granularità per classe copre il bisogno di oggi con due liste leggibili; la regola per tipologia (Option 4) si potrà aggiungere sopra la stessa funzione se servirà. Matrice e Filtri restano fedeli alla libreria così com'è scritta, così l'export della Matrice non cambia e un errore resta visibile anche lì, mentre il generatore cita come riferimenti solo documenti che contengono davvero il testo del padre.

## Feature design

**Data model sketch** (nessun cambio a libreria o progetto; una chiave nuova nelle impostazioni; il resto è calcolato in memoria):

```
AppSettings (tipi.ts) += { documentiPerClasse: DocumentiPerClasse }
DocumentiPerClasse = { interfaccia: string[]; capacita: string[] }     // trim, voci vuote tolte
ClasseDocumenti = 'interfaccia' | 'capacita'                          // da req.tipologia

TestoNonAmmesso = {            // calcolato da testiNonAmmessi(libreria), mai salvato
  blockId: string,             // chiave di appState.library
  titoloBlocco: string,        // def.titolo, altrimenti blockId
  reqId: string,
  indiceRequisito: number,     // posizione in def.requisiti
  indiceTesto: number,         // posizione in req.testiExport
  documento: string,           // trim
  motivo: string               // motivoNonAmmesso()
}
```

Relazioni: un blocco 1:N TestoNonAmmesso; un requisito 1:N TestoNonAmmesso. Un testo con testo vuoto e documento valorizzato conta (è comunque un abbinamento scritto); un testo con documento vuoto no.

**API surface** (nessuna rotta nuova, il processo principale non cambia; funzioni della pagina):

| Funzione | Input | Output | Casi |
|---|---|---|---|
| `classeDocumenti(req)` (`model.ts`) | requisito | `'interfaccia'` o `'capacita'` | tipologia fuori da `settings`: comunque `interfaccia` |
| `documentiDellaClasse(classe, impostazioni = appSettings)` (`model.ts`) | classe, `{ documenti, documentiPerClasse }` | lista nell'ordine di AC-3 | lista vuota: `[]` |
| `motivoNonAmmesso(req, documento, impostazioni = appSettings)` (`model.ts`) | requisito, D | `null` o motivo di AC-4 | D vuoto: `null` |
| `testiNonAmmessi(libreria, impostazioni = appSettings)` (`model.ts`) | libreria | `TestoNonAmmesso[]` nell'ordine di AC-11 | libreria vuota: `[]` |
| `loadSettings()` (`state.ts`, estesa) | `settings.json` | `documentiPerClasse` validato | AC-1 |
| `renderReqRows()`, `opzioni…()` (`inspector.ts`) | requisiti del form | menu filtrati, bordo rosso, riga del motivo | AC-3, AC-4 |
| `validaRequisiti()` (`inspector.ts`, estesa) | requisiti, blockId | primo errore o `null` | AC-5 |
| `initLibrary()` (`builder.ts`, estesa) | | segno `⚠` per blocco | AC-6 |
| `vociDocumento()` (`documenti.ts`) | | voci di AC-8 | nessuna voce: messaggio della spec 0007 |
| `generaDocumento()` (`documenti.ts`, estesa) | come oggi | in più `riepilogo.esclusi` | AC-9, AC-10, AC-11 |
| elenco dei non ammessi (`documenti.ts`) | `testiNonAmmessi()` | `#elencoNonAmmessi` | nessuno: nascosto |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Avvio | regola | `settings.json` della cartella di lavoro, `documentiPerClasse`, fusa con `DEFAULT_SETTINGS` in `loadSettings()` |
| Ispettore, menu | documenti ammessi e loro ordine | `documentiDellaClasse(classeDocumenti(req))`, da `appSettings.documenti` e `appSettings.documentiPerClasse` |
| Ispettore, menu | classe attuale | `req.tipologia` del requisito nel form (`currentReqs`), non quella salvata |
| Ispettore, riga e alert | motivo | `motivoNonAmmesso(req, t.documento)` |
| Albero | K per blocco | `testiNonAmmessi(appState.library)` raggruppato per `blockId` |
| Documenti, selettore | voci | `appSettings.documenti` e `appSettings.documentiPerClasse` (AC-8) |
| Documenti, generazione | testi che entrano | `req.testiExport` con documento D e `motivoNonAmmesso(req, D) === null` |
| Documenti, rinvio | frase e lista | classe del capitolo dal `tipo` del DID (`capacita`, `componenti` → capacità; `interfacce` → interfaccia), lista da `documentiDellaClasse()` |
| Documenti, riferimenti e documenti padre | documenti di un padre | padre cliente (`voce.cliente`): `Cliente`; padre di libreria: documenti dei `testiExport` del suo requisito in `perId`, testo non vuoto, ammessi (non più `VoceRequisito.documenti`), ordinati con `ordinaDocumenti()`; senza voce in `perId`: nessuno |
| Documenti, riepilogo | K esclusi | testi dei requisiti di `perId` con documento D, testo non vuoto, non ammessi |
| Documenti, elenco | righe e N | `testiNonAmmessi(appState.library)` |
| Documenti, clic su una riga | blocco da aprire | `data-blocco` = `TestoNonAmmesso.blockId` |

**Key invariants**:
- La regola sta in una sola funzione (`motivoNonAmmesso()`): Ispettore, albero e generatore non possono dare risposte diverse.
- Nessuna azione di questa voce cambia un testo, un documento o un file della libreria da sola: cambia solo ciò che salvi tu.
- Un blocco con un testo non ammesso non arriva mai su disco dal form.
- Il file generato non contiene mai un testo non ammesso e non cita come riferimento un documento che non contiene il testo del padre.
- Matrice e Filtri vedono la libreria così com'è scritta.

**Security model**: un solo utente in locale, nessuna rotta nuova e nessun dato nuovo su disco. Nomi di documento, titoli e id sono testo dell'utente: nei template passano per `escapeHtml()`, nell'elenco dei Documenti per `textContent`. Nessun dato regolamentato.

**Configuration required** (in `settings.json`, in `DEFAULT_SETTINGS` e nel merge annidato di `loadSettings()`; la pagina la legge all'avvio, quindi dopo una modifica serve riavviare):
- `documentiPerClasse`: `{ "interfaccia": ["IRS", "IDD"], "capacita": ["SSS", "SSDD", "SRS", "SDD"] }`.

**Critical test scenarios**:
- Regola (unitario): `CEN_001` capacità con SSS ammesso e IRS no; `CEN_003` Elettrica con IRS ammesso e SSS no; `XYZ` non ammesso con il motivo "non classificato"; un documento in tutte e due le liste ammesso per entrambe; lista `interfaccia: []` con il motivo "nessun documento"; `settings.json` senza la chiave o con `capacita: "SSS"` usa il predefinito. Verifica **AC-1**, **AC-2**, **AC-4**.
- Ispettore (e2e): un requisito di capacità propone SSS, SSDD, SRS, SDD; scegli la tipologia Elettrica e il menu propone IRS, IDD, il testo SSS resta con `SSS (non ammesso)`, bordo rosso e motivo; Salva in libreria dà l'alert di AC-5 e la libreria su disco non cambia; scegli IRS e il salvataggio riesce. Verifica **AC-3**, **AC-4**, **AC-5**.
- Libreria esistente (e2e): una libreria con un'interfaccia su SSS e una capacità su `XYZ` si apre, i due blocchi hanno `⚠` nell'albero, i testi sono tutti lì; salvare un terzo blocco riesce; correggere uno dei due toglie il suo segno. Verifica **AC-6**, **AC-7**.
- Documenti (unitario su `generaDocumento()`): con la stessa libreria la SSS non contiene il testo dell'interfaccia, il 3.3 dice il rinvio a IRS, IDD, il riepilogo ha `Esclusi: 1`; l'IRS con una capacità con testo IRS non ha `Altri requisiti`; un padre con testi SSS (ammesso) e IRS (non ammesso) dà Documenti padre solo `SSS`; il selettore non propone `XYZ`. Verifica **AC-8**, **AC-9**, **AC-10**, **AC-11**.
- Elenco (e2e): l'elenco dei non ammessi è chiuso, si apre con due righe; un clic apre il blocco nell'Ispettore. Verifica **AC-11**.
- Matrice: l'export di una libreria con testi non ammessi è identico a prima, il filtro Documento propone ancora `XYZ`. Verifica **AC-12**.

**Cosa cambia della spec 0007** (criteri e scenari da riscrivere nei test; la 0007 riceve la riga "Modificata da 0027"):
- AC-2: le voci del selettore diventano quelle di AC-8 (spariscono i documenti presenti solo nei testi). Scenario "Documento fuori standard `XYZ`": ora `XYZ` non è una voce e i suoi testi sono nell'elenco dei non ammessi.
- AC-3: entra solo un testo ammesso (AC-9).
- AC-4 (cap. 2) e AC-9 (Documenti padre): solo documenti ammessi dei padri (AC-10).
- AC-5 e AC-6: con il valore predefinito il capitolo interfacce di SSS, SRS, SSDD, SDD e altro ha il rinvio, e `Altri requisiti` di IRS e IDD non compare. Scenari "Happy path SSS" (`CEN_003` Elettrica con testo SSS) e "IRS e IDD" (capacità con testo IRS): il testo passa a IRS, oppure il caso diventa la prova del rinvio e dell'esclusione.
- AC-12: il riepilogo aggiunge `Esclusi` e l'elenco dei non ammessi (AC-11).

## Build plan

Tracer Bullet: il primo compito porta la regola da `settings.json` fino al salvataggio rifiutato nell'Ispettore; poi si rendono visibili gli errori già scritti, poi si adegua il generatore.

1. **Filo minimo dalla regola al salvataggio**: chiave `documentiPerClasse` in `settings.json`, `DEFAULT_SETTINGS` e `loadSettings()` con la validazione per classe; tipo in `tipi.ts`; `classeDocumenti()`, `documentiDellaClasse()`, `motivoNonAmmesso()` in `model.ts` con i test unitari; menu Documento dell'Ispettore filtrato per classe, con il valore non ammesso in fondo; controllo in `validaRequisiti()`. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**.
2. **Errori visibili nell'Ispettore e nell'albero**: ridisegno del form al cambio di tipologia e documento; bordo rosso e riga del motivo; `testiNonAmmessi()` con test unitario; segno `⚠` in `initLibrary()` con stile, (i) `libreria.nonAmmessi` in `SUGGERIMENTI`; testo di `ispettore.req.documento` aggiornato; e2e dell'Ispettore e della libreria esistente. Satisfies **AC-3**, **AC-4**, **AC-6**, **AC-7**.
3. **Documenti**: `vociDocumento()` sui documenti classificati e tolto `documentiLibreria`; filtro dei testi ammessi; frase di rinvio in `espandi()`; documenti dei padri filtrati; `Esclusi` nel riepilogo e `Non usati` solo sugli ammessi; `#elencoNonAmmessi` con clic verso l'Ispettore e (i) `documenti.nonAmmessi`; test unitari e e2e aggiornati (le fixture della spec 0007 che mettono un'interfaccia nella SSS passano a IRS o diventano il caso del rinvio). Satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**.
4. **Matrice intatta e documentazione**: prova che l'export della Matrice e il filtro Documento non cambiano; `packaging/TUTORIAL.md` e `docs/guida/` dicono la regola, dove si cambia e cosa vuol dire `⚠`; testo di `barra.documenti` aggiornato. Satisfies **AC-12**.

## Migration plan

**Strategy**: no migration needed. Il formato della libreria e del progetto non cambia; un `settings.json` senza la chiave prende il predefinito.
**Rollback**: tornare al commit precedente. La chiave in più in `settings.json` è ignorata da una versione che non la conosce.
**Risks**: una libreria con molti abbinamenti sbagliati mostra molti `⚠` e documenti più vuoti finché non la correggi; si vede tutto nell'elenco dei Documenti.

## Consequences

**Positive**:
- Un'interfaccia non entra più per sbaglio in un documento di capacità, né al salvataggio né nel file generato.
- Gli errori già scritti si trovano senza aprire i blocchi uno per uno (albero ed elenco).
- Nessun cambio al file della libreria: compatibilità con la 1.x, impronte e changelog intatti.

**Negative / tradeoffs**:
- Cambiano risultati verificati della spec 0007: il selettore perde i documenti presenti solo nei testi, SSS e SSDD non hanno più interfacce, IRS e IDD non hanno più `Altri requisiti`; i test e le fixture della 0007 vanno aggiornati.
- Un documento non classificato (anche uno aggiunto a `settings.documenti`) non si può usare finché non lo metti in una classe: un `settings.json` incompleto blocca quei testi.
- Per correggere un blocco con un testo sbagliato devi correggerli tutti prima di salvare qualunque altra modifica a quel blocco.
- Matrice e documenti generati possono mostrare documenti diversi per lo stesso requisito finché la libreria ha errori (per scelta, AC-10 e AC-12).

**Neutral**:
- Nuove funzioni in `model.ts` e nuovi elementi nell'albero e nel pannello Documenti: da riportare in `src/renderer/AGENTS.md` (lo fa `/sync`).
- La spec 0007 resta `Accepted`; questa la modifica nei punti citati (selettore, ingresso dei testi, capitoli, riferimenti, riepilogo).

## Follow-up

- [ ] Valutare con l'uso una regola per tipologia sopra `documentiPerClasse` (per esempio un documento solo per le interfacce di Segnale), se servirà.
- [ ] Valutare un'azione "Correggi" nell'elenco dei non ammessi che sposta il testo sul documento giusto quando la classe ne ammette uno solo.
