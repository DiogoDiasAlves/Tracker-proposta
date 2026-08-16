import { entrar } from '@/lib/sessao';
import { apos } from '@/lib/redirecionar';

/* Login como Route Handler, não como Server Action.

   Server Action (cookies().set() + redirect() dentro de 'use server') exige
   resposta em streaming — a Next.js documenta isso explicitamente
   (node_modules/next/dist/docs/.../deploying-to-platforms.md: "Server
   Actions | Streaming Required"). Atrás de proxy que armazena a resposta em
   buffer antes de entregar (o caso da Render, atrás do Cloudflare deles), o
   cookie de sessão nunca chegava ao navegador: login "funcionava" (a
   primeira página renderizava) mas nenhuma navegação seguinte reconhecia a
   sessão, porque o cookie nunca tinha sido gravado de fato.

   Route Handler devolvendo uma Response comum não tem essa exigência — é o
   mesmo padrão já usado (e já comprovado) em /api/meta/conectar. */
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') ?? '');
  const senha = String(form.get('senha') ?? '');
  const id = await entrar(email, senha);
  return apos(req, id ? '/painel' : '/entrar?erro=1');
}
