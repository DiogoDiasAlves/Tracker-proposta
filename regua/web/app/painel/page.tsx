import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ativos, facetas, leitura, siteKey, chavesDuplicadas } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { PillFiltro } from '@/components/ui/pill-filtro';
import { SeletorAtivo } from '@/components/ui/seletor-ativo';
import { VistaRetencao } from '@/components/painel/vista-retencao';
import { IconArrowUpRight, IconPlug } from '@/components/icons';

type Busca = Promise<{ pagina?: string; versao?: string; disp?: string }>;

const nf = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

export default async function Painel({ searchParams }: { searchParams: Busca }) {
  const sp = await searchParams;
  const { conta } = await exigirConta();
  const lista = await ativos(conta.id);
  const comDados = lista.filter(a => a.sessions > 0);

  if (!comDados.length) return <VazioInicial chave={await siteKey(conta.id)} />;

  /* Padrão: o maior ativo QUE ESTA TELA SABE MOSTRAR.

     A lista já vem ordenada por volume, mas o maior pode ser um VSL puro —
     que não tem bloco e é redirecionado para a tela de vídeo. Como padrão
     isso faria "Painel" levar a "Vídeos", e navegação que não leva aonde a
     pessoa clicou é pior que abrir num ativo menor.

     O redirecionamento continua valendo quando a escolha é EXPLÍCITA, pelo
     seletor ou pela URL — aí a pessoa pediu aquele ativo, e levá-la à tela
     que sabe lê-lo é ajudar, não desviar. */
  const padrao = (comDados.find(a => a.kind !== 'vsl') ?? comDados[0]).key;
  // valida contra a lista da conta: chave inventada na URL cai no padrão em
  // vez de mostrar tela vazia como se não houvesse dado
  const alvo = comDados.some(a => a.key === sp.pagina) ? sp.pagina! : padrao;
  const f = await facetas(conta.id, alvo);

  // Abre no recorte com mais tráfego, não no primeiro em ordem alfabética.
  // Ordenar por nome abriria em "desktop" com amostra insuficiente enquanto
  // "mobile" tem quatro vezes mais sessões — e a primeira tela que a pessoa
  // vê seria um aviso de ruído.
  const maior = f.counts.reduce((a, b) => (b.n > a.n ? b : a), f.counts[0]);
  const versao = sp.versao && f.versions.includes(sp.versao) ? sp.versao : maior?.version ?? '1';
  const disp = sp.disp && f.devices.includes(sp.disp) ? sp.disp : maior?.device ?? 'mobile';

  const dados = await leitura(conta.id, alvo, versao, disp);

  /* Vídeo solto não gera etapa: a página dele não tem bloco marcado, só o
     player. Cair no estado de "nenhum dado ainda" seria mentira — o dado
     existe, só não é de funil por bloco. Manda para a tela que sabe lê-lo. */
  if (!dados || !dados.steps.length) {
    const escolhido = comDados.find(a => a.key === alvo);
    if (escolhido?.kind === 'vsl') redirect(`/painel/videos?pagina=${encodeURIComponent(alvo)}`);
    if (escolhido?.kind === 'quiz') redirect(`/painel/quiz?pagina=${encodeURIComponent(alvo)}`);
    return <VazioInicial chave={await siteKey(conta.id)} />;
  }

  const pior = dados.steps.find(s => s.step === dados.worst);
  const duplicadas = await chavesDuplicadas(conta.id);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[12px] text-faint">
            Em coleta há {dados.days} dia{dados.days > 1 ? 's' : ''}
            <span className="chip">{comDados.length} {comDados.length === 1 ? 'oferta' : 'ofertas'}</span>
          </p>
          <h1 className="text-[34px] font-bold leading-none tracking-tight">
            Onde o funil está sangrando
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">
            {dados.steps.length} {dados.kind === 'quiz' ? 'perguntas' : 'blocos'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-faint">Oferta</span>
            <SeletorAtivo
              atual={alvo}
              itens={comDados.map(a => ({ key: a.key, kind: a.kind, sessions: a.sessions }))}
            />
          </div>
          <PillFiltro param="versao" rotulo="Versão" valor={versao}
                      opcoes={f.versions.map(v => ({ valor: v, texto: `v${v}` }))} />
          <PillFiltro param="disp" rotulo="Dispositivo" valor={disp}
                      opcoes={f.devices.map(d => ({ valor: d, texto: d }))} />
        </div>
      </header>

      {duplicadas.length > 0 && (
        <div className="rounded-xl border border-warn/25 bg-warn/[.06] px-4 py-3.5 text-[12.5px] leading-relaxed text-warn">
          <strong className="font-semibold">Duas chaves quase iguais estão coletando separado.</strong>{' '}
          {duplicadas.map(g => (
            <span key={g[0].key}>
              {g.map(x => `${x.key} (${x.sessions})`).join(' e ')}
              {' '}parecem a mesma página escrita de dois jeitos.{' '}
            </span>
          ))}
          <span className="text-ink">data-page diferencia maiúscula de minúscula</span> — confira o
          script das duas. Enquanto forem chaves diferentes, cada uma tem metade do volume, e
          nenhum aviso de amostra vai disparar porque cada metade parece uma página inteira.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat rotulo="Sessões" valor={dados.sessions.toLocaleString('pt-BR')}
              nota={dados.enough ? 'amostra suficiente' : `abaixo de ${dados.min_sample}`}
              alerta={!dados.enough} />
        <Stat rotulo="Conversão" valor={`${nf(dados.conversion, 2)}%`} nota={dados.kind === 'quiz' ? 'do quiz inteiro' : 'da página inteira'} />
        <Stat rotulo="Maior gargalo" valor={pior ? `${nf(pior.drop ?? 0)}%` : '—'}
              nota={dados.worst ?? 'sem gargalo'} destaque />

        {/* Painel de destaque, no lugar do card roxo da referência */}
        <div className="panel-accent flex flex-col justify-between p-5">
          <div className="relative z-10">
            <span className="chip !border-accent/25 !bg-accent/10 !text-accent">Próximo passo</span>
            <h3 className="mt-3 text-[19px] font-semibold leading-tight">
              {pior ? `Investigue "${pior.step}"` : 'Rode mais tráfego'}
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {pior
                ? `${nf(pior.drop ?? 0)}% dos leads somem nessa transição. Mexa só nele e suba como versão nova.`
                : 'Ainda não há queda destacada o suficiente para apontar um culpado.'}
            </p>
          </div>
          <Link href={`/painel/paginas/${encodeURIComponent(alvo)}?versao=${versao}&disp=${disp}`}
                className="relative z-10 mt-4 flex items-center justify-between rounded-xl border border-accent/25 bg-accent/10 px-3.5 py-2.5 text-[12.5px] text-accent transition hover:bg-accent/20">
            {f.versions.length > 1 ? 'Comparar versões' : 'Abrir a página'}
            <IconArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <VistaRetencao leitura={dados} />
    </div>
  );
}

function Stat({ rotulo, valor, nota, destaque, alerta }: {
  rotulo: string; valor: string; nota: string; destaque?: boolean; alerta?: boolean;
}) {
  return (
    <div className={`card p-5 ${destaque ? 'glow-accent' : ''}`}>
      <p className="text-[11px] uppercase tracking-wider text-faint">{rotulo}</p>
      <p className={`mt-2.5 text-[34px] font-semibold leading-none tnum ${destaque ? 'text-accent text-glow' : 'text-ink'}`}>
        {valor}
      </p>
      <p className={`mt-2 text-[11.5px] ${alerta ? 'text-danger' : 'text-muted'}`}>{nota}</p>
    </div>
  );
}

function VazioInicial({ chave }: { chave?: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8">
        <span className="chip">Nenhum dado ainda</span>
        <h1 className="mt-4 text-[26px] font-bold tracking-tight">
          O painel liga sozinho na primeira sessão
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Não há cadastro de oferta a fazer. Nomeie as seções, cole o script, e a página
          aparece aqui assim que o primeiro visitante carregar.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-bg p-4 font-mono text-[12px] leading-relaxed text-muted">
{`<section `}<span className="text-accent">data-block</span>{`="hero"> ... </section>
<section `}<span className="text-accent">data-block</span>{`="oferta">
  <button `}<span className="text-accent">data-cta</span>{`="checkout">Comprar</button>
</section>

<script src="https://SEU-HOST/r.js"
        `}<span className="text-accent">data-key</span>{`="${chave ?? 'SUA_CHAVE'}"
        `}<span className="text-accent">data-page</span>{`="oferta-x" defer></script>`}
        </pre>
        <Link href="/painel/instalar" className="btn-accent mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-[13px]">
          <IconPlug className="h-4 w-4" /> Ver instruções completas
        </Link>
      </div>
    </div>
  );
}
