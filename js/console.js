/* =====================================================================
   CONSOLE — gli 8 slider su una pagina a parte (console.html).
   Non simula nulla: manda i gesti alla tavola (index.html) e mostra lo
   stato che la tavola rimanda, con le linee "chi spinge chi".
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const CAP_H = 40;   // altezza del cursore in px (come .fader-cap nel CSS)

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  class Console {
    constructor(cfg) {
      this.cfg = cfg;
      this.ids = cfg.SLIDERS.map((s) => s.id);
      this.faders = {};
      // stato ricevuto dalla tavola
      this.values = {}; this.targets = {}; this.held = {}; this.motion = {}; this.gesti = {};
      this.contributi = [];
      this.ids.forEach((id) => { this.values[id] = 50; this.motion[id] = 0; this.gesti[id] = 1e9; });
      this.mano = {};          // slider tenuti da questa console: id -> valore locale
      this.ultimoStato = 0;

      this.canale = new DN.link.Canale((m) => this._ricevi(m));
      this._build();
      this._bindKeys();
      this.stato = document.getElementById('collegamento');
      this.canale.send({ t: 'ciao' });
      setInterval(() => { if (performance.now() - this.ultimoStato > 2000) this.canale.send({ t: 'ciao' }); }, 1500);
      window.addEventListener('beforeunload', () => { Object.keys(this.mano).forEach((id) => this.canale.send({ t: 'release', id })); });

      const loop = (now) => { this.frame(now); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      const onResize = () => this._layoutPairs();
      window.addEventListener('resize', onResize);
      requestAnimationFrame(onResize);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
    }

    _ricevi(m) {
      if (!m || m.t !== 'stato') return;
      this.ultimoStato = performance.now();
      Object.assign(this.values, m.values);
      this.targets = m.targets || {};
      this.held = m.held || {};
      this.motion = m.motion || this.motion;
      this.gesti = m.gesti || this.gesti;
      this.contributi = m.contributi || [];
    }

    /* ---------------- gesti verso la tavola ------------------------------ */
    _set(id, v) {
      v = U.clamp(v, 0, 100);
      this.mano[id] = v;
      this.values[id] = v;
      this.canale.send({ t: 'set', id, v });
    }
    _release(id) {
      if (!(id in this.mano)) return;
      delete this.mano[id];
      this.canale.send({ t: 'release', id });
    }

    /* ---------------- costruzione ---------------------------------------- */
    _build() {
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
      this.linkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.linkSvg.setAttribute('class', 'link-arcs');
      this.linkSvg.innerHTML = '<defs><marker id="punta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#1A1A1A"/></marker></defs><g></g>';
      root.appendChild(this.linkSvg);
      this.consoleRoot = root;

      document.getElementById('btn-reset').addEventListener('click', () => this.canale.send({ t: 'reset' }));
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
        grabOffset = (e.clientY >= cap.top && e.clientY <= cap.bottom) ? e.clientY - (cap.top + cap.height / 2) : 0;
        this._set(s.id, valFromY(e.clientY - grabOffset));
      });
      track.addEventListener('pointermove', (e) => {
        if (!track.hasPointerCapture(e.pointerId)) return;
        this._set(s.id, valFromY(e.clientY - grabOffset));
      });
      const up = (e) => {
        if (track.hasPointerCapture && track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
        this._release(s.id);
      };
      track.addEventListener('pointerup', up);
      track.addEventListener('pointercancel', up);
      track.addEventListener('lostpointercapture', () => this._release(s.id));

      let kt = null;
      track.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 10 : 2;
        let d = 0;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = step;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -step;
        else return;
        e.preventDefault(); e.stopPropagation();
        this._set(s.id, this.values[s.id] + d);
        clearTimeout(kt);
        kt = setTimeout(() => this._release(s.id), 700);
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

    /* archi che collegano le categorie speculari */
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

    /* linee "chi spinge chi", dallo stato mandato dalla tavola */
    _linee() {
      const T = this.cfg.TEMPO;
      const rr = this.consoleRoot.getBoundingClientRect();
      const cap = {};
      for (const id in this.faders) {
        const b = this.faders[id].cap.getBoundingClientRect();
        cap[id] = [b.left + b.width / 2 - rr.left, b.top + b.height / 2 - rr.top, b.width];
      }
      const cimaGuide = Object.values(this.faders)[0].track.getBoundingClientRect().top - rr.top;
      let html = '';
      this.contributi.forEach(([i, j, c]) => {
        if (this._tenuto(j) || Math.abs(c) < T.SOGLIA_RISPOSTA) return;
        const muove = Math.abs((this.targets[j] !== undefined ? this.targets[j] : this.values[j]) - this.values[j]);
        const recente = this._tenuto(i) || (this.gesti[i] || 1e9) < 8000;
        if (!recente && muove < 1.2) return;
        const op = U.clamp(Math.abs(c) / 14, 0.25, 1) * (recente ? 1 : 0.55);
        const [x1, y1, w1] = cap[i], [x2, y2, w2] = cap[j];
        const dir = x2 > x1 ? 1 : -1;
        const sx = x1 + dir * w1 / 2, tx = x2 - dir * (w2 / 2 + 3);
        const h = Math.min(26 + Math.abs(tx - sx) * 0.18, (Math.min(y1, y2) - cimaGuide) / 0.75);
        html += `<path d="M${sx} ${y1} C${sx + dir * 20} ${y1 - h} ${tx - dir * 20} ${y2 - h} ${tx} ${y2}" style="opacity:${op.toFixed(2)};stroke-width:${(0.8 + Math.abs(c) / 20).toFixed(1)}" marker-end="url(#punta)"/>`;
        html += `<text x="${tx + dir * 4}" y="${y2 - 10}" style="opacity:${op.toFixed(2)}">${c > 0 ? '▲' : '▼'}</text>`;
      });
      if (html !== this._linkHtml) { this.linkSvg.querySelector('g').innerHTML = html; this._linkHtml = html; }
      this.linkSvg.setAttribute('width', rr.width); this.linkSvg.setAttribute('height', rr.height);
    }

    _tenuto(id) { return id in this.mano || !!this.held[id]; }

    _bindKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('fader-track') && e.key.startsWith('Arrow')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === 'r') this.canale.send({ t: 'reset' });
        else if (k === 'f') {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
          else document.exitFullscreen && document.exitFullscreen();
        }
      });
    }

    frame(now) {
      const collegata = performance.now() - this.ultimoStato < 2000;
      if (this.stato && this._collegata !== collegata) {
        this._collegata = collegata;
        this.stato.className = 'collegamento ' + (collegata ? 'attivo' : 'assente');
        this.stato.textContent = collegata ? 'tavola collegata' : 'in attesa della tavola: apri index.html';
      }
      for (const id in this.faders) {
        const f = this.faders[id];
        const v = id in this.mano ? this.mano[id] : this.values[id];
        const held = this._tenuto(id);
        if (Math.abs(v - f.last) > 0.01) {
          f.cap.style.bottom = `calc(${v}% - ${v * CAP_H / 100}px)`;
          f.value.textContent = Math.round(v);
          f.track.setAttribute('aria-valuenow', Math.round(v));
          f.last = v;
        }
        const tg = this.targets[id];
        if (tg !== undefined) f.target.style.bottom = `calc(${tg}% - ${tg * CAP_H / 100}px + ${CAP_H / 2}px)`;
        const g = held ? 0 : U.clamp(((this.motion[id] || 0) - 0.15) / 2.2, 0, 1);
        f.glow = f.glow * 0.85 + g * 0.15;
        f.root.style.setProperty('--moto', f.glow.toFixed(3));
        f.root.classList.toggle('held', held);
        f.root.classList.toggle('auto', f.glow > 0.08);
      }
      this._linee();
    }
  }

  const avvia = () => { DN.console = new Console(DN.config); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();

})(window.DN = window.DN || {});
