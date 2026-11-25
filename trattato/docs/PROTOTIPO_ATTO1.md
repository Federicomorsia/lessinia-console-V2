# Prototipo dell'Atto I — stato e decisioni

Ultimo aggiornamento: 18 novembre 2026. File: `trattato.html` + `js/trattato.js` + `css/trattato.css` (nella radice di lessinia-console-V2). Il prototipo originale, con gli slider simulati, è in `trattato/prototipo-originale/atto1.html`.
Versione pubblicata su claude.ai come artifact "Trattato generativo, Atto I".

Il prototipo è una **prova di stile**: serve a tarare come il testo si modifica prima di collegare il dispositivo di negoziazione reale. Gli slider sono simulati.

---

## 0. Collegamento al dispositivo (18/11/2026)

- `trattato.html` non simula più gli slider: li riceve dalla tavola (`index.html`), che li riceve dalla console (`console.html`) attraverso `js/link.js`. Servono aperte tutte e tre le pagine.
- Via negoziazione automatica, tempo 4× e riposo: la memoria degli slider è quella del dispositivo. Il tempo scorre a 1×.
- **Nomi degli slider (allineati il 25/11/2026: id interno = nome in console, in minuscolo).** *Homo sapiens*: ALLEVARE, ABITARE (ex COSTRUIRE / `costruire`), PRESIDIARE (ex CUSTODIRE / `proteggere`), MONITORARE (ex CONTROLLARE / `abbattere`). *Canis lupus*: NUTRIRSI (ex `predare`), ATTRAVERSARE (ex `disperdersi`), AVVICINARSI, RIPRODURSI (ex `fareBranco`, nel Trattato `branco`). Le sezioni successive di questo documento sono state scritte prima e usano i nomi vecchi.
- **Riformulazione: ora la muove ABITARE, invertito** (r = −(abitare − 50)/50). Risolve l'[APERTO] del §3: nella console *proteggere* (oggi PRESIDIARE) significa presidiare mandrie e greggi, non tutelare i lupi. ABITARE (insediarsi ↔ ritirarsi) è il gesto che l'Art. 2 contesta: *Homo sapiens* «ha prima trasformato la montagna». Chi si insedia difende l'occupazione e parla per eufemismi; chi si ritira riconosce. Così ogni slider continua a muovere una sola modifica, e PRESIDIARE non agisce sull'Atto I. Le soglie della tabella qui sotto restano invariate sull'indice r.
- **Lessico**: il testo usa *Homo sapiens* e *Canis lupus* in corsivo (LESSICO_TRATTATO.md §4.2). «Specie umana» → *Homo sapiens*; «il Lupo» → *Canis lupus*; «lupa» → «femmina di *Canis lupus*». Cervo, Capriolo, Bosco restano con la maiuscola di Parte. La barratura agisce sulle menzioni intere di *Canis lupus*, delle femmine e dei cuccioli.
- **Banco della comprensione**: accanto alla colonna, un riquadro per modifica dice che cosa si vede, quale slider la muove (con il valore dal vivo), la regola e lo stato attuale. Il riquadro è segnato in rosso mentre la modifica sta cambiando. Passandoci sopra (o cliccando) evidenzia nel testo le parole che tocca. Sotto, un registro delle ultime modifiche con la causa. Il tasto H nasconde il banco per il ledwall.

## 1. Supporto

- **Ogni atto è una colonna** su un display verticale o ledwall. Non è una pagina: non si aggiungono colonne a destra o a sinistra.
- La colonna è larga 1080 px e scalata nella pagina. Formati provati: 9:16 (1080×1920), 1:2 (1080×2160), 1:3 (1080×3240).
- **Il testo riempie tutta la colonna**, dal titolo all'ultima riga. Il corpo si calcola da solo in base all'altezza (ricerca binaria su `--fs`).
- Niente orari, intestazioni di seduta, note in testa o apparato in fondo: si lavora solo sul testo.

## 2. Tipografia

- Carattere: **STIX Two Text** variabile (Google Fonts), pesi 400–700, dal 18/11/2026 (prima Newsreader 200–800). Il grigio leggero resta a 400 e si distingue per colore; il nero pieno arriva a 700.
- Mood di riferimento: `riferimenti/ref-allover-inkbleed.png` (ink bleed) e `riferimenti/ref-anrt-pesi.png` (pesi leggerissimi e fortissimi, confine che taglia le parole).
- Il tremolio è stato **scartato**.

## 3. Le quattro modifiche

Regola guida, decisa dopo il primo giro di prove: **ogni modifica ha una sola causa e ogni slider muove una sola modifica.** Prima gli stessi indici muovevano più cose (per esempio il peso serviva sia alla "voce" sia al "peso di parte") e l'utente non capiva il legame tra gesto ed effetto.

| Modifica | Cosa si vede | Causa | Perché |
|---|---|---|---|
| **Voce** | In ogni articolo una parte è in nero pieno (peso ~740) e il resto in grigio leggero (~220). Il confine scorre lento e taglia anche le parole. Articoli dispari dall'inizio, pari dalla fine. | media di *disperdersi*, *avvicinarsi*, *fare branco* | Il mandato della Delegazione esiste solo perché i lupi sono tornati e sono presenti. Più presenza, più forza alla protesta. Quando la presenza cala la protesta arretra ma resta leggibile. *Predare* escluso: non è presenza, è conflitto. |
| **Inchiostro** (ink bleed) | Le parole si gonfiano e si impastano, con il massimo al centro della macchia e bordi leggibili. Solo sulle parole degli strumenti della caccia. Massimo una parola su undici. | *predare* e *allevare* insieme sopra 50 | Conflitto sul pascolo. L'Art. 2 dice che quel conflitto ha portato allo sterminio. Nessuno lo decide: accade e sporca. Asciuga lentamente (~140 s, ~40 a riposo). |
| **Barratura** | Linea netta su «Lupo», «lupa», «cuccioli». In Art. 2 «individuo in disaccordo» viene barrato e «nocivo» torna pieno. | solo *abbattere*, oltre 60 | Cancellazione deliberata: ripete sul testo ciò che l'Atto denuncia. Tratto netto e non macchia, perché qui qualcuno decide. |
| **Riformulazione** | I passaggi tra [ ] si cancellano e si riscrivono lettera per lettera. Con *proteggere* basso compaiono clausole nuove. | solo *proteggere* | Chi tutela i lupi è disposto a nominare con chiarezza ciò che è stato fatto. Senza tutela: eufemismi. Le clausole aggiunte sono la Delegazione che insiste quando la controparte nega. |

*Costruire* non agisce sull'Atto I.

### Soglie della riformulazione (indice r = (proteggere − 50) / 50)

| Passaggio | Basso | Intermedio | Alto |
|---|---|---|---|
| Art. 1, l'atto | «la rimozione» (r < −0,2) | «l'uccisione sistematica» | «lo sterminio deliberato» (r > 0,25) |
| Art. 1, la durata | «dal medioevo al 1909» | | «più di cinque secoli» (r > 0,1) |
| Art. 4, l'assenza | «una perdita» (r < −0,15) | «un debito» | «un lutto» (r > 0,3) |
| Art. 5, la risposta | «considera chiusa la questione…» (r < −0,3) | «prende atto di eventi storici…» | «riconosce lo sterminio come atto proprio» (r > 0,35) |

Clausole aggiunte: Art. 3 «In nessun documento di quei secoli il Lupo compare come Parte.» (r < −0,15, esce sopra −0,05). Art. 6 «Il debito si trasmette…» (r < −0,3, esce sopra −0,2).

«Questi animali crudeli» (Art. 3) resta sempre barrato sottile, come nel testo originale.

**[APERTO]** Ho letto *proteggere* come tutela della presenza dei lupi. Se nel dispositivo significa proteggere le greggi, la logica si ribalta: in quel caso la riformulazione potrebbe passare a *costruire*.

## 4. Tracce delle revisioni

- **Formulazione precedente**: dopo ogni riscrittura resta accanto, piccola (0,55 em), grigia e barrata. Sbiadisce in ~45 s fino a un minimo, non sparisce.
- **Parentesi quadre**: piene appena il passaggio cambia, sbiadiscono in ~30 s.
- **Glosse**: minuscole in maiuscoletto attaccate al punto modificato («inserito», «ritirato», «ripristinato dalla Specie umana»). Sbiadiscono in ~25 s. Sostituiscono le note sopra e sotto, che sono state scartate.
- **Isteresi**: ogni cambio di stato aspetta 2,5 s di condizione stabile; le soglie hanno un margine in entrata e in uscita.
- **Riposo**: dopo 20 s senza spinte (con l'automatica spenta) gli slider tornano verso 50 con τ = 45 s, e l'inchiostro asciuga più in fretta. Il testo non torna pulito.

## 5. Ink bleed: cosa è stato provato

1. Primo filtro (turbolenza + soglia): troppo sgranato.
2. Masse gonfie con colature verso il basso: **scartato**, troppo estremo, sembrava tutto una macchia.
3. Versione leggera senza colature, meno parole: approvata come direzione.
4. **Attuale**: sfumatura lettera per lettera. Ogni lettera ha un livello (0–8) che cala dal punto d'origine verso i bordi, così la parola resta in parte leggibile e non c'è un confine netto. Filtri SVG `#k{1..8}_{0..2}`: turbolenza → spostamento → dilatazione morfologica → sfocatura → soglia alfa.

## 6. Mappa del codice (`prototipo/atto1.html`)

| Sezione (commento nel file) | Cosa contiene |
|---|---|
| `ledwall` / `banco` (CSS) | stile della colonna e del pannello slider |
| `filtri ink bleed` | generazione dei 24 filtri SVG |
| `testo marcato` | array `ARTS` (testo e marcatura), `SLOTS` (passaggi contesi e soglie), `ADDS` (clausole aggiunte), `GLOSS` |
| `slider` | slider simulati, `EFF` (cosa muove ogni slider), `derive()` che calcola i quattro indici `v`, `c`, `B`, `r` |
| `riscrittura lettera per lettera` | `retype()`, isteresi `wantIdx()`, stato delle formule barrabili `cpState()` |
| `il corpo riempie la colonna` | `fit()` |
| `resa delle parole` | `renderWord()`: peso del fronte di voce e sfumatura dell'inchiostro |
| `ciclo` | `step()` (fisica, negoziazione automatica, riposo, crescita inchiostro) e `tick()` a 10 Hz (resa, soglie, banco) |

Marcatura del testo in `ARTS`: `{h|…}` Specie umana, `{w|…}` Lupo, `{x|…}` strumenti della caccia (sensibili all'inchiostro), `{i|…}` corsivo, `{s:id}` passaggio conteso, `{a:id}` clausola aggiunta, `{c:id}` formula barrabile.

## 7. Prossimi passi possibili

- Verificare il significato di *proteggere* nel dispositivo (vedi §3).
- Sostituire gli slider simulati con le variabili reali dello stato del territorio (`riferimenti/schema-dispositivo.png`).
- Estendere agli altri atti: stessa grammatica, cambiano solo i passaggi contesi e quale slider li muove.
- Il `CONTESTO.md` (§10) dice ancora che non esistono prototipi: va aggiornato.
