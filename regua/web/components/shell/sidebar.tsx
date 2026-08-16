'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  IconLogo, IconPanel, IconLayers, IconVideo, IconQuiz, IconMegaphone,
  IconCompare, IconPlug, IconChevron, IconBolt, IconClose,
} from '../icons';

const NAV = [
  { href: '/painel', label: 'Painel', Icon: IconPanel },
  { href: '/painel/paginas', label: 'Páginas', Icon: IconLayers },
  { href: '/painel/videos', label: 'Vídeos', Icon: IconVideo, tag: 'Novo' },
  { href: '/painel/quiz', label: 'Quiz', Icon: IconQuiz, tag: 'Novo' },
  { href: '/painel/criativos', label: 'Criativos', Icon: IconMegaphone, tag: 'Meta' },
  { href: '/painel/comparar', label: 'Comparar', Icon: IconCompare },
  { href: '/painel/instalar', label: 'Instalação', Icon: IconPlug },
];

export type AssetResumo = {
  key: string; kind: string; sessions: number; worst?: string | null;
};

export function Sidebar({
  assets, aberta = false, onFechar,
}: { assets: AssetResumo[]; aberta?: boolean; onFechar?: () => void }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(true);

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-30 flex w-[268px] shrink-0 flex-col',
        'border-r border-line bg-panel backdrop-blur transition-transform duration-200',
        'md:relative md:z-10 md:translate-x-0 md:bg-panel/80',
        aberta ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <IconLogo className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 text-[15px] font-semibold tracking-tight">
            Régua <span className="text-[9px] text-faint">®</span>
          </div>
          <p className="truncate text-[11px] text-faint">Onde o funil está sangrando</p>
        </div>
        <button
          onClick={onFechar}
          aria-label="Fechar menu"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint hover:text-muted md:hidden"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-col gap-1 overflow-y-auto px-3">
        {NAV.map(({ href, label, Icon, tag }) => {
          const ativo = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onFechar}
              aria-current={ativo ? 'page' : undefined}
              className={[
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition',
                ativo
                  ? 'border border-line bg-surface text-ink'
                  : 'border border-transparent text-muted hover:text-ink',
              ].join(' ')}
            >
              <Icon className={['h-[18px] w-[18px] transition',
                ativo ? 'text-accent' : 'text-faint group-hover:text-muted'].join(' ')} />
              <span className="flex-1">{label}</span>
              {tag && (
                <span className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-faint">
                  {tag}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-3">
        <button
          onClick={() => setAberto(v => !v)}
          aria-expanded={aberto}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] text-muted transition hover:text-ink"
        >
          <IconLayers className="h-[18px] w-[18px] text-faint" />
          <span className="flex-1 text-left">Em coleta</span>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] tnum text-muted">
            {assets.length}
          </span>
          <IconChevron className={`h-4 w-4 text-faint transition ${aberto ? '' : '-rotate-90'}`} />
        </button>

        {aberto && (
          <ul className="mt-1 space-y-0.5 border-l border-line pl-3 ml-4">
            {assets.slice(0, 6).map(a => (
              <li key={a.key}>
                <Link
                  href={`/painel?pagina=${encodeURIComponent(a.key)}`}
                  onClick={onFechar}
                  className="block rounded-lg px-2.5 py-2 transition hover:bg-surface/60"
                >
                  <div className="truncate text-[12.5px] text-accent/90">{a.key}</div>
                  <div className="text-[11px] tnum text-faint">
                    {a.sessions.toLocaleString('pt-BR')} sessões
                  </div>
                </Link>
              </li>
            ))}
            {!assets.length && (
              <li className="px-2.5 py-2 text-[11.5px] leading-relaxed text-faint">
                Nada em coleta ainda. A página aparece aqui sozinha na primeira sessão.
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-auto p-4">
        <Link href="/painel/instalar" onClick={onFechar} className="panel-accent block p-4 transition hover:brightness-110">
          <div className="relative z-10 flex items-center gap-2 text-[13px] font-semibold">
            <IconBolt className="h-4 w-4 text-accent" />
            Instalar em uma página
          </div>
          <p className="relative z-10 mt-1 text-[11.5px] leading-relaxed text-muted">
            Um script, e o painel confirma sozinho quando a primeira sessão chegar.
          </p>
        </Link>
      </div>
    </aside>
  );
}
