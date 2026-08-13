/* ════════════════════════════════════════════════════════════════════════
   COLETOR: QUIZ
   Etapa = pergunta. Progresso = responder. Regressão = botão voltar.

   REGRA DURA, POR CONSTRUÇÃO E NÃO POR POLÍTICA:
   este coletor nunca lê valor digitado. Não existe `.value` neste arquivo.
   Resposta de quiz costuma ser dado de saúde, corpo ou dinheiro, e o jeito
   de não vazar isso não é prometer que não vaza — é não ter o código capaz
   de ler. O que se grava é a CHAVE da opção escolhida, nunca o texto exibido
   e nunca o que foi digitado.
   ════════════════════════════════════════════════════════════════════════ */

var perguntas = [];
var respostas = [];     // [{q: pergunta, o: chave da opção, t: quando}]
var concluiu = 0;
var enviouLead = 0;
var rotulos = null;      // {pergunta: {opcao: texto}} — montado uma vez
var rotulosEnviados = false;

/* Rótulo da alternativa. É copy do dono do quiz: igual para todo visitante,
   escrita por ele, não digitada por ninguém. É por isso que pode ser lido —
   ao contrário de valor de campo, que é dado da pessoa.

   Três travas: só de elemento que VOCÊ marcou com data-quiz-option, nunca de
   input/textarea/select, e com teto de tamanho. */
function lerRotulos() {
  var out = {};
  var nos = document.querySelectorAll('[data-quiz-option]');
  for (var i = 0; i < nos.length; i++) {
    var el = nos[i];
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') continue;

    var chave = el.getAttribute('data-quiz-option');
    if (!chave || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(chave)) continue;

    var texto = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!texto) continue;

    var q = null, pai = el;
    while (pai && pai !== document.body) {
      if (pai.hasAttribute && pai.hasAttribute('data-quiz-step')) {
        q = pai.getAttribute('data-quiz-question') || pai.getAttribute('data-quiz-step');
        break;
      }
      pai = pai.parentNode;
    }
    if (!q) continue;

    if (!out[q]) out[q] = {};
    out[q][chave] = texto;
  }
  return out;
}

register({
  name: 'quiz',
  primary: false,

  detect: function () {
    return !!document.querySelector('[data-quiz-step]');
  },

  scan: function () {
    rotulos = null;   // o DOM mudou; relê na próxima montagem do payload
    var nodes = document.querySelectorAll('[data-quiz-step]');
    if (nodes.length === perguntas.length) return;

    var antes = {};
    for (var i = 0; i < perguntas.length; i++) antes[perguntas[i].id] = perguntas[i];

    perguntas = [];
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j];
      var id = el.getAttribute('data-quiz-question') || el.getAttribute('data-quiz-step');
      var v = antes[id];
      perguntas.push({
        el: el, id: id,
        ord: Number(el.getAttribute('data-quiz-step')) || j,
        run: v ? v.run : 0,
        dwell: v ? v.dwell : 0,
        entries: v ? v.entries : 0,
        seen: v ? v.seen : false,
        inRun: v ? v.inRun : false,
        vis: v ? v.vis : false,
        oferta: el.hasAttribute('data-quiz-offer'),
      });
    }
    perguntas.sort(function (a, b) { return a.ord - b.ord; });
  },

  /* Mesma regra da página: a pergunta conta como vista ao ocupar metade da
     tela por 500ms seguidos. Num quiz de uma pergunta por tela isso é quase
     imediato — e continua filtrando quem passou correndo sem ver. */
  tick: function (dt) {
    for (var i = 0; i < perguntas.length; i++) {
      var p = perguntas[i];
      var v = visibleEnough(p.el);
      p.vis = v;
      if (v) {
        p.run += dt;
        p.dwell += dt;
        if (p.run >= QUALIFY && !p.inRun) { p.inRun = true; p.seen = true; p.entries++; }
      } else {
        p.run = 0;
        p.inRun = false;
      }
    }
  },

  state: function () {
    var e = {};
    for (var i = 0; i < perguntas.length; i++) {
      var p = perguntas[i];
      if (p.seen || p.dwell) e[p.id] = { t: p.dwell, e: p.entries, s: p.seen ? 1 : 0 };
    }
    return { e: e, r: respostas, c: concluiu, l: enviouLead };
  },

  restore: function (s) {
    respostas = s.r || [];
    concluiu = s.c || 0;
    enviouLead = s.l || 0;
    for (var i = 0; i < perguntas.length; i++) {
      var g = s.e && s.e[perguntas[i].id];
      if (!g) continue;
      perguntas[i].dwell = g.t || 0;
      perguntas[i].entries = g.e || 0;
      perguntas[i].seen = !!g.s;
    }
  },

  payload: function () {
    var etapas = [];
    for (var i = 0; i < perguntas.length; i++) {
      var p = perguntas[i];
      if (!p.seen) continue;
      var linha = {
        i: p.id, o: p.ord,
        h: Math.round(p.el.getBoundingClientRect().height),
        t: p.dwell, e: p.entries,
      };
      // data-quiz-offer diz QUAL etapa é a da oferta. Sem isso o painel teria
      // de adivinhar que é a última, e nem todo quiz termina na oferta.
      if (p.oferta) linha.of = 1;
      etapas.push(linha);
    }
    if (!etapas.length) return {};
    var out = { qz: { e: etapas, r: respostas.slice(0, 100) } };
    if (concluiu) out.qz.c = 1;
    if (enviouLead) out.qz.l = 1;

    // Uma vez por carregamento: o dicionário é do quiz, não da sessão.
    if (!rotulosEnviados) {
      if (!rotulos) rotulos = lerRotulos();
      if (Object.keys(rotulos).length) { out.qz.rt = rotulos; rotulosEnviados = true; }
    }
    return out;
  },

  exitStep: function () {
    var fundo = null;
    for (var i = 0; i < perguntas.length; i++) {
      if (perguntas[i].vis && perguntas[i].seen) fundo = perguntas[i].id;
    }
    if (fundo) return fundo;
    for (var j = perguntas.length - 1; j >= 0; j--) {
      if (perguntas[j].seen) return perguntas[j].id;
    }
    return null;
  },

  ownerStep: function (node) {
    var el = node;
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-quiz-step')) {
        return el.getAttribute('data-quiz-question') || el.getAttribute('data-quiz-step');
      }
      el = el.parentNode;
    }
    return null;
  },

  debug: function () {
    return {
      perguntas: perguntas.map(function (p) {
        return { pergunta: p.id, vista: p.seen, tempo_s: (p.dwell / 1000).toFixed(1), entradas: p.entries };
      }),
      respostas: respostas.map(function (r) { return r.q + '=' + r.o; }),
      concluiu: !!concluiu,
      lead: !!enviouLead,
    };
  },
});

/* Clique em opção. Lê o ATRIBUTO, nunca o texto do botão e nunca campo de
   digitação. Se a marcação não tem data-quiz-option, nada é gravado — em vez
   de cair para o texto visível, que é onde a resposta da pessoa aparece. */
document.addEventListener('click', function (ev) {
  var alvo = ev.target.closest && ev.target.closest('[data-quiz-option]');
  if (!alvo) return;

  var chave = alvo.getAttribute('data-quiz-option');
  if (!chave || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(chave)) return;

  var q = null, el = alvo;
  while (el && el !== document.body) {
    if (el.hasAttribute && el.hasAttribute('data-quiz-step')) {
      q = el.getAttribute('data-quiz-question') || el.getAttribute('data-quiz-step');
      break;
    }
    el = el.parentNode;
  }
  if (!q) return;

  // uma resposta por pergunta: trocar de ideia substitui, não empilha
  for (var i = 0; i < respostas.length; i++) {
    if (respostas[i].q === q) { respostas[i] = { q: q, o: chave, t: Date.now() }; return; }
  }
  respostas.push({ q: q, o: chave, t: Date.now() });
}, true);

/* Conclusão e lead. Do envio de formulário registra-se APENAS que houve
   envio — nenhum campo é percorrido, nem para contar quantos são. */
document.addEventListener('submit', function () { enviouLead = 1; }, true);

window.reguaQuiz = {
  concluir: function () { concluiu = 1; },
  lead: function () { enviouLead = 1; },
};
