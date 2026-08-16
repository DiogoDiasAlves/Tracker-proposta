import { siteKey } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { Cabecalho, Codigo } from '@/components/ui/estados';
import { SeletorTipoInstalacao } from '@/components/ui/seletor-tipo-instalacao';
import { StatusInstalacao } from '@/components/painel/status-instalacao';
import { TourInstalacao } from '@/components/painel/tour-instalacao';

export const metadata = { title: 'Instalação — Régua' };

type Busca = Promise<{ tipo?: string }>;

function Selo({ tipo }: { tipo: 'obrigatorio' | 'opcional' | 'recomendado' }) {
  const cfg = {
    obrigatorio: { texto: 'Obrigatório', cls: 'border-accent/30 bg-accent/[.1] text-accent' },
    recomendado: { texto: 'Opcional, mas recomendado', cls: 'border-warn/30 bg-warn/[.08] text-warn' },
    opcional: { texto: 'Opcional', cls: 'border-line bg-surface text-faint' },
  }[tipo];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${cfg.cls}`}>
      {cfg.texto}
    </span>
  );
}

function SePular({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2.5 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-[12px] leading-relaxed text-faint">
      <span className="shrink-0 text-warn">▲</span>
      <p><span className="text-muted">Se pular este passo:</span> {children}</p>
    </div>
  );
}

export default async function Instalar({ searchParams }: { searchParams: Busca }) {
  const sp = await searchParams;
  const { conta, usuario } = await exigirConta();
  const chave = (await siteKey(conta.id)) ?? 'SUA_CHAVE';
  const host = process.env.REGUA_HOST || 'http://localhost:3100';
  const tipo = sp.tipo === 'quiz' ? 'quiz' : 'pagina';
  const desde = new Date().toISOString();

  return (
    <div className="max-w-4xl space-y-5">
      {!usuario.tour_concluido && <TourInstalacao />}

      <Cabecalho
        sobre="Uma vez por página"
        titulo="Instalação"
        descricao="Uma linha já começa a medir sessão e dispositivo. Pra funil por bloco, vídeo com métrica de oferta e conversão de verdade, tem mais alguns passos — cada um diz o que acontece se você pular."
      />

      <div id="tour-status">
        <StatusInstalacao desde={desde} />
      </div>

      <section id="tour-chave" className="card p-6">
        <h2 className="text-[15px] font-semibold">Sua chave</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Chave pública. Pode ficar exposta no HTML — ela só diz de qual conta é o evento
          que chega, não autoriza a ler nada.
        </p>
        <p className="mt-3 inline-flex rounded-xl border border-accent/25 bg-accent/[.08] px-4 py-2.5 font-mono text-[14px] text-accent">
          {chave}
        </p>
      </section>

      <div id="tour-tipo">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">O que você está instalando</p>
        <SeletorTipoInstalacao atual={tipo} />
      </div>

      <section id="tour-ia" className="card !border-accent/20 p-6">
        <h2 className="text-[15px] font-semibold">Atalho: peça pra sua IA instalar</h2>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Se você desenvolve a página com ajuda de IA (Cursor, Claude Code, ChatGPT, v0,
          Lovable…), cole o texto abaixo nela — já vem com sua chave preenchida. Ela lê sua
          página de verdade e decide onde encaixar cada coisa; os passos manuais abaixo
          continuam aqui pra quem preferir fazer à mão ou só entender o que está acontecendo.
        </p>
        {tipo === 'pagina' ? (
          <Codigo>{`Você é uma IA de desenvolvimento ajudando a instalar um script de analytics
chamado Régua nesta página de vendas. Siga exatamente as instruções abaixo,
sem alterar nenhuma funcionalidade existente da página.

1. Cole este script antes da tag </body>, uma vez só:

<script src="${host}/r.js"
        data-key="${chave}"
        data-page="ESCOLHA-UM-NOME-CURTO-PRA-ESTA-OFERTA"
        data-version="1" defer></script>

Troque "ESCOLHA-UM-NOME-CURTO-PRA-ESTA-OFERTA" por um nome curto, em
minúsculas, com hífen, que identifique esta página (ex.: "oferta-relogio-uk").
Baseie-se no produto ou oferta desta página.

2. Encontre as seções principais da página (headline/hero, prova social,
explicação do problema, apresentação da solução, oferta/preço, garantia,
FAQ etc. — normalmente cada uma é uma <section> ou <div> grande) e adicione
o atributo data-block="nome-da-secao" em cada uma. Use nomes curtos e
descritivos (ex.: "hero", "prova-social", "oferta", "garantia"). Alvo: entre
10 e 15 seções marcadas — nem menos (perde resolução) nem mais (vira ruído).

3. No botão (ou link) principal de compra/checkout, adicione
data-cta="checkout-principal".

4. Se houver vídeo na página (elemento <video>, embed do YouTube, do Vimeo,
ou o player da VTurb), NÃO precisa marcar nada — ele é detectado
automaticamente. Só se você conseguir identificar em que segundo do vídeo a
oferta/preço é revelada, adicione data-vsl-pitch="SEGUNDOS" no elemento de
vídeo (opcional).

5. NÃO adicione nenhum atributo em elementos <input>, <textarea> ou <select>.

6. Ao final, me mostre um resumo (diff) de tudo que você alterou antes de eu
confirmar.`}</Codigo>
        ) : (
          <Codigo>{`Você é uma IA de desenvolvimento ajudando a instalar um script de analytics
chamado Régua neste quiz. Siga exatamente as instruções abaixo, sem alterar
nenhuma funcionalidade existente da página.

1. Cole este script antes da tag </body>, uma vez só:

<script src="${host}/r.js"
        data-key="${chave}"
        data-page="ESCOLHA-UM-NOME-CURTO-PRA-ESTE-QUIZ"
        data-version="1" defer></script>

2. Em cada tela/pergunta do quiz, adicione no elemento que envolve a
pergunta inteira:
   - data-quiz-step="N" (N = número sequencial da pergunta, começando em 1)
   - data-quiz-question="tema-da-pergunta" (nome curto, ex.: "objetivo",
     "prazo")

3. Em cada botão/opção de resposta dessa pergunta, adicione
data-quiz-option="chave-da-opcao" — nome curto da alternativa
(ex.: "emagrecer", "ganhar-massa"), NUNCA o texto completo do botão.

4. NÃO adicione nenhum atributo em elementos <input>, <textarea> ou
<select> — isso é regra de privacidade, não estética.

5. Ao final, me mostre um resumo (diff) de tudo que você alterou antes de
eu confirmar.`}</Codigo>
        )}
      </section>

      {tipo === 'pagina' ? (
        <>
          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold">1 · O script</h2>
              <Selo tipo="obrigatorio" />
            </div>
            <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Cole antes do <span className="font-mono text-ink">&lt;/body&gt;</span> da sua
              página. Sozinho, já mede sessões, dispositivo e — se houver vídeo — retenção
              dele. Troque <span className="font-mono text-ink">minha-pagina</span> por um
              nome seu; é só como essa página vai aparecer no painel.
            </p>
            <Codigo>{`<script src="${host}/r.js"
        data-key="${chave}"
        data-page="minha-pagina"
        data-version="1" defer></script>`}</Codigo>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold">2 · Blocos e botão de compra</h2>
              <Selo tipo="recomendado" />
            </div>
            <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Nomeie cada seção da página. Um bloco equivale a uma unidade de argumento:
              headline, prova social, oferta, garantia. De 10 a 15 por página — granularidade
              menor gera ruído, maior perde resolução.{' '}
              <span className="text-ink">Mantenha os nomes estáveis entre versões</span>:
              renomear quebra a comparação.
            </p>
            <Codigo>{`<section data-block="hero"> ... </section>
<section data-block="problema"> ... </section>
<section data-block="oferta">
  <button data-cta="checkout-principal">Comprar</button>
</section>`}</Codigo>
            <SePular>
              as telas <span className="text-ink">Painel</span> e{' '}
              <span className="text-ink">Páginas</span> ficam sem o que mostrar — não é erro
              de conexão, é que não existe funil por bloco pra desenhar. O resto (vídeo, sessões,
              dispositivo) continua funcionando normalmente.
            </SePular>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold">3 · Vídeo</h2>
              <Selo tipo="opcional" />
            </div>
            <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
              <span className="text-ink">Não precisa marcar nada</span> — isto é automático,
              não é mais um passo a fazer. O mesmo script acha qualquer vídeo da página sozinho
              e começa a medir retenção assim que alguém dá play. O único ajuste que vale a pena
              é dizer em que segundo a oferta aparece.
            </p>
            <Codigo>{`<!-- funciona sem nenhum atributo -->
<video src="/vsl.mp4" controls></video>

<!-- opcional: o segundo em que a oferta entra -->
<video src="/vsl.mp4" data-vsl-pitch="612"></video>`}</Codigo>
            <div className="mt-4 rounded-xl border border-warn/25 bg-warn/[.06] p-4 text-[12.5px] leading-relaxed text-warn">
              <strong className="font-semibold">Limite que não é contornável.</strong> Vídeo
              dentro de <span className="font-mono">iframe</span> de outro domínio que não
              exponha API não pode ser medido por ninguém de fora — o navegador proíbe
              (same-origin). Player nativo, YouTube, Vimeo e o player novo da VTurb expõem
              API e funcionam. O embed antigo da VTurb, em iframe puro, não.
            </div>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold">4 · Conversão</h2>
              <Selo tipo="recomendado" />
            </div>
            <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
              A Régua não mede fora da página, então a venda precisa ser reportada de volta.
              Ao clicar num CTA que seja link, o script já acrescenta{' '}
              <span className="font-mono text-ink">?rg_s=</span> ao destino sozinho — você só
              precisa devolver esse dado na página de obrigado.
            </p>
            <Codigo>{`<img src="${host}/c.gif?s=SESSAO_DA_URL" width="1" height="1" alt="">`}</Codigo>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              <span className="text-muted">SESSAO_DA_URL</span> é o valor do parâmetro{' '}
              <span className="font-mono">rg_s</span> que chegou na URL da página de obrigado
              — a maioria dos construtores de página (WordPress, ClickFunnels, Hotmart, Kiwify…)
              tem um jeito de inserir um parâmetro de URL num campo de imagem ou HTML
              personalizado. Se não souber onde mexer na sua plataforma, me diga qual é que eu
              te mostro o lugar exato.
            </p>
            <SePular>
              o painel mostra clique em botão, não venda — e clique em botão não é conversão.
              Continua tendo taxa de clique no CTA normalmente, só falta o fechamento do
              funil até a venda.
            </SePular>
          </section>
        </>
      ) : (
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Quiz</h2>
            <Selo tipo="obrigatorio" />
          </div>
          <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Cole o mesmo script de antes, e marque cada pergunta e cada opção de resposta.
            O funil por pergunta sai igual ao funil por bloco da página.
          </p>
          <Codigo>{`<script src="${host}/r.js"
        data-key="${chave}"
        data-page="meu-quiz"
        data-version="1" defer></script>

<div data-quiz-step="1" data-quiz-question="objetivo">
  <button data-quiz-option="emagrecer">Emagrecer</button>
  <button data-quiz-option="massa">Ganhar massa</button>
</div>

<div data-quiz-step="2" data-quiz-question="prazo"> ... </div>`}</Codigo>
          <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[.06] p-4 text-[12.5px] leading-relaxed text-muted">
            <strong className="font-semibold text-accent">Sobre resposta de quiz.</strong> Da
            escolha de cada pessoa grava-se só a <span className="text-ink">chave</span> da
            opção. O <span className="text-ink">texto do botão</span> é lido uma vez e guardado
            num dicionário do quiz — uma linha por alternativa, não por visitante — para o
            painel mostrar &quot;Acima de R$ 300&quot; em vez de{' '}
            <span className="font-mono">acima-300</span>. É copy sua, igual para todo mundo.
            <br /><br />
            Campo de digitação livre <span className="text-ink">nunca</span> é lido — nem o
            valor, nem o tamanho. O coletor pula <span className="font-mono">input</span>,{' '}
            <span className="font-mono">textarea</span> e <span className="font-mono">select</span>{' '}
            por construção, e há teste que falha se qualquer valor digitado chegar ao banco.
          </div>
          <SePular>
            sem <span className="font-mono">data-quiz-step</span> e{' '}
            <span className="font-mono">data-quiz-option</span> marcados, a página é lida como
            um funil por bloco comum — funciona, mas sem a leitura por pergunta/resposta que é
            o ponto do quiz.
          </SePular>
        </section>
      )}

      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Origem do tráfego (Meta)</h2>
          <Selo tipo="recomendado" />
        </div>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Vale pra página e pra quiz. Cole isto em{' '}
          <span className="text-ink">Parâmetros de URL</span>, no nível de anúncio do
          Gerenciador da Meta. O <span className="font-mono text-ink">{'{{ad.id}}'}</span> é o
          que amarra gasto de criativo a comportamento na página — sem ele não existe custo
          por resultado real, só custo por clique.
        </p>
        <Codigo>{`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}`}</Codigo>
        <SePular>
          a tela de <span className="text-ink">Criativos</span> continua funcionando, mas sem
          saber de qual anúncio cada sessão veio — dá pra ver o comportamento geral, não o
          comportamento por criativo.
        </SePular>
      </section>
    </div>
  );
}
