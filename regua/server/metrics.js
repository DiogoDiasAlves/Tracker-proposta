/*
 * Régua — cálculo das métricas.
 *
 * Cada função aqui implementa uma regra escrita na seção "Regras de contagem"
 * da proposta. Quando a proposta e este arquivo discordarem, a proposta está
 * certa: é o documento que o cliente assinou.
 */

const MIN_SAMPLE = 300;   // abaixo disso o painel avisa que é ruído
const HIGH_DROP = 15;     // limiar de "queda alta" no cruzamento do diagnóstico

/** Alcance: existir linha em block_stats É ter visto o bloco. */
function blockRows(db, pid, version, device) {
  return db.prepare(`
    WITH s AS (
      SELECT id FROM sessions WHERE page_id = ? AND version = ? AND device = ?
    ),
    bs AS (
      SELECT b.block, b.ord, b.dwell_ms, b.height, b.entries,
             ROW_NUMBER() OVER (PARTITION BY b.block ORDER BY b.dwell_ms) AS rn_d,
             ROW_NUMBER() OVER (PARTITION BY b.block ORDER BY b.height)   AS rn_h,
             COUNT(*)     OVER (PARTITION BY b.block)                     AS c
      FROM block_stats b JOIN s ON s.id = b.session_id
    )
    SELECT block,
           MIN(ord)   AS ord,
           MAX(c)     AS n,
           AVG(entries) AS entries_avg,
           MAX(CASE WHEN rn_d = (c + 1) / 2 THEN dwell_ms END) AS dwell_med,
           MAX(CASE WHEN rn_h = (c + 1) / 2 THEN height   END) AS height_med
    FROM bs GROUP BY block ORDER BY ord
  `).all(pid, version, device);
}

function median(xs) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

export function compute(db, pageKey, version, device) {
  const page = db.prepare('SELECT id FROM pages WHERE key = ?').get(pageKey);
  if (!page) return null;
  const pid = page.id;

  const totals = db.prepare(`
    SELECT COUNT(*) AS n,
           SUM(converted) AS conv,
           MIN(started_at) AS first,
           MAX(last_seen_at) AS last
    FROM sessions WHERE page_id = ? AND version = ? AND device = ?
  `).get(pid, version, device);

  const sessions = totals?.n || 0;
  if (!sessions) return { page: pageKey, version, device, sessions: 0, blocks: [] };

  const rows = blockRows(db, pid, version, device);

  const exits = new Map();
  for (const r of db.prepare(`
    SELECT exit_block AS b, COUNT(*) AS n FROM sessions
    WHERE page_id = ? AND version = ? AND device = ?
      AND exit_block IS NOT NULL
      AND exit_via_cta = 0     -- quem foi para o checkout não conta como abandono
    GROUP BY exit_block
  `).all(pid, version, device)) exits.set(r.b, r.n);

  const ctas = new Map();
  for (const r of db.prepare(`
    SELECT c.block AS b, c.cta AS k,
           COUNT(*) AS clicks, COUNT(DISTINCT c.session_id) AS uniq
    FROM cta_clicks c JOIN sessions s ON s.id = c.session_id
    WHERE s.page_id = ? AND s.version = ? AND s.device = ?
    GROUP BY c.block, c.cta
  `).all(pid, version, device)) {
    if (!ctas.has(r.b)) ctas.set(r.b, []);
    ctas.get(r.b).push({ cta: r.k, clicks: r.clicks, sessions: r.uniq });
  }

  // Tempo por 100px: sem normalizar pela altura, todo bloco longo pareceria
  // interessante só por ser longo.
  const blocks = rows.map((r, i) => {
    const next = rows[i + 1];
    const drop = next ? (1 - next.n / r.n) * 100 : null;
    const height = r.height_med || 1;
    const per100 = (r.dwell_med / 1000) / (height / 100);
    const list = ctas.get(r.block) || [];
    const ctaSessions = list.reduce((s, c) => s + c.sessions, 0);

    return {
      block: r.block,
      ord: r.ord,
      reached: r.n,
      reach: (r.n / sessions) * 100,
      drop,
      dwell_s: r.dwell_med / 1000,
      height: r.height_med,
      per100,
      entries: r.entries_avg,
      exit: r.n ? ((exits.get(r.block) || 0) / r.n) * 100 : 0,
      cta_clicks: list.reduce((s, c) => s + c.clicks, 0),
      cta_ctr: r.n ? (ctaSessions / r.n) * 100 : 0,
      ctas: list,
    };
  });

  const med = median(blocks.map(b => b.per100));
  for (let i = 0; i < blocks.length; i++) {
    Object.assign(blocks[i], verdict(blocks[i], i, blocks.length, med));
  }

  // Maior gargalo: ignora o primeiro bloco de propósito. A dobra sempre lidera
  // e apontar para ela faria você reescrever o topo da página para sempre.
  let worst = null;
  for (const b of blocks.slice(1)) {
    if (b.drop !== null && (!worst || b.drop > worst.drop)) worst = b;
  }

  return {
    page: pageKey, version, device,
    sessions,
    conversion: sessions ? ((totals.conv || 0) / sessions) * 100 : 0,
    days: Math.max(1, Math.ceil((totals.last - totals.first) / 86400000)),
    enough: sessions >= MIN_SAMPLE,
    min_sample: MIN_SAMPLE,
    median_per100: med,
    worst: worst ? worst.block : null,
    blocks,
  };
}

/** O cruzamento tempo × queda da proposta. Sozinha, "queda alta" é ambígua. */
function verdict(b, i, n, med) {
  const hiT = b.per100 >= med;
  const hiD = b.drop !== null && b.drop >= HIGH_DROP;

  if (i === 0) return {
    verdict: 'DOBRA',
    reading: 'Primeiro bloco. A queda aqui é o filtro natural do tráfego frio e não deve ser comparada com o restante da página.',
    action: 'Referência: 20% a 35% é normal. Acima disso, o problema costuma estar no criativo do anúncio, não na página.',
  };

  if (b.drop === null) return {
    verdict: 'ÚLTIMO',
    reading: 'Fim da página. Não há bloco seguinte para calcular queda — a saída aqui é o encerramento esperado da leitura.',
    action: 'Acompanhe cliques no CTA final e tempo de permanência.',
  };

  if (hiT && hiD) return {
    verdict: 'TRAVA',
    reading: `Tempo acima da mediana da página (${b.per100.toFixed(1)}s contra ${med.toFixed(1)}s por 100px) somado a queda de ${b.drop.toFixed(1)}%. Não é um bloco ignorado: leram com atenção e desistiram. Reentradas em ${b.entries.toFixed(1)} confirmam idas e voltas.`,
    action: 'Prioridade máxima. Há uma objeção ou uma confusão aqui. Reescreva e suba como versão nova, sem tocar em mais nada.',
  };

  if (hiT) return {
    verdict: 'FUNCIONA',
    reading: `Segura a atenção (${b.per100.toFixed(1)}s por 100px, acima da mediana de ${med.toFixed(1)}s) e ainda assim entrega ${(100 - b.drop).toFixed(1)}% para o bloco seguinte.`,
    action: 'Não mexa. Estude o que faz este bloco funcionar e aplique nos que travam.',
  };

  if (hiD) return {
    verdict: 'REJEIÇÃO',
    reading: `Tempo baixo (${b.per100.toFixed(1)}s por 100px) com queda de ${b.drop.toFixed(1)}%. Bateram o olho e saíram, sem ler.`,
    action: 'O problema está na abertura do bloco — título, imagem ou primeira linha. Reescreva o gancho, não o corpo.',
  };

  return {
    verdict: 'IGNORADO',
    reading: `Tempo baixo (${b.per100.toFixed(1)}s por 100px) e queda dentro do normal. Ninguém leu, e isso não atrapalhou o avanço.`,
    action: 'Candidato a corte. Reduzir este bloco encurta a página sem custo de conversão.',
  };
}

/** Comparação sequencial de versões. Não é teste A/B simultâneo — a proposta é
 *  explícita sobre isso, e o aviso viaja junto do resultado. */
export function comparison(db, pageKey, a, b, device) {
  const A = compute(db, pageKey, a, device);
  const B = compute(db, pageKey, b, device);
  if (!A || !B) return null;

  const byBlock = new Map(B.blocks.map(x => [x.block, x]));
  const diff = A.blocks.map(x => {
    const y = byBlock.get(x.block);
    return {
      block: x.block,
      drop_a: x.drop, drop_b: y ? y.drop : null,
      reach_a: x.reach, reach_b: y ? y.reach : null,
      per100_a: x.per100, per100_b: y ? y.per100 : null,
      cta_a: x.cta_clicks, cta_b: y ? y.cta_clicks : null,
    };
  });

  return {
    page: pageKey, device, a: A, b: B, diff,
    enough: A.enough && B.enough,
    caveat: 'Comparação sequencial: v1 num período, v2 no seguinte. Rode em períodos equivalentes — terça contra sábado mistura conteúdo com dia da semana.',
  };
}
