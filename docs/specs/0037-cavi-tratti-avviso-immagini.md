# 0037. Cavi a più tratti, interfacce senza cavo, immagini per strato

**Date**: 2026-10-19
**Status**: Done (rilasciata nella 2.4.0)

## Summary

Estende la spec 0036. Un cavo può attraversare altri blocchi del livello (pannelli connettori, scatole di derivazione): `Cavo.via = [{ nodo, connettore? }]` in ordine da A a B, disegnato come un tratto per coppia di blocchi toccati. La Coerenza segnala le interfacce da cablare senza cavo. L'immagine del livello si esporta con i fili logici oppure con i soli cavi.

## Requirements

- **AC-1 Tratti**: nell'Ispettore del cavo, "Tratti: passa per" aggiunge blocchi del livello (mai gli estremi, mai due volte), ognuno con il connettore di passaggio, e li toglie. I fili portati restano quelli fra A e B. Lavagna e immagine disegnano i tratti in un solo cavo con i connettori a ogni capo; la lista Cavi ha la colonna **Tratti** (numero e percorso A › … › B). Un passaggio su un blocco sparito si toglie da solo (`riallineaCavi`); la copia matrioska rimappa i passaggi.
- **AC-2 Interfacce senza cavo**: nuovo gruppo Coerenza **Interfacce senza cavo** (avviso): ogni filo fra blocchi con una tipologia in `cavi.tipologieCablate` (predefinito `["Elettrica"]`) che non sta in un cavo. Vale solo se il progetto ha almeno un cavo, così i progetti che non usano i cavi non si riempiono di avvisi. Clic sulla voce: strato Interfacce e filo selezionato.
- **AC-3 Immagini**: il menu Immagine offre *Fili logici* o *Solo cavi* in SVG e PNG; il file dei cavi finisce in `-cavi`. Solo cavi = blocchi, cavi, connettori, etichette dei cavi; niente fili né blocchi tondi. I diagrammi nei documenti restano dello strato Fili logici.

## Decision

- **Passaggi nel cavo, non cavi in serie**: un link resta in un solo cavo (regola della 0036) e il percorso fisico è un dato del cavo. Scartata la catena di cavi distinti per lo stesso link: avrebbe richiesto di validare percorsi fra cavi.
- **Avviso legato all'uso dei cavi**: senza nessun cavo il gruppo non esiste; la lista di tipologie è in `settings.json` (riavvio non necessario: si legge a ogni calcolo).
