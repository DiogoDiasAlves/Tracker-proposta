import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { exigirConta } from '@/lib/sessao';
import { metaConfigurado, metaAutorizacao } from '@/lib/meta';
import { apos } from '@/lib/redirecionar';

/* Início do OAuth. O `state` é aleatório, guardado em cookie httpOnly e
   conferido na volta: sem isso qualquer site poderia disparar a conexão da
   conta de outra pessoa (CSRF no fluxo de autorização). */
export async function GET(req: Request) {
  await exigirConta();
  if (!metaConfigurado()) return apos(req, '/painel/criativos?erro=sem-credenciais');

  const state = randomBytes(16).toString('base64url');
  const c = await cookies();
  c.set('rg_meta_state', state, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });
  return apos(req, metaAutorizacao(state));
}
