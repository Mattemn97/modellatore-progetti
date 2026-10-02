# 0008. Rationale: filtri avanzati

## Context

Oggi il canvas ha un solo filtro, la classe (capacità o una tipologia di interfaccia), in `appState.activeTypeFilter`, più la casella "Nascondi Non Coinvolti". I fili di un'altra classe spariscono sempre, i pin e i blocchi tondi si attenuano, i blocchi si nascondono solo con la casella. La regola sta dentro `renderer.js` (`passaFiltro()`) e in `coerenza.js`.

Con modelli che crescono servono filtri per documento (per esempio rivedere tutto ciò che va nell'IRS) e per categoria e sottocategoria dei blocchi, combinabili. I filtri devono restare uguali quando ci si sposta tra i livelli, e non devono mai finire nel file del progetto, che è la fonte di verità salvata in automatico. Il renderer ha già due logiche di attenuazione (Gerarchia e filtro) e uno stato misto tra `appState` e moduli.

## Options considered

### Option 1: modulo `filtri.js` con regole pure e pannello (scelta)

Stato, regole e pannello in un modulo; il renderer chiede cosa è incluso. Gruppi a caselle, o dentro un gruppo, e tra gruppi.

**Pros**:
- Regole in un solo posto, testabili a mano da console.
- Stato fuori da `appState`, coerente con la convenzione dei moduli di sola vista.

**Cons**:
- Tocca `render()` in un punto denso e cambia il comportamento predefinito dei fili.

### Option 2: quattro menu a tendina nella barra

Un `<select>` per gruppo con una voce sola, accanto a quello di oggi.

**Pros**:
- Minimo lavoro di interfaccia, si vede tutto senza aprire nulla.

**Cons**:
- Una sola voce per gruppo: non si può vedere IRS e IDD insieme.
- La barra, già piena, non ha spazio per quattro menu.

### Option 3: espressione di filtro testuale

Un campo di testo con una piccola sintassi (`doc:IRS cat:Fluidica`).

**Pros**:
- Potente e compatto.

**Cons**:
- Da imparare e da validare; errori di battitura silenziosi. Nessuna richiesta di questa potenza.

## Rationale

Le caselle multiple rispondono al bisogno reale (più documenti o più tipologie insieme) e la regola "o dentro un gruppo, e tra gruppi" è quella che chiunque si aspetta da un pannello di filtri. Il pannello a scomparsa risolve lo spazio della barra.

Il filo incluso se almeno un estremo è incluso tiene il contesto: filtrando le pompe vedi a cosa sono collegate. Per la classe non cambia nulla, perché i due estremi di un filo valido hanno la stessa classe. `Attenua` come predefinito evita che qualcosa sparisca senza che tu lo chieda; `Nascondi` resta a un clic.

La Coerenza continua a seguire solo la classe perché i suoi problemi hanno una classe ma non un documento o una categoria univoci; estenderla sarebbe una decisione a parte.

### Decisioni prese in autonomia

Spec progettata in modalità autonoma su richiesta dell'utente (scelta sempre dell'opzione raccomandata): caselle multiple in un pannello, o dentro il gruppo ed e tra i gruppi, filo incluso con un estremo incluso, `Attenua` predefinito, stato fuori da `appState` e non salvato tra le sessioni, Coerenza solo sulla classe, Matrice e Documenti indipendenti, nessun riferimento esterno.
