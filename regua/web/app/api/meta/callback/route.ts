import { cookies } from 'next/headers';
import { exigirConta } from '@/lib/sessao';
import { metaTrocarCodigo, metaSalvar, metaContas, metaEscolherConta } from '@/lib/meta';
import { apos } from '@/lib/redirecionar';

export async function GET(req: Request) {
  const { conta, usuario } = await exigirConta();
  const u = new URL(req.url);

  const erro = u.searchParams.get('error_description') ?? u.searchParams.get('error');
  if (erro) return apos(req, `/painel/criativos?erro=${encodeURIComponent(erro.slice(0, 160))}`);

  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  const c = await cookies();
  const esperado = c.get('rg_meta_state')?.value;
  c.delete('rg_meta_state');

  // state ausente ou diferente: a volta não veio do fluxo que começamos
  if (!code || !state || !esperado || state !== esperado) {
    return apos(req, '/painel/criativos?erro=estado-invalido');
  }

  /* Nada de redirect() dentro do try. A versão anterior precisava reconhecer
     a exceção interna do Next pela mensagem "NEXT_REDIRECT" para não tratá-la
     como falha — o que quebraria em silêncio se o Next mudasse esse texto.
     Com o resultado calculado aqui e devolvido depois, o problema some. */
  let destino: string;
  try {
    const { token, expiraEm } = await metaTrocarCodigo(code);
    await metaSalvar({ accountId: conta.id, userId: usuario.id, token, expiraEm, escopos: 'ads_read' });

    // Uma conta de anúncios só: escolhe sozinho e poupa uma tela.
    const contas = await metaContas(token);
    if (contas.length === 1 && await metaEscolherConta(conta.id, contas[0].id, contas[0].nome)) {
      destino = '/painel/criativos?ok=conectado';
    } else {
      destino = '/painel/criativos?escolher=1';
    }
  } catch (e) {
    destino = `/painel/criativos?erro=${encodeURIComponent((e as Error).message.slice(0, 200))}`;
  }
  return apos(req, destino);
}
