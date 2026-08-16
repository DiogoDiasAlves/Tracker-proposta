import Link from 'next/link';
import { usuarioAtual } from '@/lib/sessao';
import { IconLogo, IconArrowUpRight, IconVideo, IconQuiz, IconLayers, IconMegaphone } from '@/components/icons';
import { VistaRetencao } from '@/components/painel/vista-retencao';
import type { Leitura } from '@/lib/dados';

export const metadata = {
  title: 'Régua — a diferença entre saber que a página não converte e saber onde ela trava',
  description: 'A Meta diz qual criativo é barato. A Régua diz onde ele morre na sua página: o bloco, o segundo do vídeo, a pergunta do quiz.',
};

/* Dados de demonstração — a MESMA página real usada na proposta original,
   agora dentro do próprio produto em vez de recriada em SVG solto. É a
   VistaRetencao de verdade (a que roda em /painel/paginas/[chave]), só que
   alimentada com um exemplo em vez de uma conta real. Nunca finja que é
   dado de cliente — por isso o rótulo de demonstração ao lado. */
const DEMO: Leitura = {
  page: 'oferta-relogio-uk', kind: 'page', version: '1', device: 'mobile',
  sessions: 1000, conversion: 1.1, days: 4, enough: true, min_sample: 300,
  median_per100: 1.52, worst: 'oferta',
  steps: [
    { step: 'hero', ord: 0, reached: 1000, reach: 100, drop: 25.8, dwell_s: 8, height: 720, per100: 1.11, entries: 1.1, exit: 24.1, cta_clicks: 31, cta_ctr: 3.1, verdict: 'DOBRA', reading: 'Primeiro bloco. A queda aqui é o filtro natural do tráfego frio e não deve ser comparada com o restante da página.', action: 'Referência: 20% a 35% é normal. Acima disso, o problema costuma estar no criativo do anúncio, não na página.' },
    { step: 'problema', ord: 1, reached: 742, reach: 74.2, drop: 6.9, dwell_s: 14, height: 640, per100: 2.19, entries: 1.2, exit: 6.5, cta_clicks: 0, cta_ctr: 0, verdict: 'FUNCIONA', reading: 'Tempo acima da mediana da página e queda baixa — prende e faz avançar.', action: 'Não mexa. Estude o que faz este bloco funcionar e replique nos outros.' },
    { step: 'prova-social', ord: 2, reached: 690, reach: 69.0, drop: 5.7, dwell_s: 11, height: 880, per100: 1.25, entries: 1.1, exit: 5.2, cta_clicks: 0, cta_ctr: 0, verdict: 'IGNORADO', reading: 'Passou batido e não atrapalhou — tempo abaixo da mediana, queda dentro do normal.', action: 'Candidato a corte ou redução — está diluindo a página sem contribuir.' },
    { step: 'solucao', ord: 3, reached: 651, reach: 65.1, drop: 8.1, dwell_s: 16, height: 700, per100: 2.29, entries: 1.3, exit: 7.6, cta_clicks: 0, cta_ctr: 0, verdict: 'FUNCIONA', reading: 'Tempo alto, queda baixa — segura a atenção e entrega para o próximo bloco.', action: 'Não mexa. Este é um dos blocos que sustentam a página.' },
    { step: 'como-funciona', ord: 4, reached: 598, reach: 59.8, drop: 6.2, dwell_s: 19, height: 960, per100: 1.98, entries: 1.2, exit: 5.8, cta_clicks: 0, cta_ctr: 0, verdict: 'FUNCIONA', reading: 'Tempo acima da mediana, queda controlada.', action: 'Mantenha como está.' },
    { step: 'beneficios', ord: 5, reached: 561, reach: 56.1, drop: 6.95, dwell_s: 3, height: 540, per100: 0.56, entries: 1.0, exit: 6.5, cta_clicks: 0, cta_ctr: 0, verdict: 'IGNORADO', reading: 'Tempo bem abaixo da mediana — ninguém para para ler, e isso não atrapalha o avanço.', action: 'Candidato a corte. Reduzir este bloco encurta a página sem custo de conversão.' },
    { step: 'comparativo', ord: 6, reached: 522, reach: 52.2, drop: 6.9, dwell_s: 12, height: 820, per100: 1.46, entries: 1.1, exit: 6.4, cta_clicks: 0, cta_ctr: 0, verdict: 'IGNORADO', reading: 'Tempo levemente abaixo da mediana, queda normal.', action: 'Não é prioridade — nem trava, nem sustenta.' },
    { step: 'oferta', ord: 7, reached: 486, reach: 48.6, drop: 59.3, dwell_s: 41, height: 900, per100: 4.56, entries: 2.4, exit: 57.8, cta_clicks: 42, cta_ctr: 21.2, verdict: 'TRAVA', reading: 'Tempo quase 3x a mediana da página, somado a uma queda de 59,3% — a maior de toda a página. Não é um bloco ignorado: leram com atenção e desistiram bem aqui. Reentradas em 2,4 confirmam idas e voltas — indecisão, não desinteresse.', action: 'Prioridade máxima. Há uma objeção sem resposta na oferta. Reescreva e suba como versão nova, sem tocar em mais nada.' },
    { step: 'bonus', ord: 8, reached: 198, reach: 19.8, drop: 8.6, dwell_s: 9, height: 680, per100: 1.32, entries: 1.1, exit: 8.0, cta_clicks: 0, cta_ctr: 0, verdict: 'IGNORADO', reading: 'Quem chega até aqui já decidiu — o bloco não muda a rota.', action: 'Baixa prioridade.' },
    { step: 'garantia', ord: 9, reached: 181, reach: 18.1, drop: 8.3, dwell_s: 7, height: 460, per100: 1.52, entries: 1.0, exit: 7.9, cta_clicks: 0, cta_ctr: 0, verdict: 'FUNCIONA', reading: 'Tempo na mediana, queda controlada — cumpre o papel de reduzir risco percebido.', action: 'Mantenha.' },
    { step: 'faq-cta', ord: 10, reached: 166, reach: 16.6, drop: null, dwell_s: 22, height: 1040, per100: 2.12, entries: 1.4, exit: 61.4, cta_clicks: 18, cta_ctr: 10.8, verdict: 'ÚLTIMO', reading: 'Fim da página. Não há bloco seguinte para calcular queda — a saída aqui é o encerramento esperado da leitura.', action: 'Acompanhe cliques no CTA final e tempo de permanência.' },
  ],
};

const CONTATO = 'mailto:[SEU-EMAIL-DE-CONTATO]?subject=Quero%20conhecer%20a%20Régua';

export default async function LandingPage() {
  const logado = await usuarioAtual();

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* ═══ nav ═══ */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <IconLogo className="h-8 w-8" />
            <span className="text-[15px] font-semibold">Régua</span>
            <span className="rounded-[5px] bg-accent/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-accent">Beta</span>
          </div>
          <nav className="ml-8 hidden items-center gap-6 text-[13px] text-muted md:flex">
            <a href="#como-funciona" className="hover:text-ink">Como funciona</a>
            <a href="#produtos" className="hover:text-ink">Produtos</a>
            <a href="#honestidade" className="hover:text-ink">O que não fazemos</a>
            <a href="#perguntas" className="hover:text-ink">Perguntas</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href={logado ? '/painel' : '/entrar'} className="btn-ghost px-4 py-2.5 text-[13px]">
              {logado ? 'Ir para o painel' : 'Entrar'}
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ hero ═══ */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[.18em] text-faint">
          Para quem vive de lançamento e perpétuo
        </p>
        <h1 className="max-w-[22ch] text-[clamp(2.1rem,5.2vw,3.6rem)] font-bold leading-[1.04] tracking-tight">
          O Gerenciador de Anúncios diz qual criativo é barato.{' '}
          <span className="text-accent text-glow">A Régua diz onde ele morre</span> na sua página.
        </h1>
        <p className="mt-6 max-w-[62ch] text-[16.5px] leading-relaxed text-muted">
          Cruza o que a Meta sabe sobre o anúncio com o que mais ninguém mede: o bloco da página
          que trava a venda, o segundo exato em que largam o vídeo, a pergunta do quiz que
          derruba o funil. Nem a Meta, nem o player de vídeo, nem o construtor de quiz — sozinhos
          — respondem isso.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a href={CONTATO} className="btn-accent flex items-center gap-2 px-6 py-3.5 text-[14.5px]">
            Pedir acesso <IconArrowUpRight className="h-4 w-4" />
          </a>
          <Link href={logado ? '/painel' : '/entrar'} className="btn-ghost px-6 py-3.5 text-[14.5px]">
            {logado ? 'Ir para o painel' : 'Já uso a Régua'}
          </Link>
        </div>
        <p className="mt-5 text-[12px] leading-relaxed text-faint">
          Sem contrato de fidelidade. A régua avisa sozinha quando a amostra ainda é pequena
          demais pra decidir — em vez de te dar um número bonito e errado.
        </p>
      </section>

      {/* ═══ problema ═══ */}
      <section className="border-t border-line bg-panel/60 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-faint">O gerenciador de anúncios</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">te diz o CPC e o CPA por criativo — mas não sabe se a pessoa chegou até a oferta ou desistiu no segundo bloco.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-faint">O player de vídeo</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">te diz a retenção do VSL — mas não sabe se quem assistiu até o fim comprou, nem qual anúncio trouxe essa pessoa.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-faint">O construtor de quiz</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">te diz a taxa de conclusão — mas não sabe qual resposta prevê desistência nem qual caminho prevê venda.</p>
            </div>
          </div>
          <p className="mt-10 max-w-[68ch] text-[17px] leading-relaxed text-ink">
            Cada ferramenta mostra um pedaço. A Régua é o único lugar onde os pedaços se cruzam —
            porque é o único que mede os três ao mesmo tempo, na mesma sessão da mesma pessoa.
          </p>
        </div>
      </section>

      {/* ═══ como funciona ═══ */}
      <section id="como-funciona" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 max-w-[60ch]">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">Instalação</p>
            <h2 className="text-[28px] font-bold tracking-tight">Três passos, um deles a sua IA já pode fazer</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Depois disso nada muda no seu processo. O script observa em silêncio enquanto você
              roda tráfego como sempre.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {[
              { n: '01', t: 'Cole um script', d: 'Uma linha antes do </body>. Ou peça pra sua IA (Cursor, ChatGPT, Claude Code) fazer isso por você — a Régua já gera o prompt pronto.' },
              { n: '02', t: 'Ele mede sozinho', d: 'Bloco por scroll, vídeo por segundo (qualquer player), pergunta de quiz por resposta. Nenhuma marcação extra pro vídeo.' },
              { n: '03', t: 'Leia o veredito', d: 'Não um gráfico solto pra você interpretar — a régua já cruza tempo e queda e diz TRAVA, FUNCIONA, IGNORADO ou REJEIÇÃO.' },
            ].map(s => (
              <div key={s.n} className="bg-surface p-6">
                <span className="text-[11px] font-bold tnum text-accent">{s.n}</span>
                <h3 className="mt-3 text-[15px] font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ demo do painel de verdade ═══ */}
      <section className="border-y border-line bg-panel/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="chip !border-warn/30 !bg-warn/10 !text-warn">demonstração</span>
            <span className="text-[12px] text-faint">dados ilustrativos de uma página real — o mesmo painel que você usaria, sem dado de cliente nenhum</span>
          </div>
          <div className="mb-8 max-w-[60ch]">
            <h2 className="text-[28px] font-bold tracking-tight">É isto que você abre depois de rodar tráfego</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Clique em qualquer bloco. O veredito muda o texto, a cor e a ação recomendada —
              não é decoração, é a mesma leitura tempo × queda que separa &ldquo;ninguém leu&rdquo; de
              &ldquo;leram e não gostaram&rdquo;.
            </p>
          </div>
          <VistaRetencao leitura={DEMO} />
        </div>
      </section>

      {/* ═══ quatro produtos ═══ */}
      <section id="produtos" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 max-w-[60ch]">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">Um motor, três vocabulários</p>
            <h2 className="text-[28px] font-bold tracking-tight">Página, vídeo e quiz são o mesmo funil</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Muda o que é &ldquo;etapa&rdquo; — bloco, segundo do vídeo, pergunta — mas o veredito é o
              mesmo motor. E a Meta cruza com os três.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: IconLayers, t: 'Página de vendas', d: ['Curva de retenção por bloco', 'Veredito TRAVA/FUNCIONA/IGNORADO/REJEIÇÃO', 'Compara páginas e versões diferentes com honestidade estatística'] },
              { icon: IconVideo, t: 'Vídeo (VSL)', d: ['Funciona com player próprio, YouTube, Vimeo e VTurb', 'Marcador ao vivo na curva enquanto você assiste', 'Retenção no segundo exato em que a oferta aparece'] },
              { icon: IconQuiz, t: 'Quiz', d: ['Funil por pergunta, não só taxa de conclusão', 'Qual resposta prevê desistência, qual caminho prevê venda', 'Nunca grava o que a pessoa digitou — só a opção escolhida'] },
              { icon: IconMegaphone, t: 'Criativos (Meta)', d: ['CPA real: gasto cruzado com conversão medida na página', 'Hook rate e hold rate por criativo', 'Onde o tráfego de cada anúncio morre no funil'] },
            ].map(p => (
              <div key={p.t} className="card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent">
                  <p.icon className="h-4 w-4" />
                </span>
                <h3 className="mt-3.5 text-[14.5px] font-semibold">{p.t}</h3>
                <ul className="mt-2.5 space-y-1.5">
                  {p.d.map(item => (
                    <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ matriz de veredito ═══ */}
      <section className="border-t border-line bg-panel/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 max-w-[60ch]">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">Como decidimos</p>
            <h2 className="text-[28px] font-bold tracking-tight">Tempo e queda, cruzados, dizem o que fazer</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Sozinha, &ldquo;queda alta&rdquo; é ambígua: pode ser um bloco que ninguém leu ou um bloco que
              todo mundo leu e rejeitou. São problemas opostos, com soluções opostas.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {[
              { v: 'FUNCIONA', c: 'var(--color-accent)', d: 'Tempo alto, queda baixa. Prende e faz avançar. Não mexa — estude o que funciona aqui e replique.' },
              { v: 'TRAVA', c: 'var(--color-danger)', d: 'Tempo alto, queda alta. Leram, se interessaram, e algo fez desistir. Objeção sem resposta — prioridade máxima.' },
              { v: 'IGNORADO', c: 'var(--color-muted)', d: 'Tempo baixo, queda baixa. Passou batido e não atrapalhou. Candidato a corte.' },
              { v: 'REJEIÇÃO', c: 'var(--color-warn)', d: 'Tempo baixo, queda alta. Bateram o olho e saíram. Problema de gancho, não de conteúdo.' },
            ].map(m => (
              <div key={m.v} className="bg-surface p-6">
                <span className="text-[16px] font-bold tracking-tight" style={{ color: m.c }}>{m.v}</span>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ honestidade ═══ */}
      <section id="honestidade" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 max-w-[60ch]">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">Antes de você assinar</p>
            <h2 className="text-[28px] font-bold tracking-tight">O que a Régua não faz</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Melhor deixar claro agora do que você descobrir depois.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: 'Não grava tela nem digitação', d: 'Mede posição de rolagem, segundo de vídeo e opção de quiz escolhida. Nunca o que foi digitado num campo.' },
              { t: 'Não inventa vencedor', d: 'Sem sorteio simultâneo entre duas páginas, mostra o resultado — mas não declara vencedora. Isso é decisão, não sorte.' },
              { t: 'Avisa amostra pequena', d: 'Abaixo de 300 sessões, a tela mostra o aviso antes do número. Ruído lido como sinal é pior que não ter dado.' },
              { t: 'Não mede fora da página', d: 'Se o problema é o checkout ou o preço em si, a página vai parecer ótima e a conversão vai continuar ruim.' },
              { t: 'Não coleta dado pessoal', d: 'Sem nome, e-mail ou cookie de rastreamento. País vem do IP no instante da chegada — o IP em si nunca é gravado.' },
              { t: 'Não funciona em iframe fechado', d: 'Vídeo de outro domínio sem API exposta não é mensurável por ninguém de fora — é limite do navegador, não nosso.' },
            ].map(l => (
              <div key={l.t} className="rounded-xl border border-line bg-panel p-5">
                <h3 className="text-[13.5px] font-semibold">{l.t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{l.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="perguntas" className="border-t border-line bg-panel/60 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">Perguntas</p>
          <h2 className="mb-10 text-[28px] font-bold tracking-tight">Antes de perguntar no chat</h2>
          <div className="divide-y divide-line border-y border-line">
            {[
              { p: 'Funciona com VTurb, YouTube, Vimeo ou vídeo próprio?', r: 'Sim, os quatro. O coletor descobre o vídeo sozinho e adapta a leitura ao player — sem marcação extra, exceto o segundo opcional em que a oferta aparece.' },
              { p: 'Preciso saber programar pra instalar?', r: 'Não precisa mexer em nada além de colar um script. E se você desenvolve com IA (Cursor, ChatGPT, Claude Code), a Régua gera um prompt pronto que sua própria IA segue pra instalar tudo.' },
              { p: 'Isso substitui o Gerenciador de Anúncios da Meta?', r: 'Não — complementa. A Meta continua sendo a fonte de gasto e cliques. A Régua cruza esse dado com o que acontece depois do clique, dentro da sua página.' },
              { p: 'Os números batem exatamente com o Gerenciador?', r: 'Não vão bater, e isso é esperado: a Meta conta clique, a Régua conta carregamento de página, e bloqueador de anúncio come parte dos dois de formas diferentes. Comparamos bloco contra bloco e versão contra versão, não contra o Gerenciador.' },
              { p: 'Quanto tempo até aparecer dado de verdade?', r: 'A primeira sessão aparece no painel na hora — o próprio instalador confirma ao vivo. Pra ler o veredito com confiança, o piso é 300 sessões por página; abaixo disso avisamos que é tendência, não resultado.' },
            ].map(f => (
              <details key={f.p} className="group py-5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 text-[14.5px] font-semibold text-ink">
                  {f.p}
                  <span className="text-[18px] font-normal text-faint group-open:hidden">+</span>
                  <span className="hidden text-[18px] font-normal text-faint group-open:inline">–</span>
                </summary>
                <p className="mt-3 max-w-[60ch] text-[13.5px] leading-relaxed text-muted">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ fechamento ═══ */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-[32px] font-bold tracking-tight">Pare de adivinhar qual bloco travou a venda</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Em poucos dias de tráfego você sabe se é a página, o vídeo, o quiz ou o criativo —
            e qual dos quatro é o próximo a mexer.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={CONTATO} className="btn-accent flex items-center gap-2 px-6 py-3.5 text-[14.5px]">
              Pedir acesso <IconArrowUpRight className="h-4 w-4" />
            </a>
            <Link href={logado ? '/painel' : '/entrar'} className="btn-ghost px-6 py-3.5 text-[14.5px]">
              {logado ? 'Ir para o painel' : 'Já uso a Régua'}
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ rodapé ═══ */}
      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <IconLogo className="h-6 w-6" />
            <span className="text-[13px] text-muted">Régua · onde o funil está sangrando</span>
          </div>
          <div className="flex items-center gap-5 text-[12.5px] text-faint">
            <Link href="/privacidade" className="hover:text-muted">Privacidade</Link>
            <a href={CONTATO} className="hover:text-muted">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
