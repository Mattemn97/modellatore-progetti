# 0006. Matrice di tracciabilità per id, raggruppata per padre, con export Markdown

**Date**: 2026-10-01
**Status**: Proposed

## Summary

Il pulsante 📊 Matrice Requisiti apre una finestra grande con la tabella di tutte le derivazioni del modello: ogni padre una volta sola, sotto di lui i suoi figli, con id, titolo, blocco, metodo di verifica e documenti di entrambi i lati. Le righe sono per id del requisito (due Pompe uguali danno una riga sola, con il numero di istanze), perché testi e documenti appartengono al requisito di libreria e non all'istanza. La matrice segnala i padri senza figli e i requisiti senza padre con le stesse regole della Coerenza, si filtra per documento (scegliendo il lato), classe e testo, e si scarica come file `.md` con gli stessi filtri. Si calcola all'apertura dall'indice della Gerarchia (spec 0005); niente entra nel file del progetto e il server non cambia.

## Requirements

**User stories**:
- Come progettista voglio vedere in una tabella da quale requisito deriva ogni requisito, con i documenti di ciascun lato, così controllo la tracciabilità senza aprire ogni blocco.
- Come progettista voglio vedere subito quali padri non scendono a nessun figlio e quali requisiti non hanno padre, anche quando succede solo in alcune istanze.
- Come progettista voglio filtrare la matrice per documento (es. i requisiti dell'IRS e da dove vengono) e scaricarla in Markdown, così la porto in un documento o in una revisione.
- Come progettista voglio passare da una riga della matrice al requisito sul canvas con la sua gerarchia accesa.

**Acceptance criteria**:
- **AC-1**: Il pulsante `📊 Matrice Requisiti` (`#btnReqMatrix`) apre la finestra Matrice (`#matriceModal`, quasi a tutto schermo come la finestra di import cliente) e calcola la matrice dal modello di quel momento; mentre è aperta la matrice non si ricalcola. Si chiude con `✕` (Esc non la chiude, come le altre finestre). Aprirla, filtrarla, esportarla e chiuderla non cambia il file del progetto, non crea versioni e non cambia le modalità Coerenza e Gerarchia. Se la libreria non è caricata la finestra dice solo "Libreria non caricata: la matrice si calcola quando la carichi" e l'export è disattivato. Se il modello non ha derivazioni né problemi la finestra dice "Nessuna derivazione nel modello".
- **AC-2**: La tabella è raggruppata per padre: ogni gruppo mostra le celle del padre una volta sola (estese su tutte le righe del gruppo) e una riga per ogni figlio. Colonne, nell'ordine, con queste intestazioni: `ID padre`, `Titolo padre`, `Blocco padre`, `Metodo padre`, `Documenti padre`, `Classe`, `ID figlio`, `Titolo figlio`, `Blocco figlio`, `Metodo figlio`, `Documenti figlio`, `Istanze`, `Note`. ID è l'ID del cliente per un requisito cliente (`idCliente`), altrimenti l'id del requisito. Blocco è il titolo del blocco di libreria che possiede il requisito (`Cliente` per un requisito cliente); il suggerimento della cella Blocco elenca i percorsi delle istanze con le etichette del breadcrumb (es. `Progetto › Centralina › Pompa A`), al massimo 10 e poi "e altre N". Metodo è il metodo di verifica (vuoto per un requisito cliente o se non impostato). Classe è `Capacità` o la tipologia di interfaccia, una sola colonna perché padre e figlio di una derivazione valida hanno sempre la stessa classe.
- **AC-3**: Una riga è una coppia id padre → id figlio. Viene solo da fili di derivazione validi, con le regole della Gerarchia (spec 0005, AC-5): collegamenti tra blocchi fratelli, fili non validi e il contenuto di blocchi senza definizione non entrano. Se la stessa coppia compare in più istanze è una riga sola e la colonna Istanze dice quante istanze distinte del figlio derivano da un'istanza del padre con quell'id (due fili paralleli nella stessa istanza contano una volta). Un requisito cliente ritirato con fili validi è un padre come gli altri: il suo gruppo ha ID e titolo barrati e la nota "Ritirato".
- **AC-4**: Documenti di un requisito di libreria = i documenti distinti dei suoi `testiExport` con documento non vuoto, nell'ordine di `settings.documenti` (un documento fuori da quell'elenco va in fondo, in ordine alfabetico), separati da virgola; nessuno dà la cella vuota. Per un requisito cliente Documenti è sempre `Cliente`.
- **AC-5**: Un padre senza figli è segnalato con la regola della Coerenza, istanza per istanza. Un'istanza di un requisito di blocco conta come senza figli solo se il blocco ha un contenuto (almeno un blocco con definizione dentro) e il requisito non scende a nessun figlio di quel contenuto; un requisito cliente conta se è attivo e non ha figli; un ritirato senza figli non è segnalato e non compare. Se nessuna istanza ha figli il gruppo ha una sola riga con le celle del figlio vuote e la nota "Senza figli". Se alcune istanze hanno figli e altre contano come senza figli, il gruppo mostra i figli e la nota "Senza figli in X istanze su Y", dove Y sono le istanze che possono averne (blocco con contenuto). Un requisito che non ha figli in nessuna istanza e non conta come senza figli (sta solo in blocchi foglia) non è un gruppo.
- **AC-6**: In fondo alla tabella c'è il gruppo **Senza padre**, una tabella a parte con colonne ID, Titolo, Blocco, Classe, Metodo, Documenti, Note. Ci va ogni requisito di blocco che, in almeno un'istanza, non ha un padre valido che non sia un requisito cliente ritirato (la regola della Coerenza: un ritirato non fa da padre). Nota "Senza padre" se succede in tutte le istanze, "Senza padre in X istanze su Y" se solo in alcune (Y = tutte le istanze del requisito). I requisiti cliente non vanno mai qui.
- **AC-7**: Ordine dei gruppi: prima i requisiti cliente nell'ordine della lista cliente, poi i requisiti di blocco per livello (il livello di un requisito è la profondità della sua istanza meno profonda: 1 per un blocco della radice), a parità di livello per id in ordine naturale (`CEN_002` prima di `CEN_010`). Dentro un gruppo i figli seguono lo stesso ordine (livello, poi id). Il gruppo Senza padre è ordinato per livello e id.
- **AC-8**: In testa alla finestra ci sono i filtri, combinati tutti insieme: **Documento** (`Tutti`, ogni voce di `settings.documenti`, poi i documenti presenti nel modello ma non in `settings` in ordine alfabetico, poi `Cliente`) con accanto **Lato** (`Uno dei due` predefinito, `Padre`, `Figlio`), attivo solo quando è scelto un documento e disattivato con `Tutti`; **Classe** (`Tutte`, `Capacità`, ogni tipologia di `settings`); **Ricerca** (testo, senza distinguere maiuscole, su ID e titolo di padre e figlio). Con un documento scelto, una riga di derivazione resta se il documento è nei Documenti del lato scelto (con `Uno dei due`, di almeno un lato); una riga Senza figli ha solo il lato padre e resta con Lato `Padre` o `Uno dei due`, mai con `Figlio`; una voce Senza padre ha solo il lato figlio e resta con Lato `Figlio` o `Uno dei due`, mai con `Padre`. Con `Tutti` il documento non toglie nulla. Inoltre ogni riga deve avere la classe scelta e la ricerca deve trovare padre o figlio (per una riga Senza figli il padre, per una voce Senza padre la voce). Un gruppo si vede se almeno una sua riga resta; la sua nota resta quella calcolata sull'intero modello. Sopra la tabella i conteggi del risultato filtrato: **Padri** = gruppi visibili nel risultato; **Derivazioni** = righe di coppia nel risultato; **Senza figli** = gruppi nel risultato con stato `senzaFigli` o `parziale`; **Senza padre** = voci Senza padre nel risultato. Se nessuna riga resta, al posto della tabella "Nessuna riga con questi filtri". La ricerca si applica 200 ms dopo l'ultimo tasto.
- **AC-9**: A video si vedono al massimo `matrice.gruppiVisibili` gruppi (Senza padre conta come un gruppo per ogni sua voce); oltre compare "Mostra altri N gruppi", che ne aggiunge altrettanti. Cambiare un filtro riporta al primo blocco di gruppi. I conteggi e l'export riguardano sempre tutto il risultato filtrato, non solo i gruppi visibili.
- **AC-10**: Un clic su ID o titolo di un requisito nella tabella chiude la finestra, accende la Gerarchia (spegnendo la Coerenza se accesa, come in spec 0005), apre la scheda Gerarchia, apre il livello dell'istanza, centra il suo blocco e la sceglie, come un clic su una riga della scheda Gerarchia (spec 0005, AC-9). L'istanza è: per un padre con nota Senza figli (anche parziale) la prima istanza senza figli; per un altro padre la sua prima istanza; per un figlio in una riga di derivazione l'istanza figlio del primo filo che dà quella coppia; per una voce Senza padre la prima istanza senza padre. "Prima" è la meno profonda, a parità nell'ordine della visita. Se l'istanza non c'è più compare "Questo elemento non c'è più" come in spec 0005.
- **AC-11**: Il pulsante `⬇ Esporta .md` scarica un file Markdown con il risultato filtrato completo (tutti i gruppi, non solo quelli visibili). Contenuto, riga per riga (righe vuote tra i blocchi):
  - `# Matrice di tracciabilità: <nome progetto>`
  - `Data: <AAAA-MM-GG, ora locale> · Libreria: <nome del file> v<versione>` (senza versione solo `Libreria: <nome del file>`; senza libreria non si esporta)
  - `Filtri: Documento <doc> (lato <padre | figlio | uno dei due>) · Classe <classe> · Ricerca "<testo>"`, solo le parti non predefinite; `Filtri: nessuno` se tutti predefiniti
  - `Padri: <n> · Derivazioni: <n> · Senza figli: <n> · Senza padre: <n>` (i conteggi di AC-8)
  - `## Derivazioni` con una tabella delle colonne e intestazioni di AC-2, dove le celle del padre (da `ID padre` a `Documenti padre`) sono scritte solo sulla prima riga del gruppo e lasciate vuote nelle seguenti; `Classe` e `Note` sono scritte su ogni riga che le ha (la nota del gruppo sulla prima)
  - `## Senza padre` con la tabella di AC-6 (intestazioni `ID`, `Titolo`, `Blocco`, `Classe`, `Metodo`, `Documenti`, `Note`). Una sezione senza righe dice "Nessuna voce". Nelle celle `\` diventa `\\`, `|` diventa `\|`, gli a capo diventano spazi; un ritirato non è barrato e ha la nota "Ritirato". Nome del file: `<slug del progetto>-matrice.md`, oppure `<slug>-matrice-<slug del documento>.md` con un filtro documento (es. `impianto-matrice-sss.md`). Con il risultato filtrato vuoto il pulsante è disattivato.
- **AC-12**: Filtri e ricerca restano quelli dell'ultima volta quando riapri la finestra, finché la pagina resta aperta (non nel file del progetto). Un documento o una tipologia scelti che non sono più tra le voci dei filtri tornano a `Tutti` / `Tutte`. A finestra aperta Esc della Gerarchia non fa nulla e Ctrl+Z / Ctrl+Y non agiscono (entrambi già guardano `modaleAperta()`).
- **AC-13**: Su un progetto con 3000 requisiti cliente e 200 blocchi la finestra si apre in meno di un secondo e scrivere nella ricerca non blocca la pagina.

## Decision

**Chosen option**: Option 1: matrice calcolata all'apertura sopra l'indice delle occorrenze di `calcolaGerarchia()`, raggruppata per id del requisito, in un modulo nuovo `js/matrice.js` con una finestra dedicata e il download dal browser.

`calcolaMatrice(indice, libreria, cliente)` è una funzione pura: prende l'indice della spec 0005 (ricalcolato all'apertura, mai `ultimoIndice` della Gerarchia, che esiste solo a modalità accesa), raggruppa occorrenze e fili per id, calcola stati e conteggi per istanza e restituisce la matrice completa. Filtri, limite, tabella ed export lavorano sul risultato tenuto in una variabile del modulo.

**Decisioni di dettaglio** (scelta, perché, alternativa scartata):
- **Contenuto dei blocchi nell'indice**: `calcolaGerarchia()` aggiunge al risultato `percorsiConContenuto: Set<string>`: nel suo `nodo()`, quando `def` c'è e `ctx.percorso.length > 0`, aggiunge `ctx.percorso.join('/')`. È la stessa condizione di `ctx.stato.bloccoConDefinizione` della Coerenza. Un'occorrenza di blocco conta come senza figli se `figli.size === 0` e `percorsiConContenuto.has(percorso.join('/'))`. Scartato: una seconda visita dentro `matrice.js` (due regole che possono divergere) o leggere `calcolaCoerenza()` (le sue voci non sono per occorrenza con le chiavi dell'indice).
- **Raggruppamento per id**: la voce di un requisito ha chiave `occ.reqId` (per il cliente è già `prefisso + idCliente`, e l'import impedisce che coincida con un id di libreria). Gli id dei requisiti sono unici in tutta la libreria perché `impostaLibreria()` rifiuta una libreria con duplicati (`trovaIdRequisitiDuplicati()`) e il `Salva` dell'ispettore li rifiuta: è l'invariante su cui poggia il raggruppamento. Per difesa, se due blocchi avessero lo stesso id, la mappa tiene il primo.
- **Blocco di un requisito**: una mappa `reqId → blocco` costruita una volta da `libreria`. L'occorrenza non porta il tipo del nodo e non serve aggiungerlo. Scartato: aggiungere `tipo` all'occorrenza, un campo in più nell'indice per un dato già ricavabile.
- **Istanze di una coppia**: per ogni filo di `indice.filiPerLivello` con padre e figlio presenti in `indice.occorrenze` (come fa l'indice stesso), la coppia è `(occorrenze.get(padre).reqId, occorrenze.get(figlio).reqId)`; Istanze è il numero di chiavi figlio distinte della coppia. Il primo filo incontrato (ordine della visita) dà `chiaveFiglio` per il clic di AC-10. Scartato: contare i fili, che con due fili paralleli nella stessa istanza dà un numero che non sono istanze.
- **Padre valido per Senza padre**: un'occorrenza di blocco ha padre se in `padri` c'è almeno una chiave la cui occorrenza non è un cliente con `req.stato === 'ritirato'`. È la regola della Coerenza (alla radice un ritirato non fa da padre); la Gerarchia invece lo mostra come padre, ed è giusto che la matrice lo mostri come gruppo (AC-3) ma non lo conti come copertura.
- **Livello e "prima istanza"**: livello di un'occorrenza = `percorso.length` (0 per il cliente). La prima istanza di un requisito è quella con livello minimo, a parità la prima nell'ordine di inserimento di `indice.occorrenze` (che segue la visita). Ordine naturale degli id con un solo `Intl.Collator('it', { numeric: true })` creato nel modulo e riusato (con migliaia di gruppi `localeCompare` ripetuto costa troppo).
- **Calcolo all'apertura**: la finestra copre il canvas, quindi il modello non cambia mentre è aperta; ricalcolare a ogni `render()` sarebbe una visita per fotogramma senza scopo. Il risultato sta in `ultimaMatrice`, variabile del modulo, mai in `appState`. Scartato: ricalcolo per fotogramma come Gerarchia e Coerenza.
- **Voci del filtro Documento**: `appSettings.documenti`, poi i documenti trovati nelle voci della matrice e assenti da `settings` (ordine alfabetico), poi `Cliente`; calcolate a ogni apertura. Lato è `disabled` finché Documento è `Tutti`, e `filtraMatrice()` lo ignora in quel caso. Scartato: Lato sempre attivo, che con `Tutti` toglierebbe righe senza che si veda un filtro scelto.
- **Filtri a due passi**: prima si filtrano le righe di ogni gruppo e le voci Senza padre (AC-8), poi si tengono i gruppi con almeno una riga. Il risultato filtrato è un elenco che alimenta allo stesso modo la tabella (troncata a `gruppiVisibili`), i conteggi e l'export. La classe di una riga è quella del figlio (uguale al padre in una derivazione valida); di una riga Senza figli quella del padre.
- **Clic verso la Gerarchia**: nuova `apriGerarchiaSu(chiave)` esportata da `gerarchia.js`: `accendi()`, riapre il pannello sinistro, `mostraScheda('gerarchia')`, poi `vaiAOccorrenza(chiave)`, che rifà l'indice e gestisce l'istanza sparita. Le due chiamate a pannello e scheda restano esplicite perché `accendi()` esce subito se la modalità è già accesa. La matrice tiene nelle celle solo la chiave dell'occorrenza (`data-chiave`), mai oggetti del modello. Scartato: `mostraGerarchiaDi()`, che sceglie senza cambiare livello.
- **Finestra**: nuovo `#matriceModal` in `index.html` con `.modal-body.modal-matrice` (larghezza 95%, `max-width: 1400px`, `max-height: 90vh`, scorrimento interno; intestazione con i filtri fissa in alto). `#reportModal` resta ad Apri e Changelog. `modaleAperta()` di `progetto.js` considera aperta anche `#matriceModal`, così Esc della Gerarchia non agisce (AC-12). Tabella HTML con un `<tbody>` per gruppo e `rowspan` sulle celle del padre.
- **Download**: nuova `scaricaFileTesto(testo, nomeFile, tipo)` in `storage.js` con `Blob` e `URL.createObjectURL` (poi `revokeObjectURL`), tipo `text/markdown;charset=utf-8`. Scartato: l'URL `data:` di `downloadJsonFile()`, che con decine di migliaia di righe diventa una stringa enorme e alcuni browser la troncano. Scartato: scrivere in `progetti/` dal server (rotta nuova, sovrascritture da decidere, nessun bisogno emerso).
- **Slug e nome del progetto**: nuova `infoProgetto()` esportata da `progetto.js` che restituisce `{ slug, nome }` dal suo stato interno, così il file scaricato usa lo stesso slug del file del progetto (con il limite di lunghezza di `progetto.js`). Senza progetto aperto (`slug` nullo): nome = `pathStack[0].label`, slug = `slugifyId(nome)`, `matrice` se vuoto. Lo slug del documento è `slugifyId(documento)`. Scartato: ricavare lo slug dal nome, che può differire dallo slug vero.
- **Versione della libreria**: nuova `infoLibreria()` esportata da `libreria.js` che restituisce `{ nomeFile, versione }` dal suo stato interno; senza versione la riga dice solo il nome del file.
- **Escape**: a video ogni testo passa per `escapeHtml()`, anche in `title` e `data-*`. In Markdown la funzione `cellaMd()` applica le sostituzioni di AC-11 e taglia gli spazi ai bordi.

**Implementation skills**: none (stack senza skill della comunità, vedi `AGENTS.md`).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (solo in memoria, ricalcolato a ogni apertura, mai nel file del progetto; nessuna migrazione):

```
VoceRequisito = {                // una per id di requisito presente nell'indice
  id: string,                    // occ.reqId, cioè req.id (per il cliente è già prefisso + idCliente)
  idMostrato: string,            // req.idCliente per il cliente, altrimenti req.id
  titolo: string,                // titoloRequisito(req)
  cliente: boolean,
  ritirato: boolean,             // cliente && req.stato === 'ritirato'
  blocco: string,                // titolo del blocco di libreria, 'Cliente' per il cliente
  percorsi: string[],            // per il suggerimento: nome progetto + etichette, unite da ' › '
  classe: string,                // getClasseRequisito(req)
  metodo: string,                // req.metodoVerifica || '' ('' per il cliente)
  documenti: string[],           // AC-4
  occorrenze: string[],          // chiavi dell'indice, ordinate per livello poi visita
  livello: number,               // percorso.length minimo
  istanzeConContenuto: number,   // Y di AC-5
  istanzeSenzaFigli: number,     // X di AC-5
  chiaveSenzaFigli: string|null, // prima istanza senza figli (AC-10)
  istanzeSenzaPadre: number,     // X di AC-6 (Y = occorrenze.length)
  chiaveSenzaPadre: string|null, // prima istanza senza padre (AC-10)
  notaSenzaPadre: string         // 'Senza padre' o 'Senza padre in X istanze su Y'; '' se ha sempre padre
}

RigaFiglio = { figlio: VoceRequisito, istanze: number, chiaveFiglio: string }   // istanze = chiavi figlio distinte; chiaveFiglio dal primo filo

GruppoPadre = {
  padre: VoceRequisito,
  figli: RigaFiglio[],           // vuoto se stato 'senzaFigli'
  stato: 'coperto' | 'parziale' | 'senzaFigli',
  nota: string                   // 'Ritirato', 'Senza figli', 'Senza figli in X istanze su Y', unite da '; '
}

Matrice = {
  libreriaAssente: boolean,
  gruppi: GruppoPadre[],         // ordine di AC-7
  senzaPadre: VoceRequisito[],   // ordine di AC-7, solo voci con notaSenzaPadre non vuota
  documentiExtra: string[]       // documenti trovati nel modello e assenti da settings, in ordine alfabetico
}

Stato del modulo matrice.js (mai in appState):
  ultimaMatrice, filtri { documento, lato, classe, ricerca }, gruppiMostrati, timerRicerca
```

Relazioni: GruppoPadre 1:N RigaFiglio; RigaFiglio N:1 VoceRequisito (il figlio); GruppoPadre 1:1 VoceRequisito (il padre); VoceRequisito 1:N occorrenze dell'indice (spec 0005). Unicità: un gruppo per id padre, una riga per coppia di id.

Stato di un gruppo: `senzaFigli` se `istanzeSenzaFigli > 0` e nessuna occorrenza ha figli; `parziale` se `istanzeSenzaFigli > 0` e almeno una ha figli; `coperto` altrimenti. Un id che non ha figli in nessuna occorrenza e ha `istanzeSenzaFigli === 0` non è un gruppo.

**State transitions**: la finestra è `chiusa` → `aperta` (pulsante, calcolo) → `chiusa` (`✕`, oppure clic su un requisito che porta alla Gerarchia). Nessuno stato del modello cambia.

**API surface** (nessuna rotta server; funzioni client):

| Funzione | Input | Output | Errori o casi |
|---|---|---|---|
| `calcolaGerarchia()` (`gerarchia.js`, estesa) | come oggi | in più `percorsiConContenuto: Set<string>` | |
| `apriGerarchiaSu(chiave)` (`gerarchia.js`, nuova) | chiave di un'occorrenza | accende la modalità, apre la scheda, `vaiAOccorrenza()` | istanza sparita: messaggio di spec 0005 |
| `calcolaMatrice(indice, libreria, cliente)` (`matrice.js`) | indice, modello | `Matrice` | `indice.libreriaAssente`: `{ libreriaAssente: true, gruppi: [], senzaPadre: [] }` |
| `filtraMatrice(matrice, filtri)` (`matrice.js`) | matrice, `{ documento, lato, classe, ricerca }` | `{ gruppi, senzaPadre, conteggi }` filtrati | filtri vuoti: tutto |
| `matriceInMarkdown(filtrata, intestazione)` (`matrice.js`) | risultato filtrato, `{ nome, data, libreria, filtri }` | testo `.md` di AC-11 | sezione vuota: "Nessuna voce" |
| `apriMatrice()` / `chiudiMatrice()` (`matrice.js`) | | calcola, mostra o nasconde `#matriceModal` | |
| `initMatrice()` (`matrice.js`, chiamata da `initApp()`) | | gestori di `#btnReqMatrix`, filtri, ricerca, Mostra altri, export, clic sulle celle, `✕` | |
| `scaricaFileTesto(testo, nomeFile, tipo)` (`storage.js`, nuova) | testo, nome, tipo MIME | download dal browser | |
| `infoLibreria()` (`libreria.js`, nuova) | | `{ nomeFile, versione }` dall'oggetto `libreria` del modulo | libreria non caricata: `{ nomeFile: '', versione: null }` |
| `infoProgetto()` (`progetto.js`, nuova) | | `{ slug, nome }` dall'oggetto `progetto` del modulo | nessun progetto aperto: `slug` nullo |
| `modaleAperta()` (`progetto.js`, estesa) | | vero anche con `#matriceModal` aperta | |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Calcolo | occorrenze, padri, figli, fili | `calcolaGerarchia(pathStack[0].graph, appState.library, appState.cliente)` (spec 0005) |
| Calcolo | blocco con contenuto | `indice.percorsiConContenuto` (nuovo, vedi Decision) |
| Calcolo | ritirato | `occ.cliente && occ.req.stato === 'ritirato'` |
| Calcolo | blocco di un requisito | mappa `reqId → appState.library[tipo]` costruita da `libreria` |
| Calcolo | istanze di una coppia | chiavi figlio distinte tra i fili di `indice.filiPerLivello` con quella coppia di `reqId` (estremi presenti nell'indice) |
| Calcolo | livello | `occ.percorso.length`, minimo sulle occorrenze |
| Tabella | ID | `req.idCliente` per il cliente, altrimenti `req.id` |
| Tabella | Titolo | `titoloRequisito(req)` |
| Tabella | Blocco | `libreria[tipo].titolo`; `Cliente` per il cliente |
| Tabella | suggerimento Blocco | `pathStack[0].label` più `occ.etichette`, unite da ` › `, prime 10 occorrenze |
| Tabella | Metodo | `req.metodoVerifica` (vuoto per il cliente) |
| Tabella | Documenti | `req.testiExport[].documento` non vuoti, distinti, ordinati per `appSettings.documenti`; `Cliente` per il cliente |
| Tabella | Classe | `getClasseRequisito(req)` del figlio (del padre per Senza figli) |
| Tabella | Istanze | `RigaFiglio.istanze` |
| Tabella | Note | `GruppoPadre.nota`; per Senza padre `VoceRequisito.notaSenzaPadre` |
| Tabella | risultato vuoto | testo fisso "Nessuna riga con questi filtri" |
| Filtri | voci Documento | `appSettings.documenti`, poi `Matrice.documentiExtra`, poi `Cliente` |
| Filtri | Lato attivo | Documento diverso da `Tutti` |
| Conteggi | padri, derivazioni, senza figli, senza padre | predicati di AC-8 sul risultato di `filtraMatrice()` |
| Filtri | voci Classe | `CAPACITA` più `getTipologie()` |
| Filtri | valori scelti | variabile `filtri` del modulo, tenuta tra un'apertura e l'altra |
| Limite | gruppi visibili | `appSettings.matrice.gruppiVisibili` |
| Clic | chiave dell'istanza | `chiaveSenzaFigli`, `occorrenze[0]`, `RigaFiglio.chiaveFiglio`, `chiaveSenzaPadre` (AC-10), in `data-chiave` |
| Export | nome del progetto | `infoProgetto().nome`, altrimenti `pathStack[0].label` |
| Export | slug del file | `infoProgetto().slug`, altrimenti `slugifyId(nome)` o `matrice`; più `slugifyId(documento)` con un filtro documento |
| Export | data | `new Date()` in ora locale, `AAAA-MM-GG` |
| Export | libreria e versione | `infoLibreria()` (nuova, `libreria.js`) |
| Export | filtri e conteggi | `filtri` e `conteggi` di `filtraMatrice()` |

**Key invariants**:
- Il calcolo non cambia mai il modello e nessuna azione della matrice scrive nel file del progetto o in `appState`.
- Una coppia padre e figlio entra solo da un filo che `visitaDerivazioni()` dà valido e di derivazione: Gerarchia, Coerenza e Matrice non possono divergere su cosa è un padre.
- "Senza figli" e "Senza padre" danno, istanza per istanza, lo stesso verdetto della Coerenza (spec 0004).
- Esportazione e tabella vengono dallo stesso risultato filtrato: il file contiene ciò che vedi, più i gruppi oltre il limite.
- Il clic risolve dall'indice di adesso per chiave, mai da oggetti tenuti da prima.

**Security model**: un solo utente in locale, nessuna rotta nuova, nessun dato nuovo su disco (il file scaricato lo salva il browser dove sceglie l'utente). Id, titoli, etichette e documenti sono testo dell'utente o del cliente: `escapeHtml()` prima di `innerHTML`, anche negli attributi; nel Markdown `cellaMd()` impedisce che un `|` o un a capo rompa la tabella. Nessun dato regolamentato.

**Configuration required** (nuova chiave in `settings.json`, in `DEFAULT_SETTINGS` e nel merge annidato di `loadSettings()` in `js/state.js`):
- `matrice.gruppiVisibili`: `300`, gruppi mostrati a video prima di "Mostra altri".

**Critical test scenarios**:
- Happy path: 2 requisiti cliente; Centralina alla radice con `CEN_001` derivato da `CLI-1`; dentro Centralina due Pompe dello stesso tipo, entrambe con `PMP_001` derivato da `CEN_001`. La matrice mostra il gruppo `1` (Cliente) → `CEN_001`, poi il gruppo `CEN_001` → `PMP_001` con Istanze `2`, documenti dei testi e metodi a posto. Il file del progetto non ha versioni nuove. Verifica **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-7**.
- Problemi per istanza: due Centraline, solo una con fili dentro: il gruppo `CEN_001` ha la nota "Senza figli in 1 istanza su 2"; togliendo i fili anche dalla seconda il gruppo diventa "Senza figli" con una riga vuota. `CLI-2` attivo senza fili è "Senza figli"; ritirato senza fili non compare; ritirato con un filo verso `CEN_002` è un gruppo barrato e `CEN_002` è in Senza padre. Una Pompa foglia senza contenuto non è segnalata. Verifica **AC-5**, **AC-6**, **AC-3**.
- Filtri: `PMP_001` con testo in IRS, `CEN_001` in SSS. Documento IRS lato Figlio: resta solo il gruppo `CEN_001` → `PMP_001`; lato Padre: nessuna riga; Documento Cliente lato Padre: i gruppi cliente. Una riga Senza figli sparisce con Lato Figlio. Con Documento `Tutti` il Lato è disattivato e non toglie nulla. Un documento `XYZ` scritto a mano in un testo e assente da `settings` compare nel filtro. Classe Elettrica e ricerca "pomp" si combinano; i conteggi seguono; una ricerca senza risultati dice "Nessuna riga con questi filtri". Verifica **AC-8**.
- Volumi: progetto con 3000 requisiti cliente e 200 blocchi: si apre sotto il secondo, si vedono 300 gruppi e "Mostra altri"; scrivere nella ricerca resta fluido; l'export contiene tutti i gruppi del risultato. Verifica **AC-9**, **AC-13**, **AC-11**.
- Export: con filtro SSS il file si chiama `<slug>-matrice-sss.md`, ha intestazione, filtri, conteggi, padre scritto solo sulla prima riga del gruppo; un titolo con `|` e un a capo non rompe la tabella; con risultato vuoto il pulsante è disattivato. Verifica **AC-11**.
- Clic: clic su `PMP_001` in una riga apre la Gerarchia sul livello della prima Pompa che deriva da `CEN_001`, con la catena accesa e la Coerenza spenta; clic su un padre "Senza figli in 1 istanza su 2" porta alla Centralina senza figli. Verifica **AC-10**.
- Persistenza e casi limite: chiudi e riapri: filtri e ricerca restano, i dati sono ricalcolati; libreria non caricata: messaggio ed export disattivato; Esc a finestra aperta con una scelta in Gerarchia non toglie la scelta. Verifica **AC-12**, **AC-1**.

## Build plan

Tracer Bullet: il primo compito porta una derivazione dal modello alla finestra e al file `.md`; i successivi completano colonne e problemi, poi filtri e volumi, poi il passaggio alla Gerarchia.

1. **Filo minimo dal modello alla finestra e al file**: chiave `matrice.gruppiVisibili` in `settings.json`, `DEFAULT_SETTINGS` e `loadSettings()`; `#matriceModal` in `index.html` e stile `.modal-matrice`; `js/matrice.js` con `calcolaMatrice()` (gruppi per id, coppie con istanze, ID, titolo e documenti dei due lati), `apriMatrice()`, `chiudiMatrice()`, `initMatrice()` collegata a `#btnReqMatrix` da `initApp()`; tabella raggruppata con `rowspan`; `modaleAperta()` estesa; `scaricaFileTesto()` in `storage.js`, `infoLibreria()` in `libreria.js`, `infoProgetto()` in `progetto.js`, `matriceInMarkdown()` senza filtri; messaggi di libreria assente e di modello vuoto. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-11**.
2. **Colonne complete e problemi**: Blocco con suggerimento dei percorsi, Metodo, Classe, Istanze, Note; `percorsiConContenuto` in `calcolaGerarchia()`; stati `coperto`, `parziale`, `senzaFigli`; tabella Senza padre con la regola dei ritirati; ritirati barrati; ordine per cliente, livello e id naturale. Satisfies **AC-2**, **AC-5**, **AC-6**, **AC-7**.
3. **Filtri, volumi ed export completo**: `filtraMatrice()` con Documento e Lato, Classe, Ricerca a 200 ms; conteggi; limite `gruppiVisibili` con "Mostra altri"; filtri tenuti tra un'apertura e l'altra e riportati a `Tutti` se spariti da `settings`; export del risultato filtrato con intestazione dei filtri e nome del file con il documento; pulsante disattivato a risultato vuoto; misura dei tempi sul progetto grande. Satisfies **AC-8**, **AC-9**, **AC-11**, **AC-12**, **AC-13**.
4. **Dalla matrice alla Gerarchia**: `apriGerarchiaSu()` in `gerarchia.js`; `data-chiave` sulle celle ID e Titolo con le istanze di AC-10; chiusura della finestra e navigazione. Satisfies **AC-10**.

## Consequences

**Positive**:
- Nessuna dipendenza, rotta o formato nuovi: `start.py` e il file del progetto non cambiano.
- Padri, figli, senza figli e senza padre vengono dalla stessa visita e dalle stesse regole di Gerarchia e Coerenza: i tre strumenti non possono contraddirsi.
- Il raggruppamento per id e i documenti per lato sono già la tabella di tracciabilità che l'export MIL-STD-498 (voce 7) dovrà scrivere: `calcolaMatrice()` e `filtraMatrice()` si possono riusare lì.

**Negative / tradeoffs**:
- Le righe per id nascondono quale istanza dà quale coppia: la colonna Istanze e il suggerimento lo dicono solo in parte; per il dettaglio serve il clic verso la Gerarchia.
- La matrice è una fotografia: se la libreria cambia su disco mentre la finestra è aperta, si vede solo riaprendola.
- 13 colonne a video sono strette sotto i 1200 px di larghezza; il testo va a capo dentro le celle.
- `calcolaGerarchia()` e `modaleAperta()`, già verificate, cambiano un poco: vanno riprovati gli scenari di spec 0005 legati a Esc e all'indice.
- Il file `.md` con le celle del padre vuote dopo la prima riga è comodo da leggere ma meno comodo da riordinare in un foglio di calcolo.

**Neutral**:
- Nuovo modulo `js/matrice.js`, nuove funzioni esportate in `gerarchia.js`, `storage.js`, `libreria.js`, `progetto.js`; `#btnReqMatrix` smette di essere senza gestore: da riportare in `js/AGENTS.md` (lo fa `/sync`).
- `matrice.js` importa `gerarchia.js`, `progetto.js`, `libreria.js`: nessuna funzione importata va chiamata al caricamento (ciclo di import già noto).

## Follow-up

- [ ] Valutare con l'uso se serve una vista per occorrenza (righe per istanza con il percorso) accanto a quella per id.
- [ ] Alla voce 7 (export MIL-STD-498) riusare `calcolaMatrice()` e `filtraMatrice()` con Documento e Lato `Figlio` per il capitolo di tracciabilità.
- [ ] Il filtro Classe qui è locale alla finestra; la voce 8 (Filtri avanzati) deciderà se i filtri generali la sostituiscono.
