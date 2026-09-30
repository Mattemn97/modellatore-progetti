# Verify: Salvataggio automatico del progetto · spec 0001 · updated 2026-09-30
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Prima di iniziare: avvia `python start.py` da una copia della cartella con `progetti/` vuota (o assente).

## UI / manual
- [ ] Primo avvio con `progetti/` vuota → nasce `progetti/nuovo_progetto.json` con `nome` "Nuovo progetto" e workspace vuoto; il breadcrumb mostra "Nuovo progetto"; badge `Salvato` → AC-1, AC-15
- [ ] Apri il file creato → ha esattamente le chiavi `formatVersion` (1), `nome`, `libraryPath`, `workspace` → AC-17
- [ ] Trascina un blocco dalla libreria sul canvas → entro 3 s il file contiene il nodo e in `progetti/_versioni/` c'è `nuovo_progetto.1.json` → AC-3, AC-8
- [ ] Sposta un blocco facendo una pausa di 2 s a metà, mouse premuto → nessuna scrittura durante la pausa; dopo il rilascio un solo salvataggio e una sola versione in più → AC-3
- [ ] Crea un filo, sposta una porta (Shift+trascina), aggiungi e sposta uno snodo, ridimensiona e poi elimina un blocco → ognuna aggiorna il file entro 3 s → AC-3
- [ ] Nell'ispettore rinomina un requisito collegato da un filo e salva → il file riporta il nuovo id nel filo → AC-3
- [ ] Nell'ispettore cambia solo la descrizione di un blocco (nessuna etichetta sul canvas cambia) → il file del progetto non cambia → AC-3
- [ ] Zoom con la rotella, pan, clic per selezionare, entra in un blocco già visitato ed esci, cambia filtro, spunta "Nascondi Non Coinvolti", cerca in libreria → impronta del file (contenuto) e numero di versioni invariati → AC-4, AC-8
- [ ] Osserva il badge durante un salvataggio → passa da `Salvataggio…` a `Salvato` → AC-5
- [ ] Ferma `start.py`, sposta un blocco → badge rosso `Errore di salvataggio`, banner rosso "Server non raggiungibile" con `Riprova`; riavvia il server → al ritentativo (o con `Riprova`) il banner sparisce e il file ha lo spostamento → AC-6
- [ ] Apri il file del progetto in un programma che lo blocca, sposta un blocco → banner con il messaggio "Il file è bloccato da un altro programma…"; chiudi il programma → il ritentativo riesce e in `_versioni/` non compaiono versioni doppie → AC-6, AC-8
- [ ] Con modifiche in attesa o in errore prova a chiudere la scheda → il browser chiede conferma → AC-6
- [ ] Modifica a mano il file con l'app aperta, poi sposta un blocco → badge `Conflitto`, il file a mano resta intatto, Annulla e Ripeti disabilitati, voci del menu disabilitate tranne Scarica → AC-7
- [ ] In conflitto premi `Ricarica dal disco` → il modello mostra il contenuto modificato a mano, badge `Salvato` → AC-7
- [ ] Ricrea il conflitto e premi `Sovrascrivi` → il file ha lo stato dell'app e la versione a mano è in `_versioni/<slug>.1.json` → AC-7
- [ ] Fai 4 modifiche separate → in `_versioni/` ci sono 3 file; 3 Ctrl+Z riportano allo stato dopo la prima modifica; il pulsante `↶ Annulla` diventa disabilitato → AC-8, AC-9
- [ ] Chiudi e riapri l'app dopo 2 modifiche → Ctrl+Z annulla ancora → AC-9
- [ ] Dentro un blocco annidato fai una modifica e Ctrl+Z → resti nello stesso livello → AC-9
- [ ] Clicca nel campo di ricerca della libreria e premi Ctrl+Z → il modello non cambia; stesso con la finestra Apri aperta → AC-9
- [ ] Dopo un Ctrl+Z premi Ctrl+Y (poi prova anche Ctrl+Shift+Z) → la modifica torna; una nuova modifica disabilita `↷ Ripeti` → AC-10
- [ ] Rinomina il progetto, poi Ctrl+Z → il modello torna indietro, il nome resta il nuovo → AC-9, AC-15
- [ ] Menu `Progetto ▾`: ci sono Nuovo, Apri, Salva una copia come, Rinomina, Elimina, Importa JSON, Scarica JSON → AC-11
- [ ] `Apri…` → elenco ordinato per ultima modifica; un file con JSON rotto appare in grigio "file non leggibile" e aprirlo dà un messaggio → AC-11, AC-17
- [ ] `Salva una copia come…` con il nome di un progetto esistente → messaggio e nuova richiesta, nessun file sovrascritto → AC-11
- [ ] `Nuovo…` e poi Annulla nella richiesta del nome → non succede nulla → AC-11
- [ ] `Elimina` → conferma, il file va in `progetti/_cestino/`, si apre il progetto più recente (o ne nasce uno nuovo se era l'ultimo) → AC-11
- [ ] `Importa JSON…` con un vecchio `modello.json` → nasce un nuovo progetto; se contiene tipi assenti dalla libreria compare l'elenco dei tipi mancanti → AC-12
- [ ] `Importa JSON…` con uno `standalone.json` → avviso che la libreria viene ignorata, nasce il progetto → AC-12
- [ ] `Importa JSON…` con un file senza `nodes`/`edges` → messaggio, nessun progetto creato → AC-12
- [ ] `Scarica JSON` → scarica `<slug>.json` → AC-13
- [ ] L'header non ha più `Esporta i 3 File`, `Carica Solo Libreria`, `Carica Standalone` → AC-14
- [ ] Metti a mano `formatVersion: 2` in un progetto e aprilo da `Apri…` → messaggio, file intatto, resta aperto il progetto precedente → AC-17

## Value sourcing (una prova per riga della tabella della spec)
- [ ] Avvio: con `_ultimo.json` che punta a un progetto → si apre quello; cancella `_ultimo.json` → si apre il progetto modificato più di recente → AC-2
- [ ] Avvio: `_ultimo.json` punta a un file cancellato e ci sono altri progetti → elenco con "L'ultimo progetto non è stato trovato" → AC-2
- [ ] Elimina l'unico progetto rimasto → nasce di nuovo `nuovo_progetto.json` con nome "Nuovo progetto" (il file eliminato resta nel cestino) → AC-1, AC-11
- [ ] Avvio senza progetti: `libraryPath` del nuovo file = `libraryPath` di `settings.json` → AC-1
- [ ] Apertura: due progetti con `libraryPath` diversi → aprendo l'uno o l'altro cambia la libreria in elenco e il campo percorso → AC-2
- [ ] Apertura con `libraryPath` inesistente → banner giallo di avviso, resta la libreria precedente, il salvataggio continua e `libraryPath` nel file resta quello originale → AC-2
- [ ] Modifica un blocco nell'ispettore (libreria in memoria), poi apri un progetto con un'altra libreria → conferma "Le modifiche alla libreria non salvate andranno perse" → AC-2
- [ ] Rilevamento modifica: una modifica annullata a mano prima dello scadere del timer (sposta e rimetti il blocco nello stesso punto) → nessuna scrittura → AC-4
- [ ] Timer: porta `progetti.debounceMs` a 3000 in `settings.json` → il salvataggio arriva circa 3 s dopo il rilascio → AC-3
- [ ] Versioni: porta `progetti.versioni` a 2 e riavvia → dopo la modifica successiva in `_versioni/` restano al massimo 2 file per progetto → AC-8
- [ ] Pulsante 🔄 della libreria con un percorso valido diverso → `libraryPath` nel file cambia; con lo stesso percorso → il file non cambia → AC-3
- [ ] Nuovo: `libraryPath` del nuovo progetto = quello del progetto corrente → AC-11
- [ ] Nomi: "Ælfa Ünïcode!!" → slug `lfa_unicode` (o simile, solo `[a-z0-9_]`); "con" o "!!!" → messaggio "Il nome deve contenere almeno una lettera o cifra…" → AC-11, AC-16
- [ ] Importa: il nome proposto è il `nome` nel file, altrimenti il nome del file senza `.json`; `libraryPath` dal file se presente, altrimenti quello corrente → AC-12

## Commands
- [ ] `curl -s -X PUT -H "Content-Type: application/json" -d "{}" "http://localhost:8080/api/progetti/..%2Fsettings"` → 400 `slug_non_valido` → AC-16
- [ ] `curl -s -X PUT -H "Content-Type: application/json" -d "{}" http://localhost:8080/api/progetti/con` → 400 → AC-16
- [ ] `curl -s -X POST -H "Content-Type: text/plain" -d "{}" http://localhost:8080/api/progetti` → 415 → AC-16
- [ ] `curl -s -H "Origin: http://example.com" http://localhost:8080/api/progetti` → 403 → AC-16
- [ ] `curl -s -H "Host: evil.example:8080" http://localhost:8080/api/progetti` → 403 → AC-16
- [ ] `curl -s -o NUL -w "%{http_code}" http://localhost:8080/progetti/nuovo_progetto.json` (anche con `/PROGETTI/...`) → 404 → AC-16
- [ ] `curl -s -X OPTIONS http://localhost:8080/api/progetti` → 405 senza intestazioni `Access-Control-*` → AC-16

## Acceptance-criteria coverage
- AC-1 … primo avvio, avvio senza progetti · AC-2 … avvio con `_ultimo.json`, file sparito, libreria del progetto · AC-3 … drop, trascinamento con pausa, fili/porte/snodi, ispettore, 🔄, debounce · AC-4 … solo vista, modifica annullata a mano · AC-5 … badge · AC-6 … server fermo, file bloccato, chiusura scheda · AC-7 … conflitto, Ricarica, Sovrascrivi · AC-8 … versioni, limite configurabile, niente doppioni · AC-9 … annulla, riavvio, livello, campi di testo, rinomina · AC-10 … ripeti · AC-11 … menu, copia duplicata, prompt annullato, elimina, nomi · AC-12 … import modello, standalone, file non valido · AC-13 … scarica · AC-14 … vecchi pulsanti · AC-15 … breadcrumb · AC-16 … comandi curl · AC-17 … forma del file, formato più recente, JSON rotto
