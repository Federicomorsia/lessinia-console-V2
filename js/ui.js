/* =====================================================================
   UI — console degli slider, bilancio dei bisogni, livelli, legenda,
   suggerimenti sui nodi, modalità debug.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;

  const BISOGNI = [
    { id: 'cibo', nome: 'Cibo' },
    { id: 'spazio', nome: 'Spazio' },
    { id: 'sicurezza', nome: 'Incolumità' },
    { id: 'discendenza', nome: 'Discendenza' }
  ];

  const CAP_H = 40;   // altezza del cursore in px (come .fader-cap nel CSS)

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  class UI {
    constructor(app) {
      this.app = app;
      this.cfg = app.cfg;
      this.bus = app.bus;
      this.faders = {};
      this.baseline = null;
      this.lastUserMove = -Infinity;
      this.debug = false;
      this._fps = { n: 0, t: performance.now(), v: 0 };

      this._buildConsole();
      this._buildBilancio();
      this._buildLegenda();
      this._bindLegenda();
      this._bindButtons();
      this._bindMap();
      this._bindKeys();

      // registro delle risposte e linee "chi spinge chi"
      this.registro = [];
      this.registroChiavi = new Map();
      this.inizioPresa = {};
      this.ultimoGesto = {};
      this.nomi = {};
      this.slider = {};
      this.cfg.SLIDERS.forEach((s) => { this.nomi[s.id] = s.nome; this.slider[s.id] = s; });

      this.bus.on('hold', (id) => {
        // la freccia mostra la variazione causata dall'ultimo movimento dell'utente:
        // il riferimento si fissa quando la mano afferra uno slider libero
        if (!this._tenendo) this.baseline = JSON.parse(JSON.stringify({ umano: app.sim.result.umano, lupo: app.sim.result.lupo }));
        this._tenendo = true;
        this.inizioPresa[id] = this.bus.values[id];
      });
      this.bus.on('release', (id) => {
        this._tenendo = this.bus.anyHeld();
        const da = this.inizioPresa[id], a = this.bus.values[id];
        if (da !== undefined && Math.abs(a - da) >= 2) {
          this._scrivi('mano', `<b>${this.nomi[id]}</b> ${this._verso(id, a > da)} · ${Math.round(a)} <span>Posizione depositata. Le altre voci rispondono.</span>`);
        }
        delete this.inizioPresa[id];
      });
      this.bus.on('set', (id) => { this.lastUserMove = performance.now(); this.ultimoGesto[id] = performance.now(); });
      this.bus.on('reset', () => {
        this.baseline = null; this._tenendo = false;
        this.registro = []; this.registroChiavi.clear();
        this._scrivi('sistema', 'Seduta riaperta. Tutte le voci tornano a 50. I debiti non sono azzerati.');
      });
    }

    /* direzione di uno slider a parole, con il nome del suo estremo;
       vuota se l'estremo ripete il nome dello slider */
    _verso(id, su) {
      const s = this.slider[id], testo = su ? s.dx : s.sx;
      return testo.toUpperCase() === s.nome ? '' : `<em>${testo}</em>`;
    }

    /* aggiunge una riga al registro delle risposte */
    _scrivi(tipo, html, chiave) {
      const now = performance.now();
      if (chiave) {
        const last = this.registroChiavi.get(chiave);
        if (last && now - last < 25000) return;
        this.registroChiavi.set(chiave, now);
      }
      this.registro.unshift({ tipo, html, t: now });
      this.registro = this.registro.slice(0, 40);   // cronologia: le voci più vecchie sbiadiscono e scorrono in basso
      this._registroSporco = true;
    }

    /* ---------------------------------------------------------------
       Console: due metà a specchio. Le coppie speculari sono
       simmetriche rispetto all'asse centrale: cibo al centro,
       discendenza all'esterno, e archi le collegano.
       --------------------------------------------------------------- */
    _buildConsole() {
      const root = document.getElementById('console');
      const byId = {};
      this.cfg.SLIDERS.forEach((s) => { byId[s.id] = s; });
      const umano = this.cfg.COPPIE.map((c) => c.umano).reverse();
      const lupo = this.cfg.COPPIE.map((c) => c.lupo);

      const halves = el('div', 'console-halves');
      const mk = (ids, side) => {
        const half = el('div', 'console-half ' + side);
        const head = el('div', 'half-head', side === 'umano'
          ? '<i class="specie">Homo sapiens</i> <span class="half-nota">azioni diverse, di soggetti diversi</span>'
          : '<i class="specie">Canis lupus</i> <span class="half-nota">comportamenti osservabili, descritti da <i>Homo sapiens</i></span>');
        const row = el('div', 'fader-row');
        ids.forEach((id) => row.appendChild(this._fader(byId[id])));
        half.appendChild(head); half.appendChild(row);
        return half;
      };
      halves.appendChild(mk(umano, 'umano'));
      halves.appendChild(el('div', 'console-axis'));
      halves.appendChild(mk(lupo, 'lupo'));
      root.appendChild(halves);

      this.pairSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.pairSvg.setAttribute('class', 'pair-arcs');
      root.appendChild(this.pairSvg);
      // linee delle influenze: dallo slider che spinge a quelli che rispondono
      this.linkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.linkSvg.setAttribute('class', 'link-arcs');
      this.linkSvg.innerHTML = '<defs><marker id="punta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#1A1A1A"/></marker></defs><g></g>';
      root.appendChild(this.linkSvg);
      this.consoleRoot = root;
    }

    _fader(s) {
      const f = el('div', 'fader ' + s.animale);
      f.innerHTML = `
        <i class="fader-led"></i>
        <div class="fader-coppia">${s.coppia}</div>
        <div class="fader-end top">${s.dx}</div>
        <div class="fader-segno" aria-hidden="true">+</div>
        <div class="fader-corpo">
          <div class="fader-name">${s.nome}</div>
          <div class="fader-track" tabindex="0" role="slider" aria-label="${s.nome}" aria-valuemin="0" aria-valuemax="100">
            <div class="fader-slot"></div>
            <div class="fader-target"></div>
            <div class="fader-cap"></div>
          </div>
          <div class="fader-value">50</div>
        </div>
        <div class="fader-segno" aria-hidden="true">−</div>
        <div class="fader-end bottom">${s.sx}</div>`;
      const track = f.querySelector('.fader-track');
      const valFromY = (cy) => {
        const r = track.getBoundingClientRect();
        return U.clamp((1 - (cy - r.top - CAP_H / 2) / (r.height - CAP_H)) * 100, 0, 100);
      };
      let grabOffset = 0;
      track.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        track.setPointerCapture(e.pointerId);
        track.focus({ preventScroll: true });
        const cap = f.querySelector('.fader-cap').getBoundingClientRect();
        // se si afferra il cappuccio non salta: si mantiene l'offset
        grabOffset = (e.clientY >= cap.top && e.clientY <= cap.bottom) ? e.clientY - (cap.top + cap.height / 2) : 0;
        this.bus.set(s.id, valFromY(e.clientY - grabOffset), 'mano');
      });
      track.addEventListener('pointermove', (e) => {
        if (!track.hasPointerCapture(e.pointerId)) return;
        this.bus.set(s.id, valFromY(e.clientY - grabOffset), 'mano');
      });
      const up = (e) => {
        if (track.hasPointerCapture && track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
        this.bus.release(s.id, 'mano');
      };
      track.addEventListener('pointerup', up);
      track.addEventListener('pointercancel', up);
      track.addEventListener('lostpointercapture', () => this.bus.release(s.id, 'mano'));

      let kt = null;
      track.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 2;
        let d = 0;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = step;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -step;
        else return;
        e.preventDefault(); e.stopPropagation();
        this.bus.set(s.id, this.bus.values[s.id] + d, 'tastiera');
        clearTimeout(kt);
        kt = setTimeout(() => this.bus.release(s.id, 'tastiera'), 700);
      });

      this.faders[s.id] = {
        root: f, track,
        cap: f.querySelector('.fader-cap'),
        target: f.querySelector('.fader-target'),
        value: f.querySelector('.fader-value'),
        last: -1, glow: 0
      };
      return f;
    }

    /* archi che collegano le categorie speculari: cibo la più interna, discendenza la più esterna */
    _layoutPairs() {
      const svg = this.pairSvg, rr = this.consoleRoot.getBoundingClientRect();
      const passo = 13, primo = 9, raggio = 4;
      const w = rr.width, h = primo + passo * (this.cfg.COPPIE.length - 1) + 7;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      let html = '';
      this.cfg.COPPIE.forEach((c, i) => {
        const a = this.faders[c.umano].track.getBoundingClientRect();
        const b = this.faders[c.lupo].track.getBoundingClientRect();
        const xa = a.left + a.width / 2 - rr.left, xb = b.left + b.width / 2 - rr.left;
        const y = primo + i * passo, mid = (xa + xb) / 2;
        html += `<path d="M${xa} 0 V${y - raggio} Q${xa} ${y} ${xa + raggio} ${y} H${xb - raggio} Q${xb} ${y} ${xb} ${y - raggio} V0"/>`;
        html += `<rect x="${mid - 48}" y="${y - 6}" width="96" height="12"/>`;
        html += `<text x="${mid}" y="${y + 3.5}">${c.id}</text>`;
      });
      svg.innerHTML = html;
    }

    /* ---------------------------------------------------------------
       Bilancio dei bisogni: due colonne speculari, stesse quattro barre
       --------------------------------------------------------------- */
    _buildBilancio() {
      const root = document.getElementById('bilancio');
      root.appendChild(el('div', 'bil-head', '<span><i class="specie">Homo sapiens</i></span><span class="bil-title">bisogni</span><span><i class="specie">Canis lupus</i></span>'));
      this.bars = {};
      BISOGNI.forEach((b) => {
        const row = el('div', 'bil-row');
        row.innerHTML = `
          <span class="bil-arrow umano"></span>
          <div class="bil-bar umano"><div class="bil-fill"></div><span class="bil-num"></span></div>
          <span class="bil-label">${b.nome}</span>
          <div class="bil-bar lupo"><div class="bil-fill"></div><span class="bil-num"></span></div>
          <span class="bil-arrow lupo"></span>`;
        root.appendChild(row);
        this.bars[b.id] = {
          umano: { fill: row.querySelector('.bil-bar.umano .bil-fill'), num: row.querySelector('.bil-bar.umano .bil-num'), arrow: row.querySelector('.bil-arrow.umano') },
          lupo: { fill: row.querySelector('.bil-bar.lupo .bil-fill'), num: row.querySelector('.bil-bar.lupo .bil-num'), arrow: row.querySelector('.bil-arrow.lupo') }
        };
      });
      root.appendChild(el('p', 'bil-note', 'Le frecce indicano la variazione dall\'ultimo gesto. I valori sono simulati e misurati dalla sola specie che sa misurare. Nessun equilibrio è stato raggiunto: i costi cambiano di posto.'));
      // il registro (cronologia della negoziazione) sta subito sotto i bisogni
      const reg = el('section', 'registro');
      reg.innerHTML = '<h2>Verbale</h2><p class="reg-nota">Ogni gesto resta dove è stato lasciato. Le altre voci rispondono: le linee sulla console mostrano chi spinge chi, qui sotto il motivo. Il verbale registra ciò che accade sulla tavola, non ciò che è stato voluto. In alto la voce più recente.</p><ol id="registro-lista"></ol>';
      root.after(reg);
      this.registroEl = reg.querySelector('ol');
    }

    /* ---------------------------------------------------------------
       Chi spinge chi: linee sulla console e frasi nel registro
       --------------------------------------------------------------- */
    _risposte(now) {
      const sim = this.app.sim, bus = this.bus, T = this.cfg.TEMPO;
      const rr = this.consoleRoot.getBoundingClientRect();
      const cap = {};
      for (const id in this.faders) {
        const b = this.faders[id].cap.getBoundingClientRect();
        cap[id] = [b.left + b.width / 2 - rr.left, b.top + b.height / 2 - rr.top, b.width];
      }
      const cimaGuide = Object.values(this.faders)[0].track.getBoundingClientRect().top - rr.top;
      let html = '';
      const targets = sim.targets;
      for (const j in this.faders) {
        if (bus.isHeld(j)) continue;
        const muove = Math.abs((targets[j] || bus.values[j]) - bus.values[j]);
        (sim.contributi[j] || []).forEach((o) => {
          const i = o.da, c = o.c;
          if (Math.abs(c) < T.SOGLIA_RISPOSTA) return;
          const recente = bus.isHeld(i) || now - (this.ultimoGesto[i] || -1e9) < 8000;
          if (!recente && muove < 1.2) return;
          const op = U.clamp(Math.abs(c) / 14, 0.25, 1) * (recente ? 1 : 0.55);
          const [x1, y1, w1] = cap[i], [x2, y2, w2] = cap[j];
          const dir = x2 > x1 ? 1 : -1;
          const sx = x1 + dir * w1 / 2, tx = x2 - dir * (w2 / 2 + 3);
          // l'arco resta all'altezza delle guide, sotto le scritte dei moduli:
          // il colmo di una Bézier cubica simmetrica sta a 3/4 dell'altezza dei punti di controllo
          const h = Math.min(26 + Math.abs(tx - sx) * 0.18, (Math.min(y1, y2) - cimaGuide) / 0.75);
          html += `<path d="M${sx} ${y1} C${sx + dir * 20} ${y1 - h} ${tx - dir * 20} ${y2 - h} ${tx} ${y2}" style="opacity:${op.toFixed(2)};stroke-width:${(0.8 + Math.abs(c) / 20).toFixed(1)}" marker-end="url(#punta)"/>`;
          html += `<text x="${tx + dir * 4}" y="${y2 - 10}" style="opacity:${op.toFixed(2)}">${c > 0 ? '▲' : '▼'}</text>`;
        });
      }
      if (html !== this._linkHtml) { this.linkSvg.querySelector('g').innerHTML = html; this._linkHtml = html; }
      this.linkSvg.setAttribute('width', rr.width); this.linkSvg.setAttribute('height', rr.height);

      // frasi: per ogni slider che si sta muovendo, la spinta principale
      if (!this._regT || now - this._regT > 400) {
        this._regT = now;
        for (const j in this.faders) {
          if (bus.isHeld(j)) continue;
          const d = (targets[j] || bus.values[j]) - bus.values[j];
          if (Math.abs(d) < 2) continue;
          let best = null;
          (sim.contributi[j] || []).forEach((o) => { if (Math.sign(o.c) === Math.sign(d) && Math.abs(o.c) >= T.SOGLIA_RISPOSTA && (!best || Math.abs(o.c) > Math.abs(best.c))) best = o; });
          if (!best) continue;
          const i = best.da, e = this.cfg.W[i][j];
          const su = bus.values[i] > 50;
          const frase = su ? e.su : e.giu;
          this._scrivi('risposta',
            `<b>${this.nomi[i]}</b> ${this._verso(i, su)} → <b>${this.nomi[j]}</b> ${this._verso(j, d > 0)} <span>${frase}</span>`,
            i + '>' + j + (d > 0 ? '+' : '-'));
        }
      }
      if (this._registroSporco || !this._regRender || now - this._regRender > 1000) {
        this._registroSporco = false; this._regRender = now;
        this.registroEl.innerHTML = !this.registro.length
          ? '<li class="sistema">Alla seduta risulta assente <i>Canis lupus</i>. La sedia non è rimossa. Muovi uno slider per aprire il verbale.</li>'
          : this.registro.map((r) => {
          const age = (now - r.t) / 1000;
          const op = U.clamp(1 - (age - 20) / 40, 0.25, 1);
          return `<li class="${r.tipo}" style="opacity:${op.toFixed(2)}">${r.html}</li>`;
        }).join('');
      }
    }

    /* ---------------------------------------------------------------
       Legenda: un gruppo per livello, ognuno si accende e si spegne
       dalla propria casella. Vive in un pannello a scomparsa sulla mappa.
       --------------------------------------------------------------- */
    toggleLayer(k) {
      const l = this.cfg.LIVELLI[k];
      const inp = l && document.querySelector(`#legenda input[data-id="${l.id}"]`);
      if (!inp) return;
      inp.checked = !inp.checked;
      inp.dispatchEvent(new Event('change'));
    }

    _buildLegenda() {
      const P = DN.render.PAL, S = DN.render.SIMBOLI, KK = DN.territory.K;
      const ink = P.inchiostro, acc = P.accento, fo = P.foglio;
      const svg = (inner) => `<svg class="lg" viewBox="0 0 34 14">${inner}</svg>`;
      const matrice = (k) => ({ canvas: k });
      const croce = (x, y, r) => `M${x - r} ${y - r}l${2 * r} ${2 * r}M${x + r} ${y - r}l${-2 * r} ${2 * r}`;
      // un gruppo per ciascun livello, nello stesso ordine dei tasti 1–8
      const voci = {
        suolo: ['Matrice del suolo', 'OpenStreetMap', [
          [matrice(KK.BOSCO), 'bosco'],
          [svg(`<rect x="1.5" y="1.5" width="31" height="11" fill="${fo}" stroke="${P.tintaScura}" stroke-width=".6"/>`), 'prateria, pascolo'],
          [matrice(KK.ARBUSTO), 'arbusteto, ex pascolo'],
          [matrice(KK.ROCCIA), 'roccia'],
          [matrice(KK.ABITATO), 'paesi e contrade']
        ]],
        umano: ['Presenza di <i>Homo sapiens</i>', 'simulata', [
          [svg(`<rect x="1" y="1" width="32" height="12" fill="#96978F" fill-opacity=".16"/>`), 'paesi, pascoli attivi, strade']
        ]],
        lupo: ['Presenza di <i>Canis lupus</i>', 'simulata', [
          [svg(`<rect x="1.5" y="1.5" width="31" height="11" rx="5.5" fill="none" stroke="${ink}" stroke-opacity=".8" stroke-width=".8" stroke-dasharray="3 2.2"/>` +
            [6, 11, 16, 21, 26].map((x, i) => `<circle cx="${x + (i % 2) * 2.5}" cy="${i % 2 ? 5 : 9}" r=".7" fill="${ink}" fill-opacity=".55"/>`).join('')), 'area di presenza'],
          [svg(`<rect x="1.5" y="1.5" width="31" height="11" rx="5.5" fill="none" stroke="${ink}" stroke-opacity=".8" stroke-width=".8" stroke-dasharray="1.2 2.2"/>`), 'presenza frammentata']
        ]],
        conflitti: ['Zone di conflitto', 'simulate', [
          [svg([7, 15, 23].map((x) => `<circle cx="${x}" cy="${x === 15 ? 5 : 9}" r="2" fill="none" stroke="${acc}" stroke-width=".8"/>`).join('')), 'uccisione di bovini e ovicaprini'],
          [svg([7, 15, 23].map((x) => `<circle cx="${x}" cy="${x === 15 ? 5 : 9}" r="1.2" fill="${acc}"/>`).join('')), 'margine delle contrade'],
          [svg(`<path d="${croce(8, 7, 2)}${croce(17, 7, 2)}${croce(26, 7, 2)}" stroke="${acc}" stroke-width=".9"/>`), 'trappola (uccisioni)'],
          [svg(`<rect x="7" y="3.5" width="5" height="5" fill="none" stroke="${ink}" stroke-opacity=".6" stroke-width=".6"/><rect x="20" y="6" width="5" height="5" fill="none" stroke="${ink}" stroke-opacity=".6" stroke-width=".6"/>`), 'pascolo custodito']
        ]],
        corridoi: ['Corridoi e attraversamenti', 'simulati', [
          [svg(`<path d="M2 7H31M28 4.5L31 7L28 9.5" stroke="${ink}" stroke-width="1.1" fill="none"/>`), 'aperto'],
          [svg(`<path d="M2 7H31" stroke="${ink}" stroke-width="1.1" stroke-dasharray="5 4"/>`), 'non contrastato'],
          [svg(`<path d="M2 7H31" stroke="${acc}" stroke-width="1.1"/>`), 'conteso'],
          [svg(`<path d="M2 7H31" stroke="${ink}" stroke-width="1.1"/><path d="${croce(10, 7, 2)}${croce(22, 7, 2)}" stroke="${acc}" stroke-width=".9"/>`), 'trappola'],
          [svg(`<path d="M2 7H13M21 7H31" stroke="${ink}" stroke-width="1.1"/><path d="M15.5 2V12M18.5 2V12" stroke="${acc}" stroke-width="1"/>`), 'interrotto'],
          [svg(`<circle cx="17" cy="7" r="4" fill="${acc}" stroke="${fo}" stroke-width="1"/>`), 'nodo di conflitto'],
          [svg(`<circle cx="17" cy="7" r="4" fill="${fo}" stroke="${ink}" stroke-width=".9"/><circle cx="17" cy="7" r="1.3" fill="${ink}"/>`), 'nodo senza conflitto registrato']
        ]],
        viabilita: ['Strade e sentieri', 'OpenStreetMap', [
          [svg(`<path d="M2 7H32" stroke="${ink}" stroke-width="3.2"/><path d="M2 7H32" stroke="${fo}" stroke-width="1.5"/>`), 'strada principale'],
          [svg(`<path d="M2 7H32" stroke="${ink}" stroke-opacity=".6" stroke-width=".8"/>`), 'strada locale'],
          [svg(`<path d="M2 7H32" stroke="${ink}" stroke-opacity=".3" stroke-width=".7" stroke-dasharray="1.5 3"/>`), 'strada locale chiusa'],
          [svg(`<path d="M2 7H32" stroke="${ink}" stroke-opacity=".45" stroke-width=".7" stroke-dasharray="3.5 2.5"/>`), 'sentiero']
        ]],
        documentati: ['Uccisioni documentate', 'dato reale', [
          [svg(`<rect x="11.5" y="2.5" width="9" height="9" fill="${fo}" stroke="${acc}" stroke-width=".9"/><rect x="15.2" y="6.2" width="1.6" height="1.6" fill="${acc}"/><text x="23" y="10" font-size="7.5" font-style="italic" fill="${acc}" font-family="Newsreader, Georgia, serif">40</text>`), 'eventi per malga, 2012–2024'],
          [svg(`<rect x="14.5" y="4.5" width="5" height="5" fill="${ink}"/>`), 'malga con pascolo attivo'],
          [svg(`<rect x="14.5" y="4.5" width="5" height="5" fill="none" stroke="${P.inchiostro3}" stroke-width=".7"/>`), 'malga senza pascolo']
        ]],
        rilievo: ['Isoipse, acque, nomi', 'TINITALY · OpenStreetMap', [
          [svg(`<path d="M2 10 C9 6 16 11 32 5" stroke="${ink}" stroke-opacity=".3" stroke-width=".6" fill="none"/><path d="M2 13 C10 9 18 13 32 9" stroke="${ink}" stroke-opacity=".15" stroke-width=".5" fill="none"/>`), 'isoipse ogni 50 m'],
          [svg(`<path d="M2 9 C10 3 22 13 32 6" stroke="${P.acqua}" stroke-opacity=".7" stroke-width=".9" fill="none"/>`), 'corsi d\'acqua'],
          [svg(`<text x="2" y="10" font-size="7" letter-spacing="1" fill="${ink}" font-family="Newsreader, Georgia, serif">ERBEZZO</text>`), 'paese; da vicino anche contrade e malghe']
        ]]
      };
      const root = document.getElementById('legenda');
      this.cfg.LIVELLI.forEach((l, n) => {
        const [titolo, fonte, list] = voci[l.id];
        const g = el('div', 'lg-group' + (l.on ? '' : ' spento'));
        const testa = el('label', 'lg-head');
        testa.innerHTML = `<input type="checkbox" id="liv-${l.id}" data-id="${l.id}" ${l.on ? 'checked' : ''}><span class="lg-title">${titolo}</span><span class="lg-fonte-breve">${fonte}</span><span class="key">${n + 1}</span>`;
        testa.querySelector('input').addEventListener('change', (e) => {
          this.app.renderer.setLayer(l.id, e.target.checked);
          g.classList.toggle('spento', !e.target.checked);
        });
        g.appendChild(testa);
        list.forEach(([sym, txt]) => {
          const item = el('div', 'lg-item');
          if (typeof sym === 'string') item.innerHTML = sym;
          else {
            const c = document.createElement('canvas'), d = window.devicePixelRatio || 1;
            c.className = 'lg'; c.width = 34 * d; c.height = 14 * d;
            const x = c.getContext('2d'); x.scale(d, d);
            const s = S[sym.canvas];
            if (s.modo === 'tinta') { x.fillStyle = s.colore; x.fillRect(1, 1, 32, 12); }
            else {
              // nella legenda il pattern è più fitto, per leggerlo in poco spazio
              const p = new Path2D(), u = 7;
              for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) s.add(p, 5 + i * u + (j % 2) * 3.5, 4 + j * 6, u * (s.modo === 'fill' ? 1.4 : 0.9), i, j);
              x.strokeStyle = x.fillStyle = P.inchiostro; x.lineCap = 'round'; x.globalAlpha = Math.min(1, s.alpha + 0.2);
              if (s.modo === 'fill') x.fill(p); else { x.lineWidth = s.lw(8); x.stroke(p); }
            }
            item.appendChild(c);
          }
          item.appendChild(el('span', '', txt));
          g.appendChild(item);
        });
        root.appendChild(g);
      });
      root.appendChild(el('p', 'lg-fonte', DN.datiLessinia.meta.attribuzioni));
    }

    /* pannello della legenda: chiuso di default, si ricorda lo stato per chi guarda */
    _bindLegenda() {
      const pan = document.getElementById('leg-pannello');
      const apri = document.getElementById('leg-apri');
      const chiudi = document.getElementById('leg-chiudi');
      const imposta = (aperto, fuoco) => {
        pan.classList.toggle('aperto', aperto);
        pan.inert = !aperto;
        apri.setAttribute('aria-expanded', String(aperto));
        apri.classList.toggle('nascosta', aperto);
        try { localStorage.setItem('dn-legenda', aperto ? '1' : '0'); } catch (e) { /* storage non disponibile */ }
        if (fuoco) (aperto ? chiudi : apri).focus({ preventScroll: true });
      };
      apri.addEventListener('click', () => imposta(true, true));
      chiudi.addEventListener('click', () => imposta(false, true));
      this.legenda = (aperto) => imposta(aperto === undefined ? !pan.classList.contains('aperto') : aperto, false);
      let iniziale = false;
      try { iniziale = localStorage.getItem('dn-legenda') === '1'; } catch (e) { /* storage non disponibile */ }
      imposta(iniziale, false);
    }

    _bindButtons() {
      document.getElementById('btn-reset').addEventListener('click', () => this.app.reset());
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

    _bindMap() {
      const canvas = this.app.renderer.canvas;
      const tip = document.getElementById('tooltip');
      const R = this.app.renderer, T = this.app.territory, CF = DN.territory.CONFLITTO;
      const pct = (x) => Math.round(x * 100) + '%';
      const COSTI = {
        [CF.PREDAZIONE]: ['Zona di uccisioni', 'Bovini e ovicaprini uccisi al pascolo incustodito. Ogni capo ucciso apre un debito.', 'Si nutre di bovini e ovicaprini al pascolo. Esposizione all\'uccisione.'],
        [CF.MARGINE]: ['Margine delle contrade', 'presenze vicino alle case, paura', 'Attraversamento tra cani e luci. Esposizione all\'uccisione.'],
        [CF.TRAPPOLA]: ['Zona trappola', 'conflitto che si ripete ogni stagione', 'Qui si uccide chi passa.'],
        [CF.PRESIDIO]: ['Pascolo custodito', 'lavoro di custodia: recinti, cani, pastore', 'Mandrie e greggi non risultano accessibili. Il mancato passaggio non vale assenso.']
      };
      // --- zoom e trascinamento -------------------------------------------
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
        const passo = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0018;   // righe, pizzico sul trackpad, pixel
        R.zoomA(Math.exp(-e.deltaY * passo), mx, my);
        tip.hidden = true;
      }, { passive: false });
      canvas.addEventListener('dblclick', (e) => { const [mx, my] = locale(e); R.zoomA(e.shiftKey ? 0.5 : 2, mx, my); });
      document.querySelectorAll('.map-comandi button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const z = btn.dataset.zoom;
          if (z === 'piu') R.zoomA(1.5); else if (z === 'meno') R.zoomA(1 / 1.5); else R.inquadra(z);
        });
      });
      // scala grafica
      const barra = document.querySelector('.map-scala-barra'), etichetta = document.querySelector('.map-scala-km');
      const cellaKm = DN.datiLessinia.meta.cella_m / 1000;
      R.onView = () => {
        const kmPx = cellaKm / R.k;
        const passi = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
        let km = passi[0];
        passi.forEach((p) => { if (p / kmPx <= 120) km = p; });
        barra.style.width = (km / kmPx).toFixed(1) + 'px';
        etichetta.textContent = km < 1 ? Math.round(km * 1000) + ' m' : km + ' km';
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
        if (h.tipo === 'nodo') {
          const n = h.n;
          cls += n.conflitto ? ' conflitto' : ' convivenza';
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

    _bindKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('fader-track') && e.key.startsWith('Arrow')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'd') this.toggleDebug();
        else if (k === 'r') this.app.reset();
        else if (k === 'l') this.legenda();
        else if (k === 'escape') this.legenda(false);
        else if (k === '+' || k === '=') this.app.renderer.zoomA(1.5);
        else if (k === '-') this.app.renderer.zoomA(1 / 1.5);
        else if (k === '0') this.app.renderer.inquadra('adatta');
        else if (k === 'f') {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
          else document.exitFullscreen && document.exitFullscreen();
        } else if (/^[1-8]$/.test(k)) this.toggleLayer(parseInt(k, 10) - 1);
      });
    }

    toggleDebug() {
      this.debug = !this.debug;
      document.getElementById('debug').hidden = !this.debug;
    }

    layout() { this._layoutPairs(); }

    /* ---------------------------------------------------------------
       Aggiornamento a ogni frame
       --------------------------------------------------------------- */
    frame(now) {
      const sim = this.app.sim, bus = this.bus;
      // fader: posizione, alone quando si muovono da soli, mano dell'utente
      for (const id in this.faders) {
        const f = this.faders[id];
        const v = bus.values[id];
        const held = bus.isHeld(id);
        if (Math.abs(v - f.last) > 0.01) {
          f.cap.style.bottom = `calc(${v}% - ${v * CAP_H / 100}px)`;
          f.value.textContent = Math.round(v);
          f.track.setAttribute('aria-valuenow', Math.round(v));
          f.last = v;
        }
        const tg = sim.targets[id];
        if (tg !== undefined) f.target.style.bottom = `calc(${tg}% - ${tg * CAP_H / 100}px + ${CAP_H / 2}px)`;
        const g = held ? 0 : U.clamp((sim.motion[id] - 0.15) / 2.2, 0, 1);
        f.glow = f.glow * 0.85 + g * 0.15;
        f.root.style.setProperty('--moto', f.glow.toFixed(3));
        f.root.classList.toggle('held', held);
        f.root.classList.toggle('auto', f.glow > 0.08);
      }

      this._risposte(now);

      // bilancio
      const res = sim.result;
      const since = (now - this.lastUserMove) / 1000;
      const fade = U.clamp(1 - (since - this.cfg.TEMPO.FRECCE_DURATA * 0.7) / (this.cfg.TEMPO.FRECCE_DURATA * 0.3), 0, 1);
      BISOGNI.forEach((b) => {
        ['umano', 'lupo'].forEach((who) => {
          const o = this.bars[b.id][who];
          const v = res[who][b.id];
          o.fill.style.width = v.toFixed(1) + '%';
          o.num.textContent = Math.round(v);
          let txt = '', cls = 'bil-arrow ' + who;
          if (this.baseline && fade > 0) {
            const d = v - this.baseline[who][b.id];
            if (Math.abs(d) >= 0.5) {
              txt = (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0);
              cls += d > 0 ? ' su' : ' giu';
            }
          }
          if (o.arrow.textContent !== txt) o.arrow.textContent = txt;
          o.arrow.className = cls;
          o.arrow.style.opacity = fade;
        });
      });

      // fps
      const F = this._fps;
      F.n++;
      if (now - F.t > 1000) { F.v = F.n * 1000 / (now - F.t); F.n = 0; F.t = now; }
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
      s += '\nBISOGNI         umano  lupo\n';
      BISOGNI.forEach((b) => { s += b.id.padEnd(14) + f(res.umano[b.id]) + '  ' + f(res.lupo[b.id]) + '\n'; });
      const st = app.corridors.stats;
      s += '\nCORRIDOI (% lunghezza)\n';
      ['aperto', 'interrotto', 'trappola', 'conteso', 'tollerato'].forEach((k) => { s += k.padEnd(14) + f(st[k]) + '\n'; });
      s += 'aree lupo        ' + st.aree + '\n';
      s += 'disegnati/misur. ' + st.percorsiDisegnati + '/' + st.percorsiMisurati + '\n';
      s += 'passaggi faunist. ' + st.passaggi + '\n';
      s += 'nodi              ' + app.corridors.nodi.length + '\n';
      s += 'calcolo           ' + app.corridors.tempoCalcolo.toFixed(1) + ' ms\n';
      s += '\nTAVOLA\n';
      Object.entries(app.territory.stats).forEach(([k, v]) => { s += k.padEnd(16) + (typeof v === 'number' ? f(v) : v) + '\n'; });
      const p = app.territory.percentuali();
      Object.entries(p).forEach(([k, v]) => { s += ('% ' + k).padEnd(16) + f(v) + '\n'; });
      s += '\nANCORE  ' + Object.entries(sim.ancore).map(([k, v]) => k.slice(0, 4) + ' ' + v.toFixed(0)).join('  ') + '\n';
      s += '\nfps ' + this._fps.v.toFixed(0) + '\n';
      document.getElementById('debug-text').textContent = s;
    }
  }

  DN.ui = { UI, BISOGNI };

})(window.DN = window.DN || {});
