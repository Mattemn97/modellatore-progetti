# 0035. Interfaccia in stile IDV Interface Manager e porte propagate dei matrioska

**Date**: 2026-10-19
**Status**: Done (rilasciata nella 2.3.0; `/check verify` saltato su richiesta)

## Summary

L'interfaccia grafica prende l'aspetto dell'IDV Interface Manager (`IDV_Interface_Manager.html`, fuori dal repo): testata blu con marchio, sezioni con contatori e strumenti del progetto; lavagna con i blocchi disegnati come componenti (intestazione con nome, categoria e badge del tipo, poi una riga per requisito con la porta ai lati), fili tratteggiati per classe con l'etichetta, legenda e riquadro di instradamento; tabelle Componenti, Interfacce, Requisiti e una Dashboard. Tutto resta dentro i pannelli agganciabili di dockview (spec 0021), staccabili su un altro monitor (spec 0023): ogni sezione della testata apre o porta davanti il suo pannello. In più, nei blocchi matrioska (spec 0034) le interfacce dei blocchi interni non collegate dentro **salgono sul bordo** del blocco che le contiene e si collegano al livello sopra.

## Context

Richiesta dell'utente del 2026-10-19: "l'interfaccia grafica esattamente come quella dell'IDV Interface Manager", integrata nella tecnologia a più schede e più schermi, con la gestione della libreria dei blocchi e delle loro interfacce visibili ai livelli superiori per i blocchi matrioska. Scelte confermate dall'utente: solo l'aspetto IDV sulle funzioni di oggi (niente cavi, gruppi, allegati, stati di approvazione dell'IDV, che cambierebbero il formato dei progetti); propagazione verso l'alto delle porte interne; capacità come righe con un marcatore diverso.

## Requirements

**Acceptance criteria**:
- **AC-1 Testata**: marchio `IDV`, titolo, nome del progetto (clic: Apri progetto); sezioni Lavagna, Libreria, Componenti, Interfacce, Requisiti, Cliente, Matrice, Documenti, Dashboard con i contatori (istanze, fili, requisiti, problemi di coerenza in rosso); Annulla, Ripeti, stato del salvataggio, Progetto, Finestra, ⚙, ?, stato dell'app (Attiva / Errore). La sezione del pannello attivo è evidenziata; una sezione apre il pannello o lo porta davanti, anche in una finestra staccata.
- **AC-2 Pannelli**: quattro pannelli nuovi (`componenti`, `interfacce`, `requisiti`, `dashboard`) nel gruppo sotto la lavagna, come Matrice e Documenti; si staccano e si riagganciano come gli altri. Il pannello `canvas` si chiama **Lavagna**; i layout salvati prima si aprono come sono e prendono i titoli nuovi.
- **AC-3 Blocchi**: componente IDV largo almeno 200 (impostazione `node.width` 220 per i nuovi): intestazione (nome, categoria con il suo colore, badge con l'id del tipo, seconda riga con il tipo o il numero di blocchi dentro), una riga per requisito nell'ordine della libreria (id, titolo, sigla della classe; `CAP` per la capacità), righe alterne ombreggiate. L'altezza viene dalle righe: si allarga solo la larghezza.
- **AC-4 Porte**: quadratino sul bordo sinistro o destro alla riga del requisito; interfaccia sul bordo, capacità appena dentro (rientro 9) nel colore della capacità; pieno se ha un filo nel livello, vuoto se libero. Lato: quello salvato con Shift+trascina (`pinPositions[chiave] = { side: 'left'|'right', ratio: 0.5 }`), altrimenti verso l'altro capo del primo filo (o del suo primo/ultimo snodo), altrimenti destra. I lati `top`/`bottom` dei progetti di prima vanno al lato più vicino. `↺ Riposiziona le porte` svuota i lati salvati (e le vecchie `capabilityPositions`).
- **AC-5 Fili**: interfaccia tratteggiata `8 4`, capacità continua, derivazione puntinata `2 4`; area di presa larga, alone sulla selezione, etichetta a metà del tratto più lungo con l'id del requisito di partenza e la classe (clic: dettaglio). `Etichette` e `Legenda` nella barra (preferenza del PC, `modellatore.vistaLavagna`). Le immagini (spec 0029) hanno lo stesso stile.
- **AC-6 Barra della lavagna**: Indietro e percorso, ☰ Libreria, + Blocco, Adatta, −, zoom % (clic: 100%), +, Reset vista, Filtri, Mostra Etichette / Legenda, Trova blocco, Matrice, Documenti, Verifica Coerenza, Gerarchia, Ispettore ☰; riquadro Instradamento (Reinstrada, Immagine) in alto a destra; legenda in basso a sinistra; riga dei gesti in basso a destra; griglia a puntini.
- **AC-7 Porte propagate**: in un blocco, ogni requisito di interfaccia di un blocco interno (a qualsiasi profondità) che nessun filo usa nel livello in cui sta compare in una fascia `PORTE DAI BLOCCHI INTERNI`, con il percorso dei blocchi (`↳ Alim › Sensore · titolo`) e il quadratino tratteggiato. Si collega come una porta qualsiasi; il filo ricorda `targetPercorso` (o `sourcePercorso`) = id dei nodi interni fino al proprietario. Le capacità non salgono.
- **AC-8 Regole delle porte propagate**: si collegano solo alla porta di un altro blocco (mai a un blocco tondo); stessa classe e tipologia come sempre. Collegare dentro una porta già usata sopra chiede conferma; il filo di sopra diventa **da riparare** (Coerenza, Interfacce, Ispettore del filo dicono perché). Dentro il blocco, una porta collegata solo sopra si vede piena con il bordo tratteggiato. Salvare un blocco con una rinomina segue anche i fili propagati e i lati salvati; un requisito che non è più di interfaccia toglie il filo. Una nuova istanza di un matrioska rimappa i percorsi sugli id nuovi.
- **AC-9 Tabelle**: Componenti (tipo, nome, categoria, livello, porte di interfaccia, capacità, libere, propagate, fili, blocchi dentro), Interfacce (classe, tipo, da, a, livello, percorso automatico o a mano, stato), Requisiti (id, titolo, blocco, classe, verifica, documenti, istanze, con filo). Ricerca, filtri, ordinamento al clic sull'intestazione, CSV con `;`. Clic su una riga: apre il livello e seleziona il blocco o il filo, oppure apre il blocco nell'Ispettore.
- **AC-10 Dashboard**: riquadri (blocchi, istanze, fili, porte libere e propagate, cliente coperti, problemi), controlli di coerenza per gruppo, fili per classe, istanze per categoria, matrice N² del livello aperto. Un clic apre la sezione.
- **AC-11 Compatibilità**: i progetti e le librerie della 2.2 si aprono e si salvano senza cambi (nessun campo nuovo finché non colleghi una porta propagata o sposti una porta di lato); `capabilityPositions` resta nel file ma non si disegna più.
- **AC-12 Aiuto**: ogni pulsante e campo nuovo ha la sua voce in `SUGGERIMENTI`; il tour principale resta di 18 passi con i testi aggiornati.

## Decision

- **Aspetto IDV, modello del Modellatore**: blocco = componente, requisito di interfaccia = porta, filo fra interfacce = interfaccia IDV, tipologia = categoria con il suo colore. Cavi, gruppi funzionali, allegati e stati di approvazione dell'IDV non entrano: avrebbero cambiato il formato dei progetti (scelta dell'utente).
- **Sezioni = pannelli dockview**, non schede che sostituiscono la pagina come nell'IDV: così restano affiancabili e staccabili su più monitor.
- **Geometria in un solo posto**: `blocco.ts` (forma, righe, lati) e `contestoFili()` in `diagramma.ts` (lati automatici, centri, estremi per l'instradamento); canvas e immagini la usano allo stesso modo. Spariscono `posizionePorta`, `posizioniCapacita`, `puntoPin`.
- **Porta propagata come percorso sull'estremo** (`sourcePercorso` / `targetPercorso`, facoltativi): nessuna copia di requisiti nella libreria e nessun requisito finto sul contenitore; un filo vecchio resta identico. Scartato: aggiungere al contenitore un requisito "delegato" (cambierebbe la libreria e i documenti). Scartato: collegare la porta propagata ai blocchi tondi (la derivazione si tira dentro, sul blocco che possiede il requisito; la Gerarchia resta com'è).
- **Una porta è propagata finché nessun filo la usa nel suo livello**: regola semplice e visibile (la fascia del blocco cambia subito). Il conflitto con un filo di sopra non si risolve da solo: si segnala (conferma, Coerenza) e si ripara a mano.
- **Capacità a lato, non più libere nel rettangolo**: nello stile a righe un pin dentro il blocco non avrebbe più una riga; il lato salvato prende il posto della posizione libera della spec 0032.

## Build plan

1. Modello: `porte.ts` (porte propagate, risoluzione, validità), percorso negli estremi di `model.ts` (visita, regole, aggiornamento dopo un Salva), `matrioska.ts` (rimappatura), test unitari.
2. Geometria e lavagna: `blocco.ts`, `diagramma.ts`, `renderer.ts` (blocchi, porte, fili, etichette, legenda, adatta, zoom, trova), test unitari dei lati e del diagramma.
3. Guscio: `index.html`, `style.css` (token IDV), `pannelli.ts` (pannelli e sezioni), `app.ts` (strumenti), `tabelle.ts` (tabelle e Dashboard), aiuto e tour.
4. E2e: sezioni e tabelle, porta propagata collegata alla radice e poi in conflitto; test esistenti allineati al nuovo disegno.

## Consequences

- Il disegno di prima (rettangolo con il nome al centro, porte in giro sul bordo, pin di capacità liberi) non c'è più: chi aveva spostato a mano i pin di capacità li ritrova al lato automatico.
- Un progetto con fili propagati aperto da una 2.2 mostra quei fili come non validi (la 2.2 non conosce il percorso): va detto nelle note del rilascio.
- `render()` calcola le porte propagate di ogni blocco del livello a ogni disegno: va bene per i progetti di oggi; con interni molto grandi servirà una cache.
