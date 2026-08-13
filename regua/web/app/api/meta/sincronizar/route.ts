import { exigirConta } from '@/lib/sessao';
import { metaSincronizar } from '@/lib/meta';
import { apos } from '@/lib/redirecionar';

export async function POST(req: Request) {
  const { conta } = await exigirConta();
  try {
    const r = await metaSincronizar(conta.id, 30);
    const aviso = r.truncado ? '&aviso=truncado' : '';
    return apos(req, `/painel/criativos?ok=${r.linhas}-linhas${aviso}`);
  } catch (e) {
    return apos(req, `/painel/criativos?erro=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
  }
}
