import { contaAtual, ativos, siteKey } from '@/lib/dados';
import { Cabecalho, AindaSemColeta } from '@/components/ui/estados';

export const metadata = { title: 'Quiz — Régua' };

export default async function Quiz() {
  const conta = await contaAtual();
  const lista = (await ativos(conta.id)).filter(a => a.kind === 'quiz' && a.sessions > 0);

  return (
    <div className="max-w-5xl space-y-5">
      <Cabecalho
        sobre="Funil por pergunta"
        titulo="Quiz"
        descricao="Em qual pergunta as pessoas desistem, qual resposta prevê abandono, e qual caminho de respostas termina em venda."
      />

      {!lista.length ? (
        <AindaSemColeta
          titulo="Nenhum quiz em coleta"
          porque="Marque cada pergunta e cada opção, cole o mesmo script, e o funil por pergunta sai igual ao funil por bloco da página de vendas."
          chave={await siteKey(conta.id)}
          passos={[
            { titulo: 'Marque as perguntas', texto: <>Cada tela ganha <span className="font-mono">data-quiz-step</span> e <span className="font-mono">data-quiz-question</span>.</> },
            { titulo: 'Marque as opções', texto: <>Cada alternativa ganha <span className="font-mono">data-quiz-option</span> com uma chave curta.</> },
            { titulo: 'Cole o script', texto: 'O mesmo da página de vendas, com a mesma chave. Um quiz pode conviver com blocos e vídeo na mesma página.' },
          ]}
          exemplo={`<div data-quiz-step="1" data-quiz-question="objetivo">
  <button data-quiz-option="emagrecer">Emagrecer</button>
  <button data-quiz-option="massa">Ganhar massa</button>
</div>

<div data-quiz-step="2" data-quiz-question="prazo"> ... </div>

<script src="/r.js" data-key="SUA_CHAVE" data-page="quiz-diagnostico" defer></script>`}
          aviso={
            <>
              <strong className="font-semibold">Resposta de quiz é dado sensível.</strong> Só a
              chave da opção é gravada, nunca o texto exibido. Campo de digitação livre não é
              lido — nem valor, nem tamanho. O coletor bloqueia input, textarea e select por
              construção, e há teste que falha se qualquer valor digitado chegar ao banco.
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {lista.map(q => (
            <div key={q.key} className="card p-5">
              <h2 className="font-mono text-[14px]">{q.key}</h2>
              <p className="mt-1 text-[11.5px] text-faint">{q.sessions.toLocaleString('pt-BR')} sessões</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
