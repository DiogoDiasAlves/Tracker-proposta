import { redirect } from 'next/navigation';
import { exigirConta } from '@/lib/sessao';
import { metaSincronizar } from '@/lib/meta';

export async function POST() {
  const { conta } = await exigirConta();
  try {
    const r = await metaSincronizar(conta.id, 30);
    redirect(`/painel/criativos?ok=${r.linhas}-linhas`);
  } catch (e) {
    const m = e as Error;
    if (m.message === 'NEXT_REDIRECT') throw e;
    redirect(`/painel/criativos?erro=${encodeURIComponent(m.message.slice(0, 200))}`);
  }
}
