import { exigirConta } from '@/lib/sessao';
import { metaDesconectar } from '@/lib/meta';
import { apos } from '@/lib/redirecionar';

export async function POST(req: Request) {
  const { conta } = await exigirConta();
  await metaDesconectar(conta.id);
  return apos(req, '/painel/criativos?ok=desconectado');
}
