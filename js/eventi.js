/* =====================================================================
   EVENTI — il registro dei conflitti della seduta (pannello CONFLITTI).
   Un calendario simulato avanza di un giorno ogni SECONDI_PER_GIORNO.
   Ogni giorno, per ogni tipo di conflitto, un evento accade con una
   probabilità che dipende dallo stato della tavola. Il luogo è una
   cella di conflitto reale della tavola; il nome è quello del luogo
   più vicino. Gli eventi sono SIMULATI: non sono uccisioni documentate.
   Registro dei testi: LESSICO_TRATTATO.md.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const CF = DN.territory.CONFLITTO;

  const NUMERI = ['un', 'due', 'tre', 'quattro', 'cinque'];
  const CL = '<i>Canis lupus</i>';
  const HS = '<i>Homo sapiens</i>';

  // tipo -> icona (stessi segni della legenda) e titolo
  const TIPI = {
    bestiame: { icona: 'bestiame', titolo: 'Animale da allevamento' },
    ucciso:   { icona: 'ucciso',   titolo: CL + ' ucciso' },
    strada:   { icona: 'ucciso',   titolo: CL + ' ucciso in strada' },
    margine:  { icona: 'conteso',  titolo: 'Margine delle contrade' },
    conteso:  { icona: 'conteso',  titolo: 'Corridoio conteso' },
    trappola: { icona: 'trappola', titolo: 'Trappola' }
  };

  class Eventi {
    constructor(cfg, territory, corridors, dati) {
      this.cfg = cfg;
      this.T = territory;
      this.Co = corridors;
      this.D = dati;
      this.rng = U.mulberry32(20121);
      this.giorno = 0;
      this.acc = 0;
      this.lista = [];          // più recente in fondo
      this.versione = 0;
      const oggi = new Date();
      this.data0 = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    }

    reset() { this.lista = []; this.versione++; }

    data(g) {
      const d = new Date(this.data0.getTime() + g * 86400000);
      const z = (n) => String(n).padStart(2, '0');
      return `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`;
    }

    tick(dt, res, v) {
      const passo = this.cfg.EVENTI.SECONDI_PER_GIORNO;
      this.acc += dt;
      while (this.acc >= passo) {
        this.acc -= passo;
        this.giorno++;
        this._giorno(res, v);
      }
    }

    /* probabilità giornaliere per tipo */
    _giorno(res, v) {
      const st = this.T.stats, s = res.territorio, cs = this.Co.stats || {};
      const r = (n, k) => n / (n + k);
      const p = {
        bestiame: 0.55 * r(st.predazione || 0, 40),
        margine: 0.35 * r(st.margine || 0, 60),
        ucciso: (v.abbattere > 50 ? 0.3 * (v.abbattere - 50) / 50 : 0) + 0.2 * r(st.trappola || 0, 60),
        strada: 0.18 * s.mortalitaStradale / 100,
        conteso: 0.15 * ((cs.conteso || 0) + (cs.interrotto || 0)) / 100,
        trappola: 0.15 * (cs.trappola || 0) / 100
      };
      for (const tipo in p) {
        if (this.rng() < p[tipo]) {
          const e = this._crea(tipo, res);
          if (e) this._aggiungi(e);
        }
      }
    }

    _aggiungi(e) {
      this.lista.push(e);
      if (this.lista.length > this.cfg.EVENTI.MAX) this.lista.shift();
      this.versione++;
    }

    /* una cella di conflitto del tipo dato, scelta con peso = intensità */
    _cella(tipoCella) {
      const T = this.T, soglia = this.cfg.TERRITORIO.SOGLIA_CONFLITTO;
      let tot = 0;
      for (let i = 0; i < T.N; i++) if (T.tipoConflitto[i] === tipoCella && T.conflitto[i] >= soglia) tot += T.conflitto[i];
      if (!tot) return null;
      let x = this.rng() * tot;
      for (let i = 0; i < T.N; i++) {
        if (T.tipoConflitto[i] !== tipoCella || T.conflitto[i] < soglia) continue;
        x -= T.conflitto[i];
        if (x <= 0) return { i, x: (i % T.W) + 0.5, y: ((i / T.W) | 0) + 0.5, c: T.conflitto[i] };
      }
      return null;
    }

    /* un punto lungo i corridoi nello stato dato */
    _corridoio(stati) {
      const cand = [];
      (this.Co.percorsi || []).filter((p) => p.disegna).forEach((p) => p.tratti.forEach((t) => {
        if (stati.includes(t.stato)) cand.push(p.pts[Math.floor((t.da + t.a) / 2)]);
      }));
      if (!cand.length) return null;
      const q = cand[Math.floor(this.rng() * cand.length)];
      return { x: q[0], y: q[1], c: 0.4 + 0.5 * this.rng() };
    }

    _luogo(x, y) {
      let best = null, bd = Infinity;
      this.T.malghe.forEach((m) => { const d = Math.hypot(m.x - x, m.y - y); if (m.nome && d < bd && d < 4) { bd = d; best = /^(malga|baito|rifugio|casara)\b/i.test(m.nome) ? m.nome : 'malga ' + m.nome; } });
      if (best) return best;
      this.D.luoghi.forEach((l) => { const d = Math.hypot(l.x - x, l.y - y); if (d < bd) { bd = d; best = l.nome; } });
      return best || 'Alta Lessinia';
    }

    _crea(tipo, res) {
      const rng = this.rng, pick = (a) => a[Math.floor(rng() * a.length)];
      let pos = null;
      if (tipo === 'bestiame') pos = this._cella(CF.PREDAZIONE);
      else if (tipo === 'margine') pos = this._cella(CF.MARGINE);
      else if (tipo === 'ucciso') pos = this._cella(CF.TRAPPOLA) || this._cella(CF.MARGINE) || this._cella(CF.PREDAZIONE);
      else if (tipo === 'strada') {
        const n = (this.Co.nodi || []).filter((q) => q.tipo === 'stradale');
        pos = n.length ? Object.assign({ c: 0.5 + 0.4 * rng() }, pick(n)) : this._corridoio(['interrotto']);
      } else if (tipo === 'conteso') pos = this._corridoio(['conteso', 'interrotto']);
      else if (tipo === 'trappola') pos = this._corridoio(['trappola']);
      if (!pos) return null;

      const luogo = this._luogo(pos.x, pos.y);
      const intensita = U.clamp(pos.c * (0.75 + 0.35 * rng()), 0.05, 1);
      let testo = '';
      if (tipo === 'bestiame') {
        const specie = pick(['bovini', 'bovini', 'ovicaprini']);
        const n = 1 + Math.min(4, Math.floor(intensita * 3 + rng() * 1.5));
        const quanti = n === 1 ? (specie === 'bovini' ? 'un bovino' : 'un ovicaprino') : `${NUMERI[n - 1]} ${specie}`;
        testo = pick([
          `${specie[0].toUpperCase() + specie.slice(1)} e ${CL} sullo stesso pascolo presso ${luogo}: ${quanti} nutrimento per la famiglia di ${CL}.`,
          `Presso ${luogo} ${quanti} ${n === 1 ? 'ucciso' : 'uccisi'} al pascolo incustodito. Ogni animale ucciso apre un debito.`
        ]);
      } else if (tipo === 'margine') {
        testo = pick([
          `${CL} rilevato tra le case di ${luogo}. Nessun contatto registrato.`,
          `${HS} rilevato vicino ai boschi di ${luogo}. Punto a rischio di conflitto diretto.`
        ]);
      } else if (tipo === 'ucciso') {
        testo = `Un individuo di ${CL} ucciso presso ${luogo}. Ogni ${CL} ucciso apre un debito. Nessun animale risulta creditore.`;
      } else if (tipo === 'strada') {
        testo = `Un individuo di ${CL} ucciso da un veicolo presso ${luogo}. L'attraversamento resta segnato sulla carta.`;
      } else if (tipo === 'conteso') {
        testo = `Il passaggio di ${CL} presso ${luogo} incontra strade e pascoli. Il corridoio è conteso, non chiuso.`;
      } else if (tipo === 'trappola') {
        testo = `Presso ${luogo} il corridoio diventa trappola: chi lo attraversa è esposto all'uccisione.`;
      }
      return {
        tipo, icona: TIPI[tipo].icona, titolo: TIPI[tipo].titolo,
        giorno: this.giorno, data: this.data(this.giorno),
        intensita, testo, luogo, x: pos.x, y: pos.y
      };
    }

    /* eventi nella finestra del grafico */
    finestra() {
      const g0 = this.giorno - this.cfg.EVENTI.FINESTRA_GIORNI;
      return this.lista.filter((e) => e.giorno > g0);
    }

    get ultimo() { return this.lista[this.lista.length - 1] || null; }
  }

  DN.eventi = { Eventi, TIPI };

})(window.DN = window.DN || {});
