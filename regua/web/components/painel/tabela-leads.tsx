'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { IconSearch, IconDots } from '../icons';
import type { LeadsQuiz } from '@/lib/dados';

/* Respostas por lead — linhas são pessoas, colunas são etapas.
   É a organização que as ferramentas de quiz do mercado usam, e ela responde
   uma pergunta que o agregado não responde: o agregado diz ONDE o funil
   perde; esta tabela deixa olhar QUEM passou por lá e o que respondeu.

   Só chave de opção aparece — nunca texto digitado. A tabela herda a garantia
   do coletor porque o banco não tem onde guardar o resto. */

const ESTADO: Record<string, { texto: string; cor: string }> = {
  convertido: { texto: 'convertido', cor: 'var(--color-accent)' },
  lead: { texto: 'lead', cor: 'var(--color-accent-soft)' },
  completo: { texto: 'completou', cor: 'var(--color-muted)' },
  parcial: { texto: 'abandonou', cor: 'var(--color-danger)' },
};

function estadoDe(l: LeadsQuiz['linhas'][number]) {
  if (l.convertido) return 'convertido';
  if (l.lead) return 'lead';
  if (l.completo) return 'completo';
  return 'parcial';
}

export function TabelaLeads({ dados }: { dados: LeadsQuiz }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [busca, setBusca] = useState(sp.get('q') ?? '');

  function navegar(mudancas: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null || v === '') q.delete(k); else q.set(k, v);
    }
    router.replace(`${path}?${q.toString()}`, { scroll: false });
  }

  const { pagina, paginas, total, etapas, linhas } = dados;
  const inicio = (pagina - 1) * dados.porPagina + 1;
  const fim = Math.min(total, pagina * dados.porPagina);

  // janela de páginas em volta da atual, com primeira e última sempre visíveis
  const janela: (number | '…')[] = [];
  for (let p = 1; p <= paginas; p++) {
    if (p === 1 || p === paginas || Math.abs(p - pagina) <= 2) janela.push(p);
    else if (janela[janela.length - 1] !== '…') janela.push('…');
  }

  return (
    <section className="card overflow-hidden">
      <form
        onSubmit={e => { e.preventDefault(); navegar({ q: busca, pag: null }); }}
        className="flex items-center gap-3 border-b border-line px-4 py-3"
      >
        <IconSearch className="h-[17px] w-[17px] shrink-0 text-faint" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por resposta ou pergunta…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
        {sp.get('q') && (
          <button type="button" onClick={() => { setBusca(''); navegar({ q: null, pag: null }); }}
                  className="text-[11.5px] text-faint hover:text-muted">limpar</button>
        )}
        <span className="shrink-0 text-[11.5px] tnum text-faint">
          {total.toLocaleString('pt-BR')} {total === 1 ? 'lead' : 'leads'}
        </span>
        <IconDots className="h-[17px] w-[17px] shrink-0 text-faint" />
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left align-top">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Lead</span>
                <span className="mt-0.5 block font-mono text-[10px] font-normal text-faint">origem</span>
              </th>
              {etapas.map(e => (
                <th key={e.chave} className="min-w-[150px] px-4 py-3 text-left align-top">
                  {/* barra de cor à esquerda do rótulo, como na referência */}
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-[3px] rounded-full bg-accent/70" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink">
                      Etapa {e.numero}
                    </span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-faint">
                    {e.chave}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left align-top">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">Status</span>
                <span className="mt-0.5 block font-mono text-[10px] font-normal text-faint">resultado</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {linhas.map(l => {
              const est = ESTADO[estadoDe(l)];
              return (
                <tr key={l.sid} className="border-b border-line-soft transition hover:bg-surface-2/50">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                    <span className="block font-mono text-[11.5px] text-muted">{l.sid.slice(-8)}</span>
                    <span className="block text-[10.5px] text-faint">{l.origem}</span>
                  </td>

                  {etapas.map(e => {
                    const resposta = l.respostas[e.chave];
                    const clicou = l.cliques.includes(e.chave);
                    const viu = l.vistos.includes(e.chave);
                    return (
                      <td key={e.chave} className="px-4 py-2.5">
                        {resposta ? (
                          <span className="text-ink">{resposta}</span>
                        ) : clicou ? (
                          <span className="text-accent">clicou</span>
                        ) : viu ? (
                          <span className="text-faint">visto</span>
                        ) : (
                          <span className="text-line">—</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-4 py-2.5">
                    <span className="text-[11.5px]" style={{ color: est.cor }}>{est.texto}</span>
                  </td>
                </tr>
              );
            })}

            {!linhas.length && (
              <tr>
                <td colSpan={etapas.length + 2} className="px-4 py-8 text-center text-[12.5px] text-faint">
                  Nenhum lead com essa resposta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <span className="text-[11.5px] tnum text-faint">
          {inicio}–{fim} de {total.toLocaleString('pt-BR')}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            disabled={pagina <= 1}
            onClick={() => navegar({ pag: String(pagina - 1) })}
            className="btn-ghost px-3 py-1.5 text-[12px] disabled:opacity-35"
          >
            Anterior
          </button>
          {janela.map((p, i) =>
            p === '…' ? (
              <span key={`s${i}`} className="px-1.5 text-[12px] text-faint">…</span>
            ) : (
              <button
                key={p}
                onClick={() => navegar({ pag: String(p) })}
                aria-current={p === pagina ? 'page' : undefined}
                className={`min-w-[32px] rounded-lg px-2 py-1.5 text-[12px] tnum transition ${
                  p === pagina
                    ? 'bg-accent font-semibold text-[#04241A]'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            disabled={pagina >= paginas}
            onClick={() => navegar({ pag: String(pagina + 1) })}
            className="btn-ghost px-3 py-1.5 text-[12px] disabled:opacity-35"
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
