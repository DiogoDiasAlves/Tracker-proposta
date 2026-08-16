/* Conversão com intervalo de credibilidade — o que um analista mostraria em
   vez de duas células de tabela. A régua (linha) diz onde a taxa real
   provavelmente está, não só o ponto observado; quando as duas linhas se
   cruzam, é o próprio desenho dizendo "ainda não dá para separar", sem
   precisar de texto pra isso.

   Servidor, sem interação: com só duas linhas, o número ao lado de cada uma
   já é a leitura completa — hover não acrescentaria nada que valha a
   complexidade de virar client component. */

type Serie = { nome: string; taxa: number; baixo: number; alto: number; cor: 'base' | 'accent' };

const pct = (v: number, d = 2) => `${(v * 100).toFixed(d).replace('.', ',')}%`;

export function IntervaloConversao({
  nomeA, taxaA, baixoA, altoA, nomeB, taxaB, baixoB, altoB,
}: {
  nomeA: string; taxaA: number; baixoA: number; altoA: number;
  nomeB: string; taxaB: number; baixoB: number; altoB: number;
}) {
  const series: Serie[] = [
    { nome: nomeA, taxa: taxaA, baixo: baixoA, alto: altoA, cor: 'base' },
    { nome: nomeB, taxa: taxaB, baixo: baixoB, alto: altoB, cor: 'accent' },
  ];

  const W = 760, H = 118, ml = 12, mr = 12, mt = 14, mb = 26;
  const iw = W - ml - mr;
  const maxV = Math.max(altoA, altoB, 0.0001) * 1.12;
  const x = (v: number) => ml + (v / maxV) * iw;

  const linhaY = [40, 82];
  const sobrepoe = baixoA <= altoB && baixoB <= altoA;

  const marcas = [0, maxV / 2, maxV];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Conversão com intervalo de 95%: ${nomeA} ${pct(taxaA)} (entre ${pct(baixoA)} e ${pct(altoA)}), ${nomeB} ${pct(taxaB)} (entre ${pct(baixoB)} e ${pct(altoB)}).`}>
        {marcas.map((g, i) => (
          <g key={i}>
            <line x1={x(g)} y1={mt} x2={x(g)} y2={H - mb} stroke="var(--color-line)" opacity={i === 0 ? 1 : 0.5} />
            <text x={x(g)} y={H - mb + 15} textAnchor={i === 0 ? 'start' : i === marcas.length - 1 ? 'end' : 'middle'}
                  className="fill-faint text-[10px] tnum">{pct(g, 0)}</text>
          </g>
        ))}

        {/* faixa onde os dois intervalos se sobrepõem: a mesma leitura do
            "ainda empatado" do veredito, mas visual */}
        {sobrepoe && (
          <rect x={x(Math.max(baixoA, baixoB))} y={mt} width={Math.max(0, x(Math.min(altoA, altoB)) - x(Math.max(baixoA, baixoB)))}
                height={H - mb - mt} fill="var(--color-ink)" opacity=".05" />
        )}

        {series.map((s, i) => {
          const cor = s.cor === 'accent' ? 'var(--color-accent)' : 'var(--color-mark-base)';
          const y = linhaY[i];
          return (
            <g key={s.nome}>
              <line x1={x(s.baixo)} y1={y} x2={x(s.alto)} y2={y} stroke={cor} strokeWidth="2" strokeLinecap="round" />
              <line x1={x(s.baixo)} y1={y - 5} x2={x(s.baixo)} y2={y + 5} stroke={cor} strokeWidth="1.5" opacity=".6" />
              <line x1={x(s.alto)} y1={y - 5} x2={x(s.alto)} y2={y + 5} stroke={cor} strokeWidth="1.5" opacity=".6" />
              <circle cx={x(s.taxa)} cy={y} r="5.5" fill={cor} stroke="var(--color-surface)" strokeWidth="2" />
              <text x={ml} y={y - 11} className={`text-[11px] font-medium ${s.cor === 'accent' ? 'fill-accent' : 'fill-muted'}`}>
                {s.nome}
              </text>
              <text x={x(s.taxa)} y={y - 11} textAnchor="middle" className="fill-ink text-[11px] font-semibold tnum">
                {pct(s.taxa)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[11px] text-faint">
        ponto = conversão observada · linha = onde a taxa real provavelmente está (95%)
      </p>
    </div>
  );
}
