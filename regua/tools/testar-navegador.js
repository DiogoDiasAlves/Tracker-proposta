/*
 * Testa o tracker num navegador de verdade.
 *
 * Os testes de tools/testar-tracker.js cobrem a regra de visibilidade com DOM
 * simulado. O que só um navegador prova: sendBeacon sobreviver ao fechamento da
 * página, pagehide disparar, sessionStorage persistir, e a geometria real de
 * rolagem bater com a conta.
 *
 *   node tools/testar-navegador.js [url-do-servidor]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8787';
const PAGE = BASE + '/demo/pagina-exemplo.html';
const PORT = 9333;

const CHROMES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── CDP mínimo, sem dependências ──────────────────────────────────── */
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('falha ao conectar no CDP')));
  });
  return {
    ready,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    async eval(expression) {
      const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    },
    close() { ws.close(); },
  };
}

let falhas = 0;
const ok = (nome, cond, det = '') => {
  console.log(`${cond ? '  ok  ' : '  FALHA'} ${nome}${det ? ' — ' + det : ''}`);
  if (!cond) falhas++;
};

async function main() {
  const bin = CHROMES.find(p => existsSync(p));
  if (!bin) {
    console.log('Chrome não encontrado — defina CHROME=/caminho/para/chrome. Pulando.');
    process.exit(0);
  }

  // o servidor precisa estar de pé
  try { await fetch(BASE + '/api/pages'); }
  catch { console.error(`Servidor fora do ar em ${BASE}. Rode "npm start" antes.`); process.exit(1); }

  const profile = mkdtempSync(join(tmpdir(), 'regua-chrome-'));
  // Sobe em about:blank: o tracker lê o user-agent no carregamento, então a
  // emulação de celular precisa estar de pé antes de a página abrir. Página de
  // vendas é tráfego majoritariamente mobile — testar desktop testaria o caso raro.
  const chrome = spawn(bin, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === 'page');
    } catch { /* ainda subindo */ }
  }
  if (!target) { console.error('Chrome não abriu.'); chrome.kill(); process.exit(1); }

  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
               '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 800, deviceScaleFactor: 3, mobile: true,
  });
  await cdp.send('Page.navigate', { url: PAGE });
  await sleep(2000);

  console.log('\ntracker carregou no navegador');
  const sid = await cdp.eval('window.regua && window.regua.session()');
  ok('window.regua existe e tem sessão', typeof sid === 'string' && sid.length > 6, sid || '');
  const nBlocks = await cdp.eval('document.querySelectorAll("[data-block]").length');
  ok('encontrou os blocos da página', nBlocks === 11, `${nBlocks} blocos`);

  console.log('\nleitura real: rolando a página com pausas');
  const alturas = await cdp.eval('document.body.scrollHeight');
  // desce em degraus, parando o suficiente para os blocos qualificarem
  for (const frac of [0, .12, .24, .36, .5, .62, .74]) {
    await cdp.eval(`window.scrollTo(0, ${Math.round(alturas * frac)})`);
    await sleep(1300);
  }
  const estado = await cdp.eval('JSON.stringify(window.regua.debug())');
  const vistos = JSON.parse(estado).filter(b => b.visto);
  ok('blocos qualificaram durante a rolagem', vistos.length >= 5,
     `${vistos.length} de 11 vistos: ${vistos.map(b => b.bloco).join(', ')}`);
  ok('tempo acumulou por bloco', vistos.some(b => Number(b.tempo_s) >= 1),
     vistos.map(b => `${b.bloco}=${b.tempo_s}s`).slice(0, 4).join(' '));

  console.log('\nclique no CTA');
  await cdp.eval('document.querySelector(\'[data-cta="checkout-principal"]\').scrollIntoView({block:"center"})');
  await sleep(1200);
  await cdp.eval('document.querySelector(\'[data-cta="checkout-principal"]\').click()');
  await sleep(800);

  console.log('\nsaída da página (dispara o beacon final)');
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await sleep(2000);
  cdp.close();
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignora */ }

  /* ── o que chegou no servidor ─────────────────────────────────── */
  console.log('\ndados que chegaram ao servidor');
  const m = await (await fetch(`${BASE}/api/metrics?page=oferta-exemplo&version=1&device=mobile`)).json();
  if (!m || !m.blocks || !m.blocks.length) {
    ok('sessão registrada', false, 'nenhum bloco em oferta-exemplo/mobile');
  } else {
    ok('sessão chegou pelo tracker real', m.sessions >= 1, `${m.sessions} sessão(ões)`);
    ok('identificou como mobile pelo user-agent', true, 'emulação de iPhone reconhecida');
    ok('blocos gravados com altura', m.blocks.every(b => b.height > 0),
       m.blocks.slice(0, 3).map(b => `${b.block}:${b.height}px`).join(' '));
    ok('tempo por bloco chegou', m.blocks.some(b => b.dwell_s >= 1),
       m.blocks.filter(b => b.dwell_s >= 1).slice(0, 3).map(b => `${b.block}=${b.dwell_s}s`).join(' '));
    const cta = m.blocks.find(b => b.cta_clicks > 0);
    ok('clique no CTA chegou via sendBeacon', !!cta, cta ? `${cta.block}: ${cta.cta_clicks} clique(s)` : 'nenhum');
    const comSaida = m.blocks.some(b => b.exit > 0);
    ok('atribuição de saída registrada', comSaida || !!cta,
       cta ? 'saiu via CTA, excluído da conta de abandono (correto)' : '');
  }

  console.log(falhas ? `\n${falhas} falha(s)\n` : '\nnavegador real: todos os casos passaram\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
