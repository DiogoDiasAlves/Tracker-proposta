import { db } from '@/lib/dados';
import { metaSincronizar } from '@/lib/meta';

/* Sincronização diária, para um agendador externo chamar.
   Protegida por segredo próprio, e NÃO por sessão: cron não tem cookie.
   Comparação em tempo constante seria exagero aqui, mas a rota também não
   revela nada quando o segredo erra — devolve 404, não 401, para não
   confirmar que ela existe. */
export async function POST(req: Request) {
  const segredo = process.env.REGUA_CRON_SECRET;
  const enviado = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!segredo || enviado !== segredo) {
    return new Response('{"erro":"não encontrado"}', {
      status: 404, headers: { 'content-type': 'application/json' },
    });
  }

  const { rows } = await db.query(
    `SELECT account_id FROM meta_connections
     WHERE revogado_em IS NULL AND ad_account_id IS NOT NULL`
  );

  const resultado = [];
  for (const r of rows) {
    try {
      const s = await metaSincronizar(r.account_id, 30);
      resultado.push({ conta: r.account_id, ok: true, linhas: s.linhas });
    } catch (e) {
      // um erro numa conta não pode impedir a sincronização das outras
      resultado.push({ conta: r.account_id, ok: false, erro: (e as Error).message });
    }
  }

  return Response.json({ contas: rows.length, resultado });
}
