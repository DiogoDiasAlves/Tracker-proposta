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

export function pool() {
  return new pg.Pool({ connectionString: DATABASE_URL, max: 10 });
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

/** Cria o asset no primeiro evento. Não há cadastro de oferta a fazer. */
export async function assetId(db, accountId, key, kind = 'page') {
  const { rows } = await db.query(
    /* Só promove de 'page' para um tipo específico, nunca o contrário: o
       primeiro lote de um quiz chega antes de qualquer pergunta qualificar,
       e nasceria como página. Rebaixar depois apagaria a classificação certa. */
    `INSERT INTO assets (account_id, key, kind) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, key) DO UPDATE SET
       kind = CASE WHEN assets.kind = 'page' AND EXCLUDED.kind <> 'page'
                   THEN EXCLUDED.kind ELSE assets.kind END
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
