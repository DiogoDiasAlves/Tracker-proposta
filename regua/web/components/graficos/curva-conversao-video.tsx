'use client';

import { useId, useState } from 'react';
import type { CurvaPonto } from '@/lib/dados';

/* Conversão acumulada ao longo do vídeo: dos que converteram, em que segundo
   estavam. Painel próprio, eixo próprio — não é a mesma base da retenção
   (uma é % de sessões, a outra é % de conversões), então nunca compartilha
   escala com CurvaVideo. Ver o comentário lá. */

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function CurvaConversaoVideo({ curva, duracao }: { curva: CurvaPonto[]; duracao: number }) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const W = 860, H = 130, ml = 44, mr = 16, mt = 10, mb = 26;
  const iw = W - ml - mr, ih = H - mt - mb;
  const x = (s: number) => ml + (s / duracao) * iw;
  const y = (v: number) => mt + ih - (v / 100) * ih;

  const linha = curva.map((p, i) => `${i ? 'L' : 'M'}${x(p.s)},${y(p.conv)}`).join(' ');
  const area = `M${ml},${y(0)} ` + curva.map(p => `L${x(p.s)},${y(p.conv)}`).join(' ') +
               ` L${x(curva[curva.length - 1]?.s ?? 0)},${y(0)} Z`;
  const ativo = hover != null ? curva[hover] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Conversão acumulada ao longo do vídeo, de 0% a 100% em ${mmss(duracao)}.`}>
        <defs>
          <linearGradient id={`cv${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-mark-good)" stopOpacity=".22" />
            <stop offset="100%" stopColor="var(--color-mark-good)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map(g => (
          <g key={g}>
            <line x1={ml} y1={y(g)} x2={W - mr} y2={y(g)}
                  stroke="var(--color-line)" opacity={g === 0 ? 1 : 0.5} />
            <text x={ml - 9} y={y(g) + 4} textAnchor="end" className="fill-faint text-[10px] tnum">{g}%</text>
          </g>
        ))}

        <path d={area} fill={`url(#cv${uid})`} />
        <path d={linha} fill="none" stroke="var(--color-mark-good)" strokeWidth="2" strokeLinejoin="round" />

        {ativo && (
          <g>
            <line x1={x(ativo.s)} y1={mt} x2={x(ativo.s)} y2={mt + ih}
                  stroke="var(--color-mark-good)" opacity=".45" />
            <circle cx={x(ativo.s)} cy={y(ativo.conv)} r="4.5"
                    fill="var(--color-mark-good)" stroke="var(--color-surface)" strokeWidth="2" />
          </g>
        )}

        <rect x={ml} y={mt} width={iw} height={ih} fill="transparent" className="cursor-crosshair"
              onMouseMove={ev => {
                const r = ev.currentTarget.getBoundingClientRect();
                const s = ((ev.clientX - r.left) / r.width) * W;
                const alvo = ((s - ml) / iw) * duracao;
                let melhor = 0;
                for (let i = 1; i < curva.length; i++) {
                  if (Math.abs(curva[i].s - alvo) < Math.abs(curva[melhor].s - alvo)) melhor = i;
                }
                setHover(melhor);
              }}
              onMouseLeave={() => setHover(null)} />
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>% de quem converteu, por até onde assistiu</span>
        <span className="tnum text-ink">
          {ativo ? `até ${mmss(ativo.s)} · ${ativo.conv.toFixed(1)}% das conversões` : 'passe o mouse na curva'}
        </span>
      </div>
    </div>
  );
}
