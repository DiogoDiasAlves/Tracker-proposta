import { exigirConta } from '@/lib/sessao';
import { metaEscolherConta } from '@/lib/meta';
import { apos } from '@/lib/redirecionar';

export async function POST(req: Request) {
  const { conta } = await exigirConta();
  const form = await req.formData();
  const id = String(form.get('ad_account_id') ?? '');
  const nome = String(form.get('nome') ?? '');
  if (!/^act_\d+$/.test(id)) return apos(req, '/painel/criativos?erro=conta-invalida');

  // escolherConta devolve false quando não há conexão ativa; sem conferir,
  // a tela diria "conectado" tendo gravado nada
  const ok = await metaEscolherConta(conta.id, id, nome);
  return apos(req, ok
    ? '/painel/criativos?ok=conectado'
    : '/painel/criativos?erro=sem-conexao-ativa');
}
