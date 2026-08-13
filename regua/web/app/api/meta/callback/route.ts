import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { exigirConta } from '@/lib/sessao';
import { metaTrocarCodigo, metaSalvar, metaContas, metaEscolherConta } from '@/lib/meta';

export async function GET(req: Request) {
  const { conta, usuario } = await exigirConta();
  const u = new URL(req.url);

  const erro = u.searchParams.get('error_description') ?? u.searchParams.get('error');
  if (erro) redirect(`/painel/criativos?erro=${encodeURIComponent(erro.slice(0, 160))}`);

  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  const c = await cookies();
  const esperado = c.get('rg_meta_state')?.value;
  c.delete('rg_meta_state');

  // state ausente ou diferente: a volta não veio do fluxo que começamos
  if (!code || !state || !esperado || state !== esperado) {
    redirect('/painel/criativos?erro=estado-invalido');
  }

  try {
    const { token, expiraEm } = await metaTrocarCodigo(code);
    await metaSalvar({
      accountId: conta.id, userId: usuario.id, token,
      expiraEm, escopos: 'ads_read',
    });

    // Uma conta de anúncios só: escolhe sozinho e poupa uma tela.
    const contas = await metaContas(token);
    if (contas.length === 1) {
      await metaEscolherConta(conta.id, contas[0].id, contas[0].nome);
      redirect('/painel/criativos?ok=conectado');
    }
    redirect('/painel/criativos?escolher=1');
  } catch (e) {
    const m = e as Error;
    if (m.message === 'NEXT_REDIRECT') throw e;
    redirect(`/painel/criativos?erro=${encodeURIComponent(m.message.slice(0, 200))}`);
  }
}
