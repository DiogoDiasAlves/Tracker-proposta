/*
 * Testa o tracker contra uma página de vendas de VERDADE, na internet.
 *
 * O harness prova a matemática e a página de exemplo prova a coleta, mas
 * nenhum dos dois prova que o coletor sobrevive a uma página real — com o
 * CSS dela, o JS dela, o player dela e o autoplay dela. Este script injeta
 * o tracker numa URL qualquer e confere o que chegou ao banco.
 *
 *   node tools/testar-pagina-real.js <url> [chave] [nome-do-asset]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pool } from '../db/index.js';

const URL_ALVO = process.argv[2];
const CHAVE = process.argv[3] || 'rg_diogo';
const ASSET = process.argv[4] || 'pagina-real';
const COLETA = process.env.REGUA_ENDPOINT || 'http://localhost:3100';
const PORT = 9402;

const CHROMES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (nome, cond, det = '') => {
  console.log(`${cond ? '  ok  ' : '  FALHA'} ${nome}${det ? ' — ' + det : ''}`);
  if (!cond) falhas++;
};

function conectar(url) {
  const ws = new WebSocket(url);
  let id = 0; const pend = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const { res, rej } = pend.get(m.id); pend.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  });
  const pronto = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('falha no CDP')));
  });
  return {
    pronto,
    send: (method, params = {}) => new Promise((res, rej) => {
      pend.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params }));
    }),
    async eval(expression) {
      const r = await this.send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    },
    close() { ws.close(); },
  };
}

async function main() {
  if (!URL_ALVO) { console.error('uso: node tools/testar-pagina-real.js <url>'); process.exit(1); }
  const bin = CHROMES.find(p => existsSync(p));
  if (!bin) { console.log('Chrome não encontrado — defina CHROME=. Pulando.'); process.exit(0); }

  try { await fetch(`${COLETA}/r.js`); }
  catch { console.error(`Coleta fora do ar em ${COLETA}.`); process.exit(1); }

  const db = pool();
  const sid = 'real-' + Date.now().toString(36);

  const perfil = mkdtempSync(join(tmpdir(), 'regua-real-'));
  const chrome = spawn(bin, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--disable-gpu',
    // a página é https e a coleta local é http; sem isto o navegador bloqueia
    // como conteúdo misto. Em produção a coleta é https e o problema não existe.
    '--allow-running-insecure-content', '--disable-web-security',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ], { stdio: 'ignore' });

  let alvo;
  for (let i = 0; i < 60 && !alvo; i++) {
    await sleep(200);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      alvo = l.find(t => t.type === 'page');
    } catch {}
  }
  if (!alvo) { console.error('Chrome não abriu.'); chrome.kill(); process.exit(1); }

  const cdp = conectar(alvo.webSocketDebuggerUrl);
  await cdp.pronto;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
               '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });

  console.log(`\nabrindo ${URL_ALVO}`);
  await cdp.send('Page.navigate', { url: URL_ALVO });
  await sleep(6000);

  const titulo = await cdp.eval('document.title');
  ok('página carregou', !!titulo, titulo.slice(0, 60));

  // fixa o id de sessão antes de injetar, para achar a linha no banco depois
  await cdp.eval(`sessionStorage.setItem('_rg', ${JSON.stringify(sid)})`);

  console.log('\ninjetando o tracker');
  await cdp.eval(`new Promise(res => {
    var s = document.createElement('script');
    s.src = ${JSON.stringify(COLETA + '/r.js')};
    s.setAttribute('data-key', ${JSON.stringify(CHAVE)});
    s.setAttribute('data-page', ${JSON.stringify(ASSET)});
    s.setAttribute('data-version', '1');
    s.setAttribute('data-endpoint', ${JSON.stringify(COLETA)});
    s.onload = () => res(true); s.onerror = () => res(false);
    document.body.appendChild(s);
  })`);
  await sleep(1500);

  const achou = await cdp.eval('!!window.regua && JSON.stringify(window.regua.debug())');
  ok('tracker subiu na página real', !!achou);
  const dbg = achou ? JSON.parse(achou) : {};
  ok('descobriu o vídeo sem marcação', !!(dbg.vsl && dbg.vsl.length),
     dbg.vsl ? dbg.vsl.map(v => `${v.video} (${v.tipo})`).join(', ') : 'nenhum');

  console.log('\nassistindo e rolando como um visitante');

  /* Dá play no que existir. A primeira versão só sabia mexer em <video>
     nativo, e reprovava o coletor em toda página que usa player próprio —
     culpando o código pelo que era limitação do teste. */
  const tocou = await cdp.eval(`(() => {
    const v = document.querySelector('video');
    if (v) { v.muted = true; v.play().catch(()=>{}); return 'html5'; }
    const s = document.querySelector('vturb-smartplayer');
    if (s) {
      try { s.volume = 0; } catch (e) {}
      try { if (s.play) s.play(); } catch (e) {}
      try { s.click(); } catch (e) {}
      return 'vturb';
    }
    const y = document.querySelector('iframe[src*="youtube"]');
    if (y) {
      try {
        y.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
        y.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      } catch (e) {}
      return 'youtube';
    }
    return 'nenhum';
  })()`);
  console.log('  player acionado:', tocou);
  const altura = await cdp.eval('document.body.scrollHeight');
  for (const f of [0, 0.06, 0.12, 0.2]) {
    await cdp.eval(`window.scrollTo(0, ${Math.round(altura * f)})`);
    await sleep(3000);
  }

  // pergunta ao COLETOR onde o vídeo está, em vez de supor o tipo de player
  const posicao = await cdp.eval(
    `(() => { const v = (window.regua.debug().vsl || [])[0]; return v ? Number(v.ate_s) : null; })()`);
  ok('o vídeo realmente avançou', posicao > 1, `${posicao}s medidos pelo coletor`);

  console.log('\nvoltando o vídeo para testar "rever"');
  await cdp.eval(`(() => {
    const v = document.querySelector('video');
    if (v) { v.currentTime = 1; return; }
    const s = document.querySelector('vturb-smartplayer');
    if (s) { try { s.currentTime = 1; } catch (e) {} }
  })()`);
  await sleep(5000);

  const estado = JSON.parse(await cdp.eval('JSON.stringify(window.regua.debug().vsl)'));
  ok('acumulou segundos assistidos', estado[0]?.assistido_s > 0,
     `${estado[0]?.assistido_s}s assistidos, chegou até ${estado[0]?.ate_s}s`);
  ok('não caiu em modo parcial', estado[0]?.parcial === false,
     'o player expõe a posição do vídeo');

  console.log('\nsaindo da página (beacon final)');
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await sleep(2500);
  cdp.close(); chrome.kill(); await sleep(300);
  try { rmSync(perfil, { recursive: true, force: true }); } catch {}

  console.log('\no que chegou ao banco');
  const s = (await db.query('SELECT id, device FROM sessions WHERE sid = $1', [sid])).rows[0];
  ok('sessão gravada', !!s, s ? `device ${s.device}` : 'não encontrada');

  if (s) {
    const v = (await db.query(
      `SELECT video, tipo, duracao, plays, max_pos, faixas, revistas, autoplay, mudo, parcial
       FROM vsl_playback WHERE session_id = $1`, [s.id])).rows[0];
    ok('reprodução gravada', !!v, v ? `${v.video} · ${v.tipo} · ${v.duracao}s` : 'nada');
    if (v) {
      ok('duração do vídeo chegou', v.duracao > 0, `${v.duracao}s`);
      const assistido = v.faixas.reduce((a, [x, y]) => a + (y - x), 0);
      const revisto = v.revistas.reduce((a, [x, y]) => a + (y - x), 0);
      ok('faixas assistidas com conteúdo', assistido > 0,
         `${assistido}s de ${v.duracao}s = ${(assistido / v.duracao * 100).toFixed(0)}% do vídeo`);
      ok('detectou trecho revisto', revisto > 0, `${revisto}s revistos ${JSON.stringify(v.revistas)}`);
      ok('capturou autoplay e mudo', v.autoplay === true || v.mudo === true,
         `autoplay=${v.autoplay} mudo=${v.mudo} — qualifica o play rate`);
    }
  }

  await db.end();
  console.log(falhas ? `\n${falhas} falha(s)\n` : '\npágina real: todos os casos passaram\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
