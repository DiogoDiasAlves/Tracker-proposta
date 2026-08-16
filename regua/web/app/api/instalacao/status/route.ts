import { NextResponse } from 'next/server';
import { exigirConta } from '@/lib/sessao';
import { sessaoRecente } from '@/lib/dados';

/* Consultado pela tela de Instalação, em polling, enquanto a pessoa espera
   confirmação de que o script colado está funcionando. Não é dado sensível
   — só diz "chegou algo depois de X", então não precisa do cuidado de
   idempotência que o /e (ingest de verdade) tem. */
export async function GET(req: Request) {
  const { conta } = await exigirConta();
  const desde = new URL(req.url).searchParams.get('desde');
  if (!desde) return NextResponse.json({ erro: 'parâmetro desde ausente' }, { status: 400 });

  const sessao = await sessaoRecente(conta.id, desde);
  return NextResponse.json({ chegou: !!sessao, sessao: sessao ?? null });
}
