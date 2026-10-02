# 0014. Console del server più leggibile: decisione e motivi

## Context

All'avvio `start.py` scrive sei righe tra due linee di `=`: percorso di lavoro, cartella dei progetti, URL. Subito dopo, `SimpleHTTPRequestHandler` aggiunge una riga per ogni richiesta del browser (ogni file JavaScript, ogni chiamata all'API), quindi in pochi secondi il link scorre fuori dalla finestra. Non c'è la versione in uso, e non c'è un modo evidente per scrivere un avviso.

La funzionalità 15 dovrà dire in console che c'è un aggiornamento. Senza un modo unico per scrivere avvisi, ogni messaggio inventerebbe il suo stile.

Il progetto ha una regola forte: niente passi di build e solo la libreria standard per lanciare `start.py`. L'exe si costruisce con PyInstaller, che include le librerie importate da `start.py`.

## Options considered

### Option 1: colorama

Colori ANSI su Windows con `colorama.just_fix_windows_console()`, stile scritto a mano.

**Pros**:
- Libreria minuscola e stabile.

**Cons**:
- Solo colori: riquadro, collegamenti cliccabili, `NO_COLOR` e uscita rediretta vanno gestiti a mano.

### Option 2: rich con riserva in testo semplice

`rich` per riquadro, colori e collegamenti, con import facoltativo.

**Pros**:
- Riconosce da sé terminale, colori, `NO_COLOR` e uscita rediretta; collegamenti OSC 8 dove supportati.
- Un riquadro leggibile in poche righe di codice.

**Cons**:
- Più grande di colorama; due uscite (rich e semplice) da tenere allineate.

### Option 3: sequenze ANSI scritte a mano

Nessuna dipendenza, codici di colore nel codice.

**Pros**:
- Zero dipendenze.

**Cons**:
- Su console Windows vecchie le sequenze compaiono come caratteri strani; tutto il rilevamento è da scrivere.

## Rationale

Il bisogno è leggibilità, non solo colore: un riquadro, un link che si clicca dove possibile, un'uscita pulita quando la console è rediretta (la prova di avvio nel workflow). `rich` dà tutto questo con il suo rilevamento automatico, che è la parte più facile da sbagliare scrivendola a mano. L'import facoltativo rispetta la regola della sola libreria standard per lanciare `start.py`: la libreria serve davvero solo all'exe, dove PyInstaller la include.

Il filtro dei log delle richieste è la metà del guadagno: senza, qualsiasi riquadro sparisce dopo pochi secondi.
