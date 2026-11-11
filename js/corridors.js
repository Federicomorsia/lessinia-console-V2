/* =====================================================================
   CORRIDORS — corridoi e attraversamenti, effetti emergenti.
   Il lupo traccia i corridoi muovendosi tra le sue aree di presenza e
   verso il bordo della tavola (cammini a costo minimo); l'umano li lascia
   aperti o li chiude: strade, paesi, pascoli presidiati o scoperti,
   pressione di abbattimento, passaggi faunistici.
   Gli attraversamenti sono i punti in cui una strada aperta taglia un
   corridoio o un'area di presenza del lupo.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const K = DN.territory.K;

  const STATI = ['aperto', 'interrotto', 'trappola', 'conteso', 'tollerato'];

  /* Testi dei nodi: il costo per entrambe le specie */
  const NODI = {
    stradale: {
      titolo: 'Attraversamento interrotto', conflitto: true,
      umano: 'collisioni, veicoli fermi, notti di guida attenta',
      lupo: 'mortalità stradale: il passaggio si chiude'
    },
    abitato: {
      titolo: 'Margine delle contrade', conflitto: true,
      umano: 'presenze notturne vicino alle case, paura',
      lupo: 'Attraversamento tra cani e luci. Esposizione all\'uccisione.'
    },
    pascolo: {
      titolo: 'Pascolo conteso', conflitto: true,
      umano: 'bovini e ovicaprini uccisi lungo il passaggio',
      lupo: 'Si nutre lungo il passaggio. Aumenta l\'esposizione all\'uccisione.'
    },
    trappola: {
      titolo: 'Attraversamento trappola', conflitto: true,
      umano: 'conflitto ricorrente, ogni stagione da capo',
      lupo: 'Mortalità ricorrente lungo il passaggio.'
    },
    passaggio: {
      titolo: 'Passaggio per altre specie', conflitto: false,
      umano: 'meno collisioni; costo di costruzione e cura',
      lupo: 'Il passaggio è registrato come attraversamento. Non costituisce accettazione dell\'opera.'
    },
    presidio: {
      titolo: 'Pascolo custodito', conflitto: false,
      umano: 'lavoro di custodia: recinti, cani, pastore presente',
      lupo: 'Mandrie e greggi non risultano accessibili. Il mancato passaggio non vale assenso.'
    }
  };

  class Corridors {
    constructor(cfg, territory) {
      this.cfg = cfg;
      this.T = territory;
      this.ids = cfg.SLIDERS.map((s) => s.id);
      this.percorsi = [];
      this.nodi = [];
      this.passaggi = new Set();
      this.corridoiAperti = 60;
      this.lastT = -Infinity;
      this.lastV = null;
      this.lastVer = -1;
      this.stats = {};
      this.version = 0;
      this.tempoCalcolo = 0;
    }

    maybeCompute(now, v, force) {
      const C = this.cfg.CORRIDOI;
      if (!force && now - this.lastT < C.INTERVALLO_MS) return false;
      const changed = force || !this.lastV || this.T.version !== this.lastVer ||
        this.ids.some((id) => Math.abs(v[id] - this.lastV[id]) >= C.SOGLIA_CAMBIO);
      if (!changed) return false;
      const t0 = performance.now();
      this.compute(v);
      this.tempoCalcolo = performance.now() - t0;
      this.lastT = now;
      this.lastV = Object.assign({}, v);
      this.lastVer = this.T.version;
      this.version++;
      return true;
    }

    compute(v) {
      const T = this.T, C = this.cfg.CORRIDOI, W = T.W, H = T.H, N = T.N;
      const cls = T.cls, sr = T.stradaRango;
      const chiavi = DN.territory.CHIAVI;

      // --- costo di base ---------------------------------------------------
      const base = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let c = C.COSTO[chiavi[cls[i]]];
        if (sr[i]) c = Math.max(c, this.passaggi.has(i) ? C.COSTO_PASSAGGIO : C.COSTO_STRADA[sr[i]]);
        base[i] = c * (1 + 0.6 * U.hash2(i, 0, 5));
      }
      // pressione di abbattimento: vicino a pascoli e paesi
      const pressione = (i) => (v.abbattere / 100) * Math.exp(-Math.min(T.dAb[i], T.dPascolo[i]) / C.RAGGIO_PRESSIONE);

      // --- aree di presenza come sorgenti -----------------------------------
      const { gruppi, id: mem } = T.gruppi(10);
      const nDraw = gruppi.length ? Math.round((v.disperdersi / 100) * C.MAX_PERCORSI) : 0;
      const nCalc = gruppi.length ? Math.max(nDraw, C.MIN_MISURA) : 0;
      const mete = gruppi.map((g) => ({ x: g.x, y: g.y, idx: g.idx, gruppo: g.id })).concat(T.meteBordo);
      const usate = new Set();
      const percorsi = [];
      for (let k = 0; k < nCalc; k++) {
        const g = gruppi[k % gruppi.length];
        let best = null, bs = -Infinity;
        mete.forEach((d, j) => {
          if (d.gruppo === g.id) return;
          const key = g.id + ':' + j;
          if (usate.has(key)) return;
          const dist = Math.hypot(d.x - g.x, d.y - g.y);
          if (dist < 12) return;
          const s = (d.gruppo !== undefined ? 1.6 : 1) * (0.5 + U.hash2(k, j, 77)) / Math.sqrt(dist + 10) * 10;
          if (s > bs) { bs = s; best = { d, key }; }
        });
        if (!best) continue;
        usate.add(best.key);
        const cost = (i) => { const m = mem[i]; return base[i] + (m >= 0 && m !== g.id && m !== best.d.gruppo ? 4 : 0); };
        const raw = U.findPath(W, H, cost, g.idx, best.d.idx, null, 1);
        if (!raw || raw.length < 4) continue;
        // 4-connesso: ogni attraversamento di strada viene registrato
        const cells = [raw[0]];
        for (let q = 1; q < raw.length; q++) {
          const a = raw[q - 1], b = raw[q];
          const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
          if (ax !== bx && ay !== by) {
            const o1 = ay * W + bx, o2 = by * W + ax;
            cells.push(cost(o1) <= cost(o2) ? o1 : o2);
          }
          cells.push(b);
        }
        // si disegna solo il tratto fuori dalle aree di presenza (dentro, il lupo è già "a casa")
        percorsi.push({ cells, disegna: k < nDraw, meta: best.d });
      }

      // --- attraversamenti di strada: corridoi + aree di presenza tagliate --
      const runs = [];
      const giaVisto = new Uint8Array(N);
      percorsi.forEach((p) => {
        let run = null;
        p.cells.forEach((i) => {
          if (sr[i]) { if (!run) { run = { celle: [i], disegna: p.disegna }; runs.push(run); } else run.celle.push(i); giaVisto[i] = 1; }
          else run = null;
        });
      });
      // strade principali e secondarie dentro le aree del lupo
      for (let i = 0; i < N; i++) {
        if (sr[i] && sr[i] <= 2 && !giaVisto[i] && T.presenza[i] > 0.5) {
          const x = i % W, y = (i / W) | 0;
          if (runs.some((r) => r.celle.some((c) => Math.abs((c % W) - x) + Math.abs(((c / W) | 0) - y) < 5))) continue;
          runs.push({ celle: [i], disegna: true, area: true });
        }
      }
      const nuovi = new Set();
      if (v.proteggere >= C.SOGLIA_PASSAGGI) {
        const frac = U.clamp((v.proteggere - C.SOGLIA_PASSAGGI) / (90 - C.SOGLIA_PASSAGGI), 0, 1);
        const ord = runs.slice().sort((a, b) => U.hash2(a.celle[0], 3, 9) - U.hash2(b.celle[0], 3, 9));
        ord.slice(0, Math.ceil(frac * ord.length)).forEach((r) => r.celle.forEach((i) => nuovi.add(i)));
      }
      this.passaggi = nuovi;

      // --- classificazione dei tratti ------------------------------------------
      const pr = v.proteggere, al = v.allevare;
      const stato = (i) => {
        const k = cls[i];
        if ((sr[i] && !nuovi.has(i)) || k === K.ABITATO) return 'interrotto';
        const pascolo = k === K.PRATERIA;
        if (pascolo && al >= C.SOGLIA_CONTESO_ALLEVARE && pr < C.SOGLIA_CONTESO_PROTEGGERE) return 'conteso';
        if (pressione(i) > C.SOGLIA_TRAPPOLA) return 'trappola';
        if (pascolo && pr >= C.SOGLIA_TOLLERATO) return 'tollerato';
        return 'aperto';
      };
      percorsi.forEach((p) => {
        const st = p.cells.map(stato);
        for (let k = 1; k < st.length - 1; k++) {
          if (st[k] !== 'interrotto' && st[k - 1] === st[k + 1] && st[k] !== st[k - 1] && st[k - 1] !== 'interrotto') st[k] = st[k - 1];
        }
        p.stati = st;
        p.passaggio = p.cells.map((i) => nuovi.has(i));
        p.pts = p.cells.map((i, k) => {
          if (k === 0 || k === p.cells.length - 1) return [(i % W) + 0.5, ((i / W) | 0) + 0.5];
          let sx = 0, sy = 0, n = 0;
          for (let j = Math.max(0, k - 2); j <= Math.min(p.cells.length - 1, k + 2); j++) {
            sx += (p.cells[j] % W) + 0.5; sy += ((p.cells[j] / W) | 0) + 0.5; n++;
          }
          return [sx / n, sy / n];
        });
        p.tratti = [];
        let cur = null;
        st.forEach((s, k) => {
          if (!cur || cur.stato !== s) { cur = { stato: s, da: k, a: k }; p.tratti.push(cur); }
          else cur.a = k;
        });
        const aperte = st.filter((s) => s === 'aperto' || s === 'tollerato').length;
        const interr = p.tratti.filter((t) => t.stato === 'interrotto').length;
        p.apertura = (aperte / st.length) * Math.pow(C.PENALITA_INTERRUZIONE, interr);
      });
      this.corridoiAperti = percorsi.length ? 100 * percorsi.reduce((a, p) => a + p.apertura, 0) / percorsi.length : 40;
      this.percorsi = percorsi;

      // --- nodi d'incontro -------------------------------------------------------
      const nodi = [];
      const addNodo = (tipo, x, y) => {
        const r = tipo === 'presidio' || tipo === 'pascolo' ? 8 : 3.5;
        if (nodi.some((n) => n.tipo === tipo && Math.hypot(n.x - x, n.y - y) < r)) return;
        nodi.push(Object.assign({ tipo, x, y }, NODI[tipo]));
      };
      // attraversamenti (strade)
      runs.filter((r) => r.disegna).forEach((r) => {
        const i = r.celle[Math.floor(r.celle.length / 2)];
        const x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
        if (nuovi.has(i)) addNodo('passaggio', x, y);
        else if (pressione(i) > C.SOGLIA_TRAPPOLA * 0.85) addNodo('trappola', x, y);
        else addNodo('stradale', x, y);
      });
      percorsi.filter((p) => p.disegna).forEach((p) => {
        const longest = (s) => p.tratti.filter((t) => t.stato === s && t.a - t.da >= 2).sort((a, b) => (b.a - b.da) - (a.a - a.da))[0];
        const tc = longest('conteso'), tt = longest('tollerato');
        if (tc) { const q = p.pts[Math.floor((tc.da + tc.a) / 2)]; addNodo('pascolo', q[0], q[1]); }
        if (tt) { const q = p.pts[Math.floor((tt.da + tt.a) / 2)]; addNodo('presidio', q[0], q[1]); }
        p.tratti.forEach((t) => {
          if (t.stato !== 'interrotto') return;
          const i = p.cells[Math.floor((t.da + t.a) / 2)];
          if (cls[i] === K.ABITATO) { const q = p.pts[Math.floor((t.da + t.a) / 2)]; addNodo('abitato', q[0], q[1]); }
        });
      });
      this.nodi = nodi;
      this.attraversamenti = runs;

      // --- statistiche -------------------------------------------------------------
      const st = {};
      STATI.forEach((s) => { st[s] = 0; });
      let tot = 0;
      percorsi.forEach((p) => p.stati.forEach((s) => { st[s]++; tot++; }));
      STATI.forEach((s) => { st[s] = tot ? (100 * st[s] / tot) : 0; });
      st.aree = gruppi.length;
      st.percorsiDisegnati = percorsi.filter((p) => p.disegna).length;
      st.percorsiMisurati = percorsi.length;
      st.passaggi = runs.filter((r) => nuovi.has(r.celle[0])).length + '/' + runs.length;
      this.stats = st;
    }
  }

  DN.corridors = { Corridors, STATI, NODI };

})(window.DN = window.DN || {});
