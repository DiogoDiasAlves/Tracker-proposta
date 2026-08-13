import { coletar, permitir, CORS } from '@/lib/coleta';

/* Coleta. text/plain de propósito: application/json dispara preflight de
   CORS, e o beacon de saída não tem tempo para um OPTIONS de ida e volta. */
export async function POST(req: Request) {
  if (!permitir(req)) {
    return new Response('{"erro":"excesso de requisições"}', { status: 429, headers: CORS });
  }
  try {
    const raw = await req.text();
    await coletar(raw);
    return new Response(null, { status: 204, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ erro: (e as Error).message }),
                        { status: 400, headers: { ...CORS, 'content-type': 'application/json' } });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, 'access-control-max-age': '86400' } });
}
