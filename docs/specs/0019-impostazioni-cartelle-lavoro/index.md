# 0019. Impostazioni e cartelle di lavoro

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Il programma installato non può scrivere accanto a sé, quindi progetti, librerie e impostazioni vivono in cartelle scelte da te. Una **cartella di lavoro** contiene `progetti/` e `settings.json`; una **cartella delle librerie**, all'inizio `<cartella di lavoro>\shared`, contiene le librerie con changelog e copie. Al primo avvio (o se una cartella sparisce) una pagina di benvenuto propone `Documenti\Modellatore MBSE` e crea la struttura; dopo, la finestra Impostazioni permette di cambiare le due cartelle. I percorsi scelti stanno nei dati utente di Windows, mai nella cartella del programma.

## Requirements

**User stories**:
- Come utente voglio dire al programma dove sono le mie librerie e i miei progetti, anche su un'altra unità o una cartella di rete.
- Come utente al primo avvio voglio che il programma mi proponga una cartella e la prepari da solo.

**Acceptance criteria**:
- **AC-1**: La configurazione è `configurazione.json` nella cartella `userData` di Electron: `{ formatVersion: 1, cartellaLavoro: string, cartellaLibrerie: string | null }` (`null` = `<cartellaLavoro>\shared`). Un file mancante, rotto o con percorsi non assoluti vale "non configurato".
- **AC-2**: All'avvio, se la configurazione manca o una delle due cartelle non esiste o non è scrivibile, la finestra mostra la pagina di benvenuto (`app://modellatore/benvenuto.html`) invece dell'editor. Con configurazione mancante propone `<Documenti>\Modellatore MBSE`; con una cartella sparita spiega quale e propone la stessa.
- **AC-3**: Dalla pagina di benvenuto: "Usa questa cartella" crea (se mancano) la cartella di lavoro, `progetti/`, la cartella delle librerie con `libreria.json` di esempio e `settings.json` dai valori predefiniti del programma; salva la configurazione e apre l'editor. "Scegli un'altra cartella…" apre la finestra di Windows per scegliere una cartella e aggiorna la proposta. Un errore (permessi, disco) si mostra in italiano sulla pagina, senza salvare la configurazione.
- **AC-4**: Le API usano le cartelle configurate: i progetti in `<cartellaLavoro>\progetti`; un `libraryPath` che inizia con `shared/` punta dentro la cartella delle librerie (l'unica scrivibile, esclusi i `_versioni`); gli altri percorsi relativi si leggono dalla cartella di lavoro in sola lettura, mai da `progetti/`. Il contratto delle API (spec 0018) non cambia.
- **AC-5**: `settings.json` della pagina e delle API è quello della cartella di lavoro; se manca si usano i valori predefiniti del programma (che `loadSettings()` già fonde con `DEFAULT_SETTINGS`). Non si riscrive mai un `settings.json` esistente.
- **AC-6**: Un pulsante "⚙ Impostazioni" nell'intestazione apre la finestra Impostazioni con: cartella di lavoro e cartella delle librerie (percorso, "Cambia…", "Apri in Esplora risorse"; per le librerie anche "Usa quella predefinita"), il percorso di `settings.json` con "Apri" (si modifica nell'editor di sistema, valido al riavvio) e "Applica". Applicare salva prima il progetto (`svuota()`); se una cartella scelta manca o è vuota chiede conferma per crearla e prepararla; poi salva la configurazione e ricarica l'editor sulle cartelle nuove.
- **AC-7**: La cartella delle librerie non può stare dentro `progetti/` della cartella di lavoro, e le due cartelle devono essere assolute: altrimenti un messaggio e nessun cambiamento.
- **AC-8**: In sviluppo e nei test la variabile `MODELLATORE_CARTELLA_LAVORO` (ed eventualmente `MODELLATORE_CARTELLA_LIBRERIE`) sostituisce la configurazione senza salvarla; `npm run dev` usa la cartella del repository come oggi.
- **AC-9**: Ogni campo e pulsante nuovo ha la sua (i) o il suo `data-aiuto` (spec 0012); i testi sono in italiano.

## Decision

**Chosen option**: cartella di lavoro unica più cartella delle librerie spostabile, configurazione in `userData`, pagina di benvenuto separata dall'editor, IPC con `ipcRenderer.invoke` per scegliere, applicare e aprire le cartelle.

**Decisioni di dettaglio**:
- Stessa struttura della 1.x (`progetti/`, `shared/`, `settings.json`): l'import dalla 1.x (voce 22) è una copia, e i `libraryPath` dei progetti non cambiano.
- Cambiare cartella ricrea i servizi delle API e ricarica la pagina, senza riavviare il programma.
- `settings.json` resta un file da modificare a mano (come oggi): un editor grafico delle impostazioni è fuori da questa voce.
- Moduli: `src/main/configurazione.ts` (lettura, scrittura, validazione, preparazione delle cartelle), `src/main/impostazioni-ipc.ts` (canali), `benvenuto.html` + `js/benvenuto.js` (pagina di primo avvio), finestra `#impostazioniModal` in `index.html` con `js/impostazioni.js`.

## Build plan

1. `configurazione.ts` con test unitari (lettura tollerante, validazione, preparazione delle cartelle), satisfies **AC-1**, **AC-3**, **AC-7**
2. API e protocollo sulle cartelle configurate (libreria su `shared/`, `settings.json` dalla cartella di lavoro), variabili per sviluppo e test, satisfies **AC-4**, **AC-5**, **AC-8**
3. Avvio con pagina di benvenuto e IPC, satisfies **AC-2**, **AC-3**
4. Finestra Impostazioni nell'editor, aiuto e tour, satisfies **AC-6**, **AC-9**
5. Test e2e: primo avvio, cartella sparita, cambio della cartella delle librerie, satisfies **AC-2** a **AC-7**

## Consequences

**Positive**:
- I dati sono dove li vuoi tu, separati dal programma: installare, aggiornare e disinstallare non li tocca.
- La cartella delle librerie può stare su un disco condiviso senza cambiare i progetti.

**Negative / tradeoffs**:
- Due posti da conoscere (lavoro e librerie) invece di una cartella unica accanto al programma.

## Rationale

Una sola cartella di lavoro conserva la struttura della 1.x e rende l'import una copia; la cartella delle librerie separabile risponde alla richiesta di indicare dove trovare le librerie (spesso condivise o su un altro disco). La mappatura del prefisso `shared/` evita di riscrivere i `libraryPath` dei progetti. La configurazione in `userData` è per utente e sopravvive a installazioni e aggiornamenti.
