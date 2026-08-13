import { redirect } from 'next/navigation';
import { sair } from '@/lib/sessao';

export async function GET() {
  await sair();
  redirect('/entrar');
}
