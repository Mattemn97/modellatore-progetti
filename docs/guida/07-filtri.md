# 7. Filtri

Quando il modello cresce, i filtri ti aiutano a vedere solo quello che ti interessa: per esempio solo le interfacce elettriche, o solo i requisiti che finiscono nell'IRS. I filtri cambiano solo la vista: non toccano il progetto e non si salvano.

## Aprire il pannello

Premi **`🔎 Filtri`** nella barra del canvas. Il pannello si apre sotto la barra e non blocca il canvas: puoi continuare a lavorare, e il canvas si aggiorna subito a ogni scelta. Un clic fuori dal pannello lo chiude.

Quando hai dei filtri attivi il pulsante mostra quanti gruppi stai usando, per esempio `🔎 Filtri (2)`.

## I quattro gruppi

Ogni gruppo è un elenco di caselle. Un gruppo senza nessuna casella spuntata non filtra nulla.

| Gruppo | Voci | Si applica a |
|---|---|---|
| **Classe** | `Capacità` e ogni tipologia di interfaccia | Requisiti |
| **Documento** | I documenti di `settings.json`, poi quelli usati nella libreria, poi `Cliente` | Requisiti (un requisito cliente ha sempre il documento `Cliente`) |
| **Categoria** | Le categorie dei blocchi della libreria, più `(senza categoria)` | Blocchi |
| **Sottocategoria** | Le sottocategorie, più `(senza sottocategoria)` | Blocchi |

Dentro un gruppo le voci si sommano (Elettrica **oppure** Segnale). Tra gruppi diversi devono valere tutti insieme (Elettrica **e** IRS).

I documenti di un requisito di libreria sono quelli dei suoi testi da esportare.

## Come decide cosa è incluso

* Un **requisito** passa se la sua classe è tra quelle scelte (o Classe non è attivo) e almeno uno dei suoi documenti è tra quelli scelti (o Documento non è attivo).
* Un **blocco** è incluso se passa Categoria e Sottocategoria e, quando Classe o Documento sono attivi, ha almeno un requisito che passa.
* Un **pin** o una **porta** è incluso se il suo blocco passa Categoria e Sottocategoria e il suo requisito passa.
* Un **blocco tondo** è incluso se il suo requisito passa. Categoria e Sottocategoria non valgono per il blocco in cui sei entrato.
* Un **filo** è incluso se almeno uno dei suoi due estremi è incluso.

## Attenua o Nascondi

Sotto i gruppi scegli cosa fare degli **Elementi esclusi**:

* **`Attenua`** (predefinito): gli esclusi restano al loro posto ma diventano molto trasparenti. Nulla sparisce.
* **`Nascondi`**: fili e blocchi esclusi non si disegnano. Restano visibili, attenuati, solo i blocchi e i blocchi tondi che sono estremi di un filo incluso, così nessun filo resta appeso nel vuoto. Un pin escluso di un blocco visibile resta attenuato, per non spostare gli altri pin.

Un pin attenuato si può ancora collegare come sempre.

## Riepilogo e Azzera

In fondo al pannello una riga ti dice quanti elementi i filtri escludono nel livello che stai guardando, per esempio `In questo livello: 4 blocchi e 7 fili esclusi`. Senza filtri dice `Nessun filtro attivo`.

**`Azzera filtri`** toglie tutte le spunte; la scelta tra Attenua e Nascondi resta com'è.

## Quanto durano

I filtri restano gli stessi mentre entri ed esci dai blocchi, cambi progetto o usi Annulla e Ripeti. Durano finché la pagina resta aperta e non entrano mai nel file del progetto.

Quando la libreria cambia, le voci dei gruppi si ricalcolano e una voce che non esiste più viene tolta dalla scelta.

## Rapporto con le altre funzioni

* **Gerarchia**: quando hai scelto un requisito nella Gerarchia, decide la catena. Gli elementi della catena si vedono sempre pieni, anche se i filtri li escluderebbero.
* **Coerenza**: segue solo il gruppo Classe. Con Classe attivo, il controllo conta solo i problemi delle classi scelte (più quelli "Da riparare", sempre visibili).
* **Matrice** e **Documenti** non seguono questi filtri: hanno i loro.
