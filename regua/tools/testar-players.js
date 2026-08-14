/*
 * YouTube e Vimeo de verdade, com embeds reais.
 *
 * Estes vivem em iframe de outro domínio: nada dentro deles é legível, e a
 * única porta é o SDK de cada um. Testar contra o serviço real é a única
 * forma de saber se a porta abre — DOM falso não prova nada aqui.
 *
 *   node tools/testar-players.js
 */
import { chromium } from 'playwright';
import { pool } from '../db/index.js';

const BASE = process.argv[2] || 'http://localhost:3100';
const db = pool();
const sid = 'players-' + Date.now().toString(36);
let falhas = 0;
const ok = (n, c, d = '') => {
  console.log(`  ${c ? 'ok  ' : 'FALHA'} ${n}${d ? ' — ' + d : ''}`);
  if (!c) falhas++;
};

/* Chrome de verdade, não o Chromium do Playwright.

   O Chromium aberto não traz codec proprietário: o Vimeo devolve
   PlaybackError e o vídeo nunca toca. Isso reprova o TESTE, não o coletor —
   e é o tipo de falso negativo que faz alguém "consertar" código que estava
   certo. O Chrome instalado tem os codecs, e é também o que o visitante usa. */
const navegador = await chromium.launch({
  channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const p = await navegador.newPage();
await p.goto(`${BASE}/demo/players-exemplo.html`, { waitUntil: 'load' });
await p.evaluate(s => sessionStorage.setItem('_rg', s), sid);
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(6000);

const src = await p.evaluate(() =>
  [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src')));
ok('coletor acrescentou enablejsapi ao YouTube', /enablejsapi=1/.test(src[0] || ''),
   (src[0] || '').slice(-40));

const det = await p.evaluate(() => (window.regua.debug().vsl || []).map(v => `${v.tipo}:${v.video}`));
ok('detectou os dois players', det.length === 2, det.join(', '));

/* Play pela API de cada um.

   Mudo antes de tocar: sem interação do usuário, o navegador recusa áudio, e
   o play() do Vimeo devolve promessa REJEITADA em silêncio. Foi o que fez a
   primeira versão deste teste acusar o coletor de não funcionar quando o
   problema era o teste. */
await p.evaluate(() => {
  try {
    const f = document.querySelectorAll('iframe')[0].contentWindow;
    f.postMessage('{"event":"command","func":"mute","args":""}', '*');
    f.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
  } catch (e) {}
  /* Sem await: play() do Vimeo pode nunca resolver NEM rejeitar quando o
     navegador bloqueia — e um evaluate esperando essa promessa fica pendurado
     para sempre. Dispara e segue; quem responde se funcionou é o coletor. */
  try {
    const v = new window.Vimeo.Player(document.querySelectorAll('iframe')[1]);
    v.setMuted(true).then(() => v.play()).catch(() => {});
  } catch (e) {}
});
await p.waitForTimeout(9000);

/* O que dá para provar aqui, e o que não dá.

   A DURAÇÃO é a prova de que a ponte com o player está viva: ela só chega se
   o adaptador conseguiu falar com o SDK e receber resposta. Se a duração vem,
   o mesmo canal entrega timeupdate quando houver reprodução.

   A reprodução em si nem sempre acontece em ambiente automatizado — o Vimeo
   recusa com PlaybackError mesmo no Chrome com codecs e janela de verdade.
   Reprovar o coletor por isso seria culpar o código pelo ambiente, e levaria
   alguém a "consertar" o que está certo. */
for (const v of await p.evaluate(() => window.regua.debug().vsl)) {
  ok(`${v.tipo}: ponte com o player viva`, Number(v.duracao_s) > 0,
     `duração lida: ${v.duracao_s}s`);
  ok(`${v.tipo}: não inventa curva`, v.parcial === false || Number(v.assistido_s) === 0);

  if (Number(v.ate_s) > 0) {
    ok(`${v.tipo}: reprodução medida`, true,
       `até ${v.ate_s}s · ${v.assistido_s}s assistidos`);
  } else {
    console.log(`  n/a  ${v.tipo}: reprodução não exercitada — o player recusou tocar ` +
                'neste ambiente. Verificar numa página real antes de confiar.');
  }
}

await p.goto('about:blank');
await p.waitForTimeout(2500);
await navegador.close();

const s = (await db.query('SELECT id FROM sessions WHERE sid = $1', [sid])).rows[0];
ok('sessão gravada', !!s);
if (s) {
  const r = await db.query(
    `SELECT video, tipo, duracao, plays, max_pos, parcial
     FROM vsl_playback WHERE session_id = $1 ORDER BY video`, [s.id]);
  // só grava quem teve play: vídeo sem play não gera linha, por decisão
  ok('reprodução gravada para quem tocou', r.rows.length >= 1,
     r.rows.map(x => `${x.video}(${x.tipo}, ${x.duracao}s, até ${x.max_pos}s)`).join(' | '));
}

await db.end();
console.log(falhas ? `\n${falhas} falha(s)\n` : '\nplayers de terceiro: todos os casos passaram\n');
process.exit(falhas ? 1 : 0);
