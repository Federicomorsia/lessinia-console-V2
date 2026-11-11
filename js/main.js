/* =====================================================================
   MAIN — collega i moduli e fa girare i due orologi:
   - simulazione a passo fisso (TICK_HZ),
   - disegno a ogni frame (requestAnimationFrame).
   ===================================================================== */
(function (DN) {
  'use strict';

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
    app.renderer = new DN.render.Renderer(document.getElementById('map'), app.territory, app.corridors, cfg);
    app.reset = () => app.bus.reset();
    app.ui = new DN.ui.UI(app);
    DN.app = app;   // accessibile dalla console del browser per calibrare

    const dt = 1 / cfg.TEMPO.TICK_HZ;
    setInterval(() => {
      const res = app.sim.tick();
      app.territory.update(res, app.bus.values, dt);
      if (app.corridors.maybeCompute(performance.now(), app.bus.values, false)) {
        app.sim.corridoiAperti = app.corridors.corridoiAperti;
      }
      app.bus.emitOutput();   // gli slider sono anche output (fader motorizzati)
    }, 1000 / cfg.TEMPO.TICK_HZ);

    const t0 = performance.now();
    const loop = (now) => {
      app.renderer.draw((now - t0) / 1000, app.sim, app.bus.values);
      app.ui.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const onResize = () => { app.renderer.resize(); app.ui.layout(); };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.getElementById('map-wrap'));
    requestAnimationFrame(onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(window.DN = window.DN || {});
