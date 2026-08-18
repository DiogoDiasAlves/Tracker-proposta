/*
 * Conexão e migrações.
 *
 * Migração é arquivo .sql numerado, aplicado em ordem e registrado numa
 * tabela. Sem framework: o produto é analítico, quase toda consulta é window
 * function e CTE, e ORM não melhora isso — só esconde. O que precisa de
 * garantia é a ordem de aplicação, e isso são vinte linhas.
 */
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const DATABASE_URL = process.env.DATABASE_URL ||
  'postgres://regua:regua@localhost:55432/regua';

// Timestamps voltam como Date; para as contas de métrica queremos número.
pg.types.setTypeParser(20, v => Number(v));   // int8
pg.types.setTypeParser(1700, v => Number(v)); // numeric

// Banco local (Docker) não fala SSL; qualquer banco remoto (Render, Neon,
// a VPS que vier depois) exige. `rejectUnauthorized: false` porque o
// certificado desses provedores geralmente não encadeia com a lista de CAs
// padrão do Node — é a configuração que o próprio Render recomenda.
const LOCAL = /localhost|127\.0\.0\.1/.test(DATABASE_URL);

export function pool() {
  return new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    ssl: LOCAL ? undefined : { rejectUnauthorized: false },
  });
}

export async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const dir = join(here, 'migrations');
  const arquivos = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const { rows } = await db.query('SELECT name FROM _migrations');
  const aplicadas = new Set(rows.map(r => r.name));

  const novas = [];
  for (const f of arquivos) {
    if (aplicadas.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    // Cada migração numa transação: ou entra inteira, ou não entra.
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
      await c.query('COMMIT');
      novas.push(f);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`migração ${f} falhou: ${e.message}`);
    } finally {
      c.release();
    }
  }
  return novas;
}

/* ── helpers de tenancy ───────────────────────────────────────────────
   Toda consulta de dados passa por account_id. Não existe caminho no código
   que leia sessão sem dizer de qual conta.                              */

export async function accountBySiteKey(db, siteKey) {
  const { rows } = await db.query(
    `SELECT account_id FROM api_keys WHERE site_key = $1 AND revoked_at IS NULL`,
    [siteKey]
  );
  return rows[0]?.account_id ?? null;
}

/** Cria o asset no primeiro evento. Não há cadastro de oferta a fazer.
 *  `kind = null` é lote sem sinal (heartbeat) — só garante que a linha
 *  existe, sem arriscar a classificação já aprendida. */
export async function assetId(db, accountId, key, kind = null) {
  if (kind === null) {
    const { rows } = await db.query(
      `INSERT INTO assets (account_id, key, kind) VALUES ($1, $2, 'page')
       ON CONFLICT (account_id, key) DO UPDATE SET key = EXCLUDED.key
       RETURNING id`,
      [accountId, key]
    );
    return rows[0].id;
  }
  const { rows } = await db.query(
    /* Bloco manda em tudo, sempre — mesmo revertendo de vsl/quiz: se o
       primeiro lote de uma página com vídeo chegou antes do primeiro bloco
       qualificar, o asset nasce 'vsl'.

       Uma vez que bloco já foi visto de verdade (existe step_stats), 'page'
       é definitivo — um lote no meio da reprodução de vídeo, que só carrega
       vs sem repetir os blocos, não pode derrubar isso de volta pra 'vsl'.
       Sem esse EXISTS, todo lote "só vídeo" de uma página normal ia
       reabrir a promoção e a classificação ficaria oscilando pra sempre.

       'page' sem histórico de bloco ainda é só o padrão de quem não
       mandou nenhum sinal ainda — esse caso continua livre pra virar
       vsl/quiz no primeiro sinal específico que chegar. */
    `INSERT INTO assets (account_id, key, kind) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, key) DO UPDATE SET
       kind = CASE
         WHEN EXCLUDED.kind = 'page' THEN 'page'
         WHEN assets.kind = 'page' AND EXISTS (
           SELECT 1 FROM step_stats st JOIN sessions se ON se.id = st.session_id
           WHERE se.asset_id = assets.id
         ) THEN 'page'
         WHEN assets.kind = 'page' THEN EXCLUDED.kind
         ELSE assets.kind
       END
     RETURNING id`,
    [accountId, key, kind]
  );
  return rows[0].id;
}

/* Ordenado por VOLUME, não por atividade recente.

   Isto já foi corrigido pontualmente em quatro telas, sempre pelo mesmo
   motivo: cada uma abria no primeiro item da lista, e o primeiro era o mais
   recente — em geral uma página de teste com duas sessões. Ordenar por
   sessões aqui resolve na origem, e qualquer tela nova nasce certa. */
export async function listAssets(db, accountId) {
  const { rows } = await db.query(`
    SELECT a.key, a.kind, a.name, COUNT(s.id)::int AS sessions,
           MAX(s.last_seen_at) AS last
    FROM assets a LEFT JOIN sessions s ON s.asset_id = a.id
    WHERE a.account_id = $1
    GROUP BY a.id ORDER BY sessions DESC, last DESC NULLS LAST
  `, [accountId]);
  return rows;
}

/* Apaga o histórico de sessões de UM asset — o botão "zerar métricas" que o
   cliente beta pediu depois de poluir o dashboard com teste. O asset em si
   (chave, tipo) continua existindo: o script aponta pro mesmo lugar e a
   coleta recomeça do zero, sem precisar reinstalar nada.

   step_stats, cta_clicks, vsl_playback e quiz_answers têm ON DELETE CASCADE
   em sessions — apagar aqui já limpa tudo. quiz_labels fica de fora de
   propósito: é o dicionário de copy das opções do quiz (texto do botão),
   não dado de visitante — continua válido pro próximo lote de sessões. */
export async function zerarMetricas(db, accountId, key) {
  const { rows } = await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  );
  if (!rows[0]) return 0;
  const r = await db.query(
    'DELETE FROM sessions WHERE account_id = $1 AND asset_id = $2', [accountId, rows[0].id]
  );
  return r.rowCount;
}

export async function facets(db, accountId, key) {
  const { rows } = await db.query(`
    SELECT s.version, s.device, COUNT(*)::int AS n
    FROM sessions s JOIN assets a ON a.id = s.asset_id
    WHERE a.account_id = $1 AND a.key = $2
    GROUP BY s.version, s.device
  `, [accountId, key]);
  return {
    versions: [...new Set(rows.map(r => r.version))].sort(),
    devices: [...new Set(rows.map(r => r.device))].sort(),
    counts: rows,
  };
}

/* Chaves quase iguais: quase sempre erro de digitação.

   `data-page="oferta-relogio-uk"` numa página e `oferta-relogio-UK` noutra
   criam DOIS assets, e a coleta se divide sem nada quebrar. É o pior tipo de
   defeito de instrumentação: silencioso, e só descoberto quando alguém estranha
   o volume pela metade.

   Normalizando para minúscula e sem separadores, o par colide e o painel avisa. */
export async function chavesParecidas(db, accountId) {
  const { rows } = await db.query(
    `SELECT a.key, COUNT(s.id)::int AS sessions
     FROM assets a LEFT JOIN sessions s ON s.asset_id = a.id
     WHERE a.account_id = $1 GROUP BY a.key`, [accountId]
  );

  const grupos = new Map();
  for (const r of rows) {
    const norm = r.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!grupos.has(norm)) grupos.set(norm, []);
    grupos.get(norm).push(r);
  }

  return [...grupos.values()]
    .filter(g => g.length > 1)
    .map(g => g.sort((a, b) => b.sessions - a.sessions));
}
