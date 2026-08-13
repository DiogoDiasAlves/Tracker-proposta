/*
 * Testa a regra de visibilidade do tracker sem navegador: monta um DOM falso
 * com blocos em posições conhecidas, controla o relógio e verifica se a
 * contagem bate com o que a proposta promete.
 *
 *   node tools/testar-tracker.js
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// O bundle, não os fontes: é exatamente o arquivo que vai para a página do
// cliente. Testar as partes soltas deixaria a concatenação sem cobertura.
const SRC = readFileSync(join(here, '..', 'dist', 'r.js'), 'utf8');

const VIEWPORT = 800;

function harness(layout, sharedStore) {
  let scrollY = 0;
  let visibility = 'visible';
  const timers = [];
  let now = 0;
  const sent = [];

  const blocks = layout.map(b => ({
    ...b,
    getBoundingClientRect() {
      return { top: b.top - scrollY, bottom: b.top + b.height - scrollY, height: b.height };
    },
    getAttribute: k => (k === 'data-block' ? b.id : null),
    hasAttribute: k => k === 'data-block',
    parentNode: null,
  }));

  const script = {
    src: 'http://localhost:8787/r.js',
    getAttribute: k => ({
      'data-key': 'rg_teste', 'data-page': 'teste',
      'data-version': '1', 'data-endpoint': null,
    }[k] ?? null),
  };

  const doc = {
    currentScript: script,
    get visibilityState() { return visibility; },
    referrer: '',
    body: {},
    querySelectorAll: sel => (sel === '[data-block]' ? blocks : []),
    querySelector: sel => (sel === '[data-block]' ? blocks[0] || null : null),
    addEventListener: () => {},
  };

  // Compartilhar o store entre dois harnesses simula um F5: a aba é a mesma,
  // o script é carregado de novo.
  const store = sharedStore || new Map();
  const ctx = {
    document: doc,
    navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', sendBeacon: () => true },
    location: { href: 'http://exemplo.com/p', search: '', host: 'exemplo.com' },
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    innerHeight: VIEWPORT,
    innerWidth: 1400,
    matchMedia: () => ({ matches: false }),
    setInterval: (fn, ms) => { timers.push({ fn, ms, next: now + ms }); return timers.length; },
    addEventListener: () => {},
    URL, URLSearchParams, Blob: class { constructor() {} },
    MutationObserver: null,
    console,
    fetch: (url, opt) => { sent.push(JSON.parse(opt.body)); return Promise.resolve({ ok: true }); },
  };
  ctx.window = ctx;
  createContext(ctx);
  runInContext(SRC, ctx);

  return {
    ctx, sent, store,
    scrollTo(y) { scrollY = y; },
    hide() { visibility = 'hidden'; },
    show() { visibility = 'visible'; },
    /** avança o relógio em passos de 50ms, disparando os timers no caminho */
    advance(ms) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + 50);
        for (const t of timers) while (t.next <= now) { t.next += t.ms; t.fn(); }
      }
    },
    state() { return ctx.regua.debug().page; },
  };
}

/* ── casos ──────────────────────────────────────────────────────────── */
let falhas = 0;
function ok(nome, cond, detalhe = '') {
  console.log(`${cond ? '  ok  ' : '  FALHA '} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!cond) falhas++;
}

const LAYOUT = [
  { id: 'hero', top: 0, height: 720 },
  { id: 'curto', top: 720, height: 200 },     // nunca ocupa metade da tela de 800px
  { id: 'longo', top: 920, height: 1600 },
  { id: 'fim', top: 2520, height: 600 },
];

console.log('\nregra dos 50% / 500ms');
{
  const h = harness(LAYOUT);
  h.scrollTo(0);
  h.advance(400);
  ok('abaixo de 500ms o bloco ainda não conta', !h.state()[0].visto);
  h.advance(200);
  ok('passando de 500ms o bloco conta', h.state()[0].visto);
  ok('primeira entrada registrada', h.state()[0].entradas === 1);
}

console.log('\nbloco baixo (200px numa tela de 800px)');
{
  const h = harness(LAYOUT);
  h.scrollTo(760); // 'curto' fica inteiro na tela, mas ocupa só 25% dela
  h.advance(1000);
  const curto = h.state().find(b => b.bloco === 'curto');
  ok('vale metade da altura do próprio bloco', curto.visto,
     'sem essa regra, um bloco de 200px seria invisível para sempre');
}

console.log('\nrolagem rápida do topo ao rodapé');
{
  const h = harness(LAYOUT);
  for (const y of [0, 400, 900, 1500, 2100, 2600]) { h.scrollTo(y); h.advance(100); }
  const vistos = h.state().filter(b => b.visto);
  ok('arrastar a barra em 1s não registra bloco nenhum', vistos.length === 0,
     `${vistos.length} blocos registrados`);
}

console.log('\nreentradas');
{
  const h = harness(LAYOUT);
  h.scrollTo(0);    h.advance(1000);
  h.scrollTo(2600); h.advance(1000);   // sai do hero
  h.scrollTo(0);    h.advance(1000);   // volta
  ok('voltar ao bloco incrementa a contagem', h.state()[0].entradas === 2,
     `entradas=${h.state()[0].entradas}`);
}

console.log('\naba em segundo plano');
{
  const h = harness(LAYOUT);
  h.scrollTo(0); h.advance(1000);
  const antes = Number(h.state()[0].tempo_s);
  h.hide(); h.advance(60000); h.show();
  const depois = Number(h.state()[0].tempo_s);
  ok('tempo não acumula com a aba escondida', antes === depois,
     `${antes}s -> ${depois}s após 60s em segundo plano`);
}

console.log('\nrecarregar a página (F5) — a proposta promete que não cria sessão nova');
{
  const antes = harness(LAYOUT);
  antes.scrollTo(0); antes.advance(20000);      // lê 20s no hero
  const t1 = Number(antes.state()[0].tempo_s);
  const sid1 = antes.ctx.regua.session();
  const seq1 = antes.sent[antes.sent.length - 1].n;

  const depois = harness(LAYOUT, antes.store);  // F5: mesma aba, script recarregado
  ok('mantém o mesmo id de sessão', depois.ctx.regua.session() === sid1);
  ok('o tempo acumulado sobrevive ao reload', Number(depois.state()[0].tempo_s) === t1,
     `${t1}s antes -> ${depois.state()[0].tempo_s}s depois`);

  depois.scrollTo(0); depois.advance(10000);
  const t2 = Number(depois.state()[0].tempo_s);
  ok('continua somando de onde parou', t2 > t1, `${t1}s -> ${t2}s`);

  const seq2 = depois.sent[depois.sent.length - 1].n;
  ok('o contador de lotes não regride', seq2 > seq1,
     `n=${seq1} antes, n=${seq2} depois — se regredisse, o servidor descartaria tudo`);
}

console.log('\npayload enviado');
{
  const h = harness(LAYOUT);
  h.scrollTo(0); h.advance(1000);
  h.advance(10000);                     // dispara o envio periódico
  const ultimo = h.sent[h.sent.length - 1];
  ok('só blocos qualificados entram no envio', ultimo.b.every(b => b.i === 'hero'),
     JSON.stringify(ultimo.b.map(b => b.i)));
  ok('altura vai junto, para o tempo por 100px', ultimo.b[0].h === 720);
  ok('identifica desktop', ultimo.d === 'desktop');
  ok('id de sessão presente', typeof ultimo.s === 'string' && ultimo.s.length > 6);
}

console.log(falhas ? `\n${falhas} falha(s)\n` : '\ntodos os casos passaram\n');
process.exit(falhas ? 1 : 0);
