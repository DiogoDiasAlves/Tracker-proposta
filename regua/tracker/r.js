/*!
 * Régua — mapa de retenção para páginas de vendas
 *
 * Instalação:
 *   <section data-block="hero"> ... </section>
 *   <button data-cta="checkout-principal">Comprar</button>
 *   <script src="https://SEU-HOST/r.js" data-page="oferta-x" data-version="1" defer></script>
 *
 * O que este arquivo NÃO faz, por decisão de projeto: não grava tela, não lê
 * conteúdo de input, não escreve cookie, não identifica ninguém. O id de sessão
 * mora em sessionStorage e desaparece quando a aba fecha.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var PAGE = script.getAttribute('data-page');
  if (!PAGE) return console.warn('[regua] data-page ausente; nada será coletado.');

  var VERSION = script.getAttribute('data-version') || '1';
  var ENDPOINT = script.getAttribute('data-endpoint') ||
                 new URL(script.src, location.href).origin;

  // Regras de contagem — os mesmos números da proposta.
  var TICK = 200;        // resolução da amostragem
  var QUALIFY = 500;     // ms contínuos para o bloco contar como visto
  var COVER = 0.5;       // metade da tela (ou metade do próprio bloco, se for baixo)
  var FLUSH = 10000;     // envio periódico

  /* ── sessão ─────────────────────────────────────────────────────────────
     sessionStorage é exatamente a semântica prometida: sobrevive ao reload
     (não cria sessão nova) e é isolado por aba (duas abas = duas sessões).  */
  var sid;
  try {
    sid = sessionStorage.getItem('_rg');
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('_rg', sid);
    }
  } catch (e) {
    sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                 (matchMedia('(pointer: coarse)').matches && innerWidth < 1024);

  /* ── estado ──────────────────────────────────────────────────────────
     Guardado em sessionStorage junto com o id. "Recarregar não cria sessão
     nova" só é verdade se o acumulado sobreviver ao reload: o servidor
     sobrescreve totais, então voltar zerado apagaria a leitura anterior. E o
     contador de lotes precisa continuar de onde parou, senão o servidor
     descarta tudo que vier depois do F5 como lote atrasado.                */
  var STATE_KEY = '_rg_st';
  var blocks = [];
  var ctaClicks = [];
  var converted = 0;
  var exitViaCta = false;
  var seq = 0;

  function loadState() {
    try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveState() {
    try {
      var b = {};
      for (var i = 0; i < blocks.length; i++) {
        var x = blocks[i];
        if (x.seen || x.dwell) b[x.id] = { t: x.dwell, e: x.entries, s: x.seen ? 1 : 0 };
      }
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        q: seq, b: b, c: ctaClicks, cv: converted, x: exitViaCta ? 1 : 0
      }));
    } catch (e) { /* cota cheia ou modo privado: segue sem persistir */ }
  }

  function collect() {
    var nodes = document.querySelectorAll('[data-block]');
    blocks = [];
    for (var i = 0; i < nodes.length; i++) {
      blocks.push({
        el: nodes[i],
        id: nodes[i].getAttribute('data-block'),
        ord: i,
        run: 0,       // ms do trecho contínuo atual
        dwell: 0,     // ms visíveis acumulados
        entries: 0,   // quantas vezes entrou (reentradas)
        seen: false,  // já qualificou alguma vez
        inRun: false,
        vis: false
      });
    }
  }
  collect();
  if (!blocks.length) console.warn('[regua] nenhum [data-block] encontrado em ' + PAGE);

  (function restore() {
    var s = loadState();
    if (!s) return;
    seq = s.q || 0;
    ctaClicks = s.c || [];
    converted = s.cv || 0;
    exitViaCta = !!s.x;
    for (var i = 0; i < blocks.length; i++) {
      var saved = s.b && s.b[blocks[i].id];
      if (!saved) continue;
      blocks[i].dwell = saved.t || 0;
      blocks[i].entries = saved.e || 0;
      blocks[i].seen = !!saved.s;
    }
  })();

  /* Regra de visibilidade da proposta: o bloco conta quando ocupa metade da
     tela. Blocos baixos nunca chegariam lá, então vale também metade da altura
     do próprio bloco — senão um bloco de 200px seria invisível para sempre. */
  function visible(b) {
    var r = b.el.getBoundingClientRect();
    var vh = innerHeight || document.documentElement.clientHeight;
    var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (shown <= 0) return false;
    return shown >= COVER * vh || shown >= COVER * r.height;
  }

  function tick() {
    if (document.visibilityState !== 'visible') return; // só em primeiro plano
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var v = visible(b);
      b.vis = v;
      if (v) {
        b.run += TICK;
        b.dwell += TICK;
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
  }
  setInterval(tick, TICK);

  /* ── CTA ────────────────────────────────────────────────────────────── */
  function ownerBlock(node) {
    var el = node;
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-block')) return el.getAttribute('data-block');
      el = el.parentNode;
    }
    return null;
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-cta]');
    if (!el) return;
    ctaClicks.push({ k: el.getAttribute('data-cta'), b: ownerBlock(el), t: Date.now() });
    exitViaCta = true;

    // Carrega a sessão para o checkout, para que a conversão possa ser
    // atribuída de volta a esta leitura. Sem isso, "conversão" seria só
    // clique em botão — e clique em botão não é venda.
    if (el.tagName === 'A' && el.href && !el.hasAttribute('data-no-forward')) {
      try {
        var u = new URL(el.href, location.href);
        if (!u.searchParams.has('rg_s')) {
          u.searchParams.set('rg_s', sid);
          el.href = u.toString();
        }
      } catch (e) { /* href não parseável: segue sem atribuição */ }
    }
    // Beacon, não fetch: se o CTA é um link, a navegação começa agora e um
    // fetch pendente morre com a página — o clique nunca chegaria.
    flush(false, true);
  }, true);

  /* ── envio ──────────────────────────────────────────────────────────
     O payload carrega totais acumulados, não deltas. Isso torna cada envio
     idempotente: lote duplicado, fora de ordem ou perdido não corrompe nada,
     porque o servidor sobrescreve em vez de somar. */
  var sentInit = false;

  function payload(final) {
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

    var out = {
      s: sid, p: PAGE, v: VERSION, d: isMobile ? 'mobile' : 'desktop',
      n: ++seq, b: bs
    };

    if (ctaClicks.length) { out.c = ctaClicks.slice(); }
    if (converted) out.cv = 1;

    if (!sentInit) {
      sentInit = true;
      var q = new URLSearchParams(location.search);
      out.st = {
        us: q.get('utm_source'), um: q.get('utm_medium'), uc: q.get('utm_campaign'),
        uo: q.get('utm_content'), ut: q.get('utm_term'),
        rf: referrerHost()
      };
    }

    if (final) {
      // "Registra o bloco visível mais profundo no momento em que a aba foi
      // fechada" — o mais profundo AGORA, não o mais profundo de sempre.
      var deepest = null;
      for (var j = 0; j < blocks.length; j++) {
        if (blocks[j].vis && blocks[j].seen) deepest = blocks[j].id;
      }
      if (!deepest) {
        for (var k = blocks.length - 1; k >= 0; k--) {
          if (blocks[k].seen) { deepest = blocks[k].id; break; }
        }
      }
      out.x = { b: deepest, cta: exitViaCta ? 1 : 0 };
    }
    return out;
  }

  function referrerHost() {
    try {
      if (!document.referrer) return null;
      var h = new URL(document.referrer).host;
      return h === location.host ? null : h;
    } catch (e) { return null; }
  }

  function flush(final, beacon) {
    var body = JSON.stringify(payload(final));
    saveState();
    var url = ENDPOINT + '/e';
    // text/plain evita o preflight de CORS: o beacon de saída não tem tempo
    // para um OPTIONS de ida e volta.
    if ((final || beacon) && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      return;
    }
    try {
      fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'cors',
                   headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
        .catch(function () {});
    } catch (e) { /* rede indisponível: a sessão simplesmente não é contada */ }
  }

  setInterval(function () { flush(false); }, FLUSH);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  addEventListener('pagehide', function () { flush(true); });

  /* Blocos que só existem depois de algum JS da página rodar.
     Com debounce: cronômetro, chat e carrossel mexem no DOM continuamente, e
     um querySelectorAll por mutação custaria mais que todo o resto do script. */
  if (window.MutationObserver) {
    var rescanPending = false;
    var mo = new MutationObserver(function () {
      if (rescanPending) return;
      rescanPending = true;
      setTimeout(function () {
        rescanPending = false;
        if (document.querySelectorAll('[data-block]').length === blocks.length) return;
        var prev = {};
        for (var i = 0; i < blocks.length; i++) prev[blocks[i].id] = blocks[i];
        collect();
        for (var j = 0; j < blocks.length; j++) {
          var old = prev[blocks[j].id];
          if (old) { blocks[j].dwell = old.dwell; blocks[j].entries = old.entries;
                     blocks[j].seen = old.seen; blocks[j].run = old.run;
                     blocks[j].inRun = old.inRun; blocks[j].vis = old.vis; }
        }
      }, 1000);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  flush(false); // marca o page view imediatamente

  window.regua = {
    convert: function () { converted = 1; flush(false); },
    session: function () { return sid; },
    debug: function () {
      return blocks.map(function (b) {
        return { bloco: b.id, visto: b.seen, tempo_s: (b.dwell / 1000).toFixed(1), entradas: b.entries };
      });
    }
  };
})();
