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

/* Metas de otimização de funil de quiz.
   Não são invenção nossa: é o padrão que o mercado usa para decidir se um
   quiz está bom. Ter a meta ao lado do número é o que separa "55%" de
   "55%, e o piso é 50" — a InLead mostra o primeiro, e o segundo é o que
   faz alguém agir. */
export const METAS = {
  interacao:  { piso: 50, ideal: 70, rotulo: 'Taxa de interação' },
  perda:      { teto: 5,             rotulo: 'Perda entre etapas' },
  penultima:  { piso: 50, ideal: 60, rotulo: 'Retenção na penúltima' },
  oferta:     { ideal: 20,           rotulo: 'Interação na oferta' },
};

/** Compara um número com a meta e devolve o estado — nunca só a cor. */
function julgar(valor, { piso, ideal, teto }) {
  if (valor == null) return { estado: 'sem-dado', texto: 'sem dado' };
  if (teto != null) {
    return valor <= teto
      ? { estado: 'bom', texto: `dentro do teto de ${teto}%` }
      : { estado: 'ruim', texto: `acima do teto de ${teto}%` };
  }
  if (ideal != null && valor >= ideal) return { estado: 'bom', texto: `no ideal (${ideal}%+)` };
  if (piso != null && valor >= piso) return { estado: 'atencao', texto: `acima do piso de ${piso}%, ideal é ${ideal}%` };
  if (piso != null) return { estado: 'ruim', texto: `abaixo do piso de ${piso}%` };
  return valor >= (ideal ?? 0)
    ? { estado: 'bom', texto: `no ideal (${ideal}%+)` }
    : { estado: 'atencao', texto: `ideal é ${ideal}%` };
}

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
      rotulo: null,   // preenchido abaixo, com o dicionário
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

  /* ── os cinco números do topo ────────────────────────────────────────
     Mesmas definições que o mercado usa, para o número ser comparável com
     o que a pessoa já conhece de outras ferramentas. */
  const totalPerguntas = ordem.size || 1;

  const eng = (await db.query(`
    WITH por_sessao AS (
      SELECT s.id, COUNT(a.pergunta)::int AS respondidas
      FROM sessions s LEFT JOIN quiz_answers a ON a.session_id = s.id
      WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
      GROUP BY s.id
    )
    SELECT COUNT(*) FILTER (WHERE respondidas >= 1)::int AS interagiram,
           COUNT(*) FILTER (WHERE respondidas::float / $4 > 0.5)::int AS qualificados
    FROM por_sessao
  `, [asset.id, version, device, totalPerguntas])).rows[0];

  const visitantes = t.n;
  const taxaInteracao = (eng.interagiram / visitantes) * 100;

  // Retenção na penúltima etapa: quem chega lá já venceu o funil inteiro e
  // só falta a oferta. É o número que melhor prevê volume de venda.
  const passos = [...ordem.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const penultimaChave = passos.length >= 2 ? passos[passos.length - 2] : null;
  const alcance = new Map((await db.query(`
    SELECT b.step, COUNT(DISTINCT b.session_id)::int AS n
    FROM step_stats b JOIN sessions s ON s.id = b.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
    GROUP BY b.step
  `, [asset.id, version, device])).rows.map(r => [r.step, r.n]));

  const retPenultima = penultimaChave
    ? ((alcance.get(penultimaChave) ?? 0) / visitantes) * 100 : null;

  /* Interação na etapa da oferta: dos que CHEGARAM na oferta, quantos
     clicaram. A base é quem chegou, não o total — misturar as duas bases é
     como o mesmo "20%" acaba querendo dizer duas coisas diferentes. */
  const marcada = (await db.query(`
    SELECT b.step FROM step_stats b JOIN sessions s ON s.id = b.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
      AND b.extra->>'oferta' = 'true'
    GROUP BY b.step ORDER BY COUNT(*) DESC LIMIT 1
  `, [asset.id, version, device])).rows[0]?.step ?? null;
  const ofertaChave = marcada ?? passos[passos.length - 1] ?? null;
  const cliquesOferta = (await db.query(`
    SELECT COUNT(DISTINCT c.session_id)::int AS n
    FROM cta_clicks c JOIN sessions s ON s.id = c.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3 AND c.step = $4
  `, [asset.id, version, device, ofertaChave])).rows[0]?.n ?? 0;
  const chegaramOferta = ofertaChave ? (alcance.get(ofertaChave) ?? 0) : 0;
  const interacaoOferta = chegaramOferta ? (cliquesOferta / chegaramOferta) * 100 : null;

  /* Maior perda entre etapas consecutivas, contra o teto de 5%.

     Começa em 1 de propósito. A perda da PRIMEIRA transição é quem abriu o
     quiz e não respondeu nada — e isso já é exatamente a taxa de interação.
     Contar de novo aqui é medir a mesma coisa duas vezes, e pior: a primeira
     transição quase sempre ganha, escondendo o gargalo de verdade lá no meio
     do funil. É o mesmo motivo pelo qual o maior gargalo de uma página ignora
     a dobra. */
  let piorPerda = null;
  for (let i = 1; i < passos.length - 1; i++) {
    const a = alcance.get(passos[i]) ?? 0, b = alcance.get(passos[i + 1]) ?? 0;
    if (!a) continue;
    const perda = (1 - b / a) * 100;
    if (!piorPerda || perda > piorPerda.perda) {
      piorPerda = { de: passos[i], para: passos[i + 1], perda };
    }
  }

  /* Rótulo é só exibição. A chave continua sendo a identidade em todo lugar:
     reescrever a copy troca o rótulo e mantém o histórico comparável. */
  const dicionario = await rotulosDoQuiz(db, asset.id);
  for (const [pergunta, opcoes] of porPergunta) {
    for (const o of opcoes) o.rotulo = dicionario[pergunta]?.[o.opcao] ?? null;
  }

  const topo = {
    visitantes: { valor: visitantes, rotulo: 'Visitantes',
                  nota: 'acessaram o funil' },
    interagiram: { valor: eng.interagiram, rotulo: 'Interagiram',
                   nota: 'responderam ao menos uma pergunta' },
    taxa_interacao: { valor: taxaInteracao, pct: true, rotulo: METAS.interacao.rotulo,
                      meta: julgar(taxaInteracao, METAS.interacao), nota: 'dos visitantes' },
    qualificados: { valor: eng.qualificados, rotulo: 'Qualificados',
                    nota: 'passaram de metade das etapas' },
    completos: { valor: t.completos, rotulo: 'Fluxos completos',
                 nota: 'passaram da última etapa' },
  };

  const otimizacao = [
    { chave: 'interacao', ...METAS.interacao, valor: taxaInteracao,
      meta: julgar(taxaInteracao, METAS.interacao),
      explica: 'De cada 100 que abrem o quiz, quantos chegam a responder algo. Abaixo do piso, o problema é a primeira tela — promessa ou primeira pergunta.' },
    { chave: 'perda', ...METAS.perda, valor: piorPerda?.perda ?? null,
      meta: julgar(piorPerda?.perda ?? null, METAS.perda),
      detalhe: piorPerda ? `${piorPerda.de} → ${piorPerda.para}` : null,
      explica: 'A maior queda entre duas etapas seguidas. Responder mais uma pergunta é trabalho, então o teto aqui é bem mais apertado que o de uma página.' },
    { chave: 'penultima', ...METAS.penultima, valor: retPenultima,
      meta: julgar(retPenultima, METAS.penultima),
      detalhe: penultimaChave,
      explica: 'Quem chega na penúltima já venceu o funil e só falta a oferta. É o número que melhor prevê volume de venda.' },
    { chave: 'oferta', ...METAS.oferta, valor: interacaoOferta,
      meta: julgar(interacaoOferta, METAS.oferta),
      detalhe: ofertaChave ? `${cliquesOferta} de ${chegaramOferta} que chegaram em ${ofertaChave}` : null,
      explica: 'Dos que chegaram na oferta, quantos clicaram. Base é quem chegou — não o total de visitantes.' },
  ];

  return {
    sessoes: t.n,
    completos: t.completos,
    conclusao: (t.completos / t.n) * 100,
    leads: t.leads,
    taxa_lead: t.completos ? (t.leads / t.completos) * 100 : 0,
    conversao: (t.conv / t.n) * 100,
    minimo_caminho: MINIMO,
    topo,
    otimizacao,
    teto_perda: METAS.perda.teto,
    /* `ultima` existe porque na última pergunta todo mundo "abandona" por
       definição: a sessão acaba ali. Mostrar 100% de abandono como problema
       seria o mesmo erro de ordenar blocos por saída absoluta. */
    ultima_pergunta: ultima,
    rotulos: dicionario,
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

/* Respostas por lead — linhas são pessoas, colunas são etapas.
   É como as ferramentas de quiz do mercado organizam o dado, e por bom
   motivo: o agregado diz ONDE o funil perde, e esta tabela deixa você olhar
   quem exatamente passou por lá e o que respondeu. Uma responde a pergunta
   "quanto", a outra responde "quem".

   Só chave de opção aparece aqui, nunca texto digitado — a tabela herda a
   mesma garantia do coletor, porque o banco não tem onde guardar o resto. */
/** Dicionário de rótulos do quiz: {pergunta: {opcao: texto}}. */
export async function rotulosDoQuiz(db, assetId) {
  const { rows } = await db.query(
    'SELECT pergunta, opcao, rotulo FROM quiz_labels WHERE asset_id = $1', [assetId]
  );
  const out = {};
  for (const r of rows) {
    if (!out[r.pergunta]) out[r.pergunta] = {};
    out[r.pergunta][r.opcao] = r.rotulo;
  }
  return out;
}

export async function respostasPorLead(
  db, accountId, key, version, device, { pagina = 1, porPagina = 25, busca = '' } = {}
) {
  const asset = (await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const ordem = (await db.query(`
    SELECT step, MIN(ord)::int AS ord FROM step_stats b
    JOIN sessions s ON s.id = b.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
    GROUP BY step ORDER BY ord
  `, [asset.id, version, device])).rows;

  /* O filtro usa $4 direto. A versão anterior montava com $5 e trocava por
     $4 com String.replace — que substitui só a PRIMEIRA ocorrência, e o
     filtro tem duas. A segunda sobrava e a busca quebrava com "supplies 4
     parameters, but requires 5". */
  const termo = busca.trim().toLowerCase();
  const filtro = termo
    ? `AND EXISTS (
         SELECT 1 FROM quiz_answers a WHERE a.session_id = s.id
         AND (lower(a.opcao) LIKE $4 OR lower(a.pergunta) LIKE $4))`
    : '';
  const args = [asset.id, version, device];
  if (termo) args.push(`%${termo}%`);

  const total = (await db.query(
    `SELECT COUNT(*)::int AS n FROM sessions s
     WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
       ${filtro}`,
    args
  )).rows[0].n;

  const off = Math.max(0, (pagina - 1) * porPagina);
  const linhas = (await db.query(`
    SELECT s.id, s.sid, s.device, s.utm_source, s.ad_id,
           s.quiz_completo, s.quiz_lead, s.converted, s.started_at,
           (SELECT json_object_agg(a.pergunta, a.opcao)
              FROM quiz_answers a WHERE a.session_id = s.id) AS respostas,
           (SELECT array_agg(DISTINCT b.step)
              FROM step_stats b WHERE b.session_id = s.id) AS vistos,
           (SELECT array_agg(DISTINCT c.step)
              FROM cta_clicks c WHERE c.session_id = s.id) AS cliques
    FROM sessions s
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
      ${filtro}
    ORDER BY s.started_at DESC
    LIMIT ${porPagina} OFFSET ${off}
  `, args)).rows;

  const rotulos = await rotulosDoQuiz(db, asset.id);

  return {
    rotulos,
    etapas: ordem.map((o, i) => ({ chave: o.step, numero: i + 1 })),
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    linhas: linhas.map(l => ({
      sid: l.sid,
      device: l.device,
      origem: l.ad_id ? `${l.utm_source ?? 'meta'}/${l.ad_id}` : (l.utm_source ?? '—'),
      completo: l.quiz_completo,
      lead: l.quiz_lead,
      convertido: l.converted,
      quando: Number(l.started_at),
      respostas: l.respostas ?? {},
      vistos: l.vistos ?? [],
      cliques: l.cliques ?? [],
    })),
  };
}
