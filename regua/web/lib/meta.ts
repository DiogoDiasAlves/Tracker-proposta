import 'server-only';
import { db } from './dados';
import {
  conexao, salvarConexao, escolherContaDeAnuncios, desconectar,
  marcarSync as marcarSyncJs, gravarInsights, criativos, ondeMorre,
} from '@regua/db/meta';

// o default `= null` do JS faz o TS inferir o parâmetro como `null | undefined`
const marcarSync = marcarSyncJs as
  (db: unknown, accountId: number, erro: string | null) => Promise<void>;
import {
  configurado, config, urlAutorizacao, trocarCodigo, contasDeAnuncios, insights,
} from '@regua/db/meta-api';

export type Conexao = {
  id: number; adAccountId: string | null; adAccountName: string | null;
  expiraEm: string | null; sincronizadoEm: string | null;
  ultimoErro: string | null; conectadoEm: string; token: () => string;
};

export type Criativo = {
  ad_id: string; nome: string; campanha: string | null;
  thumb: string | null; video_id: string | null;
  impressoes: number; cliques: number; gasto: number;

  /* retenção do ANÚNCIO no feed — a metade do funil que vem antes do clique */
  hook: number | null; hold: number | null; body_conv: number | null;
  quartis: number[]; views_3s: number; thruplays: number;

  compras: number; receita: number;
  roas: number | null; ticket: number | null;
  cpm: number | null; ctr: number | null; conv_meta: number | null;

  sessoes: number; conversoes: number;
  cpc: number | null; cpa: number | null; conversao: number;
  aproveitamento: number | null; so_meta: boolean; so_regua: boolean;
};

export const metaConfigurado = configurado;
export const metaConfig = config;
export const metaAutorizacao = urlAutorizacao;
export const metaTrocarCodigo = trocarCodigo;

export const metaConexao = (accountId: number) =>
  conexao(db, accountId) as Promise<Conexao | null>;
/* @regua/db é JS puro: sem anotar aqui, o TypeScript infere os tipos dos
   valores-padrão e conclui coisas como `never` ou `null | undefined`. Os
   tipos param nesta fronteira, como no resto do app. */
export const metaSalvar = (dados: {
  accountId: number; userId?: number; token: string;
  expiraEm?: Date | null; escopos?: string | null;
}) => (salvarConexao as (db: unknown, d: typeof dados) => Promise<number>)(db, dados);
export const metaEscolherConta = (accountId: number, adAccountId: string, nome?: string) =>
  (escolherContaDeAnuncios as (db: unknown, a: number, id: string, n?: string) => Promise<boolean>)(
    db, accountId, adAccountId, nome);
export const metaDesconectar = (accountId: number) => desconectar(db, accountId);
export const metaContas = contasDeAnuncios;

export const metaCriativos = (accountId: number, periodo?: { desde?: string; ate?: string }) =>
  (criativos as (db: unknown, a: number, p: { desde?: string; ate?: string }) => Promise<Criativo[]>)(
    db, accountId, periodo ?? {});

export const metaOndeMorre = (accountId: number, adId: string) =>
  (ondeMorre as (db: unknown, a: number, id: string) => Promise<unknown>)(db, accountId, adId) as Promise<{
    pagina: string; base: number;
    etapas: { step: string; reach: number; drop: number | null }[];
    pior: { step: string; drop: number | null } | null;
  } | null>;

/** Puxa e grava. Um erro aqui precisa ficar VISÍVEL no painel, não sumir num
 *  log: token expirado e permissão negada pedem ações diferentes de quem usa. */
export async function metaSincronizar(accountId: number, dias = 30) {
  const c = await metaConexao(accountId);
  if (!c) throw new Error('conta da Meta não conectada');
  if (!c.adAccountId) throw new Error('nenhuma conta de anúncios escolhida');

  const ate = new Date();
  const desde = new Date(Date.now() - dias * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const r = await (insights as (t: string, a: string, p: { desde: string; ate: string })
      => Promise<{ linhas: unknown[]; truncado: boolean }>)(
      c.token(), c.adAccountId, { desde: iso(desde), ate: iso(ate) }
    );
    const n = await gravarInsights(db, accountId, r.linhas);
    // truncado vira aviso guardado, não silêncio: gasto parcial exibido como
    // total é pior que erro visível
    await marcarSync(db, accountId, r.truncado
      ? 'importação truncada no limite de páginas — o período pode estar incompleto'
      : null);
    return { linhas: n, truncado: r.truncado, desde: iso(desde), ate: iso(ate) };
  } catch (e) {
    await marcarSync(db, accountId, (e as Error).message.slice(0, 400));
    throw e;
  }
}
