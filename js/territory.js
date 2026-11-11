/* =====================================================================
   TERRITORY — la tavola a matrice della Lessinia e le presenze.
   Base: griglia reale (data/lessinia.js) con la classe di copertura di
   ogni cella (OpenStreetMap). Sopra, il territorio cambia con gli slider:
   - ALLEVARE: i pascoli lontani dalle malghe si abbandonano (diventano
     arbusteto) o, al contrario, il pascolo si allarga attorno alle malghe;
   - COSTRUIRE: i paesi crescono lungo le strade, le strade locali si aprono
     o si chiudono;
   - presenza del lupo: un campo continuo (bosco, quiete, distanza da paesi
     e strade, richiamo dei pascoli) di cui si mostra la parte più alta;
   - presenza umana: paesi, strade aperte, pascoli attivi;
   - zone di conflitto: dove le due presenze si sovrappongono.
   Gli animali non sono disegnati: si vedono solo le loro presenze.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;

  const K = { VUOTO: 0, BOSCO: 1, PRATERIA: 2, ARBUSTO: 3, ROCCIA: 4, ABITATO: 5, ACQUA: 6 };
  const NOMI = ['senza dato', 'bosco', 'prateria, pascolo', 'arbusteto', 'roccia', 'paesi e contrade', 'acqua'];
  const CHIAVI = ['vuoto', 'bosco', 'prateria', 'arbusto', 'roccia', 'abitato', 'acqua'];
  // idoneità per il lupo per classe: bosco e arbusteto offrono rifugio
  const IDONEITA = [0.55, 1.0, 0.35, 0.85, 0.4, 0, 0.2];
  // tipi di conflitto
  const CONFLITTO = { NESSUNO: 0, PREDAZIONE: 1, MARGINE: 2, TRAPPOLA: 3, PRESIDIO: 4 };

  function boxBlur(src, W, H, r) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < H; y++) {
      let s = 0, n = 0;
      for (let x = -r; x <= r; x++) if (x >= 0 && x < W) { s += src[y * W + x]; n++; }
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = s / n;
        const a = x - r, b = x + r + 1;
        if (a >= 0) { s -= src[y * W + a]; n--; }
        if (b < W) { s += src[y * W + b]; n++; }
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let y = -r; y <= r; y++) if (y >= 0 && y < H) { s += tmp[y * W + x]; n++; }
      for (let y = 0; y < H; y++) {
        out[y * W + x] = s / n;
        const a = y - r, b = y + r + 1;
        if (a >= 0) { s -= tmp[a * W + x]; n--; }
        if (b < H) { s += tmp[b * W + x]; n++; }
      }
    }
    return out;
  }

  class Territory {
    constructor(cfg, dati) {
      this.cfg = cfg;
      this.dati = dati;
      const m = dati.meta;
      const W = this.W = m.nx, H = this.H = m.ny, N = this.N = W * H;
      this.cellaM = m.cella_m;
      this.base = new Uint8Array(N);
      for (let i = 0; i < N; i++) this.base[i] = dati.classi.charCodeAt(i) - 48;
      this.cls = new Uint8Array(this.base);
      this.cambio = new Float32Array(N).fill(-1e9);   // istante dell'ultimo cambio di classe
      this.noise = U.makeNoise2D(4242);

      // --- strade: celle toccate da ciascun tratto -------------------------
      this.strade = dati.strade.map((s) => ({ r: s.r, p: s.p, celle: this._rasterLinea(s.p), aperta: true }));
      const isAb = (i) => this.base[i] === K.ABITATO;
      const dAbBase = U.distanceField(W, H, isAb, 999);
      // le strade locali più lontane dai paesi sono le prime a chiudersi
      const locali = this.strade.filter((s) => s.r === 3);
      locali.forEach((s) => { s.dist = Math.min.apply(null, s.celle.map((i) => dAbBase[i]).concat([999])); });
      locali.sort((a, b) => a.dist - b.dist).forEach((s, k) => { s.ordine = k; });
      this.localiTot = locali.length;

      // --- malghe ---------------------------------------------------------
      const malgaCella = new Uint8Array(N);
      this.malghe = dati.malghe.map((q) => {
        const i = this._idx(q.x, q.y);
        if (i >= 0) malgaCella[i] = 1;
        return Object.assign({ idx: i }, q);
      }).filter((q) => q.idx >= 0);
      this.dMalga = U.distanceField(W, H, (i) => malgaCella[i] === 1, 999);

      // --- ordine di abbandono: prima le praterie più lontane dalle malghe --
      const prat = [];
      for (let i = 0; i < N; i++) if (this.base[i] === K.PRATERIA) prat.push(i);
      const nz = (i) => U.fbm(this.noise, (i % W) * 0.15, ((i / W) | 0) * 0.15, 3);
      prat.sort((a, b) => (this.dMalga[b] + 6 * nz(b)) - (this.dMalga[a] + 6 * nz(a)));
      this.rankAbbandono = new Float32Array(N).fill(Infinity);
      prat.forEach((i, k) => { this.rankAbbandono[i] = k; });
      this.prateriaTot = prat.length;

      // --- ordine di espansione del pascolo: attorno alle malghe ------------
      const esp = [];
      for (let i = 0; i < N; i++) {
        const c = this.base[i];
        if ((c === K.ARBUSTO || c === K.VUOTO || c === K.BOSCO) && this.dMalga[i] < 16) {
          esp.push({ i, s: this.dMalga[i] + (c === K.BOSCO ? 5 : 0) + 4 * nz(i) });
        }
      }
      esp.sort((a, b) => a.s - b.s);
      this.rankEspansione = new Float32Array(N).fill(Infinity);
      esp.forEach((o, k) => { this.rankEspansione[o.i] = k; });
      this.espMax = Math.min(esp.length, Math.round(this.prateriaTot * cfg.TERRITORIO.ESPANSIONE_PASCOLO_MAX));

      // --- ordine di crescita dei paesi: vicino all'abitato e alle strade ---
      const stradaPrinc = new Uint8Array(N);
      this.strade.forEach((s) => { if (s.r <= 2) s.celle.forEach((i) => { stradaPrinc[i] = 1; }); });
      const dSP = U.distanceField(W, H, (i) => stradaPrinc[i] === 1, 999);
      const ab = [];
      let abBase = 0;
      for (let i = 0; i < N; i++) {
        if (this.base[i] === K.ABITATO) { abBase++; continue; }
        if (this.base[i] === K.ACQUA || dAbBase[i] > 9) continue;
        ab.push({ i, s: dAbBase[i] + 0.7 * dSP[i] + 2 * nz(i) });
      }
      ab.sort((a, b) => a.s - b.s);
      this.rankAbitato = new Float32Array(N).fill(Infinity);
      ab.forEach((o, k) => { this.rankAbitato[o.i] = k; });
      this.abitatoBase = abBase;
      this.abMax = Math.min(ab.length, Math.round(abBase * cfg.TERRITORIO.ABITATO_ESPANSIONE_MAX));

      // --- mete per i corridoi: punti sul bordo della mappa --------------------
      this.meteBordo = [];
      const pushBordo = (x, y) => { const i = y * W + x; if (this.base[i] !== K.ABITATO && this.base[i] !== K.ACQUA) this.meteBordo.push({ x: x + 0.5, y: y + 0.5, idx: i, bordo: true }); };
      for (let x = 6; x < W - 6; x += 16) { pushBordo(x, 0); pushBordo(x, H - 1); }
      for (let y = 8; y < H - 8; y += 16) { pushBordo(0, y); pushBordo(W - 1, y); }

      // --- campi che cambiano ----------------------------------------------
      this.stradaRango = new Uint8Array(N);
      this.presenza = new Float32Array(N);      // presenza del lupo 0..1 (morbida)
      this.maskLupo = new Uint8Array(N);
      this.zonaLupo = new Float32Array(N);      // presenza allargata (raggio d'azione)
      this.umano = new Float32Array(N);         // presenza umana 0..1
      this.conflitto = new Float32Array(N);
      this.tipoConflitto = new Uint8Array(N);
      this.counts = { abbandono: -1, espansione: -1, abitato: -1, locali: -1 };
      this.version = 0;
      this.presVersion = 0;
      this.t = 0;
      this.stats = {};
    }

    _idx(x, y) {
      const i = Math.floor(x), j = Math.floor(y);
      return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : j * this.W + i;
    }

    _rasterLinea(p) {
      const set = new Set();
      for (let k = 0; k < p.length - 2; k += 2) {
        const x0 = p[k], y0 = p[k + 1], x1 = p[k + 2], y1 = p[k + 3];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.3));
        for (let s = 0; s <= n; s++) {
          const i = this._idx(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n);
          if (i >= 0) set.add(i);
        }
      }
      return Array.from(set);
    }

    /* ----------------------------------------------------------------
       Aggiornamento per tick
       ---------------------------------------------------------------- */
    update(stato, v, dt) {
      const C = this.cfg.TERRITORIO;
      this.t += dt;
      const a = v.allevare, c = v.costruire;
      const target = {
        abbandono: a < C.PASCOLO_SOGLIA ? this.prateriaTot * C.ABBANDONO_MAX * (C.PASCOLO_SOGLIA - a) / C.PASCOLO_SOGLIA : 0,
        espansione: a > C.PASCOLO_SOGLIA ? this.espMax * (a - C.PASCOLO_SOGLIA) / (100 - C.PASCOLO_SOGLIA) : 0,
        abitato: c > C.ABITATO_SOGLIA ? this.abMax * (c - C.ABITATO_SOGLIA) / (100 - C.ABITATO_SOGLIA) : 0,
        locali: this.localiTot * (C.STRADE_LOCALI_MIN + (1 - C.STRADE_LOCALI_MIN) * c / 100)
      };
      const maxes = { abbandono: this.prateriaTot * C.ABBANDONO_MAX, espansione: this.espMax, abitato: this.abMax, locali: this.localiTot };
      let changed = false;
      for (const k in target) {
        if (this.counts[k] < 0) { this.counts[k] = target[k]; changed = true; continue; }
        const step = Math.max(0.5, maxes[k] * C.VELOCITA_TRANSIZIONE);
        const d = target[k] - this.counts[k];
        const nv = Math.abs(d) <= step ? target[k] : this.counts[k] + Math.sign(d) * step;
        if (Math.floor(nv) !== Math.floor(this.counts[k])) changed = true;
        this.counts[k] = nv;
      }
      if (changed) this._ricostruisci();
      // le presenze si ricalcolano solo quando cambia qualcosa che le muove
      const q = (x) => Math.round(x * 4);
      const pk = this.version + '|' + q(stato.territorio.lupi) + '|' +
        ['avvicinarsi', 'predare', 'proteggere', 'abbattere', 'fareBranco'].map((k) => q(v[k])).join(',');
      if (pk !== this._presKey) {
        this._presKey = pk;
        this._presenze(stato, v);
        this.presVersion++;
      }
    }

    _ricostruisci() {
      const N = this.N, W = this.W, H = this.H, cls = this.cls, base = this.base;
      const cAbb = Math.floor(this.counts.abbandono), cEsp = Math.floor(this.counts.espansione);
      const cAb = Math.floor(this.counts.abitato), cLoc = Math.floor(this.counts.locali);
      for (let i = 0; i < N; i++) {
        let k = base[i];
        if (k === K.PRATERIA && this.rankAbbandono[i] < cAbb) k = K.ARBUSTO;   // pascolo abbandonato
        if (this.rankEspansione[i] < cEsp) k = K.PRATERIA;                     // pascolo nuovo
        if (this.rankAbitato[i] < cAb) k = K.ABITATO;                          // paese che cresce
        if (k !== cls[i]) { cls[i] = k; this.cambio[i] = this.t; }
      }
      const sr = this.stradaRango;
      sr.fill(0);
      this.strade.forEach((s) => {
        s.aperta = s.r < 3 || s.ordine < cLoc;
        if (s.aperta) s.celle.forEach((i) => { if (!sr[i] || s.r < sr[i]) sr[i] = s.r; });
      });
      this.dAb = U.distanceField(W, H, (i) => cls[i] === K.ABITATO, 60);
      this.dStrada = U.distanceField(W, H, (i) => sr[i] > 0 && sr[i] <= 2, 60);
      this.dStradaTutte = U.distanceField(W, H, (i) => sr[i] > 0, 60);
      this.dPascolo = U.distanceField(W, H, (i) => cls[i] === K.PRATERIA, 60);
      const suit = new Float32Array(N);
      for (let i = 0; i < N; i++) suit[i] = IDONEITA[cls[i]];
      this.idoneita = boxBlur(suit, W, H, 2);
      this.version++;
    }

    /* presenza del lupo, presenza umana, conflitti */
    _presenze(stato, v) {
      const C = this.cfg.TERRITORIO, W = this.W, H = this.H, N = this.N, cls = this.cls;
      const avv = v.avvicinarsi / 100, pr = v.predare / 100, prot = v.proteggere / 100;
      const abb = v.abbattere / 100, fb = v.fareBranco / 100;
      const Ra = C.EVITA_PAESI_CELLE * (1 - 0.75 * avv) + 0.6;
      const Rr = C.EVITA_STRADE_CELLE * (1 - 0.6 * avv) + 0.4;
      // il richiamo dei pascoli: se il lupo preda il domestico e le greggi sono scoperte
      const richiamo = 0.45 * pr * (1 - 0.7 * prot);
      // FARE BRANCO basso: presenza frammentata (rumore fisso: la mappa non si muove da sola)
      const frag = (1 - fb) * 0.5;
      const campo = new Float32Array(N);
      const vals = [];
      for (let i = 0; i < N; i++) {
        const k = cls[i];
        if (k === K.ABITATO || k === K.ACQUA) { campo[i] = -1; continue; }
        const x = i % W, y = (i / W) | 0;
        let f = this.idoneita[i]
          * (1 - Math.exp(-this.dAb[i] / Ra))
          * (1 - 0.55 * Math.exp(-this.dStrada[i] / Rr));
        f += richiamo * Math.exp(-this.dPascolo[i] / 2.5);
        if (frag > 0) f += frag * (this.noise(x * 0.32, y * 0.32) - 0.5) * 2;
        campo[i] = f;
        vals.push(f);
      }
      // l'area mostrata dipende da quanti lupi ci sono (stato.territorio.lupi)
      const frac = C.PRESENZA_AREA_MIN + (C.PRESENZA_AREA_MAX - C.PRESENZA_AREA_MIN) * stato.territorio.lupi / 100;
      vals.sort((a, b) => a - b);
      const thr = vals[Math.max(0, Math.min(vals.length - 1, Math.floor(vals.length * (1 - frac))))];
      this.soglia = thr;
      this.campo = campo;
      const P = this.presenza, M = this.maskLupo;
      for (let i = 0; i < N; i++) {
        P[i] = campo[i] < 0 ? 0 : U.smoothstep(thr - 0.06, thr + 0.12, campo[i]);
        M[i] = campo[i] >= thr ? 1 : 0;
      }
      this.zonaLupo = boxBlur(P, W, H, 1);

      // presenza umana: paesi, pascoli attivi e (poco) le strade, sfumata di una cella
      // così una strada isolata non disegna un'area, mentre paesi e pascoli sì
      const um = new Float32Array(N), sr = this.stradaRango;
      for (let i = 0; i < N; i++) {
        let u = 0;
        if (cls[i] === K.ABITATO) u = 1;
        else if (cls[i] === K.PRATERIA) u = 0.6;
        if (sr[i]) u = Math.max(u, sr[i] === 1 ? 0.55 : sr[i] === 2 ? 0.4 : 0.2);
        um[i] = u;
      }
      this.umano = boxBlur(um, W, H, 1);
      const Um = this.umano;

      // conflitti: dove le due presenze si toccano
      const Cf = this.conflitto, Tc = this.tipoConflitto, Z = this.zonaLupo;
      let somma = 0, nCelle = 0;
      const conta = [0, 0, 0, 0, 0];
      for (let i = 0; i < N; i++) {
        const z = Z[i];
        let best = 0, tipo = 0;
        if (z > 0.02) {
          const pascolo = cls[i] === K.PRATERIA;
          const c1 = pascolo ? z * pr * (1 - prot) * 1.7 : 0;                         // predazione
          const c2 = z * Math.exp(-this.dAb[i] / 1.5) * avv * 1.3;                     // margine abitato
          const vic = Math.exp(-Math.min(this.dAb[i], this.dPascolo[i]) / 2);
          const c3 = abb > 0.5 ? z * vic * (abb - 0.5) * 1.5 : 0;                      // trappola
          if (c1 > best) { best = c1; tipo = CONFLITTO.PREDAZIONE; }
          if (c2 > best) { best = c2; tipo = CONFLITTO.MARGINE; }
          if (c3 > best) { best = c3; tipo = CONFLITTO.TRAPPOLA; }
          // pascolo presidiato dentro la zona del lupo: convivenza, non conflitto
          if (best < C.SOGLIA_CONFLITTO && pascolo && prot > 0.55 && z > 0.25) { tipo = CONFLITTO.PRESIDIO; best = z * prot; }
        }
        Cf[i] = Math.min(1, best);
        Tc[i] = tipo;
        if (tipo && tipo !== CONFLITTO.PRESIDIO && best >= C.SOGLIA_CONFLITTO) { somma += best; nCelle++; conta[tipo]++; }
        else if (tipo === CONFLITTO.PRESIDIO) conta[tipo]++;
      }
      let lupoCelle = 0, umanoCelle = 0;
      for (let i = 0; i < N; i++) { lupoCelle += M[i]; if (Um[i] > 0.3) umanoCelle++; }
      this.stats = {
        presenzaLupo: 100 * lupoCelle / N, presenzaUmana: 100 * umanoCelle / N,
        conflittoCelle: nCelle, predazione: conta[1], margine: conta[2], trappola: conta[3], presidio: conta[4],
        abbandonate: Math.floor(this.counts.abbandono), pascoloNuovo: Math.floor(this.counts.espansione),
        abitatoNuovo: Math.floor(this.counts.abitato), stradeLocali: Math.floor(this.counts.locali) + '/' + this.localiTot
      };
    }

    /* aree di presenza del lupo come gruppi connessi (per i corridoi) */
    gruppi(minCelle) {
      const W = this.W, H = this.H, N = this.N, M = this.maskLupo;
      const id = new Int16Array(N).fill(-1);
      const out = [];
      const stack = [];
      for (let s = 0; s < N; s++) {
        if (!M[s] || id[s] >= 0) continue;
        const g = out.length, celle = [];
        id[s] = g; stack.push(s);
        while (stack.length) {
          const c = stack.pop(); celle.push(c);
          const x = c % W, y = (c / W) | 0;
          if (x > 0 && M[c - 1] && id[c - 1] < 0) { id[c - 1] = g; stack.push(c - 1); }
          if (x < W - 1 && M[c + 1] && id[c + 1] < 0) { id[c + 1] = g; stack.push(c + 1); }
          if (y > 0 && M[c - W] && id[c - W] < 0) { id[c - W] = g; stack.push(c - W); }
          if (y < H - 1 && M[c + W] && id[c + W] < 0) { id[c + W] = g; stack.push(c + W); }
        }
        let sx = 0, sy = 0;
        celle.forEach((c) => { sx += c % W; sy += (c / W) | 0; });
        out.push({ id: g, celle, n: celle.length, x: sx / celle.length + 0.5, y: sy / celle.length + 0.5 });
      }
      const grandi = out.filter((g) => g.n >= (minCelle || 8)).sort((a, b) => b.n - a.n);
      // il centro del gruppo deve cadere dentro il gruppo: si usa la cella più vicina al baricentro
      grandi.forEach((g) => {
        let best = g.celle[0], bd = Infinity;
        g.celle.forEach((c) => { const d = Math.hypot((c % W) + 0.5 - g.x, ((c / W) | 0) + 0.5 - g.y); if (d < bd) { bd = d; best = c; } });
        g.idx = best; g.x = (best % W) + 0.5; g.y = ((best / W) | 0) + 0.5;
      });
      return { gruppi: grandi, id };
    }

    descriviCella(i) {
      const k = this.cls[i];
      const nomeBase = NOMI[k];
      let uso = nomeBase;
      if (k === K.ARBUSTO && this.base[i] === K.PRATERIA) uso = 'ex pascolo, arbusteto';
      else if (k === K.PRATERIA && this.base[i] !== K.PRATERIA) uso = 'pascolo nuovo';
      else if (k === K.ABITATO && this.base[i] !== K.ABITATO) uso = 'case nuove';
      return { uso, lupo: this.presenza[i], umano: this.umano[i], conflitto: this.conflitto[i], tipo: this.tipoConflitto[i], strada: this.stradaRango[i] };
    }

    percentuali() {
      const c = new Array(7).fill(0);
      for (let i = 0; i < this.N; i++) c[this.cls[i]]++;
      const out = {};
      CHIAVI.forEach((n, k) => { out[n] = 100 * c[k] / this.N; });
      return out;
    }
  }

  DN.territory = { Territory, K, NOMI, CHIAVI, CONFLITTO };

})(window.DN = window.DN || {});
