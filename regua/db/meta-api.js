/*
 * Cliente da Graph API da Meta.
 *
 * v25.0 de propósito: toda versão da Marketing API anterior à v24.0 foi
 * depreciada em 9 de junho de 2026, e a própria Meta recomenda ir direto na
 * v25 para não migrar duas vezes. A versão é configurável porque essa data
 * volta a acontecer todo ano.
 */
const VERSAO = process.env.META_API_VERSION || 'v25.0';
const BASE = `https://graph.facebook.com/${VERSAO}`;

export const config = () => ({
  appId: process.env.META_APP_ID,
  appSecret: process.env.META_APP_SECRET,
  redirect: process.env.META_REDIRECT_URI ||
            `${process.env.REGUA_HOST || 'http://localhost:3100'}/api/meta/callback`,
  versao: VERSAO,
});

export const configurado = () => !!(config().appId && config().appSecret);

async function chamar(caminho, params = {}, token = null) {
  const u = new URL(caminho.startsWith('http') ? caminho : `${BASE}/${caminho}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  if (token) u.searchParams.set('access_token', token);

  const r = await fetch(u, { headers: { accept: 'application/json' } });
  const corpo = await r.json().catch(() => ({}));

  if (!r.ok || corpo.error) {
    const e = corpo.error || {};
    // A mensagem da Meta é útil e precisa chegar ao painel: "token expirado"
    // e "sem permissão" pedem ações diferentes de quem está usando.
    throw new Error(
      `Meta ${VERSAO}: ${e.message || r.statusText}` +
      (e.code ? ` (código ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})` : '')
    );
  }
  return corpo;
}

/** URL do diálogo de autorização. `state` protege contra CSRF. */
export function urlAutorizacao(state) {
  const c = config();
  const u = new URL(`https://www.facebook.com/${VERSAO}/dialog/oauth`);
  u.searchParams.set('client_id', c.appId);
  u.searchParams.set('redirect_uri', c.redirect);
  u.searchParams.set('state', state);
  // ads_read é o mínimo: só leitura. Não pedimos ads_management, que
  // permitiria alterar campanha — a Régua nunca precisa disso, e pedir
  // permissão a mais atrasa o App Review sem ganho.
  u.searchParams.set('scope', 'ads_read');
  u.searchParams.set('response_type', 'code');
  return u.toString();
}

/** Troca o código pelo token curto e já converte em token longo (~60 dias). */
export async function trocarCodigo(code) {
  const c = config();
  const curto = await chamar('oauth/access_token', {
    client_id: c.appId, client_secret: c.appSecret,
    redirect_uri: c.redirect, code,
  });

  const longo = await chamar('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: c.appId, client_secret: c.appSecret,
    fb_exchange_token: curto.access_token,
  });

  const seg = Number(longo.expires_in || curto.expires_in || 0);
  return {
    token: longo.access_token || curto.access_token,
    expiraEm: seg ? new Date(Date.now() + seg * 1000) : null,
  };
}

/** Miniatura e id de vídeo de cada anúncio. Número sem o criativo ao lado
 *  obriga a pessoa a abrir o Gerenciador só para lembrar do que se trata. */
export async function criativosDosAnuncios(token, adAccountId, adIds = []) {
  if (!adIds.length) return {};
  const r = await chamar(`${adAccountId}/ads`, {
    fields: 'id,creative{thumbnail_url,video_id,object_story_spec}',
    filtering: JSON.stringify([{ field: 'id', operator: 'IN', value: adIds.slice(0, 200) }]),
    limit: 200,
  }, token);
  const out = {};
  for (const a of r.data || []) {
    const c = a.creative || {};
    out[a.id] = {
      thumb: c.thumbnail_url ?? null,
      videoId: c.video_id ?? c.object_story_spec?.video_data?.video_id ?? null,
    };
  }
  return out;
}

export async function contasDeAnuncios(token) {
  const r = await chamar('me/adaccounts', {
    fields: 'id,account_id,name,currency,account_status', limit: 100,
  }, token);
  return (r.data || []).map(a => ({
    id: a.id,                       // act_XXXXXXXX
    nome: a.name || a.id,
    moeda: a.currency,
    ativa: a.account_status === 1,
  }));
}

const CAMPOS = [
  'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
  'impressions', 'clicks', 'reach', 'spend', 'frequency', 'actions', 'date_start',
  // vídeo DO ANÚNCIO, no feed — é o que dá hook rate e hold rate
  'video_3_sec_watched_actions', 'video_thruplay_watched_actions',
  'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
  // venda e receita, para ROAS e ticket médio
  'action_values',
].join(',');

/* Os campos de ação da Meta vêm como lista de {action_type, value}, e o tipo
   que interessa muda conforme o pixel: offsite_conversion.fb_pixel_purchase
   em conta com CAPI, `purchase` em outras. Somar os dois duplicaria, então a
   ordem de preferência é explícita. */
const TIPOS_COMPRA = ['offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase'];

function somaAcao(lista, tipos) {
  if (!Array.isArray(lista)) return 0;
  for (const t of tipos) {
    const achado = lista.find(a => a.action_type === t);
    if (achado) return Number(achado.value || 0);
  }
  return 0;
}

const primeiroValor = v => (Array.isArray(v) ? Number(v[0]?.value || 0) : Number(v || 0));

/**
 * Insights diários por anúncio.
 * time_increment=1 é o que produz uma linha por dia em vez de um total do
 * período — sem isso não dá para recortar por data depois.
 */
export async function insights(token, adAccountId, { desde, ate }) {
  let url = `${BASE}/${adAccountId}/insights`;
  let params = {
    level: 'ad', fields: CAMPOS, time_increment: 1, limit: 200,
    time_range: JSON.stringify({ since: desde, until: ate }),
    access_token: token,
  };

  const linhas = [];
  let pagina = 0;
  const TETO = 50;
  while (url && pagina < TETO) {            // teto contra laço infinito
    const r = await chamar(url, pagina === 0 ? params : {}, pagina === 0 ? null : token);
    for (const d of r.data || []) {
      linhas.push({
        dia: d.date_start,
        ad_id: d.ad_id, adset_id: d.adset_id, campaign_id: d.campaign_id,
        ad_name: d.ad_name, adset_name: d.adset_name, campaign_name: d.campaign_name,
        impressoes: Number(d.impressions || 0),
        cliques: Number(d.clicks || 0),
        alcance: Number(d.reach || 0),
        gasto: Number(d.spend || 0),
        frequencia: d.frequency ? Number(d.frequency) : null,
        acoes: d.actions ?? null,
        views_3s: primeiroValor(d.video_3_sec_watched_actions),
        thruplays: primeiroValor(d.video_thruplay_watched_actions),
        v25: primeiroValor(d.video_p25_watched_actions),
        v50: primeiroValor(d.video_p50_watched_actions),
        v75: primeiroValor(d.video_p75_watched_actions),
        v100: primeiroValor(d.video_p100_watched_actions),
        compras: somaAcao(d.actions, TIPOS_COMPRA),
        receita: somaAcao(d.action_values, TIPOS_COMPRA),
      });
    }
    url = r.paging?.next ?? null;
    params = {};
    pagina++;
  }
  /* Importação truncada NÃO pode ser reportada como sincronização limpa: o
     painel mostraria gasto parcial como se fosse o total. Quem chamou decide
     o que fazer, mas fica sabendo. */
  return { linhas, truncado: !!url && pagina >= TETO };
}
