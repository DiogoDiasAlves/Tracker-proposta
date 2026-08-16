import 'server-only';
import geoip from 'geoip-lite';
import { db } from './dados';
import { ingest, convert } from '@regua/db/ingest';
import { sistemaOperacional, navegador } from './ua';

/* ── limite de vazão ──────────────────────────────────────────────────
   /e aceita qualquer origem — é o que um tracker instalado em domínio de
   terceiro exige. Sem limite, qualquer um infla os números da sua página.

   A promessa de não guardar IP continua de pé: o endereço vira um número
   com sal aleatório do processo, mora só em memória e some no restart.

   Folgado de propósito: operadora de celular põe milhares de assinantes
   atrás de um IP. Apertar aqui descartaria visitante real e subcontaria em
   silêncio, que é o erro que este produto existe para não cometer. */
const SAL = Math.random().toString(36);
const baldes = new Map<number, { t: number; at: number }>();
const CAP = 600, RECARGA = 60;

function chave(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '?';
  const s = SAL + ip;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

export function permitir(req: Request) {
  const k = chave(req), agora = Date.now();
  let b = baldes.get(k);
  if (!b) { b = { t: CAP, at: agora }; baldes.set(k, b); }
  b.t = Math.min(CAP, b.t + ((agora - b.at) / 1000) * RECARGA);
  b.at = agora;
  if (b.t < 1) return false;
  b.t -= 1;
  return true;
}

if (!(globalThis as Record<string, unknown>)._reguaLimpeza) {
  (globalThis as Record<string, unknown>)._reguaLimpeza = setInterval(() => {
    const corte = Date.now() - 600000;
    for (const [k, b] of baldes) if (b.at < corte) baldes.delete(k);
  }, 300000);
}

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
} as const;

/* País, sistema operacional e navegador vêm do que toda requisição HTTP já
   carrega — nada disso pede mudança no tracker. O IP é usado só para achar
   o país e descartado no mesmo instante: a mesma promessa de não gravar IP
   que já vale para o limitador de vazão acima. */
function origemVisitante(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  const ua = req.headers.get('user-agent') ?? '';
  return {
    pais: ip ? (geoip.lookup(ip)?.country ?? null) : null,
    so: sistemaOperacional(ua),
    navegador: navegador(ua),
  };
}

export const coletar = (raw: string, req: Request) => ingest(db, raw, origemVisitante(req));
export const converter = (sid: string | null) => convert(db, sid);
