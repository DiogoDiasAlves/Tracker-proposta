import 'server-only';

/* Redirecionamento depois de um POST de formulário.

   `redirect()` do Next devolve 307, que PRESERVA o método — o navegador
   re-envia o POST para o destino. Numa rota que sincroniza ou desconecta,
   isso significa a ação acontecendo de novo a cada recarregar.

   303 é o código certo para "terminei o POST, agora vá buscar esta página
   com GET". É o padrão POST/Redirect/GET. */
export function apos(req: Request, caminho: string) {
  return new Response(null, {
    status: 303,
    headers: { location: new URL(caminho, req.url).toString() },
  });
}
