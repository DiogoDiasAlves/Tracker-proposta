/* ════════════════════════════════════════════════════════════════════════
   COLETOR: VÍDEO
   Etapa = segundo do vídeo. Progresso = playback. Regressão = voltar/rever.

   Lema: medir QUALQUER vídeo da página, sem exigir marcação. O coletor
   descobre sozinho e começa a medir quando alguém dá play.

   O limite é físico, não de esforço: vídeo dentro de iframe de outro domínio
   que não exponha API não pode ser lido de fora — o navegador proíbe
   (same-origin). Por isso a camada de adaptadores: cada player entrega o que
   consegue, e o que não dá para saber é reportado como desconhecido em vez
   de ser chutado.
   ════════════════════════════════════════════════════════════════════════ */

var videos = [];

/* ── adaptadores ──────────────────────────────────────────────────────
   Contrato mínimo: dizer se está tocando e em que segundo está.        */

function adaptadorHtml5(el) {
  return {
    tipo: 'html5',
    duracao: function () { return el.duration || 0; },
    posicao: function () { return el.currentTime; },
    tocando: function () { return !el.paused && !el.ended && el.readyState > 2; },
    mudo: function () { return !!el.muted; },
    autoplay: function () { return !!el.autoplay; },
  };
}

/* Player novo da VTurb: custom element no DOM da própria página, não iframe.
   Confirmado que expõe player:ready / video:play / video:pause. O acesso à
   POSIÇÃO não está documentado, então tentamos, em ordem, as formas usuais —
   e se nenhuma responder, o vídeo é reportado como parcial: play e pausa
   contam, curva de retenção não. Melhor um dado faltando e assumido do que
   uma curva inventada. */
function adaptadorVturb(el) {
  function interno() {
    try { return el.querySelector('video') || (el.shadowRoot && el.shadowRoot.querySelector('video')); }
    catch (e) { return null; }
  }
  function pos() {
    var v = interno();
    if (v && isFinite(v.currentTime)) return v.currentTime;
    if (typeof el.currentTime === 'number') return el.currentTime;
    if (typeof el.getCurrentTime === 'function') { try { return el.getCurrentTime(); } catch (e) {} }
    return null;
  }
  return {
    tipo: 'vturb',
    duracao: function () {
      var v = interno();
      if (v && isFinite(v.duration)) return v.duration;
      return Number(el.getAttribute('duration')) || 0;
    },
    posicao: pos,
    tocando: function () {
      var v = interno();
      if (v) return !v.paused && !v.ended;
      return !!el.playing;
    },
    mudo: function () { var v = interno(); return v ? !!v.muted : false; },
    autoplay: function () { return el.hasAttribute('autoplay'); },
  };
}

/* ── YouTube e Vimeo ──────────────────────────────────────────────────
   Estes vivem em iframe de outro domínio: o navegador não deixa ler nada de
   dentro. A única porta é a API que cada um publica, e ela chega por um SDK
   que precisa ser carregado.

   Carregamos SOB DEMANDA: só quando existe um iframe daquele player na
   página. Página sem YouTube não paga requisição nenhuma — cobrar de todo
   mundo pelo que só alguns usam seria o tipo de peso que o dono da página
   não pediu.

   O estado de cada player fica aqui, alimentado pelos eventos deles, e o
   `tick` do núcleo só lê. Vimeo é todo baseado em promessa e não responde a
   pergunta síncrona; guardar o último valor recebido resolve os dois. */
var externos = {};      // id do iframe -> { pos, dur, tocando, mudo }
var sdkPedido = {};

function idDoQuadro(el) {
  if (!el.__rgId) el.__rgId = 'rg' + Math.random().toString(36).slice(2, 9);
  return el.__rgId;
}

function carregarSdk(url, chave, aoCarregar) {
  if (sdkPedido[chave]) return;
  sdkPedido[chave] = 1;
  var s = document.createElement('script');
  s.src = url;
  s.async = true;
  s.onload = function () { try { aoCarregar(); } catch (e) {} };
  s.onerror = function () { /* rede bloqueada: o vídeo fica sem medição */ };
  document.head.appendChild(s);
}

function adaptadorExterno(id, tipo) {
  return {
    tipo: tipo,
    duracao: function () { return (externos[id] && externos[id].dur) || 0; },
    posicao: function () {
      var e = externos[id];
      return e && typeof e.pos === 'number' ? e.pos : null;
    },
    tocando: function () { return !!(externos[id] && externos[id].tocando); },
    mudo: function () { return !!(externos[id] && externos[id].mudo); },
    autoplay: function () { return !!(externos[id] && externos[id].autoplay); },
  };
}

/* YouTube. A API só enxerga o iframe se ele tiver enablejsapi=1 no src.
   Quando falta, acrescentamos — o que recarrega o iframe, e por isso só
   fazemos na primeira varredura, antes de qualquer play. Sem isso o vídeo
   simplesmente não seria mensurável, e "sem configuração" viraria mentira. */
function prepararYoutube(quadro) {
  var src = quadro.getAttribute('src') || '';
  if (!/youtube(-nocookie)?\.com\/embed\//.test(src)) return false;

  if (!/[?&]enablejsapi=1/.test(src)) {
    quadro.setAttribute('src', src + (src.indexOf('?') < 0 ? '?' : '&') + 'enablejsapi=1');
  }
  var id = idDoQuadro(quadro);
  if (externos[id]) return true;
  externos[id] = { pos: null, dur: 0, tocando: false, mudo: false, autoplay: /[?&]autoplay=1/.test(src) };

  function criar() {
    if (!window.YT || !window.YT.Player) return;
    try {
      var p = new window.YT.Player(quadro, {
        events: {
          onReady: function (ev) {
            var e = externos[id];
            e.dur = ev.target.getDuration() || 0;
            e.mudo = !!ev.target.isMuted();
          },
          onStateChange: function (ev) {
            externos[id].tocando = ev.data === 1;   // 1 = PLAYING
          },
        },
      });
      // a posição não vem por evento: perguntamos no mesmo ritmo do núcleo
      setInterval(function () {
        try {
          var e = externos[id];
          e.pos = p.getCurrentTime();
          if (!e.dur) e.dur = p.getDuration() || 0;
          e.mudo = !!p.isMuted();
        } catch (x) {}
      }, TICK);
    } catch (x) {}
  }

  if (window.YT && window.YT.Player) criar();
  else {
    var antes = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof antes === 'function') { try { antes(); } catch (x) {} }
      criar();
    };
    carregarSdk('https://www.youtube.com/iframe_api', 'yt', function () {});
  }
  return true;
}

/* Vimeo. O SDK aceita qualquer iframe do player, sem parâmetro extra. Toda a
   API é assíncrona, então guardamos o último valor que os eventos trouxeram. */
function prepararVimeo(quadro) {
  var src = quadro.getAttribute('src') || '';
  if (!/player\.vimeo\.com\/video\//.test(src)) return false;

  var id = idDoQuadro(quadro);
  if (externos[id]) return true;
  externos[id] = { pos: null, dur: 0, tocando: false, mudo: false, autoplay: /[?&]autoplay=1/.test(src) };

  function criar() {
    if (!window.Vimeo || !window.Vimeo.Player) return;
    try {
      var p = new window.Vimeo.Player(quadro);
      p.getDuration().then(function (d) { externos[id].dur = d || 0; }).catch(function () {});
      p.on('timeupdate', function (d) {
        var e = externos[id];
        e.pos = d.seconds;
        if (!e.dur && d.duration) e.dur = d.duration;
      });
      p.on('play', function () { externos[id].tocando = true; });
      p.on('pause', function () { externos[id].tocando = false; });
      p.on('ended', function () { externos[id].tocando = false; });
      p.getVolume().then(function (v) { externos[id].mudo = v === 0; }).catch(function () {});
    } catch (x) {}
  }

  if (window.Vimeo && window.Vimeo.Player) criar();
  else carregarSdk('https://player.vimeo.com/api/player.js', 'vimeo', criar);
  return true;
}

function nomeDe(el, i) {
  var marcado = el.getAttribute && el.getAttribute('data-vsl');
  if (marcado) return marcado;
  var src = (el.currentSrc || el.src || (el.getAttribute && el.getAttribute('src')) || '') + '';

  // iframe: o identificador útil é o id do vídeo, não o nome do arquivo
  var yt = src.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (yt) return 'yt-' + yt[1];
  var vm = src.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vm) return 'vimeo-' + vm[1];

  var base = src.split('?')[0].split('/').pop() || '';
  base = base.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40);
  return base || ('video-' + (i + 1));
}

function registrar(el, adapter, i) {
  for (var k = 0; k < videos.length; k++) if (videos[k].el === el) return;
  var pitch = el.getAttribute && el.getAttribute('data-vsl-pitch');
  videos.push({
    el: el,
    id: nomeDe(el, i),
    ad: adapter,
    secs: [],        // quantas vezes cada segundo foi assistido
    plays: 0,
    max: 0,
    tocavaAntes: false,
    parcial: false,  // player sem posição: só play/pausa
    pitch: pitch ? Math.round(Number(pitch)) : null,
    autoplay: adapter.autoplay(),
    mudo: false,
  });
}

register({
  name: 'vsl',
  primary: false,

  detect: function () {
    return !!(document.querySelector('video') ||
              document.querySelector('vturb-smartplayer') ||
              document.querySelector('iframe[src*="youtube"], iframe[src*="youtube-nocookie"], iframe[src*="player.vimeo.com"]'));
  },

  scan: function () {
    var i = 0;
    var nativos = document.querySelectorAll('video');
    for (var a = 0; a < nativos.length; a++) {
      // o <video> interno de um player conhecido é do player, não solto
      if (nativos[a].closest && nativos[a].closest('vturb-smartplayer')) continue;
      registrar(nativos[a], adaptadorHtml5(nativos[a]), i++);
    }
    var vturb = document.querySelectorAll('vturb-smartplayer');
    for (var b = 0; b < vturb.length; b++) registrar(vturb[b], adaptadorVturb(vturb[b]), i++);

    var quadros = document.querySelectorAll(
      'iframe[src*="youtube"], iframe[src*="youtube-nocookie"], iframe[src*="player.vimeo.com"]');
    for (var c = 0; c < quadros.length; c++) {
      var q = quadros[c];
      if (prepararYoutube(q)) registrar(q, adaptadorExterno(idDoQuadro(q), 'youtube'), i++);
      else if (prepararVimeo(q)) registrar(q, adaptadorExterno(idDoQuadro(q), 'vimeo'), i++);
    }
  },

  tick: function () {
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      var tocando = false;
      try { tocando = v.ad.tocando(); } catch (e) { continue; }

      if (tocando && !v.tocavaAntes) v.plays++;
      v.tocavaAntes = tocando;
      if (!tocando) continue;

      var t = null;
      try { t = v.ad.posicao(); } catch (e) { t = null; }
      if (t === null || !isFinite(t)) { v.parcial = true; continue; }

      var s = Math.floor(t);
      if (s >= 0 && s < 36000) {           // teto de 10h contra valor absurdo
        v.secs[s] = (v.secs[s] || 0) + 1;
        if (t > v.max) v.max = t;
      }
      try { v.mudo = v.ad.mudo(); } catch (e) {}
    }
  },

  state: function () {
    var out = {};
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (!v.plays) continue;
      out[v.id] = { s: v.secs, p: v.plays, m: v.max, pa: v.parcial ? 1 : 0 };
    }
    return out;
  },

  restore: function (saved) {
    for (var i = 0; i < videos.length; i++) {
      var s = saved[videos[i].id];
      if (!s) continue;
      videos[i].secs = s.s || [];
      videos[i].plays = s.p || 0;
      videos[i].max = s.m || 0;
      videos[i].parcial = !!s.pa;
    }
  },

  payload: function () {
    var out = [];
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (!v.plays) continue;              // sem play não há o que reportar
      out.push({
        i: v.id,
        t: v.ad.tipo,
        d: Math.round(v.ad.duracao()) || 0,
        p: v.plays,
        m: Math.round(v.max),
        r: comprimir(v.secs, 1),           // assistido ao menos uma vez
        rr: comprimir(v.secs, 2),          // revisto: onde voltaram
        a: v.autoplay ? 1 : 0,
        mu: v.mudo ? 1 : 0,
        pi: v.pitch,
        pa: v.parcial ? 1 : 0,
      });
    }
    return out.length ? { vs: out } : {};
  },

  debug: function () {
    return videos.map(function (v) {
      var dur = 0;
      try { dur = Math.round(v.ad.duracao()); } catch (e) {}
      return {
        video: v.id, tipo: v.ad.tipo, plays: v.plays,
        // a duração prova que a ponte com o player está viva: ela só chega
        // se o adaptador conseguiu falar com ele
        duracao_s: dur,
        assistido_s: v.secs.filter(Boolean).length,
        ate_s: Math.round(v.max),
        parcial: v.parcial,
      };
    });
  },
});

/* Segundos assistidos viram faixas [inicio, fim). Um VSL de 30 minutos cabe
   em poucas centenas de bytes, e rever sai de graça: é a mesma estrutura
   contada duas vezes. */
function comprimir(secs, minimo) {
  var faixas = [], ini = null;
  for (var i = 0; i <= secs.length; i++) {
    var ligado = (secs[i] || 0) >= minimo;
    if (ligado && ini === null) ini = i;
    if (!ligado && ini !== null) { faixas.push([ini, i]); ini = null; }
  }
  return faixas;
}
