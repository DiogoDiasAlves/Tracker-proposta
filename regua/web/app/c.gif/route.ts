import { converter, CORS } from '@/lib/coleta';

// GIF transparente de 1px, para página de obrigado que não roda JS.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function GET(req: Request) {
  const u = new URL(req.url);
  await converter(u.searchParams.get('s') ?? u.searchParams.get('rg_s'));
  return new Response(new Uint8Array(PIXEL), {
    headers: { ...CORS, 'content-type': 'image/gif', 'cache-control': 'no-store' },
  });
}
