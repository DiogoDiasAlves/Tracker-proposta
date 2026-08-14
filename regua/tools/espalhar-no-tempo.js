/* Espalha as sessões simuladas ao longo dos últimos dias, para a linha de
   evolução ter o que mostrar. Só bancada de teste — em produção a data vem
   do momento real da coleta.

   O padrão imita a vida: v1 roda primeiro, v2 entra no meio do caminho. */
import { pool } from '../db/index.js';

const DIAS = Number(process.argv[2] || 21);
const db = pool();

await db.query(`
  UPDATE sessions s SET
    started_at = d.quando,
    last_seen_at = d.quando + interval '3 minutes'
  FROM (
    SELECT id,
      now()
      - make_interval(days => CASE
          -- v1 ocupa a primeira metade da janela; v2 a segunda
          WHEN version = '1' THEN ($1 - 1) - (random() * ($1 / 2))::int
          ELSE (($1 / 2) - 1) - (random() * (($1 / 2) - 1))::int
        END)
      - make_interval(hours => (random() * 23)::int) AS quando
    FROM sessions
    WHERE account_id = 1
  ) d
  WHERE s.id = d.id
`, [DIAS]);

const { rows } = await db.query(`
  SELECT (started_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
         version, COUNT(*)::int n
  FROM sessions s JOIN assets a ON a.id = s.asset_id
  WHERE a.key = 'oferta-relogio-uk' AND s.device = 'mobile'
  GROUP BY dia, version ORDER BY dia
`);
console.log(`sessões espalhadas por ${DIAS} dias · ${rows.length} dias com dado em oferta-relogio-uk/mobile`);
await db.end();
