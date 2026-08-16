/*
 * Integração com a Meta — camada de dados.
 *
 * Duas responsabilidades que não podem se misturar:
 *   1. guardar o token com segurança
 *   2. cruzar gasto de criativo com comportamento na página
 *
 * A segunda é o produto. Gasto por criativo qualquer ferramenta puxa; o que
 * nenhuma responde é onde o tráfego DAQUELE criativo morre na página.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

/* ── cifra do token ───────────────────────────────────────────────────
   AES-256-GCM: além de esconder, autentica — token adulterado no banco
   falha ao decifrar em vez de virar uma chamada esquisita à API.
   A chave vem do ambiente e nunca é gravada. */
function chave() {
  const seg = process.env.REGUA_SECRET;
  if (!seg || seg.length < 16) {
    throw new Error(
      'REGUA_SECRET ausente ou curta demais. Defina uma frase longa e aleatória ' +
      'no ambiente — sem ela o token da Meta não pode ser guardado com segurança.'
    );
  }
  return createHash('sha256').update(seg).digest();
}

export function cifrar(texto) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), dados.toString('base64')].join('.');
}

export function decifrar(guardado) {
  const [iv, tag, dados] = String(guardado).split('.');
  const d = createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]).toString('utf8');
}

/* ── conexão ──────────────────────────────────────────────────────── */

export async function salvarConexao(db, { accountId, userId, token, expiraEm, escopos }) {
  // Cifra ANTES de abrir a transação: se REGUA_SECRET faltar, o erro acontece
  // sem ter revogado nada.
  const cifrado = cifrar(token);

  /* Revogar e inserir numa transação só. Solto, uma falha entre os dois
     deixaria a conta sem conexão nenhuma — pior que o estado anterior. */
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      `UPDATE meta_connections SET revogado_em = now()
       WHERE account_id = $1 AND revogado_em IS NULL`, [accountId]
    );
    const { rows } = await c.query(
      `INSERT INTO meta_connections (account_id, token_cifrado, token_expira_em, escopos, conectado_por)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [accountId, cifrado, expiraEm ?? null, escopos ?? null, userId ?? null]
    );
    await c.query('COMMIT');
    return rows[0].id;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Devolve false quando não há conexão ativa — sem isso a tela diria
 *  "conectado" tendo gravado nada. */
export async function escolherContaDeAnuncios(db, accountId, adAccountId, nome) {
  const r = await db.query(
    `UPDATE meta_connections SET ad_account_id = $2, ad_account_name = $3, ultimo_erro = NULL
     WHERE account_id = $1 AND revogado_em IS NULL`,
    [accountId, adAccountId, nome ?? null]
  );
  return r.rowCount > 0;
}

export async function conexao(db, accountId) {
  const { rows } = await db.query(
    `SELECT id, ad_account_id, ad_account_name, token_cifrado, token_expira_em,
            sincronizado_em, ultimo_erro, conectado_em
     FROM meta_connections WHERE account_id = $1 AND revogado_em IS NULL`,
    [accountId]
  );
  const c = rows[0];
  if (!c) return null;
  return {
    id: c.id,
    adAccountId: c.ad_account_id,
    adAccountName: c.ad_account_name,
    expiraEm: c.token_expira_em,
    sincronizadoEm: c.sincronizado_em,
    ultimoErro: c.ultimo_erro,
    conectadoEm: c.conectado_em,
    // decifrar só quando pedido: o token não passeia pelo app à toa
    token: () => decifrar(c.token_cifrado),
  };
}

export async function desconectar(db, accountId) {
  await db.query(
    `UPDATE meta_connections SET revogado_em = now()
     WHERE account_id = $1 AND revogado_em IS NULL`, [accountId]
  );
}

export async function marcarSync(db, accountId, erro = null) {
  await db.query(
    `UPDATE meta_connections SET sincronizado_em = now(), ultimo_erro = $2
     WHERE account_id = $1 AND revogado_em IS NULL`,
    [accountId, erro]
  );
}

/* ── insights ─────────────────────────────────────────────────────── */

/** Grava um lote de linhas diárias. Idempotente: reimportar o mesmo dia
 *  sobrescreve, o que é o comportamento certo — a Meta revisa números
 *  retroativamente por até alguns dias. */
export async function gravarInsights(db, accountId, linhas) {
  /* Uma transação para o lote inteiro. Solto, uma falha no meio deixaria
     metade do período importado e metade não — e o painel mostraria um gasto
     que não corresponde a período nenhum. */
  const c = await db.connect();
  let n = 0;
  try {
    await c.query('BEGIN');
  for (const l of linhas) {
    if (!l.ad_id || !l.dia) continue;
    await c.query(`
      INSERT INTO meta_ad_insights (account_id, dia, ad_id, adset_id, campaign_id,
        ad_name, adset_name, campaign_name, impressoes, cliques, alcance, gasto,
        frequencia, acoes, views_3s, thruplays, v25, v50, v75, v100,
        compras, receita, thumb_url, video_id, video_url, atualizado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
              $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, now())
      ON CONFLICT (account_id, dia, ad_id) DO UPDATE SET
        adset_id = EXCLUDED.adset_id, campaign_id = EXCLUDED.campaign_id,
        ad_name = EXCLUDED.ad_name, adset_name = EXCLUDED.adset_name,
        campaign_name = EXCLUDED.campaign_name,
        impressoes = EXCLUDED.impressoes, cliques = EXCLUDED.cliques,
        alcance = EXCLUDED.alcance, gasto = EXCLUDED.gasto,
        frequencia = EXCLUDED.frequencia, acoes = EXCLUDED.acoes,
        views_3s = EXCLUDED.views_3s, thruplays = EXCLUDED.thruplays,
        v25 = EXCLUDED.v25, v50 = EXCLUDED.v50, v75 = EXCLUDED.v75, v100 = EXCLUDED.v100,
        compras = EXCLUDED.compras, receita = EXCLUDED.receita,
        thumb_url = COALESCE(EXCLUDED.thumb_url, meta_ad_insights.thumb_url),
        video_id = COALESCE(EXCLUDED.video_id, meta_ad_insights.video_id),
        video_url = COALESCE(EXCLUDED.video_url, meta_ad_insights.video_url),
        atualizado_em = now()`,
      [accountId, l.dia, l.ad_id, l.adset_id ?? null, l.campaign_id ?? null,
       l.ad_name ?? null, l.adset_name ?? null, l.campaign_name ?? null,
       l.impressoes ?? 0, l.cliques ?? 0, l.alcance ?? 0, l.gasto ?? 0,
       l.frequencia ?? null, l.acoes ? JSON.stringify(l.acoes) : null,
       l.views_3s ?? 0, l.thruplays ?? 0, l.v25 ?? 0, l.v50 ?? 0, l.v75 ?? 0, l.v100 ?? 0,
       l.compras ?? 0, l.receita ?? 0, l.thumb ?? null, l.videoId ?? null, l.videoUrl ?? null]
    );
    n++;
  }
    await c.query('COMMIT');
    return n;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/* ── a junção ─────────────────────────────────────────────────────────
   O gasto vem da Meta, o comportamento vem da Régua, e a chave é o ad_id
   que chega em utm_content={{ad.id}}.

   Os dois lados discordam de propósito e o painel mostra os dois: a Meta
   conta clique, a Régua conta carregamento de página, e bloqueador come
   parte. A diferença entre eles é informação, não erro a esconder.        */
export async function criativos(db, accountId, { desde = null, ate = null } = {}) {
  /* O período precisa valer para os DOIS lados. Filtrar só o gasto e somar
     sessões de sempre produziria um CPA que mistura sete dias de gasto com
     três meses de conversão — um número que não existe.

     E os dois limites precisam vir juntos: com só um deles a versão anterior
     descartava o filtro em silêncio e mostrava o período inteiro. */
  const periodo = desde && ate;
  const filtroDia = periodo ? 'AND i.dia BETWEEN $2 AND $3' : '';
  const filtroSessao = periodo
    ? 'AND s.started_at >= $2::date AND s.started_at < ($3::date + 1)' : '';
  const args = periodo ? [accountId, desde, ate] : [accountId];

  const { rows } = await db.query(`
    WITH meta AS (
      SELECT i.ad_id,
             MAX(i.ad_name) AS ad_name,
             MAX(i.campaign_name) AS campaign_name,
             MAX(i.thumb_url) AS thumb_url,
             MAX(i.video_id) AS video_id,
             MAX(i.video_url) AS video_url,
             SUM(i.impressoes)::bigint AS impressoes,
             SUM(i.cliques)::bigint AS cliques,
             SUM(i.gasto)::numeric AS gasto,
             SUM(i.views_3s)::bigint AS views_3s,
             SUM(i.thruplays)::bigint AS thruplays,
             SUM(i.v25)::bigint AS v25, SUM(i.v50)::bigint AS v50,
             SUM(i.v75)::bigint AS v75, SUM(i.v100)::bigint AS v100,
             SUM(i.compras)::bigint AS compras,
             SUM(i.receita)::numeric AS receita
      FROM meta_ad_insights i
      WHERE i.account_id = $1 ${filtroDia}
      GROUP BY i.ad_id
    ),
    regua AS (
      SELECT s.ad_id,
             COUNT(*)::int AS sessoes,
             COUNT(*) FILTER (WHERE s.converted)::int AS conversoes,
             COUNT(DISTINCT s.asset_id)::int AS paginas
      FROM sessions s
      WHERE s.account_id = $1 AND s.ad_id IS NOT NULL ${filtroSessao}
      GROUP BY s.ad_id
    )
    SELECT COALESCE(m.ad_id, r.ad_id) AS ad_id,
           m.ad_name, m.campaign_name,
           m.thumb_url, m.video_id, m.video_url,
           COALESCE(m.impressoes, 0) AS impressoes,
           COALESCE(m.cliques, 0) AS cliques,
           COALESCE(m.gasto, 0)::float AS gasto,
           COALESCE(m.views_3s, 0) AS views_3s,
           COALESCE(m.thruplays, 0) AS thruplays,
           COALESCE(m.v25, 0) AS v25, COALESCE(m.v50, 0) AS v50,
           COALESCE(m.v75, 0) AS v75, COALESCE(m.v100, 0) AS v100,
           COALESCE(m.compras, 0) AS compras,
           COALESCE(m.receita, 0)::float AS receita,
           COALESCE(r.sessoes, 0) AS sessoes,
           COALESCE(r.conversoes, 0) AS conversoes,
           COALESCE(r.paginas, 0) AS paginas
    FROM meta m FULL OUTER JOIN regua r ON r.ad_id = m.ad_id
    ORDER BY COALESCE(m.gasto, 0) DESC
  `, args);

  return rows.map(r => {
    const imp = Number(r.impressoes), cli = Number(r.cliques);
    const v3 = Number(r.views_3s), tp = Number(r.thruplays);
    const compras = Number(r.compras), receita = r.receita;

    return {
    ad_id: r.ad_id,
    nome: r.ad_name ?? r.ad_id,
    campanha: r.campaign_name,
    thumb: r.thumb_url,
    video_id: r.video_id,
    video_url: r.video_url,
    impressoes: imp,
    cliques: cli,
    gasto: r.gasto,

    /* ── retenção do anúncio NO FEED ──────────────────────────────────
       Mede o criativo antes do clique, e é a outra metade do funil. Sem
       isto, CPA ruim é ambíguo: pode ser gancho que não segura ou página
       que não converte. Com isto, dá para separar. */
    // parou de rolar: views de 2s contínuos ÷ impressões
    // (a Meta descontinuou o campo de 3s; 2s contínuos é o substituto oficial)
    hook: imp ? (v3 / imp) * 100 : null,
    // aguentou o corpo: ThruPlays ÷ views de 2s
    hold: v3 ? (tp / v3) * 100 : null,
    // converteu entre quem assistiu o corpo do vídeo
    body_conv: tp ? (compras / tp) * 100 : null,
    // curva do próprio anúncio, em quartis
    quartis: [Number(r.v25), Number(r.v50), Number(r.v75), Number(r.v100)],
    views_3s: v3,
    thruplays: tp,

    /* ── resultado ─────────────────────────────────────────────────── */
    compras,
    receita,
    roas: r.gasto ? receita / r.gasto : null,
    ticket: compras ? receita / compras : null,
    cpm: imp ? (r.gasto / imp) * 1000 : null,
    ctr: imp ? (cli / imp) * 100 : null,
    // conversão que a META reporta, sobre cliques
    conv_meta: cli ? (compras / cli) * 100 : null,
    sessoes: r.sessoes,
    conversoes: r.conversoes,
    // CPC que a Meta cobra
    cpc: r.cliques ? r.gasto / Number(r.cliques) : null,
    // CPA REAL: gasto dividido pela conversão que a RÉGUA mediu na página.
    // É este número que muda decisão — o custo por clique não sabe se a
    // pessoa chegou na oferta.
    cpa: r.conversoes ? r.gasto / r.conversoes : null,
    conversao: r.sessoes ? (r.conversoes / r.sessoes) * 100 : 0,
    // quanto do clique pago virou carregamento medido
    aproveitamento: Number(r.cliques) ? (r.sessoes / Number(r.cliques)) * 100 : null,
    so_meta: r.sessoes === 0,
    so_regua: imp === 0 && cli === 0,
  };
  });
}

/** Onde o tráfego de UM criativo morre. É a pergunta que só existe tendo
 *  os dois lados: a Meta não sabe o que houve depois do clique. */
export async function ondeMorre(db, accountId, adId) {
  const { rows } = await db.query(`
    WITH s AS (
      SELECT id, asset_id FROM sessions
      WHERE account_id = $1 AND ad_id = $2
    ),
    /* O asset com mais sessões DESTE criativo — mas só entre os que têm
       funil por etapa. Um criativo que manda tráfego para uma página de VSL
       pura não tem bloco nenhum, e escolher esse asset devolveria vazio como
       se não houvesse dado. */
    alvo AS (
      SELECT s.asset_id, COUNT(*) n FROM s
      WHERE EXISTS (
        SELECT 1 FROM step_stats b
        JOIN sessions s2 ON s2.id = b.session_id
        WHERE s2.asset_id = s.asset_id
      )
      GROUP BY s.asset_id ORDER BY n DESC LIMIT 1
    ),
    total AS (SELECT COUNT(*)::int n FROM s WHERE asset_id = (SELECT asset_id FROM alvo))
    SELECT b.step, MIN(b.ord)::int AS ord,
           COUNT(DISTINCT b.session_id)::int AS alcance,
           (SELECT n FROM total) AS base,
           (SELECT a.key FROM assets a WHERE a.id = (SELECT asset_id FROM alvo)) AS pagina
    FROM step_stats b
    WHERE b.session_id IN (SELECT id FROM s WHERE asset_id = (SELECT asset_id FROM alvo))
    GROUP BY b.step ORDER BY ord
  `, [accountId, adId]);

  if (!rows.length) return null;
  const base = rows[0].base || 1;
  const etapas = rows.map((r, i) => {
    const prox = rows[i + 1];
    return {
      step: r.step,
      reach: (r.alcance / base) * 100,
      drop: prox ? (1 - prox.alcance / r.alcance) * 100 : null,
    };
  });
  let pior = null;
  for (const e of etapas.slice(1)) {
    if (e.drop !== null && (!pior || e.drop > pior.drop)) pior = e;
  }
  return { pagina: rows[0].pagina, base, etapas, pior };
}
