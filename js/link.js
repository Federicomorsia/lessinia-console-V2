/* =====================================================================
   LINK — collegamento tra la tavola (index.html) e la console degli
   slider (console.html), aperte in due finestre o su due schermi.
   La simulazione gira solo nella tavola; la console manda i gesti
   (set / release / reset) e riceve lo stato degli slider.
   Usa BroadcastChannel; da file:// ripiega su localStorage, che i
   browser condividono tra le pagine locali in modo meno affidabile:
   per l'installazione meglio un server locale (vedi README).
   ===================================================================== */
(function (DN) {
  'use strict';

  const NOME = 'dn-seduta';

  class Canale {
    constructor(onMsg) {
      this.onMsg = onMsg;
      this.bc = null;
      const locale = location.protocol === 'file:';
      if (!locale && 'BroadcastChannel' in window) {
        this.bc = new BroadcastChannel(NOME);
        this.bc.onmessage = (e) => this.onMsg(e.data);
      } else {
        window.addEventListener('storage', (e) => {
          if (e.key !== NOME || !e.newValue) return;
          try { this.onMsg(JSON.parse(e.newValue).m); } catch (err) { /* messaggio illeggibile */ }
        });
      }
      this._n = 0;
    }
    send(m) {
      if (this.bc) { this.bc.postMessage(m); return; }
      try { localStorage.setItem(NOME, JSON.stringify({ n: ++this._n, t: Date.now(), m })); } catch (err) { /* storage non disponibile */ }
    }
  }

  DN.link = { Canale };

})(window.DN = window.DN || {});
