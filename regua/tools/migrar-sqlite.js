/*
 * Migra o banco SQLite atual para Postgres e confere número a número.
 *
 * A conferência é o ponto: uma migração que "funciona" mas muda uma métrica
 * em 0,3% é pior que uma que falha, porque ninguém percebe. Este script lê as
 * duas pontas e compara bloco a bloco, versão a versão, dispositivo a
 * dispositivo — e sai com código 1 se qualquer número divergir.
 *
 *   node tools/migrar-sqlite.js
 */
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, migrate } from '../db/index.js';
import { compute as computePg } from '../db/metrics.js';
import { compute as computeLite } from '../server/metrics.js';

const here = dirname(fileURLToPath(import.meta.url));
const SQLITE = process.env.REGUA_DB || join(here, '..', 'data', 'regua.db');

const CONTA = { slug: 'diogo', nome: 'Régua (conta inicial)' };

async function main() {
  const lite = new DatabaseSync(SQLITE, { readOnly: true });
  const pg = pool();
  await migrate(pg);

  // conta e chave de site: no SQLite não havia tenancy, então tudo que
  // existe hoje pertence à primeira conta.
  const accountId = (await pg.query(
    `INSERT INTO accounts (name, slug) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [CONTA.nome, CONTA.slug]
  )).rows[0].id;

  const siteKey = 'rg_' + CONTA.slug;
  await pg.query(
    `INSERT INTO api_keys (account_id, site_key, name) VALUES ($1, $2, 'chave inicial')
     ON CONFLICT (site_key) DO NOTHING`,
    [accountId, siteKey]
  );

  const paginas = lite.prepare('SELECT id, key FROM pages').all();
  console.log(`conta ${accountId} · site key ${siteKey} · ${paginas.length} página(s)\n`);

  const mapaAsset = new Map();
  for (const p of paginas) {
    const id = (await pg.query(
      `INSERT INTO assets (account_id, key, kind) VALUES ($1, $2, 'page')
       ON CONFLICT (account_id, key) DO UPDATE SET key = EXCLUDED.key RETURNING id`,
      [accountId, p.key]
    )).rows[0].id;
    mapaAsset.set(p.id, id);
  }

  const sess = lite.prepare('SELECT * FROM sessions').all();
  const mapaSess = new Map();
  let n = 0;

  for (const s of sess) {
    // Meta manda o id do anúncio em utm_content quando as URL tags usam
    // {{ad.id}}. Só é id de anúncio se for numérico.
    const adId = /^\d{6,}$/.test(s.utm_content || '') ? s.utm_content : null;

    const id = (await pg.query(`
      INSERT INTO sessions (account_id, asset_id, sid, version, device,
        started_at, last_seen_at, seq, exit_step, exit_via_cta, converted,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, ad_id, referrer_host)
      VALUES ($1,$2,$3,$4,$5, to_timestamp($6/1000.0), to_timestamp($7/1000.0),
              $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (account_id, sid) DO UPDATE SET seq = EXCLUDED.seq
      RETURNING id`,
      [accountId, mapaAsset.get(s.page_id), s.sid, s.version, s.device,
       s.started_at, s.last_seen_at, s.seq, s.exit_block, !!s.exit_via_cta,
       !!s.converted, s.utm_source, s.utm_medium, s.utm_campaign,
       s.utm_content, s.utm_term, adId, s.referrer_host]
    )).rows[0].id;
    mapaSess.set(s.id, id);
    if (++n % 200 === 0) process.stdout.write(`  ${n} sessões\r`);
  }
  console.log(`  ${n} sessões migradas   `);

  const stats = lite.prepare('SELECT * FROM block_stats').all();
  for (let i = 0; i < stats.length; i += 500) {
    const lote = stats.slice(i, i + 500);
    const vals = [], params = [];
    lote.forEach((b, k) => {
      const o = k * 6;
      vals.push(`($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6})`);
      params.push(mapaSess.get(b.session_id), b.block, b.ord, b.height, b.dwell_ms, b.entries);
    });
    await pg.query(
      `INSERT INTO step_stats (session_id, step, ord, height, dwell_ms, entries)
       VALUES ${vals.join(',')} ON CONFLICT (session_id, step) DO NOTHING`,
      params
    );
  }
  console.log(`  ${stats.length} linhas de etapa migradas`);

  const cliques = lite.prepare('SELECT * FROM cta_clicks').all();
  for (const c of cliques) {
    await pg.query(
      `INSERT INTO cta_clicks (session_id, cta, step, at)
       VALUES ($1,$2,$3, to_timestamp($4/1000.0))`,
      [mapaSess.get(c.session_id), c.cta, c.block, c.at]
    );
  }
  console.log(`  ${cliques.length} cliques de CTA migrados\n`);

  /* ── conferência ─────────────────────────────────────────────────── */
  const facetas = lite.prepare(
    'SELECT DISTINCT page_id, version, device FROM sessions'
  ).all();

  let falhas = 0;
  const perto = (a, b, tol = 1e-9) =>
    (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < tol);

  for (const f of facetas) {
    const key = paginas.find(p => p.id === f.page_id).key;
    const L = computeLite(lite, key, f.version, f.device);
    const P = await computePg(pg, accountId, key, f.version, f.device);
    const rotulo = `${key} v${f.version} ${f.device}`;

    const checa = (nome, a, b) => {
      if (perto(a, b)) return;
      console.log(`  DIVERGE ${rotulo} · ${nome}: sqlite=${a} postgres=${b}`);
      falhas++;
    };

    checa('sessões', L.sessions, P.sessions);
    checa('conversão', L.conversion, P.conversion);
    checa('mediana per100', L.median_per100, P.median_per100);
    if (L.worst !== P.worst) { console.log(`  DIVERGE ${rotulo} · gargalo: ${L.worst} vs ${P.worst}`); falhas++; }
    if (L.blocks.length !== P.steps.length) {
      console.log(`  DIVERGE ${rotulo} · nº de etapas: ${L.blocks.length} vs ${P.steps.length}`); falhas++;
    }

    L.blocks.forEach((b, i) => {
      const p = P.steps[i];
      if (!p) return;
      if (b.block !== p.step) { console.log(`  DIVERGE ${rotulo} · ordem: ${b.block} vs ${p.step}`); falhas++; return; }
      checa(`${b.block}.alcance`, b.reach, p.reach);
      checa(`${b.block}.queda`, b.drop, p.drop);
      checa(`${b.block}.per100`, b.per100, p.per100);
      checa(`${b.block}.reentradas`, b.entries, p.entries);
      checa(`${b.block}.saída`, b.exit, p.exit);
      checa(`${b.block}.cta`, b.cta_clicks, p.cta_clicks);
      if (b.verdict !== p.verdict) { console.log(`  DIVERGE ${rotulo} · ${b.block}.veredito: ${b.verdict} vs ${p.verdict}`); falhas++; }
      if (b.reading !== p.reading) { console.log(`  DIVERGE ${rotulo} · ${b.block}.texto`); falhas++; }
    });

    if (!falhas) console.log(`  ok  ${rotulo} — ${L.blocks.length} etapas conferidas`);
  }

  await pg.end();
  console.log(falhas
    ? `\n${falhas} divergência(s) — a migração NÃO está correta\n`
    : `\ntodos os números batem entre SQLite e Postgres\n`);
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
