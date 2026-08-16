import Link from 'next/link';
import { ativos, resumo } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { vereditoTeste } from '@regua/metrics/teste';
import { Cabecalho } from '@/components/ui/estados';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { SeletorAtivo } from '@/components/ui/seletor-ativo';
import { IntervaloConversao } from '@/components/graficos/intervalo-conversao';
import { IconLayers, IconVideo, IconQuiz } from '@/components/icons';

export const metadata = { title: 'Comparar — Régua' };

const pct = (v: number, d = 2) => `${v.toFixed(d).replace('.', ',')}%`;
const compacto = (n: number) => n.toLocaleString('pt-BR');
const ICONE_KIND = { page: IconLayers, vsl: IconVideo, quiz: IconQuiz } as const;
const NOME_KIND: Record<string, string> = { page: 'página', vsl: 'vídeo', quiz: 'quiz' };

type Props = { searchParams: Promise<{ a?: string; b?: string; modo?: string }> };

export default async function Comparar({ searchParams }: Props) {
  const sp = await searchParams;
  const { conta } = await exigirConta();
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

  // "Maior é melhor" só vale pra taxa — sessão e conversão são volume bruto,
  // proporcional a quanto tráfego cada uma recebeu. Destacar a "vencedora"
  // aí seria ler investimento de mídia como se fosse qualidade de página.
  const linhas = [
    { rotulo: 'Sessões', va: A.sessoes, vb: B.sessoes, ta: compacto(A.sessoes), tb: compacto(B.sessoes), julga: false },
    { rotulo: 'Conversão', va: A.conversao, vb: B.conversao, ta: pct(A.conversao), tb: pct(B.conversao), julga: true },
    { rotulo: 'Conversões', va: A.conversoes, vb: B.conversoes, ta: compacto(A.conversoes), tb: compacto(B.conversoes), julga: false },
    { rotulo: 'Sessões com clique em CTA', va: A.ctr, vb: B.ctr, ta: pct(A.ctr, 1), tb: pct(B.ctr, 1), julga: true },
    { rotulo: 'Profundidade média', va: A.profundidade, vb: B.profundidade, ta: pct(A.profundidade, 0), tb: pct(B.profundidade, 0), julga: true },
    { rotulo: 'Tempo mediano', va: A.tempo_med_s, vb: B.tempo_med_s, ta: `${A.tempo_med_s.toFixed(0)}s`, tb: `${B.tempo_med_s.toFixed(0)}s`, julga: true },
  ];

  const IconA = ICONE_KIND[A.kind as keyof typeof ICONE_KIND] ?? IconLayers;
  const IconB = ICONE_KIND[B.kind as keyof typeof ICONE_KIND] ?? IconLayers;
  const amostraBaixa = A.sessoes < 100 || B.sessoes < 100;

  return (
    <div className="max-w-5xl space-y-5">
      <Cabecalho
        sobre="Duas páginas lado a lado"
        titulo="Comparar"
        descricao="Páginas diferentes não têm blocos em comum, então a comparação é de resultado: quem converte mais, quem prende mais, quem leva mais gente ao CTA."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Página A</span>
          <SeletorAtivo atual={chaveA} param="a" alinhar="left"
                        itens={lista.map(x => ({ key: x.key, kind: x.kind, sessions: x.sessions }))} />
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Página B</span>
          <SeletorAtivo atual={chaveB} param="b" excluir={chaveA} alinhar="left"
                        itens={lista.map(x => ({ key: x.key, kind: x.kind, sessions: x.sessions }))} />
        </div>
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint">
            Tráfego
          </span>
          <PillFiltro param="modo" valor={randomizado ? 'split' : 'obs'}
                      opcoes={[{ valor: 'obs', texto: 'observacional' }, { valor: 'split', texto: 'split simultâneo' }]} />
        </div>
        <p className="max-w-[42ch] text-[11.5px] leading-relaxed text-faint">
          {randomizado
            ? 'A Régua sorteou quem via cada página — dá pra declarar vencedor.'
            : 'As duas rodaram sem sorteio entre si. Dá pra comparar o resultado, mas não pra dizer que uma "venceu" a outra: a diferença pode ser a página, ou pode ser o público que calhou de cair em cada uma.'}
        </p>
      </div>

      {/* Cabeçalho A vs B — reconhecimento imediato de quem é quem antes de
          ler qualquer número. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
            <IconA className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] text-ink">{A.key}</p>
            <p className="text-[11px] text-faint">
              {NOME_KIND[A.kind] ?? A.kind} · {compacto(A.sessoes)} sessões · {A.dias}{' '}
              {A.dias === 1 ? 'dia' : 'dias'} em coleta
            </p>
          </div>
        </div>
        <span className="text-center text-[11px] font-semibold uppercase tracking-wider text-faint">vs</span>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <IconB className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] text-accent">{B.key}</p>
            <p className="text-[11px] text-faint">
              {NOME_KIND[B.kind] ?? B.kind} · {compacto(B.sessoes)} sessões · {B.dias}{' '}
              {B.dias === 1 ? 'dia' : 'dias'} em coleta
            </p>
          </div>
        </div>
      </div>

      {amostraBaixa && (
        <div className="rounded-xl border border-warn/25 bg-warn/[.06] px-4 py-3 text-[12.5px] leading-relaxed text-warn">
          <strong className="font-semibold">Amostra pequena</strong> — {A.key} tem {compacto(A.sessoes)} e{' '}
          {B.key} tem {compacto(B.sessoes)} sessões. Abaixo de 100 por página, leia como
          tendência inicial, não como resultado fechado.
        </div>
      )}

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

        <div className="border-t border-line p-6">
          <p className="mb-4 text-[11px] uppercase tracking-wider text-faint">
            Conversão, com intervalo de 95% — não só o ponto observado
          </p>
          <IntervaloConversao
            nomeA={A.key} taxaA={v.iA.taxa} baixoA={v.iA.baixo} altoA={v.iA.alto}
            nomeB={B.key} taxaB={v.iB.taxa} baixoB={v.iB.baixo} altoB={v.iB.alto}
          />
        </div>

        <div className="border-t border-line">
          <div className="grid grid-cols-[1fr_auto] gap-4 px-6 py-3 text-[10px] uppercase tracking-wider text-faint">
            <span>Métrica</span>
            <span className="flex items-center gap-4">
              <span className="text-muted">{A.key}</span>
              <span className="text-accent">{B.key}</span>
            </span>
          </div>
          {linhas.map(l => {
            const maxRow = Math.max(l.va, l.vb, 0.0001);
            const venceB = l.julga && l.vb > l.va;
            const venceA = l.julga && l.va > l.vb;
            return (
              <div key={l.rotulo} className="grid grid-cols-[1fr_2fr] items-center gap-4 border-t border-line-soft px-6 py-3.5">
                <span className="text-[12.5px] text-muted">{l.rotulo}</span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-mark-base" style={{ width: `${(l.va / maxRow) * 100}%` }} />
                    </div>
                    <span className={`w-16 shrink-0 text-right text-[12px] tnum ${venceA ? 'font-semibold text-ink' : 'text-muted'}`}>
                      {l.ta}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(l.vb / maxRow) * 100}%` }} />
                    </div>
                    <span className={`w-16 shrink-0 text-right text-[12px] tnum ${venceB ? 'font-semibold text-accent' : 'text-muted'}`}>
                      {l.tb}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="border-t border-line px-6 py-4 text-[11.5px] leading-relaxed text-faint">
          Sessões e conversões são volume bruto — maior aqui reflete quanto tráfego cada
          página recebeu, não qualidade. Só as taxas (conversão, CTR, profundidade, tempo)
          têm a maior destacada. Comparação bloco a bloco fica desabilitada entre páginas
          diferentes — os blocos não são os mesmos. Para comparar versões da MESMA página,
          abra a página e use o seletor de versão.
        </p>
      </section>
    </div>
  );
}
