'use client';

import { useState } from 'react';
import type { Leitura } from '@/lib/dados';
import { CurvaRetencao } from '../graficos/curva-retencao';
import { faixaQueda, TEXTO } from '@/lib/faixas';

/* Comparação de VERSÕES da mesma página.

   Diferente da comparação entre páginas: aqui os blocos são os mesmos, então
   dá para comparar bloco a bloco — e é isso que responde "a alteração
   funcionou?". Entre páginas diferentes essa leitura não existe.

   A comparação é SEQUENCIAL, não simultânea: v1 rodou num período, v2 no
   seguinte. O aviso viaja junto do resultado porque terça contra sábado
   mistura conteúdo com dia da semana. */

type Comparacao = {
  a: Leitura; b: Leitura; enough: boolean; caveat: string;
  diff: {
    step: string;
    drop_a: number | null; drop_b: number | null;
    reach_a: number; reach_b: number | null;
    per100_a: number; per100_b: number | null;
    cta_a: number; cta_b: number | null;
  }[];
};

const nf = (n: number | null, d = 1) => (n == null ? '—' : n.toFixed(d).replace('.', ','));

export function VistaVersoes({ c }: { c: Comparacao }) {
  const [sel, setSel] = useState(0);

  /* Só os blocos que MUDARAM de verdade. Com 11 blocos é praticamente
     garantido que dois ou três oscilem por acaso entre versões; listar todos
     em ordem de variação faria você perseguir ruído. Meio ponto percentual
     é o piso do que vale olhar. */
  const mudaram = c.diff
    .filter(d => d.drop_a != null && d.drop_b != null && Math.abs(d.drop_b - d.drop_a) >= 0.5)
    .sort((x, y) => Math.abs((y.drop_b! - y.drop_a!)) - Math.abs((x.drop_b! - x.drop_a!)));

  const convDelta = c.b.conversion - c.a.conversion;

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">
            Curva das duas versões
          </h2>
          <span className="text-[11px] text-faint">
            {c.a.sessions.toLocaleString('pt-BR')} vs {c.b.sessions.toLocaleString('pt-BR')} sessões
          </span>
        </div>

        <CurvaRetencao
          etapas={c.a.steps}
          base={{ rotulo: `v${c.a.version}`, valores: c.a.steps.map(s => s.reach) }}
          rotuloSerie={`v${c.b.version}`}
          selecionado={sel}
          onSelecionar={setSel}
          /* a série destacada é a NOVA: é ela que está sendo julgada */
          valores={c.a.steps.map(s => {
            const par = c.diff.find(d => d.step === s.step);
            return par?.reach_b ?? null;
          })}
        />
      </section>

      {!c.enough && (
        <div className="rounded-xl border border-danger/25 bg-danger/[.07] px-4 py-3 text-[12.5px] leading-relaxed text-danger">
          Uma das versões está abaixo de {c.a.min_sample} sessões. Para detectar diferenças de
          10 pontos percentuais com segurança são necessárias cerca de 400 por versão — abaixo
          disso, a variação que você vê pode ser só sorteio.
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">O que mudou</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            Só blocos que variaram meio ponto ou mais. Com {c.diff.length} blocos, dois ou três
            sempre oscilam por acaso — listar todos faria você perseguir ruído.
          </p>
        </div>

        <div className="divide-y divide-line-soft">
          {mudaram.map(d => {
            const delta = d.drop_b! - d.drop_a!;
            // queda MENOR é melhor: o sinal precisa ser invertido na leitura
            const melhorou = delta < 0;
            return (
              <div key={d.step} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="w-40 shrink-0 truncate text-[13px] text-ink">{d.step}</span>
                <span className="text-[12px] tnum text-muted">
                  queda {nf(d.drop_a)}% → <span className="text-ink">{nf(d.drop_b)}%</span>
                </span>
                <span className="text-[12.5px] font-semibold tnum"
                      style={{ color: melhorou ? 'var(--color-accent)' : 'var(--color-danger)' }}>
                  {melhorou ? '−' : '+'}{nf(Math.abs(delta))} pontos
                </span>
                <span className="ml-auto text-[11.5px] text-faint">
                  {melhorou ? 'segura mais gente' : 'perde mais gente'}
                </span>
              </div>
            );
          })}
          {!mudaram.length && (
            <p className="px-5 py-6 text-center text-[12.5px] text-faint">
              Nenhum bloco variou meio ponto sequer. Se você alterou algo, a alteração não mexeu
              no comportamento — ou o volume ainda é pequeno demais para mostrar.
            </p>
          )}
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Conversão da página:{' '}
            <span className="tnum">{nf(c.a.conversion, 2)}%</span> →{' '}
            <span className="tnum text-ink">{nf(c.b.conversion, 2)}%</span>{' '}
            <span className="font-semibold"
                  style={{ color: convDelta >= 0 ? 'var(--color-accent)' : 'var(--color-danger)' }}>
              ({convDelta >= 0 ? '+' : ''}{nf(convDelta, 2)} pontos)
            </span>
          </p>
          <p className="mt-2 max-w-[80ch] text-[11.5px] leading-relaxed text-faint">{c.caveat}</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-left text-[9.5px] font-normal uppercase tracking-wider text-faint">Bloco</th>
                {[`Alcance v${c.a.version}`, `Alcance v${c.b.version}`,
                  `Queda v${c.a.version}`, `Queda v${c.b.version}`, 'CTA'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-[9.5px] font-normal uppercase tracking-wider text-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.diff.map((d, i) => (
                <tr key={d.step}
                    onClick={() => setSel(i)}
                    className={`cursor-pointer border-b border-line-soft transition ${
                      i === sel ? 'bg-surface-2' : 'hover:bg-surface-2/50'}`}>
                  <td className="px-4 py-2.5">
                    <span className="mr-2.5 text-faint tnum">{i + 1}</span>
                    <span className="text-ink">{d.step}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">{nf(d.reach_a)}%</td>
                  <td className="px-4 py-2.5 text-right tnum">{nf(d.reach_b)}%</td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">
                    {d.drop_a == null ? '—' : `${nf(d.drop_a)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tnum"
                      style={{ color: TEXTO[faixaQueda(d.drop_b, i === 0)] }}>
                    {d.drop_b == null ? '—' : `${nf(d.drop_b)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">
                    {d.cta_a || d.cta_b ? `${d.cta_a} → ${d.cta_b ?? 0}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
