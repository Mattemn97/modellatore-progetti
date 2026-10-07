# Scope · Blocco G: feedback degli utenti → 2.2.0

Cinque richieste arrivate da chi usa già la 2.1.0 su progetti veri. Vengono prima degli altri blocchi perché tolgono fastidi di tutti i giorni: fili ingarbugliati sul canvas, blocchi composti da ricostruire a mano, una matrice difficile da filtrare e un import cliente che porta dentro righe che non sono requisiti. Regola che vale per ogni voce: progetti e librerie salvati con la 2.1.0 si aprono senza perdite (vedi "Come si chiude ogni blocco" in [index.md](index.md)).

Livello predefinito di questo blocco: **Beta** (dopo `/develop`, `/check verify` poi `/test`). Quadro generale e legenda in [index.md](index.md).

**Branch:** ogni voce parte da `develop` (`feat/<nome>`) e ci torna con un merge; il rilascio (voce 62) fa il merge di `develop` in `main`.

## Blocco G · Feedback degli utenti

### 57. Filtro delle righe nell'import cliente · done
Nella finestra di import dei requisiti cliente, un campo in più da mappare: scegli una colonna e un testo, e diventano requisiti cliente solo le righe in cui quella colonna contiene quel testo (per esempio colonna "Tipo" contiene "Requirement"). Oggi ogni riga con id e testo viene importata, anche titoli e note.
**Done when:** scegli colonna e testo nella finestra di import, l'anteprima dice quante righe passano e quante sono escluse, l'import porta dentro solo le righe che passano; il filtro si ricorda con l'ultimo import (come le colonne) e senza filtro tutto funziona come oggi.
- [x] Design it (spec): [0030](../specs/0030-filtro-righe-import-cliente.md)
- [x] Build it: `src/renderer/cliente.ts` (`passaFiltro()`, `estraiRighe()` con il filtro, scheda Esclusi), test in `tests/unit/import-cliente.test.ts` e `tests/e2e/ui/cliente.spec.ts`

### 58. Filtri per colonna nella Matrice · done
Filtri come in Excel sulla tabella della Matrice di tracciabilità: ogni intestazione ha un menu ▼ con l'elenco dei valori da spuntare, una casella di ricerca e l'ordinamento, così trovi al volo quello che ti serve senza combinare a mano i filtri globali.
**Done when:** ogni colonna ha il suo menu con valori, ricerca e ordinamento A→Z / Z→A; i filtri di più colonne si combinano fra loro e con quelli che ci sono già; una colonna filtrata si riconosce a colpo d'occhio; "Pulisci filtri" azzera tutto; l'export Markdown segue i filtri; funziona anche col pannello staccato.
- [x] Design it (spec): [0031](../specs/0031-filtri-colonne-matrice.md)
- [x] Build it: `src/renderer/matrice.ts` (`COLONNE_DERIVAZIONI`, `filtraMatrice()` con colonne e ordine, `valoriColonna()`, menu `#menuColonnaMatrice`, `Pulisci filtri`), test in `tests/unit/regole.test.ts`, `tests/e2e/ui/tracciabilita.spec.ts` e `pannelli.spec.ts`

### 59. Pin di capacità spostabili · done
I quadratini dei requisiti di capacità dentro il rettangolo di un blocco si possono trascinare dove vuoi, agganciati alla griglia, per orientarli verso i blocchi a cui vanno e non incrociare i fili. Oggi l'app li mette in fila da sola e non si possono spostare.
**Done when:** trascini un quadratino dentro il blocco e resta lì (salvato per istanza, come le porte di interfaccia sul bordo); non esce dal rettangolo né si sovrappone a un altro; un comando "Riposiziona i pin" torna alla disposizione automatica; ridimensionando il blocco i pin restano dentro; le immagini dei diagrammi (spec 0029) li disegnano nella nuova posizione; i progetti vecchi si aprono con la disposizione di oggi.
- [x] Design it (spec): [0032](../specs/0032-pin-capacita-spostabili.md)
- [x] Build it: `posizioniCapacita()` / `puntoPin()` in `src/renderer/diagramma.ts`, Shift+trascina in `renderer.ts`, `↺ Riposiziona i pin` in `inspector.ts`, test in `tests/unit/regole.test.ts` e `tests/e2e/ui/editor.spec.ts`

### 60. Instradamento automatico dei fili · done
I fili non passano mai sotto i blocchi: l'app li fa girare intorno con tratti ad angolo retto. I punti che hai messo a mano su un filo vincono sempre; un comando "Reinstrada" li toglie e lascia fare all'app. Si appoggia alle posizioni dei pin della voce 59, per questo viene dopo.
**Done when:** un filo senza punti manuali non attraversa nessun blocco del livello (né i blocchi tondi) e si aggiorna da solo quando sposti un blocco; un filo con punti manuali resta com'è finché non scegli "Reinstrada" (su un filo o su tutto il livello); trascinare blocchi su un livello affollato resta fluido; le immagini dei diagrammi mostrano gli stessi percorsi del canvas.
- [x] Design it (spec): [0033](../specs/0033-instradamento-fili.md)
- [x] Build it: `src/renderer/instradamento.ts` (A* sulla griglia di Hanan, cache), `contestoFili()` / `percorsoFilo()` in `diagramma.ts`, `↻ Reinstrada` in `renderer.ts`, `inspector.ts` e nella barra del canvas, test in `tests/unit/instradamento.test.ts` e `tests/e2e/ui/editor.spec.ts`

### 61. Blocchi di libreria con l'interno (matrioska) · done
Un blocco di libreria può salvare anche il suo interno: i blocchi figli, i fili e le posizioni dei blocchi tondi. Ogni nuova istanza trascinata dalla libreria nasce già con quella struttura dentro, così un sottosistema ricorrente si costruisce una volta sola. Il comando deve essere evidente (per esempio "Salva l'interno in libreria" dall'Ispettore di un'istanza).
**Done when:** da un'istanza salvi il suo interno come contenuto standard del blocco; una nuova istanza lo riceve già pronto a ogni livello di annidamento; le istanze già presenti nel progetto non cambiano da sole; il changelog della libreria registra la modifica; si impedisce un blocco che contiene se stesso; le librerie e i progetti della 2.1.0 si aprono come prima; un blocco figlio usato dentro ma assente dalla libreria viene segnalato.
- [x] Design it (spec): [0034](../specs/0034-blocchi-matrioska.md)
- [x] Build it: `src/renderer/matrioska.ts` (istanziazione, controlli), `Blocco.interno` conservato da `normalizzaBlocco()` e dal salvataggio dell'Ispettore, Salva / Togli l'interno in `inspector.ts`, 📦 e ⚠ in `builder.ts`, rinomina negli interni in `src/main/api/librerie.ts`; test in `tests/unit/matrioska.test.ts`, `tests/e2e/ui/libreria.spec.ts`, `tests/e2e/api/libreria.spec.ts`

### 62. Rilascio 2.2.0
Chiude il blocco come descritto in [index.md](index.md): `version` 2.2.0, note in `packaging/note/2.2.0.md`, `packaging/TUTORIAL.md` e `docs/guida/` aggiornati (pin, fili, matrioska, filtri della Matrice, filtro dell'import), aiuto contestuale e tour allineati, merge di `develop` in `main`.
**Done when:** la Release 2.2.0 è pubblicata e una copia 2.1.0 installata si aggiorna e apre i suoi progetti senza perdite.
- [ ] Prepare the release: `/develop rilascio 2.2.0`
