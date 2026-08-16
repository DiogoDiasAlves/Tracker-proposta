/*
 * Leituras do painel /admin.
 *
 * Único lugar do código onde uma consulta lê mais de uma conta de propósito
 * — o operador precisa enxergar todo mundo pra saber quantos clientes tem e
 * quanto cada um usa. Nada aqui é alcançável por sessão de cliente: quem
 * chama isto já passou por exigirAdmin() antes.
 */

/** Uma linha por conta: quantos usuários, quantas páginas/VSL/quiz, sessões
 *  totais, atividade recente e se a Meta está conectada. */
export async function listarContas(db) {
  const { rows } = await db.query(`
    SELECT
      a.id, a.name, a.slug, a.created_at,
      COUNT(DISTINCT m.user_id)                              AS usuarios,
      COUNT(DISTINCT ast.id) FILTER (WHERE ast.kind = 'page') AS paginas,
      COUNT(DISTINCT ast.id) FILTER (WHERE ast.kind = 'vsl')  AS vsls,
      COUNT(DISTINCT ast.id) FILTER (WHERE ast.kind = 'quiz') AS quizzes,
      COUNT(DISTINCT s.id)                                    AS sessoes,
      COUNT(DISTINCT s.id) FILTER (WHERE s.started_at > now() - interval '7 days')
                                                               AS sessoes_7d,
      MAX(s.started_at)                                       AS ultima_atividade,
      BOOL_OR(mc.id IS NOT NULL)                              AS meta_conectada
    FROM accounts a
    LEFT JOIN memberships m      ON m.account_id = a.id
    LEFT JOIN assets ast         ON ast.account_id = a.id
    LEFT JOIN sessions s         ON s.account_id = a.id
    LEFT JOIN meta_connections mc ON mc.account_id = a.id AND mc.revogado_em IS NULL
    GROUP BY a.id
    ORDER BY sessoes_7d DESC, a.created_at DESC
  `);
  return rows.map(r => ({
    id: r.id, name: r.name, slug: r.slug, criadaEm: r.created_at,
    usuarios: Number(r.usuarios), paginas: Number(r.paginas),
    vsls: Number(r.vsls), quizzes: Number(r.quizzes),
    sessoes: Number(r.sessoes), sessoes7d: Number(r.sessoes_7d),
    ultimaAtividade: r.ultima_atividade, metaConectada: r.meta_conectada,
  }));
}

/** Uma conta específica, com o e-mail de cada usuário ligado — usado no
 *  detalhe por conta, não na listagem (evita N+1 de e-mails na tela geral). */
export async function detalheConta(db, accountId) {
  const conta = (await db.query(
    'SELECT id, name, slug, created_at FROM accounts WHERE id = $1', [accountId]
  )).rows[0];
  if (!conta) return null;

  const usuarios = (await db.query(`
    SELECT u.id, u.email, u.name, m.role, u.created_at
    FROM users u JOIN memberships m ON m.user_id = u.id
    WHERE m.account_id = $1 ORDER BY u.created_at
  `, [accountId])).rows;

  const ativos = (await db.query(`
    SELECT a.key, a.kind, a.name, COUNT(s.id) AS sessoes, MAX(s.started_at) AS ultima
    FROM assets a LEFT JOIN sessions s ON s.asset_id = a.id
    WHERE a.account_id = $1
    GROUP BY a.id ORDER BY sessoes DESC
  `, [accountId])).rows.map(r => ({
    key: r.key, kind: r.kind, name: r.name,
    sessoes: Number(r.sessoes), ultima: r.ultima,
  }));

  return {
    id: conta.id, name: conta.name, slug: conta.slug, criadaEm: conta.created_at,
    usuarios, ativos,
  };
}

/** Números do topo do painel: total de contas, sessões na plataforma inteira
 *  e quantas contas tiveram atividade nos últimos 7 dias (proxy de "clientes
 *  ativos", já que ainda não há um conceito de assinatura). */
export async function resumoGeral(db) {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM accounts)                                       AS contas,
      (SELECT COUNT(*) FROM sessions)                                       AS sessoes,
      (SELECT COUNT(*) FROM sessions WHERE started_at > now() - interval '7 days')
                                                                             AS sessoes_7d,
      (SELECT COUNT(DISTINCT account_id) FROM sessions
        WHERE started_at > now() - interval '7 days')                      AS contas_ativas_7d
  `);
  const r = rows[0];
  return {
    contas: Number(r.contas), sessoes: Number(r.sessoes),
    sessoes7d: Number(r.sessoes_7d), contasAtivas7d: Number(r.contas_ativas_7d),
  };
}
