import { apos } from '@/lib/redirecionar';
import { sair } from '@/lib/sessao';

/* POST, nunca GET.

   GET precisa ser seguro/idempotente — é a premissa por trás de toda
   pré-busca automática do navegador e do próprio Next.js: o <Link> pré-
   carrega qualquer rota visível na tela, sem ninguém clicar. Com logout em
   GET, o botão "Sair" só de aparecer no topo do painel (ele aparece em toda
   página autenticada) já disparava o logout sozinho, silenciosamente,
   segundos depois de qualquer login — e a próxima navegação, qualquer que
   fosse, caía em "sessão inválida". Não era cache nem deploy antigo: era
   pré-busca fazendo exatamente o que GET promete que é seguro fazer. */
export async function POST(req: Request) {
  await sair();
  return apos(req, '/entrar');
}
