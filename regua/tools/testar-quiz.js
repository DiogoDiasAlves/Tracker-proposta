/*
 * Percorre o quiz de exemplo num Chrome real e confere o que chegou ao banco.
 *
 * O caso mais importante daqui não é o funil: é o teste que DIGITA um e-mail e
 * um telefone e depois procura por eles no banco inteiro. Se aparecerem, o
 * teste falha. É a garantia de LGPD virando verificação executável em vez de
 * promessa em documento.
 *
 *   node tools/testar-quiz.js
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pool } from '../db/index.js';

const BASE = process.argv[2] || 'http://localhost:3100';
const PORT = 9403;
const CHROMES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean);

// Valores plantados: se qualquer um destes aparecer no banco, vazou.
const EMAIL = 'nao-pode-vazar-8412@exemplo.com';
const TELEFONE = '11987654321';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (n, c, d = '') => {
  console.log(`${c ? '  ok  ' : '  FALHA'} ${n}${d ? ' — ' + d : ''}`);
  if (!c) falhas++;
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
    ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('cdp')));
  });
  return {
    pronto,
    send: (m, p = {}) => new Promise((res, rej) => { pend.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); }),
    async eval(e) {
      const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    },
    close() { ws.close(); },
  };
}

async function main() {
  const bin = CHROMES.find(p => existsSync(p));
  if (!bin) { console.log('Chrome não encontrado. Pulando.'); process.exit(0); }
  try { await fetch(`${BASE}/r.js`); }
  catch { console.error(`Coleta fora do ar em ${BASE}.`); process.exit(1); }

  const db = pool();
  const sid = 'quiz-' + Date.now().toString(36);
  const perfil = mkdtempSync(join(tmpdir(), 'regua-quiz-'));
  const chrome = spawn(bin, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });

  let alvo;
  for (let i = 0; i < 60 && !alvo; i++) {
    await sleep(200);
    try { alvo = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
  }
  const cdp = conectar(alvo.webSocketDebuggerUrl);
  await cdp.pronto;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });

  await cdp.send('Page.navigate', { url: `${BASE}/demo/quiz-exemplo.html` });
  await sleep(1200);
  await cdp.eval(`sessionStorage.setItem('_rg', ${JSON.stringify(sid)})`);
  await cdp.send('Page.reload');
  await sleep(2000);

  console.log('\nrespondendo o quiz');
  const caminho = [
    ['objetivo', 'emagrecer'],
    ['prazo', '90-dias'],
    ['orcamento', 'acima-300'],
  ];
  for (const [q, opcao] of caminho) {
    await sleep(1200);   // tempo suficiente para a pergunta qualificar
    await cdp.eval(`document.querySelector('[data-quiz-question="${q}"] [data-quiz-option="${opcao}"]').click()`);
    await sleep(500);
  }
  await sleep(1200);

  console.log('\ndigitando dados pessoais no formulário');
  await cdp.eval(`(() => {
    const f = document.querySelector('#f');
    f.querySelector('[name=email]').value = ${JSON.stringify(EMAIL)};
    f.querySelector('[name=telefone]').value = ${JSON.stringify(TELEFONE)};
    f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]').click();
  })()`);
  await sleep(1800);

  const dbg = JSON.parse(await cdp.eval('JSON.stringify(window.regua.debug().quiz)'));
  ok('respostas capturadas no cliente', dbg.respostas.length === 3, dbg.respostas.join(', '));
  ok('marcou envio de lead', dbg.lead === true);

  await cdp.send('Page.navigate', { url: 'about:blank' });
  await sleep(2500);
  cdp.close(); chrome.kill(); await sleep(300);
  try { rmSync(perfil, { recursive: true, force: true }); } catch {}

  console.log('\no que chegou ao banco');
  const s = (await db.query(
    'SELECT id, quiz_completo, quiz_lead, exit_step FROM sessions WHERE sid = $1', [sid]
  )).rows[0];
  ok('sessão gravada', !!s);
  if (!s) { await db.end(); process.exit(1); }

  const etapas = (await db.query(
    'SELECT step, ord, dwell_ms, entries FROM step_stats WHERE session_id = $1 ORDER BY ord', [s.id]
  )).rows;
  ok('funil por pergunta gravado', etapas.length >= 4,
     etapas.map(e => `${e.step}(${(e.dwell_ms / 1000).toFixed(1)}s)`).join(' → '));

  const resp = (await db.query(
    'SELECT pergunta, opcao FROM quiz_answers WHERE session_id = $1 ORDER BY pergunta', [s.id]
  )).rows;
  ok('respostas gravadas', resp.length === 3,
     resp.map(r => `${r.pergunta}=${r.opcao}`).join(', '));
  ok('marcou lead e conclusão', s.quiz_lead === true && s.quiz_completo === true,
     `lead=${s.quiz_lead} completo=${s.quiz_completo}`);

  /* ── o teste que mais importa ─────────────────────────────────────── */
  console.log('\nvazamento de dado pessoal');
  const varredura = await db.query(`
    SELECT 'quiz_answers' AS t, pergunta || '=' || opcao AS v FROM quiz_answers
    UNION ALL SELECT 'step_stats', step FROM step_stats
    UNION ALL SELECT 'cta_clicks', cta || COALESCE('/' || step, '') FROM cta_clicks
    UNION ALL SELECT 'sessions', COALESCE(utm_source,'') || COALESCE(utm_content,'') ||
                                 COALESCE(referrer_host,'') || COALESCE(exit_step,'') FROM sessions
    UNION ALL SELECT 'assets', key FROM assets
  `);
  const agulhas = [EMAIL, TELEFONE, 'exemplo.com', '987654321'];
  const achados = varredura.rows.filter(r => agulhas.some(a => (r.v || '').includes(a)));
  ok('e-mail e telefone digitados NÃO estão no banco', achados.length === 0,
     achados.length ? JSON.stringify(achados.slice(0, 3)) : 'varridas 5 tabelas, nenhuma ocorrência');

  await db.end();
  console.log(falhas ? `\n${falhas} falha(s)\n` : '\nquiz: todos os casos passaram\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
