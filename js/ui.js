/* =====================================================================
   UI — pannello destro della tavola (NECESSITÀ, CONFLITTI), verbale,
   schede sulla mappa, tasti, debug.
   Tutto il pannello è disegnato nell'SVG #carta sulle coordinate del
   riferimento (2576 × 1449): i numeri qui sotto sono misurati sull'immagine.
   Gli slider sono in console.html: qui si leggono soltanto.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------------- geometria del pannello (unità del riferimento) ------- */
  // fattori del territorio (calcolaStato) in alto: lato Homo sapiens
  const TAG_SU = [
    { t: 'Cani da guardiania', v: 'cani',           x: 1724, y: 227, w: 177, s: 1841 },
    { t: 'Infrastrutture',     v: 'infrastrutture', x: 1931, y: 227, w: 171, s: 1969 },
    { t: 'Pascolo',            v: 'pascolo',        x: 1724, y: 275, w: 107, s: 1777 },
    { t: 'Greggi',             v: 'greggi',         x: 1854, y: 275, w: 104, s: 1908 },
    { t: 'Conflitti',          v: 'conflitto',      x: 1980, y: 275, w: 122, s: 2037 }
  ];
  // in basso: lato Canis lupus
  const TAG_GIU = [
    { t: 'Ungulati',        v: 'ungulati',            x: 1724, y: 681, w: 89,  s: 1769 },
    { t: 'Corridoi',        v: 'corridoiAperti',      x: 1826, y: 681, w: 100, s: 1877 },
    { t: 'Lupi',            v: 'lupi',                x: 1939, y: 681, w: 67,  s: 1973 },
    { t: 'Boschi',          v: 'bosco',               x: 2019, y: 681, w: 84,  s: 2060 },
    { t: 'Ibridazione',     v: 'ibridazione',         x: 1724, y: 729, w: 108, s: 1820 },
    { t: 'Morti in strada', v: 'mortalitaStradale',   x: 1845, y: 729, w: 136, s: 1933 },
    { t: 'Dispersione',     v: 'dispersioneRiuscita', x: 1994, y: 729, w: 108, s: 2013 }
  ];
  const VERBI = [
    { id: 'monitorare',  x: 2136, y: 228, alto: true },
    { id: 'presidiare',  x: 2342, y: 227, alto: true },
    { id: 'abitare',     x: 2136, y: 275, alto: true },
    { id: 'allevare',    x: 2342, y: 275, alto: true },
    { id: 'nutrirsi',    x: 2136, y: 682, alto: false },
    { id: 'attraversare', x: 2342, y: 681, alto: false },
    { id: 'avvicinarsi', x: 2136, y: 729, alto: false },
    { id: 'riprodursi',  x: 2342, y: 729, alto: false }
  ];
  const H_SCATOLA = 35;
  const QUADRANTI = [
    { id: 'cibo',        nome: 'Risorse',  cx: 1808 },
    { id: 'spazio',      nome: 'Spazi',    cx: 2015 },
    { id: 'sicurezza',   nome: 'Limiti',   cx: 2221 },
    { id: 'discendenza', nome: 'Famiglia', cx: 2428 }
  ];
  const CY = 496, R_IN = 61, R_OUT = 81, TACCHE = 15;
  // fili dello schema: [x1, y1, x2, y2]
  const FILI = [
    [1901, 244.6, 1931, 244.6], [2307, 244.6, 2342, 244.6], [2325, 244.6, 2325, 375.5],
    [1777, 332.3, 2430, 332.3], [2430, 310, 2430, 332.3],
    [1777, 310, 1777, 375.5], [1841, 262, 1841, 375.5], [1908, 310, 1908, 375.5],
    [1969, 262, 1969, 375.5], [2037, 310, 2037, 375.5], [2221, 310, 2221, 375.5],
    [1730, 375.5, 2350, 375.5],
    [1730, 375.5, 1730, 420.5], [1937, 375.5, 1937, 420.5], [2143, 375.5, 2143, 420.5], [2350, 375.5, 2350, 420.5],
    [1730, 572, 1730, 617], [1937, 572, 1937, 617], [2143, 572, 2143, 617], [2350, 572, 2350, 617],
    [1730, 617, 2350, 617],
    [1769, 617, 1769, 681], [1769, 660.6, 2433, 660.6], [2433, 660.6, 2433, 681],
    [1820, 617, 1820, 729], [1877, 617, 1877, 681], [1933, 617, 1933, 729],
    [1973, 617, 1973, 681], [2013, 617, 2013, 729], [2060, 617, 2060, 681],
    [2221, 617, 2221, 682], [2325, 617, 2325, 747], [2307, 747, 2342, 747]
  ];
  // grafico dei conflitti
  const GR = { x: 1724, y: 954, w: 600, h: 189, colonne: [1786.5, 1863.3, 1938.9, 2015.8, 2092.7, 2169.6, 2246.5], righe: [999.9, 1049.4, 1095.2] };
  const BARRE = { x: 2207, passo: 17.1, w: 11.2, y: 841, h: 49, n: 18 };

  // icona del verbale per slider che spinge
  const ICONA_VERBALE = {
    allevare: 's-pascolo-rischio', presidiare: 's-pascolo-rischio', nutrirsi: 's-bestiame', monitorare: 's-ucciso',
    abitare: 's-conteso', attraversare: 's-conteso', avvicinarsi: 's-trappola', riprodursi: 's-conteso'
  };
  const ICONA_EVENTO = { bestiame: 's-bestiame', ucciso: 's-ucciso', conteso: 's-conteso', trappola: 's-trappola' };

  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const lerpColore = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  };

  /* testo con <i>…</i> → righe di frammenti {t, it}, a capo per numero di caratteri */
  function righe(html, max, maxRighe) {
    const parti = String(html).split(/(<i>|<\/i>)/);
    const parole = [];
    let it = false;
    parti.forEach((p) => {
      if (p === '<i>') { it = true; return; }
      if (p === '</i>') { it = false; return; }
      p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) parole.push({ sp: true });
        else parole.push({ t: w, it });
      });
    });
    const out = [];
    let riga = [], n = 0, spazio = false;
    parole.forEach((w) => {
      if (w.sp) { spazio = n > 0; return; }
      const add = (spazio ? 1 : 0) + w.t.length;
      if (n + add > max && n > 0) { out.push(riga); riga = []; n = 0; spazio = false; }
      if (spazio && n > 0) { riga.push({ t: ' ', it: false }); n += 1; }
      riga.push({ t: w.t, it: w.it }); n += w.t.length; spazio = false;
    });
    if (riga.length) out.push(riga);
    if (maxRighe && out.length > maxRighe) {
      out.length = maxRighe;
      const ultima = out[maxRighe - 1];
      ultima[ultima.length - 1] = Object.assign({}, ultima[ultima.length - 1], { t: ultima[ultima.length - 1].t.replace(/[.,:;]?$/, '…') });
    }
    return out;
  }
  function scriviRiga(textEl, frammenti) {
    textEl.textContent = '';
    frammenti.forEach((f) => {
      const ts = mk('tspan', f.it ? { class: 'it' } : {}, textEl);
      ts.textContent = f.t;
    });
  }

  class UI {
    constructor(app) {
      this.app = app;
      this.cfg = app.cfg;
      this.bus = app.bus;
      this.debug = false;
      this._fps = { n: 0, t: performance.now(), v: 0 };
      this.nomi = {}; this.slider = {};
      this.cfg.SLIDERS.forEach((s) => { this.nomi[s.id] = s.nome; this.slider[s.id] = s; });
      this.ultimoGesto = {};
      this.verbale = [];          // frasi della negoziazione, la più recente per prima
      this.verbaleChiavi = new Map();
      this.dir = {}; this.prec = {};
      this.cfg.SLIDERS.forEach((s) => { this.dir[s.id] = 1; this.prec[s.id] = 50; });
      this.inst = 0; this.conf = 0;

      this._buildPannello();
      this._bindMap();
      this._bindKeys();
      this._bindButtons();

      this.bus.on('set', (id) => { this.ultimoGesto[id] = performance.now(); });
      this.bus.on('reset', () => {
        this.verbale = []; this.verbaleChiavi.clear(); this._verbaleSporco = true;
        if (this.app.eventi) this.app.eventi.reset();
      });
    }

    /* ---------------------------------------------------------------
       Pannello: NECESSITÀ (stato della convivenza, schema, quadranti)
       e CONFLITTI (barre, grafico, ultimo evento, verbale)
       --------------------------------------------------------------- */
    _buildPannello() {
      const P = document.getElementById('pannello');
      const txt = (x, y, cls, s, extra) => { const t = mk('text', Object.assign({ x, y, class: cls }, extra || {}), P); t.textContent = s; return t; };

      // --- NECESSITÀ -----------------------------------------------------
      txt(1722, 120, 'titolo', 'NECESSITÀ');
      txt(2195, 97, 'etichetta', 'Stato della', { 'text-anchor': 'end' });
      txt(2195, 119, 'etichetta', 'convivenza', { 'text-anchor': 'end' });
      this.convLinee = mk('path', { fill: 'none', stroke: '#8C8C8C', 'stroke-width': 1, 'stroke-linejoin': 'round' }, P);
      this.convPunti = mk('path', { fill: 'none', stroke: '#8C8C8C', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, P);
      mk('circle', { cx: 2226, cy: 102, r: 11.5, fill: '#fff', stroke: '#3B3534', 'stroke-width': 5 }, P);
      mk('circle', { cx: 2497, cy: 102, r: 11.5, fill: '#fff', stroke: '#A89287', 'stroke-width': 5 }, P);
      this.convTesto = txt(2361, 108.5, 'stato-conv', 'STABILE');

      FILI.forEach(([x1, y1, x2, y2]) => mk('path', { d: `M${x1} ${y1}L${x2} ${y2}`, class: 'filo' }, P));

      // fattori del territorio
      this.tags = [];
      const tag = (d, lupo) => {
        const g = mk('g', { class: 'tag' }, P);
        mk('rect', { x: d.x, y: d.y, width: d.w, height: H_SCATOLA, class: 'scatola' }, g);
        mk('text', { x: d.x + d.w / 2, y: d.y + 23.2, class: 'scatola-t' }, g).textContent = d.t;
        const sy = lupo ? d.y - 1.5 : d.y + H_SCATOLA - 1.5;
        const piolo = mk('rect', { x: d.s - 9, y: sy, width: 18, height: 3, class: 'piolo' + (lupo ? ' lupo' : '') }, g);
        const title = mk('title', {}, g);
        this.tags.push({ d, piolo, title, prec: null, t: -1e9 });
      };
      TAG_SU.forEach((d) => tag(d, false));
      TAG_GIU.forEach((d) => tag(d, true));

      // verbi (gli slider della console, letti qui)
      this.verbi = {};
      VERBI.forEach((v) => {
        const w = v.x === 2136 ? 171 : 172;
        const g = mk('g', {}, P);
        mk('rect', { x: v.x, y: v.y, width: w, height: H_SCATOLA, class: 'scatola' }, g);
        const num = mk('text', { x: v.x + 24, y: v.y + 24.5, class: 'verbo-n' }, g);
        const freccia = mk('path', { class: 'verbo-f' }, g);
        mk('text', { x: v.x + 66, y: v.y + 23.5, class: 'verbo-t' }, g).textContent = this.nomi[v.id][0] + this.nomi[v.id].slice(1).toLowerCase();
        const sx = v.x + w / 2 - 7;
        mk('rect', { x: sx - 9, y: v.alto ? v.y + H_SCATOLA - 1.5 : v.y - 1.5, width: 18, height: 3, class: 'piolo' }, g);
        const s = this.slider[v.id];
        mk('title', {}, g).textContent = `${this.nomi[v.id]}: 0 = ${s.sx}, 100 = ${s.dx}`;
        this.verbi[v.id] = { num, freccia, fx: v.x + 55, fy: v.y + 16.5, ultimo: null };
      });

      // quadranti: sopra Homo sapiens (nero), sotto Canis lupus (bruno)
      this.quadranti = {};
      QUADRANTI.forEach((q) => {
        const g = mk('g', {}, P);
        mk('circle', { cx: q.cx - 78, cy: CY - 75.5, r: 7, fill: '#3B3534' }, g);
        mk('circle', { cx: q.cx - 78, cy: CY + 76, r: 7, fill: '#A89287' }, g);
        const tacche = { umano: [], lupo: [] };
        for (let k = 0; k < TACCHE; k++) {
          const a = (169.5 - k * 159 / (TACCHE - 1)) * Math.PI / 180;
          ['umano', 'lupo'].forEach((who) => {
            const s = who === 'umano' ? -1 : 1;
            const c = Math.cos(a), sn = Math.sin(a) * s;
            tacche[who].push(mk('line', {
              x1: (q.cx + c * R_IN).toFixed(2), y1: (CY + sn * R_IN).toFixed(2),
              x2: (q.cx + c * R_OUT).toFixed(2), y2: (CY + sn * R_OUT).toFixed(2),
              class: 'tacca', stroke: '#F3F0EE'
            }, g));
          });
        }
        const vu = mk('text', { x: q.cx, y: CY - 37.5, class: 'quadrante-v' }, g); vu.textContent = 'XX';
        mk('text', { x: q.cx, y: CY + 9, class: 'quadrante-nome' }, g).textContent = q.nome;
        const vl = mk('text', { x: q.cx, y: CY + 50.5, class: 'quadrante-v lupo' }, g); vl.textContent = 'XX';
        mk('title', {}, g).textContent = `${q.nome}: sopra Homo sapiens, sotto Canis lupus (0–100, simulati)`;
        this.quadranti[q.id] = { tacche, vu, vl, nu: -1, nl: -1 };
      });

      // --- CONFLITTI -------------------------------------------------------
      txt(1725, 890, 'titolo', 'CONFLITTI');
      txt(2102, 868, 'etichetta', 'Stato del');
      txt(2102, 889, 'etichetta', 'conflitto');
      this.barre = [];
      for (let i = 0; i < BARRE.n; i++) this.barre.push(mk('rect', { x: BARRE.x + i * BARRE.passo, y: BARRE.y, width: BARRE.w, height: BARRE.h, fill: '#F4F0EE' }, P));

      mk('rect', { x: GR.x, y: GR.y, width: GR.w, height: GR.h, class: 'griglia' }, P);
      GR.colonne.forEach((x) => mk('path', { d: `M${x} ${GR.y}V${GR.y + GR.h}`, class: 'griglia' }, P));
      GR.righe.forEach((y) => mk('path', { d: `M${GR.x} ${y}H${GR.x + GR.w}`, class: 'griglia' }, P));
      const clip = mk('clipPath', { id: 'clip-grafico' }, P);
      mk('rect', { x: GR.x, y: GR.y - 12, width: GR.w, height: GR.h + 24 }, clip);
      const gc = mk('g', { 'clip-path': 'url(#clip-grafico)' }, P);
      this.punti = mk('g', {}, gc);
      txt(2349, 1109, 'etichetta', 'Intensità');
      txt(2349, 1125.5, 'etichetta', 'e punti di');
      txt(2349, 1142, 'etichetta', 'conflitto');

      mk('path', { d: 'M1724 1163.4H2510', class: 'linea-sez' }, P);
      this.evIcona = mk('use', { href: '#s-bestiame', transform: 'translate(1788 1194) scale(1.375)' }, P);
      this.evTitolo = mk('text', { x: 1825, y: 1201, class: 'ev-titolo' }, P);
      this.evTesto = [mk('text', { x: 1825, y: 1223, class: 'ev-testo' }, P), mk('text', { x: 1825, y: 1244.5, class: 'ev-testo' }, P)];
      mk('path', { d: 'M1724 1262.5H2510', class: 'linea-sez' }, P);
      this.verbaleG = mk('g', {}, P);
      this._evVer = -1;
      this._verbaleSporco = true;
    }

    /* ---------------------------------------------------------------
       Verbale: per ogni slider che si muove da solo, la spinta principale
       e la sua frase (DN.config.W). Si mostrano le due più recenti.
       --------------------------------------------------------------- */
    _scriviVerbale(fonte, html, chiave) {
      const now = performance.now();
      const last = this.verbaleChiavi.get(chiave);
      if (last && now - last < 25000) return;
      this.verbaleChiavi.set(chiave, now);
      this.verbale.unshift({ fonte, html, t: now });
      this.verbale = this.verbale.slice(0, 20);
      this._verbaleSporco = true;
    }

    _risposte(now) {
      const sim = this.app.sim, bus = this.bus, T = this.cfg.TEMPO;
      if (this._regT && now - this._regT < 400) return;
      this._regT = now;
      const targets = sim.targets;
      for (const j of bus.ids) {
        if (bus.isHeld(j)) continue;
        const d = (targets[j] !== undefined ? targets[j] : bus.values[j]) - bus.values[j];
        if (Math.abs(d) < 2) continue;
        let best = null;
        (sim.contributi[j] || []).forEach((o) => { if (Math.sign(o.c) === Math.sign(d) && Math.abs(o.c) >= T.SOGLIA_RISPOSTA && (!best || Math.abs(o.c) > Math.abs(best.c))) best = o; });
        if (!best) continue;
        const i = best.da, e = this.cfg.W[i][j];
        this._scriviVerbale(i, bus.values[i] > 50 ? e.su : e.giu, i + '>' + j + (d > 0 ? '+' : '-'));
      }
    }

    _disegnaVerbale() {
      const G = this.verbaleG;
      G.textContent = '';
      let y = 1295.5;
      const voci = this.verbale.length ? this.verbale.slice(0, 3) : [{ fonte: null, html: 'Alla seduta risulta assente <i>Canis lupus</i>. La sedia non è rimossa. Muovi uno slider sulla console per aprire il verbale.' }];
      voci.forEach((v, n) => {
        if (y > 1420) return;
        const rr = righe(v.html, 82, 2);
        if (v.fonte) mk('use', { href: '#' + ICONA_VERBALE[v.fonte], transform: `translate(1787 ${y - 4.5}) scale(0.95)` }, G);
        rr.forEach((r, k) => {
          const t = mk('text', { x: 1826, y: y + k * 17, class: 'verbale' + (n === 0 && v.fonte ? ' nuova' : '') }, G);
          scriviRiga(t, r);
        });
        y += rr.length * 17 + 11;
      });
    }

    /* ultimo evento della seduta */
    _disegnaEvento() {
      const E = this.app.eventi, e = E.ultimo;
      if (!e) {
        this.evIcona.setAttribute('visibility', 'hidden');
        scriviRiga(this.evTitolo, [{ t: `Registro dei conflitti [${E.data(E.giorno)}]`, it: false }]);
        const r = righe('Nessun conflitto registrato nella seduta. L\'assenza di registrazioni non dimostra l\'assenza di <i>Canis lupus</i>.', 68, 2);
        this.evTesto.forEach((t, k) => scriviRiga(t, r[k] || []));
        return;
      }
      this.evIcona.setAttribute('visibility', 'visible');
      this.evIcona.setAttribute('href', '#' + ICONA_EVENTO[e.icona]);
      scriviRiga(this.evTitolo, righe(`${e.titolo} [${e.data}]`, 80, 1)[0]);
      const r = righe(e.testo, 68, 2);
      this.evTesto.forEach((t, k) => scriviRiga(t, r[k] || []));
    }

    _disegnaPunti() {
      const E = this.app.eventi, G = this.punti, F = this.cfg.EVENTI.FINESTRA_GIORNI;
      G.textContent = '';
      E.finestra().forEach((e) => {
        const x = GR.w * (e.giorno + F) / F;
        const y = GR.y + 10 + (GR.h - 20) * (1 - e.intensita);
        const g = mk('g', {}, G);
        mk('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 9.5, fill: '#F5A3A3' }, g);
        mk('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 4.6, fill: '#EE4747' }, g);
        const t = mk('title', {}, g);
        t.textContent = `${e.titolo.replace(/<[^>]+>/g, '')} [${e.data}] · intensità ${Math.round(e.intensita * 100)} · evento simulato`;
      });
    }

    /* ---------------------------------------------------------------
       Schede sulla tavola, zoom e trascinamento
       --------------------------------------------------------------- */
    _bindMap() {
      const canvas = this.app.renderer.canvas;
      const tip = document.getElementById('tooltip');
      const R = this.app.renderer, T = this.app.territory, CF = DN.territory.CONFLITTO;
      const pct = (x) => Math.round(x * 100) + '%';
      const COSTI = {
        [CF.PREDAZIONE]: ['Zona di uccisioni', 'Bovini e ovicaprini uccisi al pascolo incustodito. Ogni animale ucciso apre un debito.', 'Si nutre di bovini e ovicaprini al pascolo. Esposizione all\'uccisione.'],
        [CF.MARGINE]: ['Margine delle contrade', 'presenze vicino alle case, paura', 'Attraversamento tra cani e luci. Esposizione all\'uccisione.'],
        [CF.TRAPPOLA]: ['Zona trappola', 'conflitto che si ripete ogni stagione', 'Qui si uccide chi passa.'],
        [CF.PRESIDIO]: ['Pascolo custodito', 'lavoro di custodia: recinti, cani, pastore', 'Mandrie e greggi non risultano accessibili. Il mancato passaggio non vale assenso.']
      };
      const punti = new Map();
      let trascina = null, pizzico = null;
      const locale = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        canvas.setPointerCapture(e.pointerId);
        punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (punti.size === 1) trascina = { x0: e.clientX, y0: e.clientY, mosso: false };
        if (punti.size === 2) {
          const [a, b] = [...punti.values()];
          pizzico = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        }
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!punti.has(e.pointerId)) return;
        const prima = punti.get(e.pointerId);
        punti.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (punti.size >= 2 && pizzico) {
          const [a, b] = [...punti.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const r = canvas.getBoundingClientRect();
          R.sposta(mx - pizzico.mx, my - pizzico.my);
          R.zoomA(d / pizzico.d, mx - r.left, my - r.top);
          pizzico = { d, mx, my };
          tip.hidden = true;
          return;
        }
        if (!trascina) return;
        if (!trascina.mosso && Math.hypot(e.clientX - trascina.x0, e.clientY - trascina.y0) > 3) {
          trascina.mosso = true; canvas.classList.add('trascina'); tip.hidden = true;
        }
        if (trascina.mosso) R.sposta(e.clientX - prima.x, e.clientY - prima.y);
      });
      const fine = (e) => {
        punti.delete(e.pointerId);
        if (punti.size < 2) pizzico = null;
        if (punti.size === 0) { trascina = null; canvas.classList.remove('trascina'); }
      };
      canvas.addEventListener('pointerup', fine);
      canvas.addEventListener('pointercancel', fine);
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const [mx, my] = locale(e);
        const passo = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0018;
        R.zoomA(Math.exp(-e.deltaY * passo), mx, my);
        tip.hidden = true;
      }, { passive: false });
      canvas.addEventListener('dblclick', (e) => { const [mx, my] = locale(e); R.zoomA(e.shiftKey ? 0.5 : 2, mx, my); });

      // scala grafica: "1 KM" sopra la barra
      const barra = document.querySelector('.map-scala-barra'), etichetta = document.querySelector('.map-scala-km');
      const cellaKm = DN.datiLessinia.meta.cella_m / 1000;
      R.onView = () => {
        const kmPx = cellaKm / R.k;
        const passi = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
        let km = passi[0];
        passi.forEach((p) => { if (p / kmPx <= 140 * R.u) km = p; });
        barra.style.width = (km / kmPx).toFixed(1) + 'px';
        etichetta.textContent = km < 1 ? Math.round(km * 1000) + ' M' : km + ' KM';
      };
      R.onView();

      canvas.addEventListener('mousemove', (e) => {
        if (punti.size) return;
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const h = R.hit(mx, my);
        R.hover = h;
        if (!h) { tip.hidden = true; return; }
        let html = '', cls = 'tooltip';
        if (h.tipo === 'evento') {
          const n = h.n;
          cls += ' conflitto';
          html = `<div class="tt-title">${n.titolo} [${n.data}]</div><div class="tt-sub">evento simulato della seduta</div><div>${n.testo}</div>`;
        } else if (h.tipo === 'nodo') {
          const n = h.n;
          cls += ' conflitto';
          html = `<div class="tt-title">${n.titolo}</div><div class="tt-row"><b class="specie">Homo sapiens</b><span>${n.umano}</span></div><div class="tt-row"><b class="specie">Canis lupus</b><span>${n.lupo}</span></div>`;
        } else if (h.tipo === 'documentato') {
          const n = h.n;
          cls += ' conflitto';
          html = `<div class="tt-title">${n.nome}</div><div class="tt-sub">${n.comune} · dato documentato, non simulato</div>
            <div class="tt-row"><b>eventi</b><span>${n.eventi} uccisioni ${n.periodo ? '(' + n.periodo + ')' : ''}</span></div>
            <div class="tt-row"><b>posizione</b><span>${n.precisione || ''}</span></div>`;
        } else {
          const d = T.descriviCella(h.i);
          const dove = h.malga ? 'Malga · ' + (h.malga.nome || '') : h.luogo ? 'presso ' + h.luogo.nome : '';
          html = `<div class="tt-title">${d.uso}${d.strada ? ' · strada' : ''}</div>${dove ? `<div class="tt-sub">${dove}</div>` : ''}
            <div class="tt-row"><b class="specie">Canis lupus</b><span>presenza ${pct(d.lupo)}</span></div>
            <div class="tt-row"><b class="specie">Homo sapiens</b><span>presenza ${pct(d.umano)}</span></div>`;
          const c = COSTI[d.tipo];
          if (c && (d.tipo === CF.PRESIDIO || d.conflitto >= this.cfg.TERRITORIO.SOGLIA_CONFLITTO)) {
            cls += d.tipo === CF.PRESIDIO ? ' convivenza' : ' conflitto';
            html += `<div class="tt-sep">${c[0]}${d.tipo === CF.PRESIDIO ? '' : ' · intensità ' + pct(d.conflitto)}</div>
              <div class="tt-row"><b class="specie">Homo sapiens</b><span>${c[1]}</span></div><div class="tt-row"><b class="specie">Canis lupus</b><span>${c[2]}</span></div>`;
          }
        }
        tip.hidden = false;
        tip.className = cls;
        tip.innerHTML = html;
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let x = mx + 16, y = my - th - 12;
        if (x + tw > r.width - 6) x = mx - tw - 16;
        if (y < 6) y = my + 16;
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      });
      canvas.addEventListener('mouseleave', () => { tip.hidden = true; R.hover = null; });
    }

    apriConsole() { window.open('console.html', 'dn-console', 'popup,width=1400,height=760'); }

    _bindKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key.toLowerCase(), R = this.app.renderer;
        if (k === 'd') this.toggleDebug();
        else if (k === 'r') this.app.reset();
        else if (k === 'c') this.apriConsole();
        else if (k === 't') window.open('trattato.html', 'dn-trattato', 'popup,width=1500,height=1000');
        else if (k === 'u') { R.documentati = !R.documentati; }
        else if (k === '+' || k === '=') R.zoomA(1.5);
        else if (k === '-') R.zoomA(1 / 1.5);
        else if (k === '0') R.inquadra('adatta');
        else if (k === 'f') {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
          else document.exitFullscreen && document.exitFullscreen();
        }
      });
    }

    _bindButtons() {
      document.getElementById('btn-console').addEventListener('click', () => this.apriConsole());
      document.getElementById('btn-midi').addEventListener('click', async () => {
        const a = new DN.input.MidiAdapter(this.bus);
        try { await a.connect(); } catch (e) { a.status = 'errore: ' + e.message; }
        document.getElementById('dev-status').textContent = 'MIDI — ' + a.status;
      });
      document.getElementById('btn-serial').addEventListener('click', async () => {
        const a = new DN.input.SerialAdapter(this.bus);
        try { await a.connect(); } catch (e) { a.status = 'errore: ' + e.message; }
        document.getElementById('dev-status').textContent = 'Seriale — ' + a.status;
      });
    }

    toggleDebug() {
      this.debug = !this.debug;
      document.getElementById('debug').hidden = !this.debug;
    }

    layout() { /* il pannello è un SVG: si adatta da solo */ }

    /* ---------------------------------------------------------------
       Aggiornamento a ogni frame
       --------------------------------------------------------------- */
    frame(now) {
      const sim = this.app.sim, bus = this.bus, res = sim.result;

      // verbi: valore e direzione dell'ultimo movimento (pieno mentre si muove)
      for (const id in this.verbi) {
        const v = bus.values[id], o = this.verbi[id];
        const d = v - this.prec[id];
        const muove = Math.abs(d) > 0.01;
        if (muove) this.dir[id] = d > 0 ? 1 : -1;
        this.prec[id] = v;
        const n = String(Math.round(v)).padStart(2, '0');
        const chiave = n + this.dir[id] + muove;
        if (o.ultimo === chiave) continue;
        o.ultimo = chiave;
        o.num.textContent = n;
        const x = o.fx, y = o.fy;
        o.freccia.setAttribute('d', this.dir[id] > 0 ? `M${x - 3.6} ${y + 3}L${x} ${y - 3.6}L${x + 3.6} ${y + 3}Z` : `M${x - 3.6} ${y - 3}L${x} ${y + 3.6}L${x + 3.6} ${y - 3}Z`);
        o.freccia.setAttribute('class', 'verbo-f' + (muove ? ' muove' : ''));
      }

      // quadranti
      QUADRANTI.forEach((q) => {
        const o = this.quadranti[q.id];
        const vu = res.umano[q.id], vl = res.lupo[q.id];
        const nu = Math.round(vu / 100 * TACCHE), nl = Math.round(vl / 100 * TACCHE);
        if (nu !== o.nu) { o.tacche.umano.forEach((t, k) => t.setAttribute('stroke', k < nu ? '#3B3534' : '#F3F0EE')); o.nu = nu; }
        if (nl !== o.nl) { o.tacche.lupo.forEach((t, k) => t.setAttribute('stroke', k < nl ? '#A89287' : '#F3F0EE')); o.nl = nl; }
        const tu = String(Math.round(vu)), tl = String(Math.round(vl));
        if (o.vu.textContent !== tu) o.vu.textContent = tu;
        if (o.vl.textContent !== tl) o.vl.textContent = tl;
      });

      // fattori: il piolo diventa rosso mentre il valore cambia
      if (!this._tagT || now - this._tagT > 250) {
        this._tagT = now;
        this.tags.forEach((g) => {
          const v = res.territorio[g.d.v];
          if (g.prec !== null && Math.abs(v - g.prec) > 0.15) g.t = now;
          g.prec = v;
          g.piolo.classList.toggle('cambia', now - g.t < 1200);
          const s = `${g.d.t}: ${Math.round(v)} (simulato)`;
          if (g.title.textContent !== s) g.title.textContent = s;
        });
      }

      // stato della convivenza: squilibrio tra le necessità e conflitto
      const media = (o) => (o.cibo + o.spazio + o.sicurezza + o.discendenza) / 4;
      const squilibrio = Math.abs(media(res.umano) - media(res.lupo));
      const conf = res.territorio.conflitto;
      const target = U.clamp((squilibrio - 6) / 30, 0, 1) * 0.6 + U.clamp((conf - 20) / 50, 0, 1) * 0.4;
      this.inst += (target - this.inst) * 0.05;
      const instabile = this.inst >= 0.35;
      const etichetta = instabile ? 'INSTABILE' : 'STABILE';
      const qi = Math.round(this.inst * 40);
      if (this._convKey !== etichetta + qi) {
        this._convKey = etichetta + qi;
        this.convTesto.textContent = etichetta;
        this.convTesto.style.fill = lerpColore('#3B3534', '#D6D6D6', U.clamp(this.inst / 0.8, 0, 1));
        const meta = (etichetta.length * 0.6 * 18 + (etichetta.length - 1) * 1.5) / 2;
        const a = 2361 - meta - 8, b = 2361 + meta + 8;
        const amp = this.inst * 7;
        const zig = (x0, x1) => {
          if (amp < 0.3) return `M${x0} 102H${x1}`;
          const n = Math.max(2, Math.round((x1 - x0) / 7));
          let d = `M${x0} 102`;
          for (let i = 1; i <= n; i++) d += `L${(x0 + (x1 - x0) * i / n).toFixed(1)} ${i === n ? 102 : (102 + (i % 2 ? -amp : amp)).toFixed(1)}`;
          return d;
        };
        this.convLinee.setAttribute('d', zig(2241, a) + zig(b, 2482));
        this.convPunti.setAttribute('d', `M${a} 102h0M${b} 102h0`);
      }

      // stato del conflitto
      this.conf += (conf - this.conf) * 0.08;
      const nb = Math.round(this.conf / 100 * BARRE.n);
      if (nb !== this._nb) { this._nb = nb; this.barre.forEach((b, i) => b.setAttribute('fill', i < nb ? '#EE4747' : '#F4F0EE')); }

      // eventi: grafico che scorre col calendario, ultimo evento
      const E = this.app.eventi, F = this.cfg.EVENTI.FINESTRA_GIORNI;
      if (E.versione !== this._evVer) { this._evVer = E.versione; this._disegnaPunti(); this._disegnaEvento(); }
      const gNow = E.giorno + E.acc / this.cfg.EVENTI.SECONDI_PER_GIORNO;
      this.punti.setAttribute('transform', `translate(${(GR.x - GR.w * gNow / F).toFixed(2)} 0)`);
      if (!E.ultimo && E.giorno !== this._gVuoto) { this._gVuoto = E.giorno; this._disegnaEvento(); }

      // verbale
      this._risposte(now);
      if (this._verbaleSporco) { this._verbaleSporco = false; this._disegnaVerbale(); }

      const Fp = this._fps;
      Fp.n++;
      if (now - Fp.t > 1000) { Fp.v = Fp.n * 1000 / (now - Fp.t); Fp.n = 0; Fp.t = now; }
      if (this.debug && (!this._dbgT || now - this._dbgT > 250)) { this._dbgT = now; this._renderDebug(); }
    }

    _renderDebug() {
      const app = this.app, sim = app.sim, bus = this.bus, res = sim.result;
      const f = (x) => (x === undefined ? '  -  ' : x.toFixed(1).padStart(5));
      let s = 'SLIDER         valore target  moto  presa\n';
      this.cfg.SLIDERS.forEach((sl) => {
        s += sl.id.padEnd(14) + f(bus.values[sl.id]) + '  ' + f(sim.targets[sl.id]) + ' ' + f(sim.motion[sl.id]) + '  ' + (bus.isHeld(sl.id) ? Array.from(bus.holds[sl.id]).join(',') : '') + '\n';
      });
      s += '\nTERRITORIO\n';
      Object.entries(res.territorio).forEach(([k, v]) => { s += k.padEnd(20) + f(v) + '\n'; });
      s += '\nNECESSITÀ       umano  lupo\n';
      ['cibo', 'spazio', 'sicurezza', 'discendenza'].forEach((b) => { s += b.padEnd(14) + f(res.umano[b]) + '  ' + f(res.lupo[b]) + '\n'; });
      s += '\nconvivenza (instabilità) ' + this.inst.toFixed(2) + '\n';
      const st = app.corridors.stats;
      s += '\nCORRIDOI (% lunghezza)\n';
      ['aperto', 'interrotto', 'trappola', 'conteso', 'tollerato'].forEach((k) => { s += k.padEnd(14) + f(st[k]) + '\n'; });
      s += '\nTAVOLA\n';
      Object.entries(app.territory.stats).forEach(([k, v]) => { s += k.padEnd(16) + (typeof v === 'number' ? f(v) : v) + '\n'; });
      s += '\nEVENTI  giorno ' + app.eventi.giorno + ' (' + app.eventi.data(app.eventi.giorno) + ')  totale ' + app.eventi.lista.length + '\n';
      s += 'console ' + (performance.now() - (app.consoleVista || -1e9) < 3000 ? 'collegata' : 'non collegata') + '\n';
      s += '\nfps ' + this._fps.v.toFixed(0) + '\n';
      document.getElementById('debug-text').textContent = s;
    }
  }

  DN.ui = { UI };

})(window.DN = window.DN || {});
