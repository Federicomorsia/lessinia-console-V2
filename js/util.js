/* =====================================================================
   UTIL — numeri casuali con seme, rumore, coda di priorità, A*.
   ===================================================================== */
(function (DN) {
  'use strict';

  const U = {};

  U.clamp = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smoothstep = (e0, e1, x) => {
    const t = U.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.gauss = (x, mu, sigma) => Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma));

  /* PRNG con seme (mulberry32): la mappa è sempre la stessa. */
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Hash deterministico di interi -> [0,1) */
  U.hash2 = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /* Rumore di valore 2D (interpolato) */
  U.makeNoise2D = function (seed) {
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
      const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
      return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
    };
  };

  U.fbm = function (noise, x, y, oct) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < (oct || 5); i++) {
      s += amp * noise(x * f, y * f);
      n += amp; amp *= 0.5; f *= 2.03;
    }
    return s / n;
  };

  /* Rumore 1D liscio in [-1,1], per le derive temporali */
  U.makeNoise1D = function (seed) {
    return function (t) {
      const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
      return U.lerp(U.hash2(i, 0, seed), U.hash2(i + 1, 0, seed), u) * 2 - 1;
    };
  };

  /* Coda di priorità minima (heap binario) con chiavi duplicate ammesse */
  class MinHeap {
    constructor() { this.ids = []; this.keys = []; }
    get size() { return this.ids.length; }
    push(id, key) {
      const ids = this.ids, keys = this.keys;
      let i = ids.length;
      ids.push(id); keys.push(key);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] <= key) break;
        ids[i] = ids[p]; keys[i] = keys[p];
        i = p;
      }
      ids[i] = id; keys[i] = key;
    }
    pop() {
      const ids = this.ids, keys = this.keys;
      const top = ids[0];
      const lastId = ids.pop(), lastKey = keys.pop();
      const n = ids.length;
      if (n > 0) {
        let i = 0;
        while (true) {
          let l = 2 * i + 1, r = l + 1, m = i;
          let mk = lastKey;
          if (l < n && keys[l] < mk) { m = l; mk = keys[l]; }
          if (r < n && keys[r] < mk) { m = r; mk = keys[r]; }
          if (m === i) break;
          ids[i] = ids[m]; keys[i] = keys[m];
          i = m;
        }
        ids[i] = lastId; keys[i] = lastKey;
      }
      return top;
    }
  }
  U.MinHeap = MinHeap;

  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const DD = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

  /* Cammino a costo minimo su griglia (8-connessa).
     costAt(idx) -> costo della cella (>0).
     goal: indice di arrivo (A*), oppure isGoal(idx) per Dijkstra multi-meta.
     minCost: costo minimo per l'euristica di A*. */
  U.findPath = function (cols, rows, costAt, start, goal, isGoal, minCost) {
    const N = cols * rows;
    const g = new Float64Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const gx = goal >= 0 ? goal % cols : 0, gy = goal >= 0 ? (goal / cols) | 0 : 0;
    const h = goal >= 0
      ? (i) => { const dx = (i % cols) - gx, dy = ((i / cols) | 0) - gy; return Math.sqrt(dx * dx + dy * dy) * minCost; }
      : () => 0;
    g[start] = 0;
    heap.push(start, h(start));
    let found = -1;
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal || (isGoal && isGoal(cur))) { found = cur; break; }
      const cx = cur % cols, cy = (cur / cols) | 0;
      const cc = costAt(cur);
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (closed[ni]) continue;
        const nc = costAt(ni);
        if (!isFinite(nc)) continue;
        let step = DD[k] * (cc + nc) * 0.5;
        if (k >= 4) {
          // niente scorciatoie in diagonale tra due celle costose (es. una strada
          // disegnata in diagonale): chi passa "tra" due celle ne paga almeno una
          const o = Math.min(costAt(cy * cols + nx), costAt(ny * cols + cx));
          const m = Math.max(cc, nc);
          if (o > m) step += o - m;
        }
        const ng = g[cur] + step;
        if (ng < g[ni]) {
          g[ni] = ng; from[ni] = cur;
          heap.push(ni, ng + h(ni));
        }
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let c = found; c >= 0; c = from[c]) path.push(c);
    path.reverse();
    return path;
  };

  /* Distanza (in celle, 8-connessa approssimata) da un insieme di celle sorgente */
  U.distanceField = function (cols, rows, isSource, maxD) {
    const N = cols * rows;
    const d = new Float32Array(N).fill(Infinity);
    const heap = new MinHeap();
    for (let i = 0; i < N; i++) if (isSource(i)) { d[i] = 0; heap.push(i, 0); }
    while (heap.size) {
      const cur = heap.pop();
      const dc = d[cur];
      if (dc > maxD) break;
      const cx = cur % cols, cy = (cur / cols) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        const nd = dc + DD[k];
        if (nd < d[ni]) { d[ni] = nd; heap.push(ni, nd); }
      }
    }
    return d;
  };

  DN.util = U;

})(window.DN = window.DN || {});
