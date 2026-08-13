import { ativos, facetas, quiz, leitura, siteKey } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { Cabecalho, AindaSemColeta } from '@/components/ui/estados';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { TEXTO, faixaQueda } from '@/lib/faixas';
import { TopoFunil, MetasOtimizacao } from '@/components/painel/metas-quiz';

export const metadata = { title: 'Quiz — Régua' };

const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

type Props = { searchParams: Promise<{ pagina?: string; versao?: string; disp?: string }> };

export default async function Quiz({ searchParams }: Props) {
  const sp = await searchParams;
  const { conta } = await exigirConta();
  const lista = (await ativos(conta.id)).filter(a => a.sessions > 0);

  const comQuiz: { key: string; versao: string; disp: string }[] = [];
  for (const a of lista) {
    const f = await facetas(conta.id, a.key);
    if (!f.counts.length) continue;
    const maior = f.counts.reduce((x, y) => (y.n > x.n ? y : x), f.counts[0]);
    const q = await quiz(conta.id, a.key, maior.version, maior.device);
    if (q && q.perguntas.length) comQuiz.push({ key: a.key, versao: maior.version, disp: maior.device });
  }

  if (!comQuiz.length) {
    return (
      <div className="max-w-5xl space-y-5">
        <Cabecalho sobre="Funil por pergunta" titulo="Quiz" />
        <AindaSemColeta
          titulo="Nenhum quiz em coleta"
          porque="Marque cada pergunta e cada opção, cole o mesmo script, e o funil por pergunta sai igual ao funil por bloco da página de vendas."
          chave={await siteKey(conta.id)}
          passos={[
            { titulo: 'Marque as perguntas', texto: <>Cada tela ganha <span className="font-mono">data-quiz-step</span> e <span className="font-mono">data-quiz-question</span>.</> },
            { titulo: 'Marque as opções', texto: <>Cada alternativa ganha <span className="font-mono">data-quiz-option</span> com uma chave curta.</> },
            { titulo: 'Cole o script', texto: 'O mesmo da página de vendas, com a mesma chave.' },
          ]}
          exemplo={`<div data-quiz-step="1" data-quiz-question="objetivo">\n  <button data-quiz-option="emagrecer">Emagrecer</button>\n</div>`}
          aviso={<><strong className="font-semibold">Resposta de quiz é dado sensível.</strong> Só a chave da opção é gravada, nunca o texto exibido. Campo digitado não é lido — e há teste que falha se qualquer valor digitado chegar ao banco.</>}
        />
      </div>
    );
  }

  const alvo = comQuiz.find(c => c.key === sp.pagina) ?? comQuiz[0];
  const f = await facetas(conta.id, alvo.key);
  const versao = sp.versao && f.versions.includes(sp.versao) ? sp.versao : alvo.versao;
  const disp = sp.disp && f.devices.includes(sp.disp) ? sp.disp : alvo.disp;

  const q = (await quiz(conta.id, alvo.key, versao, disp))!;
  const funil = await leitura(conta.id, alvo.key, versao, disp);
  const gargalo = funil?.steps.find(s => s.step === funil.worst) ?? null;

  const comBase = q.caminhos.filter(c => c.base_suficiente);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[12px] text-faint">
            Funil por pergunta · <span className="font-mono">{alvo.key}</span>
          </p>
          <h1 className="text-[30px] font-bold leading-none tracking-tight">
            Em que pergunta desistem
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            {q.sessoes.toLocaleString('pt-BR')} sessões · {q.perguntas.length} perguntas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {comQuiz.length > 1 && (
            <PillFiltro param="pagina" rotulo="Quiz" valor={alvo.key}
                        opcoes={comQuiz.map(c => ({ valor: c.key, texto: c.key }))} />
          )}
          <PillFiltro param="versao" rotulo="Versão" valor={versao}
                      opcoes={f.versions.map(x => ({ valor: x, texto: `v${x}` }))} />
          <PillFiltro param="disp" rotulo="Dispositivo" valor={disp}
                      opcoes={f.devices.map(x => ({ valor: x, texto: x }))} />
        </div>
      </header>

      <TopoFunil topo={q.topo} />

      <MetasOtimizacao metricas={q.otimizacao} />

      {/* Funil por pergunta — mesma conta dos blocos, porque pergunta é etapa */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">Funil por pergunta</h2>
          <p className="mt-1 text-[11.5px] text-faint">
            Perda acima de {q.teto_perda}% por etapa já é problema em quiz — responder mais uma
            pergunta é trabalho, ao contrário de rolar para o próximo bloco de uma página.
          </p>
        </div>
        <div className="divide-y divide-line-soft">
          {funil?.steps.map((s, i) => {
            const faixa = faixaQueda(s.drop, i === 0);
            return (
              <div key={s.step} className="flex items-center gap-4 px-5 py-3">
                <span className="w-5 text-[11px] tnum text-faint">{i + 1}</span>
                <span className="w-40 shrink-0 truncate text-[13px] text-ink">{s.step}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${s.reach}%` }} />
                </div>
                <span className="w-14 text-right text-[12px] tnum text-muted">{nf(s.reach, 0)}%</span>
                <span className="w-20 text-right text-[12px] font-semibold tnum"
                      style={{ color: s.drop !== null && s.drop > q.teto_perda
                        ? 'var(--color-danger)' : TEXTO[faixa] }}>
                  {s.drop === null ? '—' : `−${nf(s.drop, 1)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* A leitura que a InLead não dá: qual RESPOSTA prevê abandono */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">Respostas</h2>
          <p className="mt-1 text-[11.5px] text-faint">
            Não é só onde abandonam — é qual alternativa afasta e qual antecipa a venda.
          </p>
        </div>
        <div className="divide-y divide-line-soft">
          {q.perguntas.map(p => (
            <div key={p.pergunta} className="px-5 py-4">
              <div className="mb-3 flex items-baseline gap-2">
                <h3 className="text-[13.5px] text-ink">{p.pergunta}</h3>
                {p.ultima && (
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-faint">
                    última — abandono aqui é o fim esperado
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {p.opcoes.map(o => {
                  const preocupa = !p.ultima && o.abandono >= 30;
                  return (
                    <div key={o.opcao} className="flex items-center gap-3 text-[12px]">
                      <span className="w-32 shrink-0 truncate font-mono text-muted">{o.opcao}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-mark-base/70" style={{ width: `${o.participacao}%` }} />
                      </div>
                      <span className="w-12 text-right tnum text-faint">{nf(o.participacao, 0)}%</span>
                      <span className="w-24 text-right tnum"
                            style={{ color: preocupa ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                        {nf(o.abandono, 0)}% saem
                      </span>
                      <span className="w-24 text-right tnum text-accent">
                        {nf(o.conversao, 1)}% convertem
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">Caminhos até a venda</h2>
          <p className="mt-1 text-[11.5px] text-faint">
            Só entram combinações com pelo menos {q.minimo_caminho} sessões.
          </p>
        </div>

        {comBase.length ? (
          <div className="divide-y divide-line-soft">
            {comBase.slice(0, 6).map(c => (
              <div key={c.caminho} className="flex items-center gap-4 px-5 py-3 text-[12.5px]">
                <span className="flex-1 truncate font-mono text-muted">{c.caminho}</span>
                <span className="w-24 text-right tnum text-faint">{c.sessoes} sessões</span>
                <span className="w-16 text-right font-semibold tnum text-accent">{nf(c.conversao)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-5 text-[12.5px] leading-relaxed text-muted">
            Nenhum caminho alcançou {q.minimo_caminho} sessões ainda. Com {q.perguntas.length} perguntas
            o número de combinações cresce rápido, e cada uma fica com poucas sessões.{' '}
            <span className="text-ink">
              O caminho mais frequente hoje tem {q.caminhos[0]?.sessoes ?? 0} sessões
            </span>{' '}
            — abaixo disso, uma venda a mais ou a menos mexe o percentual em dezenas de pontos, e
            você otimizaria ruído.
          </div>
        )}
      </section>
    </div>
  );
}

