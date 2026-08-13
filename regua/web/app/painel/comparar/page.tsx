import Link from 'next/link';
import { contaAtual, ativos, resumo } from '@/lib/dados';
import { vereditoTeste } from '@regua/metrics/teste';
import { Cabecalho } from '@/components/ui/estados';
import { PillFiltro } from '@/components/ui/pill-filtro';

export const metadata = { title: 'Comparar — Régua' };

const pct = (v: number, d = 2) => `${v.toFixed(d).replace('.', ',')}%`;

type Props = { searchParams: Promise<{ a?: string; b?: string; modo?: string }> };

export default async function Comparar({ searchParams }: Props) {
  const sp = await searchParams;
  const conta = await contaAtual();
  const lista = (await ativos(conta.id)).filter(x => x.sessions > 0);

  if (lista.length < 2) {
    return (
      <div className="max-w-3xl space-y-5">
        <Cabecalho sobre="Duas páginas lado a lado" titulo="Comparar" />
        <div className="card p-6">
          <p className="text-[13.5px] leading-relaxed text-muted">
            É preciso ter pelo menos duas páginas em coleta.{' '}
            {lista.length === 1 && <>Hoje há uma: <span className="font-mono text-ink">{lista[0].key}</span>.</>}
          </p>
          <Link href="/painel/instalar" className="btn-accent mt-4 inline-flex px-4 py-2.5 text-[13px]">
            Instalar em outra página
          </Link>
        </div>
      </div>
    );
  }

  const chaveA = sp.a && lista.some(x => x.key === sp.a) ? sp.a : lista[0].key;
  const chaveB = sp.b && lista.some(x => x.key === sp.b) && sp.b !== chaveA
    ? sp.b
    : (lista.find(x => x.key !== chaveA)?.key ?? lista[1].key);

  const [A, B] = await Promise.all([resumo(conta.id, chaveA), resumo(conta.id, chaveB)]);
  if (!A || !B) return null;

  // Sem sorteio simultâneo não há teste. O padrão é observacional porque é a
  // verdade da maioria dos casos — e prometer vencedor onde não há
  // randomização é o erro que este produto existe para não cometer.
  const randomizado = sp.modo === 'split';

  const v = vereditoTeste({
    nomeA: A.key, convA: A.conversoes, nA: A.sessoes,
    nomeB: B.key, convB: B.conversoes, nB: B.sessoes,
    randomizado,
  });

  const linhas = [
    ['Sessões', A.sessoes.toLocaleString('pt-BR'), B.sessoes.toLocaleString('pt-BR'), A.sessoes, B.sessoes],
    ['Conversão', pct(A.conversao), pct(B.conversao), A.conversao, B.conversao],
    ['Conversões', String(A.conversoes), String(B.conversoes), A.conversoes, B.conversoes],
    ['Sessões com clique em CTA', pct(A.ctr, 1), pct(B.ctr, 1), A.ctr, B.ctr],
    ['Profundidade média', pct(A.profundidade, 0), pct(B.profundidade, 0), A.profundidade, B.profundidade],
    ['Tempo mediano', `${A.tempo_med_s.toFixed(0)}s`, `${B.tempo_med_s.toFixed(0)}s`, A.tempo_med_s, B.tempo_med_s],
  ] as const;

  return (
    <div className="max-w-5xl space-y-5">
      <Cabecalho
        sobre="Duas páginas lado a lado"
        titulo="Comparar"
        descricao="Páginas diferentes não têm blocos em comum, então a comparação é de resultado: quem converte mais, quem prende mais, quem leva mais gente ao CTA."
      />

      <div className="flex flex-wrap items-center gap-3">
        <PillFiltro param="a" rotulo="A" valor={chaveA}
                    opcoes={lista.map(x => ({ valor: x.key, texto: x.key }))} />
        <PillFiltro param="b" rotulo="B" valor={chaveB}
                    opcoes={lista.filter(x => x.key !== chaveA).map(x => ({ valor: x.key, texto: x.key }))} />
        <PillFiltro param="modo" rotulo="Tráfego" valor={randomizado ? 'split' : 'obs'}
                    opcoes={[{ valor: 'obs', texto: 'observacional' }, { valor: 'split', texto: 'split simultâneo' }]} />
      </div>

      {/* O visor. É a tela inteira do recurso — o resto é evidência. */}
      <section className={`card overflow-hidden ${v.decidido ? 'glow-accent' : ''}`}>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="text-[24px] font-bold tracking-tight"
              style={{ color: v.decidido ? 'var(--color-accent)' : 'var(--color-warn)' }}
            >
              {v.titulo}
            </span>
            {!randomizado && (
              <span className="chip !border-warn/30 !bg-warn/10 !text-warn">sem randomização</span>
            )}
          </div>

          <p className="mt-3 max-w-[76ch] text-[13px] leading-relaxed text-muted">{v.texto}</p>
          {v.acao && (
            <p className="mt-3 max-w-[76ch] border-l-2 border-accent pl-3 text-[12.5px] leading-relaxed text-ink">
              {v.acao}
            </p>
          )}

          {randomizado && v.pB !== null && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px] text-faint">
                <span>{A.key}</span>
                <span>probabilidade de cada uma ser a melhor</span>
                <span>{B.key}</span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div className="absolute inset-y-0 left-0 bg-mark-base"
                     style={{ width: `${(1 - v.pB) * 100}%` }} />
                <div className="absolute inset-y-0 right-0 bg-accent"
                     style={{ width: `${v.pB * 100}%` }} />
                {/* limiar de decisão, visível: o número sozinho não diz onde é "o suficiente" */}
                <div className="absolute inset-y-0 w-px bg-ink/40" style={{ left: '95%' }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] tnum text-muted">
                <span>{((1 - v.pB) * 100).toFixed(0)}%</span>
                <span className="text-faint">decide a partir de 95%</span>
                <span className="text-accent">{(v.pB * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>

        <table className="w-full border-collapse border-t border-line text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-6 py-3 text-left text-[9.5px] font-normal uppercase tracking-wider text-faint">Métrica</th>
              <th className="px-6 py-3 text-right text-[11px] font-normal"><span className="font-mono text-muted">{A.key}</span></th>
              <th className="px-6 py-3 text-right text-[11px] font-normal"><span className="font-mono text-accent">{B.key}</span></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(([rotulo, va, vb, na, nb]) => {
              const melhorB = nb > na, empate = nb === na;
              return (
                <tr key={rotulo} className="border-b border-line-soft">
                  <td className="px-6 py-3 text-muted">{rotulo}</td>
                  <td className={`px-6 py-3 text-right tnum ${!melhorB && !empate ? 'text-ink' : 'text-muted'}`}>{va}</td>
                  <td className={`px-6 py-3 text-right tnum ${melhorB ? 'text-accent' : 'text-muted'}`}>{vb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="border-t border-line px-6 py-4 text-[11.5px] leading-relaxed text-faint">
          Comparação bloco a bloco fica desabilitada entre páginas diferentes — os blocos não
          são os mesmos, e comparar o terceiro de uma com o terceiro da outra não significa
          nada. Para comparar versões da MESMA página, abra a página e use o seletor de versão.
        </p>
      </section>
    </div>
  );
}
