/* =====================================================================
   SIMULATION — dinamica degli slider, stato del territorio, bisogni.
   Tutte le formule dello stato derivato e dei bisogni stanno qui, in
   calcolaStato(): è il punto unico da calibrare.
   ===================================================================== */
(function (DN) {
  'use strict';
  const U = DN.util;
  const c = (v) => U.clamp(v, 0, 100);

  /* -------------------------------------------------------------------
     Stato del territorio e bisogni, dai valori degli slider.
     v: valori degli 8 slider (0–100)
     corridoiAperti: quota (0–100) di corridoi aperti o tollerati,
                     misurata sulla mappa dal modulo corridors.
     ------------------------------------------------------------------- */
  function calcolaStato(v, corridoiAperti) {
    const { allevare, costruire, proteggere, abbattere, predare, disperdersi, avvicinarsi, fareBranco } = v;
    const s = {};

    // --- territorio ---------------------------------------------------
    s.pascolo = c(15 + 0.70 * allevare);            // più bestiame, più pascolo
    s.infrastrutture = c(costruire);
    s.lupi = c(0.6 * fareBranco + 0.2 * disperdersi - 0.5 * abbattere + 35);
    // Bonus opzionale: branchi stabili che cacciano il selvatico tengono
    // basso il carico di ungulati e il bosco si rinnova.
    s.bonusBosco = 8 * (s.lupi / 100) * (1 - predare / 100) * (fareBranco / 100);
    s.bosco = c(100 - 0.6 * s.pascolo - 0.35 * s.infrastrutture + s.bonusBosco);
    // il presidio non aumenta le greggi, ma le rende più al sicuro e quindi più durature
    s.greggi = c(allevare * (0.6 + 0.4 * proteggere / 100));
    // abbattere toglie lupi e quindi lascia crescere cervi, caprioli, cinghiali
    s.ungulati = c(40 + 0.4 * s.bosco - 0.5 * s.lupi * (1 - predare / 100) + 0.3 * abbattere);
    s.cani = c(0.5 * proteggere + 0.3 * costruire);  // guardiania + cani vaganti
    // lupi soli, vicini ai paesi, dove ci sono cani: aumenta l'ibridazione
    s.ibridazione = c(avvicinarsi * (s.cani / 100) * (1 - fareBranco / 100) * 1.5);

    // --- variabili di supporto ----------------------------------------
    s.corridoiAperti = c(corridoiAperti);
    s.conflitto = c(0.4 * predare * s.greggi / 100 + 0.3 * avvicinarsi + 0.3 * abbattere);
    s.mortalitaStradale = c(s.infrastrutture * disperdersi / 100);
    s.dispersioneRiuscita = c(disperdersi * s.corridoiAperti / 100);

    // --- bisogni dell'umano -------------------------------------------
    const um = {};
    um.cibo = c(0.5 * s.greggi + 0.3 * (100 - s.ungulati) + 0.2 * (100 - predare * allevare / 100));
    um.spazio = c(0.6 * s.infrastrutture + 0.4 * s.pascolo);
    um.sicurezza = c(100 - (0.4 * predare * s.greggi / 100 + 0.3 * avvicinarsi + 0.3 * s.ungulati * s.infrastrutture / 100));
    // continuità delle comunità e del mestiere
    um.discendenza = c(0.4 * um.cibo + 0.3 * (100 - s.conflitto) + 0.3 * proteggere);

    // --- bisogni del lupo ---------------------------------------------
    // Calibrazione (vedi README): i pesi originali 0.6 / 0.4 tenevano il cibo
    // del lupo sempre sotto 60, rompendo la parità di scala con l'umano.
    // Qui: dieta = quota selvatica × disponibilità di ungulati
    //            + quota domestica × greggi accessibili (non presidiate).
    const lu = {};
    lu.cibo = c(1.0 * s.ungulati * (1 - predare / 100) + 1.2 * s.greggi * (predare / 100) * (1 - proteggere / 100));
    lu.spazio = c(0.5 * s.bosco + 0.5 * s.corridoiAperti - 0.3 * s.infrastrutture);
    lu.sicurezza = c(100 - (0.5 * abbattere + 0.3 * s.mortalitaStradale + 0.2 * avvicinarsi * abbattere / 100));
    // Calibrazione: 0.5 / 0.3 -> 0.6 / 0.4 per la stessa ragione di scala.
    lu.discendenza = c(0.6 * fareBranco + 0.4 * s.dispersioneRiuscita - 0.4 * s.ibridazione);

    return { territorio: s, umano: um, lupo: lu };
  }

  /* -------------------------------------------------------------------
     Dinamica: ogni slider non tenuto va verso il suo target.
     ------------------------------------------------------------------- */
  class Simulation {
    constructor(cfg, bus) {
      this.cfg = cfg;
      this.bus = bus;
      this.ids = cfg.SLIDERS.map((s) => s.id);
      this.motion = {};   // velocità del sistema per slider (unità/s), per l'alone
      this.ids.forEach((id) => { this.motion[id] = 0; });
      this.corridoiAperti = 60;
      // MEMORIA: ogni slider ha un'ancora, il suo punto di riposo. Parte da 50;
      // quando lo lasci diventa la posizione in cui l'hai lasciato, e lì resta:
      // il sistema non si muove da solo, risponde solo ai gesti.
      this.ancore = {};
      this.ids.forEach((id) => { this.ancore[id] = 50; });
      // spinte correnti: contributi[j] = [{ da: i, c: w·(v_i − 50) }, ...]
      this.contributi = {};
      this.ids.forEach((id) => { this.contributi[id] = []; });
      bus.on('release', (id) => this._fissaAncora(id));
      bus.on('reset', () => { this.ids.forEach((id) => { this.ancore[id] = 50; }); });
      this.result = calcolaStato(bus.values, this.corridoiAperti);
    }

    peso(i, j) {
      const e = this.cfg.W[i] && this.cfg.W[i][j];
      return !e ? 0 : typeof e === 'number' ? e : e.w;
    }

    spinta(j) {
      let s = 0;
      for (const i of this.ids) {
        const w = this.peso(i, j);
        if (w) s += w * (this.bus.values[i] - 50);
      }
      return s;
    }

    /* Lo slider rilasciato resta lì: l'ancora è la posizione meno le spinte attuali,
       così target = posizione nel momento del rilascio. */
    _fissaAncora(id) {
      this.ancore[id] = U.clamp(this.bus.values[id] - this.spinta(id), 0, 100);
    }

    get targets() { return this._targets || {}; }

    tick() {
      const T = this.cfg.TEMPO, bus = this.bus, ids = this.ids;
      const dt = 1 / T.TICK_HZ;

      const v = bus.values;
      const next = {}, targets = {};
      ids.forEach((j) => {
        const lista = [];
        for (const i of ids) {
          const w = this.peso(i, j);
          if (w) lista.push({ da: i, c: w * (v[i] - 50) });
        }
        this.contributi[j] = lista;
      });
      ids.forEach((j) => {
        if (bus.isHeld(j)) { next[j] = v[j]; targets[j] = v[j]; return; }
        // target[j] = ancora[j] + Σ_i W[i][j] (v[i] − 50)
        let target = this.ancore[j];
        for (const o of this.contributi[j]) target += o.c;
        target = U.clamp(target, 0, 100);
        targets[j] = target;
        const d = target - v[j];
        // vicino al target si ferma del tutto: niente micro-movimenti infiniti
        next[j] = Math.abs(d) < T.SOGLIA_QUIETE ? target : v[j] + d * T.RESPONSE_RATE;
      });

      ids.forEach((j) => {
        if (bus.isHeld(j)) { this.motion[j] *= 0.7; return; }
        const speed = Math.abs(next[j] - v[j]) / dt;
        this.motion[j] = this.motion[j] * 0.85 + speed * 0.15;
        v[j] = next[j];
      });
      this._targets = targets;

      this.result = calcolaStato(v, this.corridoiAperti);
      return this.result;
    }
  }

  DN.simulation = { Simulation, calcolaStato };

})(window.DN = window.DN || {});
