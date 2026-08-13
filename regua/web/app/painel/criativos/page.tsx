import Link from 'next/link';
import { exigirConta } from '@/lib/sessao';
import { db } from '@/lib/dados';
import {
  metaConfigurado, metaConexao, metaCriativos, metaOndeMorre, metaContas,
} from '@/lib/meta';
import { Cabecalho, AindaSemColeta, Codigo } from '@/components/ui/estados';
import { IconMegaphone, IconArrowUpRight } from '@/components/icons';

export const metadata = { title: 'Criativos — Régua' };

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
// CPC vive na casa dos centavos: arredondar para real transforma R$ 2,06 em
// "R$ 2" e apaga justamente a diferença entre criativos.
const brlCentavos = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

type Props = { searchParams: Promise<{ ok?: string; erro?: string; escolher?: string; ad?: string }> };

export default async function Criativos({ searchParams }: Props) {
  const sp = await searchParams;
  const { conta } = await exigirConta();
  const conexao = await metaConexao(conta.id);

  // Sessões que já chegaram com id de anúncio. É o pré-requisito real: sem
  // ad_id não há como amarrar gasto de criativo a comportamento na página.
  const { rows: [cobertura] } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE ad_id IS NOT NULL)::int AS com,
            COUNT(*)::int AS total
     FROM sessions WHERE account_id = $1`, [conta.id]
  );

  const criativos = conexao?.adAccountId || cobertura.com > 0
    ? await metaCriativos(conta.id) : [];

  const selecionado = sp.ad && criativos.some(c => c.ad_id === sp.ad)
    ? sp.ad
    : criativos.find(c => c.sessoes > 0)?.ad_id ?? null;
  const morte = selecionado ? await metaOndeMorre(conta.id, selecionado) : null;

  return (
    <div className="space-y-5">
      <Cabecalho
        sobre="Meta Ads"
        titulo="Criativos"
        descricao="A Meta diz qual criativo tem clique barato. A Régua diz onde o tráfego de cada um morre na página. Nenhuma das duas responde isso sozinha."
        acao={<Conexao conexao={conexao} configurado={metaConfigurado()} />}
      />

      {sp.erro && (
        <div className="rounded-xl border border-danger/25 bg-danger/[.07] px-4 py-3 text-[12.5px] text-danger">
          {sp.erro === 'sem-credenciais'
            ? 'Faltam META_APP_ID e META_APP_SECRET no ambiente.'
            : sp.erro === 'estado-invalido'
              ? 'A volta da Meta não conferiu com o pedido que saiu daqui. Tente conectar de novo.'
              : decodeURIComponent(sp.erro)}
        </div>
      )}
      {sp.ok && (
        <div className="rounded-xl border border-accent/25 bg-accent/[.07] px-4 py-3 text-[12.5px] text-accent">
          {sp.ok === 'conectado' ? 'Conta da Meta conectada.'
            : sp.ok === 'desconectado' ? 'Conta desconectada.'
            : `Sincronizado: ${sp.ok.replace('-', ' ')}.`}
        </div>
      )}

      {sp.escolher === '1' && conexao && <EscolherConta conexao={conexao} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao rotulo="Sessões com id de anúncio"
                valor={cobertura.com.toLocaleString('pt-BR')}
                nota={cobertura.total
                  ? `de ${cobertura.total.toLocaleString('pt-BR')} no total`
                  : 'nenhuma sessão ainda'}
                alerta={cobertura.total > 0 && cobertura.com === 0} />
        <Cartao rotulo="Criativos cruzados"
                valor={String(criativos.filter(c => c.sessoes > 0 && c.cliques > 0).length)}
                nota="com gasto e comportamento" />
        <Cartao rotulo="Conta de anúncios"
                valor={conexao?.adAccountId ? '1' : '—'}
                nota={conexao?.adAccountName ?? (conexao ? 'escolha uma conta' : 'não conectada')}
                alerta={!conexao?.adAccountId} />
      </div>

      {cobertura.total > 0 && cobertura.com === 0 && (
        <div className="rounded-xl border border-warn/25 bg-warn/[.06] p-5 text-[12.5px] leading-relaxed text-warn">
          <strong className="font-semibold">Nenhuma sessão chegou com id de anúncio.</strong> Sem
          isso a Régua vê o tráfego mas não sabe de qual criativo veio, e a junção não tem em
          que se apoiar. Cole isto em Parâmetros de URL, no nível de anúncio do Gerenciador:
          <div className="mt-3">
            <Codigo>{`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}`}</Codigo>
          </div>
        </div>
      )}

      {criativos.length > 0 ? (
        <>
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[13px] uppercase tracking-wider text-muted">Custo por resultado real</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                CPC é o que a Meta cobra. CPA real é o gasto dividido pela conversão que a
                Régua mediu na página — e é o único dos dois que sabe se a pessoa chegou na oferta.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-line">
                    {['Criativo', 'Gasto', 'Cliques', 'Sessões', 'Aproveit.', 'Conversões', 'CPC', 'CPA real']
                      .map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-[9.5px] font-normal uppercase tracking-wider text-faint ${i ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {criativos.map(c => {
                    const melhorCpa = Math.min(...criativos.filter(x => x.cpa).map(x => x.cpa!));
                    const piorCpa = Math.max(...criativos.filter(x => x.cpa).map(x => x.cpa!));
                    const cor = c.cpa === melhorCpa ? 'var(--color-accent)'
                              : c.cpa === piorCpa ? 'var(--color-danger)' : 'var(--color-ink)';
                    return (
                      <tr key={c.ad_id}
                          className={`border-b border-line-soft transition ${
                            c.ad_id === selecionado ? 'bg-surface-2' : 'hover:bg-surface-2/50'}`}>
                        <td className="px-4 py-2.5">
                          <Link href={`/painel/criativos?ad=${c.ad_id}`} className="block">
                            <span className="block text-ink">{c.nome}</span>
                            <span className="block font-mono text-[10.5px] text-faint">
                              {c.ad_id}{c.campanha ? ` · ${c.campanha}` : ''}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tnum">{brl(c.gasto)}</td>
                        <td className="px-4 py-2.5 text-right tnum text-muted">{c.cliques.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2.5 text-right tnum">{c.sessoes.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2.5 text-right tnum text-muted">
                          {c.aproveitamento == null ? '—' : `${nf(c.aproveitamento, 0)}%`}
                        </td>
                        <td className="px-4 py-2.5 text-right tnum">{c.conversoes}</td>
                        <td className="px-4 py-2.5 text-right tnum text-muted">
                          {c.cpc == null ? '—' : brlCentavos(c.cpc)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tnum" style={{ color: cor }}>
                          {c.cpa == null ? '—' : brl(c.cpa)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="border-t border-line px-5 py-4 text-[11.5px] leading-relaxed text-faint">
              Aproveitamento é quanto do clique pago virou carregamento medido. Nunca dá 100%:
              a Meta conta clique, a Régua conta página carregada, e bloqueador come parte. Muito
              abaixo de 80% costuma ser página lenta — gente que clica e desiste antes de abrir.
            </p>
          </section>

          {morte && (
            <section className="card overflow-hidden">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-[13px] uppercase tracking-wider text-muted">
                  Onde o tráfego deste criativo morre
                </h2>
                <p className="mt-1 text-[11.5px] text-faint">
                  <span className="font-mono text-muted">
                    {criativos.find(c => c.ad_id === selecionado)?.nome}
                  </span>{' '}
                  · {morte.base} sessões em <span className="font-mono">{morte.pagina}</span>
                </p>
              </div>

              <div className="divide-y divide-line-soft">
                {morte.etapas.map((e, i) => (
                  <div key={e.step} className="flex items-center gap-4 px-5 py-2.5">
                    <span className="w-5 text-[11px] tnum text-faint">{i + 1}</span>
                    <span className="w-40 shrink-0 truncate text-[12.5px] text-ink">{e.step}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent/70" style={{ width: `${e.reach}%` }} />
                    </div>
                    <span className="w-14 text-right text-[12px] tnum text-muted">{nf(e.reach, 0)}%</span>
                    <span className="w-16 text-right text-[12px] font-semibold tnum"
                          style={{ color: e.step === morte.pior?.step ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                      {e.drop === null ? '—' : `−${nf(e.drop, 0)}%`}
                    </span>
                  </div>
                ))}
              </div>

              {morte.pior && (
                <p className="border-t border-line px-5 py-4 text-[12.5px] leading-relaxed text-muted">
                  O tráfego deste criativo morre em{' '}
                  <span className="text-ink">{morte.pior.step}</span>, perdendo{' '}
                  <span className="text-danger">{nf(morte.pior.drop ?? 0)}%</span>. É esta a
                  resposta que nem a Meta nem o player têm: as duas param no clique.
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <AindaSemColeta
          titulo="Faltam duas coisas, e uma delas é fila externa"
          porque="A junção depende de o id do anúncio chegar na URL e de a conta de anúncios estar conectada. A segunda passa por revisão da Meta, que leva semanas e não depende de código."
          passos={[
            { titulo: 'Parâmetros de URL', texto: <>No nível de anúncio, inclua <span className="font-mono">utm_content={'{{ad.id}}'}</span>.</> },
            { titulo: 'App e verificação', texto: 'App no Meta for Developers e Verificação de Negócio com CNPJ. De uma a duas semanas.' },
            { titulo: 'App Review de ads_read', texto: 'Justificativa por permissão e gravação de tela. De três a sete dias úteis.' },
          ]}
          exemplo={`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}`}
          aviso={<><strong className="font-semibold">Comece a fila da Meta antes do código.</strong> É o único item cujo prazo não depende de nós — o resto da integração fica pronto esperando.</>}
        />
      )}
    </div>
  );
}

function Conexao({ conexao, configurado }: {
  conexao: Awaited<ReturnType<typeof metaConexao>>; configurado: boolean;
}) {
  if (!configurado) {
    return (
      <span className="chip !border-warn/30 !bg-warn/10 !text-warn">
        falta META_APP_ID no ambiente
      </span>
    );
  }
  if (!conexao) {
    return (
      <Link href="/api/meta/conectar" className="btn-accent flex items-center gap-2 px-4 py-2.5 text-[13px]">
        <IconMegaphone className="h-4 w-4" />
        Conectar conta da Meta
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {conexao.ultimoErro && (
        <span className="chip !border-danger/30 !bg-danger/10 !text-danger" title={conexao.ultimoErro}>
          erro na última sincronização
        </span>
      )}
      <span className="chip">
        {conexao.sincronizadoEm
          ? `sincronizado ${new Date(conexao.sincronizadoEm).toLocaleDateString('pt-BR')}`
          : 'nunca sincronizado'}
      </span>
      <form action="/api/meta/sincronizar" method="post">
        <button className="btn-ghost px-3.5 py-2.5 text-[12.5px]">Sincronizar agora</button>
      </form>
      <form action="/api/meta/desconectar" method="post">
        <button className="btn-ghost px-3.5 py-2.5 text-[12.5px] text-muted">Desconectar</button>
      </form>
    </div>
  );
}

async function EscolherConta({ conexao }: { conexao: NonNullable<Awaited<ReturnType<typeof metaConexao>>> }) {
  let contas: { id: string; nome: string; moeda: string; ativa: boolean }[] = [];
  try { contas = await metaContas(conexao.token()); } catch { /* mostra vazio abaixo */ }

  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-semibold">Escolha a conta de anúncios</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        A Régua vai puxar gasto e cliques desta conta, uma vez por dia.
      </p>
      <div className="mt-4 space-y-2">
        {contas.map(a => (
          <form key={a.id} action="/api/meta/conta" method="post"
                className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
            <input type="hidden" name="ad_account_id" value={a.id} />
            <input type="hidden" name="nome" value={a.nome} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-ink">{a.nome}</span>
              <span className="block font-mono text-[11px] text-faint">{a.id} · {a.moeda}</span>
            </span>
            {!a.ativa && <span className="chip !text-warn">inativa</span>}
            <button className="btn-accent flex items-center gap-1.5 px-3.5 py-2 text-[12.5px]">
              Usar <IconArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </form>
        ))}
        {!contas.length && (
          <p className="text-[12.5px] text-faint">
            Nenhuma conta de anúncios retornada. Confira se o usuário autorizado tem acesso a
            alguma conta no Gerenciador de Negócios.
          </p>
        )}
      </div>
    </section>
  );
}

function Cartao({ rotulo, valor, nota, alerta }: {
  rotulo: string; valor: string; nota: string; alerta?: boolean;
}) {
  return (
    <div className="card p-5">
      <p className="text-[11px] uppercase tracking-wider text-faint">{rotulo}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tnum">{valor}</p>
      <p className={`mt-2 text-[11.5px] ${alerta ? 'text-warn' : 'text-muted'}`}>{nota}</p>
    </div>
  );
}
