/*
 * O veredito — lógica pura, sem banco e sem HTTP.
 *
 * Este é o ativo mais valioso do produto: o que transforma uma tabela de
 * números numa decisão. Sozinha, "queda alta" é ambígua — pode ser uma etapa
 * que ninguém consumiu ou uma que todo mundo consumiu e rejeitou. São
 * problemas opostos, com soluções opostas. O cruzamento tempo × queda resolve.
 *
 * Vale para os três produtos, porque os três são funis de etapas ordenadas:
 *
 *   página  etapa = bloco            tempo = segundos na tela por 100px
 *   VSL     etapa = trecho do vídeo  tempo = segundos assistidos do trecho
 *   quiz    etapa = pergunta         tempo = segundos até responder
 *
 * IMPORTANTE: os textos de `page` são os que estão na proposta assinada e no
 * README. São contrato. O vocabulário abaixo existe para que VSL e quiz leiam
 * naturalmente SEM reescrever uma vírgula do que o cliente de página já leu.
 */

export const MIN_SAMPLE = 300;  // abaixo disso o painel avisa que é ruído
export const HIGH_DROP = 15;    // limiar de "queda alta"

export function median(xs) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

/** Queda relativa: de quem chegou aqui, quanto por cento não avançou. */
export function drop(reachAtual, reachProxima) {
  if (reachProxima === null || reachProxima === undefined) return null;
  if (!reachAtual) return null;
  return (1 - reachProxima / reachAtual) * 100;
}

const VOCAB = {
  page: {
    item: 'bloco', primeira: 'Primeiro bloco', fim: 'Fim da página',
    todo: 'da página', unidade: 'por 100px',
    consumir: 'ler', consumiram: 'leram', consumido: 'leu',
    encerramento: 'da leitura', escopo: 'a página',
  },
  vsl: {
    item: 'trecho', primeira: 'Início do vídeo', fim: 'Fim do vídeo',
    todo: 'do vídeo', unidade: 'por trecho',
    consumir: 'assistir', consumiram: 'assistiram', consumido: 'assistiu',
    encerramento: 'da reprodução', escopo: 'o vídeo',
  },
  quiz: {
    item: 'pergunta', primeira: 'Primeira pergunta', fim: 'Fim do quiz',
    todo: 'do quiz', unidade: 'por pergunta',
    consumir: 'responder', consumiram: 'responderam', consumido: 'respondeu',
    encerramento: 'do quiz', escopo: 'o quiz',
  },
};

/**
 * @param s     etapa com { drop, per100, entries }
 * @param i     índice na sequência
 * @param med   mediana de per100 do funil inteiro
 * @param kind  'page' | 'vsl' | 'quiz'
 */
export function verdict(s, i, med, kind = 'page') {
  const v = VOCAB[kind] || VOCAB.page;
  const hiT = s.per100 >= med;
  const hiD = s.drop !== null && s.drop >= HIGH_DROP;
  // Vírgula decimal: o texto do veredito aparece ao lado dos números do
  // painel, e "4.9s" no meio de uma tela que escreve "45,1%" lê como erro.
  const f = n => n.toFixed(1).replace('.', ',');

  if (i === 0) return {
    verdict: 'DOBRA',
    reading: `${v.primeira}. A queda aqui é o filtro natural do tráfego frio e não deve ser comparada com o restante ${v.todo}.`,
    action: 'Referência: 20% a 35% é normal. Acima disso, o problema costuma estar no criativo do anúncio, não na página.',
  };

  if (s.drop === null) return {
    verdict: 'ÚLTIMO',
    reading: `${v.fim}. Não há ${v.item} seguinte para calcular queda — a saída aqui é o encerramento esperado ${v.encerramento}.`,
    action: 'Acompanhe cliques no CTA final e tempo de permanência.',
  };

  if (hiT && hiD) return {
    verdict: 'TRAVA',
    reading: `Tempo acima da mediana ${v.todo} (${f(s.per100)}s contra ${f(med)}s ${v.unidade}) somado a queda de ${f(s.drop)}%. Não é um ${v.item} ignorado: ${v.consumiram} com atenção e desistiram. Reentradas em ${f(s.entries)} confirmam idas e voltas.`,
    action: 'Prioridade máxima. Há uma objeção ou uma confusão aqui. Reescreva e suba como versão nova, sem tocar em mais nada.',
  };

  if (hiT) return {
    verdict: 'FUNCIONA',
    reading: `Segura a atenção (${f(s.per100)}s ${v.unidade}, acima da mediana de ${f(med)}s) e ainda assim entrega ${f(100 - s.drop)}% para o ${v.item} seguinte.`,
    action: `Não mexa. Estude o que faz este ${v.item} funcionar e aplique nos que travam.`,
  };

  if (hiD) return {
    verdict: 'REJEIÇÃO',
    reading: `Tempo baixo (${f(s.per100)}s ${v.unidade}) com queda de ${f(s.drop)}%. Bateram o olho e saíram, sem ${v.consumir}.`,
    action: `O problema está na abertura do ${v.item} — título, imagem ou primeira linha. Reescreva o gancho, não o corpo.`,
  };

  return {
    verdict: 'IGNORADO',
    reading: `Tempo baixo (${f(s.per100)}s ${v.unidade}) e queda dentro do normal. Ninguém ${v.consumido}, e isso não atrapalhou o avanço.`,
    action: `Candidato a corte. Reduzir este ${v.item} encurta ${v.escopo} sem custo de conversão.`,
  };
}

/** Maior gargalo, ignorando a primeira etapa de propósito: a dobra sempre
 *  lidera em números brutos e apontar para ela faz você reescrever o topo
 *  da página para sempre e nunca chegar no problema. */
export function worstStep(steps) {
  let pior = null;
  for (const s of steps.slice(1)) {
    if (s.drop !== null && (!pior || s.drop > pior.drop)) pior = s;
  }
  return pior ? pior.step : null;
}
