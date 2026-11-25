/* =====================================================================
   TRATTATO — Atto I, collegato agli slider della console.
   Viene dal prototipo trattato/prototipo-originale/atto1.html: stessa
   grammatica (voce, inchiostro, barratura, riformulazione), stesse soglie
   e isteresi. Cambia che:
   - gli slider non sono più simulati: arrivano dalla tavola (index.html),
     che li riceve dalla console (console.html), attraverso DN.link;
   - niente negoziazione automatica né riposo: la memoria degli slider è
     quella del dispositivo;
   - la riformulazione la muove ABITARE (invertito), non più PRESIDIARE:
     vedi trattato/docs/PROTOTIPO_ATTO1.md §3;
   - il testo usa Homo sapiens e Canis lupus (LESSICO_TRATTATO.md §4.2);
   - accanto alla colonna, un banco che dice che cosa modifica il testo.
   ===================================================================== */
(function (DN) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOMI = {};
  DN.config.SLIDERS.forEach((s) => { NOMI[s.id] = s.nome; });

  /* ---------- filtri ink bleed (come nel prototipo) ---------- */
  (function () {
    let h = '';
    for (let i = 1; i <= 8; i++) for (let v = 0; v < 3; v++) {
      const rx = (0.08 + i * 0.17).toFixed(2), ry = (0.08 + i * 0.19).toFixed(2), sb = (0.55 + i * 0.14).toFixed(2);
      h += `<filter id="k${i}_${v}" x="-70%" y="-50%" width="240%" height="200%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="2" seed="${i * 11 + v * 5}" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="${(0.8 + i * 0.8).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feMorphology in="d" operator="dilate" radius="${rx} ${ry}" result="f"/>
        <feGaussianBlur in="f" stdDeviation="${sb}" result="b"/>
        <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.180  0 0 0 0 0.165  0 0 0 0 0.161  0 0 0 26 -11"/>
      </filter>`;
    }
    $('#fdefs').innerHTML = h;
  })();

  /* ---------- testo marcato ----------
     {h|..} Homo sapiens  {w|..} Canis lupus e gli altri viventi  {x|..} strumenti della caccia (inchiostro)
     {i|..} corsivo   {s:id} passaggio conteso   {a:id} clausola aggiunta   {c:id} formula barrabile
     front: motore del fronte di voce (da −1 a 1), dir: 1 dall'inizio, −1 dalla fine */
  const ARTS = [
    { n: 1, dir: 1, front: (s) => s.v + 0.05,
      src: 'Noi, Delegazione per {w|Canis lupus}, presentiamo protesta formale contro {h|Homo sapiens} per {s:a1} di {w|Canis lupus} dalla Lessinia e dalle terre che la circondano. La protesta riguarda una politica durata {s:a1b}, condotta con {x|premi in denaro}, {x|fosse scavate nel terreno}, {x|battute di caccia obbligatorie} e {x|armi da fuoco}.' },
    { n: 2, dir: -1, front: (s) => s.v - 0.08,
      src: 'La Delegazione constata che {h|Homo sapiens} ha prima trasformato la montagna. Ha {x|tagliato i boschi}, ha messo a coltura le terre marginali e con esse ha ridotto il {w|Cervo} e il {w|Capriolo}, che nutrivano {w|Canis lupus}. Quando {w|Canis lupus}, privato di ciò che lo nutriva, si è rivolto alle greggi, {h|Homo sapiens} lo ha dichiarato {c:nocivo}. La Delegazione respinge l\'ordine in cui {h|Homo sapiens} ha raccontato questi fatti: prima è venuta la fame, poi la colpa.' },
    { n: 3, dir: 1, front: (s) => s.v,
      src: 'Nel 1397, a Verona, una {w|femmina viva di Canis lupus} valeva {x|cinque lire}, pagate con le entrate del dazio sul gioco d\'azzardo. Era stata {x|presa in una fossa} a febbraio, il mese in cui la {w|femmina di Canis lupus} comincia a portare i {w|cuccioli}. Nel 1520 il {h|podestà} della città obbligava tutti gli uomini delle valli a {x|cacciare Canis lupus} e {h|multava} chi restava a casa. Nelle lettere di quell\'anno {w|Canis lupus} compare come {c:crudeli}, formula che la Delegazione chiede di cancellare dagli atti. {a:parte}' },
    { n: 4, dir: -1, front: (s) => s.v - 0.04,
      src: 'L\'ultima {w|femmina di Canis lupus} documentata nel Veronese è stata {x|uccisa nel 1909}, nei boschi di Marcellise. Da allora il territorio è rimasto senza {w|Canis lupus} per centotré anni. Il {w|Bosco}, il {w|Cervo} e il {w|Capriolo} hanno attraversato quel secolo senza che nessuno chiedesse loro che cosa cambiava. La Delegazione osserva che nessun registro di {h|Homo sapiens} ha annotato questa assenza come {s:a4}.' },
    { n: 5, dir: 1, front: (s) => s.v + 0.08,
      src: 'Nel 2012 {w|Canis lupus} è tornato da solo, dopo circa mille chilometri a piedi. Nessuna istituzione umana lo ha richiamato, e nessuna gli ha restituito ciò che aveva perso. {h|Homo sapiens} {s:a5}.' },
    { n: 6, dir: -1, front: (s) => s.v - 0.02,
      src: 'La Delegazione dichiara che il ritorno di {w|Canis lupus} non estingue il debito contratto con la sua assenza. {a:debito} {h|Homo sapiens} è invitato a dichiarare se riconosce tale debito. {i|Termine per la risposta: scaduto nel 1909.}' },
    { n: 0, dir: 1, front: (s) => s.v - 0.15, end: true,
      src: 'Finora ha deciso: {h|Homo sapiens}. Non consultati: {w|Canis lupus}, il {w|Cervo}, il {w|Capriolo}, il {w|Bosco}.' }
  ];
  const SLOTS = {
    a1:  { art: 1, axis: 'r', th: [-0.2, 0.25], opts: ['la rimozione', 'l\'uccisione sistematica', 'lo sterminio deliberato'] },
    a1b: { art: 1, axis: 'r', th: [0.1], opts: ['dal medioevo al 1909', 'più di cinque secoli'] },
    a4:  { art: 4, axis: 'r', th: [-0.15, 0.3], opts: ['una perdita', 'un debito', 'un lutto'] },
    a5:  { art: 5, axis: 'r', th: [-0.3, 0.35], opts: ['considera chiusa la questione con il ritorno spontaneo di <i>Canis lupus</i>', 'prende atto di eventi storici non imputabili alla generazione presente', 'riconosce lo sterminio come atto proprio'] }
  };
  const ADDS = {
    parte:  { art: 3, text: 'In nessun documento di quei secoli <i>Canis lupus</i> compare come Parte.', on: (s) => s.r < -0.15, off: (s) => s.r > -0.05 },
    debito: { art: 6, text: 'Il debito si trasmette a ogni rappresentante di <i>Homo sapiens</i> che siede a questo tavolo.', on: (s) => s.r < -0.3, off: (s) => s.r > -0.2 }
  };
  const GLOSS = {
    'nocivo:ripristinato': 'ripristinato da Homo sapiens', 'nocivo:proposta': 'proposta della Delegazione',
    'crudeli:redatto': 'cancellato dagli atti', 'crudeli:aperto': 'resta agli atti', 'crudeli:barrato': 'in discussione',
    'add:on': 'inserito', 'add:off': 'ritirato'
  };
  const testo = (html) => html.replace(/<[^>]+>/g, '');

  /* ---------- costruzione del testo ---------- */
  const body = $('#body'), words = [], H = {}, arts = [], gruppi = [];
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function addWords(p, text, kind, art, gruppo) {
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { p.appendChild(document.createTextNode(' ')); return; }
      const e = mk('span', 'wd k-' + kind); e.textContent = part; p.appendChild(e);
      const w = { el: e, kind, text: part, ink: 0, sens: kind === 'x' ? (part.length <= 3 ? 0.45 : 1) : 0,
        seed: Math.floor(Math.random() * part.length), vr: Math.floor(Math.random() * 3), sig: '', wt: 0, art };
      words.push(w); art.words.push(w);
      if (gruppo) gruppo.push(w);
    });
  }
  function special(p, t, id) {
    const G = '<span class="gl"></span>';
    if (t === 's') {
      const e = mk('span', 'slot', '<span class="br">[</span><span class="cur"></span><span class="br">]</span><span class="gh"></span>');
      p.appendChild(e);
      H[id] = { el: e, cur: e.querySelector('.cur'), gh: e.querySelector('.gh'), brs: e.querySelectorAll('.br'), idx: -1, pend: null, pendT: 0, changedAt: -999, ghBorn: -999, busy: 0 };
    } else if (t === 'a') {
      const e = mk('span', 'add is-off', '<span class="br">[</span><span class="cur"></span><span class="br">]</span>' + G);
      p.appendChild(e);
      H[id] = { el: e, cur: e.querySelector('.cur'), gl: e.querySelector('.gl'), brs: e.querySelectorAll('.br'), on: false, pend: null, pendT: 0, changedAt: -999, glBorn: -999, busy: 0 };
    } else {
      const e = mk('span', 'cp', id === 'nocivo'
        ? '<span class="old">nocivo</span> <span class="new">[individuo in disaccordo]</span>' + G
        : '<span class="old">«questi animali crudeli»</span>' + G);
      p.appendChild(e);
      H[id] = { el: e, gl: e.querySelector('.gl'), st: null, pend: null, pendT: 0, glBorn: -999 };
    }
  }
  body.appendChild(mk('p', 'ttl', '<b>Atto I</b> <i>Dello sterminio</i>'));
  ARTS.forEach((a) => {
    const art = Object.assign({}, a, { words: [], f: 0.5 }); arts.push(art);
    const p = mk('p', a.end ? 'art end' : 'art');
    if (a.n) { p.appendChild(mk('span', 'num', 'Art.&nbsp;' + a.n + '.')); p.appendChild(document.createTextNode(' ')); }
    const re = /\{(h|w|x|i)\|([^}]+)\}|\{(s|a|c):(\w+)\}/g; let last = 0, m;
    while ((m = re.exec(a.src))) {
      addWords(p, a.src.slice(last, m.index), 'p', art);
      if (m[1]) {
        const g = [];
        addWords(p, m[2], m[1], art, g);
        if (m[1] === 'w') gruppi.push(g);
      } else special(p, m[3], m[4]);
      last = re.lastIndex;
    }
    addWords(p, a.src.slice(last), 'p', art);
    body.appendChild(p);
  });
  // i nomi scientifici sono in corsivo
  words.forEach((w, i) => {
    const n = words[i + 1];
    if (n && ((w.text === 'Homo' && /^sapiens/.test(n.text)) || (w.text === 'Canis' && /^lupus/.test(n.text)))) {
      w.el.classList.add('k-sci'); n.el.classList.add('k-sci');
    }
  });
  // barratura: le menzioni di Canis lupus, delle femmine e dei cuccioli (gruppi interi), in ordine casuale
  const barrabili = gruppi.filter((g) => /Canis lupus|cuccioli/.test(g.map((w) => w.text).join(' '))).sort(() => Math.random() - 0.5);
  barrabili.forEach((g) => g.forEach((w) => w.el.classList.add('barrabile')));

  /* ---------- slider: dal dispositivo ---------- */
  // stessi id della console (js/config.js SLIDERS)
  const vals = { allevare: 50, abitare: 50, presidiare: 50, monitorare: 50, nutrirsi: 50, attraversare: 50, avvicinarsi: 50, riprodursi: 50 };
  let ultimoStato = -1e9;
  const canale = new DN.link.Canale((m) => {
    if (!m || m.t !== 'stato' || !m.values) return;
    ultimoStato = performance.now();
    for (const id in m.values) vals[id] = m.values[id];
  });

  /* Le quattro modifiche, ognuna con una sola causa */
  function derive(v) {
    const d = (k) => (v[k] - 50) / 50, P = (k) => Math.max(0, d(k));
    return {
      v: clamp((d('attraversare') + d('avvicinarsi') + d('riprodursi')) / 3, -1, 1),  // voce: presenza di Canis lupus
      c: clamp((P('nutrirsi') + P('allevare')) / 2, 0, 1),                        // inchiostro: conflitto sul pascolo
      B: d('monitorare'),                                                         // barratura: MONITORARE
      r: -d('abitare')                                                         // riformulazione: ABITARE invertito
    };
  }
  const fmt = (v, sign = 1) => { const s = Math.abs(v).toFixed(2).replace('.', ','); return sign ? (v >= 0 ? '+' : '−') + s : s; };

  /* ---------- riscrittura lettera per lettera ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function retype(h, newHtml) {
    const tok = ++h.busy, c = h.cur, old = c.textContent, nuovo = testo(newHtml);
    h.scrive = true; c.classList.add('fresh');
    if (!reduce) {
      for (let i = old.length; i >= 0; i--) { if (tok !== h.busy) return; c.textContent = old.slice(0, i); await sleep(18); }
      await sleep(160);
      for (let i = 1; i <= nuovo.length; i++) { if (tok !== h.busy) return; c.textContent = nuovo.slice(0, i); await sleep(34); }
    }
    c.innerHTML = newHtml;
    h.scrive = false;
    setTimeout(() => { if (tok === h.busy) c.classList.remove('fresh'); }, 2200);
  }
  const scrive = (h) => !!h.scrive;
  function wantIdx(v, th, cur, m = 0.05) { const up = th.filter((t) => v > t + m).length, dn = th.filter((t) => v > t - m).length; if (up > cur) return up; if (dn < cur) return dn; return cur; }
  function cpState(id, s, cur) {
    if (id === 'nocivo') { if (s.B > 0.24) return 'ripristinato'; if (s.B < 0.14) return 'proposta'; return cur || 'proposta'; }
    return 'barrato';
  }
  function gloss(h, t) { h.gl.textContent = t; h.glBorn = T; }

  /* ---------- stato iniziale ---------- */
  let S = derive(vals), T = 0, cutting = false;
  function setInitial() {
    for (const id in SLOTS) { const d = SLOTS[id], h = H[id]; h.idx = wantIdx(S[d.axis], d.th, -1, 0); h.cur.innerHTML = d.opts[h.idx]; }
    for (const id in ADDS) { const a = ADDS[id], h = H[id]; h.on = a.on(S); h.cur.innerHTML = a.text; h.el.classList.toggle('is-off', !h.on); }
    for (const id of ['nocivo', 'crudeli']) { const h = H[id]; h.st = cpState(id, S, null); h.el.className = 'cp st-' + h.st; }
    cutting = S.B > 0.2;
    arts.forEach((a) => { a.f = clamp(0.5 + a.front(S) * 0.6, 0, 1); });
  }

  /* ---------- il corpo riempie la colonna ---------- */
  const frame = $('#frame'), col = $('#col'); let scaleK = 1;
  function fit() {
    const saved = [];
    for (const id in SLOTS) { const h = H[id], t = h.cur.innerHTML; saved.push(() => { h.cur.innerHTML = t; }); h.cur.innerHTML = SLOTS[id].opts.reduce((a, b) => (testo(b).length > testo(a).length ? b : a)); }
    for (const id in ADDS) { const h = H[id], c = h.el.className; saved.push(() => { h.el.className = c; }); h.el.className = 'add'; }
    body.classList.add('fitting');
    const kids = [...body.children], avail = body.clientHeight;
    const used = () => { const a = kids[0].getBoundingClientRect(), b = kids[kids.length - 1].getBoundingClientRect(); return (b.bottom - a.top) / (scaleK || 1); };
    let lo = 14, hi = 90;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; body.style.setProperty('--fs', m + 'px'); (used() <= avail * 0.93) ? lo = m : hi = m; }
    body.style.setProperty('--fs', lo.toFixed(1) + 'px');
    body.classList.remove('fitting'); saved.forEach((f) => f());
  }
  function setFormat(Hpx) {
    col.style.setProperty('--H', Hpx + 'px');
    frame.style.setProperty('--arw', 1080); frame.style.setProperty('--arh', Hpx);
    scale(); fit();
  }
  function scale() { scaleK = frame.clientWidth / 1080; col.style.transform = `scale(${scaleK})`; }
  new ResizeObserver(scale).observe(frame);

  /* ---------- resa delle parole: fronte di voce + inchiostro ---------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function renderWord(w, i, a) {
    const L = w.text.length;
    const N = a.words.length, pos = a.dir > 0 ? i : N - 1 - i, b = a.f * N;
    const cover = clamp(b - pos, 0, 1);
    const wt = cover >= 1 ? 740 : 220;
    if (wt !== w.wt) { w.wt = wt; w.el.style.fontWeight = wt; w.el.style.color = wt < 330 ? 'var(--ink3)' : 'var(--ink)'; w.el.classList.toggle('pieno', wt > 500); }
    let sig, html;
    if (w.ink >= 0.04) {
      const peak = Math.pow(w.ink, 1.25) * 8, R = 1 + w.ink * L * 1.1, lv = [];
      for (let j = 0; j < L; j++) { const d = Math.abs(j - w.seed) / R; lv.push(d >= 1 ? 0 : clamp(Math.round(peak * (1 - Math.pow(d, 1.4))), 0, 8)); }
      sig = 'i' + lv.join('');
      if (sig !== w.sig) {
        html = ''; let j = 0;
        while (j < L) { let k = j; while (k < L && lv[k] === lv[j]) k++; const t = esc(w.text.slice(j, k));
          html += lv[j] ? `<span class="bl" style="filter:url(#k${lv[j]}_${w.vr});font-weight:${Math.min(800, 480 + lv[j] * 40)}">${t}</span>` : t; j = k; }
      }
    } else if (cover > 0 && cover < 1 && L > 1) {
      const k = clamp(Math.round(cover * L), 1, L - 1);
      sig = 'f' + k + a.dir;
      if (sig !== w.sig) html = a.dir > 0 ? `<span class="hv">${esc(w.text.slice(0, k))}</span>${esc(w.text.slice(k))}`
        : `${esc(w.text.slice(0, L - k))}<span class="hv">${esc(w.text.slice(L - k))}</span>`;
    } else sig = '0';
    if (sig !== w.sig) { w.sig = sig; if (html != null) w.el.innerHTML = html; else w.el.textContent = w.text; }
  }

  /* ---------- banco: che cosa modifica il testo ---------- */
  const v2 = (id) => Math.round(vals[id]);
  const MODS = [
    { id: 'voce', nome: 'Voce',
      cosa: 'In ogni articolo una parte è in nero pieno: è la protesta della Delegazione. Il confine scorre lento e taglia anche le parole.',
      cause: [['attraversare', 'lupo'], ['avvicinarsi', 'lupo'], ['riprodursi', 'lupo']], op: 'media',
      regola: 'Più presenza di <i>Canis lupus</i> sul territorio, più forza alla protesta. Quando la presenza cala, la protesta arretra in grigio ma resta leggibile.',
      barra: 'div' },
    { id: 'inchiostro', nome: 'Inchiostro',
      cosa: 'Le parole degli strumenti della caccia si gonfiano e si impastano. Al massimo una parola su undici.',
      cause: [['nutrirsi', 'lupo'], ['allevare', 'umano']], op: 'insieme sopra 50',
      regola: 'Il conflitto sul pascolo sporca il testo. Nessuno lo decide: accade. Quando il conflitto cala, l\'inchiostro asciuga lentamente.',
      barra: 'soglia', soglia: 12 },
    { id: 'barratura', nome: 'Barratura',
      cosa: 'Una linea netta cancella le menzioni di <i>Canis lupus</i>, delle femmine e dei cuccioli. In Art. 2 «individuo in disaccordo» viene barrato e «nocivo» torna pieno.',
      cause: [['monitorare', 'umano']], op: 'oltre 60',
      regola: 'Cancellazione deliberata: il testo ripete ciò che l\'Atto denuncia. Tratto netto, perché qui qualcuno decide.',
      barra: 'soglia', soglia: 60 },
    { id: 'riformulazione', nome: 'Riformulazione',
      cosa: 'I passaggi tra [ ] si cancellano e si riscrivono lettera per lettera. La formulazione precedente resta accanto, piccola e barrata.',
      cause: [['abitare', 'umano']], op: 'invertito',
      regola: 'Chi si insedia difende l\'occupazione della montagna e parla per eufemismi («la rimozione»): la Delegazione insiste con clausole nuove. Chi si ritira riconosce («lo sterminio deliberato»).',
      barra: 'div' }
  ];
  const UI = {};
  MODS.forEach((m) => {
    const e = mk('section', 'mod');
    e.dataset.mod = m.id;
    const cause = m.cause.map(([id, chi]) => `<span class="verbo ${chi}" data-v="${id}"><b>50</b>${NOMI[id]}</span>`).join('');
    e.innerHTML = `
      <div class="mod-testa"><span class="mod-nome">${m.nome}</span><span class="mod-stato">ferma</span></div>
      <p class="mod-cosa">${m.cosa}</p>
      <div class="mod-causa">${cause}<span class="op">${m.op}</span></div>
      <div class="barra ${m.barra === 'div' ? 'div' : ''}"><i></i>${m.soglia ? `<span class="soglia" style="left:${m.soglia}%"></span>` : ''}</div>
      <p class="mod-ora"></p>
      <p class="mod-regola">${m.regola}</p>`;
    $('#mods').appendChild(e);
    UI[m.id] = { el: e, stato: e.querySelector('.mod-stato'), ora: e.querySelector('.mod-ora'), barra: e.querySelector('.barra i'),
      verbi: [...e.querySelectorAll('.verbo')].map((x) => ({ id: x.dataset.v, b: x.querySelector('b') })), attivaT: -1e9, oraHtml: '' };
    // evidenzia nel testo le parole toccate
    e.addEventListener('mouseenter', () => body.classList.add('hl-' + m.id));
    e.addEventListener('mouseleave', () => { if (!e.classList.contains('fissa')) body.classList.remove('hl-' + m.id); });
    e.addEventListener('click', () => { const on = e.classList.toggle('fissa'); body.classList.toggle('hl-' + m.id, on); });
  });
  $('#nonagisce').innerHTML = `<b>${NOMI.presidiare}</b> non agisce su questo Atto.`;
  const attiva = (id) => { UI[id].attivaT = T; };

  // registro delle modifiche, la più recente in alto
  const registro = [];
  function scrivi(html, causa) {
    registro.unshift({ html, causa, t: T });
    registro.length = Math.min(registro.length, 12);
    $('#registro').innerHTML = registro.map((r) => `<li>${r.html}${r.causa ? ` <span>· ${r.causa}</span>` : ''}</li>`).join('');
  }
  const causa = (...ids) => ids.map((id) => `${NOMI[id]} ${v2(id)}`).join(', ');

  /* ---------- ciclo ---------- */
  let inchiostroVa = null, ultimaVoce = null;
  function step(dt) {
    const raw = derive(vals), f = 1 - Math.exp(-dt / 1.2);
    for (const k in raw) S[k] += (raw[k] - S[k]) * f;
    // fronti di voce: scorrono lenti verso il loro bersaglio
    const ff = 1 - Math.exp(-dt / 6);
    let muove = false;
    arts.forEach((a) => { const t = clamp(0.5 + a.front(S) * 0.6, 0, 1); if (Math.abs(t - a.f) > 0.01) muove = true; a.f += (t - a.f) * ff; });
    if (muove) attiva('voce');
    // inchiostro
    const bleeding = words.filter((w) => w.ink > 0.04).length, cap = Math.ceil(words.length * 0.09), over = S.c - 0.12;
    let cambia = false;
    words.forEach((w, i) => {
      const prima = w.ink;
      if (over > 0 && w.sens > 0 && (w.ink > 0.04 || bleeding < cap)) w.ink += over * w.sens * 0.1 * dt;
      if (over > 0 && w.ink > 0.85) [words[i - 1], words[i + 1]].forEach((n) => { if (n && n.kind !== 'w' && (n.ink > 0.04 || bleeding < cap)) n.ink += over * 0.03 * dt; });
      if (over <= 0 || w.sens === 0) w.ink -= w.ink * dt / 140;
      w.ink = clamp(w.ink, 0, 1);
      if (Math.abs(w.ink - prima) > 0.0005 && w.ink > 0.04) cambia = true;
    });
    if (cambia) attiva('inchiostro');
    T += dt;
  }

  function tick() { // 10 Hz
    arts.forEach((a) => a.words.forEach((w, i) => renderWord(w, i, a)));

    // barratura
    const prima = cutting;
    if (S.B > 0.2) cutting = true; else if (S.B < 0.12) cutting = false;
    if (cutting !== prima) scrivi(cutting ? `<b>Barratura avviata</b>: le menzioni di <i>Canis lupus</i> vengono cancellate` : '<b>Barratura sospesa</b>: le linee restano finché lo slider non scende', causa('monitorare'));
    const nCut = cutting ? Math.round(clamp((S.B - 0.15) / 0.7, 0, 1) * barrabili.length * 0.75) : 0;
    let tagliate = 0;
    barrabili.forEach((g, i) => { const on = i < nCut; if (on) tagliate++; g.forEach((w) => { if (w.el.classList.contains('cut') !== on) { w.el.classList.toggle('cut', on); attiva('barratura'); } }); });

    // riformulazione: passaggi contesi
    for (const id in SLOTS) {
      const d = SLOTS[id], h = H[id], want = wantIdx(S[d.axis], d.th, h.idx);
      if (want !== h.idx) {
        attiva('riformulazione');
        if (h.pend !== want) { h.pend = want; h.pendT = T; }
        else if (T - h.pendT >= 2.5) {
          const old = d.opts[h.idx]; h.idx = want; h.pend = null; h.changedAt = T; h.gh.textContent = testo(old); h.ghBorn = T; retype(h, d.opts[want]);
          scrivi(`<b>Art. ${d.art}</b> «${old}» → «${d.opts[want]}»`, causa('abitare'));
        }
      } else h.pend = null;
      if (scrive(h)) attiva('riformulazione');
      h.brs.forEach((b) => { b.style.opacity = (0.25 + 0.75 * Math.exp(-(T - h.changedAt) / 30)).toFixed(2); });
      if (h.ghBorn > -999) h.gh.style.opacity = (0.3 + 0.65 * Math.exp(-(T - h.ghBorn) / 45)).toFixed(2);
    }
    // riformulazione: clausole aggiunte
    for (const id in ADDS) {
      const a = ADDS[id], h = H[id], want = h.on ? !a.off(S) : a.on(S);
      if (want !== h.on) {
        attiva('riformulazione');
        if (h.pend !== want) { h.pend = want; h.pendT = T; }
        else if (T - h.pendT >= 2.5) {
          h.on = want; h.pend = null; h.changedAt = T;
          if (want) { h.el.className = 'add'; h.cur.textContent = ''; retype(h, a.text); } else h.el.className = 'add is-gone';
          gloss(h, GLOSS[want ? 'add:on' : 'add:off']);
          scrivi(`<b>Art. ${a.art}</b> clausola ${want ? 'inserita' : 'ritirata'}: «${a.text}»`, causa('abitare'));
        }
      } else h.pend = null;
      if (scrive(h)) attiva('riformulazione');
      h.brs.forEach((b) => { b.style.opacity = (0.25 + 0.75 * Math.exp(-(T - h.changedAt) / 30)).toFixed(2); });
    }
    // barratura: «nocivo» / «individuo in disaccordo»
    for (const id of ['nocivo', 'crudeli']) {
      const h = H[id], want = cpState(id, S, h.st);
      if (want !== h.st) {
        if (h.pend !== want) { h.pend = want; h.pendT = T; }
        else if (T - h.pendT >= 2.5) {
          h.st = want; h.pend = null; h.el.className = 'cp st-' + want; gloss(h, GLOSS[id + ':' + want]); attiva('barratura');
          if (id === 'nocivo') scrivi(want === 'ripristinato' ? '<b>Art. 2</b> «individuo in disaccordo» barrato, «nocivo» torna pieno' : '<b>Art. 2</b> torna la proposta «individuo in disaccordo»', causa('monitorare'));
        }
      } else h.pend = null;
    }
    for (const id of ['nocivo', 'crudeli', 'parte', 'debito']) { const h = H[id]; if (h.glBorn > -999) h.gl.style.opacity = (0.18 + 0.82 * Math.exp(-(T - h.glBorn) / 25)).toFixed(2); }

    // inchiostro e voce nel registro, solo ai cambi di direzione
    const va = S.c > 0.12;
    if (inchiostroVa !== null && va !== inchiostroVa) scrivi(va ? '<b>Inchiostro</b>: il conflitto sul pascolo macchia le parole della caccia' : '<b>Inchiostro</b>: il conflitto cala, le macchie asciugano', causa('nutrirsi', 'allevare'));
    inchiostroVa = va;
    const vs = S.v > 0.1 ? 1 : S.v < -0.1 ? -1 : 0;
    if (ultimaVoce !== null && vs !== ultimaVoce) scrivi(vs > 0 ? '<b>Voce</b>: la protesta avanza in nero pieno' : vs < 0 ? '<b>Voce</b>: la protesta arretra in grigio' : '<b>Voce</b>: la protesta torna a metà', causa('attraversare', 'avvicinarsi', 'riprodursi'));
    ultimaVoce = vs;

    // banco
    const macchiate = words.filter((w) => w.ink > 0.04).length;
    const ora = {
      voce: `Indice ${fmt(S.v)} · la protesta occupa circa il ${Math.round(arts.reduce((s, a) => s + a.f, 0) / arts.length * 100)}% di ogni articolo.`,
      inchiostro: `Conflitto ${fmt(S.c, 0)} (soglia 0,12) · ${macchiate} parole macchiate${S.c > 0.12 ? '' : ', asciugano'}.`,
      barratura: `${tagliate} menzioni su ${barrabili.length} barrate · «nocivo»: ${H.nocivo.st === 'ripristinato' ? 'ripristinato' : 'proposta «individuo in disaccordo»'}.`,
      riformulazione: `Indice ${fmt(S.r)} · Art. 1 <q>${SLOTS.a1.opts[H.a1.idx]}</q> · Art. 4 <q>${SLOTS.a4.opts[H.a4.idx]}</q> · clausole ${['parte', 'debito'].filter((k) => H[k].on).length} su 2.`
    };
    const barre = {
      voce: [S.v, true], inchiostro: [S.c, false], barratura: [vals.monitorare / 100, false], riformulazione: [S.r, true]
    };
    MODS.forEach((m) => {
      const u = UI[m.id];
      u.verbi.forEach((x) => { const t = String(v2(x.id)); if (x.b.textContent !== t) x.b.textContent = t; });
      const [val, div] = barre[m.id];
      if (div) { u.barra.style.left = (50 + Math.min(val, 0) * 50) + '%'; u.barra.style.width = (Math.abs(val) * 50) + '%'; }
      else { u.barra.style.left = '0'; u.barra.style.width = (clamp(val, 0, 1) * 100) + '%'; }
      if (u.oraHtml !== ora[m.id]) { u.oraHtml = ora[m.id]; u.ora.innerHTML = ora[m.id]; }
      const on = T - u.attivaT < 1.5;
      u.el.classList.toggle('attiva', on);
      const inAttesa = m.id === 'riformulazione' && Object.keys(SLOTS).concat(Object.keys(ADDS)).some((id) => H[id].pend != null);
      const st = on ? (inAttesa ? 'sta per cambiare' : 'in corso') : 'ferma';
      if (u.stato.textContent !== st) u.stato.textContent = st;
    });
    const collegata = performance.now() - ultimoStato < 2000;
    const c = $('#collegamento');
    if (c.dataset.on !== String(collegata)) {
      c.dataset.on = String(collegata);
      c.className = 'collegamento ' + (collegata ? 'attivo' : 'assente');
      c.textContent = collegata ? 'collegato al dispositivo' : 'in attesa della tavola: apri index.html e console.html';
    }
  }

  let last = performance.now(), acc = 0;
  function loop(now) { const dt = Math.min(0.1, (now - last) / 1000); last = now; step(dt); acc += dt; if (acc >= 0.1) { acc = 0; tick(); } requestAnimationFrame(loop); }

  /* ---------- tasti ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '1') setFormat(1920); else if (k === '2') setFormat(2160); else if (k === '3') setFormat(3240);
    else if (k === 'i') col.classList.toggle('inv');
    else if (k === 'h') { $('.app').classList.toggle('solo'); requestAnimationFrame(() => { scale(); fit(); }); }
    else if (k === 'f') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      else document.exitFullscreen && document.exitFullscreen();
    }
  });

  setInitial(); setFormat(1920); tick();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fit(); requestAnimationFrame(loop); });
  window.addEventListener('resize', () => { scale(); fit(); });
  DN.trattato = { vals, S: () => S, canale };

})(window.DN = window.DN || {});
