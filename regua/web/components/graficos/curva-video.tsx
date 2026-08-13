'use client';

import { useId, useState } from 'react';
import type { CurvaPonto } from '@/lib/dados';

/* Curva de retenção do vídeo.

   Duas séries no mesmo eixo porque as duas são "% das sessões": quanto ainda
   assistia, e quanto estava revendo aquele trecho. A conversão acumulada NÃO
   entra aqui — ela é percentual de outra base, e sobrepor com segundo eixo é
   o erro que mais engana em gráfico. Ela vai num painel próprio.

   Aqui a curva é suave, ao contrário da página: a retenção de vídeo cai de
   fato continuamente, segundo a segundo. Degrau é que seria mentira. */

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function CurvaVideo({
  curva, duracao, pitch, quedaAbrupta,
}: {
  curva: CurvaPonto[];
  duracao: number;
  pitch: number | null;
  quedaAbrupta: { de: number; ate: number; queda: number } | null;
}) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const W = 860, H = 300, ml = 44, mr = 16, mt = 14, mb = 40;
  const iw = W - ml - mr, ih = H - mt - mb;
  const x = (s: number) => ml + (s / duracao) * iw;
  const y = (v: number) => mt + ih - (v / 100) * ih;

  const linha = (campo: 'ret' | 'rev') =>
    curva.map((p, i) => `${i ? 'L' : 'M'}${x(p.s)},${y(p[campo])}`).join(' ');
  const area = `M${ml},${y(0)} ` + curva.map(p => `L${x(p.s)},${y(p.ret)}`).join(' ') +
               ` L${x(curva[curva.length - 1]?.s ?? 0)},${y(0)} Z`;

  const ativo = hover != null ? curva[hover] : null;

  // marcas de tempo redondas, não uma por ponto
  const marcas: number[] = [];
  const passo = duracao > 900 ? 180 : duracao > 300 ? 60 : 30;
  for (let s = 0; s <= duracao; s += passo) marcas.push(s);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Retenção do vídeo ao longo de ${mmss(duracao)}. ${
             curva.filter((_, i) => i % 20 === 0).map(p => `${mmss(p.s)}: ${p.ret.toFixed(0)}%`).join('. ')}`}>
        <defs>
          <linearGradient id={`v${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={ml} y1={y(g)} x2={W - mr} y2={y(g)}
                  stroke="var(--color-line)" opacity={g === 0 ? 1 : 0.5} />
            <text x={ml - 9} y={y(g) + 4} textAnchor="end" className="fill-faint text-[10px] tnum">{g}%</text>
          </g>
        ))}

        {/* trecho de queda abrupta: onde o roteiro quebra */}
        {quedaAbrupta && (
          <rect x={x(quedaAbrupta.de)} y={mt} width={Math.max(2, x(quedaAbrupta.ate) - x(quedaAbrupta.de))}
                height={ih} fill="var(--color-danger)" opacity=".12" />
        )}

        <path d={area} fill={`url(#v${uid})`} />
        <path d={linha('rev')} fill="none" stroke="var(--color-mark-warn)" strokeWidth="2"
              strokeDasharray="4 3" strokeLinejoin="round" />
        <path d={linha('ret')} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />

        {/* o pitch: a métrica de manchete do vídeo */}
        {pitch != null && pitch < duracao && (
          <g>
            <line x1={x(pitch)} y1={mt} x2={x(pitch)} y2={mt + ih}
                  stroke="var(--color-ink)" strokeWidth="1.5" strokeDasharray="3 3" opacity=".65" />
            <rect x={x(pitch) - 24} y={mt - 2} width="48" height="16" rx="4" fill="var(--color-elevated)" />
            <text x={x(pitch)} y={mt + 10} textAnchor="middle" className="fill-ink text-[9px]">oferta</text>
          </g>
        )}

        {ativo && (
          <g>
            <line x1={x(ativo.s)} y1={mt} x2={x(ativo.s)} y2={mt + ih}
                  stroke="var(--color-accent)" opacity=".45" />
            <circle cx={x(ativo.s)} cy={y(ativo.ret)} r="5"
                    fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
          </g>
        )}

        {marcas.map(s => (
          <text key={s} x={x(s)} y={H - 14} textAnchor="middle" className="fill-faint text-[9.5px] tnum">
            {mmss(s)}
          </text>
        ))}

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

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-accent" /> ainda assistindo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full"
                style={{ background: 'repeating-linear-gradient(90deg, var(--color-mark-warn) 0 4px, transparent 4px 7px)' }} />
          revendo o trecho
        </span>
        {quedaAbrupta && (
          <span className="flex items-center gap-1.5 text-danger">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-danger/30" />
            maior queda: {mmss(quedaAbrupta.de)}–{mmss(quedaAbrupta.ate)}
          </span>
        )}
        <span className="ml-auto tnum text-ink">
          {ativo ? `${mmss(ativo.s)} · ${ativo.ret.toFixed(1)}% assistindo` : 'passe o mouse na curva'}
        </span>
      </div>
    </div>
  );
}
