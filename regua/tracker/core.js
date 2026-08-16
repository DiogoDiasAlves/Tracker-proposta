/* ════════════════════════════════════════════════════════════════════════
   NÚCLEO
   Tudo que é comum aos três coletores: sessão, estado que sobrevive ao
   reload, transporte idempotente, UTM, dispositivo, CTA e conversão.

   Um coletor é um objeto com esta forma — todos os campos opcionais menos
   `name` e `detect`:

     name      'page' | 'vsl' | 'quiz'
     primary   true se este coletor manda na atribuição de saída
     detect()  há algo nesta página para este coletor medir?
     scan()    (re)varre o DOM; chamado no início e quando o DOM muda
     tick(ms)  chamado a cada TICK, só com a aba em primeiro plano
     state()   objeto serializável do acumulado, para sobreviver ao F5
     restore(s) recebe de volta o que state() gravou
     payload(final) fragmento a ser fundido no envelope de envio
     exitStep() etapa mais profunda agora, para a atribuição de saída
     ownerStep(el) a que etapa pertence este elemento (atribuição de CTA)
     debug()   leitura humana do estado, para a página de teste
   ════════════════════════════════════════════════════════════════════════ */

var script = document.currentScript;
if (!script) return;

var PAGE = script.getAttribute('data-page');
if (!PAGE) return console.warn('[regua] data-page ausente; nada será coletado.');

// Chave pública da conta. Não autoriza leitura de nada — só diz de qual conta
// é o evento que está chegando. Pode ficar exposta no HTML sem problema.
var KEY = script.getAttribute('data-key');
if (!KEY) return console.warn('[regua] data-key ausente; nada será coletado.');

var VERSION = script.getAttribute('data-version') || '1';
var ENDPOINT = script.getAttribute('data-endpoint') ||
               new URL(script.src, location.href).origin;

// Regras de contagem — os mesmos números da proposta.
var TICK = 200;        // resolução da amostragem
var QUALIFY = 500;     // ms contínuos para a etapa contar como vista
var COVER = 0.5;       // metade da tela (ou metade da própria etapa, se for baixa)
var FLUSH = 10000;     // envio periódico
var STATE_KEY = '_rg_st';

/* ── sessão ───────────────────────────────────────────────────────────
   sessionStorage é exatamente a semântica prometida: sobrevive ao reload
   (não cria sessão nova) e é isolado por aba (duas abas = duas sessões).  */
/* /c.gif?s=<sid> (página de obrigado sem JS) marca a sessão como convertida
   sem exigir a site key — só o próprio sid. Math.random() dá poucas dezenas
   de bits; quem adivinhasse um sid de outra conta inflava a conversão dela.
   randomUUID() (122 bits) torna adivinhar inviável; cai pro esquema antigo só
   em navegador tão velho que nem tem crypto.randomUUID. */
var sidNovo = function () {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
};
var sid;
try {
  sid = sessionStorage.getItem('_rg');
  if (!sid) {
    sid = sidNovo();
    sessionStorage.setItem('_rg', sid);
  }
} catch (e) {
  sid = sidNovo();
}

var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
               (matchMedia('(pointer: coarse)').matches && innerWidth < 1024);

/* ── estado ───────────────────────────────────────────────────────────
   "Recarregar não cria sessão nova" só é verdade se o acumulado sobreviver
   ao F5: o servidor sobrescreve totais, então voltar zerado apagaria a
   leitura anterior. E o contador de lotes precisa continuar de onde parou,
   senão o servidor descarta tudo que vier depois como lote atrasado.     */
var collectors = [];
var active = [];
var ctaClicks = [];
var converted = 0;
var exitViaCta = false;
var seq = 0;
var sentInit = false;

function register(c) { collectors.push(c); }

/* Isolamento entre coletores.

   O tracker roda na página DE OUTRA PESSOA, com DOM que a gente não escreveu
   e que muda sem avisar. Um erro num coletor não pode derrubar os outros —
   e, pior, sem isto o laço de amostragem abortava a cada 200ms em silêncio,
   parando a coleta inteira sem ninguém perceber.

   Falhar por padrão é a decisão certa aqui: um bloco não medido é um dado a
   menos; uma exceção não contida é a página do cliente com erro no console. */
function seguro(fn, rotulo) {
  try { return fn(); }
  catch (e) {
    if (!seguro.avisou[rotulo]) {
      seguro.avisou[rotulo] = 1;   // uma vez por rótulo, não a cada tick
      try { console.warn('[regua] falha em ' + rotulo + ':', e && e.message); } catch (x) {}
    }
    return null;
  }
}
seguro.avisou = {};

function loadState() {
  try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); }
  catch (e) { return null; }
}

function saveState() {
  try {
    var col = {};
    for (var i = 0; i < active.length; i++) {
      (function (c) {
        if (c.state) col[c.name] = seguro(function () { return c.state(); }, c.name + '.state');
      })(active[i]);
    }
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      q: seq, c: ctaClicks, cv: converted, x: exitViaCta ? 1 : 0, col: col
    }));
  } catch (e) { /* cota cheia ou modo privado: segue sem persistir */ }
}

function restoreState() {
  var s = loadState();
  if (!s) return;
  seq = s.q || 0;
  ctaClicks = s.c || [];
  converted = s.cv || 0;
  exitViaCta = !!s.x;
  for (var i = 0; i < active.length; i++) {
    var saved = s.col && s.col[active[i].name];
    if (saved && active[i].restore) {
      (function (c, g) { seguro(function () { c.restore(g); }, c.name + '.restore'); })(active[i], saved);
    }
  }
}

/* ── geometria compartilhada ──────────────────────────────────────────
   Regra de visibilidade da proposta: a etapa conta quando ocupa metade da
   tela. Etapas baixas nunca chegariam lá, então vale também metade da
   própria altura — senão um bloco de 200px seria invisível para sempre.  */
function visibleEnough(el) {
  var r = el.getBoundingClientRect();
  var vh = innerHeight || document.documentElement.clientHeight;
  var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  if (shown <= 0) return false;
  return shown >= COVER * vh || shown >= COVER * r.height;
}

/* ── laço de amostragem ─────────────────────────────────────────────── */
function tick() {
  if (document.visibilityState !== 'visible') return; // só em primeiro plano
  for (var i = 0; i < active.length; i++) {
    (function (c) {
      if (c.tick) seguro(function () { c.tick(TICK); }, c.name + '.tick');
    })(active[i]);
  }
}

/* ── CTA ──────────────────────────────────────────────────────────────
   Vive no núcleo porque CTA existe nos três produtos: página de vendas,
   página com VSL e tela final de quiz.                                  */
function ownerStep(node) {
  for (var i = 0; i < active.length; i++) {
    if (!active[i].ownerStep) continue;
    var s = (function (c) {
      return seguro(function () { return c.ownerStep(node); }, c.name + '.ownerStep');
    })(active[i]);
    if (s) return s;
  }
  return null;
}

function onClick(ev) {
  var el = ev.target && ev.target.closest && ev.target.closest('[data-cta]');
  if (!el) return;
  ctaClicks.push({ k: el.getAttribute('data-cta'), b: ownerStep(el), t: Date.now() });
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
}

/* ── envio ────────────────────────────────────────────────────────────
   O payload carrega totais acumulados, não deltas. Isso torna cada envio
   idempotente: lote duplicado, fora de ordem ou perdido não corrompe nada,
   porque o servidor sobrescreve em vez de somar.                        */
function referrerHost() {
  try {
    if (!document.referrer) return null;
    var h = new URL(document.referrer).host;
    return h === location.host ? null : h;
  } catch (e) { return null; }
}

function payload(final) {
  var out = {
    s: sid, k: KEY, p: PAGE, v: VERSION, d: isMobile ? 'mobile' : 'desktop', n: ++seq
  };

  for (var i = 0; i < active.length; i++) {
    if (!active[i].payload) continue;
    var frag = (function (c) {
      return seguro(function () { return c.payload(final); }, c.name + '.payload');
    })(active[i]);
    if (!frag) continue;
    for (var k in frag) if (frag.hasOwnProperty(k)) out[k] = frag[k];
  }

  if (ctaClicks.length) out.c = ctaClicks.slice();
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
    var deepest = null;
    for (var j = 0; j < active.length && !deepest; j++) {
      if (!active[j].primary || !active[j].exitStep) continue;
      deepest = (function (c) {
        return seguro(function () { return c.exitStep(); }, c.name + '.exitStep');
      })(active[j]);
    }
    out.x = { b: deepest, cta: exitViaCta ? 1 : 0 };
  }
  return out;
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

/* ── ciclo de vida ──────────────────────────────────────────────────── */
function rescan() {
  for (var i = 0; i < active.length; i++) {
    (function (c) {
      if (c.scan) seguro(function () { c.scan(); }, c.name + '.scan');
    })(active[i]);
  }
}

function start() {
  for (var i = 0; i < collectors.length; i++) {
    (function (c) {
      if (seguro(function () { return c.detect(); }, c.name + '.detect')) active.push(c);
    })(collectors[i]);
  }
  if (!active.length) {
    return console.warn('[regua] nada para medir em ' + PAGE +
                        ' — faltam [data-block], [data-vsl] ou [data-quiz-step]?');
  }

  rescan();
  restoreState();

  setInterval(tick, TICK);
  setInterval(function () { flush(false); }, FLUSH);
  document.addEventListener('click', onClick, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  addEventListener('pagehide', function () { flush(true); });

  /* Etapas que só existem depois de algum JS da página rodar.
     Com debounce: cronômetro, chat e carrossel mexem no DOM continuamente,
     e um querySelectorAll por mutação custaria mais que todo o resto.    */
  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; rescan(); }, 1000);
    }).observe(document.body, { childList: true, subtree: true });
  }

  flush(false); // marca o page view imediatamente

  window.regua = {
    convert: function () { converted = 1; flush(false); },
    session: function () { return sid; },
    debug: function () {
      var out = {};
      for (var i = 0; i < active.length; i++) {
        if (active[i].debug) out[active[i].name] = active[i].debug();
      }
      return out;
    }
  };
}
