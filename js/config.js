/* =====================================================================
   CONFIG — tutti i parametri modificabili del dispositivo.
   Matrice delle influenze (con le frasi che spiegano ogni risposta),
   costanti di tempo, parametri del territorio e dei corridoi.
   Le formule dello stato e dei bisogni sono in js/simulation.js.
   I dati geografici reali sono in data/lessinia.js (tools/prepara_dati.py).
   ===================================================================== */
(function (DN) {
  'use strict';

  DN.config = {

    /* ---------------------------------------------------------------
       Gli 8 slider. Ogni slider è un'azione (un verbo), non una cosa.
       sx = estremo 0, dx = estremo 100.
       --------------------------------------------------------------- */
    SLIDERS: [
      { id: 'allevare',    nome: 'ALLEVARE',    sx: 'lasciare i pascoli', dx: 'estendere i pascoli',   animale: 'umano', coppia: 'cibo' },
      { id: 'costruire',   nome: 'COSTRUIRE',   sx: 'ritirarsi',         dx: 'insediarsi',             animale: 'umano', coppia: 'spazio' },
      { id: 'proteggere',  nome: 'CUSTODIRE',   sx: 'lasciare incustodito', dx: 'vegliare',            animale: 'umano', coppia: 'limite' },
      { id: 'abbattere',   nome: 'UCCIDERE',    sx: 'lasciar passare',   dx: 'uccidere',               animale: 'umano', coppia: 'discendenza' },
      { id: 'predare',     nome: 'NUTRIRSI',    sx: 'caprioli, altri ungulati', dx: 'bovini, ovicaprini', animale: 'lupo', coppia: 'cibo' },
      { id: 'disperdersi', nome: 'ATTRAVERSARE', sx: 'sostare',          dx: 'percorrere lunghe distanze', animale: 'lupo', coppia: 'spazio' },
      { id: 'avvicinarsi', nome: 'PERCORRERE',  sx: 'lontano dalle contrade', dx: 'tra le contrade',   animale: 'lupo',  coppia: 'limite' },
      { id: 'fareBranco',  nome: 'FARE BRANCO', sx: 'sciogliersi',       dx: 'riprodursi',             animale: 'lupo',  coppia: 'discendenza' }
    ],

    COPPIE: [
      { id: 'cibo',        umano: 'allevare',   lupo: 'predare' },
      { id: 'spazio',      umano: 'costruire',  lupo: 'disperdersi' },
      { id: 'limite',      umano: 'proteggere', lupo: 'avvicinarsi' },
      { id: 'discendenza', umano: 'abbattere',  lupo: 'fareBranco' }
    ],

    /* ---------------------------------------------------------------
       Matrice delle influenze W[sorgente][bersaglio].
       w   = peso: target[j] = ancora[j] + Σ_i w(i→j) · (value[i] − 50)
       su  = cosa succede quando la sorgente sta SOPRA il centro (50)
       giu = cosa succede quando la sorgente sta SOTTO il centro
       Le frasi compaiono nel "Verbale" sotto il bilancio.
       Registro: LESSICO_TRATTATO.md. "Il modello assume" segna i legami
       che non hanno appoggio nelle schede delle fonti.
       --------------------------------------------------------------- */
    W: {
      allevare: {
        predare:     { w: +0.30, su: 'Più bovini e ovicaprini al pascolo. A verbale più animali uccisi. Ogni capo ucciso apre un debito.', giu: 'Meno bovini e ovicaprini al pascolo. A verbale più caprioli e altri ungulati uccisi. Nessuno li rappresenta.' },
        avvicinarsi: { w: +0.10, su: 'I pascoli raggiungono i margini dei paesi. Il limite si sposta con loro.', giu: 'Meno pascoli vicino alle case. Il limite non è stato notificato a chi lo attraversa.' }
      },
      costruire: {
        avvicinarsi: { w: +0.20, su: 'Più margini delle contrade da attraversare. Il margine è annotato da chi resta.', giu: 'Meno margini delle contrade. La contrada arretra. <i>Canis lupus</i> non ne è informato.' },
        fareBranco:  { w: -0.20, su: 'Territorio frammentato: il modello assume meno branchi stabili. La frammentazione è sottoscritta da una sola specie.', giu: 'Territorio continuo: il modello assume branchi più stabili. La continuità non costituisce accordo.' }
      },
      proteggere: {
        predare:   { w: -0.35, su: 'Mandrie e greggi custodite da pastore, cani e recinzione. A verbale meno bovini e ovicaprini uccisi. Dei custodi uno solo ha sottoscritto.', giu: 'Mandrie e greggi incustodite. A verbale più bovini e ovicaprini uccisi. Il costo delle notti di veglia non è stato ripartito.' },
        abbattere: { w: -0.20, su: 'Meno bovini e ovicaprini uccisi, meno richieste di abbattimento. <i>Homo sapiens</i> si impegna a non chiamarla vittoria.', giu: 'Più bovini e ovicaprini uccisi, più richieste di abbattimento.' }
      },
      abbattere: {
        fareBranco:  { w: -0.40, su: 'Il modello assume che uccidere individui adulti riduca la stabilità dei branchi. Ogni <i>Canis lupus</i> ucciso apre un debito. Nessun animale risulta creditore.', giu: 'Meno uccisioni: il modello assume branchi più stabili.' },
        disperdersi: { w: +0.20, su: 'Il modello assume che i giovani rimasti senza branco si allontanino.', giu: 'Il modello assume che i giovani restino nel branco.' },
        // PARADOSSO: giovani senza un branco da cui apprendere la caccia
        // ad altri ungulati uccidono più bovini e ovicaprini
        predare:     { w: +0.25, su: 'Il modello assume che giovani senza branco da cui apprendere uccidano più bovini e ovicaprini.', giu: 'Il modello assume che branchi stabili si nutrano soprattutto di caprioli e altri ungulati.' }
      },
      predare: {
        abbattere:  { w: +0.35, su: 'Aumentano le richieste di abbattimento. Ogni capo ucciso apre un debito. Il Trattato non stabilisce verso chi.', giu: 'Meno bovini e ovicaprini uccisi, meno richieste di abbattimento. Le partite precedenti restano aperte.' },
        proteggere: { w: +0.20, su: 'Chi alleva aggiunge reti, cani e notti di veglia. <i>Canis lupus</i> non è stato informato della spesa.', giu: 'Meno bovini e ovicaprini uccisi, la custodia si allenta. L\'assenza di uccisioni non dimostra l\'assenza di <i>Canis lupus</i>.' }
      },
      disperdersi: {
        avvicinarsi: { w: +0.15, su: '<i>Canis lupus</i> in aree nuove, spesso con case e contrade. Il passaggio non costituisce visita né dichiarazione.', giu: 'Meno passaggi vicino ai paesi. Il verbale annota l\'assenza.' },
        abbattere:   { w: +0.10, su: '<i>Canis lupus</i> in comunità non ancora attrezzate. Aumentano le richieste di abbattimento.', giu: 'Meno comparse inattese. Inattese da una sola specie.' }
      },
      avvicinarsi: {
        abbattere:  { w: +0.30, su: '<i>Canis lupus</i> rilevato vicino alle case. Aumentano le richieste di abbattimento.', giu: '<i>Canis lupus</i> non rilevato vicino alle case, meno richieste di abbattimento. Il verbale non stabilisce dove sia passato.' },
        proteggere: { w: +0.10, su: 'Preoccupazione nei paesi, più reti e cani. La preoccupazione è misurata da chi la prova.', giu: 'Meno preoccupazione, meno reti e cani. Il limite va rinnovato.' }
      },
      fareBranco: {
        predare:     { w: -0.20, su: 'Il modello assume che un branco stabile si nutra soprattutto di caprioli e altri ungulati. I caprioli non sono stati convocati.', giu: 'Il modello assume che individui soli uccidano più bovini e ovicaprini.' },
        disperdersi: { w: +0.20, su: 'Più cuccioli, più giovani che si allontanano. La partenza non è stata notificata.', giu: 'Meno cuccioli, meno partenze.' }
      }
    },

    /* ---------------------------------------------------------------
       Tempo e dinamica degli slider
       --------------------------------------------------------------- */
    TEMPO: {
      TICK_HZ: 10,
      RESPONSE_RATE: 0.02,          // quanto della distanza dal target si copre per tick
      // MEMORIA: uno slider lasciato resta dove l'hai messo; gli altri trovano il loro
      // assetto e si fermano. Il sistema non si muove mai da solo.
      SOGLIA_QUIETE: 0.25,          // sotto questa distanza dal target lo slider si ferma
      FRECCE_DURATA: 30,            // secondi dopo i quali le frecce del bilancio sfumano
      SOGLIA_RISPOSTA: 2.5          // spinta minima (punti) per mostrare un legame o una frase
    },

    /* ---------------------------------------------------------------
       Territorio (sulla griglia reale di data/lessinia.js)
       --------------------------------------------------------------- */
    TERRITORIO: {
      VELOCITA_TRANSIZIONE: 0.02,   // frazione del massimo di ciascun cambiamento per tick
      // ALLEVARE: sotto PASCOLO_SOGLIA i pascoli più lontani dalle malghe si abbandonano
      // e diventano arbusteto; sopra, il pascolo si allarga attorno alle malghe
      PASCOLO_SOGLIA: 55,
      ABBANDONO_MAX: 0.7,           // quota di praterie abbandonate con allevare = 0
      ESPANSIONE_PASCOLO_MAX: 0.22, // praterie in più (rispetto alle esistenti) con allevare = 100
      // COSTRUIRE: sopra ABITATO_SOGLIA i paesi crescono lungo le strade
      ABITATO_SOGLIA: 45,
      ABITATO_ESPANSIONE_MAX: 1.6,  // celle nuove = abitato reale × questo, con costruire = 100
      STRADE_LOCALI_MIN: 0.35,      // quota di strade locali aperte con costruire = 0
      // presenza del lupo: quota di territorio con lupi = 0 e lupi = 100
      PRESENZA_AREA_MIN: 0.05,
      PRESENZA_AREA_MAX: 0.48,
      EVITA_PAESI_CELLE: 7,         // distanza a cui il lupo evita i paesi (con avvicinarsi = 0)
      EVITA_STRADE_CELLE: 2.5,
      SOGLIA_CONFLITTO: 0.12        // intensità minima per disegnare una zona di conflitto
    },

    /* ---------------------------------------------------------------
       Corridoi
       --------------------------------------------------------------- */
    CORRIDOI: {
      MAX_PERCORSI: 8,
      MIN_MISURA: 3,
      INTERVALLO_MS: 500,
      SOGLIA_CAMBIO: 1.5,
      COSTO: { vuoto: 2, bosco: 1, prateria: 3, arbusto: 1.4, roccia: 3, abitato: 16, acqua: 8 },
      COSTO_STRADA: [0, 26, 18, 7],   // per rango: 1 principale, 2 secondaria, 3 locale
      COSTO_PASSAGGIO: 1.5,
      SOGLIA_PASSAGGI: 58,
      SOGLIA_TOLLERATO: 56,
      SOGLIA_CONTESO_ALLEVARE: 55,
      SOGLIA_CONTESO_PROTEGGERE: 46,
      SOGLIA_TRAPPOLA: 0.52,
      RAGGIO_PRESSIONE: 5,
      PENALITA_INTERRUZIONE: 0.8
    },

    /* ---------------------------------------------------------------
       Livelli della mappa (tasti 1–8)
       --------------------------------------------------------------- */
    LIVELLI: [
      { id: 'suolo',       nome: 'Matrice del suolo',        on: true },
      { id: 'umano',       nome: 'Presenza di Homo sapiens', on: true },
      { id: 'lupo',        nome: 'Presenza di Canis lupus',  on: true },
      { id: 'conflitti',   nome: 'Zone di conflitto',        on: true },
      { id: 'corridoi',    nome: 'Corridoi e attraversamenti', on: true },
      { id: 'viabilita',   nome: 'Strade e sentieri',        on: true },
      { id: 'documentati', nome: 'Uccisioni documentate',    on: true },
      { id: 'rilievo',     nome: 'Isoipse, acque, nomi',     on: true }
    ]
  };

})(window.DN = window.DN || {});
