import { siteKey } from '@/lib/dados';
import { exigirConta } from '@/lib/sessao';
import { Cabecalho, Codigo } from '@/components/ui/estados';

export const metadata = { title: 'Instalação — Régua' };

export default async function Instalar() {
  const { conta } = await exigirConta();
  const chave = (await siteKey(conta.id)) ?? 'SUA_CHAVE';
  const host = process.env.REGUA_HOST || 'http://localhost:3100';

  return (
    <div className="max-w-4xl space-y-5">
      <Cabecalho
        sobre="Uma vez por página"
        titulo="Instalação"
        descricao="Depois disto nada muda no seu processo. O script observa em silêncio enquanto você roda tráfego como sempre."
      />

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold">Sua chave</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Chave pública. Pode ficar exposta no HTML — ela só diz de qual conta é o evento
          que chega, não autoriza a ler nada.
        </p>
        <p className="mt-3 inline-flex rounded-xl border border-accent/25 bg-accent/[.08] px-4 py-2.5 font-mono text-[14px] text-accent">
          {chave}
        </p>
      </section>

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold">1 · Página de vendas</h2>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Nomeie cada seção. Um bloco equivale a uma unidade de argumento: headline, prova
          social, oferta, garantia. De 10 a 15 por página — granularidade menor gera ruído,
          maior perde resolução. <span className="text-ink">Mantenha os nomes estáveis entre
          versões</span>: renomear quebra a comparação.
        </p>
        <Codigo>{`<section data-block="hero"> ... </section>
<section data-block="problema"> ... </section>
<section data-block="oferta">
  <button data-cta="checkout-principal">Comprar</button>
</section>

<script src="${host}/r.js"
        data-key="${chave}"
        data-page="oferta-relogio-uk"
        data-version="1" defer></script>`}</Codigo>
      </section>

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold">2 · Vídeo</h2>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          <span className="text-ink">Não precisa marcar nada.</span> O mesmo script acha
          qualquer vídeo da página sozinho e começa a medir retenção segundo a segundo.
          O único ajuste que vale a pena é dizer em que segundo a oferta aparece — vira a
          métrica de manchete do vídeo.
        </p>
        <Codigo>{`<!-- funciona sem nenhum atributo -->
<video src="/vsl.mp4" controls></video>

<!-- opcional: o segundo em que a oferta entra -->
<video src="/vsl.mp4" data-vsl="principal" data-vsl-pitch="612"></video>`}</Codigo>
        <div className="mt-4 rounded-xl border border-warn/25 bg-warn/[.06] p-4 text-[12.5px] leading-relaxed text-warn">
          <strong className="font-semibold">Limite que não é contornável.</strong> Vídeo dentro
          de <span className="font-mono">iframe</span> de outro domínio que não exponha API
          não pode ser medido por ninguém de fora — o navegador proíbe (same-origin).
          Player nativo, YouTube, Vimeo e o player novo da VTurb expõem API e funcionam.
          O embed antigo da VTurb, em iframe puro, não.
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold">3 · Quiz</h2>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Marque cada pergunta e cada opção de resposta. O funil por pergunta sai igual ao
          funil por bloco.
        </p>
        <Codigo>{`<div data-quiz-step="1" data-quiz-question="objetivo">
  <button data-quiz-option="emagrecer">Emagrecer</button>
  <button data-quiz-option="massa">Ganhar massa</button>
</div>

<div data-quiz-step="2" data-quiz-question="prazo"> ... </div>`}</Codigo>
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[.06] p-4 text-[12.5px] leading-relaxed text-muted">
          <strong className="font-semibold text-accent">Sobre resposta de quiz.</strong> Só a
          chave da opção é gravada, nunca o texto. Campo de digitação livre não é lido —
          nem o valor, nem o tamanho. Resposta de quiz costuma ser dado de saúde, corpo ou
          dinheiro, e o coletor bloqueia <span className="font-mono">input</span>,{' '}
          <span className="font-mono">textarea</span> e <span className="font-mono">select</span> por
          construção, não por política.
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold">4 · Conversão</h2>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          A Régua não mede fora da página, então a venda precisa ser reportada de volta. Ao
          clicar num CTA que seja link, o script acrescenta{' '}
          <span className="font-mono text-ink">?rg_s=</span> ao destino. Feche o circuito na
          página de obrigado. Sem isto o painel mostra clique em botão — e clique em botão
          não é venda.
        </p>
        <Codigo>{`<img src="${host}/c.gif?s=SESSAO_DA_URL" width="1" height="1" alt="">`}</Codigo>
      </section>

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold">5 · Origem do tráfego</h2>
        <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-muted">
          Cole isto em <span className="text-ink">Parâmetros de URL</span>, no nível de anúncio
          do Gerenciador da Meta. O <span className="font-mono text-ink">{'{{ad.id}}'}</span> é o
          que amarra gasto de criativo a comportamento na página — sem ele não existe custo
          por resultado real, só custo por clique.
        </p>
        <Codigo>{`utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}`}</Codigo>
      </section>
    </div>
  );
}
