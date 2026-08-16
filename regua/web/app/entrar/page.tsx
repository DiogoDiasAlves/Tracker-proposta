import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/sessao';
import { IconLogo } from '@/components/icons';

export const metadata = { title: 'Entrar — Régua' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  if (await usuarioAtual()) redirect('/painel');

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <IconLogo className="h-10 w-10" />
          <div>
            <p className="text-[17px] font-semibold tracking-tight">Régua</p>
            <p className="text-[12px] text-faint">Onde o funil está sangrando</p>
          </div>
        </div>

        <form action="/api/entrar" method="post" className="card space-y-3 p-6">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">E-mail</span>
            <input name="email" type="email" required autoComplete="email" autoFocus
                   className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent/60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Senha</span>
            <input name="senha" type="password" required autoComplete="current-password"
                   className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent/60" />
          </label>

          {sp.erro && (
            <p className="rounded-lg border border-danger/25 bg-danger/[.07] px-3 py-2 text-[12px] text-danger">
              {sp.erro === 'sem-conta'
                ? 'Este usuário não está ligado a nenhuma conta.'
                : 'E-mail ou senha incorretos.'}
            </p>
          )}

          <button type="submit" className="btn-accent w-full py-2.5 text-[13.5px]">Entrar</button>
        </form>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-faint">
          Ainda não tem conta?{' '}
          <Link href="/criar-conta" className="text-accent hover:underline">Criar conta</Link>
        </p>
      </div>
    </main>
  );
}
