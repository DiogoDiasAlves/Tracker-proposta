import { IconLogo } from '@/components/icons';

export const metadata = { title: 'Política de Privacidade — Régua' };

/* Reflete exatamente o que o código faz — não é texto genérico de modelo.
   Cada afirmação aqui pode ser conferida em tracker/core.js, db/ingest.js e
   web/lib/coleta.ts. Se o comportamento do produto mudar, este texto tem
   que mudar junto — é contrato com quem usa, igual ao README de métricas.

   ATUALIZE os campos entre [colchetes] antes de publicar, e passe por um
   advogado antes de submeter ao App Review da Meta — isto é um rascunho
   tecnicamente preciso, não uma revisão jurídica. */
export default function Privacidade() {
  return (
    <main className="mx-auto max-w-[72ch] px-6 py-16">
      <div className="mb-10 flex items-center gap-3">
        <IconLogo className="h-8 w-8" />
        <span className="text-[15px] font-semibold">Régua</span>
      </div>

      <h1 className="text-[28px] font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-[12.5px] text-faint">Última atualização: [DATA]</p>

      <div className="mt-8 space-y-8 text-[13.5px] leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">1. Quem opera este serviço</h2>
          <p>
            A Régua é operada por <span className="text-ink">[SEU NOME OU RAZÃO SOCIAL]</span>,
            [CNPJ, se houver], contato para questões de privacidade em{' '}
            <span className="text-ink">[SEU E-MAIL DE CONTATO]</span>. Esta política vale para o
            site que você está vendo, para o painel em <span className="font-mono">/painel</span>{' '}
            e para o script de coleta instalado nas páginas dos nossos clientes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">2. O que a Régua mede numa página de cliente</h2>
          <p className="mb-3">
            Quando um cliente instala o script da Régua na página dele, o script roda no
            navegador de quem visita e envia ao nosso servidor:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Um identificador de sessão aleatório, gerado no navegador e guardado em{' '}
              <span className="font-mono text-ink">sessionStorage</span> — não é cookie, não
              persiste entre abas e desaparece quando a aba fecha.</li>
            <li>Tipo de dispositivo (celular ou computador), sistema operacional e navegador,
              lidos do cabeçalho da requisição — não de rastreamento.</li>
            <li>País, derivado do endereço IP no momento em que o dado chega ao servidor.{' '}
              <span className="text-ink">O endereço IP em si nunca é gravado</span> — é usado
              para essa consulta e descartado no mesmo instante.</li>
            <li>Quais seções da página (ou segundos de um vídeo) a pessoa viu, por quanto tempo,
              e se clicou num botão marcado para medição.</li>
            <li>Parâmetros de campanha (UTM) e o domínio de onde a pessoa veio, se presentes na
              URL.</li>
            <li>Se a página tiver um quiz: qual opção de resposta foi escolhida, identificada
              por uma chave curta (ex.: <span className="font-mono">emagrecer</span>) — nunca o
              texto exibido no botão nem qualquer coisa digitada livremente.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">3. O que a Régua nunca coleta</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Nome, e-mail, telefone, endereço ou qualquer dado digitado em campo de
              formulário — o coletor ignora <span className="font-mono">input</span>,{' '}
              <span className="font-mono">textarea</span> e <span className="font-mono">select</span>{' '}
              por construção, não por configuração.</li>
            <li>Não grava tela, não filma, não usa câmera nem microfone.</li>
            <li>Não usa cookie de rastreamento nem identifica a mesma pessoa entre sites
              diferentes.</li>
            <li>Não vende, aluga ou compartilha dado de visitante com terceiros.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">4. Integração com a Meta (Facebook/Instagram Ads)</h2>
          <p className="mb-3">
            Um cliente da Régua pode, de forma opcional, conectar a própria conta de anúncios da
            Meta para cruzar o desempenho de um anúncio com o comportamento medido na página de
            destino. Quando isso acontece:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Pedimos apenas permissão de <span className="font-mono text-ink">leitura</span>{' '}
              (<span className="font-mono">ads_read</span>) — a Régua não cria, edita nem pausa
              nenhum anúncio.</li>
            <li>Lemos métricas agregadas de campanha: gasto, impressões, cliques, e o nome/id do
              anúncio — nunca dados pessoais de quem viu o anúncio.</li>
            <li>O token de acesso é <span className="text-ink">cifrado com AES-256-GCM</span>{' '}
              antes de ser gravado; a chave de decifragem mora fora do banco de dados. Um vazamento
              do banco, sozinho, não expõe o token.</li>
            <li>O cliente pode desconectar a qualquer momento pelo próprio painel, o que revoga
              o acesso e apaga o token gravado.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">5. Por quanto tempo os dados ficam guardados</h2>
          <p>
            [DESCREVA A POLÍTICA DE RETENÇÃO — ex.: dados de sessão ficam guardados enquanto a
            conta do cliente estiver ativa, e são apagados em até X dias após o cancelamento.]
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">6. Seus direitos (LGPD)</h2>
          <p>
            Se você é uma pessoa que visitou uma página que usa a Régua e quer saber se algum
            dado seu está guardado, corrigi-lo ou pedir a exclusão, escreva para{' '}
            <span className="text-ink">[SEU E-MAIL DE CONTATO]</span>. Como não coletamos nome,
            e-mail ou telefone, normalmente não há como identificar qual sessão é sua — mas
            respondemos todo pedido.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">7. Contato</h2>
          <p>
            Dúvidas sobre esta política: <span className="text-ink">[SEU E-MAIL DE CONTATO]</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
