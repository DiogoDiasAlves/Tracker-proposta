'use client';

import { useState } from 'react';
import type { Leitura } from '@/lib/dados';
import { CurvaRetencao } from '../graficos/curva-retencao';
import { MapaQueda, faixaQueda, TEXTO } from '../graficos/mapa-queda';

const CORES_VEREDITO: Record<string, string> = {
  TRAVA: 'var(--color-danger)',
  'REJEIÇÃO': 'var(--color-warn)',
  FUNCIONA: 'var(--color-accent)',
  IGNORADO: 'var(--color-muted)',
  DOBRA: 'var(--color-muted)',
  'ÚLTIMO': 'var(--color-muted)',
};

const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

export function VistaRetencao({ leitura }: { leitura: Leitura }) {
  const gargalo = Math.max(0, leitura.steps.findIndex(s => s.step === leitura.worst));
  const [sel, setSel] = useState(gargalo);
  const e = leitura.steps[sel];
  if (!e) return null;

  const cor = CORES_VEREDITO[e.verdict] ?? 'var(--color-muted)';

  return (
    <div className="space-y-4">
      {!leitura.enough && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/[.07] px-4 py-3 text-[12.5px] leading-relaxed text-danger">
          <span className="mt-0.5">▲</span>
          <p>
            Apenas {leitura.sessions.toLocaleString('pt-BR')} sessões. Abaixo de {leitura.min_sample} os
            números são ruído — leia como tendência, não como resultado.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_290px]">
        <section className="card p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] uppercase tracking-wider text-muted">Curva de retenção</h2>
            <span className="text-[11px] text-faint">clique num bloco para ler o diagnóstico</span>
          </div>
          <CurvaRetencao
            etapas={leitura.steps}
            rotuloSerie={`v${leitura.version} · ${leitura.device}`}
            selecionado={sel}
            onSelecionar={setSel}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-[13px] uppercase tracking-wider text-muted">Queda por bloco</h2>
          <MapaQueda etapas={leitura.steps} selecionado={sel} onSelecionar={setSel} />
        </section>
      </div>

      {/* Diagnóstico — o produto não é a tabela, é esta frase. */}
      <section className="card overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <span className="text-[22px] font-bold tracking-tight" style={{ color: cor }}>
                {e.verdict}
              </span>
              <span className="text-[12.5px] text-muted">
                bloco {sel + 1} · <span className="text-ink">{e.step}</span>
              </span>
            </div>
            <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted">{e.reading}</p>
            <p className="mt-3 border-l-2 border-accent pl-3 text-[12.5px] leading-relaxed text-ink">
              {e.action}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-xl border border-line bg-line">
            {[
              ['chegaram', `${nf(e.reach)}%`, 'var(--color-ink)'],
              ['queda', e.drop === null ? '—' : `${nf(e.drop)}%`, TEXTO[faixaQueda(e.drop, sel === 0)]],
              ['tempo mediano', `${nf(e.dwell_s)}s`, 'var(--color-ink)'],
              ['reentradas', nf(e.entries, 2), e.entries >= 1.5 ? 'var(--color-warn)' : 'var(--color-ink)'],
            ].map(([r, v, c]) => (
              <div key={r} className="bg-surface p-3.5">
                <dt className="mb-1 text-[9.5px] uppercase tracking-wider text-faint">{r}</dt>
                <dd className="text-[19px] font-semibold tnum" style={{ color: c }}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Tabela — é também a "table view" de acessibilidade dos gráficos acima. */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line">
                {['Bloco', 'Chegaram', 'Queda', 'Tempo /100px', 'Reentradas', 'Saída', 'CTA', 'CTR'].map((h, i) => (
                  <th key={h}
                      className={`px-4 py-3 text-[9.5px] font-normal uppercase tracking-wider text-faint ${i ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leitura.steps.map((s, i) => {
                const f = faixaQueda(s.drop, i === 0);
                return (
                  <tr key={s.step} onClick={() => setSel(i)}
                      aria-selected={i === sel}
                      className={`cursor-pointer border-b border-line-soft transition ${
                        i === sel ? 'bg-surface-2' : 'hover:bg-surface-2/50'}`}>
                    <td className="px-4 py-2.5">
                      <span className="mr-2.5 text-faint tnum">{i + 1}</span>
                      <span className="text-ink">{s.step}</span>
                      {i === 0 && (
                        <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-faint">
                          dobra
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum">{nf(s.reach)}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold tnum" style={{ color: TEXTO[f] }}>
                      {s.drop === null ? '—' : `${nf(s.drop)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum">{nf(s.per100)}s</td>
                    <td className="px-4 py-2.5 text-right tnum">{nf(s.entries, 2)}</td>
                    <td className="px-4 py-2.5 text-right tnum">{nf(s.exit)}%</td>
                    <td className="px-4 py-2.5 text-right tnum">{s.cta_clicks || '—'}</td>
                    <td className="px-4 py-2.5 text-right tnum">
                      {s.cta_clicks ? `${nf(s.cta_ctr)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
