'use client';

import { useId, useMemo, useState } from 'react';
import type { Etapa } from '@/lib/dados';

/* Curva de retenção — degrau, não curva suave.
   A retenção é constante DENTRO do bloco e cai ENTRE blocos. Interpolar
   com curva desenharia uma perda gradual que não existe e esconderia
   exatamente o que o produto vende: onde é o degrau. */

const COR_LINHA = 'var(--color-accent)';
const COR_BASE = 'var(--color-mark-base)';

type Props = {
  etapas: Etapa[];
  base?: { rotulo: string; valores: (number | null)[] } | null;
  /* Sobrescreve os valores da série destacada. Serve à comparação de versões:
     o eixo e os nomes vêm de uma versão, os valores em destaque da outra. */
  valores?: (number | null)[];
  rotuloSerie: string;
  selecionado: number;
  onSelecionar: (i: number) => void;
};

export function CurvaRetencao({ etapas, base, valores, rotuloSerie, selecionado, onSelecionar }: Props) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const W = 760, H = 300, ml = 44, mr = 16, mt = 14, mb = 44;
  const iw = W - ml - mr, ih = H - mt - mb;
  const n = etapas.length;
  const bw = n ? iw / n : 0;

  const x = (i: number) => ml + i * bw;
  const y = (v: number) => mt + ih - (v / 100) * ih;

  const caminhos = useMemo(() => {
    const linha = (vals: (number | null)[]) => {
      let d = '', aberto = false;
      vals.forEach((v, i) => {
        if (v == null) { aberto = false; return; }
        d += `${aberto ? 'L' : 'M'}${x(i)},${y(v)} L${x(i + 1)},${y(v)}`;
        aberto = true;
      });
      return d;
    };
    const area = (vals: (number | null)[]) => {
      let d = `M${ml},${y(0)}`;
      vals.forEach((v, i) => { if (v != null) d += ` L${x(i)},${y(v)} L${x(i + 1)},${y(v)}`; });
      return d + ` L${W - mr},${y(0)} Z`;
    };
    const principal = valores ?? etapas.map(e => e.reach);
    return { linha: linha(principal), area: area(principal), base: base ? linha(base.valores) : null };
  }, [etapas, base, valores, n]);

  const ativo = hover ?? selecionado;
  const eAtiva = etapas[ativo];

  function aoMover(ev: React.MouseEvent<SVGRectElement>) {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.floor((px - ml) / bw);
    setHover(i >= 0 && i < n ? i : null);
  }

  if (!n) return <div className="grid h-[240px] place-items-center text-sm text-faint">Sem dados</div>;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Curva de retenção por bloco. ${etapas.map(e => `${e.step}: ${e.reach.toFixed(0)}%`).join('. ')}`}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity=".26" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grade recessiva */}
        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={ml} y1={y(g)} x2={W - mr} y2={y(g)}
                  stroke="var(--color-line)" strokeWidth="1" opacity={g === 0 ? 1 : 0.5} />
            <text x={ml - 10} y={y(g) + 4} textAnchor="end"
                  className="fill-faint text-[10px] tnum">{g}%</text>
          </g>
        ))}

        {/* faixa do bloco ativo */}
        <rect x={x(ativo)} y={mt} width={bw} height={ih}
              fill="var(--color-accent)" opacity=".07" />

        <path d={caminhos.area} fill={`url(#g${uid})`} />
        {caminhos.base && (
          <path d={caminhos.base} fill="none" stroke={COR_BASE} strokeWidth="2"
                strokeDasharray="5 4" strokeLinejoin="round" />
        )}
        <path d={caminhos.linha} fill="none" stroke={COR_LINHA} strokeWidth="2" strokeLinejoin="round" />

        {/* marcador do ponto ativo: anel na cor da superfície separa a marca do traço */}
        <circle cx={x(ativo) + bw / 2} cy={y((valores?.[ativo] ?? eAtiva.reach) ?? eAtiva.reach)} r="5.5"
                fill={COR_LINHA} stroke="var(--color-surface)" strokeWidth="2" />

        {/* eixo: número do bloco, nome só no ativo — rótulo em todos vira ruído */}
        {etapas.map((e, i) => (
          <text key={e.step} x={x(i) + bw / 2} y={H - 26} textAnchor="middle"
                className={`text-[10px] tnum ${i === ativo ? 'fill-ink' : 'fill-faint'}`}>
            {i + 1}
          </text>
        ))}
        <text x={x(ativo) + bw / 2} y={H - 10} textAnchor="middle"
              className="fill-accent text-[10px]">{eAtiva.step}</text>

        <rect x={ml} y={mt} width={iw} height={ih} fill="transparent"
              onMouseMove={aoMover} onMouseLeave={() => setHover(null)}
              onClick={() => hover != null && onSelecionar(hover)}
              className="cursor-pointer" />
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: COR_LINHA }} />
          {rotuloSerie}
        </span>
        {base && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full"
                  style={{ background: `repeating-linear-gradient(90deg, ${COR_BASE} 0 5px, transparent 5px 9px)` }} />
            {base.rotulo}
          </span>
        )}
        <span className="text-faint">% das sessões que alcançou cada bloco</span>
      </div>
    </div>
  );
}
