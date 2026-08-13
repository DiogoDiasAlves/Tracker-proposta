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
const destino = join(root, 'dist', 'r.js');
writeFileSync(destino, saida);

const kb = (Buffer.byteLength(saida) / 1024).toFixed(1);
console.log(`dist/r.js  ${kb} KB  (${PARTES.join(' + ')})`);
