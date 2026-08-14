'use client';

import { useId, useState } from 'react';

/* Evolução no tempo.

   Duas grandezas, dois gráficos empilhados sobre o MESMO eixo de datas:
   conversão em cima (linha), volume embaixo (barras). Sobrepor as duas num
   eixo só é o erro que mais engana em gráfico — a escala de uma esconde a
   outra, e a leitura vira o que a escolha de escala decidir.

   A marca de versão é o que dá dono à subida. Sem ela, uma linha que sobe
   pode ser a alteração, o fim de semana ou um criativo novo, e não há como
   separar. */

export type Ponto = {
  dia: string; versao: string;
  sessoes: number; conversoes: number; conversao: number; profundidade: number;
};

const dm = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const nf = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

export function LinhaEvolucao({ pontos }: { pontos: Ponto[] }) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  if (pontos.length < 2) {
    return (
      <p className="py-8 text-center text-[12.5px] text-faint">
        A linha aparece a partir do segundo dia de coleta.
      </p>
    );
  }

  const W = 860, Hc = 190, Hv = 56, ml = 46, mr = 16, mt = 12, mb = 26;
  const iw = W - ml - mr, ih = Hc - mt - mb;
  const n = pontos.length;
  const passo = iw / Math.max(1, n - 1);
  const x = (i: number) => ml + i * passo;

  const maxConv = Math.max(1, ...pontos.map(p => p.conversao)) * 1.15;
  const y = (v: number) => mt + ih - (v / maxConv) * ih;
  const maxSes = Math.max(1, ...pontos.map(p => p.sessoes));

  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.conversao)}`).join(' ');
  const area = `M${ml},${y(0)} ` + pontos.map((p, i) => `L${x(i)},${y(p.conversao)}`).join(' ') +
               ` L${x(n - 1)},${y(0)} Z`;

  /* Onde a versão trocou. É a fronteira que permite atribuir: antes disso
     era outra página. */
  const trocas = pontos
    .map((p, i) => ({ i, de: pontos[i - 1]?.versao, para: p.versao }))
    .filter(t => t.i > 0 && t.de !== t.para);

  const ativo = hover != null ? pontos[hover] : null;

  // uma marca de data a cada ~6 pontos, para o eixo não virar parede
  const salto = Math.max(1, Math.ceil(n / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${Hc + Hv}`} className="w-full" role="img"
           aria-label={`Conversão por dia. ${pontos.map(p => `${dm(p.dia)}: ${nf(p.conversao)}%`).join('. ')}`}>
        <defs>
          <linearGradient id={`e${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, maxConv / 2, maxConv].map((g, k) => (
          <g key={k}>
            <line x1={ml} y1={y(g)} x2={W - mr} y2={y(g)}
                  stroke="var(--color-line)" opacity={g === 0 ? 1 : 0.5} />
            <text x={ml - 9} y={y(g) + 4} textAnchor="end" className="fill-faint text-[10px] tnum">
              {nf(g, 1)}%
            </text>
          </g>
        ))}

        {/* faixa da versão nova + marca da troca */}
        {trocas.map(t => (
          <g key={t.i}>
            <rect x={x(t.i) - passo / 2} y={mt} width={W - mr - (x(t.i) - passo / 2)} height={ih + Hv}
                  fill="var(--color-accent)" opacity=".05" />
            <line x1={x(t.i) - passo / 2} y1={mt} x2={x(t.i) - passo / 2} y2={mt + ih + Hv}
                  stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 3" opacity=".7" />
            <rect x={x(t.i) - passo / 2 - 14} y={mt - 3} width="28" height="15" rx="4"
                  fill="var(--color-elevated)" />
            <text x={x(t.i) - passo / 2} y={mt + 8} textAnchor="middle"
                  className="fill-accent text-[9px]">v{t.para}</text>
          </g>
        ))}

        <path d={area} fill={`url(#e${uid})`} />
        <path d={linha} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />

        {ativo && hover != null && (
          <>
            <line x1={x(hover)} y1={mt} x2={x(hover)} y2={mt + ih}
                  stroke="var(--color-accent)" opacity=".45" />
            <circle cx={x(hover)} cy={y(ativo.conversao)} r="5"
                    fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
          </>
        )}

        {/* volume, num painel próprio abaixo — mesma escala de datas, nunca
            o mesmo eixo vertical */}
        {pontos.map((p, i) => {
          const alt = (p.sessoes / maxSes) * (Hv - 14);
          return (
            <rect key={p.dia + p.versao} x={x(i) - Math.max(2, passo * 0.32)}
                  y={Hc + (Hv - 14) - alt}
                  width={Math.max(4, passo * 0.64)} height={Math.max(1, alt)} rx="2"
                  fill="var(--color-mark-base)" opacity={hover === i ? 0.9 : 0.45} />
          );
        })}
        <text x={ml - 9} y={Hc + Hv - 12} textAnchor="end" className="fill-faint text-[9px]">
          sessões
        </text>

        {pontos.map((p, i) => (i % salto === 0 || i === n - 1) && (
          <text key={`d${i}`} x={x(i)} y={mt + ih + 15} textAnchor="middle"
                className="fill-faint text-[9.5px] tnum">{dm(p.dia)}</text>
        ))}

        <rect x={ml - passo / 2} y={mt} width={iw + passo} height={ih + Hv} fill="transparent"
              className="cursor-crosshair"
              onMouseMove={ev => {
                const r = ev.currentTarget.getBoundingClientRect();
                const px = ((ev.clientX - r.left) / r.width) * (iw + passo) + ml - passo / 2;
                setHover(Math.max(0, Math.min(n - 1, Math.round((px - ml) / passo))));
              }}
              onMouseLeave={() => setHover(null)} />
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-accent" /> conversão do dia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-mark-base/60" /> sessões
        </span>
        {trocas.length > 0 && (
          <span className="flex items-center gap-1.5 text-accent">
            <span className="h-3 w-px bg-accent" /> troca de versão
          </span>
        )}
        <span className="ml-auto tnum text-ink">
          {ativo
            ? `${dm(ativo.dia)} · v${ativo.versao} · ${ativo.sessoes} sessões · ${nf(ativo.conversao)}%`
            : 'passe o mouse na linha'}
        </span>
      </div>
    </div>
  );
}
