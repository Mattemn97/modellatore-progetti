# 0023. Pannelli in finestre staccate

**Date**: 2026-10-05
**Status**: Accepted

## Summary

Un gruppo di pannelli (tranne quello con il Canvas) si stacca in una finestra di Windows separata con il pulsante ⧉ della sua barra delle schede, e si riaggancia con ⤓ o chiudendo la finestra. Si usano le finestre staccate ("popout") di dockview: la finestra nuova è una pagina vuota dello stesso programma in cui la finestra principale sposta i nodi del pannello, quindi tutto il codice continua a girare in un solo posto e la sincronizzazione non serve. Il layout ricorda le finestre staccate con posizione e dimensione, quindi anche il monitor.

## Requirements

**Acceptance criteria**:
- **AC-1**: Ogni gruppo che non contiene il Canvas ha nella barra delle schede un pulsante ⧉ (Stacca in una finestra); premuto, il gruppo con le sue schede si apre in una finestra di Windows nuova, ridimensionabile e spostabile su un altro monitor. Il Canvas non si stacca e non si può trascinare in una finestra staccata.
- **AC-2**: Nella finestra staccata il pulsante diventa ⤓ (Riaggancia) e rimette il gruppo nella finestra principale, a destra del Canvas; chiudere la finestra staccata con la ✕ di Windows fa lo stesso.
- **AC-3**: Il pannello staccato resta lo stesso pannello: una modifica fatta nella finestra principale si vede subito in quella staccata e viceversa (per esempio un filtro della Matrice, un blocco salvato dall'Ispettore staccato); Ctrl+Z e Ctrl+Y premuti nella finestra staccata (fuori dai campi di testo) annullano e ripetono come nella principale.
- **AC-4**: Chiudendo l'app le finestre staccate si chiudono con lei; alla riapertura il layout torna com'era, finestre staccate comprese, nella stessa posizione e dimensione (quindi sullo stesso monitor, se c'è ancora).
- **AC-5**: Il menu Finestra porta in primo piano anche un pannello che sta in una finestra staccata (la finestra viene davanti). Ripristina layout riaggancia tutto.
- **AC-6**: La finestra staccata ha le stesse protezioni della principale: niente Node, `contextIsolation` e `sandbox` accesi, link esterni nel browser di sistema, nessuna navigazione fuori da `app://modellatore/`.

## Decision

**Chosen option**: finestre staccate di dockview (`addPopoutGroup`) con una pagina `popout.html` vuota, più una ricerca degli elementi che guarda anche nelle finestre staccate.

**Decisioni di dettaglio**:
- **Perché non una seconda copia dell'app per finestra**: richiederebbe di sincronizzare via IPC lo stato del progetto, della libreria e delle selezioni tra più pagine, con conflitti di salvataggio; con i popout il codice resta uno e lo stato pure.
- **`popout.html`**: pagina minima in `src/renderer/` (solo `<body>`), copiata da `scripts/build.mjs`; dockview ci copia i fogli di stile della principale. L'opzione `popoutUrl` è `/popout.html`.
- **Ricerca negli altri documenti**: i moduli cercano con `document.getElementById`, `document.querySelector` e `document.querySelectorAll`. `pannelli.ts` le avvolge una volta all'avvio: se nella pagina principale non c'è niente (o per `querySelectorAll`, in aggiunta) cerca nei documenti delle finestre staccate aperte. È un adattatore in un posto solo, al posto di cambiare centinaia di chiamate.
- **Tastiera**: i `keydown` con Ctrl (o Cmd) di una finestra staccata, fuori dai campi di testo, si ripetono sul `document` principale, dove stanno le scorciatoie.
- **Pulsante ⧉ / ⤓**: `createRightHeaderActionComponent`; nascosto quando il gruppo contiene il Canvas. Riaggancia: `group.api.moveTo({ group: <gruppo del Canvas>, position: 'right' })`.
- **Canvas mai in una finestra**: `onWillDrop` rifiuta il rilascio del Canvas (o del suo gruppo) in un gruppo staccato.
- **Salvataggio**: si salva anche su `onDidPopoutGroupPositionChange` e `onDidPopoutGroupSizeChange`. Alla chiusura dell'app dockview riaggancia le finestre nel `beforeunload`: prima di lui un nostro `beforeunload` scrive subito il layout e ignora i cambiamenti di quella chiusura, così il layout salvato ha ancora le finestre staccate. Se la chiusura viene annullata (modifiche non salvate, Annulla), le finestre restano riagganciate: è accettabile.
- **Processo principale** (`finestra.ts`): `setWindowOpenHandler` permette solo `app://modellatore/popout.html`, con le stesse `webPreferences` di sicurezza e senza preload; ogni finestra creata riceve gli stessi controlli di navigazione e link esterni; chiudendo la principale si chiudono tutte le staccate.
- **Menu Finestra**: `mostraPannello` dopo `setActive` chiama `focus()` sulla finestra del gruppo se è staccato.

## Build plan

1. Processo principale: apertura permessa solo per `popout.html`, sicurezza e chiusura insieme alla principale; `popout.html` nel build; satisfies **AC-4**, **AC-6**
2. `pannelli.ts`: pulsante ⧉/⤓, divieto per il Canvas, ricerca negli altri documenti, tastiera, focus dal menu, salvataggio con le finestre staccate; satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**
3. Test e2e: stacca la Matrice, la finestra nuova contiene `#pannelloMatrice`, un filtro cambiato nella staccata aggiorna la tabella, ⤓ la riporta nella principale; satisfies **AC-1**, **AC-2**, **AC-3**

## Consequences

**Positive**: Matrice, Documenti o l'Ispettore su un secondo monitor, sempre allineati al modello.
**Negative**: l'adattatore di ricerca nei documenti è codice "magico": un modulo nuovo che usa `document` in modo diverso (per esempio `document.activeElement` o ascoltatori su `document`) non vede la finestra staccata. Le (i) dentro una finestra staccata mostrano il fumetto nella principale.
**Neutral**: il tour non entra nelle finestre staccate; se un passo spiega un pannello staccato lo si gestisce nella voce 27.
