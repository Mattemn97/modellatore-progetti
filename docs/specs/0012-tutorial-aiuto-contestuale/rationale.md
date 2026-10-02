# 0012. Ragionamento: tutorial guidato e aiuto contestuale

## Context

L'editor ha ormai molte aree (header con salvataggio e menu, pannello sinistro a quattro schede, barra con sei modalità e finestre, canvas con gesti senza pulsante, ispettore con tre forme diverse) e molti campi il cui significato non è ovvio: una tipologia vuota cambia la classe del requisito, il livello della versione può essere ignorato, il documento di un testo decide dove finisce nell'export MIL-STD-498. Oggi la spiegazione sta solo in `packaging/TUTORIAL.md`, fuori dall'app, e in qualche `title` sparso.

I vincoli del progetto: niente npm e niente build (AGENTS.md), quindi nessuna libreria di tour pronta da installare; testi in italiano; l'app è usata da una persona in locale, quindi niente dati condivisi o server per lo stato del tour. Il contenuto dell'ispettore e delle finestre è rifatto con `innerHTML` a ogni cambio, quindi ogni aiuto legato a ascoltatori sui singoli elementi si perde a ogni ridisegno.

Senza un aiuto dentro l'app un nuovo utente deve leggere un documento esterno prima di essere produttivo, e chi lo usa di rado dimentica il significato dei campi.

## Options considered

### Opzione 1: solo attributi `title` e un tutorial in una finestra di testo

Si completano i `title` su ogni campo e si aggiunge una finestra con il tutorial in testo.

**Pros**:
- Quasi nessun codice.

**Cons**:
- Il `title` del browser compare lento, non si legge da tastiera, non si formatta e non si vede su campi disabilitati.
- Un testo lungo in una finestra non mostra dove sta ogni area: è il manuale di oggi spostato dentro l'app.

### Opzione 2: moduli scritti a mano con testi come dati (scelta)

`aiuto.js` (suggerimento unico, delega degli eventi, menu), `tour.js` (overlay, riflettore, fumetto), `aiuto-testi.js` (tutti i testi e le liste dei passi).

**Pros**:
- Rispetta "niente npm": poche centinaia di righe di JS puro.
- La delega sul `document` funziona con il contenuto ridisegnato senza toccare i ridisegni.
- I testi stanno in un file solo, separati dalla logica.

**Cons**:
- Codice nuovo da mantenere (posizionamento ai bordi, tastiera, ripristino).
- I passi dipendono da selettori dell'interfaccia.

### Opzione 3: libreria di tour copiata in `js/vendor/`

Una libreria di tour esistente, copiata come file (come SheetJS per l'import Excel).

**Pros**:
- Posizionamento e accessibilità già risolti.

**Cons**:
- Un file esterno grande per una funzione piccola, con il suo stile da adattare e la sua licenza.
- Non risolve le (i) né il menu, che restano da scrivere comunque.
- Ripristino di pannelli e schede comunque da scrivere sopra.

## Rationale

Il bisogno è piccolo e molto legato all'interfaccia di questa app: il pezzo difficile non è disegnare un fumetto, è sapere quali pannelli aprire, quale scheda attivare, come non disturbare Esc e Ctrl+Z e come sopravvivere ai ridisegni con `innerHTML`. Una libreria copiata (Opzione 3) aiuta solo nella parte facile e aggiunge un file esterno a un progetto che li evita. L'Opzione 1 è troppo povera per l'obiettivo dichiarato ("spiegare finemente tutta l'interfaccia"). L'Opzione 2 resta nel modo di lavorare del progetto (moduli in `js/`, stato di sola vista in variabili di modulo, `localStorage` dentro `try/catch` come la riga di aiuto di spec 0011) e tiene i testi revisionabili in un posto.

Le scelte fatte con te: tour al primo avvio più menu ❓, tour principale più mini tour nelle finestre, (i) ovunque ci sia un campo, apertura con hover e focus, testi in un modulo JS, riflettore con fumetto, area nascosta resa visibile e poi ripristinata, (i) nascondibili dal menu.
