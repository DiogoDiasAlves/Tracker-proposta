'use client';

import type { Etapa } from '@/lib/dados';
import { faixaQueda, MARCA, TEXTO } from '@/lib/faixas';

/* Mapa de queda.
   A queda tem leitura de ESTADO, não de rampa contínua: até 10% é normal,
   10–20% pede atenção, acima disso é problema. Por isso status, e não
   gradiente.

   E cor nunca sozinha: cada linha traz comprimento de barra proporcional à
   queda MAIS o número em texto. Quem não distingue as três matizes lê pelo
   tamanho e pelo dígito. */

export function MapaQueda({
  etapas, selecionado, onSelecionar,
}: { etapas: Etapa[]; selecionado: number; onSelecionar: (i: number) => void }) {
  const maior = Math.max(1, ...etapas.map(e => e.drop ?? 0));

  return (
    <div className="flex flex-col gap-1.5">
      {etapas.map((e, i) => {
        const faixa = faixaQueda(e.drop, i === 0);
        const largura = e.drop === null ? 0 : (e.drop / maior) * 100;
        const ativo = i === selecionado;

        return (
          <button
            key={e.step}
            onClick={() => onSelecionar(i)}
            aria-pressed={ativo}
            className={[
              'group relative overflow-hidden rounded-lg border px-2.5 py-2 text-left transition',
              ativo ? 'border-accent/60 bg-surface-2' : 'border-transparent hover:bg-surface-2/60',
            ].join(' ')}
          >
            {/* barra: a queda codificada por COMPRIMENTO, não só por cor */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-lg opacity-[.22] transition-all"
              style={{ width: `${largura}%`, background: MARCA[faixa] }}
            />
            <span className="relative flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px]"
                    style={{ background: MARCA[faixa] }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{e.step}</span>
              <span className="text-[12px] font-semibold tnum" style={{ color: TEXTO[faixa] }}>
                {e.drop === null ? '—' : `${e.drop.toFixed(0)}%`}
              </span>
            </span>
          </button>
        );
      })}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-faint">
        {[['bom', 'até 10%'], ['atencao', '10–20%'], ['ruim', 'acima de 20%'], ['base', 'dobra']].map(
          ([k, r]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: MARCA[k as keyof typeof MARCA] }} />
              {r}
            </span>
          )
        )}
      </div>
    </div>
  );
}
