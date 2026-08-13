import { NextResponse, type NextRequest } from 'next/server';

/* Só checa a PRESENÇA do cookie e redireciona. A validação de verdade é no
   servidor, em exigirConta(): middleware roda em Edge e não fala com o banco,
   então confiar nele para autorizar seria confiar num cookie qualquer. */
export function middleware(req: NextRequest) {
  if (req.cookies.get('rg_sessao')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/entrar';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/painel/:path*'] };
