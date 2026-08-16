import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/lib/sessao';
import { IconLogo } from '@/components/icons';

export const metadata = { title: 'Criar conta — Régua' };

export default async function CriarConta({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  if (await usuarioAtual()) redirect('/painel');

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <IconLogo className="h-10 w-10" />
          <div>
            <p className="text-[17px] font-semibold tracking-tight">Régua</p>
            <p className="text-[12px] text-faint">Onde o funil está sangrando</p>
          </div>
        </div>

        <form action="/api/criar-conta" method="post" className="card space-y-3 p-6">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Seu nome</span>
            <input name="nome" type="text" required autoComplete="name" autoFocus
                   className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent/60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Nome da conta</span>
            <input name="nomeConta" type="text" required placeholder="ex.: nome do seu negócio ou oferta"
                   className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent/60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">E-mail</span>
            <input name="email" type="email" required autoComplete="email"
                   className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent/60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Senha</span>
            <input name="senha" type="password" required minLength={8} autoComplete="new-password"
                   className="w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent/60" />
            <span className="mt-1 block text-[11px] text-faint">Mínimo de 8 caracteres.</span>
          </label>

          {sp.erro && (
            <p className="rounded-lg border border-danger/25 bg-danger/[.07] px-3 py-2 text-[12px] text-danger">
              {sp.erro === 'email-em-uso'
                ? 'Já existe uma conta com este e-mail. Tente entrar em vez de criar outra.'
                : 'Confira os campos — todos são obrigatórios e a senha precisa de 8 caracteres ou mais.'}
            </p>
          )}

          <button type="submit" className="btn-accent w-full py-2.5 text-[13.5px]">Criar conta</button>
        </form>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-faint">
          Já tem conta?{' '}
          <Link href="/entrar" className="text-accent hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
