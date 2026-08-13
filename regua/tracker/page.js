/* ════════════════════════════════════════════════════════════════════════
   COLETOR: PÁGINA DE VENDAS
   Etapa = bloco marcado com data-block. Progresso = scroll.

   Semântica documentada no README e vendida na proposta — não muda sem
   decisão explícita:
     • o bloco conta como visto ao ocupar metade da tela por 500ms seguidos
     • tempo só acumula com a aba em primeiro plano
     • voltar ao bloco conta como reentrada
   ════════════════════════════════════════════════════════════════════════ */

var blocks = [];

register({
  name: 'page',
  primary: true,

  detect: function () {
    return !!document.querySelector('[data-block]');
  },

  scan: function () {
    var nodes = document.querySelectorAll('[data-block]');
    if (nodes.length === blocks.length) return;   // nada mudou

    var prev = {};
    for (var i = 0; i < blocks.length; i++) prev[blocks[i].id] = blocks[i];

    blocks = [];
    for (var j = 0; j < nodes.length; j++) {
      var id = nodes[j].getAttribute('data-block');
      var old = prev[id];
      blocks.push({
        el: nodes[j],
        id: id,
        ord: j,
        run: old ? old.run : 0,          // ms do trecho contínuo atual
        dwell: old ? old.dwell : 0,      // ms visíveis acumulados
        entries: old ? old.entries : 0,  // quantas vezes entrou (reentradas)
        seen: old ? old.seen : false,    // já qualificou alguma vez
        inRun: old ? old.inRun : false,
        vis: old ? old.vis : false
      });
    }
  },

  tick: function (dt) {
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var v = visibleEnough(b.el);
      b.vis = v;
      if (v) {
        b.run += dt;
        b.dwell += dt;
        if (b.run >= QUALIFY && !b.inRun) {
          b.inRun = true;
          b.seen = true;
          b.entries++;
        }
      } else {
        b.run = 0;
        b.inRun = false;
      }
    }
  },

  state: function () {
    var out = {};
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.seen || b.dwell) out[b.id] = { t: b.dwell, e: b.entries, s: b.seen ? 1 : 0 };
    }
    return out;
  },

  restore: function (saved) {
    for (var i = 0; i < blocks.length; i++) {
      var s = saved[blocks[i].id];
      if (!s) continue;
      blocks[i].dwell = s.t || 0;
      blocks[i].entries = s.e || 0;
      blocks[i].seen = !!s.s;
    }
  },

  payload: function () {
    var bs = [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b.seen) continue;
      bs.push({
        i: b.id, o: b.ord,
        h: Math.round(b.el.getBoundingClientRect().height),
        t: b.dwell, e: b.entries
      });
    }
    return { b: bs };
  },

  /* "Registra o bloco visível mais profundo no momento em que a aba foi
     fechada" — o mais profundo AGORA, não o mais profundo de sempre. */
  exitStep: function () {
    var deepest = null;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].vis && blocks[i].seen) deepest = blocks[i].id;
    }
    if (deepest) return deepest;
    for (var j = blocks.length - 1; j >= 0; j--) {
      if (blocks[j].seen) return blocks[j].id;
    }
    return null;
  },

  ownerStep: function (node) {
    var el = node;
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-block')) return el.getAttribute('data-block');
      el = el.parentNode;
    }
    return null;
  },

  debug: function () {
    return blocks.map(function (b) {
      return {
        bloco: b.id, visto: b.seen,
        tempo_s: (b.dwell / 1000).toFixed(1), entradas: b.entries
      };
    });
  }
});
