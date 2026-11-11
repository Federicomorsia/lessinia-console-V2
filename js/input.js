/* =====================================================================
   INPUT — stato degli slider separato dalla sua sorgente.
   Gli slider sono input e output insieme: qualunque sorgente (mouse,
   tastiera, MIDI, seriale) può tenerli e spostarli, e ogni tick la loro
   posizione viene inviata alle uscite (es. fader motorizzati).
   ===================================================================== */
(function (DN) {
  'use strict';

  class SliderBus {
    constructor(ids) {
      this.ids = ids.slice();
      this.values = {};
      this.holds = {};        // id -> Set di sorgenti che lo tengono
      this.releasedAt = {};   // id -> ms del rilascio
      this.lastInteraction = performance.now();
      this.outputs = [];
      this.listeners = { hold: [], release: [], set: [], reset: [] };
      ids.forEach((id) => { this.values[id] = 50; this.holds[id] = new Set(); this.releasedAt[id] = -Infinity; });
    }
    on(evt, fn) { this.listeners[evt].push(fn); }
    emit(evt, a, b) { this.listeners[evt].forEach((fn) => fn(a, b)); }

    /* Una sorgente afferra lo slider: diventa input puro. */
    hold(id, source) {
      const wasFree = this.holds[id].size === 0;
      this.holds[id].add(source);
      this.touch();
      if (wasFree) this.emit('hold', id, source);
    }
    /* Una sorgente sposta lo slider (implica la presa). */
    set(id, value, source) {
      if (!this.holds[id].has(source)) this.hold(id, source);
      this.values[id] = Math.max(0, Math.min(100, value));
      this.touch();
      this.emit('set', id, source);
    }
    /* Rilascio: lo slider torna alla dinamica, con inerzia. */
    release(id, source) {
      if (!this.holds[id].delete(source)) return;
      if (this.holds[id].size === 0) {
        this.releasedAt[id] = performance.now();
        this.emit('release', id, source);
      }
      this.touch();
    }
    isHeld(id) { return this.holds[id].size > 0; }
    anyHeld() { return this.ids.some((id) => this.holds[id].size > 0); }
    touch() { this.lastInteraction = performance.now(); }

    reset() {
      this.ids.forEach((id) => { this.values[id] = 50; this.holds[id].clear(); this.releasedAt[id] = -Infinity; });
      this.touch();
      this.emit('reset');
    }

    /* Uscite: ogni funzione riceve (values, isHeld) a ogni tick */
    addOutput(fn) { this.outputs.push(fn); }
    emitOutput() {
      for (const fn of this.outputs) {
        try { fn(this.values, (id) => this.isHeld(id)); } catch (e) { console.warn('uscita slider:', e); }
      }
    }
  }

  /* -------------------------------------------------------------------
     Adattatore MIDI (Web MIDI). Mappa 8 Control Change consecutivi agli
     8 slider (default CC 0–7, canale qualsiasi). In uscita rimanda gli
     stessi CC: un controller con fader motorizzati li seguirà.
     Una presa MIDI si considera rilasciata dopo TOUCH_MS senza messaggi.
     ------------------------------------------------------------------- */
  class MidiAdapter {
    constructor(bus, opts) {
      this.bus = bus;
      this.ccBase = (opts && opts.ccBase) || 0;
      this.TOUCH_MS = 600;
      this.timers = {};
      this.last = {};
      this.outs = [];
      this.status = 'non collegato';
    }
    async connect() {
      if (!navigator.requestMIDIAccess) { this.status = 'Web MIDI non disponibile'; return false; }
      const access = await navigator.requestMIDIAccess();
      access.inputs.forEach((inp) => { inp.onmidimessage = (m) => this.onMessage(m); });
      this.outs = Array.from(access.outputs.values());
      this.status = 'collegato: ' + access.inputs.size + ' ingressi, ' + this.outs.length + ' uscite';
      this.bus.addOutput((values, isHeld) => this.send(values, isHeld));
      return true;
    }
    onMessage(msg) {
      const [st, cc, val] = msg.data;
      if ((st & 0xf0) !== 0xb0) return;
      const k = cc - this.ccBase;
      if (k < 0 || k >= this.bus.ids.length) return;
      const id = this.bus.ids[k];
      this.bus.set(id, (val / 127) * 100, 'midi');
      clearTimeout(this.timers[id]);
      this.timers[id] = setTimeout(() => this.bus.release(id, 'midi'), this.TOUCH_MS);
    }
    send(values, isHeld) {
      if (!this.outs.length) return;
      this.bus.ids.forEach((id, k) => {
        if (this.bus.holds[id].has('midi')) return;
        const v = Math.round((values[id] / 100) * 127);
        if (this.last[id] === v) return;
        this.last[id] = v;
        this.outs.forEach((o) => o.send([0xb0, this.ccBase + k, v]));
      });
    }
  }

  /* -------------------------------------------------------------------
     Adattatore seriale (Web Serial). Protocollo a righe di testo:
       ingresso:  "allevare:73\n"  oppure "touch:allevare:1" / "touch:allevare:0"
       uscita:    "allevare:73\n" (solo quando cambia di almeno 1)
     Pensato per un microcontrollore che legge fader motorizzati.
     ------------------------------------------------------------------- */
  class SerialAdapter {
    constructor(bus) { this.bus = bus; this.port = null; this.writer = null; this.last = {}; this.status = 'non collegato'; }
    async connect() {
      if (!navigator.serial) { this.status = 'Web Serial non disponibile'; return false; }
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      const enc = new TextEncoderStream();
      enc.readable.pipeTo(this.port.writable);
      this.writer = enc.writable.getWriter();
      this.status = 'collegato';
      this.bus.addOutput((values) => this.send(values));
      this.readLoop();
      return true;
    }
    async readLoop() {
      const dec = new TextDecoderStream();
      this.port.readable.pipeTo(dec.writable);
      const reader = dec.readable.getReader();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          this.onLine(buf.slice(0, nl).trim());
          buf = buf.slice(nl + 1);
        }
      }
    }
    onLine(line) {
      const p = line.split(':');
      if (p[0] === 'touch' && this.bus.values[p[1]] !== undefined) {
        if (p[2] === '1') this.bus.hold(p[1], 'serial'); else this.bus.release(p[1], 'serial');
      } else if (this.bus.values[p[0]] !== undefined) {
        this.bus.set(p[0], parseFloat(p[1]), 'serial');
      }
    }
    send(values) {
      if (!this.writer) return;
      let out = '';
      for (const id of this.bus.ids) {
        if (this.bus.holds[id].has('serial')) continue;
        const v = Math.round(values[id]);
        if (this.last[id] === v) continue;
        this.last[id] = v;
        out += id + ':' + v + '\n';
      }
      if (out) this.writer.write(out);
    }
  }

  DN.input = { SliderBus, MidiAdapter, SerialAdapter };

})(window.DN = window.DN || {});
