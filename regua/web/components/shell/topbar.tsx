import { IconSearch, IconGear, IconChevron, IconPlug, IconUserCheck, IconMenu } from '../icons';
import Link from 'next/link';
import { AvisosAmostra, type ItemAviso } from './avisos-amostra';

export function Topbar({
  conta, usuario, avisos = [], isAdmin = false, onMenu,
}: {
  conta: string; usuario?: string; avisos?: ItemAviso[]; isAdmin?: boolean; onMenu?: () => void;
}) {
  const iniciais = (usuario || conta).slice(0, 2).toUpperCase();

  return (
    <header className="relative z-10 flex h-[64px] items-center gap-3 border-b border-line px-4 md:h-[72px] md:gap-4 md:px-6">
      <button
        onClick={onMenu}
        aria-label="Abrir menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-muted md:hidden"
      >
        <IconMenu className="h-[18px] w-[18px]" />
      </button>

      <button className="hidden items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:opacity-80 md:flex">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent-soft to-accent text-[13px] font-bold text-[#04241A]">
          {iniciais}
        </span>
        <span className="leading-tight">
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            @{conta}
            <span className="rounded-[5px] bg-accent/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-accent">
              Beta
            </span>
          </span>
          <span className="block text-[14px] font-medium">{usuario ?? 'Workspace'}</span>
        </span>
        <IconChevron className="h-4 w-4 text-faint" />
      </button>

      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-soft to-accent text-[12px] font-bold text-[#04241A] md:hidden">
        {iniciais}
      </span>

      <div className="hidden h-8 w-px bg-line md:block" />

      <Link href="/painel/instalar" className="btn-accent hidden items-center gap-2 px-4 py-2.5 text-[13px] md:flex">
        <IconPlug className="h-4 w-4" />
        Instalar script
      </Link>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
        {isAdmin && (
          <Link
            href="/admin"
            className="btn-ghost flex items-center gap-2 px-2.5 py-2.5 text-[13px] text-muted md:px-3.5"
            title="Painel de administração"
          >
            <IconUserCheck className="h-[17px] w-[17px]" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}

        <AvisosAmostra itens={avisos} />

        <div className="btn-ghost hidden items-center gap-2 px-3 py-2.5 lg:flex">
          <IconSearch className="h-[17px] w-[17px] text-faint" />
          <input
            placeholder="Buscar página, bloco…"
            className="w-40 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
          />
        </div>

        <form action="/sair" method="post">
          <button type="submit" className="btn-ghost flex items-center gap-2 px-2.5 py-2.5 text-[13px] text-muted md:px-3.5">
            <span className="hidden md:inline">Sair</span>
            <IconGear className="h-[17px] w-[17px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
