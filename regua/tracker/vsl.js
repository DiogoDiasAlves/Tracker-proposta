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

/* YouTube e Vimeo só respondem se o SDK deles já estiver na página. Não
   carregamos SDK de terceiro por conta própria: seria peso e uma requisição
   externa que o dono da página não pediu. */
function adaptadorYoutube(p) {
  return {
    tipo: 'youtube',
    duracao: function () { try { return p.getDuration() || 0; } catch (e) { return 0; } },
    posicao: function () { try { return p.getCurrentTime(); } catch (e) { return null; } },
    tocando: function () { try { return p.getPlayerState() === 1; } catch (e) { return false; } },
    mudo: function () { try { return p.isMuted(); } catch (e) { return false; } },
    autoplay: function () { return false; },
  };
}

function nomeDe(el, i) {
  var marcado = el.getAttribute && el.getAttribute('data-vsl');
  if (marcado) return marcado;
  var src = (el.currentSrc || el.src || el.getAttribute('src') || '') + '';
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
              window.YT);
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

    if (window.reguaYT && window.reguaYT.length) {
      for (var c = 0; c < window.reguaYT.length; c++) {
        registrar(window.reguaYT[c].el || {}, adaptadorYoutube(window.reguaYT[c]), i++);
      }
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
      return {
        video: v.id, tipo: v.ad.tipo, plays: v.plays,
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
