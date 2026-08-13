import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CORS } from '@/lib/coleta';

/* O tracker. Vive fora do app porque é vanilla e sem dependência — quem roda
   na página do cliente não pode carregar framework. */
export async function GET() {
  const caminho = join(process.cwd(), '..', 'dist', 'r.js');
  try {
    const js = await readFile(caminho, 'utf8');
    return new Response(js, {
      headers: {
        ...CORS,
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch {
    return new Response('/* tracker não construído — rode: npm run build */',
                        { status: 500, headers: { ...CORS, 'content-type': 'application/javascript' } });
  }
}
