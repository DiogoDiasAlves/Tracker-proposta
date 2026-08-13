/*
 * Métricas de quiz.
 *
 * O funil por pergunta já sai de compute(): pergunta é etapa, e etapa é
 * etapa. O que este arquivo acrescenta é o que só existe em quiz — a resposta
 * escolhida — e as duas leituras que a InLead não entrega:
 *
 *   • qual RESPOSTA prevê abandono
 *   • qual CAMINHO de respostas termina em venda
 */

export async function metricasQuiz(db, accountId, key, version, device) {
  const asset = (await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const t = (await db.query(`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE quiz_completo)::int AS completos,
           COUNT(*) FILTER (WHERE quiz_lead)::int AS leads,
           COUNT(*) FILTER (WHERE converted)::int AS conv
    FROM sessions WHERE asset_id = $1 AND version = $2 AND device = $3
  `, [asset.id, version, device])).rows[0];
  if (!t.n) return { sessoes: 0, perguntas: [] };

  /* Distribuição de respostas + o que aconteceu com quem escolheu cada uma.
     `abandonou` = escolheu esta opção e a sessão terminou nesta mesma
     pergunta. É o sinal de que a alternativa em si afasta. */
  const linhas = (await db.query(`
    SELECT a.pergunta, a.opcao,
           COUNT(*)::int AS escolhas,
           COUNT(*) FILTER (WHERE s.converted)::int AS converteram,
           COUNT(*) FILTER (WHERE s.quiz_completo)::int AS completaram,
           COUNT(*) FILTER (WHERE s.exit_step = a.pergunta)::int AS abandonou
    FROM quiz_answers a JOIN sessions s ON s.id = a.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
    GROUP BY a.pergunta, a.opcao
    ORDER BY a.pergunta, escolhas DESC
  `, [asset.id, version, device])).rows;

  // Ordem real das perguntas no funil, para a tela não listar em ordem
  // alfabética o que a pessoa viveu em sequência.
  const ordem = new Map((await db.query(`
    SELECT step, MIN(ord)::int AS ord FROM step_stats b
    JOIN sessions s ON s.id = b.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
    GROUP BY step ORDER BY ord
  `, [asset.id, version, device])).rows.map(r => [r.step, r.ord]));
  const ultima = [...ordem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const porPergunta = new Map();
  for (const l of linhas) {
    if (!porPergunta.has(l.pergunta)) porPergunta.set(l.pergunta, []);
    const total = linhas.filter(x => x.pergunta === l.pergunta)
                        .reduce((s, x) => s + x.escolhas, 0);
    porPergunta.get(l.pergunta).push({
      opcao: l.opcao,
      escolhas: l.escolhas,
      participacao: total ? (l.escolhas / total) * 100 : 0,
      conversao: l.escolhas ? (l.converteram / l.escolhas) * 100 : 0,
      conclusao: l.escolhas ? (l.completaram / l.escolhas) * 100 : 0,
      abandono: l.escolhas ? (l.abandonou / l.escolhas) * 100 : 0,
    });
  }

  /* Caminho que converte. Só combinações com base suficiente entram: uma
     sequência vista por três pessoas com uma venda daria 33% de conversão e
     mandaria você reescrever o quiz atrás de um número que é ruído. */
  const MINIMO = 20;
  const caminhos = (await db.query(`
    WITH ordem AS (
      -- a ordem das perguntas vem do funil, não do alfabeto: "orcamento"
      -- antes de "prazo" leria o caminho ao contrário do que a pessoa viveu
      SELECT step, MIN(ord) AS ord FROM step_stats b
      JOIN sessions s ON s.id = b.session_id
      WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
      GROUP BY step
    ),
    caminho AS (
      SELECT a.session_id,
             string_agg(a.opcao, ' → ' ORDER BY COALESCE(o.ord, 999)) AS seq,
             COUNT(*)::int AS profundidade,
             bool_or(s.converted) AS converteu
      FROM quiz_answers a
      JOIN sessions s ON s.id = a.session_id
      LEFT JOIN ordem o ON o.step = a.pergunta
      WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
      GROUP BY a.session_id
    )
    SELECT seq, MAX(profundidade)::int AS respostas, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE converteu)::int AS conv
    FROM caminho GROUP BY seq
    ORDER BY n DESC LIMIT 40
  `, [asset.id, version, device])).rows.map(r => ({
    caminho: r.seq, respostas: r.respostas, sessoes: r.n, conversoes: r.conv,
    conversao: (r.conv / r.n) * 100,
    base_suficiente: r.n >= MINIMO,
  }));

  /* Ordenar por conversão sem exigir base é como o número engana: com quatro
     perguntas de três opções há 27 caminhos completos, e num volume normal
     cada um fica com punhado de sessões. Um caminho visto por três pessoas
     com uma venda mostraria 33% e mandaria você reescrever o quiz atrás de
     ruído. Então: os com base vêm primeiro, ordenados por conversão; os sem
     base ficam depois, marcados. */
  caminhos.sort((a, b) =>
    (b.base_suficiente ? 1 : 0) - (a.base_suficiente ? 1 : 0) ||
    b.conversao - a.conversao || b.sessoes - a.sessoes
  );

  return {
    sessoes: t.n,
    completos: t.completos,
    conclusao: (t.completos / t.n) * 100,
    leads: t.leads,
    taxa_lead: t.completos ? (t.leads / t.completos) * 100 : 0,
    conversao: (t.conv / t.n) * 100,
    minimo_caminho: MINIMO,
    /* `ultima` existe porque na última pergunta todo mundo "abandona" por
       definição: a sessão acaba ali. Mostrar 100% de abandono como problema
       seria o mesmo erro de ordenar blocos por saída absoluta. */
    ultima_pergunta: ultima,
    perguntas: [...porPergunta]
      .map(([pergunta, opcoes]) => ({
        pergunta, opcoes,
        ord: ordem.get(pergunta) ?? 999,
        ultima: pergunta === ultima,
      }))
      .sort((a, b) => a.ord - b.ord),
    caminhos,
  };
}
