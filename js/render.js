/* =====================================================================
   RENDER — tavola a matrice (Canvas 2D), segno leggero, zoomabile.
   Il suolo è un pattern rado di piccoli segni ripetuti, come nelle tavole
   di riferimento: freccia-albero = bosco, puntinato = arbusteto, triangolo
   = roccia, tinta grigia piatta = abitato, vuoto = prateria e pascolo.
   Sopra: la presenza umana è una tinta grigia, la presenza dei lupi un
   contorno tratteggiato con puntinatura, i conflitti piccoli segni rossi
   (l'unico colore), più fitti dove il conflitto è più intenso.

   Vista: schermo = (ox, oy) + mappa × k, con k in px per cella.
   I segni hanno una grandezza costante sullo schermo: avvicinandosi il
   pattern si infittisce invece di ingrandirsi.
   La tavola si ridisegna solo quando qualcosa cambia; durante zoom e
   trascinamento la base si sposta come immagine e si ridisegna nitida
   appena il gesto si ferma.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const K = DN.territory.K;

  const PAL = {
    carta: '#FFFFFF',        // pagina (come --carta nel CSS)
    foglio: '#FFFFFF',       // fondo della tavola
    inchiostro: '#1B1C1D',
    inchiostro2: '#4A4D50',
    inchiostro3: '#8A8D90',
    tinta: '#E6E6E2',        // presenza umana
    tintaScura: '#D2D2CD',   // abitato
    acqua: '#5F7F96',
    acquaTinta: '#E1E8EC',
    accento: '#FF0000',      // lo stesso rosso dei cursori (--rosso nel CSS)
    lupo: '#1B1C1D',
    umano: '#1B1C1D'
  };
  const FONT = '"Newsreader", "Libre Caslon Text", Georgia, serif';
  const SEGNO_MAX = 9;        // lato massimo (px) di un segno della matrice
  const ZOOM_MAX = 4;         // rispetto alla vista che riempie la sezione (una cella = 120 m)
  const PASSO_PATTERN = 11;   // lato (px) della griglia virtuale su cui si dispone il pattern

  /* ---------------- segni della matrice ----------------------------------
     add(p, x, y, u, bi, bj, cella): u = grandezza del segno (px),
     cella = lato della cella (px), usato per lo spostamento casuale. */
  function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  const jit = (h, s, a) => (((h >>> s) & 255) / 255 - 0.5) * a;
  const tinta = (colore) => ({
    modo: 'tinta', colore, mostra: () => true,
    add(p, x, y, u) { p.rect(x - u / 2, y - u / 2, u + 0.6, u + 0.6); }
  });
  const SIMBOLI = {
    // freccia-albero: una ogni quattro posizioni della griglia del pattern
    [K.BOSCO]: {
      nome: 'bosco', modo: 'stroke', alpha: 0.6, lw: (u) => U.clamp(u * 0.075, 0.5, 1.1),
      mostra: (i, j) => j % 2 === 0 && (i + (j >> 1)) % 2 === 0,
      add(p, x, y, u, bi, bj, cella) {
        const c = cella || u, h = hash(bi, bj), cx = x + jit(h, 0, c * 0.5), cy = y + jit(h, 8, c * 0.5);
        const top = cy - u * 0.55, bot = cy + u * 0.45, a = u * 0.2;
        p.moveTo(cx, bot); p.lineTo(cx, top);
        p.moveTo(cx - a, top + a * 1.1); p.lineTo(cx, top); p.lineTo(cx + a, top + a * 1.1);
      }
    },
    // puntinato: un punto per cella
    [K.ARBUSTO]: {
      nome: 'arbusteto', modo: 'fill', alpha: 0.55,
      mostra: () => true,
      add(p, x, y, u, bi, bj, cella) {
        const c = cella || u, h = hash(bi, bj), r = U.clamp(u * 0.075, 0.45, 1.1);
        const px = x + jit(h, 0, c * 0.6), py = y + jit(h, 8, c * 0.6);
        p.moveTo(px + r, py); p.arc(px, py, r, 0, Math.PI * 2);
      }
    },
    // piccoli triangoli
    [K.ROCCIA]: {
      nome: 'roccia', modo: 'stroke', alpha: 0.5, lw: (u) => U.clamp(u * 0.07, 0.5, 1),
      mostra: (i, j) => i % 2 === 0 && j % 2 === 0,
      add(p, x, y, u, bi, bj, cella) {
        const c = cella || u, h = hash(bi, bj), cx = x + jit(h, 0, c * 0.4), cy = y + jit(h, 8, c * 0.4), r = u * 0.32;
        p.moveTo(cx, cy - r); p.lineTo(cx + r * 0.87, cy + r * 0.5); p.lineTo(cx - r * 0.87, cy + r * 0.5); p.closePath();
      }
    },
    [K.ABITATO]: Object.assign({ nome: 'abitato' }, tinta(PAL.tintaScura)),
    [K.ACQUA]: Object.assign({ nome: 'acqua' }, tinta(PAL.acquaTinta))
  };
  const ORDINE_SUOLO = [K.ACQUA, K.ABITATO, K.ARBUSTO, K.ROCCIA, K.BOSCO];

  /* marching squares su un campo per celle (centri), restituisce segmenti */
  function isolinea(F, W, H, L) {
    const segs = [];
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const a = F[y * W + x], b = F[y * W + x + 1], c = F[(y + 1) * W + x + 1], d = F[(y + 1) * W + x];
        const code = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const ix = (va, vb) => (L - va) / (vb - va);
        const top = [x + ix(a, b), y], right = [x + 1, y + ix(b, c)];
        const bottom = [x + ix(d, c), y + 1], left = [x, y + ix(a, d)];
        const push = (p, q) => segs.push(p[0] + 0.5, p[1] + 0.5, q[0] + 0.5, q[1] + 0.5);
        switch (code) {
          case 1: case 14: push(left, bottom); break;
          case 2: case 13: push(bottom, right); break;
          case 3: case 12: push(left, right); break;
          case 4: case 11: push(top, right); break;
          case 5: push(left, top); push(bottom, right); break;
          case 6: case 9: push(top, bottom); break;
          case 7: case 8: push(left, top); break;
          case 10: push(top, right); push(left, bottom); break;
        }
      }
    }
    return segs;
  }

  class Renderer {
    constructor(canvas, territory, corridors, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.T = territory;
      this.Co = corridors;
      this.cfg = cfg;
      this.D = territory.dati;
      this.layers = {};
      cfg.LIVELLI.forEach((l) => { this.layers[l.id] = l.on; });
      this.hover = null;
      this.onView = null;           // richiamata a ogni cambio di vista (scala grafica)
      this.cache = document.createElement('canvas');
      this.cacheKey = '';
      this.cacheView = null;
      this._drawKey = '';
      const W = territory.W, H = territory.H;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      this.campoUmano = { c, g, img: g.createImageData(W, H) };
      this.campiKey = '';
      this.k = 1; this.ox = 0; this.oy = 0;
      this.resize();
    }

    setLayer(id, on) { this.layers[id] = on; this.cacheKey = ''; this._drawKey = ''; }

    /* ---------------- vista ---------------------------------------------- */
    _limiti() {
      const W = this.T.W, H = this.T.H;
      this.kIntera = Math.min(this.cw / W, this.ch / H);     // tutta la tavola visibile
      this.kAdatta = Math.max(this.cw / W, this.ch / H);     // la tavola riempie la sezione
      this.kMin = this.kIntera;
      this.kMax = this.kAdatta * ZOOM_MAX;
    }

    _blocca() {
      const W = this.T.W, H = this.T.H;
      this.k = U.clamp(this.k, this.kMin, this.kMax);
      const w = W * this.k, h = H * this.k;
      this.ox = w <= this.cw ? (this.cw - w) / 2 : U.clamp(this.ox, this.cw - w, 0);
      this.oy = h <= this.ch ? (this.ch - h) / 2 : U.clamp(this.oy, this.ch - h, 0);
    }

    _cambiata() {
      this._drawKey = '';
      // la base si ridisegna nitida quando il gesto si ferma
      clearTimeout(this._tBase);
      this._tBase = setTimeout(() => { this.cacheKey = ''; this._drawKey = ''; }, 140);
      if (this.onView) this.onView(this);
    }

    /* mostra la tavola: 'adatta' riempie la sezione, 'intera' la mostra tutta */
    inquadra(modo, centro) {
      this._limiti();
      this.k = modo === 'intera' ? this.kIntera : this.kAdatta;
      const [cx, cy] = centro || [this.T.W / 2, this.T.H / 2];
      this.ox = this.cw / 2 - cx * this.k;
      this.oy = this.ch / 2 - cy * this.k;
      this._blocca();
      this._cambiata();
    }

    zoomA(f, sx, sy) {
      const nk = U.clamp(this.k * f, this.kMin, this.kMax);
      if (sx === undefined) { sx = this.cw / 2; sy = this.ch / 2; }
      this.ox = sx - (sx - this.ox) * nk / this.k;
      this.oy = sy - (sy - this.oy) * nk / this.k;
      this.k = nk;
      this._blocca();
      this._cambiata();
    }

    sposta(dx, dy) {
      this.ox += dx; this.oy += dy;
      this._blocca();
      this._cambiata();
    }

    get zoomRelativo() { return this.k / this.kAdatta; }

    resize() {
      const c = this.canvas, parent = c.parentElement;
      const r = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // centro e zoom relativo restano gli stessi dopo un ridimensionamento
      const centro = this.cw ? [(this.cw / 2 - this.ox) / this.k, (this.ch / 2 - this.oy) / this.k] : null;
      const rel = this.cw ? this.zoomRelativo : null;
      this.dpr = dpr;
      this.cw = Math.max(200, r.width); this.ch = Math.max(120, r.height);
      c.width = Math.round(this.cw * dpr); c.height = Math.round(this.ch * dpr);
      c.style.width = this.cw + 'px'; c.style.height = this.ch + 'px';
      this.cache.width = c.width; this.cache.height = c.height;
      this.cacheKey = ''; this.cacheView = null;
      if (!centro) { this.inquadra('adatta'); return; }
      this._limiti();
      this.k = this.kAdatta * rel;
      this.ox = this.cw / 2 - centro[0] * this.k;
      this.oy = this.ch / 2 - centro[1] * this.k;
      this._blocca();
      this._drawKey = '';
      if (this.onView) this.onView(this);
    }

    toMap(mx, my) { return [(mx - this.ox) / this.k, (my - this.oy) / this.k]; }
    toScreen(x, y) { return [this.ox + x * this.k, this.oy + y * this.k]; }

    /* ---------------- base in cache: solo la parte visibile -------------- */
    _disegnaBase() {
      const g = this.cache.getContext('2d'), T = this.T, W = T.W, H = T.H, k = this.k, dpr = this.dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = PAL.carta; g.fillRect(0, 0, this.cw, this.ch);
      g.save();
      g.translate(this.ox, this.oy);
      g.beginPath(); g.rect(0, 0, W * k, H * k); g.clip();
      g.fillStyle = PAL.foglio; g.fillRect(0, 0, W * k, H * k);

      // celle visibili
      const i0 = Math.max(0, Math.floor(-this.ox / k) - 1), i1 = Math.min(W - 1, Math.ceil((this.cw - this.ox) / k) + 1);
      const j0 = Math.max(0, Math.floor(-this.oy / k) - 1), j1 = Math.min(H - 1, Math.ceil((this.ch - this.oy) / k) + 1);
      const su = Math.min(k, SEGNO_MAX);
      // da vicino ogni cella si divide in sotto-celle: il pattern resta della stessa densità sullo schermo
      const sub = Math.max(1, Math.round(k / PASSO_PATTERN)), ks = k / sub;

      const paths = {};
      if (this.layers.suolo) {
        ORDINE_SUOLO.forEach((c) => { paths[c] = new Path2D(); });
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const c = T.cls[j * W + i], s = SIMBOLI[c];
            if (!s) continue;
            if (s.modo === 'tinta') { s.add(paths[c], (i + 0.5) * k, (j + 0.5) * k, k); continue; }
            for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) {
              const I = i * sub + a, J = j * sub + b;
              if (!s.mostra(I, J)) continue;
              s.add(paths[c], i * k + (a + 0.5) * ks, j * k + (b + 0.5) * ks, su, I, J, ks);
            }
          }
        }
        ORDINE_SUOLO.forEach((c) => {
          const s = SIMBOLI[c];
          if (s.modo === 'tinta') { g.fillStyle = s.colore; g.fill(paths[c]); }
        });
      }

      if (this.layers.rilievo) {
        g.lineJoin = 'round'; g.lineCap = 'round';
        [0, 1].forEach((m) => {
          g.beginPath();
          this.D.isoipse.forEach((l) => {
            if (l.m !== m) return;
            const p = l.p;
            g.moveTo(p[0] * k, p[1] * k);
            for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k);
          });
          g.strokeStyle = m ? 'rgba(27,28,29,0.22)' : 'rgba(27,28,29,0.1)';
          g.lineWidth = m ? 0.6 : 0.45;
          g.stroke();
        });
      }

      if (this.layers.suolo) {
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = g.fillStyle = PAL.inchiostro;
        ORDINE_SUOLO.forEach((c) => {
          const s = SIMBOLI[c];
          if (s.modo === 'tinta') return;
          g.globalAlpha = s.alpha;
          if (s.modo === 'fill') g.fill(paths[c]); else { g.lineWidth = s.lw(su); g.stroke(paths[c]); }
        });
        g.globalAlpha = 1;
      }

      if (this.layers.rilievo) {
        g.strokeStyle = PAL.acqua; g.lineCap = 'round'; g.lineJoin = 'round';
        [0, 1].forEach((n) => {
          g.beginPath();
          this.D.acque.forEach((l) => {
            if (l.n !== n) return;
            const p = l.p;
            g.moveTo(p[0] * k, p[1] * k);
            for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k);
          });
          g.globalAlpha = n ? 0.7 : 0.45;
          g.lineWidth = n ? 0.9 : 0.6;
          g.stroke();
        });
        g.globalAlpha = 1;
      }
      g.restore();
      // bordo della tavola, solo se si vede
      if (W * k < this.cw - 1 || H * k < this.ch - 1) {
        g.strokeStyle = PAL.inchiostro3; g.lineWidth = 0.75;
        g.strokeRect(this.ox + 0.5, this.oy + 0.5, W * k - 1, H * k - 1);
      }
      this.cacheView = { k, ox: this.ox, oy: this.oy };
    }

    /* ---------------- presenze e conflitti ------------------------------- */
    _aggiornaCampi() {
      const T = this.T, N = T.N, W = T.W, H = T.H, k = this.k;
      const d = this.campoUmano.img.data;
      for (let i = 0; i < N; i++) {
        d[i * 4] = 150; d[i * 4 + 1] = 151; d[i * 4 + 2] = 146;
        d[i * 4 + 3] = Math.round(Math.min(1, T.umano[i]) * 40);
      }
      this.campoUmano.g.putImageData(this.campoUmano.img, 0, 0);

      // grandezze in px sullo schermo, convertite in celle
      const fitto = k >= 2 * SEGNO_MAX;
      const rLupo = Math.min(0.09, 1 / k), rCerchio = Math.min(0.3, 2.6 / k), rPunto = Math.min(0.16, 1.5 / k);
      const rCroce = Math.min(0.24, 2.4 / k), lPres = Math.min(0.44, 4.5 / k);

      // puntinatura a scacchiera su una griglia virtuale di ~11 px, come il pattern del suolo
      const sub = Math.max(1, Math.round(k / PASSO_PATTERN));
      const P = T.presenza, dots = new Path2D();
      for (let i = 0; i < N; i++) {
        if (P[i] < 0.5) continue;
        const x = i % W, y = (i / W) | 0;
        for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) {
          if ((x * sub + a + y * sub + b) % 2) continue;
          const cx = x + (a + 0.5) / sub, cy = y + (b + 0.5) / sub;
          dots.moveTo(cx + rLupo, cy); dots.arc(cx, cy, rLupo, 0, Math.PI * 2);
        }
      }
      this.puntiLupo = dots;
      this.contornoLupo = isolinea(P, W, H, 0.5);

      const CF = DN.territory.CONFLITTO, soglia = this.cfg.TERRITORIO.SOGLIA_CONFLITTO;
      const cerchi = new Path2D(), punti = new Path2D(), croci = new Path2D(), presidi = new Path2D();
      for (let i = 0; i < N; i++) {
        const tp = T.tipoConflitto[i];
        if (!tp) continue;
        const x = i % W, y = (i / W) | 0, cx = x + 0.5, cy = y + 0.5;
        if (tp === CF.PRESIDIO) {
          if (fitto ? (x + y) % 2 === 0 : (x + 2 * y) % 4 === 0) presidi.rect(cx - lPres / 2, cy - lPres / 2, lPres, lPres);
          continue;
        }
        const c = T.conflitto[i];
        if (c < soglia || (!fitto && (x + y) % 2)) continue;
        if (U.hash2(x, y, 11) > 0.25 + 0.75 * Math.min(1, c)) continue;
        if (tp === CF.PREDAZIONE) { cerchi.moveTo(cx + rCerchio, cy); cerchi.arc(cx, cy, rCerchio, 0, Math.PI * 2); }
        else if (tp === CF.MARGINE) { punti.moveTo(cx + rPunto, cy); punti.arc(cx, cy, rPunto, 0, Math.PI * 2); }
        else if (tp === CF.TRAPPOLA) {
          croci.moveTo(cx - rCroce, cy - rCroce); croci.lineTo(cx + rCroce, cy + rCroce);
          croci.moveTo(cx + rCroce, cy - rCroce); croci.lineTo(cx - rCroce, cy + rCroce);
        }
      }
      this.conflitti = { cerchi, punti, croci, presidi };
    }

    hit(mx, my) {
      const [x, y] = this.toMap(mx, my);
      const T = this.T, r = (px) => px / this.k;
      if (x < 0 || y < 0 || x >= T.W || y >= T.H) return null;
      if (this.layers.corridoi) {
        let best = null, bd = Math.max(r(12), 0.8);
        this.Co.nodi.forEach((n) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
        if (best) return { tipo: 'nodo', n: best };
      }
      if (this.layers.documentati) {
        let best = null, bd = Math.max(r(12), 0.8);
        this.D.conflittiDocumentati.forEach((n) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
        if (best) return { tipo: 'documentato', n: best };
      }
      let malga = null, md = Math.max(r(8), 0.6);
      T.malghe.forEach((m) => { const d = Math.hypot(m.x - x, m.y - y); if (d < md) { md = d; malga = m; } });
      let luogo = null, ld = Math.max(r(26), 1.5);
      this.D.luoghi.forEach((l) => { const d = Math.hypot(l.x - x, l.y - y); if (d < ld) { ld = d; luogo = l; } });
      return { tipo: 'cella', i: Math.floor(y) * T.W + Math.floor(x), malga, luogo };
    }

    /* ---------------------------------------------------------------- */
    draw(t, sim, v) {
      const T = this.T;
      const hn = this.hover && this.hover.n;
      const vista = this.k.toFixed(3) + ',' + this.ox.toFixed(1) + ',' + this.oy.toFixed(1);
      const dk = T.version + ':' + T.presVersion + ':' + this.Co.version + ':' + (hn ? hn.x + ',' + hn.y : '') + ':' +
        Math.round(v.fareBranco / 10) + ':' + vista + ':' + this.cacheKey;
      if (dk === this._drawKey) return;

      const ctx = this.ctx, dpr = this.dpr, k = this.k;
      const key = T.version + ':' + Object.values(this.layers).join('');
      if (key !== this.cacheKey || !this.cacheView) { this._disegnaBase(); this.cacheKey = key; }
      const ck = T.presVersion + ':' + Math.round(Math.log2(k) * 4);
      if (ck !== this.campiKey) { this._aggiornaCampi(); this.campiKey = ck; }
      this._drawKey = T.version + ':' + T.presVersion + ':' + this.Co.version + ':' + (hn ? hn.x + ',' + hn.y : '') + ':' +
        Math.round(v.fareBranco / 10) + ':' + vista + ':' + this.cacheKey;

      // base: se la vista è cambiata dall'ultimo disegno, la si sposta come immagine
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cv = this.cacheView;
      if (cv.k === k && cv.ox === this.ox && cv.oy === this.oy) ctx.drawImage(this.cache, 0, 0);
      else {
        const s = k / cv.k;
        ctx.fillStyle = PAL.carta; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(this.cache, dpr * (this.ox - cv.ox * s), dpr * (this.oy - cv.oy * s), this.cache.width * s, this.cache.height * s);
      }

      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * this.ox, dpr * this.oy);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, T.W, T.H); ctx.clip();
      const px = 1 / k;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;

      if (this.layers.umano) ctx.drawImage(this.campoUmano.c, 0, 0, T.W, T.H);
      if (this.layers.lupo) {
        ctx.globalAlpha = 0.55; ctx.fillStyle = PAL.inchiostro; ctx.fill(this.puntiLupo); ctx.globalAlpha = 1;
        const fb = v.fareBranco / 100, segs = this.contornoLupo;
        ctx.beginPath();
        for (let i = 0; i < segs.length; i += 4) { ctx.moveTo(segs[i], segs[i + 1]); ctx.lineTo(segs[i + 2], segs[i + 3]); }
        // FARE BRANCO alto: tratto lungo; basso: tratto corto, presenza frammentata
        ctx.setLineDash([(2.5 + 5 * fb) * px, 3 * px]);
        ctx.strokeStyle = 'rgba(27,28,29,0.8)'; ctx.lineWidth = 0.8 * px; ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.layers.conflitti) this._conflitti(ctx, px);
      if (this.layers.viabilita) this._viabilita(ctx, px);
      if (this.layers.corridoi) this._corridoi(ctx, px);
      if (this.layers.rilievo) this._luoghi(ctx, px);
      this._malghe(ctx, px);
      if (this.layers.documentati) this._documentati(ctx, px);
      if (this.layers.corridoi) this._nodi(ctx, px);
      ctx.restore();
    }

    _conflitti(ctx, px) {
      const c = this.conflitti;
      ctx.strokeStyle = PAL.accento; ctx.fillStyle = PAL.accento;
      ctx.lineWidth = 0.8 * px; ctx.stroke(c.cerchi);
      ctx.fill(c.punti);
      ctx.lineWidth = 0.9 * px; ctx.stroke(c.croci);
      ctx.strokeStyle = 'rgba(27,28,29,0.6)'; ctx.lineWidth = 0.6 * px; ctx.stroke(c.presidi);
    }

    _linea(ctx, p) {
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    }

    _viabilita(ctx, px) {
      const T = this.T;
      ctx.beginPath();
      this.D.sentieri.forEach((p) => this._linea(ctx, p));
      ctx.setLineDash([4.5 * px, 3.5 * px]);
      ctx.strokeStyle = 'rgba(27,28,29,0.4)'; ctx.lineWidth = 0.6 * px; ctx.stroke();
      ctx.beginPath();
      T.strade.forEach((s) => { if (!s.aperta) this._linea(ctx, s.p); });
      ctx.setLineDash([2 * px, 4 * px]);
      ctx.strokeStyle = 'rgba(27,28,29,0.25)'; ctx.lineWidth = 0.6 * px; ctx.stroke();
      ctx.setLineDash([]);
      [3, 2, 1].forEach((r) => {
        ctx.beginPath();
        T.strade.forEach((s) => { if (s.aperta && s.r === r) this._linea(ctx, s.p); });
        if (r === 3) { ctx.strokeStyle = 'rgba(27,28,29,0.5)'; ctx.lineWidth = 0.6 * px; ctx.stroke(); return; }
        if (r === 2) { ctx.strokeStyle = 'rgba(27,28,29,0.8)'; ctx.lineWidth = 0.9 * px; ctx.stroke(); return; }
        ctx.strokeStyle = PAL.inchiostro; ctx.lineWidth = 2.6 * px; ctx.stroke();
        ctx.strokeStyle = PAL.foglio; ctx.lineWidth = 1.2 * px; ctx.stroke();
      });
    }

    _corridoi(ctx, px) {
      const ink = PAL.inchiostro;
      this.Co.percorsi.forEach((p) => {
        if (!p.disegna) return;
        const pts = p.pts;
        const poly = (a, b) => {
          ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]);
          for (let i = a + 1; i < b; i++) {
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
          }
          ctx.lineTo(pts[b][0], pts[b][1]);
        };
        p.tratti.forEach((tr) => {
          if (tr.stato === 'interrotto') return;
          poly(Math.max(0, tr.da - 1), Math.min(pts.length - 1, tr.a + 1));
          ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3 * px; ctx.stroke();
        });
        const passo = Math.max(1, Math.round(14 * px));   // un segno ogni ~14 px
        p.tratti.forEach((tr) => {
          const a = Math.max(0, tr.da - 1), b = Math.min(pts.length - 1, tr.a + 1);
          if (tr.stato === 'interrotto') {
            const m = Math.floor((tr.da + tr.a) / 2);
            const q = pts[Math.min(pts.length - 1, m + 1)], o = pts[Math.max(0, m - 1)];
            const dir = Math.atan2(q[1] - o[1], q[0] - o[0]), per = dir + Math.PI / 2;
            ctx.beginPath();
            [-2.2, 2.2].forEach((off) => {
              const bx = pts[m][0] + Math.cos(dir) * off * px, by = pts[m][1] + Math.sin(dir) * off * px;
              ctx.moveTo(bx - Math.cos(per) * 7 * px, by - Math.sin(per) * 7 * px);
              ctx.lineTo(bx + Math.cos(per) * 7 * px, by + Math.sin(per) * 7 * px);
            });
            ctx.strokeStyle = PAL.accento; ctx.lineWidth = 1 * px; ctx.stroke();
            return;
          }
          poly(a, b);
          ctx.lineWidth = 1.1 * px;
          if (tr.stato === 'tollerato') {
            ctx.setLineDash([6 * px, 4.5 * px]); ctx.strokeStyle = ink; ctx.stroke(); ctx.setLineDash([]);
          } else if (tr.stato === 'conteso') {
            ctx.strokeStyle = PAL.accento; ctx.stroke();
          } else {
            ctx.strokeStyle = ink; ctx.stroke();
            if (tr.stato === 'trappola') {
              ctx.beginPath();
              const r = 2.6 * px;
              for (let i = tr.da; i <= tr.a; i += passo) {
                const [x, y] = pts[i];
                ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
                ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
              }
              ctx.strokeStyle = PAL.accento; ctx.lineWidth = 0.9 * px; ctx.stroke();
            }
          }
        });
        const e = pts[pts.length - 1], f = pts[Math.max(0, pts.length - 4)];
        const ang = Math.atan2(e[1] - f[1], e[0] - f[0]), l = 8 * px;
        ctx.beginPath();
        ctx.moveTo(e[0] + Math.cos(ang - 2.6) * l, e[1] + Math.sin(ang - 2.6) * l);
        ctx.lineTo(e[0], e[1]);
        ctx.lineTo(e[0] + Math.cos(ang + 2.6) * l, e[1] + Math.sin(ang + 2.6) * l);
        ctx.strokeStyle = ink; ctx.lineWidth = 1 * px; ctx.stroke();
      });
    }

    _luoghi(ctx, px) {
      ctx.fillStyle = PAL.inchiostro;
      ctx.globalAlpha = 0.45;
      const h = 1.1 * px;
      this.D.luoghi.forEach((l) => { if (l.tipo === 'hamlet') ctx.fillRect(l.x - h, l.y - h, 2 * h, 2 * h); });
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      const sp = 'letterSpacing' in ctx;
      // da vicino compaiono anche i nomi delle contrade
      if (this.k >= 22) {
        ctx.font = `italic 400 ${10 * px}px ${FONT}`;
        if (sp) ctx.letterSpacing = '0px';
        this.D.luoghi.forEach((l) => {
          if (l.tipo !== 'hamlet') return;
          ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeText(l.nome, l.x, l.y - 9 * px);
          ctx.fillStyle = PAL.inchiostro2; ctx.fillText(l.nome, l.x, l.y - 9 * px);
        });
      }
      ctx.font = `500 ${10.5 * px}px ${FONT}`;
      if (sp) ctx.letterSpacing = (1.4 * px) + 'px';
      this.D.luoghi.forEach((l) => {
        if (l.tipo === 'hamlet') return;
        const txt = l.nome.toUpperCase();
        ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(txt, l.x, l.y - 14 * px);
        ctx.fillStyle = PAL.inchiostro; ctx.fillText(txt, l.x, l.y - 14 * px);
      });
      if (sp) ctx.letterSpacing = '0px';
    }

    _malghe(ctx, px) {
      const T = this.T, h = 2.2 * px;
      T.malghe.forEach((m) => {
        const attiva = T.dPascolo && T.dPascolo[m.idx] <= 1.5;
        ctx.beginPath(); ctx.rect(m.x - h, m.y - h, 2 * h, 2 * h);
        if (attiva) { ctx.fillStyle = PAL.inchiostro; ctx.fill(); }
        else { ctx.strokeStyle = PAL.inchiostro3; ctx.lineWidth = 0.7 * px; ctx.stroke(); }
      });
      // da vicino, i nomi delle malghe
      if (this.k >= 30) {
        ctx.font = `400 ${9.5 * px}px ${FONT}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        T.malghe.forEach((m) => {
          if (!m.nome) return;
          ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeText(m.nome, m.x + 5 * px, m.y);
          ctx.fillStyle = PAL.inchiostro2; ctx.fillText(m.nome, m.x + 5 * px, m.y);
        });
      }
    }

    /* predazioni documentate per malga (dato reale, non simulato) */
    _documentati(ctx, px) {
      ctx.font = `italic 400 ${10 * px}px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      this.D.conflittiDocumentati.forEach((n) => {
        const r = (4 + Math.sqrt(n.eventi) * 0.75) * px;
        const hov = this.hover && this.hover.n === n;
        ctx.beginPath(); ctx.rect(n.x - r, n.y - r, 2 * r, 2 * r);
        ctx.fillStyle = PAL.foglio; ctx.fill();
        ctx.strokeStyle = PAL.accento; ctx.lineWidth = (hov ? 1.6 : 0.9) * px; ctx.stroke();
        const q = 1.1 * px;
        ctx.beginPath(); ctx.rect(n.x - q, n.y - q, 2 * q, 2 * q); ctx.fillStyle = PAL.accento; ctx.fill();
        const txt = String(n.eventi);
        ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(txt, n.x + r + 3 * px, n.y);
        ctx.fillStyle = PAL.accento; ctx.fillText(txt, n.x + r + 3 * px, n.y);
      });
    }

    _nodi(ctx, px) {
      this.Co.nodi.forEach((n) => {
        const hov = this.hover && this.hover.n === n;
        const r = (hov ? 8.5 : 6) * px;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        if (n.conflitto) {
          ctx.fillStyle = PAL.accento; ctx.fill();
          ctx.strokeStyle = PAL.foglio; ctx.lineWidth = 1 * px; ctx.stroke();
        } else {
          ctx.fillStyle = PAL.foglio; ctx.fill();
          ctx.strokeStyle = PAL.inchiostro; ctx.lineWidth = 0.9 * px; ctx.stroke();
          ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.32, 0, Math.PI * 2);
          ctx.fillStyle = PAL.inchiostro; ctx.fill();
        }
      });
    }
  }

  DN.render = { Renderer, PAL, SIMBOLI, FONT };

})(window.DN = window.DN || {});
