import { redirect } from 'next/navigation';
import { exigirConta } from '@/lib/sessao';
import { metaEscolherConta } from '@/lib/meta';

export async function POST(req: Request) {
  const { conta } = await exigirConta();
  const form = await req.formData();
  const id = String(form.get('ad_account_id') ?? '');
  const nome = String(form.get('nome') ?? '');
  if (!/^act_\d+$/.test(id)) redirect('/painel/criativos?erro=conta-invalida');
  await metaEscolherConta(conta.id, id, nome);
  redirect('/painel/criativos?ok=conectado');
}
