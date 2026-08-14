import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CORS } from '@/lib/coleta';

/* O tracker. Vive fora do app porque é vanilla e sem dependência — quem roda
   na página do cliente não pode carregar framework. */
export async function GET(req: Request) {
  /* ?dev=1 devolve a versão legível. Depurar coleta numa página real com o
     código minificado é praticamente impossível, e reconstruir só para isso
     não é opção quando a página é do cliente. */
  const dev = new URL(req.url).searchParams.has('dev');
  const caminho = join(process.cwd(), '..', 'dist', dev ? 'r.dev.js' : 'r.js');
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
