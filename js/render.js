/* =====================================================================
   RENDER — la tavola (Canvas 2D), nello stile di "reference interfaccia.png".
   Sotto: fondo bianco con il pattern del suolo (^^ bosco, // prateria)
   e le isoipse. Sopra, aree piene con bordo:
     - presenza di Canis lupus: beige,
     - presenza di Homo sapiens: grigio,
     - aree di conflitto: rosso con alone.
   Il pattern e le isoipse restano visibili dentro le aree, con un colore
   adatto al fondo (clip sulle aree).
   Poi: strade (doppia linea), sentieri, corridoi (doppio tratteggio beige,
   con // rossi se contesi e ▽ se trappola), pascoli (frecce), malghe
   attive (casetta), eventi della seduta (□ animale da allevamento ucciso,
   × Canis lupus ucciso), nomi dei paesi.

   Vista: schermo = (ox, oy) + mappa × k, con k in px per cella.
   I segni hanno una grandezza costante sullo schermo, misurata in "u":
   l'unità di disegno della pagina (1 u = 1 px del riferimento 2576×1449).
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const K = DN.territory.K;

  const PAL = {
    carta: '#FFFFFF',
    inchiostro: '#2E2A29',
    umano: '#ABAAA9',
    umanoBordo: '#6F6967',
    lupo: '#DFD7D3',
    lupoBordo: '#BDAA9F',
    rosso: '#EE4747',
    rossoChiaro: '#F5A3A3',
    strada: '#5B5351',
    corridoio: '#C3A595',
    patternBianco: 'rgba(70,70,70,0.5)',
    patternLupo: 'rgba(120,102,94,0.55)',
    patternUmano: 'rgba(255,255,255,0.42)',
    isoBianco: 'rgba(0,0,0,0.12)',
    isoLupo: 'rgba(255,255,255,0.6)',
    isoUmano: 'rgba(255,255,255,0.3)'
  };
  const FONT = '"JetBrains Mono", "IBM Plex Mono", Menlo, monospace';
  const ZOOM_MAX = 4;
  const SOGLIA_UMANO = 0.3;
  const SOGLIA_LUPO = 0.5;

  /* --------------------------------------------------------------------
     Aree piene da un campo per celle: marching squares su una griglia
     ricampionata (passo mezza cella, interpolazione bilineare).
     Restituisce il riempimento e il contorno come Path2D in coordinate
     di mappa (celle). Le selle sono trattate come collegate.
     -------------------------------------------------------------------- */
  function aree(F, W, H, L, passo) {
    const s = passo || 0.5;
    const NX = Math.round((W + 1) / s) + 1, NY = Math.round((H + 1) / s) + 1;
    const G = new Float32Array(NX * NY);
    for (let b = 0; b < NY; b++) {
      const fy = b * s - 1, j0 = Math.floor(fy), ty = fy - j0;
      const ja = U.clamp(j0, 0, H - 1), jb = U.clamp(j0 + 1, 0, H - 1);
      for (let a = 0; a < NX; a++) {
        const fx = a * s - 1, i0 = Math.floor(fx), tx = fx - i0;
        const ia = U.clamp(i0, 0, W - 1), ib = U.clamp(i0 + 1, 0, W - 1);
        const v0 = F[ja * W + ia] + (F[ja * W + ib] - F[ja * W + ia]) * tx;
        const v1 = F[jb * W + ia] + (F[jb * W + ib] - F[jb * W + ia]) * tx;
        G[b * NX + a] = v0 + (v1 - v0) * ty;
      }
    }
    const fill = new Path2D(), line = new Path2D();
    const X = (a) => a * s - 0.5, Y = (b) => b * s - 0.5;
    const cx = [0, 1, 1, 0], cy = [0, 0, 1, 1];
    const val = [0, 0, 0, 0], dentro = [false, false, false, false];
    const pts = [];
    for (let b = 0; b < NY - 1; b++) {
      for (let a = 0; a < NX - 1; a++) {
        val[0] = G[b * NX + a]; val[1] = G[b * NX + a + 1];
        val[2] = G[(b + 1) * NX + a + 1]; val[3] = G[(b + 1) * NX + a];
        let n = 0;
        for (let c = 0; c < 4; c++) { dentro[c] = val[c] >= L; if (dentro[c]) n++; }
        if (!n) continue;
        const x0 = X(a), y0 = Y(b);
        if (n === 4) { fill.rect(x0, y0, s, s); continue; }
        pts.length = 0;
        for (let c = 0; c < 4; c++) {
          const d = (c + 1) % 4;
          if (dentro[c]) pts.push(x0 + cx[c] * s, y0 + cy[c] * s, 0);
          if (dentro[c] !== dentro[d]) {
            const t = (L - val[c]) / (val[d] - val[c]);
            pts.push(x0 + (cx[c] + (cx[d] - cx[c]) * t) * s, y0 + (cy[c] + (cy[d] - cy[c]) * t) * s, 1);
          }
        }
        fill.moveTo(pts[0], pts[1]);
        for (let k = 3; k < pts.length; k += 3) fill.lineTo(pts[k], pts[k + 1]);
        fill.closePath();
        const m = pts.length;
        for (let k = 0; k < m; k += 3) {
          const q = (k + 3) % m;
          if (pts[k + 2] && pts[q + 2]) { line.moveTo(pts[k], pts[k + 1]); line.lineTo(pts[q], pts[q + 1]); }
        }
      }
    }
    return { fill, line };
  }

  function boxBlur(src, W, H, r) {
    const out = new Float32Array(src.length), tmp = new Float32Array(src.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < W) { s += src[y * W + xx]; n++; } }
      tmp[y * W + x] = s / n;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < H) { s += tmp[yy * W + x]; n++; } }
      out[y * W + x] = s / n;
    }
    return out;
  }

  /* ---------------- segni (in unità u, centrati in 0,0) ------------------ */
  const SEGNI = {
    // doppio chevron del bosco
    bosco(p, x, y, u) {
      const a = 2.4 * u, h = 2 * u;
      for (const dy of [-1.6 * u, 1.6 * u]) { p.moveTo(x - a, y + dy + h / 2); p.lineTo(x, y + dy - h / 2); p.lineTo(x + a, y + dy + h / 2); }
    },
    // due barre oblique della prateria
    prateria(p, x, y, u) {
      for (const dx of [-1.6 * u, 1.6 * u]) { p.moveTo(x + dx - 1.2 * u, y + 2.2 * u); p.lineTo(x + dx + 1.2 * u, y - 2.2 * u); }
    },
    // frecce del pascolo: due sopra, una sotto (come nella legenda)
    pascolo(p, x, y, u) {
      const f = (cx, cy) => {
        p.moveTo(cx, cy - 6 * u); p.lineTo(cx, cy + 6 * u);
        p.moveTo(cx - 6 * u, cy); p.lineTo(cx, cy + 6 * u); p.lineTo(cx + 6 * u, cy);
      };
      f(x - 10 * u, y - 6 * u); f(x + 10 * u, y - 6 * u); f(x, y + 5 * u);
    },
    casetta(p, x, y, u) {
      p.moveTo(x - 5.6 * u, y - 0.6 * u); p.lineTo(x, y - 6 * u); p.lineTo(x + 5.6 * u, y - 0.6 * u);
      p.lineTo(x + 5.6 * u, y + 5.6 * u); p.lineTo(x - 5.6 * u, y + 5.6 * u); p.closePath();
    },
    croce(p, x, y, u) {
      p.moveTo(x - 5 * u, y - 6 * u); p.lineTo(x + 5 * u, y + 6 * u);
      p.moveTo(x + 5 * u, y - 6 * u); p.lineTo(x - 5 * u, y + 6 * u);
    }
  };

  class Renderer {
    constructor(canvas, territory, corridors, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.T = territory;
      this.Co = corridors;
      this.cfg = cfg;
      this.D = territory.dati;
      this.eventi = null;           // impostato da main: eventi della seduta sulla tavola
      this.documentati = false;     // uccisioni documentate (tasto U)
      this.hover = null;
      this.onView = null;
      this.u = 1;                   // px per unità del riferimento (vedi main)
      this.cache = document.createElement('canvas');
      this.cacheKey = '';
      this.cacheView = null;
      this._drawKey = '';
      this.geomKey = '';
      this.k = 1; this.ox = 0; this.oy = 0;
      // isoipse in coordinate di mappa (fisse)
      this.isoipse = new Path2D();
      this.D.isoipse.forEach((l) => {
        const p = l.p;
        this.isoipse.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) this.isoipse.lineTo(p[i], p[i + 1]);
      });
      this.sentieri = new Path2D();
      this.D.sentieri.forEach((p) => {
        this.sentieri.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) this.sentieri.lineTo(p[i], p[i + 1]);
      });
      this.resize();
    }

    setLayer() { /* i livelli non si spengono più dalla legenda */ }

    /* ---------------- vista ---------------------------------------------- */
    _limiti() {
      const W = this.T.W, H = this.T.H;
      this.kIntera = Math.min(this.cw / W, this.ch / H);
      this.kAdatta = Math.max(this.cw / W, this.ch / H);
      this.kMin = this.kAdatta;          // la tavola riempie sempre il riquadro
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
      clearTimeout(this._tBase);
      this._tBase = setTimeout(() => { this.cacheKey = ''; this._drawKey = ''; }, 140);
      if (this.onView) this.onView(this);
    }

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

    /* ---------------- aree (cambiano con le presenze) ---------------------- */
    _geometrie() {
      const T = this.T, W = T.W, H = T.H, soglia = this.cfg.TERRITORIO.SOGLIA_CONFLITTO;
      this.gLupo = aree(T.presenza, W, H, SOGLIA_LUPO);
      this.gUmano = aree(T.umano, W, H, SOGLIA_UMANO);
      // conflitto: solo i tipi che sono conflitto (non il pascolo custodito), sfumato in macchie
      const CF = DN.territory.CONFLITTO, c = new Float32Array(T.N);
      for (let i = 0; i < T.N; i++) c[i] = T.tipoConflitto[i] && T.tipoConflitto[i] !== CF.PRESIDIO ? T.conflitto[i] : 0;
      const cb = boxBlur(c, W, H, 1);
      this.gConflitto = aree(cb, W, H, soglia * 0.8);
      this.gAlone = aree(cb, W, H, soglia * 0.4);
      // pascoli: segni su una griglia rada, rossi dove il pascolo è a rischio
      const pas = [];
      const passo = 9;
      for (let y = 3, r = 0; y < H; y += passo, r++) {
        for (let x = 3 + (r % 2 ? 4 : 0); x < W; x += passo) {
          const i = y * W + x;
          if (T.cls[i] !== K.PRATERIA || U.hash2(x, y, 5) > 0.6) continue;
          if (T.dMalga && T.dMalga[i] < 2) continue;
          const rischio = T.tipoConflitto[i] === CF.PREDAZIONE && T.conflitto[i] >= soglia * 0.6;
          pas.push({ x: x + 0.5, y: y + 0.5, rischio });
        }
      }
      this.pascoli = pas;
    }

    hit(mx, my) {
      const [x, y] = this.toMap(mx, my);
      const T = this.T, r = (px) => px / this.k;
      if (x < 0 || y < 0 || x >= T.W || y >= T.H) return null;
      const vicino = (lista, raggio) => {
        let best = null, bd = Math.max(r(raggio), 0.6);
        lista.forEach((n) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } });
        return best;
      };
      if (this.eventi) {
        const e = vicino(this.eventi.finestra(), 10 * this.u);
        if (e) return { tipo: 'evento', n: e };
      }
      if (this.documentati) {
        const d = vicino(this.D.conflittiDocumentati, 10 * this.u);
        if (d) return { tipo: 'documentato', n: d };
      }
      const nodo = vicino(this.Co.nodi.filter((n) => n.tipo === 'stradale' || n.tipo === 'trappola'), 10 * this.u);
      if (nodo) return { tipo: 'nodo', n: nodo };
      const malga = vicino(T.malghe, 9 * this.u);
      let luogo = null, ld = Math.max(r(26), 1.5);
      this.D.luoghi.forEach((l) => { const d = Math.hypot(l.x - x, l.y - y); if (d < ld) { ld = d; luogo = l; } });
      return { tipo: 'cella', i: Math.floor(y) * T.W + Math.floor(x), malga, luogo };
    }

    /* ---------------------------------------------------------------- */
    draw() {
      const T = this.T, ctx = this.ctx, dpr = this.dpr, k = this.k;
      const ev = this.eventi ? this.eventi.versione : 0;
      const dati = T.version + ':' + T.presVersion + ':' + this.Co.version + ':' + ev + ':' + this.documentati + ':' + this.u;
      const vista = k.toFixed(3) + ',' + this.ox.toFixed(1) + ',' + this.oy.toFixed(1);
      const dk = dati + '|' + vista + '|' + this.cacheKey;
      if (dk === this._drawKey) return;

      const gk = T.version + ':' + T.presVersion;
      if (gk !== this.geomKey) { this._geometrie(); this.geomKey = gk; }
      if (dati !== this.cacheKey || !this.cacheView) { this._disegna(); this.cacheKey = dati; }
      this._drawKey = dati + '|' + vista + '|' + this.cacheKey;

      // la tavola in cache; durante zoom e trascinamento la si sposta come immagine
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const cv = this.cacheView;
      if (cv.k === k && cv.ox === this.ox && cv.oy === this.oy) ctx.drawImage(this.cache, 0, 0);
      else {
        const s = k / cv.k;
        ctx.fillStyle = PAL.carta; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(this.cache, dpr * (this.ox - cv.ox * s), dpr * (this.oy - cv.oy * s), this.cache.width * s, this.cache.height * s);
      }
    }

    _disegna() {
      const g = this.cache.getContext('2d'), T = this.T, W = T.W, H = T.H, k = this.k, dpr = this.dpr, u = this.u;
      const mappa = () => g.setTransform(dpr * k, 0, 0, dpr * k, dpr * this.ox, dpr * this.oy);
      const schermo = () => g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const q = u / k;   // un'unità u in celle

      schermo();
      g.fillStyle = PAL.carta; g.fillRect(0, 0, this.cw, this.ch);
      g.lineCap = 'round'; g.lineJoin = 'round';

      // pattern del suolo, in coordinate di schermo
      const pat = new Path2D(), punti = new Path2D();
      const sx = 17 * u, sy = 15 * u;
      const x0 = Math.max(0, this.ox), x1 = Math.min(this.cw, this.ox + W * k);
      const y0 = Math.max(0, this.oy), y1 = Math.min(this.ch, this.oy + H * k);
      let riga = Math.floor((y0 - this.oy) / sy);
      for (let y = this.oy + riga * sy; y < y1 + sy; y += sy, riga++) {
        const off = (riga % 2) * sx / 2;
        let col = Math.floor((x0 - this.ox - off) / sx);
        for (let x = this.ox + off + col * sx; x < x1 + sx; x += sx, col++) {
          const i = Math.floor((x - this.ox) / k), j = Math.floor((y - this.oy) / k);
          if (i < 0 || j < 0 || i >= W || j >= H) continue;
          const c = T.cls[j * W + i];
          if (c === K.BOSCO) SEGNI.bosco(pat, x, y, u);
          else if (c === K.PRATERIA) SEGNI.prateria(pat, x, y, u);
          else if (c === K.ARBUSTO && (riga + col) % 2 === 0) { punti.moveTo(x + 0.9 * u, y); punti.arc(x, y, 0.9 * u, 0, Math.PI * 2); }
        }
      }
      const lwPat = Math.max(0.6, 0.85 * u);
      const suolo = (colPat, colIso) => {
        schermo();
        g.strokeStyle = colPat; g.fillStyle = colPat; g.lineWidth = lwPat;
        g.stroke(pat); g.fill(punti);
        mappa();
        g.strokeStyle = colIso; g.lineWidth = 0.8 * q; g.stroke(this.isoipse);
      };

      // clip alla tavola
      schermo();
      g.save();
      g.beginPath(); g.rect(this.ox, this.oy, W * k, H * k); g.clip();
      suolo(PAL.patternBianco, PAL.isoBianco);

      // presenza di Canis lupus
      mappa();
      g.fillStyle = PAL.lupo; g.fill(this.gLupo.fill);
      g.save(); g.clip(this.gLupo.fill); suolo(PAL.patternLupo, PAL.isoLupo); g.restore();
      mappa();
      g.strokeStyle = PAL.lupoBordo; g.lineWidth = 1.4 * q; g.stroke(this.gLupo.line);

      // presenza di Homo sapiens
      g.fillStyle = PAL.umano; g.fill(this.gUmano.fill);
      g.save(); g.clip(this.gUmano.fill); suolo(PAL.patternUmano, PAL.isoUmano); g.restore();
      mappa();
      g.strokeStyle = PAL.umanoBordo; g.lineWidth = 1.4 * q; g.stroke(this.gUmano.line);

      // aree di conflitto, con alone
      g.save();
      g.shadowColor = 'rgba(238,71,71,0.55)'; g.shadowBlur = 14 * u * dpr;
      g.fillStyle = 'rgba(245,150,140,0.32)'; g.fill(this.gAlone.fill);
      g.restore();
      g.save();
      g.shadowColor = 'rgba(238,71,71,0.7)'; g.shadowBlur = 7 * u * dpr;
      g.fillStyle = PAL.rosso; g.fill(this.gConflitto.fill);
      g.restore();
      mappa();
      g.strokeStyle = 'rgba(214,52,52,0.7)'; g.lineWidth = 1 * q; g.stroke(this.gConflitto.line);

      this._viabilita(g, q);
      this._corridoi(g, q);
      this._pascoli(g, q);
      this._malghe(g, q);
      this._marcatori(g, q);
      this._luoghi(g, q);
      g.restore();
      this.cacheView = { k, ox: this.ox, oy: this.oy };
    }

    _linea(p, path) {
      path.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    }

    _viabilita(g, q) {
      const T = this.T;
      g.strokeStyle = PAL.strada; g.globalAlpha = 0.85; g.lineWidth = 1.1 * q; g.stroke(this.sentieri);
      g.globalAlpha = 1;
      const chiuse = new Path2D(), locali = new Path2D(), grandi = new Path2D();
      T.strade.forEach((s) => {
        if (!s.aperta) this._linea(s.p, chiuse);
        else if (s.r === 3) this._linea(s.p, locali);
        else this._linea(s.p, grandi);
      });
      g.setLineDash([2 * q, 4 * q]);
      g.strokeStyle = 'rgba(91,83,81,0.45)'; g.lineWidth = 1 * q; g.stroke(chiuse);
      g.setLineDash([]);
      g.strokeStyle = PAL.strada; g.lineWidth = 1.5 * q; g.stroke(locali);
      // strada: doppia linea
      g.lineWidth = 4.4 * q; g.stroke(grandi);
      g.strokeStyle = PAL.carta; g.lineWidth = 1.7 * q; g.stroke(grandi);
    }

    _corridoi(g, q) {
      this.Co.percorsi.forEach((p) => {
        if (!p.disegna) return;
        const pts = p.pts;
        const path = new Path2D();
        path.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          path.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
        }
        path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        // fascia bianca, poi doppio tratteggio beige: tratto spesso con un filo bianco al centro
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 9 * q; g.stroke(path);
        g.lineCap = 'butt';
        g.setLineDash([7 * q, 4 * q]);
        g.strokeStyle = PAL.corridoio; g.lineWidth = 5 * q; g.stroke(path);
        g.setLineDash([]);
        g.strokeStyle = PAL.carta; g.lineWidth = 1.5 * q; g.stroke(path);
        g.lineCap = 'round';

        // segni lungo i tratti contesi e trappola, a distanza costante sullo schermo
        const lung = [0];
        for (let i = 1; i < pts.length; i++) lung.push(lung[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const punto = (s) => {
          let i = 1;
          while (i < pts.length - 1 && lung[i] < s) i++;
          const t = (s - lung[i - 1]) / Math.max(1e-6, lung[i] - lung[i - 1]);
          const a = pts[i - 1], b = pts[i];
          return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
        };
        const barre = new Path2D(), triangoli = new Path2D();
        p.tratti.forEach((t) => {
          const conteso = t.stato === 'conteso' || t.stato === 'interrotto';
          if (!conteso && t.stato !== 'trappola') return;
          const s0 = lung[t.da], s1 = lung[t.a];
          const passo = (conteso ? 34 : 70) * q;
          const n = Math.max(1, Math.floor((s1 - s0) / passo));
          for (let m = 0; m < n; m++) {
            const [x, y, ang] = punto(s0 + (s1 - s0) * (m + 0.5) / n);
            if (conteso) {
              // due barre oblique rosse attraverso il corridoio
              const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
              for (const o of [-2.3, 2.3]) {
                const bx = x + dx * o * q, by = y + dy * o * q;
                barre.moveTo(bx - nx * 6 * q - dx * 3 * q, by - ny * 6 * q - dy * 3 * q);
                barre.lineTo(bx + nx * 6 * q + dx * 3 * q, by + ny * 6 * q + dy * 3 * q);
              }
            } else {
              const r = 5.5 * q;
              triangoli.moveTo(x - r, y - r * 0.6); triangoli.lineTo(x + r, y - r * 0.6); triangoli.lineTo(x, y + r * 0.95); triangoli.closePath();
            }
          }
        });
        g.strokeStyle = PAL.rosso; g.lineWidth = 1.9 * q; g.stroke(barre);
        g.fillStyle = PAL.carta; g.fill(triangoli); g.lineWidth = 1.7 * q; g.stroke(triangoli);
      });
      // Canis lupus ucciso negli attraversamenti interrotti o trappola
      const croci = new Path2D();
      this.Co.nodi.forEach((n) => { if (n.tipo === 'stradale' || n.tipo === 'trappola') SEGNI.croce(croci, n.x, n.y, q * 0.8); });
      g.strokeStyle = PAL.rosso; g.lineWidth = 2 * q; g.stroke(croci);
    }

    _pascoli(g, q) {
      const nero = new Path2D(), rosso = new Path2D();
      (this.pascoli || []).forEach((p) => SEGNI.pascolo(p.rischio ? rosso : nero, p.x, p.y, q * 0.62));
      g.lineWidth = 1.6 * q;
      g.strokeStyle = '#1D1B1B'; g.stroke(nero);
      g.strokeStyle = PAL.rosso; g.stroke(rosso);
    }

    _malghe(g, q) {
      const T = this.T, path = new Path2D();
      T.malghe.forEach((m) => { if (T.dPascolo && T.dPascolo[m.idx] <= 1.5) SEGNI.casetta(path, m.x, m.y, q * 1.2); });
      g.fillStyle = PAL.carta; g.fill(path);
      g.strokeStyle = '#1D1B1B'; g.lineWidth = 2 * q; g.stroke(path);
    }

    /* eventi della seduta sulla tavola (ultime settimane) e, a richiesta, uccisioni documentate */
    _marcatori(g, q) {
      const quadrati = new Path2D(), croci = new Path2D();
      const r = 7 * q;
      if (this.eventi) {
        this.eventi.finestra().forEach((e) => {
          if (e.icona === 'bestiame') quadrati.rect(e.x - r, e.y - r, 2 * r, 2 * r);
          else if (e.icona === 'ucciso') SEGNI.croce(croci, e.x, e.y, q * 0.8);
        });
      }
      if (this.documentati) this.D.conflittiDocumentati.forEach((n) => quadrati.rect(n.x - r, n.y - r, 2 * r, 2 * r));
      g.fillStyle = PAL.carta; g.fill(quadrati);
      g.strokeStyle = PAL.rosso; g.lineWidth = 2.6 * q; g.stroke(quadrati); g.stroke(croci);
      if (this.documentati) {
        // le uccisioni documentate portano il numero di eventi: non sono simulate
        g.font = `600 ${11 * q}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = PAL.rosso;
        this.D.conflittiDocumentati.forEach((n) => g.fillText(String(n.eventi), n.x + r + 3 * q, n.y));
      }
    }

    _luoghi(g, q) {
      g.textBaseline = 'middle'; g.textAlign = 'center';
      const sp = 'letterSpacing' in g;
      if (this.k >= 22) {
        g.font = `400 ${11 * q}px ${FONT}`;
        this.D.luoghi.forEach((l) => {
          if (l.tipo !== 'hamlet') return;
          g.lineWidth = 3 * q; g.strokeStyle = 'rgba(255,255,255,0.85)';
          g.strokeText(l.nome, l.x, l.y - 9 * q);
          g.fillStyle = PAL.inchiostro; g.fillText(l.nome, l.x, l.y - 9 * q);
        });
      }
      g.font = `600 ${14 * q}px ${FONT}`;
      if (sp) g.letterSpacing = (1.1 * q) + 'px';
      this.D.luoghi.forEach((l) => {
        if (l.tipo === 'hamlet') return;
        const txt = l.nome.toUpperCase();
        g.lineWidth = 3.5 * q; g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.strokeText(txt, l.x, l.y - 14 * q);
        g.fillStyle = PAL.inchiostro; g.fillText(txt, l.x, l.y - 14 * q);
      });
      if (sp) g.letterSpacing = '0px';
    }
  }

  DN.render = { Renderer, PAL, SEGNI, FONT };

})(window.DN = window.DN || {});
