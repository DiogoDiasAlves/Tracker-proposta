import { ativos, facetas, videos, origensDoAtivo, siteKey, type FiltrosOrigem } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { Cabecalho, AindaSemColeta } from '@/components/ui/estados';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { SeletorAtivo } from '@/components/ui/seletor-ativo';
import { CurvaVideo } from '@/components/graficos/curva-video';
import { CurvaConversaoVideo } from '@/components/graficos/curva-conversao-video';

export const metadata = { title: 'Vídeos — Régua' };

const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');
const compacto = (n: number) => n.toLocaleString('pt-BR');
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

type Props = {
  searchParams: Promise<{
    pagina?: string; versao?: string; disp?: string;
    origem?: string; pais?: string; so?: string; nav?: string;
  }>;
};

export default async function Videos({ searchParams }: Props) {
  const sp = await searchParams;
  const { conta } = await exigirConta();
  const lista = (await ativos(conta.id)).filter(a => a.sessions > 0);

  // Vídeo não é um tipo de página à parte: ele vive DENTRO de uma. Então
  // procuramos em quais assets há reprodução, em vez de filtrar por kind.
  const comVideo: {
    key: string; kind: 'page' | 'vsl' | 'quiz'; sessions: number;
    dados: NonNullable<Awaited<ReturnType<typeof videos>>>; versao: string; disp: string;
  }[] = [];
  for (const a of lista) {
    const f = await facetas(conta.id, a.key);
    if (!f.counts.length) continue;
    const maior = f.counts.reduce((x, y) => (y.n > x.n ? y : x), f.counts[0]);
    const versao = sp.versao && f.versions.includes(sp.versao) ? sp.versao : maior.version;
    const disp = sp.disp && f.devices.includes(sp.disp) ? sp.disp : maior.device;
    const d = await videos(conta.id, a.key, versao, disp);
    if (d && d.videos.length) {
      comVideo.push({ key: a.key, kind: a.kind, sessions: a.sessions, dados: d, versao, disp });
    }
  }

  if (!comVideo.length) {
    return (
      <div className="max-w-5xl space-y-5">
        <Cabecalho sobre="Retenção de vídeo" titulo="Vídeos" />
        <AindaSemColeta
          titulo="Nenhum vídeo detectado ainda"
          porque="O mesmo script da página de vendas mede vídeo — não precisa instalar nada a mais nem marcar nada. Ele procura vídeo na página sozinho e começa a medir quando alguém dá play."
          chave={await siteKey(conta.id)}
          passos={[
            { titulo: 'Nada a marcar', texto: <>O script já instalado acha <span className="font-mono">&lt;video&gt;</span>, YouTube, Vimeo e o player novo da VTurb sem configuração.</> },
            { titulo: 'Marque o pitch', texto: <>Opcional, mas é a métrica que mais importa: <span className="font-mono">data-vsl-pitch</span> com o segundo em que a oferta aparece.</> },
            { titulo: 'Rode tráfego', texto: 'A curva precisa de volume para não ser ruído — o mesmo mínimo de 300 sessões vale aqui.' },
          ]}
          exemplo={`<video src="/vsl.mp4" data-vsl-pitch="612"></video>`}
          aviso={<><strong className="font-semibold">Vídeo em iframe de outro domínio sem API não é mensurável por ninguém de fora</strong> — o navegador proíbe, e não é questão de esforço.</>}
        />
      </div>
    );
  }

  const alvo = comVideo.find(v => v.key === sp.pagina) ?? comVideo[0];
  const f = await facetas(conta.id, alvo.key);
  const opcoesOrigem = await origensDoAtivo(conta.id, alvo.key);

  // Só entra no filtro o que existe de fato — opção fantasma não é filtro,
  // é confusão. Mesma regra que já vale para versão/dispositivo.
  const filtros: FiltrosOrigem = {};
  if (sp.origem && opcoesOrigem.origens.includes(sp.origem)) filtros.origem = sp.origem;
  if (sp.pais && opcoesOrigem.paises.includes(sp.pais)) filtros.pais = sp.pais;
  if (sp.so && opcoesOrigem.sos.includes(sp.so)) filtros.so = sp.so;
  if (sp.nav && opcoesOrigem.navegadores.includes(sp.nav)) filtros.navegador = sp.nav;

  const filtrado = Object.keys(filtros).length
    ? await videos(conta.id, alvo.key, alvo.versao, alvo.disp, filtros)
    : alvo.dados;
  const dados = filtrado ?? alvo.dados;
  const v = dados.videos[0];

  const pillOrigem = (param: string, rotulo: string, opcoesLista: string[], atual?: string) =>
    opcoesLista.length > 1 && (
      <PillFiltro param={param} rotulo={rotulo} valor={atual ?? ''}
                  opcoes={[{ valor: '', texto: 'todos' }, ...opcoesLista.map(x => ({ valor: x, texto: x }))]} />
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[12px] text-faint">
            Retenção de vídeo · <span className="font-mono">{alvo.key}</span>
          </p>
          <h1 className="text-[30px] font-bold leading-none tracking-tight">
            Onde param de assistir
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            {v ? (
              <>
                <span className="font-mono text-ink">{v.video}</span> · {v.tipo} · {mmss(v.duracao)} ·{' '}
                {compacto(v.sessoes_com_play)} sessões com play
              </>
            ) : 'sem sessão para esse filtro'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {comVideo.length > 1 && (
            <div>
              <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Página</span>
              <SeletorAtivo atual={alvo.key} itens={comVideo} />
            </div>
          )}
          <PillFiltro param="versao" rotulo="Versão" valor={alvo.versao}
                      opcoes={f.versions.map(x => ({ valor: x, texto: `v${x}` }))} />
          <PillFiltro param="disp" rotulo="Dispositivo" valor={alvo.disp}
                      opcoes={f.devices.map(x => ({ valor: x, texto: x }))} />
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        {pillOrigem('origem', 'Origem', opcoesOrigem.origens, filtros.origem)}
        {pillOrigem('pais', 'País', opcoesOrigem.paises, filtros.pais)}
        {pillOrigem('so', 'Sistema', opcoesOrigem.sos, filtros.so)}
        {pillOrigem('nav', 'Navegador', opcoesOrigem.navegadores, filtros.navegador)}
      </div>

      {!v ? (
        <div className="rounded-xl border border-warn/25 bg-warn/[.06] px-4 py-3 text-[12.5px] leading-relaxed text-warn">
          Nenhuma sessão bate com essa combinação de filtros. Tente afrouxar um deles.
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat rotulo="Retenção no pitch"
              valor={v.retencao_pitch != null ? `${nf(v.retencao_pitch)}%` : '—'}
              nota={v.pitch != null ? `a oferta entra em ${mmss(v.pitch)}` : 'marque data-vsl-pitch'}
              destaque />
        <Stat rotulo="Assistido mediano" valor={mmss(v.assistido_mediano_s)}
              nota={`${nf(v.assistido_mediano_pct, 0)}% do vídeo`} />
        <Stat rotulo="Engajamento" valor={`${nf(v.engajamento)}%`}
              nota="tempo assistido ÷ (plays × duração)" />
        <Stat rotulo="Play rate" valor={`${nf(v.play_rate, 0)}%`}
              nota={v.autoplay_pct > 50
                ? `${nf(v.autoplay_pct, 0)}% em autoplay — infla o número`
                : 'play deliberado'}
              alerta={v.autoplay_pct > 50} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat rotulo="Plays" valor={compacto(v.plays_total)}
              nota={`${compacto(v.sessoes_com_play)} plays únicos`} />
        <Stat rotulo="Taxa de conversão" valor={`${nf(dados.taxa_conversao)}%`}
              nota={`${compacto(dados.conversoes)} conversão(ões) de ${compacto(dados.sessoes)} sessões`} />
        <Stat rotulo="Cliques no botão" valor={compacto(dados.cliques_botao)}
              nota={`${nf(dados.taxa_clique)}% das sessões clicaram`} />
        <Stat rotulo="Retenção final" valor={`${nf(v.retencao_final)}%`}
              nota={`${nf(v.plays_por_sessao, 1)} plays/sessão · ${nf(v.mudo_pct, 0)}% mudo`} />
      </div>
      {v.sessoes_com_play < 300 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/[.07] px-4 py-3 text-[12.5px] leading-relaxed text-danger">
          <span className="mt-0.5">▲</span>
          <p>
            Apenas {v.sessoes_com_play} sessão(ões) com play. Abaixo de 300 a curva é ruído —
            cada pessoa que sai move a linha {(100 / Math.max(1, v.sessoes_medidas)).toFixed(0)} pontos
            de uma vez. Leia como tendência, não como resultado.
          </p>
        </div>
      )}

      {v.sessoes_parciais > 0 && (
        <div className="rounded-xl border border-warn/25 bg-warn/[.06] px-4 py-3 text-[12.5px] leading-relaxed text-warn">
          {v.sessoes_parciais} sessão(ões) ficaram de fora da curva porque o player não expôs a
          posição do vídeo. Elas contam play, não retenção — somá-las afundaria a curva de um
          vídeo que talvez esteja indo bem.
        </div>
      )}

      <section className="card p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] uppercase tracking-wider text-muted">Curva de retenção</h2>
          <span className="text-[11px] text-faint">% das sessões ainda assistindo em cada segundo</span>
        </div>
        <CurvaVideo curva={v.curva} duracao={v.duracao} pitch={v.pitch}
                    quedaAbrupta={v.queda_abrupta} preview={v.preview} />
      </section>

      {dados.conversoes > 0 && (
        <section className="card p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] uppercase tracking-wider text-muted">Conversão ao longo do vídeo</h2>
            <span className="text-[11px] text-faint">a métrica que mais decide, segundo a VTurb</span>
          </div>
          <CurvaConversaoVideo curva={v.curva} duracao={v.duracao} />
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-3 text-[13px] uppercase tracking-wider text-muted">Leitura</h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-muted">
          {v.queda_abrupta && (
            <p>
              A maior perda acontece entre{' '}
              <span className="text-ink">{mmss(v.queda_abrupta.de)}</span> e{' '}
              <span className="text-ink">{mmss(v.queda_abrupta.ate)}</span>: some{' '}
              <span className="text-danger">{nf(v.queda_abrupta.queda)} pontos</span> em dez
              segundos. É o trecho a reescrever primeiro — o análogo do bloco que trava na página.
            </p>
          )}
          {v.retencao_pitch != null && (
            <p>
              Chegam na oferta <span className="text-accent">{nf(v.retencao_pitch)}%</span>.
              {v.retencao_pitch < 25
                ? ' O problema está antes dela: não adianta mexer no preço se três em cada quatro não chegam a ouvir.'
                : ' Volume razoável chegando na oferta — se a conversão está baixa, o problema é a oferta, não o caminho até ela.'}
            </p>
          )}
          {v.autoplay_pct > 50 && (
            <p className="border-l-2 border-warn pl-3">
              Este vídeo começa sozinho em {nf(v.autoplay_pct, 0)}% das sessões. Play rate alto
              aqui não é sinal de interesse — o número que vale é a retenção nos primeiros
              trinta segundos.
            </p>
          )}
        </div>
      </section>
      </>
      )}
    </div>
  );
}


function Stat({ rotulo, valor, nota, destaque, alerta }: {
  rotulo: string; valor: string; nota: string; destaque?: boolean; alerta?: boolean;
}) {
  return (
    <div className={`card p-5 ${destaque ? 'glow-accent' : ''}`}>
      <p className="text-[11px] uppercase tracking-wider text-faint">{rotulo}</p>
      <p className={`mt-2.5 text-[30px] font-semibold leading-none tnum ${destaque ? 'text-accent text-glow' : 'text-ink'}`}>
        {valor}
      </p>
      <p className={`mt-2 text-[11.5px] leading-snug ${alerta ? 'text-warn' : 'text-muted'}`}>{nota}</p>
    </div>
  );
}
