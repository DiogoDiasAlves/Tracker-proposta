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

  /* Nunca remove: um bloco que sai do DOM (troca de rota numa SPA, por
     exemplo — várias telas condicionais de um mesmo funil, cada uma com seus
     próprios [data-block]) para de acumular tempo sozinho — tick() vê o
     elemento destacado do documento como invisível — mas o que ele já tinha
     visto continua no payload. Descartar ao sair do DOM perderia o bloco
     inteiro de quem navegou mais rápido que o intervalo de flush (10s):
     antes, comparar só a QUANTIDADE de nós fazia a varredura inteira ser
     ignorada quando a etapa nova tinha o mesmo total de nós que a anterior
     (comum numa SPA que só mostra uma etapa de cada vez), então a troca
     nunca era percebida. Agora a comparação é por identidade (o quê, não
     quanto).

     Ordem: por padrão é a ordem de descoberta (posição no DOM na primeira
     vez que o bloco aparece). data-block-order, quando presente, sobrepõe
     isso — necessário quando o funil atravessa mais de uma página/rota (o
     script reinicia do zero em cada uma, então a contagem de "descoberta"
     também reinicia) e o dono da página precisa garantir que os blocos da
     segunda tela continuem depois dos da primeira em vez de recomeçar do 0. */
  scan: function () {
    var nodes = document.querySelectorAll('[data-block]');
    for (var j = 0; j < nodes.length; j++) {
      var id = nodes[j].getAttribute('data-block');
      var existing = null;
      for (var k = 0; k < blocks.length; k++) {
        if (blocks[k].id === id) { existing = blocks[k]; break; }
      }
      if (existing) {
        existing.el = nodes[j];   // pode ter remontado com o mesmo id
      } else {
        var ordAttr = Number(nodes[j].getAttribute('data-block-order'));
        blocks.push({
          el: nodes[j],
          id: id,
          ord: isFinite(ordAttr) && nodes[j].hasAttribute('data-block-order') ? ordAttr : blocks.length,
          run: 0, dwell: 0, entries: 0, seen: false, inRun: false, vis: false, height: 0
        });
      }
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
        // Guardada enquanto está de fato renderizado — não lida na hora do
        // envio, porque numa SPA o elemento pode já ter saído do DOM (trocou
        // de rota) e getBoundingClientRect() de um nó destacado devolve 0,
        // o que zeraria "tempo por 100px" de qualquer bloco de uma etapa
        // anterior que ainda não tinha sido enviada.
        var h = b.el.getBoundingClientRect().height;
        if (h > 0) b.height = Math.round(h);
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
      if (b.seen || b.dwell) out[b.id] = { t: b.dwell, e: b.entries, s: b.seen ? 1 : 0, h: b.height };
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
      blocks[i].height = s.h || 0;
    }
  },

  payload: function () {
    var bs = [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b.seen) continue;
      bs.push({
        i: b.id, o: b.ord,
        h: b.height,
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
