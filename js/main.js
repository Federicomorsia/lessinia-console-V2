/* =====================================================================
   MAIN — collega i moduli e fa girare i due orologi:
   - simulazione a passo fisso (TICK_HZ),
   - disegno a ogni frame (requestAnimationFrame).
   Gli slider arrivano dalla console (console.html) attraverso DN.link;
   la tavola rimanda lo stato a ogni frame, così la console lo mostra.
   ===================================================================== */
(function (DN) {
  'use strict';

  // grandezza di un'unità del riferimento (2576 × 1449), come --u nel CSS
  const unita = () => Math.min(window.innerWidth / 2576, window.innerHeight / 1449);

  function start() {
    const cfg = DN.config;
    const ids = cfg.SLIDERS.map((s) => s.id);
    const app = { cfg };
    app.bus = new DN.input.SliderBus(ids);
    app.sim = new DN.simulation.Simulation(cfg, app.bus);
    app.territory = new DN.territory.Territory(cfg, DN.datiLessinia);
    app.territory.update(app.sim.result, app.bus.values, 0);
    app.corridors = new DN.corridors.Corridors(cfg, app.territory);
    app.corridors.maybeCompute(performance.now(), app.bus.values, true);
    app.sim.corridoiAperti = app.corridors.corridoiAperti;
    app.eventi = new DN.eventi.Eventi(cfg, app.territory, app.corridors, DN.datiLessinia);
    app.renderer = new DN.render.Renderer(document.getElementById('map'), app.territory, app.corridors, cfg);
    app.renderer.u = unita();
    app.renderer.eventi = app.eventi;
    app.reset = () => app.bus.reset();
    app.ui = new DN.ui.UI(app);
    DN.app = app;   // accessibile dalla console del browser per calibrare

    // --- collegamento con la console degli slider ---------------------------
    const gesti = {};
    app.bus.on('set', (id) => { gesti[id] = performance.now(); });
    const canale = new DN.link.Canale((m) => {
      if (!m) return;
      app.consoleVista = performance.now();
      if (m.t === 'set' && ids.includes(m.id)) app.bus.set(m.id, +m.v, 'console');
      else if (m.t === 'release' && ids.includes(m.id)) app.bus.release(m.id, 'console');
      else if (m.t === 'reset') app.reset();
    });
    let ultimoInvio = 0;
    const invia = (now) => {
      if (now - ultimoInvio < 40) return;
      ultimoInvio = now;
      const held = {}, eta = {};
      ids.forEach((id) => { held[id] = app.bus.isHeld(id); eta[id] = now - (gesti[id] || -1e9); });
      const contributi = [];
      ids.forEach((j) => (app.sim.contributi[j] || []).forEach((o) => { if (Math.abs(o.c) >= 1) contributi.push([o.da, j, +o.c.toFixed(2)]); }));
      canale.send({ t: 'stato', values: app.bus.values, targets: app.sim.targets, held, motion: app.sim.motion, gesti: eta, contributi });
    };

    const dt = 1 / cfg.TEMPO.TICK_HZ;
    setInterval(() => {
      const res = app.sim.tick();
      app.territory.update(res, app.bus.values, dt);
      if (app.corridors.maybeCompute(performance.now(), app.bus.values, false)) {
        app.sim.corridoiAperti = app.corridors.corridoiAperti;
      }
      app.eventi.tick(dt, res, app.bus.values);
      app.bus.emitOutput();   // gli slider sono anche output (fader motorizzati)
    }, 1000 / cfg.TEMPO.TICK_HZ);

    const loop = (now) => {
      app.renderer.draw();
      app.ui.frame(now);
      invia(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const onResize = () => {
      app.renderer.u = unita();
      app.renderer.resize();
      app.renderer.cacheKey = '';
      if (app.renderer.onView) app.renderer.onView(app.renderer);
    };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.getElementById('map-wrap'));
    requestAnimationFrame(onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(window.DN = window.DN || {});
