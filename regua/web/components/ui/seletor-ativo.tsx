'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconChevron } from '../icons';

export type ItemAtivo = { key: string; kind: string; sessions: number };

const ROTULO: Record<string, string> = { page: 'página', vsl: 'vídeo', quiz: 'quiz' };

/* Seletor de oferta.
   Pílulas não servem aqui: versão e dispositivo têm duas ou três opções, mas
   oferta cresce sem teto — com oito já não cabe na linha, e com trinta
   viraria uma parede. Lista suspensa com busca resolve nos dois extremos. */
export function SeletorAtivo({ itens, atual }: { itens: ItemAtivo[]; atual: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  function escolher(key: string) {
    const q = new URLSearchParams(sp.toString());
    q.set('pagina', key);
    // versão e dispositivo pertencem à oferta anterior; carregá-los para a
    // nova mostraria "sem dados" quando na verdade só o recorte não existe lá
    q.delete('versao');
    q.delete('disp');
    setAberto(false);
    setBusca('');
    router.replace(`${path}?${q.toString()}`, { scroll: false });
  }

  const visiveis = busca
    ? itens.filter(i => i.key.toLowerCase().includes(busca.toLowerCase()))
    : itens;
  const sel = itens.find(i => i.key === atual);

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="btn-ghost flex min-w-[240px] items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] text-ink">{atual}</span>
          <span className="block text-[10.5px] text-faint">
            {ROTULO[sel?.kind ?? 'page'] ?? sel?.kind} ·{' '}
            {(sel?.sessions ?? 0).toLocaleString('pt-BR')} sessões
          </span>
        </span>
        <IconChevron className={`h-4 w-4 shrink-0 text-faint transition ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div role="listbox"
             className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/60">
          {itens.length > 6 && (
            <div className="border-b border-line p-2">
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Filtrar oferta…"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
              />
            </div>
          )}

          <ul className="max-h-[320px] overflow-y-auto py-1">
            {visiveis.map(i => (
              <li key={i.key}>
                <button
                  role="option"
                  aria-selected={i.key === atual}
                  onClick={() => escolher(i.key)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface ${
                    i.key === atual ? 'bg-surface-2' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      i.key === atual ? 'bg-accent' : 'bg-line'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] text-ink">{i.key}</span>
                    <span className="block text-[10.5px] text-faint">
                      {ROTULO[i.kind] ?? i.kind}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] tnum text-muted">
                    {i.sessions.toLocaleString('pt-BR')}
                  </span>
                </button>
              </li>
            ))}
            {!visiveis.length && (
              <li className="px-3 py-4 text-center text-[12px] text-faint">nenhuma oferta com esse nome</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
