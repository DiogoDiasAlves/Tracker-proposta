import { zerarMetricas } from '@regua/db';
import { db } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { apos } from '@/lib/redirecionar';

/* accountId sempre vem da sessão (exigirConta), nunca do formulário — a
   chave sozinha não autoriza nada, só diz QUAL asset dentro da conta de
   quem está logado. */
export async function POST(req: Request) {
  const { conta } = await exigirConta();
  const form = await req.formData();
  const chave = String(form.get('chave') ?? '');
  if (!chave) return apos(req, '/painel/paginas');

  await zerarMetricas(db, conta.id, chave);
  return apos(req, `/painel/paginas?zerado=${encodeURIComponent(chave)}`);
}
