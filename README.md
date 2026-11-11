# Dispositivo di negoziazione · Alta Lessinia

Prototipo di console multispecie. Ci sono 8 slider: 4 azioni di *Homo sapiens* e 4 comportamenti di *Canis lupus*, che sono insieme input e output. Muovendoli cambia una **tavola a matrice reale dell'Alta Lessinia**, e un bilancio mostra i quattro bisogni (cibo, spazio, sicurezza, discendenza) di entrambe le specie.

La tavola non disegna i viventi. Mostra le loro **presenze**: dove passa *Canis lupus*, dove sta *Homo sapiens*, dove le due presenze si toccano (zone di conflitto) e dove si attraversano (corridoi e attraversamenti).

I testi dell'interfaccia seguono `LESSICO_TRATTATO.md`: l'interfaccia è scritta come gli atti di una seduta del Trattato. "Il modello assume" segna i legami della simulazione che non hanno appoggio nelle schede di `FONTI.md`.

## Come avviarlo

Doppio clic su `index.html`. Funziona anche da `file://`, perché i dati sono un normale script (`data/lessinia.js`).

In alternativa, con un server locale (serve per collegare MIDI o seriale):

```bash
python3 -m http.server 8420
```

poi apri <http://localhost:8420>.

| Tasto | Azione |
|---|---|
| trascina uno slider | lo tieni: diventa input puro |
| frecce su uno slider | ±2, con Maiusc ±10 |
| `1`–`8` | livelli della tavola |
| trascina sulla mappa | sposta la vista |
| rotellina, pizzico, doppio clic | zoom (fino a 4×), `+` / `−` da tastiera |
| `0` / **adatta** | la tavola riempie la sezione; **intera** la mostra tutta |
| `L` / linguetta **Legenda** | apre e chiude la legenda a sinistra della mappa; ogni gruppo accende e spegne il suo livello |
| `R` / **reset** | tutto a 50 |
| `D` | debug: valori, ancore, statistiche della tavola e dei corridoi, MIDI/seriale |
| `F` | schermo intero |

Passando il mouse sulla tavola leggi la cella: uso del suolo, presenze, tipo di conflitto e costo per entrambi. Sui nodi e sui quadrati delle uccisioni documentate compaiono le schede.

## Come funziona la negoziazione

1. **Lo slider resta dove lo lasci.** Ogni slider ha un punto di riposo, l'*ancora*. Quando lo rilasci, l'ancora diventa la posizione in cui l'hai lasciato.
2. **Gli altri rispondono.** Ogni slider che nessuno tiene va verso `ancora + somma delle spinte`. La spinta di A su B è `peso(A→B) × (A − 50)`, con i pesi della matrice in `js/config.js`. Esempio: CUSTODIRE a 10 spinge NUTRIRSI verso bovini e ovicaprini (mandrie e greggi incustodite) e UCCIDERE in su (più animali uccisi, più richieste di abbattimento).
3. **Si vede chi spinge chi.**
   - Sulla console, linee nere vanno dallo slider che spinge a quelli che rispondono. Lo spessore indica la forza della spinta, ▲/▼ la direzione.
   - Nel riquadro **Verbale**, nella colonna destra, c'è il motivo, in una frase.
4. **Senza gesti, tutto resta fermo.** Dopo un gesto gli altri slider trovano il loro assetto e si fermano; la tavola non cambia più finché qualcuno non muove uno slider.

## La tavola

**Finestra.** Alta Lessinia centrale, 14 × 12 km: Erbezzo, Bosco Chiesanuova, Sant'Anna d'Alfaedo, l'altopiano dei pascoli e le malghe di Podestaria, Scortigara, Lago Boaro, Campolevà, Pealda e Boldera.

**Griglia.** 117 × 99 celle da 120 m, ricavate dai GeoJSON dell'*Atlante della Lessinia* (OpenStreetMap). Una cella prende la classe che ne copre almeno metà, come nella tavola a matrice dell'atlante.

**Segni della matrice** (pattern radi e sottili):
- freccia-albero, una ogni quattro celle = bosco
- vuoto = prateria e pascolo
- puntinato = arbusteto, o ex pascolo
- piccolo triangolo = roccia
- tinta grigia piatta = paesi e contrade

**Stile.** Pannello di sintetizzatore su fondo bianco: moduli grigi e cursori rossi come in `stile slider.png`. L'interfaccia è in IBM Plex Mono (variabile `--mono` in `css/style.css`); le scritte della mappa restano in Newsreader. Il LED di ogni modulo è rosso quando lo slider si muove da solo e nero quando è tenuto in mano.

Strade, sentieri, acque, isoipse (TINITALY), malghe e paesi sono vettori reali.

**Cosa cambia con gli slider:**
- **ALLEVARE**: sotto 55 i pascoli più lontani dalle malghe si abbandonano e diventano arbusteto. Sopra 55 il pascolo si allarga attorno alle malghe.
- **COSTRUIRE**: sopra 45 i paesi crescono lungo le strade. Le strade locali più lontane dai paesi si chiudono quando COSTRUIRE scende (*ritirarsi*).
- **Presenza di *Canis lupus*** (bruno): è un campo continuo. Sale con il bosco e la quiete, scende vicino a paesi e strade, è attratta dai pascoli se NUTRIRSI tende a bovini e ovicaprini e mandrie e greggi sono incustodite. L'area mostrata cresce con il numero di lupi. Con FARE BRANCO basso diventa frammentata e mobile, con contorno tratteggiato. PERCORRERE riduce la distanza che il lupo tiene dai paesi.
- **Presenza di *Homo sapiens*** (blu): paesi, pascoli attivi e strade.
- **Zone di conflitto** (rosso, l'unico colore d'accento). Sono di tre tipi:
  - *uccisioni di bovini e ovicaprini*: pascolo incustodito dentro la zona del lupo;
  - *margine delle contrade*: con PERCORRERE alto;
  - *trappola* (×): con UCCIDERE sopra 50, vicino a pascoli e paesi.

  Dove il pascolo è custodito compare invece un segno senza conflitto registrato.
- **Corridoi e attraversamenti**: cammini a costo minimo tra le aree di presenza del lupo e verso il bordo della tavola, tanti quanto dice ATTRAVERSARE. Ogni punto in cui una strada aperta taglia un corridoio o un'area del lupo è un attraversamento: *interrotto*, *trappola*, oppure *passaggio per altre specie* se CUSTODIRE è alto.
- **Uccisioni documentate** (quadrati rossi con il numero di eventi): **dati reali**, non simulati. Vengono da Tabarelli de Fatis 2025 e MUSE–PAT 2023, tramite l'Atlante. Restano fissi e servono a confrontare la simulazione con quello che è successo.

## Rigenerare i dati o spostare la finestra

```bash
python3 tools/prepara_dati.py ../Atlante-Lessinia/app/data
```

La finestra (`W, S, E, N`) e il lato della cella (`CELLA_M`) sono in cima allo script. Lo script non ha dipendenze e scrive `data/lessinia.js`.

## Struttura

```
index.html
css/style.css
data/lessinia.js        griglia e vettori reali (generato)
tools/prepara_dati.py   dai GeoJSON dell'Atlante alla griglia
js/config.js            matrice W con le frasi delle risposte, tempi, parametri di tavola e corridoi
js/util.js              rumore, heap, A*, campi di distanza
js/input.js             SliderBus (stato separato dalla sorgente) + adattatori MIDI e seriale
js/simulation.js        ancore, spinte, calcolaStato(): tutte le formule di stato e bisogni
js/territory.js         tavola reale, pascoli, paesi, strade, presenze, conflitti
js/corridors.js         corridoi, attraversamenti, passaggi per altre specie, nodi
js/render.js            tavola a matrice su Canvas 2D
js/ui.js                console, linee "chi spinge chi", registro, bilancio, legenda, schede
js/main.js              simulazione a 10 Hz, disegno a ogni frame
```

## Dove modificare i parametri

- **Pesi e frasi delle risposte**: `DN.config.W`.
- **Memoria e tempi**: `DN.config.TEMPO`. `RESPONSE_RATE` regola la velocità di risposta, `SOGLIA_QUIETE` la distanza sotto cui uno slider si ferma; `SOGLIA_RISPOSTA` è la spinta minima per mostrare una linea o una frase.
- **Tavola**: `DN.config.TERRITORIO`. Contiene soglie e quantità di abbandono ed espansione dei pascoli, crescita dei paesi, strade locali, area della presenza del lupo, distanza da paesi e strade, soglia di conflitto.
- **Corridoi**: `DN.config.CORRIDOI`.
- **Formule dei bisogni**: `calcolaStato()` in `js/simulation.js`.

## Slider fisici

`SliderBus` (`js/input.js`) separa lo stato degli slider dalla sorgente. Ogni tick `emitOutput()` manda le posizioni alle uscite, così i fader motorizzati seguono il sistema. Gli adattatori pronti si collegano dal pannello debug:

- **MIDI**: CC 0–7 in ingresso e in uscita.
- **Seriale** (Web Serial, 115200 baud): righe `allevare:73`, più `touch:allevare:1/0` facoltativi.

## Scelte di modellazione

- **Memoria al posto dell'inerzia.** La versione precedente seguiva alla lettera `target = 50 + Σ W·(v−50)`: ALLEVARE e COSTRUIRE, che nessuno influenza, tornavano subito a 50 e la scelta sembrava rifiutata. Ora la scelta resta e viene riassorbita in minuti.
- **Presenze, non animali.** Non ci sono simboli di lupi, pecore o cani. La presenza del lupo è un campo simulato e **non rappresenta territori reali**: i territori dei branchi non sono pubblicati, come nota l'Atlante.
- **Bisogni.** Sono calcolati come prima, dagli slider. La tavola rende visibile dove si pagano, ma non li modifica, tranne `corridoiAperti`, che si misura sui corridoi della tavola.
- **Calibrazioni ereditate** dalla prima versione: i pesi del cibo e della discendenza del lupo sono alzati per avere la stessa scala dell'umano; c'è un bonus bosco con branchi stabili.

## Limiti noti

- La copertura OSM ha completezza variabile: circa il 4% delle celle è senza dato e resta vuoto come il pascolo.
- Le posizioni delle uccisioni documentate hanno precisione variabile; è indicata nella scheda.
- Se la scheda del browser va in background, la simulazione rallenta.
