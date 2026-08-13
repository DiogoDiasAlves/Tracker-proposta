import { redirect } from 'next/navigation';
import { exigirConta } from '@/lib/sessao';
import { metaDesconectar } from '@/lib/meta';

export async function POST() {
  const { conta } = await exigirConta();
  await metaDesconectar(conta.id);
  redirect('/painel/criativos?ok=desconectado');
}
