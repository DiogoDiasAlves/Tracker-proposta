import Link from 'next/link';
import { exigirAdmin } from '@/lib/sessao';
import { IconLogo, IconBolt } from '@/components/icons';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirAdmin();

  return (
    <div className="min-h-dvh">
      <header className="flex h-[64px] items-center gap-4 border-b border-line px-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <IconLogo className="h-7 w-7" />
          <span className="text-[14px] font-semibold tracking-tight">Régua</span>
          <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-faint">
            Admin
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12.5px] text-faint">{usuario.name ?? usuario.email}</span>
          <Link href="/painel" className="btn-ghost flex items-center gap-2 px-3.5 py-2 text-[12.5px] text-muted">
            <IconBolt className="h-3.5 w-3.5" />
            Ir para o painel
          </Link>
          <form action="/sair" method="post">
            <button type="submit" className="btn-ghost px-3.5 py-2 text-[12.5px] text-muted">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
