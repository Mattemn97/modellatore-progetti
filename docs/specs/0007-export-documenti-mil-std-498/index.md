# 0007. Export dei documenti MIL-STD-498 in Markdown, uno per documento, sopra la matrice di tracciabilità

**Date**: 2026-10-02
**Status**: Proposed

## Summary

Il nuovo pulsante 📄 Documenti apre una finestra dove scegli un documento (SSS, SSDD, IRS, IDD, SRS, SDD o un altro nome usato nei testi) e scarichi un file `.md` con la capitolazione del suo DID (Data Item Description, lo schema dei capitoli che MIL-STD-498 prescrive per quel documento). Ogni requisito usato nel progetto che ha almeno un testo per quel documento finisce nel capitolo giusto: le capacità nel capitolo dei requisiti di capacità (o dei componenti, nei documenti di progetto), le interfacce nel capitolo delle interfacce raggruppate per tipologia; il metodo di verifica va nella tabella delle disposizioni di qualifica e la tracciabilità verso il livello padre nel suo capitolo. Il contenuto si calcola all'apertura riusando la matrice della spec 0006, quindi Gerarchia, Coerenza, Matrice e documenti non possono contraddirsi. Niente entra nel file del progetto e il server non cambia.

## Requirements

**User stories**:
- Come progettista voglio scegliere un documento e scaricare un `.md` con i capitoli del suo DID già riempiti con i testi dei requisiti, così non copio a mano centinaia di testi nel documento formale.
- Come progettista voglio che ogni requisito porti con sé il metodo di verifica e i suoi requisiti padre, così le disposizioni di qualifica e la tracciabilità del documento sono sempre allineate al modello.
- Come progettista voglio vedere prima di scaricare quanti requisiti finiscono nel documento e quali problemi hanno (senza metodo, senza padre, non usati nel progetto).

**Acceptance criteria**:
- **AC-1**: Il pulsante `📄 Documenti` (`#btnDocumenti`, nella barra del canvas subito dopo `📊 Matrice Requisiti`) apre la finestra Documenti (`#documentiModal`, larga come la finestra Matrice) e calcola il contenuto dal modello di quel momento; mentre è aperta non si ricalcola, salvo quando cambi documento (il nuovo documento si genera dalla stessa fotografia del modello presa all'apertura). Si chiude con `✕` (Esc non la chiude, come le altre finestre). Aprirla, cambiare documento, scaricare e chiuderla non cambia il file del progetto, non crea versioni e non cambia le modalità Coerenza e Gerarchia. A finestra aperta Esc della Gerarchia e Ctrl+Z / Ctrl+Y non agiscono (`modaleAperta()` la considera). Se la libreria non è caricata la finestra dice solo "Libreria non caricata: i documenti si generano quando la carichi" e il pulsante di export è disattivato.
- **AC-2**: In testa alla finestra c'è il selettore **Documento** con, nell'ordine, ogni voce di `settings.documenti`, poi i documenti presenti nei `testiExport` della libreria e assenti da `settings` (ordine alfabetico, confronto senza spazi ai bordi). Non ci sono voci `Tutti` né `Cliente`. Un documento uguale a `Cliente` non è mai una voce. All'apertura è scelto il documento dell'ultima volta (finché la pagina resta aperta, mai nel file del progetto); se non c'è più tra le voci, o alla prima apertura, è scelta la prima voce. Senza nessuna voce la finestra dice "Nessun documento disponibile: aggiungi documenti in `settings.json` o nei testi da esportare" e l'export è disattivato. La finestra copre l'editor: finché è aperta il modello non può cambiare.
- **AC-3**: Un requisito entra nel documento D se è un requisito di libreria (mai un requisito cliente), compare almeno una volta nel modello (ha almeno un'occorrenza nell'indice della Gerarchia, spec 0005) e ha almeno un testo da esportare con `documento` uguale a D (spazi ai bordi tolti, maiuscole distinte). I suoi testi nel documento sono tutti i `testiExport` con quel documento, nell'ordine in cui stanno nel requisito, separati da una riga vuota; un testo vuoto o fatto solo di spazi è saltato. I requisiti di libreria che hanno testi per D ma nessuna occorrenza nel modello non entrano e sono contati come "non usati nel progetto". Ogni testo di D di un requisito che entra compare nel file una volta sola.
- **AC-4**: Il file comincia con `# <D> · <titolo del DID> · <nome progetto>` (titoli dei DID nella tabella di AC-5; per un documento senza DID noto il titolo è `Documento di requisiti`), poi la riga `Data: <AAAA-MM-GG, ora locale> · Libreria: <nome del file> v<versione>` (senza versione solo `Libreria: <nome del file>`), poi i capitoli. Ogni capitolo ha numero e titolo del DID; il titolo ha tanti `#` quanti i livelli del numero più uno, e il primo livello porta il punto: `## 1. Scopo`, `### 1.1 Identificazione`, `#### 3.2.1 …`, `##### 3.3.2.1 …` (la profondità massima è 4, quindi mai più di 5 `#`). Il capitolo **1 Scopo** ha 1.1 Identificazione con il testo `Questo documento (<D>) riguarda il progetto <nome progetto>. È generato dal modello con la libreria <nome del file> v<versione> il <data>.` (senza versione la parte ` v<versione>` manca), 1.2 con `_Da completare._` e titolo `Panoramica del sistema` (SSS, SSDD), `Panoramica del CSCI` (SRS, SDD), `Panoramica delle interfacce` (IRS, IDD) o `Panoramica` (altro), e 1.3 Panoramica del documento con `_Da completare._`. Il capitolo **2 Documenti di riferimento** elenca, uno per riga puntata, i documenti dei requisiti padre dei requisiti del documento (i Documenti della matrice, spec 0006 AC-4, del lato padre, D escluso), nell'ordine delle voci di AC-2 con `Cliente` per primo; senza nessuno dice `_Da completare._`.
- **AC-5**: La capitolazione segue il DID del documento. I capitoli segnati "testo fisso" contengono solo `_Da completare._`:

  | D | Titolo del DID | Capitoli |
  |---|---|---|
  | SSS | Specifica del sistema/sottosistema | 1 Scopo; 2 Documenti di riferimento; 3 Requisiti: 3.1 Stati e modi richiesti (testo fisso), 3.2 Requisiti di capacità del sistema (capacità), 3.3 Requisiti di interfaccia esterna del sistema (interfacce, AC-6), 3.4 Requisiti di interfaccia interna del sistema, 3.5 Requisiti dei dati interni del sistema, 3.6 Requisiti di adattamento, 3.7 Requisiti di sicurezza (safety), 3.8 Requisiti di sicurezza e riservatezza (security e privacy), 3.9 Requisiti dell'ambiente del sistema, 3.10 Requisiti delle risorse di calcolo, 3.11 Fattori di qualità del sistema, 3.12 Vincoli di progetto e costruzione, 3.13 Requisiti relativi al personale, 3.14 Requisiti di addestramento, 3.15 Requisiti di supporto logistico, 3.16 Altri requisiti, 3.17 Requisiti di imballaggio, 3.18 Precedenza e criticità dei requisiti (da 3.4 a 3.18 testo fisso); 4 Disposizioni di qualifica (AC-8); 5 Tracciabilità dei requisiti (AC-9); 6 Note (AC-10) |
  | SRS | Specifica dei requisiti software | come SSS con "del CSCI" al posto di "del sistema" in 3.2, 3.3, 3.4, 3.5, 3.9, "Fattori di qualità del software" in 3.11 e "Vincoli di progetto e implementazione" in 3.12 |
  | IRS | Specifica dei requisiti di interfaccia | 1; 2; 3 Requisiti: 3.1 Identificazione delle interfacce e diagrammi, poi un capitolo per tipologia (AC-6), poi 3.y Altri requisiti (capacità, solo se ce ne sono), poi 3.z Precedenza e criticità dei requisiti (testo fisso); 4 Disposizioni di qualifica; 5 Tracciabilità dei requisiti; 6 Note |
  | SSDD | Descrizione del progetto del sistema/sottosistema | 1; 2; 3 Decisioni di progetto a livello di sistema (testo fisso); 4 Progetto architetturale del sistema: 4.1 Componenti del sistema (capacità per blocco, AC-7), 4.2 Concetto di esecuzione (testo fisso), 4.3 Progetto delle interfacce (interfacce, AC-6); 5 Tracciabilità dei requisiti; 6 Note |
  | SDD | Descrizione del progetto software | come SSDD con "del CSCI" / "a livello di CSCI" al posto di "del sistema" / "a livello di sistema", più 5 Progetto di dettaglio del CSCI (testo fisso); poi 6 Tracciabilità dei requisiti; 7 Note |
  | IDD | Descrizione del progetto delle interfacce | 1; 2; 3 Progetto delle interfacce: 3.1 Identificazione delle interfacce e diagrammi, poi un capitolo per tipologia (AC-6), poi 3.y Altri requisiti (capacità, solo se ce ne sono); 4 Tracciabilità dei requisiti; 5 Note |
  | altro | Documento di requisiti | 1; 2; 3 Requisiti: 3.1 Requisiti di capacità (capacità), 3.2 Requisiti di interfaccia (interfacce, AC-6); 4 Disposizioni di qualifica; 5 Tracciabilità dei requisiti; 6 Note |

  I titoli dei capitoli sono esattamente le stringhe di questa tabella (per SDD: 3 `Decisioni di progetto a livello di CSCI`, 4 `Progetto architetturale del CSCI`, 4.1 `Componenti del CSCI`, 4.2 `Concetto di esecuzione`, 4.3 `Progetto delle interfacce`, 5 `Progetto di dettaglio del CSCI`). Un capitolo destinato a requisiti che non ne ha nessuno dice `Nessun requisito in questo documento.` Le capacità sono i requisiti con classe `Capacità`, le interfacce quelli con una tipologia (spec 0006, colonna Classe), anche se la tipologia non è in `settings`.

  Capitoli opzionali di IRS e IDD (le lettere y e z della tabella sono i numeri che seguono): dopo 3.1 vengono i capitoli per tipologia (3.2, 3.3, …), poi `Altri requisiti` solo se ci sono capacità nel documento, con i requisiti di capacità dentro (3.y.1, 3.y.2, … nell'ordine della matrice, senza raggruppare per blocco), poi in IRS `Precedenza e criticità dei requisiti` con il numero successivo. Se il documento non ha interfacce, 3.1 Identificazione resta (è un capitolo del DID) e contiene solo `Nessun requisito in questo documento.`; Altri requisiti diventa 3.2 e Precedenza il numero dopo.
- **AC-6**: Un capitolo di interfacce (3.3 di SSS e SRS, 4.3 di SSDD e SDD, 3 di IRS e IDD, 3.2 dell'altro) si apre con il sottocapitolo **Identificazione delle interfacce e diagrammi** (primo figlio: 3.3.1, 4.3.1, 3.1, 3.2.1) che contiene la tabella `Tipologia | Requisiti | Blocchi` con una riga per tipologia presente nel documento (Requisiti = quanti requisiti, Blocchi = Blocco della matrice, `VoceRequisito.blocco`, distinti, separati da virgola nell'ordine del primo requisito che li porta) e la riga `_Diagrammi da completare._`. Seguono, numerati di seguito (3.3.2, 3.3.3, …), un sottocapitolo `Interfaccia <tipologia>` per ogni tipologia presente, nell'ordine delle tipologie di `settings` e poi le altre in ordine alfabetico; dentro, un sottocapitolo per requisito (AC-11). Senza interfacce: in SSS, SRS, SSDD, SDD e altro il capitolo dice `Nessun requisito in questo documento.` senza sottocapitoli; in IRS e IDD vale la regola di AC-5.
- **AC-7**: Nei documenti di progetto (SSDD, SDD) il capitolo 4.1 Componenti si apre con la tabella `Blocco | Categoria | Requisiti nel documento` con una riga per blocco di libreria che possiede almeno un requisito di capacità del documento, poi un sottocapitolo per blocco (`4.1.1 <titolo del blocco>`), con la descrizione del blocco come primo paragrafo (se c'è) e dentro un sottocapitolo per requisito di capacità (`4.1.1.1 …`, AC-11). Un blocco è identificato dal suo id di libreria; il titolo mostrato è il Blocco della matrice (`VoceRequisito.blocco`, cioè il titolo o in mancanza l'id), Categoria è `def.categoria` (vuota se manca). Un blocco che possiede solo interfacce del documento non è in 4.1. Ordine dei blocchi: per livello (il minimo dei livelli dei suoi requisiti nel documento), poi per titolo in ordine naturale, poi per id.
- **AC-8**: Il capitolo **Disposizioni di qualifica** (solo SSS, SRS, IRS e altro) ha la frase `Metodi di qualifica: <metodi di settings.metodiVerifica separati da virgola>.` e la tabella `ID | Titolo | Sezione | <una colonna per ogni metodo di settings.metodiVerifica> | Note`, una riga per requisito del documento nell'ordine in cui compare nel file; la colonna del suo metodo ha `X`, le altre sono vuote. Il metodo si confronta con le voci di `settings` dopo aver tolto gli spazi ai bordi, distinguendo le maiuscole. Note dice `Metodo non definito` se il metodo è vuoto, `Metodo: <metodo>` se non è tra quelli di `settings`. Sezione è il numero del sottocapitolo del requisito nel file (es. `3.2.4`). Senza requisiti il capitolo dice `Nessun requisito in questo documento.`
- **AC-9**: Il capitolo **Tracciabilità dei requisiti** ha la tabella `ID | Titolo | Sezione | Requisiti padre | Documenti padre | Note`, una riga per requisito del documento nell'ordine in cui compare nel file. Requisiti padre sono i padri del requisito nella matrice (spec 0006: le coppie padre → figlio dai fili validi di derivazione, in tutte le istanze), scritti `<ID mostrato> <titolo>` e separati da `; `, nell'ordine dei gruppi della matrice; Documenti padre è l'unione dei loro Documenti (spec 0006 AC-4, `Cliente` per un requisito cliente) nell'ordine delle voci di AC-2 con `Cliente` per primo. Note riporta `notaSenzaPadre` della matrice (`Senza padre` o `Senza padre in X istanze su Y`) e, per ogni padre cliente ritirato, `Padre ritirato: <ID>`, separati da `; `. Un requisito senza padri ha Requisiti padre `—`. Senza requisiti il capitolo dice `Nessun requisito in questo documento.`
- **AC-10**: Il capitolo **Note** (numero N: 5 in IDD, 7 in SDD, 6 negli altri) ha un solo sottocapitolo N.1 `Acronimi e glossario` con `_Da completare._`; dopo, come ultima riga del file, la riga `Generato dal Modellatore di requisiti il <data>. I capitoli con "Da completare" non sono coperti dal modello.`
- **AC-11**: Il sottocapitolo di un requisito è il titolo `<numero> <ID> · <titolo>` (senza titolo: `<numero> <ID>`), poi i testi di AC-3, poi l'elenco puntato `- Metodo di verifica: <metodo o "non definito">`, `- Blocco: <titolo del blocco>`, `- Deriva da: <ID mostrati dei padri di AC-9, nello stesso ordine, separati da ", ", o "nessun padre">`. Dentro un capitolo i requisiti seguono l'ordine della matrice (livello, poi id in ordine naturale). Nei titoli e nelle celle a capo e spazi multipli diventano uno spazio; nelle celle `\` diventa `\\` e `|` diventa `\|` (come `cellaMd()` della matrice); i testi dei paragrafi restano come scritti, Markdown compreso.
- **AC-12**: Sotto il selettore la finestra mostra il riepilogo del documento scelto: `Requisiti: N (capacità C, interfacce I) · Testi: T · Senza metodo: M · Senza padre: P · Non usati nel progetto: U` (N, C, I, M, P e U contano requisiti, T i testi scritti nel file; Senza metodo conta i requisiti del documento con metodo vuoto dopo aver tolto gli spazi; Senza padre quelli con `notaSenzaPadre` non vuota; Non usati i requisiti di tutta la libreria con un testo non vuoto per D e senza voce nella matrice), poi l'anteprima del file in un riquadro a scorrimento con carattere a spaziatura fissa. Oltre `documentiExport.anteprimaCaratteri` caratteri l'anteprima si tronca esattamente a quel numero di caratteri e aggiunge, a capo, la riga `… anteprima troncata: il file scaricato contiene tutto il documento`. Con N = 0 compare anche `Nessun requisito ha testi per <D>: il file avrà solo i capitoli.`
- **AC-13**: Il pulsante `⬇ Esporta .md` scarica il documento completo (mai troncato) come `<slug del progetto>-<slug di D>.md` (es. `impianto-sss.md`; slug come nella matrice, spec 0006: `infoProgetto().slug`, altrimenti `slugifyId(nome)` o `documento`; per D `slugifyId(D)` o `documento`), anche con N = 0. Il testo scaricato è identico all'anteprima non troncata.
- **AC-14**: Su un progetto con 3000 requisiti cliente e 200 blocchi la finestra si apre e cambia documento in meno di un secondo.

## Decision

**Chosen option**: Option 1: un modulo nuovo `js/documenti.js` che genera il Markdown da una descrizione dichiarativa dei DID, sopra il risultato di `calcolaMatrice()` (spec 0006), con una finestra dedicata e il download dal browser.

All'apertura `apriDocumenti()` calcola una volta l'indice (`calcolaGerarchia()`) e la matrice (`calcolaMatrice()`), le tiene in variabili del modulo e genera il documento scelto con la funzione pura `generaDocumento(dati, documento, intestazione)`; cambiare documento rigenera solo il testo dalla stessa fotografia.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Fonte dei dati: la matrice**. `calcolaMatrice()` restituisce in più `voci: VoceRequisito[]` (tutte le voci, clienti compresi, nell'ordine di `confronta()`), così il documento ha classe, metodo, blocco, livello, `notaSenzaPadre` e documenti già calcolati con le regole condivise. I padri di un requisito si ricavano dai `gruppi`: per ogni gruppo, per ogni riga figlio, `padriDi[figlio.id].push(gruppo.padre)`. Scartato: una terza visita del modello in `documenti.js` (regole che possono divergere) o leggere i testi dalla matrice (la voce non porta il requisito).
- **Testi e blocco dal requisito di libreria**: `documenti.js` costruisce da `appState.library` la mappa `reqId → { req, def }` (primo blocco vince, come la matrice) e legge `req.testiExport`, `def.titolo`, `def.descrizione`, `def.categoria`. La voce dà il "chi entra" (occorrenze nel modello), la libreria dà i testi.
- **DID come dati dichiarativi**: una costante `DID` in `documenti.js` con, per ogni documento noto, `titolo` e l'albero dei capitoli `{ titolo, tipo }` dove `tipo` è `fisso` (`_Da completare._`), `identificazione` (1.1), `riferimenti` (2), `capacita`, `componenti` (4.1 di SSDD e SDD), `interfacce`, `altri` (capacità in IRS e IDD, solo se presenti), `qualifica`, `tracciabilita`, `note`, `contenitore` (solo figli). I numeri non sono scritti nei dati: `numeraCapitoli()` li assegna percorrendo l'albero, così i capitoli opzionali (Altri requisiti, le tipologie) spostano i numeri seguenti senza errori. Il documento senza DID usa la voce `ALTRO`. La capitolazione non è una scelta dell'utente ma lo standard: sta nel codice, non in `settings.json`. Scartato: un modello per documento scritto come testo con segnaposto (numerazione a mano, fragile con i capitoli opzionali).
- **Due passi: struttura poi testo**. `generaDocumento()` prima costruisce l'albero numerato con i requisiti assegnati (ogni requisito sa la sua `sezione`), poi lo scrive in Markdown. Qualifica e tracciabilità leggono le sezioni dal primo passo, perché in SSS i capitoli 4 e 5 seguono il 3 ma citano i suoi numeri.
- **Interno contro esterno**: tutte le interfacce vanno nel capitolo delle interfacce esterne (3.3 di SSS e SRS); 3.4 resta testo fisso. Il modello non distingue un'interfaccia esterna da una interna, e indovinarlo dal livello del blocco sbaglierebbe sui sottosistemi. Scartato: interfacce dei blocchi della radice esterne, le altre interne.
- **`voci` nella matrice**: `[...voci.values()].sort(confronta)` alla fine di `calcolaMatrice()`; anche il ritorno anticipato di libreria assente porta `voci: []`. `documenti.js` filtra `!voce.cliente` prima di cercare in `perId`. L'export della matrice deve restare identico byte per byte.
- **Ordine**: requisiti nell'ordine di `matrice.voci` (livello, id naturale); tipologie nell'ordine di `getTipologie()` poi le altre con `localeCompare(…, 'it')`; blocchi di 4.1 per livello minimo poi titolo con il collator `Intl.Collator('it', { numeric: true })`.
- **Riuso da `matrice.js`**: esportare `cellaMd()` e `tabellaMd()`; spostare `dataOggi()` in `utils.js` (esportata) e farla importare da `matrice.js` e `documenti.js`. Scartato: copiarle (due escape del Markdown che divergono).
- **Voci del selettore**: `appSettings.documenti`, poi i documenti dei `testiExport` di tutta la libreria (non solo del modello) assenti da `settings`, in ordine alfabetico: un documento usato solo da blocchi fuori dal progetto si può scegliere e il riepilogo dice "Non usati nel progetto". `Cliente` non è un documento esportabile.
- **Finestra**: nuovo `#documentiModal` in `index.html`, stesso guscio di `#matriceModal` (`.modal-body.modal-matrice`), con selettore, riepilogo, `<pre id="anteprimaDocumento">` (`white-space: pre-wrap`, scorrimento interno, altezza massima `60vh`), `⬇ Esporta .md` e `✕`. `modaleAperta()` di `progetto.js` considera anche `#documentiModal`.
- **Download**: `scaricaFileTesto(testo, nomeFile, 'text/markdown;charset=utf-8')` di `storage.js` (spec 0006); nome del progetto e slug da `infoProgetto()`, libreria da `infoLibreria()`, come la matrice.
- **Anteprima troncata**: `pre.textContent` (mai `innerHTML`), tagliato a `documentiExport.anteprimaCaratteri`. Un documento da migliaia di requisiti è qualche MB di testo: il riquadro lo regge, ma non serve leggerlo tutto a video.

**Implementation skills**: none (stack senza skill della comunità, vedi `AGENTS.md`).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (solo in memoria, ricalcolato a ogni apertura, mai nel file del progetto; nessuna migrazione):

```
Matrice (spec 0006) += { voci: VoceRequisito[] }      // tutte le voci, nell'ordine di confronta()

ModelloDid = { titolo: string, capitoli: CapitoloDid[] }
CapitoloDid = { titolo: string, tipo: 'fisso'|'identificazione'|'riferimenti'|'capacita'|'componenti'|
                'interfacce'|'altri'|'qualifica'|'tracciabilita'|'note'|'contenitore', figli?: CapitoloDid[] }
DID = { SSS, SRS, IRS, SSDD, SDD, IDD, ALTRO }        // costante in documenti.js

RequisitoDoc = {                  // un requisito che entra nel documento D (AC-3)
  voce: VoceRequisito,            // dalla matrice: idMostrato, titolo, classe, metodo, blocco, livello, notaSenzaPadre
  req, def,                       // requisito e blocco di libreria
  testi: string[],                // testiExport con documento D, non vuoti, nell'ordine del requisito
  padri: VoceRequisito[],         // dai gruppi della matrice
  sezione: string                 // assegnata da numeraCapitoli(), es. '3.2.4'
}

DatiDocumenti = { matrice, perId: Map<reqId, {req, def}>, padriDi: Map<reqId, VoceRequisito[]>, documentiLibreria: string[] }

Stato del modulo documenti.js (mai in appState): ultimiDati, documentoScelto, ultimoTesto
```

Relazioni: RequisitoDoc 1:1 VoceRequisito; RequisitoDoc N:M VoceRequisito (padri); un capitolo 1:N RequisitoDoc. Unicità: un RequisitoDoc per id; ogni requisito in un solo capitolo del documento.

**State transitions**: la finestra è `chiusa` → `aperta` (pulsante: indice, matrice, documento scelto) → `aperta` con altro documento (selettore: rigenera il testo dalla stessa fotografia) → `chiusa` (`✕`). Nessuno stato del modello cambia.

**API surface** (nessuna rotta server; funzioni client):

| Funzione | Input | Output | Errori o casi |
|---|---|---|---|
| `calcolaMatrice()` (`matrice.js`, estesa) | come oggi | in più `voci` | libreria assente: `voci: []` |
| `cellaMd()`, `tabellaMd()` (`matrice.js`, ora esportate) | come oggi | come oggi | |
| `dataOggi()` (`utils.js`, spostata da `matrice.js`) | | `AAAA-MM-GG` in ora locale | |
| `preparaDatiDocumenti(matrice, libreria)` (`documenti.js`) | matrice, `appState.library` | `DatiDocumenti` | |
| `vociDocumento(dati)` (`documenti.js`) | dati | elenco delle voci di AC-2 | |
| `generaDocumento(dati, documento, intestazione)` (`documenti.js`, pura) | dati, D, `{ nome, data, libreria: { nomeFile, versione } }` | `{ testo, riepilogo: { requisiti, capacita, interfacce, testi, senzaMetodo, senzaPadre, nonUsati } }` | D senza DID: modello `ALTRO`; nessun requisito: capitoli con "Nessun requisito in questo documento." |
| `apriDocumenti()` / `chiudiDocumenti()` (`documenti.js`) | | calcola, mostra o nasconde `#documentiModal` | libreria assente: messaggio di AC-1 |
| `initDocumenti()` (`documenti.js`, chiamata da `initApp()`) | | gestori di `#btnDocumenti`, selettore, export, `✕` | |
| `modaleAperta()` (`progetto.js`, estesa) | | vero anche con `#documentiModal` aperta | |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Apertura | indice, matrice | `calcolaGerarchia(pathStack[0].graph, appState.library, appState.cliente)`, poi `calcolaMatrice(indice, appState.library, appState.cliente, pathStack[0].label)` |
| Selettore | voci | `appSettings.documenti`, poi documenti distinti dei `testiExport` di `appState.library` assenti da `settings`, ordine alfabetico |
| Selettore | documento scelto | variabile `documentoScelto` del modulo; prima voce se assente |
| Generazione | requisiti del documento | `matrice.voci` non cliente con un `testiExport` di documento D (trim), via `perId` |
| Generazione | non usati nel progetto | requisiti di `appState.library` con un testo di D e senza voce nella matrice |
| Generazione | testi | `req.testiExport[].testo` con documento D, `trim()` non vuoto |
| Generazione | classe, metodo, blocco, livello | `VoceRequisito.classe`, `.metodo`, `.blocco`, `.livello` (spec 0006) |
| Generazione | descrizione e categoria del blocco | `def.descrizione`, `def.categoria` da `perId` |
| Generazione | padri | `padriDi` dai `matrice.gruppi` |
| Generazione | documenti padre | `VoceRequisito.documenti` dei padri (spec 0006 AC-4) |
| Generazione | senza padre | `VoceRequisito.notaSenzaPadre` |
| Generazione | padre ritirato | `VoceRequisito.ritirato` del padre |
| Generazione | ordine delle tipologie | `getTipologie()` (da `settings.requirements.typeColors`), poi alfabetico |
| Generazione | colonne di qualifica | `appSettings.metodiVerifica` |
| Generazione | capitolazione e titoli | costante `DID` in `documenti.js` |
| Generazione | numeri dei capitoli | `numeraCapitoli()` sull'albero del DID con i capitoli opzionali risolti |
| Intestazione | nome progetto | `infoProgetto().nome`, altrimenti `pathStack[0].label` |
| Intestazione | data | `dataOggi()` |
| Intestazione | libreria e versione | `infoLibreria()` |
| Export | nome del file | `infoProgetto().slug` (o `slugifyId(nome)` o `documento`) + `-` + `slugifyId(D)` + `.md` |
| Anteprima | limite | `appSettings.documentiExport.anteprimaCaratteri` |

**Key invariants**:
- La generazione non cambia mai il modello e nessuna azione della finestra scrive nel file del progetto o in `appState`.
- Chi è padre di chi, chi è senza padre e quali documenti ha un requisito vengono dalla matrice: Gerarchia, Coerenza, Matrice e documenti non possono contraddirsi.
- Ogni testo di D di un requisito usato compare nel file esattamente una volta; un requisito sta in un solo capitolo.
- La numerazione viene da un solo passo (`numeraCapitoli()`) e qualifica e tracciabilità citano quei numeri.
- Anteprima e file scaricato vengono dallo stesso testo; solo l'anteprima si tronca.

**Security model**: un solo utente in locale, nessuna rotta nuova, nessun dato nuovo su disco (il file lo salva il browser). Titoli, testi, id e documenti sono testo dell'utente: l'anteprima usa `textContent`, il selettore e il riepilogo passano per `escapeHtml()`; nelle tabelle Markdown `cellaMd()` impedisce che `|` o un a capo rompano le righe. Nessun dato regolamentato.

**Configuration required** (nuova chiave in `settings.json`, in `DEFAULT_SETTINGS` e nel merge annidato di `loadSettings()` in `js/state.js`):
- `documentiExport.anteprimaCaratteri`: `200000`, caratteri dell'anteprima prima del troncamento.

**Critical test scenarios**:
- Happy path SSS: Centralina (`CEN_001` Capacità con due testi SSS, metodo Test, padre `CLI-1`; `CEN_003` Elettrica con testo SSS, metodo Analisi) e Pompa (`PMP_001` Elettrica, testo IRS). SSS ha 3.2.1 `CEN_001` con i due testi, 3.3.1 tabella con la riga Elettrica, 3.3.2 Interfaccia Elettrica con 3.3.2.1 `CEN_003`; 4 con le X nelle colonne giuste; 5 con `CLI-1` e Documenti padre `Cliente`; 2 elenca `Cliente`. Verifica **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-8**, **AC-9**, **AC-11**.
- IRS e IDD: `PMP_001` va in 3.2 Interfaccia Elettrica; un requisito di capacità con testo IRS crea 3.y Altri requisiti e la Precedenza scala di numero; IDD non ha Disposizioni di qualifica. Verifica **AC-5**, **AC-6**.
- SSDD: un blocco con due capacità SSDD dà la tabella dei componenti e 4.1.1 `<blocco>` con la descrizione e 4.1.1.1, 4.1.1.2; le interfacce vanno in 4.3. Verifica **AC-7**, **AC-5**.
- Documento fuori standard `XYZ` scritto a mano in un testo: compare nel selettore dopo quelli di `settings`, usa la struttura `ALTRO`. Verifica **AC-2**, **AC-5**.
- Problemi: un requisito con testo SSS in un blocco non usato nel progetto conta in "Non usati" e non entra; uno senza metodo ha `Metodo non definito`; uno senza padre ha `—` e "Senza padre"; un requisito il cui unico padre è il cliente ritirato `3` ha Requisiti padre `3 …` e Note "Senza padre; Padre ritirato: 3". Verifica **AC-3**, **AC-8**, **AC-9**, **AC-12**.
- Export: nome `<slug>-sss.md`, testo identico all'anteprima; un titolo con `|` e a capo non rompe le tabelle; documento senza requisiti si scarica con i soli capitoli. Verifica **AC-13**, **AC-11**, **AC-12**.
- Ciclo della finestra: chiudi e riapri, il documento scelto resta; il file del progetto non ha versioni nuove; libreria assente: messaggio ed export disattivato; Esc e Ctrl+Z a finestra aperta non agiscono. Verifica **AC-1**, **AC-2**.
- Volumi: 3000 requisiti cliente e 200 blocchi, apertura e cambio documento sotto il secondo; anteprima troncata con la riga finale, file completo. Verifica **AC-14**, **AC-12**.

## Build plan

Tracer Bullet: il primo compito porta un requisito dal modello alla finestra e al file `.md` con la capitolazione SSS; i successivi completano le strutture degli altri DID, poi qualifica e tracciabilità, poi riepilogo e volumi.

1. **Filo minimo dal modello al file SSS**: chiave `documentiExport.anteprimaCaratteri` in `settings.json`, `DEFAULT_SETTINGS` e `loadSettings()`; `voci` in `calcolaMatrice()`; `cellaMd()` e `tabellaMd()` esportate, `dataOggi()` spostata in `utils.js`; `#btnDocumenti` e `#documentiModal` in `index.html`; `js/documenti.js` con la costante `DID` (SSS), `numeraCapitoli()`, `generaDocumento()` per capitoli fissi, identificazione, capacità e interfacce con i sottocapitoli dei requisiti; selettore con le voci di AC-2; anteprima ed export; `modaleAperta()` estesa; `initDocumenti()` chiamata da `initApp()`; messaggio di libreria assente. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-6**, **AC-11**, **AC-13**.
2. **Tutti i DID**: SRS, IRS, SSDD, SDD, IDD e `ALTRO`; capitoli opzionali Altri requisiti; componenti per blocco con tabella e descrizione (4.1); documenti di riferimento del capitolo 2; Note. Satisfies **AC-5**, **AC-7**, **AC-4**, **AC-10**.
3. **Qualifica e tracciabilità**: padri dai gruppi della matrice, tabella di qualifica con le colonne dei metodi, tabella di tracciabilità con documenti padre, senza padre e padri ritirati; righe "Deriva da" nei sottocapitoli. Satisfies **AC-8**, **AC-9**, **AC-11**.
4. **Riepilogo, troncamento e volumi**: riepilogo con i conteggi e i non usati, messaggio di documento vuoto, anteprima troncata, misura dei tempi sul progetto grande. Satisfies **AC-12**, **AC-14**.

## Consequences

**Positive**:
- Nessuna dipendenza, rotta o formato nuovi: `start.py` e il file del progetto non cambiano.
- La tracciabilità del documento è la stessa della matrice: chi controlla la matrice controlla anche il capitolo 5.
- Aggiungere o correggere un DID è cambiare dati nella costante `DID`, non il generatore.

**Negative / tradeoffs**:
- Molti capitoli restano `_Da completare._`: il modello copre requisiti, interfacce, qualifica e tracciabilità, non stati e modi, decisioni di progetto o concetto di esecuzione. Il file è una base da completare, non un documento finito.
- Le interfacce sono tutte "esterne" in SSS e SRS: chi vuole separare le interne deve spostarle a mano nel file.
- La capitolazione è una lettura dei DID MIL-STD-498 in italiano fatta qui: chi segue una variante aziendale dovrà cambiare la costante.
- I testi dei requisiti sono scritti così come sono: un testo con un proprio titolo `#` o una tabella può disturbare la struttura del file.
- Rigenerare il file sovrascrive le modifiche fatte a mano su una copia precedente: il `.md` è un'uscita, non un documento da tenere in pari.
- `calcolaMatrice()`, già verificata, restituisce un campo in più e perde `dataOggi()`: vanno riprovati export e apertura della matrice.

**Neutral**:
- Nuovo modulo `js/documenti.js`, nuovo pulsante e nuova finestra; nuove esportazioni in `matrice.js` e `utils.js`: da riportare in `js/AGENTS.md` (lo fa `/sync`).
- `documenti.js` importa `gerarchia.js`, `matrice.js`, `progetto.js`, `libreria.js`: nessuna funzione importata va chiamata al caricamento (ciclo di import già noto).

## Follow-up

- [ ] Export Word o PDF dei documenti (voce Deferred dello scope): partirà da questo Markdown.
- [ ] Valutare con l'uso un campo per distinguere interfacce esterne e interne, se lo spostamento a mano diventa scomodo.
- [ ] Valutare se la capitolazione dei DID deve diventare configurabile (una variante aziendale).
