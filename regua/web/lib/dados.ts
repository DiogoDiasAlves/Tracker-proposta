import 'server-only';
import { pool, listAssets, facets } from '@regua/db';
import { compute, comparison, resumoAsset } from '@regua/db/metrics';

/* Pool único por processo. Em dev o Next recarrega o módulo a cada mudança,
   e sem isto cada recarga abriria um pool novo até estourar as conexões. */
const g = globalThis as unknown as { _reguaPool?: ReturnType<typeof pool> };
export const db = g._reguaPool ?? (g._reguaPool = pool());

/* Enquanto não há login, o painel opera sobre uma conta só. Quando o auth
   entrar, esta função passa a ler a sessão — e nada mais no app muda, porque
   todo acesso a dado já pergunta de qual conta é. */
export async function contaAtual() {
  const slug = process.env.REGUA_ACCOUNT || 'diogo';
  const { rows } = await db.query(
    'SELECT id, name, slug FROM accounts WHERE slug = $1', [slug]
  );
  if (!rows[0]) throw new Error(`conta "${slug}" não existe — rode tools/migrar-sqlite.js`);
  return rows[0] as { id: number; name: string; slug: string };
}

export async function siteKey(accountId: number) {
  const { rows } = await db.query(
    `SELECT site_key FROM api_keys
     WHERE account_id = $1 AND revoked_at IS NULL ORDER BY id LIMIT 1`,
    [accountId]
  );
  return rows[0]?.site_key as string | undefined;
}

export type Etapa = {
  step: string; ord: number; reached: number; reach: number;
  drop: number | null; dwell_s: number; height: number; per100: number;
  entries: number; exit: number; cta_clicks: number; cta_ctr: number;
  verdict: string; reading: string; action: string;
};

export type Leitura = {
  page: string; kind: 'page' | 'vsl' | 'quiz';
  version: string; device: string;
  sessions: number; conversion: number; days: number;
  enough: boolean; min_sample: number; median_per100: number;
  worst: string | null; steps: Etapa[];
};

/* @regua/db é JS puro e devolve `any`. Os tipos param aqui, na fronteira:
   um `any` que vaza para os componentes contamina tudo em silêncio. */
export type Ativo = {
  key: string; kind: 'page' | 'vsl' | 'quiz';
  name: string | null; sessions: number; last: string | null;
};

export type Facetas = {
  versions: string[]; devices: string[];
  counts: { version: string; device: string; n: number }[];
};

export const ativos = (accountId: number) =>
  listAssets(db, accountId) as Promise<Ativo[]>;

export const facetas = (accountId: number, key: string) =>
  facets(db, accountId, key) as Promise<Facetas>;

export const leitura = (accountId: number, key: string, version: string, device: string) =>
  compute(db, accountId, key, version, device) as Promise<Leitura | null>;

export const comparar = (
  accountId: number, key: string, a: string, b: string, device: string
) => comparison(db, accountId, key, a, b, device);

export type Resumo = {
  key: string; kind: string; sessoes: number; conversoes: number;
  conversao: number; ctr: number; profundidade: number; tempo_med_s: number; dias: number;
};

export const resumo = (accountId: number, key: string) =>
  resumoAsset(db, accountId, key) as Promise<Resumo | null>;
