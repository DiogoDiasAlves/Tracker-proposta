/*
 * Quem venceu, e com quanta certeza.
 *
 * Bayesiano em vez de p-valor porque "87% de chance de a B ser melhor" é
 * legível para quem compra tráfego, e "p < 0,05" não é. Modelo beta-binomial
 * sobre conversão, com prior uniforme Beta(1,1).
 *
 * Cálculo EXATO, não simulação: um número que muda de 87% para 86% a cada
 * atualização da página ensina a pessoa a não confiar nele.
 */

/** log Γ(x) — aproximação de Lanczos, g=7, n=9. */
function lgamma(x) {
  const g = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const lbeta = (x, y) => lgamma(x) + lgamma(y) - lgamma(x + y);

/**
 * Probabilidade de B converter melhor que A.
 * Fórmula fechada de Evan Miller para o beta-binomial.
 */
export function probabilidadeMelhor(convA, nA, convB, nB) {
  const aA = 1 + convA, bA = 1 + Math.max(0, nA - convA);
  const aB = 1 + convB, bB = 1 + Math.max(0, nB - convB);

  // O somatório é O(aB). Com conversão na casa dos milhares ainda é
  // instantâneo, mas acima disso a soma vira lenta sem ganho de precisão.
  if (aB > 20000) return null;

  let total = 0;
  for (let i = 0; i < aB - 1 + 1; i++) {
    if (i >= aB) break;
    total += Math.exp(
      lbeta(aA + i, bA + bB) - Math.log(bB + i) - lbeta(1 + i, bB) - lbeta(aA, bA)
    );
  }
  return Math.min(1, Math.max(0, total));
}

/** Intervalo de credibilidade de 95% da taxa de conversão. */
export function intervalo(conv, n) {
  const p = n ? conv / n : 0;
  // aproximação normal sobre a posterior; suficiente para exibição
  const a = 1 + conv, b = 1 + Math.max(0, n - conv);
  const m = a / (a + b);
  const v = (a * b) / ((a + b) ** 2 * (a + b + 1));
  const s = Math.sqrt(v);
  return { taxa: p, baixo: Math.max(0, m - 1.96 * s), alto: Math.min(1, m + 1.96 * s) };
}

/**
 * Quantas sessões por variante faltam para decidir.
 * Duas proporções, poder 80%, significância 5%.
 */
export function amostraNecessaria(taxaBase, efeitoRelativo = 0.2) {
  const p1 = Math.max(0.001, taxaBase);
  const p2 = p1 * (1 + efeitoRelativo);
  const pm = (p1 + p2) / 2;
  const num = 1.96 * Math.sqrt(2 * pm * (1 - pm)) + 0.84 * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((num ** 2) / ((p2 - p1) ** 2));
}

const LIMIAR = 0.95;

/**
 * O veredito do teste. `randomizado` muda tudo: sem sorteio simultâneo não há
 * teste, há duas coisas rodando em períodos diferentes — e a diferença pode
 * ser mix de tráfego, não a página.
 */
export function vereditoTeste({ nomeA, convA, nA, nomeB, convB, nB, randomizado }) {
  const pB = probabilidadeMelhor(convA, nA, convB, nB);
  const iA = intervalo(convA, nA), iB = intervalo(convB, nB);
  const lift = iA.taxa ? (iB.taxa - iA.taxa) / iA.taxa : null;
  const falta = Math.max(0, amostraNecessaria(iA.taxa) - Math.min(nA, nB));

  if (!randomizado) {
    return {
      pB, iA, iB, lift, falta, decidido: false,
      titulo: 'Comparação, não teste',
      texto: `${nomeB} converteu ${fmtPct(iB.taxa)} contra ${fmtPct(iA.taxa)} de ${nomeA}. ` +
             'Como o tráfego não foi sorteado entre as duas, essa diferença pode ser da página ' +
             'ou do público que calhou de cair em cada uma — não dá para separar as duas coisas.',
      acao: 'Para virar teste de verdade, ligue o split simultâneo: a Régua sorteia o visitante ' +
            'na chegada e aí a comparação passa a ter vencedor.',
    };
  }

  if (pB === null) {
    return { pB, iA, iB, lift, falta, decidido: false,
      titulo: 'Volume alto demais para o cálculo exato',
      texto: 'Compare por recorte menor ou por período.', acao: '' };
  }

  const claro = pB >= LIMIAR || pB <= 1 - LIMIAR;
  const vencedor = pB >= 0.5 ? nomeB : nomeA;
  const conf = pB >= 0.5 ? pB : 1 - pB;

  if (!claro) {
    return {
      pB, iA, iB, lift, falta, decidido: false,
      titulo: 'Ainda empatado',
      texto: `${fmtPct(conf, 0)} de chance de ${vencedor} ser melhor — abaixo dos 95% que ` +
             'valem uma decisão. Os intervalos das duas ainda se sobrepõem.',
      acao: falta > 0
        ? `Faltam cerca de ${falta.toLocaleString('pt-BR')} sessões por variante para decidir.`
        : 'Se o volume já é alto e nada se separa, a diferença provavelmente não existe. Teste outra hipótese.',
    };
  }

  return {
    pB, iA, iB, lift, falta: 0, decidido: true, vencedor,
    titulo: `${vencedor} venceu`,
    texto: `${fmtPct(conf, 0)} de chance de ser de fato melhor. ` +
           (lift !== null ? `Diferença de ${lift > 0 ? '+' : ''}${(lift * 100).toFixed(0)}% na conversão.` : ''),
    acao: 'Suba a vencedora para todo o tráfego e comece o próximo teste com uma alteração só.',
  };
}

const fmtPct = (v, d = 2) => `${(v * 100).toFixed(d).replace('.', ',')}%`;
