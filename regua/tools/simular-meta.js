/*
 * Insights sintéticos da Meta, para provar a junção sem credenciais reais.
 *
 * O App Review demora semanas e não depende de código. Este script grava
 * exatamente o formato que a API devolve, para a tela de criativos ficar
 * pronta e conferida antes da aprovação chegar — depois é só plugar App ID
 * e secret e trocar a fonte.
 *
 *   node tools/simular-meta.js [dias]
 */
import { pool } from '../db/index.js';
import { gravarInsights } from '../db/meta.js';

const DIAS = Number(process.argv[2] || 14);

/* Os quatro criativos que o simulador de tráfego já usa em utm_content.
   `cpc` é o que a Meta cobra; `qualidade` é o que ela NÃO sabe — quanto
   daquele tráfego chega fundo na página. É essa diferença que a tela existe
   para mostrar. */
const CRIATIVOS = [
  // hook = quanto para de rolar; hold = quanto aguenta o corpo. Valores
  // plantados diferentes de propósito, para a tela ter o que separar.
  { id: '1200000', nome: 'VSL-hook-dor',         campanha: 'Escala Julho', cpc: 0.78, hook: .38, hold: .21, ticket: 59.9 },
  { id: '1200001', nome: 'VSL-hook-curiosidade', campanha: 'Escala Julho', cpc: 2.05, hook: .31, hold: .18, ticket: 59.9 },
  // gancho fraquíssimo: quase ninguém para de rolar. É o que explica o CPA ruim
  { id: '1200002', nome: 'Estatico-prova',       campanha: 'Escala Julho', cpc: 1.12, hook: .09, hold: .11, ticket: 59.9 },
  { id: '1200003', nome: 'UGC-depoimento',       campanha: 'Retargeting',  cpc: 1.64, hook: .44, hold: .26, ticket: 59.9 },
];

const rand = (a, b) => a + Math.random() * (b - a);

const db = pool();

// Quantas sessões a Régua já viu de cada criativo — o volume simulado da
// Meta precisa ser compatível, senão a junção mostra números absurdos.
const { rows: reais } = await db.query(`
  SELECT ad_id, COUNT(*)::int AS n FROM sessions
  WHERE account_id = 1 AND ad_id IS NOT NULL GROUP BY ad_id
`);
const porCriativo = new Map(reais.map(r => [r.ad_id, r.n]));

const linhas = [];
for (const c of CRIATIVOS) {
  const sessoes = porCriativo.get(c.id) ?? 0;
  // a Meta conta clique; a Régua conta carregamento. Bloqueador e desistência
  // no meio do caminho fazem o clique ser sempre maior.
  const cliquesTotais = Math.round(sessoes / rand(0.82, 0.94)) || Math.round(rand(80, 300));

  for (let d = DIAS - 1; d >= 0; d--) {
    const dia = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const cliques = Math.max(1, Math.round((cliquesTotais / DIAS) * rand(0.6, 1.4)));
    const impressoes = Math.round(cliques * rand(45, 90));
    const v3 = Math.round(impressoes * c.hook * rand(.9, 1.1));
    const tp = Math.round(v3 * c.hold * rand(.9, 1.1));
    const compras = Math.round(tp * rand(.02, .05));

    linhas.push({
      views_3s: v3, thruplays: tp,
      v25: Math.round(v3 * .62), v50: Math.round(v3 * .34),
      v75: Math.round(v3 * .19), v100: Math.round(v3 * .12),
      compras, receita: Number((compras * c.ticket).toFixed(2)),
      videoId: '9' + c.id,
      dia, ad_id: c.id,
      adset_id: '99' + c.id.slice(-3), campaign_id: '77' + c.id.slice(-3),
      ad_name: c.nome, adset_name: 'Conjunto A', campaign_name: c.campanha,
      impressoes, cliques,
      alcance: Math.round(impressoes * rand(0.55, 0.8)),
      gasto: Number((cliques * c.cpc * rand(0.9, 1.1)).toFixed(2)),
      frequencia: Number(rand(1.1, 2.4).toFixed(3)),
      acoes: [{ action_type: 'landing_page_view', value: String(Math.round(cliques * 0.85)) }],
    });
  }
}

const n = await gravarInsights(db, 1, linhas);
console.log(`${n} linhas diárias gravadas · ${CRIATIVOS.length} criativos · ${DIAS} dias`);

const { rows } = await db.query(`
  SELECT ad_id, SUM(gasto)::float AS gasto, SUM(cliques)::int AS cliques
  FROM meta_ad_insights WHERE account_id = 1 GROUP BY ad_id ORDER BY gasto DESC
`);
for (const r of rows) {
  console.log(`  ${r.ad_id}  R$ ${r.gasto.toFixed(2).padStart(9)}  ${String(r.cliques).padStart(5)} cliques`);
}
await db.end();
