import 'server-only';

/* Redirecionamento depois de um POST de formulário.

   `redirect()` do Next devolve 307, que PRESERVA o método — o navegador
   re-envia o POST para o destino. Numa rota que sincroniza ou desconecta,
   isso significa a ação acontecendo de novo a cada recarregar.

   303 é o código certo para "terminei o POST, agora vá buscar esta página
   com GET". É o padrão POST/Redirect/GET. */
/* `req.url` nem sempre é a URL pública. Atrás de proxy reverso (Render,
   qualquer plataforma que não seja "o processo Node fala direto com o
   navegador"), o Node interno recebe a requisição em localhost:<porta
   interna> — e foi exatamente isso que vazou pro Location de produção
   (`https://localhost:10000/painel`, endereço que só existe dentro do
   próprio servidor, inútil pro navegador). `X-Forwarded-*`/`Host` é quem
   diz o endereço de verdade; só cai para `req.url` quando não vêm (dev
   local, sem proxy na frente). */
export function apos(req: Request, caminho: string) {
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? u.host;
  return new Response(null, {
    status: 303,
    headers: { location: new URL(caminho, `${proto}://${host}`).toString() },
  });
}
