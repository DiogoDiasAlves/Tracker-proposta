/*
 * A mesma jornada em WebKit (motor do Safari) e Firefox (Gecko).
 *
 * Chrome já estava coberto, mas boa parte do tráfego mobile brasileiro é
 * iPhone — e é justamente no Safari que sendBeacon e pagehide têm
 * comportamento próprio. Um beacon de saída que não sai no iOS significaria
 * perder a atribuição de saída de metade do público sem nada quebrar.
 *
 *   node tools/testar-navegadores.js [url]
 */
import { webkit, firefox, chromium } from 'playwright';
import { pool } from '../db/index.js';

const BASE = process.argv[2] || 'http://localhost:3100';
const db = pool();
let falhas = 0;

const ok = (motor, nome, cond, det = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FALHA'} [${motor}] ${nome}${det ? ' — ' + det : ''}`);
  if (!cond) falhas++;
};

async function jornada(tipo, nome) {
  const sid = `mot-${nome}-${Date.now().toString(36)}`;
  const navegador = await tipo.launch();
  const ctx = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const p = await ctx.newPage();

  await p.goto(`${BASE}/demo/pagina-exemplo.html`, { waitUntil: 'load' });
  await p.evaluate(s => sessionStorage.setItem('_rg', s), sid);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1500);

  ok(nome, 'tracker subiu', await p.evaluate(() => !!window.regua));

  // rola com pausas, como leitura de verdade
  const altura = await p.evaluate(() => document.body.scrollHeight);
  for (const f of [0, 0.1, 0.2, 0.32, 0.45]) {
    await p.evaluate(y => window.scrollTo(0, y), Math.round(altura * f));
    await p.waitForTimeout(1300);
  }
  const vistos = await p.evaluate(() => window.regua.debug().page.filter(b => b.visto).length);
  ok(nome, 'blocos qualificaram', vistos >= 4, `${vistos} vistos`);

  await p.click('[data-cta="checkout-principal"]', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(600);

  // saída: é aqui que sendBeacon e pagehide divergem entre motores
  await p.goto('about:blank');
  await p.waitForTimeout(2500);
  await navegador.close();

  const s = (await db.query(
    'SELECT id, device, exit_step, exit_via_cta FROM sessions WHERE sid = $1', [sid]
  )).rows[0];
  ok(nome, 'sessão chegou ao banco', !!s, s ? `device ${s.device}` : 'nenhuma');
  if (!s) return;

  const b = (await db.query(
    'SELECT COUNT(*)::int n, SUM(dwell_ms)::int t FROM step_stats WHERE session_id = $1', [s.id]
  )).rows[0];
  ok(nome, 'blocos gravados com tempo', b.n >= 4 && b.t > 0, `${b.n} blocos, ${(b.t / 1000).toFixed(1)}s`);

  const c = (await db.query(
    'SELECT COUNT(*)::int n FROM cta_clicks WHERE session_id = $1', [s.id]
  )).rows[0];
  ok(nome, 'clique de CTA chegou', c.n > 0, `${c.n} clique(s)`);

  // o beacon final é o que mais varia entre motores
  ok(nome, 'beacon de saída entregou', s.exit_step !== null || s.exit_via_cta,
     `exit_step=${s.exit_step} via_cta=${s.exit_via_cta}`);
}

console.log('\nmesma jornada em três motores\n');
for (const [tipo, nome] of [[chromium, 'chromium'], [webkit, 'webkit/safari'], [firefox, 'firefox']]) {
  try { await jornada(tipo, nome); }
  catch (e) { ok(nome, 'jornada completou', false, e.message.slice(0, 90)); }
  console.log('');
}

await db.end();
console.log(falhas ? `${falhas} falha(s)\n` : 'os três motores: todos os casos passaram\n');
process.exit(falhas ? 1 : 0);
