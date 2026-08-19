/*
 * Métricas sobre Postgres.
 *
 * Mesmas regras de contagem do README — o que muda é onde os dados moram e o
 * vocabulário (`block` virou `step`). Se este arquivo e o README discordarem,
 * o README está certo: é o documento que o cliente assinou.
 */
import { MIN_SAMPLE, median, drop, verdict, worstStep } from '../metrics/verdict.js';

/** Alcance: existir linha em step_stats É ter visto a etapa. */
const SQL_STEPS = `
  WITH s AS (
    SELECT id FROM sessions
    WHERE asset_id = $1 AND version = $2 AND device = $3
  ),
  st AS (
    SELECT b.step, b.ord, b.dwell_ms, b.height, b.entries,
           ROW_NUMBER() OVER (PARTITION BY b.step ORDER BY b.dwell_ms) AS rn_d,
           ROW_NUMBER() OVER (PARTITION BY b.step ORDER BY b.height)   AS rn_h,
           COUNT(*)     OVER (PARTITION BY b.step)                     AS c
    FROM step_stats b JOIN s ON s.id = b.session_id
  )
  SELECT step,
         MIN(ord)::int AS ord,
         MAX(c)::int   AS n,
         AVG(entries)::float AS entries_avg,
         MAX(CASE WHEN rn_d = (c + 1) / 2 THEN dwell_ms END)::int AS dwell_med,
         MAX(CASE WHEN rn_h = (c + 1) / 2 THEN height   END)::int AS height_med
  FROM st GROUP BY step ORDER BY ord
`;

export async function compute(db, accountId, key, version, device) {
  const asset = (await db.query(
    `SELECT id, kind FROM assets WHERE account_id = $1 AND key = $2`,
    [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const t = (await db.query(`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE converted)::int AS conv,
           EXTRACT(EPOCH FROM MIN(started_at)) * 1000 AS first,
           EXTRACT(EPOCH FROM MAX(last_seen_at)) * 1000 AS last
    FROM sessions WHERE asset_id = $1 AND version = $2 AND device = $3
  `, [asset.id, version, device])).rows[0];

  const sessions = t?.n || 0;
  if (!sessions) {
    return { page: key, kind: asset.kind, version, device, sessions: 0, blocks: [] };
  }

  const rows = (await db.query(SQL_STEPS, [asset.id, version, device])).rows;

  const exits = new Map();
  for (const r of (await db.query(`
    SELECT exit_step AS b, COUNT(*)::int AS n FROM sessions
    WHERE asset_id = $1 AND version = $2 AND device = $3
      AND exit_step IS NOT NULL
      AND exit_via_cta = false   -- quem foi para o checkout não conta como abandono
    GROUP BY exit_step
  `, [asset.id, version, device])).rows) exits.set(r.b, r.n);

  const ctas = new Map();
  for (const r of (await db.query(`
    SELECT c.step AS b, c.cta AS k,
           COUNT(*)::int AS clicks, COUNT(DISTINCT c.session_id)::int AS uniq
    FROM cta_clicks c JOIN sessions s ON s.id = c.session_id
    WHERE s.asset_id = $1 AND s.version = $2 AND s.device = $3
    GROUP BY c.step, c.cta
  `, [asset.id, version, device])).rows) {
    if (!ctas.has(r.b)) ctas.set(r.b, []);
    ctas.get(r.b).push({ cta: r.k, clicks: r.clicks, sessions: r.uniq });
  }

  // Tempo por 100px: sem normalizar pela altura, toda etapa longa pareceria
  // interessante só por ser longa.
  const steps = rows.map((r, i) => {
    const next = rows[i + 1];
    const height = r.height_med || 1;
    const list = ctas.get(r.step) || [];
    const ctaSessions = list.reduce((s, c) => s + c.sessions, 0);

    return {
      step: r.step,
      block: r.step,               // nome antigo, para o painel atual não quebrar
      ord: r.ord,
      reached: r.n,
      reach: (r.n / sessions) * 100,
      drop: drop(r.n, next ? next.n : null),
      dwell_s: r.dwell_med / 1000,
      height: r.height_med,
      per100: (r.dwell_med / 1000) / (height / 100),
      entries: r.entries_avg,
      exit: r.n ? ((exits.get(r.step) || 0) / r.n) * 100 : 0,
      cta_clicks: list.reduce((s, c) => s + c.clicks, 0),
      cta_ctr: r.n ? (ctaSessions / r.n) * 100 : 0,
      ctas: list,
    };
  });

  const med = median(steps.map(s => s.per100));
  steps.forEach((s, i) => Object.assign(s, verdict(s, i, med, asset.kind)));

  return {
    page: key, kind: asset.kind, version, device,
    sessions,
    conversion: (t.conv / sessions) * 100,
    days: Math.max(1, Math.ceil((t.last - t.first) / 86400000)),
    enough: sessions >= MIN_SAMPLE,
    min_sample: MIN_SAMPLE,
    median_per100: med,
    worst: worstStep(steps),
    steps,
    blocks: steps,               // nome antigo, para o painel atual não quebrar
  };
}

/* Resumo de resultado de um asset inteiro, somando versões e dispositivos.
   É o que dá para comparar entre páginas DIFERENTES: elas não têm blocos em
   comum, então comparar "bloco 3" de uma com "bloco 3" da outra não significa
   nada. O que resta — e basta — é o resultado. */
export async function resumoAsset(db, accountId, key) {
  const asset = (await db.query(
    `SELECT id, kind FROM assets WHERE account_id = $1 AND key = $2`, [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const s = (await db.query(`
    SELECT COUNT(*)::int AS sessoes,
           COUNT(*) FILTER (WHERE converted)::int AS conversoes,
           COUNT(DISTINCT device)::int AS dispositivos,
           EXTRACT(EPOCH FROM MIN(started_at)) * 1000 AS inicio,
           EXTRACT(EPOCH FROM MAX(last_seen_at)) * 1000 AS fim
    FROM sessions WHERE asset_id = $1
  `, [asset.id])).rows[0];

  const p = (await db.query(`
    WITH por_sessao AS (
      SELECT b.session_id,
             MAX(b.ord) AS mais_fundo,
             SUM(b.dwell_ms) AS tempo
      FROM step_stats b JOIN sessions s ON s.id = b.session_id
      WHERE s.asset_id = $1 GROUP BY b.session_id
    ),
    total AS (SELECT COUNT(DISTINCT step)::float AS n FROM step_stats b
              JOIN sessions s ON s.id = b.session_id WHERE s.asset_id = $1)
    SELECT
      COALESCE(AVG(mais_fundo + 1) / NULLIF((SELECT n FROM total), 0) * 100, 0)::float AS profundidade,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tempo), 0)::float AS tempo_med
    FROM por_sessao
  `, [asset.id])).rows[0];

  const c = (await db.query(`
    SELECT COUNT(DISTINCT c.session_id)::int AS com_clique
    FROM cta_clicks c JOIN sessions s ON s.id = c.session_id
    WHERE s.asset_id = $1
  `, [asset.id])).rows[0];

  // Início de checkout: convenção documentada no README (data-cta=
  // "checkout-principal") pro botão que de fato abre o pagamento — distinto
  // de qualquer outro CTA que a página tenha. Uma sessão só conta uma vez,
  // mesmo clicando várias vezes, pro número comparar de igual pra igual com
  // "conversões" (que também é por sessão, não por evento).
  const ic = (await db.query(`
    SELECT COUNT(DISTINCT c.session_id)::int AS n
    FROM cta_clicks c JOIN sessions s ON s.id = c.session_id
    WHERE s.asset_id = $1 AND c.cta = 'checkout-principal'
  `, [asset.id])).rows[0];

  return {
    key, kind: asset.kind,
    sessoes: s.sessoes,
    conversoes: s.conversoes,
    conversao: s.sessoes ? (s.conversoes / s.sessoes) * 100 : 0,
    ctr: s.sessoes ? (c.com_clique / s.sessoes) * 100 : 0,
    ic: ic.n,
    icTaxa: s.sessoes ? (ic.n / s.sessoes) * 100 : 0,
    profundidade: p.profundidade,
    tempo_med_s: p.tempo_med / 1000,
    dias: Math.max(1, Math.ceil((s.fim - s.inicio) / 86400000)),
  };
}

/** Comparação sequencial de versões do MESMO asset (mesmas etapas). */
export async function comparison(db, accountId, key, a, b, device) {
  const A = await compute(db, accountId, key, a, device);
  const B = await compute(db, accountId, key, b, device);
  if (!A || !B) return null;

  const byStep = new Map(B.steps.map(x => [x.step, x]));
  const diff = A.steps.map(x => {
    const y = byStep.get(x.step);
    return {
      block: x.step, step: x.step,
      drop_a: x.drop, drop_b: y ? y.drop : null,
      reach_a: x.reach, reach_b: y ? y.reach : null,
      per100_a: x.per100, per100_b: y ? y.per100 : null,
      cta_a: x.cta_clicks, cta_b: y ? y.cta_clicks : null,
    };
  });

  return {
    page: key, device, a: A, b: B, diff,
    enough: A.enough && B.enough,
    caveat: 'Comparação sequencial: v1 num período, v2 no seguinte. Rode em períodos equivalentes — terça contra sábado mistura conteúdo com dia da semana.',
  };
}

/* ── evolução no tempo ────────────────────────────────────────────────
   Calculado na hora, não materializado. Um rollup pré-calculado pode ficar
   defasado sem ninguém perceber, e no volume de um beta a diferença de
   desempenho é irrelevante. Quando passar a doer, vira tabela — não antes. */
export async function evolucaoDiaria(db, accountId, key, device) {
  const asset = (await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  )).rows[0];
  if (!asset) return null;

  const { rows } = await db.query(`
    WITH por_sessao AS (
      SELECT s.id, s.version,
             (s.started_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
             s.converted,
             (SELECT MAX(b.ord) FROM step_stats b WHERE b.session_id = s.id) AS mais_fundo
      FROM sessions s
      WHERE s.asset_id = $1 AND s.device = $2
    ),
    etapas AS (
      SELECT COUNT(DISTINCT b.step)::float AS n
      FROM step_stats b JOIN sessions s ON s.id = b.session_id
      WHERE s.asset_id = $1 AND s.device = $2
    )
    SELECT dia, version,
           COUNT(*)::int AS sessoes,
           COUNT(*) FILTER (WHERE converted)::int AS conversoes,
           COALESCE(AVG(mais_fundo + 1) / NULLIF((SELECT n FROM etapas), 0) * 100, 0)::float AS profundidade
    FROM por_sessao
    GROUP BY dia, version
    ORDER BY dia, version
  `, [asset.id, device]);

  return rows.map(r => ({
    dia: r.dia instanceof Date ? r.dia.toISOString().slice(0, 10) : String(r.dia).slice(0, 10),
    versao: r.version,
    sessoes: r.sessoes,
    conversoes: r.conversoes,
    conversao: r.sessoes ? (r.conversoes / r.sessoes) * 100 : 0,
    profundidade: r.profundidade,
  }));
}

/* ── "você esqueceu de subir a versão" ────────────────────────────────
   A versão é declarada por quem instala, e por isso pode ser esquecida —
   e quando é, dois períodos diferentes ficam misturados numa versão só,
   o que é PIOR que não ter versão nenhuma, porque parece limpo e não é.

   Dois sinais denunciam página alterada:
     • a lista de blocos mudou  — estrutura, certeza
     • a altura mediana saltou  — conteúdo reescrito, alta confiança

   O que NÃO pega: trocar uma headline por outra do mesmo tamanho. Por isso
   isto é aviso, nunca fronteira automática: quem decide continua sendo você. */
export async function mudancasSemVersao(db, accountId, key, device, { limiar = 20, minimo = 10 } = {}) {
  const asset = (await db.query(
    'SELECT id FROM assets WHERE account_id = $1 AND key = $2', [accountId, key]
  )).rows[0];
  if (!asset) return [];

  const { rows } = await db.query(`
    SELECT (s.started_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           s.version, b.step, MIN(b.ord)::int AS ord,
           COUNT(*)::int AS n,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.height)::float AS altura
    FROM step_stats b JOIN sessions s ON s.id = b.session_id
    WHERE s.asset_id = $1 AND s.device = $2 AND b.height > 0
    GROUP BY dia, s.version, b.step
    HAVING COUNT(*) >= $3
    ORDER BY dia
  `, [asset.id, device, minimo]);

  const dia = r => (r.dia instanceof Date ? r.dia.toISOString().slice(0, 10) : String(r.dia).slice(0, 10));

  /* Comparação POR BLOCO, entre pontos consecutivos daquele bloco — não
     entre dias consecutivos da página.

     Com volume modesto, poucos blocos alcançam a base mínima todo dia; um
     bloco medido na segunda e na quinta tem os dois pontos válidos, e exigir
     que fossem dias vizinhos jogaria a comparação fora. Foi o que fazia o
     detector nunca disparar. */
  const porBloco = new Map();
  for (const r of rows) {
    if (!porBloco.has(r.step)) porBloco.set(r.step, []);
    porBloco.get(r.step).push({ dia: dia(r), versao: r.version, altura: r.altura, ord: r.ord });
  }

  const avisos = new Map();
  for (const [step, serie] of porBloco) {
    for (let i = 1; i < serie.length; i++) {
      const antes = serie[i - 1], depois = serie[i];
      // versão diferente é mudança declarada: não há o que avisar
      if (antes.versao !== depois.versao) continue;
      const variacao = ((depois.altura - antes.altura) / antes.altura) * 100;
      if (Math.abs(variacao) < limiar) continue;

      const chave = `${depois.dia}|${depois.versao}`;
      if (!avisos.has(chave)) {
        avisos.set(chave, {
          dia: depois.dia, versao: depois.versao,
          estrutura: false, sumiram: [], surgiram: [], alterados: [],
        });
      }
      avisos.get(chave).alterados.push({ step, variacao, de: antes.dia });
    }
  }

  /* Mudança de ESTRUTURA, num passe separado por dia.
     Bloco ausente num dia não significa bloco removido: pode ser que ninguém
     tenha chegado tão fundo. Só conta como sumiço se algum bloco POSTERIOR
     ainda aparece — aí gente passou por ali e o bloco não estava. Sem essa
     checagem, todo dia de tráfego fraco vira falso alarme. */
  const porDia = new Map();
  for (const r of rows) {
    const k = `${dia(r)}|${r.version}`;
    if (!porDia.has(k)) porDia.set(k, { dia: dia(r), versao: r.version, blocos: new Map() });
    porDia.get(k).blocos.set(r.step, r.ord);
  }
  const dias = [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
  const fundo = m => Math.max(-1, ...m.values());

  for (let i = 1; i < dias.length; i++) {
    const antes = dias[i - 1], depois = dias[i];
    if (antes.versao !== depois.versao) continue;

    const sumiram = [...antes.blocos].filter(([k, o]) => !depois.blocos.has(k) && o < fundo(depois.blocos)).map(([k]) => k);
    const surgiram = [...depois.blocos].filter(([k, o]) => !antes.blocos.has(k) && o < fundo(antes.blocos)).map(([k]) => k);
    if (!sumiram.length && !surgiram.length) continue;

    const chave = `${depois.dia}|${depois.versao}`;
    const a = avisos.get(chave) ?? { dia: depois.dia, versao: depois.versao, estrutura: false, sumiram: [], surgiram: [], alterados: [] };
    a.estrutura = true;
    a.sumiram = sumiram;
    a.surgiram = surgiram;
    avisos.set(chave, a);
  }

  return [...avisos.values()]
    .map(a => ({ ...a, alterados: a.alterados.sort((x, y) => Math.abs(y.variacao) - Math.abs(x.variacao)) }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}
