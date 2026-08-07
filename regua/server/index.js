import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, listPages, facets } from './db.js';
import { ingest, convert } from './ingest.js';
import { compute, comparison } from './metrics.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const PORT = Number(process.env.PORT || 8787);
const DB_FILE = process.env.REGUA_DB || join(ROOT, 'data', 'regua.db');

const db = open(DB_FILE);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// GIF transparente de 1px, para conversão em páginas que não rodam JS.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/* ── limite de vazão ──────────────────────────────────────────────────
   /e aceita qualquer origem — é o que um tracker instalado em domínio de
   terceiro exige. Sem limite, qualquer um infla os números da sua página.

   A promessa de não guardar IP continua de pé: o endereço é reduzido a um
   número com um sal aleatório do processo, mora só na memória e desaparece
   quando o servidor reinicia. Nada disso encosta no banco.

   Os limites são folgados de propósito. Operadoras de celular colocam milhares
   de assinantes atrás de um mesmo IP: apertar aqui descartaria visitante real e
   subcontaria em silêncio, que é exatamente o erro que a proposta promete não
   cometer. Uma sessão gasta de 2 a 6 requisições, então 60/s sustentados de um
   único endereço já é implausível para uma página só — mas segura uma enxurrada. */
const SALT = Math.random().toString(36);
const buckets = new Map();
const CAP = 600, REFILL = 60;

function bucketKey(req) {
  const ip = req.socket.remoteAddress || '?';
  let h = 0;
  const s = SALT + ip;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function allow(req) {
  const k = bucketKey(req), now = Date.now();
  let b = buckets.get(k);
  if (!b) { b = { t: CAP, at: now }; buckets.set(k, b); }
  b.t = Math.min(CAP, b.t + ((now - b.at) / 1000) * REFILL);
  b.at = now;
  if (b.t < 1) return false;
  b.t -= 1;
  return true;
}

setInterval(() => {
  const cut = Date.now() - 600000;
  for (const [k, b] of buckets) if (b.at < cut) buckets.delete(k);
}, 300000).unref();

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*', ...extra });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('payload grande demais')); req.destroy(); return; }
      data += c;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function serveStatic(res, rel) {
  // normalize + prefixo obrigatório: sem isso, ../../etc/passwd sai pela porta.
  const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!path.startsWith(ROOT)) return send(res, 403, '{"erro":"proibido"}');
  try {
    const buf = await readFile(path);
    const ext = path.slice(path.lastIndexOf('.'));
    send(res, 200, buf, TYPES[ext] || 'application/octet-stream',
         ext === '.js' && rel.includes('tracker') ? { 'cache-control': 'public, max-age=300' } : {});
  } catch {
    send(res, 404, '{"erro":"não encontrado"}');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return send(res, 204, '', 'text/plain', {
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    });
  }

  // ── coleta ──────────────────────────────────────────────────────────
  if (path === '/e' && req.method === 'POST') {
    if (!allow(req)) return send(res, 429, '{"erro":"excesso de requisições"}');
    try {
      ingest(db, await readBody(req));
      return send(res, 204, '');
    } catch (e) {
      return send(res, 400, JSON.stringify({ erro: e.message }));
    }
  }

  // ── conversão reportada de fora da página ───────────────────────────
  if (path === '/c' || path === '/c.gif') {
    const ok = convert(db, url.searchParams.get('s') || url.searchParams.get('rg_s'));
    if (path === '/c.gif') {
      return send(res, 200, PIXEL, 'image/gif', { 'cache-control': 'no-store' });
    }
    return send(res, ok ? 200 : 404, JSON.stringify({ ok }));
  }

  // ── API do painel ───────────────────────────────────────────────────
  if (path === '/api/pages') return send(res, 200, JSON.stringify(listPages(db)));

  if (path === '/api/facets') {
    const p = url.searchParams.get('page');
    return send(res, 200, JSON.stringify(facets(db, p)));
  }

  if (path === '/api/metrics') {
    const page = url.searchParams.get('page');
    const device = url.searchParams.get('device') || 'mobile';
    const a = url.searchParams.get('version');
    const b = url.searchParams.get('compare');
    if (!page) return send(res, 400, '{"erro":"page obrigatório"}');

    const out = b ? comparison(db, page, a, b, device) : compute(db, page, a || '1', device);
    if (!out) return send(res, 404, '{"erro":"página sem dados"}');
    return send(res, 200, JSON.stringify(out));
  }

  // ── estáticos ───────────────────────────────────────────────────────
  if (path === '/r.js') return serveStatic(res, 'tracker/r.js');
  if (path === '/' || path === '/index.html') return serveStatic(res, 'dashboard/index.html');
  if (path.startsWith('/dashboard/') || path.startsWith('/demo/')) return serveStatic(res, path.slice(1));

  send(res, 404, '{"erro":"não encontrado"}');
});

server.listen(PORT, () => {
  console.log(`Régua rodando em http://localhost:${PORT}`);
  console.log(`  painel   http://localhost:${PORT}/`);
  console.log(`  tracker  http://localhost:${PORT}/r.js`);
  console.log(`  banco    ${DB_FILE}`);
});
