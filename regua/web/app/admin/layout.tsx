import Link from 'next/link';
import { exigirAdmin } from '@/lib/sessao';
import { IconLogo, IconBolt } from '@/components/icons';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirAdmin();

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:h-[64px] md:flex-nowrap md:gap-4 md:px-6 md:py-0">
        <Link href="/admin" className="flex items-center gap-2.5">
          <IconLogo className="h-7 w-7" />
          <span className="text-[14px] font-semibold tracking-tight">Régua</span>
          <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-faint">
            Admin
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <span className="hidden text-[12.5px] text-faint md:inline">{usuario.name ?? usuario.email}</span>
          <Link href="/painel" className="btn-ghost flex items-center gap-2 px-3 py-2 text-[12.5px] text-muted md:px-3.5">
            <IconBolt className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ir para o painel</span>
          </Link>
          <form action="/sair" method="post">
            <button type="submit" className="btn-ghost px-3 py-2 text-[12.5px] text-muted md:px-3.5">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
