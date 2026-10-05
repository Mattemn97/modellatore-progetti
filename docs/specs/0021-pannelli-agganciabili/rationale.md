# 0021. Pannelli agganciabili: motivazioni

## Context

Oggi l'editor ha tre colonne fisse: a sinistra (20%) quattro schede (Libreria, Cliente, Coerenza, Gerarchia; le ultime due visibili solo a modalità accesa), al centro il Canvas, a destra l'Ispettore (20%). Le colonne laterali si nascondono con i pulsanti ☰, ma non si spostano né si ridimensionano, e non si possono vedere due schede insieme (per esempio Cliente e Coerenza).

La voce 24 dello scope chiede un layout come in un IDE, ricordato tra un avvio e l'altro, con il vincolo di non cambiare nessun comportamento di oggi. Le voci 25 e 26 costruiranno sopra questo sistema (finestre modali come pannelli, pannelli in finestre staccate), quindi la scelta deve reggere anche il distacco in finestre separate.

L'interfaccia non usa framework: DOM e SVG scritti a mano in TypeScript, moduli che cercano i loro elementi per id al caricamento.

## Options considered

### Option 1: dockview-core

Libreria di docking in TypeScript senza dipendenze, con un nucleo indipendente da framework (`dockview-core`). Gruppi a schede, trascinamento con zone di aggancio, separatori, `toJSON`/`fromJSON`, pannelli fluttuanti e in finestre separate.

**Pros**: mantenuta (8.4.0, settembre 2026), licenza MIT, pensata per TypeScript, serializzazione pronta, distacco in finestre già previsto (voce 26).
**Cons**: una dipendenza in più; il formato salvato è suo.

### Option 2: scritto a mano

Gruppi, schede, separatori e zone di aggancio costruiti nel progetto.

**Pros**: nessuna dipendenza, controllo totale.
**Cons**: molto codice delicato (trascinamento, anteprima dell'aggancio, albero di divisioni, serializzazione), da scrivere e mantenere per un risultato inferiore.

### Option 3: golden-layout 2

Libreria di docking storica, senza framework.

**Pros**: conosciuta, serializzazione e finestre separate.
**Cons**: ferma dal febbraio 2023: rischio di restare senza correzioni con le prossime versioni di Electron.

## Rationale

dockview fa esattamente il lavoro difficile (aggancio, schede, ridimensionamento, salvataggio) e lascia al progetto il contenuto dei pannelli, che è quello che vogliamo tenere uguale. Spostare i nodi DOM esistenti nei pannelli, invece di ridisegnarli, tiene i moduli quasi intatti e rispetta il vincolo "nessun comportamento cambia". La disponibilità dei pannelli in finestre separate evita di cambiare libreria alla voce 26.

Legare i pannelli Coerenza e Gerarchia alle loro modalità (aprire accende, chiudere spegne) è la scelta che riproduce il comportamento di oggi senza stati intermedi da spiegare. Il menu Finestra nella testata segue lo stile dei menu Progetto e Aiuto e si prova facilmente nei test, a differenza di un menu nativo.
