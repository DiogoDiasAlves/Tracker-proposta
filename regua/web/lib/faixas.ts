/* Faixas de queda e suas cores.
   Módulo neutro de propósito: isto é chamado tanto por componente de servidor
   (lista de páginas) quanto por componente de cliente (mapa, tabela). Morando
   dentro do módulo 'use client', o servidor não consegue invocar. */

export type Faixa = 'bom' | 'atencao' | 'ruim' | 'base';

/** A queda tem leitura de ESTADO, não de rampa contínua. */
export function faixaQueda(drop: number | null, primeiro: boolean): Faixa {
  if (primeiro || drop === null) return 'base';
  if (drop < 10) return 'bom';
  if (drop < 20) return 'atencao';
  return 'ruim';
}

/* Marca de gráfico: passos próprios do modo escuro, validados. */
export const MARCA: Record<Faixa, string> = {
  bom: 'var(--color-mark-good)',
  atencao: 'var(--color-mark-warn)',
  ruim: 'var(--color-mark-bad)',
  base: 'var(--color-mark-base)',
};

/* Texto: variantes mais claras, todas >= 4.5:1. */
export const TEXTO: Record<Faixa, string> = {
  bom: 'var(--color-accent)',
  atencao: 'var(--color-warn)',
  ruim: 'var(--color-danger)',
  base: 'var(--color-muted)',
};
