import { converter, CORS } from '@/lib/coleta';

/** Conversão reportada de fora da página (obrigado/checkout), via ?s=<sid>. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = await converter(u.searchParams.get('s') ?? u.searchParams.get('rg_s'));
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 404,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
