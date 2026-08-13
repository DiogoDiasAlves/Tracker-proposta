import type { Otimizacao, TopoQuiz } from '@/lib/dados';

const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

const COR: Record<string, string> = {
  bom: 'var(--color-accent)',
  atencao: 'var(--color-warn)',
  ruim: 'var(--color-danger)',
  'sem-dado': 'var(--color-muted)',
};

/* Os cinco números do topo, nas mesmas definições que o mercado usa — para
   serem comparáveis com o que a pessoa já vê em outras ferramentas. */
export function TopoFunil({ topo }: { topo: TopoQuiz }) {
  const ordem = ['visitantes', 'interagiram', 'taxa_interacao', 'qualificados', 'completos'] as const;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {ordem.map(chave => {
        const k = topo[chave];
        const cor = k.meta ? COR[k.meta.estado] : 'var(--color-ink)';
        return (
          <div key={chave} className={`card p-5 ${k.meta?.estado === 'bom' ? 'glow-accent' : ''}`}>
            <p className="text-[10.5px] uppercase tracking-wider text-faint">{k.rotulo}</p>
            <p className="mt-2.5 text-[30px] font-semibold leading-none tnum" style={{ color: cor }}>
              {k.pct ? `${nf(k.valor)}%` : k.valor.toLocaleString('pt-BR')}
            </p>
            <p className="mt-2 text-[11px] leading-snug text-muted">{k.nota}</p>
            {k.meta && (
              <p className="mt-1 text-[11px] leading-snug" style={{ color: cor }}>
                {k.meta.texto}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* As quatro métricas de otimização, cada uma contra a sua meta.

   É aqui que a Régua sai do empate com a InLead. Ela mostra "55,0%" e para.
   Um número sozinho não diz o que fazer: 55% é bom ou ruim? A meta ao lado
   transforma o mesmo número em decisão — "55%, e o piso é 50" faz alguém
   agir hoje. */
export function MetasOtimizacao({ metricas }: { metricas: Otimizacao[] }) {
  const foraDaMeta = metricas.filter(m => m.meta.estado === 'ruim' || m.meta.estado === 'atencao');

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[13px] uppercase tracking-wider text-muted">Métricas de otimização</h2>
          <p className="mt-1 text-[11.5px] text-faint">
            Cada uma contra a meta que decide se o funil está bom.
          </p>
        </div>
        <span className="chip" style={foraDaMeta.length
          ? { borderColor: 'color-mix(in oklab, var(--color-warn) 30%, transparent)',
              background: 'color-mix(in oklab, var(--color-warn) 10%, transparent)',
              color: 'var(--color-warn)' }
          : { borderColor: 'color-mix(in oklab, var(--color-accent) 30%, transparent)',
              background: 'color-mix(in oklab, var(--color-accent) 10%, transparent)',
              color: 'var(--color-accent)' }}>
          {foraDaMeta.length
            ? `${foraDaMeta.length} fora da meta`
            : 'todas dentro da meta'}
        </span>
      </div>

      <div className="divide-y divide-line-soft">
        {metricas.map(m => {
          const cor = COR[m.meta.estado];
          const alvo = m.teto ?? m.ideal ?? m.piso ?? 100;
          // barra proporcional à meta, saturando em 100% da largura
          const largura = m.valor == null ? 0 : Math.min(100, (m.valor / (alvo * 1.6)) * 100);
          const marca = Math.min(100, (alvo / (alvo * 1.6)) * 100);

          return (
            <div key={m.chave} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[13.5px] text-ink">{m.rotulo}</h3>
                <span className="text-[22px] font-semibold tnum" style={{ color: cor }}>
                  {m.valor == null ? '—' : `${nf(m.valor)}%`}
                </span>
                <span className="text-[11.5px]" style={{ color: cor }}>{m.meta.texto}</span>
                {m.detalhe && (
                  <span className="ml-auto font-mono text-[11px] text-faint">{m.detalhe}</span>
                )}
              </div>

              {/* barra com a meta marcada: o número sozinho não mostra o quanto falta */}
              <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                     style={{ width: `${largura}%`, background: cor, opacity: 0.85 }} />
                <div className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${marca}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-faint">
                <span>0%</span>
                <span>{m.teto ? `teto ${m.teto}%` : `meta ${m.ideal ?? m.piso}%`}</span>
              </div>

              <p className="mt-2.5 max-w-[80ch] text-[12px] leading-relaxed text-muted">{m.explica}</p>
            </div>
          );
        })}
      </div>

      <p className="border-t border-line px-5 py-4 text-[11.5px] leading-relaxed text-faint">
        A métrica que decide continua sendo o lucro. Estas quatro são as que você consegue
        mexer para chegar lá — e cada uma tem uma alavanca diferente.
      </p>
    </section>
  );
}
