# Verify: Import requisiti cliente · spec 0003 · updated 2026-09-30
_Passi ricavati dai criteri di accettazione della spec 0003. `/check verify` li esegue sull'app vera (avviata con `python start.py`); `/test` blocca quelli che durano._

## UI / manuale
- [x] Apri un progetto salvato prima di questa funzionalità (`formatVersion: 1`, senza `cliente`) → si apre come prima; la scheda Cliente mostra solo `Importa…` e la riga di spiegazione → AC-1
- [x] Elimina il progetto aperto in modo che non ne resti nessuno aperto (o avvia l'app con un server statico) → la scheda Cliente dice solo "Apri un progetto" e `Importa…` è spento, con il motivo nel suggerimento → AC-1, AC-18
- [x] Scegli un `.xls`, poi un `.xlsx` protetto da password → messaggio "Salva il file come .xlsx senza password e riprova", progetto invariato → AC-2
- [x] Imposta `cliente.maxFileMB` a 1, riavvia il server, scegli un file da 2 MB → rifiutato prima dell'invio con il limite nel messaggio; ferma il server e riprova → messaggio con il motivo → AC-2
- [x] Importa un `.xlsx` con più fogli, di cui uno nascosto → il menu del foglio mostra `(nascosto)`; i menu delle colonne mostrano `B: Descrizione` e `C: (senza nome)`; i facoltativi hanno `(nessuna)`; la conferma resta spenta finché ID e Testo non sono scelti → AC-3
- [x] Metti la riga di intestazione a 9999 → "Il foglio ha solo N righe"; cambia foglio → i menu si ricostruiscono → AC-3
- [x] Importa un CSV in Windows-1252 separato da `;`, con virgolette e un a capo dentro una cella → lettere accentate giuste, ogni cella al suo posto → AC-5
- [x] Importa un `.xlsx` con un ID numerico `12`, una formula, una cella vuota in mezzo alla riga → ID `12` (non `12.0`), valore calcolato, colonne non spostate → AC-5
- [x] Importa un file con un ID ripetuto 2 volte, una riga senza testo e una tipologia `Pneumatica` → 4 scartati nella scheda Scartati, ognuno con numero di riga di Excel e un solo motivo → AC-6
- [x] Nell'anteprima controlla i conteggi in alto e le quattro schede; con più di `cliente.righeAnteprima` nuovi compare "e altri N" → AC-7
- [x] Reimporta un secondo file (5 testi cambiati, 3 righe tolte, 2 nuove, 1 ritirato che ricompare, 1 tipologia cambiata su un requisito collegato) → 6 modificati, 3 ritirati, 2 nuovi, 1 riattivato, 1 filo che si perde; passa ad `Aggiungi e aggiorna` → ritirati 0 → AC-7, AC-8, AC-11
- [x] Al reimport la finestra propone foglio, riga e colonne dell'import precedente (per nome, o per lettera se il nome manca) → AC-4
- [x] Conferma → il filo contato come perso non c'è più; subito dopo il badge dice Salvato; Ctrl+Z annulla l'intero import in un passo, Ripeti lo rimette → AC-9, AC-11, AC-19
- [x] Dopo un import fai subito un trascinamento, poi Ctrl+Z due volte → prima torna indietro il trascinamento, poi l'import; requisiti cliente e fili sempre allineati → AC-9, AC-19
- [x] Controlla nel file `progetti/<slug>.json`: `formatVersion: 2`, id `CLI-<ID>`, `ultimoImport` con data, file, foglio, riga, colonne, modalità e conteggi → AC-9, AC-10, AC-20
- [x] Cambia `cliente.prefisso` in `settings.json` e reimporta → gli id esistenti non cambiano → AC-10
- [x] Scheda Cliente con 3000 requisiti: ricerca (ID, titolo, testo, senza maiuscole), filtri Non collegati, Modificati, Ritirati, filtro sezione, "N risultati, mostrati i primi M"; `Segna tutti come visti` chiede conferma → AC-12
- [x] Trascina una riga sul canvas alla radice con zoom e pan cambiati → il blocco tondo è centrato sul punto di griglia sotto il cursore; trascinalo di nuovo → si sposta, non si duplica; entra in un blocco e rilascia → "I requisiti cliente si collegano solo alla radice" → AC-13
- [x] Tira un filo dal pin del blocco tondo verso un pin di capacità di un blocco di sistema; prova interfaccia verso capacità e cliente verso cliente → rifiutati; chiudi e riapri il progetto → filo e posizione restano; il filtro per classe vale anche per i blocchi tondi cliente → AC-14
- [x] Con un filo cliente verso `cen_002`, modifica e salva il blocco `centralina` in libreria → il filo cliente resta → AC-14
- [x] Clic su una riga → dettaglio in sola lettura nell'ispettore, la vista si centra e il blocco tondo si evidenzia; `Togli dal canvas` è spento se ci sono fili; `Segna come visto` spegne il segno arancione; clic sul blocco tondo → stesso dettaglio → AC-15, AC-16
- [x] Un ritirato sul canvas è grigio tratteggiato, tiene i suoi fili; un nuovo filo da lui → "Requisito cliente ritirato: non si collega" → AC-16
- [x] In libreria salva un blocco con un requisito di id `CLI-012` (id di un requisito cliente) → rifiutato con un messaggio, niente scritto su disco → AC-17
- [x] Modifica a mano il file del progetto con l'app aperta, poi fai una modifica → conflitto; `Importa…` è spento con il motivo → AC-18
- [x] Salva con nome, Duplica, Scarica JSON e reimporta il JSON → la chiave `cliente` segue il progetto → AC-19
- [x] Modifica a mano un file: un filo verso `CLI-INESISTENTE` e un id cliente uguale a un id della libreria → all'apertura il filo sparisce e il banner elenca l'id in collisione; l'apertura non si blocca → AC-20

## Comandi
- [x] `curl -s -X POST -H "Content-Type: application/json" -H "Origin: http://evil.example" -d "{}" http://localhost:8080/api/cliente/leggi` → 403 `accesso_negato` → regola di sicurezza comune

## Copertura dei criteri
- AC-1 … passi 1, 2 · AC-2 … passi 2, 3, 4 · AC-3 … passi 5, 6 · AC-4 … passo 12 · AC-5 … passi 7, 8 · AC-6 … passo 9 · AC-7 … passi 10, 11 · AC-8 … passo 11 · AC-9 … passi 13, 14, 15 · AC-10 … passi 15, 16 · AC-11 … passi 11, 13 · AC-12 … passo 17 · AC-13 … passo 18 · AC-14 … passi 19, 20 · AC-15 … passo 21 · AC-16 … passi 21, 22 · AC-17 … passo 23 · AC-18 … passi 2, 24 · AC-19 … passi 13, 14, 25 · AC-20 … passi 15, 26
