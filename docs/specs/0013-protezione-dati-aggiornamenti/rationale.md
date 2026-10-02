# 0013. Protezione dei dati negli aggiornamenti: decisione e motivi

## Context

L'app è una cartella che l'utente estrae e usa. Per aggiornarla, oggi il tutorial dice di estrarre lo zip nuovo sopra quello vecchio confermando la sovrascrittura. Dentro la stessa cartella convivono file dell'app (`start.exe`, `index.html`, `style.css`, `js/`, `esempi/`, `TUTORIAL.md`, `VERSIONE.txt`) e dati dell'utente (`progetti/` con `_versioni/` e `_cestino/`, `shared/` con librerie, changelog e copie, e `settings.json` se l'utente lo ha personalizzato).

`progetti/` e `shared/` sono protette per costruzione: [crea-pacchetto.ps1](../../../packaging/crea-pacchetto.ps1) le mette nello zip vuote, e l'estrazione non cancella file che lo zip non contiene. `settings.json` invece è nello zip con i valori di fabbrica: l'estrazione lo sovrascrive. Il tutorial oggi chiede all'utente di salvarne una copia a mano, una protezione che si dimentica facilmente.

La funzionalità 15 aggiornerà l'app da sola, sostituendo i file senza che l'utente veda cosa succede. Senza una regola scritta e una lista nel codice su cosa è dell'utente, quel codice dovrebbe inventarla, e un errore lì cancella dati in modo silenzioso. Questa spec fissa la regola prima.

Le chiavi nuove delle impostazioni arrivano già oggi senza toccare il file dell'utente: `loadSettings()` in `js/state.js` fonde `DEFAULT_SETTINGS` con il file su due livelli, e `start.py` ha i suoi valori predefiniti per le chiavi che legge. È la regola di [AGENTS.md](../../../AGENTS.md): ogni chiave nuova va in `settings.json`, in `DEFAULT_SETTINGS` e nella fusione di `loadSettings()`.

## Options considered

### Option 1: Lasciare tutto com'è e affidarsi al tutorial

L'utente salva a mano una copia di `settings.json` prima di aggiornare, come oggi.

**Pros**:
- Nessun codice da cambiare.

**Cons**:
- Chi non legge le istruzioni perde le impostazioni in silenzio.
- L'aggiornamento automatico (funzionalità 15) non ha una regola da seguire.

### Option 2: File predefinito nel pacchetto e copia al primo avvio

Il repository tiene `settings.json` come oggi. Il pacchetto lo copia come `settings.predefinite.json` e non porta mai `settings.json`. `start.py` crea `settings.json` dai predefiniti solo se manca. Le chiavi nuove arrivano dalla fusione con i predefiniti che esiste già.

**Pros**:
- L'estrazione dello zip non può sovrascrivere le impostazioni, perché il file non c'è.
- Nessun cambiamento per lo sviluppo: il repository, `start.py` lanciato a mano e `AGENTS.md` restano uguali.
- Riusa la fusione su due livelli già presente in `loadSettings()`.

**Cons**:
- Un valore di fabbrica cambiato per una chiave già presente (per esempio un colore nuovo in `typeColors`) non arriva agli utenti che hanno già un `settings.json`: lo vedono solo in `settings.predefinite.json`.

### Option 3: Server che fonde predefiniti e personalizzazioni

`start.py` serve `/settings.json` come fusione di `settings.predefinite.json` e di un file con le sole personalizzazioni dell'utente.

**Pros**:
- Anche i valori di fabbrica cambiati arrivano a chi non li ha personalizzati.

**Cons**:
- Cambia il modo in cui si leggono le impostazioni nel repository, in `start.py` e nel browser.
- Serve migrare i `settings.json` esistenti, che sono file completi e non solo personalizzazioni: non si sa quali valori l'utente abbia cambiato davvero.
- Una fusione profonda reintroduce le chiavi che l'utente ha tolto apposta (per esempio una tipologia cancellata da `typeColors`).

## Rationale

Il problema reale è uno solo: lo zip contiene un file che appartiene all'utente. Toglierlo dallo zip chiude il buco per costruzione, senza dipendere da chi legge le istruzioni, ed è la stessa idea che protegge già `progetti/` e `shared/`. La copia al primo avvio dà a una installazione nuova lo stesso file di oggi, quindi l'utente che vuole personalizzare trova ancora un `settings.json` completo da modificare.

L'opzione 3 risolverebbe anche i valori di fabbrica cambiati, ma è un problema che oggi non abbiamo: le chiavi nuove arrivano già dalla fusione in `loadSettings()` e dai predefiniti di `start.py`. In cambio chiede una migrazione impossibile da fare bene (i file esistenti sono completi, non si sa cosa l'utente abbia cambiato) e tocca tre punti di lettura. Il costo accettato con l'opzione 2 è piccolo e visibile: un valore di fabbrica cambiato si legge in `settings.predefinite.json`, e cancellando `settings.json` si torna ai valori di fabbrica.

La costante `PERCORSI_UTENTE` costa una riga e toglie alla funzionalità 15 la decisione più pericolosa. La funzionalità 15 deciderà come usarla (per esempio una lista dei file dell'app da sostituire); qui si fissa solo cosa è vietato toccare.

