'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconBell } from '../icons';

export type ItemAviso = { key: string; kind: 'page' | 'vsl' | 'quiz'; sessions: number };

const ROTULO: Record<string, string> = { page: 'página', vsl: 'vídeo', quiz: 'quiz' };

const linkPara = (i: ItemAviso) =>
  i.kind === 'page' ? `/painel/paginas/${encodeURIComponent(i.key)}`
    : i.kind === 'vsl' ? `/painel/videos?pagina=${encodeURIComponent(i.key)}`
      : `/painel/quiz?pagina=${encodeURIComponent(i.key)}`;

/* O sino já contava certo (amostra abaixo de 300) — só não abria pra nada.
   Um número sem lugar de chegar é pior que não ter número: promete uma
   resposta que não existe. */
export function AvisosAmostra({ itens }: { itens: ItemAviso[] }) {
  const [aberto, setAberto] = useState(false);
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

  return (
    <div className="relative" ref={caixa}>
      <button onClick={() => setAberto(v => !v)} aria-label="Avisos" aria-expanded={aberto}
              className="btn-ghost relative grid h-10 w-10 place-items-center">
        <IconBell className="h-[18px] w-[18px] text-muted" />
        {itens.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold tnum text-[#04241A]">
            {itens.length}
          </span>
        )}
      </button>

      {aberto && (
        <div role="listbox"
             className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/60">
          <div className="border-b border-line p-3.5">
            <p className="text-[12.5px] font-semibold text-ink">Amostra baixa</p>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              Abaixo de 300 sessões, o número ainda se move muito a cada visitante — leia
              como tendência inicial, não como resultado fechado.
            </p>
          </div>
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {itens.map(i => (
              <li key={i.key}>
                <Link href={linkPara(i)} onClick={() => setAberto(false)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition hover:bg-surface">
                  <span className="truncate font-mono text-[12.5px] text-ink">{i.key}</span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {ROTULO[i.kind] ?? i.kind} · {i.sessions} sessões
                  </span>
                </Link>
              </li>
            ))}
            {!itens.length && (
              <li className="px-3.5 py-6 text-center text-[12px] text-faint">
                Nada com amostra baixa agora.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
