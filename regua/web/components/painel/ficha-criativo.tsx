'use client';

import { useState } from 'react';
import type { Criativo } from '@/lib/meta';

/* Ficha do criativo: o anúncio à esquerda, as métricas à direita.

   O formato é o que o mercado já usa, e por bom motivo — número de criativo
   sem o criativo do lado obriga a pessoa a abrir o Gerenciador só para
   lembrar de qual anúncio se trata.

   A segunda aba é onde a Régua difere. As ferramentas de criativo param no
   clique: elas analisam o vídeo isolado. Aqui a segunda aba mostra o que
   aconteceu DEPOIS — porque é o cruzamento que separa "o gancho não segura"
   de "a página não converte". */

type Morte = {
  pagina: string; base: number;
  etapas: { step: string; reach: number; drop: number | null }[];
  pior: { step: string; drop: number | null } | null;
} | null;

const brl = (n: number | null, casas = 2) =>
  n == null ? '—' : n.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  });
const pct = (n: number | null, d = 2) => (n == null ? '—' : `${n.toFixed(d).replace('.', ',')}%`);
const compacto = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : n.toLocaleString('pt-BR');

/** Faixa de referência ao lado do número. "9,04%" não decide nada;
 *  "9,04%, e o piso é 20%" decide. */
function faixa(valor: number | null, piso: number, bom: number) {
  if (valor == null) return { cor: undefined, nota: 'sem dado' };
  if (valor >= bom) return { cor: 'var(--color-accent)', nota: `bom · ${bom}%+` };
  if (valor >= piso) return { cor: 'var(--color-warn)', nota: `aceitável · bom é ${bom}%` };
  return { cor: 'var(--color-danger)', nota: `abaixo do piso de ${piso}%` };
}

export function FichaCriativo({ c, morte }: { c: Criativo; morte: Morte }) {
  const [aba, setAba] = useState<'metricas' | 'funil'>('metricas');
  // URL de miniatura da Meta expira. Uma que falha precisa sumir e dar lugar
  // ao espaço reservado — ícone de imagem quebrada é pior que capa nenhuma.
  const [capaQuebrou, setCapaQuebrou] = useState(false);
  const h = faixa(c.hook, 20, 30);
  const d = faixa(c.hold, 10, 20);

  // Neutras: o que custou e o que o anúncio fez. Destacadas: o que virou
  // dinheiro. A separação visual é a mesma hierarquia da decisão.
  const neutras: [string, string, string?, string?][] = [
    ['Gasto', brl(c.gasto, 2)],
    ['Impressões', compacto(c.impressoes)],
    ['Cliques', compacto(c.cliques)],
    ['CPM', brl(c.cpm)],
    ['CPC', brl(c.cpc)],
    ['CTR', pct(c.ctr)],
    ['Hook rate', pct(c.hook), h.cor, h.nota],
    ['Hold rate', pct(c.hold), d.cor, d.nota],
    ['Body conversion', pct(c.body_conv), undefined, 'vendas ÷ quem viu o corpo'],
  ];

  const destacadas: [string, string, string?, string?][] = [
    ['ROAS', c.roas == null ? '—' : `${c.roas.toFixed(2).replace('.', ',')}x`,
      c.roas == null ? undefined : c.roas >= 1 ? 'var(--color-accent)' : 'var(--color-danger)'],
    ['CPA real', brl(c.cpa, 2), undefined, 'gasto ÷ conversão medida na página'],
    ['Vendas', compacto(c.compras)],
    ['Ticket médio', brl(c.ticket, 2)],
    ['Receita', brl(c.receita, 2)],
    ['Taxa conv.', pct(c.conv_meta), undefined, 'vendas ÷ cliques'],
  ];

  return (
    <section className="card overflow-hidden">
      <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-[340px_1fr]">

        {/* ── o anúncio ─────────────────────────────────────────────── */}
        <div className="bg-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-surface-2 px-2 py-1 text-[9.5px] uppercase tracking-wider text-faint">
              {c.video_url ? 'vídeo' : 'criativo'}
            </span>
            <span className="truncate font-mono text-[11.5px] text-muted">
              {c.video_id ? `${c.video_id}.mp4` : c.ad_id}
            </span>
          </div>

          {/* 9:16, que é o formato de quase todo criativo de tráfego hoje */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-bg"
               style={{ aspectRatio: '9 / 16' }}>
            {c.video_url ? (
              <video src={c.video_url} poster={c.thumb ?? undefined} controls playsInline
                     className="h-full w-full object-cover" />
            ) : c.thumb && !capaQuebrou ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.thumb} alt="" onError={() => setCapaQuebrou(true)}
                   className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-[1px] fill-faint">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                    O vídeo aparece aqui depois de conectar a conta da Meta.
                  </p>
                </div>
              </div>
            )}
          </div>

          <h2 className="mt-3 text-[15px] font-semibold leading-tight">{c.nome}</h2>
          <p className="mt-1 font-mono text-[11px] text-faint">
            {c.ad_id}{c.campanha ? ` · ${c.campanha}` : ''}
          </p>
        </div>

        {/* ── as métricas ───────────────────────────────────────────── */}
        <div className="bg-surface">
          <div className="flex gap-6 border-b border-line px-5">
            {([['metricas', 'Métricas'], ['funil', 'No funil']] as const).map(([id, rot]) => (
              <button key={id} onClick={() => setAba(id)}
                      aria-current={aba === id ? 'true' : undefined}
                      className={`relative py-3.5 text-[12.5px] uppercase tracking-wider transition ${
                        aba === id ? 'text-ink' : 'text-faint hover:text-muted'}`}>
                {rot}
                {aba === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>

          {aba === 'metricas' ? (
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {neutras.map(([rot, val, cor, nota]) => (
                  <div key={rot} className="rounded-xl border border-line bg-panel p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-faint">{rot}</p>
                    <p className="mt-1.5 text-[20px] font-semibold leading-none tnum"
                       style={{ color: cor ?? 'var(--color-ink)' }}>{val}</p>
                    {nota && <p className="mt-1.5 text-[9.5px] leading-snug text-faint">{nota}</p>}
                  </div>
                ))}
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {destacadas.map(([rot, val, cor, nota]) => (
                  <div key={rot}
                       className="rounded-xl border border-accent/25 bg-accent/[.07] p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-accent/80">{rot}</p>
                    <p className="mt-1.5 text-[20px] font-semibold leading-none tnum"
                       style={{ color: cor ?? 'var(--color-ink)' }}>{val}</p>
                    {nota && <p className="mt-1.5 text-[9.5px] leading-snug text-muted">{nota}</p>}
                  </div>
                ))}
              </div>

              {c.quartis.some(q => q > 0) && (
                <div className="mt-4 rounded-xl border border-line bg-panel p-4">
                  <p className="mb-3 text-[10px] uppercase tracking-wider text-faint">
                    Retenção do anúncio no feed
                  </p>
                  <div className="flex items-end gap-2">
                    {([['3s', c.views_3s], ['25%', c.quartis[0]], ['50%', c.quartis[1]],
                       ['75%', c.quartis[2]], ['100%', c.quartis[3]]] as const).map(([rot, v]) => (
                      <div key={rot} className="flex-1 text-center">
                        <div className="flex h-16 w-full items-end">
                          <div className="w-full rounded-t-md bg-accent/55"
                               style={{ height: `${Math.max(2, c.views_3s ? (v / c.views_3s) * 100 : 0)}%` }} />
                        </div>
                        <p className="mt-1.5 text-[10px] text-faint">{rot}</p>
                        <p className="text-[10.5px] tnum text-muted">{compacto(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5">
              {morte ? (
                <>
                  <p className="mb-4 text-[12px] leading-relaxed text-muted">
                    O que aconteceu com quem clicou neste anúncio —{' '}
                    <span className="tnum text-ink">{morte.base}</span> sessões em{' '}
                    <span className="font-mono text-ink">{morte.pagina}</span>.
                  </p>
                  <div className="space-y-1.5">
                    {morte.etapas.map((e, i) => (
                      <div key={e.step} className="flex items-center gap-3">
                        <span className="w-4 text-[10.5px] tnum text-faint">{i + 1}</span>
                        <span className="w-32 shrink-0 truncate text-[12px] text-ink">{e.step}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-accent/70" style={{ width: `${e.reach}%` }} />
                        </div>
                        <span className="w-12 text-right text-[11.5px] tnum text-muted">
                          {e.reach.toFixed(0)}%
                        </span>
                        <span className="w-14 text-right text-[11.5px] font-semibold tnum"
                              style={{ color: e.step === morte.pior?.step ? 'var(--color-danger)' : 'var(--color-faint)' }}>
                          {e.drop === null ? '—' : `−${e.drop.toFixed(0)}%`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {morte.pior && (
                    <p className="mt-4 border-l-2 border-accent pl-3 text-[12.5px] leading-relaxed text-ink">
                      {c.hook != null && c.hook < 20
                        ? <>Hook de {pct(c.hook)} — o criativo nem chega a ser assistido. Arrume o
                           gancho antes de mexer na página: hoje quase ninguém passa do primeiro
                           segundo, e nenhuma mudança em <span className="font-mono">{morte.pior.step}</span> resolveria isso.</>
                        : <>O gancho segura ({pct(c.hook)} de hook), mas o tráfego morre em{' '}
                           <span className="font-mono">{morte.pior.step}</span>, perdendo{' '}
                           <span className="text-danger">{morte.pior.drop?.toFixed(1).replace('.', ',')}%</span>.
                           O problema está depois do clique.</>}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-faint">
                  Ainda não há sessões deste anúncio numa página com blocos marcados. Assim que
                  houver, esta aba mostra em qual bloco o tráfego dele morre.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
