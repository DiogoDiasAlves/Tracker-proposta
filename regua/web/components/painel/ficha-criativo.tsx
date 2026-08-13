import type { Criativo } from '@/lib/meta';

/* Ficha do criativo — a grade de métricas que o mercado já usa, para o número
   ser reconhecível por quem vem de outra ferramenta.

   A divisão em três blocos não é decorativa. Ela conta o funil na ordem em
   que ele acontece, e é isso que permite separar as causas:

     ANÚNCIO   hook, hold  →  o criativo segurou no feed?
     TRÁFEGO   CPM, CPC    →  quanto custou trazer
     RESULTADO ROAS, CPA   →  virou dinheiro?

   Com hook baixo e CPA ruim, o problema é o gancho. Com hook alto e CPA ruim,
   o problema está depois do clique — e aí a curva por bloco, logo abaixo, diz
   exatamente onde. */

const brl = (n: number | null, casas = 2) =>
  n == null ? '—' : n.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  });
const pct = (n: number | null, d = 2) => (n == null ? '—' : `${n.toFixed(d).replace('.', ',')}%`);
const num = (n: number) => n.toLocaleString('pt-BR');
const compacto = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : num(n);

/* Referências de mercado para hook e hold. Ter a faixa ao lado é o que
   transforma "37,63%" em decisão — igual às metas do quiz. */
function faixa(valor: number | null, piso: number, bom: number) {
  if (valor == null) return { cor: 'var(--color-muted)', nota: 'sem dado' };
  if (valor >= bom) return { cor: 'var(--color-accent)', nota: `bom (${bom}%+)` };
  if (valor >= piso) return { cor: 'var(--color-warn)', nota: `aceitável, bom é ${bom}%` };
  return { cor: 'var(--color-danger)', nota: `abaixo do piso de ${piso}%` };
}

export function FichaCriativo({ c }: { c: Criativo }) {
  const h = faixa(c.hook, 20, 30);
  const d = faixa(c.hold, 10, 20);
  const roasCor = c.roas == null ? 'var(--color-muted)'
    : c.roas >= 1 ? 'var(--color-accent)' : 'var(--color-danger)';

  const grupos: { titulo: string; nota: string; itens: [string, string, string?, string?][] }[] = [
    {
      titulo: 'Anúncio', nota: 'retenção no feed, antes do clique',
      itens: [
        ['Hook rate', pct(c.hook), h.cor, `${compacto(c.views_3s)} pararam de rolar · ${h.nota}`],
        ['Hold rate', pct(c.hold), d.cor, `${compacto(c.thruplays)} viram o corpo · ${d.nota}`],
        ['Body conversion', pct(c.body_conv), undefined, 'vendas entre quem viu o corpo'],
      ],
    },
    {
      titulo: 'Tráfego', nota: 'o que a Meta cobrou',
      itens: [
        ['Gasto', brl(c.gasto, 2)],
        ['Impressões', compacto(c.impressoes)],
        ['Cliques', num(c.cliques)],
        ['CPM', brl(c.cpm)],
        ['CPC', brl(c.cpc)],
        ['CTR', pct(c.ctr)],
      ],
    },
    {
      titulo: 'Resultado', nota: 'o que virou dinheiro',
      itens: [
        ['ROAS', c.roas == null ? '—' : `${c.roas.toFixed(2).replace('.', ',')}x`, roasCor],
        ['CPA real', brl(c.cpa, 2), 'var(--color-ink)', 'gasto ÷ conversão medida na página'],
        ['Vendas', num(c.compras)],
        ['Receita', brl(c.receita, 2)],
        ['Ticket médio', brl(c.ticket, 2)],
        ['Taxa conv.', pct(c.conv_meta), undefined, 'vendas ÷ cliques'],
      ],
    },
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        {c.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumb} alt="" width={64} height={64}
               className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-line bg-panel text-[10px] text-faint">
            sem capa
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-semibold">{c.nome}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-faint">
            {c.ad_id}{c.campanha ? ` · ${c.campanha}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-3">
        {grupos.map(g => (
          <div key={g.titulo} className="bg-surface p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted">{g.titulo}</p>
            <p className="mt-0.5 text-[10.5px] text-faint">{g.nota}</p>

            <dl className="mt-4 space-y-3">
              {g.itens.map(([rotulo, valor, cor, nota]) => (
                <div key={rotulo}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12px] text-muted">{rotulo}</dt>
                    <dd className="text-[17px] font-semibold tnum"
                        style={{ color: cor ?? 'var(--color-ink)' }}>
                      {valor}
                    </dd>
                  </div>
                  {nota && <p className="mt-0.5 text-[10.5px] leading-snug text-faint">{nota}</p>}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Curva do próprio anúncio, em quartis. Mesma leitura da curva da VSL,
          só que do vídeo que roda no feed. */}
      {c.quartis.some(q => q > 0) && (
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-muted">
            Retenção do anúncio no feed
          </p>
          <div className="flex items-end gap-2">
            {[
              ['3s', c.views_3s], ['25%', c.quartis[0]], ['50%', c.quartis[1]],
              ['75%', c.quartis[2]], ['100%', c.quartis[3]],
            ].map(([rot, v]) => {
              const alt = c.views_3s ? ((v as number) / c.views_3s) * 100 : 0;
              return (
                <div key={rot as string} className="flex-1 text-center">
                  <div className="mx-auto flex h-20 w-full items-end">
                    <div className="w-full rounded-t-md bg-accent/60"
                         style={{ height: `${Math.max(2, alt)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-faint">{rot as string}</p>
                  <p className="text-[11px] tnum text-muted">{compacto(v as number)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
