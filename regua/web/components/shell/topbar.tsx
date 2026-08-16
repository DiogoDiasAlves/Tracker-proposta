import { IconSearch, IconGear, IconChevron, IconPlug } from '../icons';
import Link from 'next/link';
import { AvisosAmostra, type ItemAviso } from './avisos-amostra';

export function Topbar({
  conta, usuario, avisos = [],
}: { conta: string; usuario?: string; avisos?: ItemAviso[] }) {
  const iniciais = (usuario || conta).slice(0, 2).toUpperCase();

  return (
    <header className="relative z-10 flex h-[72px] items-center gap-4 border-b border-line px-6">
      <button className="flex items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:opacity-80">
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

      <div className="h-8 w-px bg-line" />

      <Link href="/painel/instalar" className="btn-accent flex items-center gap-2 px-4 py-2.5 text-[13px]">
        <IconPlug className="h-4 w-4" />
        Instalar script
      </Link>

      <div className="ml-auto flex items-center gap-2.5">
        <AvisosAmostra itens={avisos} />

        <div className="btn-ghost flex items-center gap-2 px-3 py-2.5">
          <IconSearch className="h-[17px] w-[17px] text-faint" />
          <input
            placeholder="Buscar página, bloco…"
            className="w-40 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
          />
        </div>

        <Link href="/sair" className="btn-ghost flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-muted">
          Sair
          <IconGear className="h-[17px] w-[17px]" />
        </Link>
      </div>
    </header>
  );
}
