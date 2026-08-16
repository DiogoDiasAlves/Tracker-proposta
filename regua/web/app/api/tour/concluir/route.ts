import { marcarTourConcluido } from '@/lib/sessao';

export async function POST() {
  await marcarTourConcluido();
  return new Response(null, { status: 204 });
}
