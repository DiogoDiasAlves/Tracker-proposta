/*
 * Monta o tracker que vai para a página do cliente.
 *
 * Concatenação, não bundler. O tracker roda em navegador antigo, precisa ser
 * um único arquivo, não pode ter dependência e não pode ter etapa de build
 * que quebre o deploy. Um `for` que junta arquivos resolve — e mantém o
 * código-fonte separado por coletor em vez de um arquivo de mil linhas.
 *
 *   node tracker/build.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// A ordem importa: o núcleo declara o que os coletores usam, e `start()`
// só roda depois que todos se registraram.
const PARTES = ['core.js', 'page.js', 'vsl.js', 'quiz.js'];

const CABECALHO = `/*!
 * Régua — tracking de funil por etapa
 *
 * Instalação:
 *   <section data-block="hero"> ... </section>
 *   <button data-cta="checkout-principal">Comprar</button>
 *   <script src="https://SEU-HOST/r.js" data-page="oferta-x" data-version="1" defer></script>
 *
 * O que este arquivo NÃO faz, por decisão de projeto: não grava tela, não lê
 * conteúdo de input, não escreve cookie, não identifica ninguém. O id de sessão
 * mora em sessionStorage e desaparece quando a aba fecha.
 *
 * GERADO por tracker/build.js — não edite. Edite ${PARTES.join(', ')}.
 */`;

const corpo = PARTES
  .map(p => `\n/* ═══ ${p} ═══ */\n` + readFileSync(join(here, p), 'utf8'))
  .join('\n');

const saida = `${CABECALHO}
(function () {
  'use strict';
${corpo}

  start();
})();
`;

mkdirSync(join(root, 'dist'), { recursive: true });

/* Duas saídas.

   r.js é o que vai para a página do cliente: minificado, porque 33 KB de
   comentário numa página de vendas é peso que o visitante paga em 3G sem
   receber nada em troca.

   r.dev.js mantém o código legível, para depurar numa página real sem ter de
   reconstruir. O comportamento é o mesmo — muda só o que dá para ler.

   `target: es2017` de propósito: o tracker roda em navegador de gente que a
   gente não escolhe, e sintaxe nova demais quebraria em silêncio justamente
   em quem mais precisa ser medido. */
writeFileSync(join(root, 'dist', 'r.dev.js'), saida);

const min = transformSync(saida, {
  minify: true, target: 'es2017', legalComments: 'inline',
}).code;
writeFileSync(join(root, 'dist', 'r.js'), min);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`dist/r.js      ${kb(Buffer.byteLength(min))}  (minificado)`);
console.log(`dist/r.dev.js  ${kb(Buffer.byteLength(saida))}  (legível)`);
