import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function open(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}

/** Cria a página no primeiro evento que chega. Não há cadastro manual. */
export function pageId(db, key) {
  const found = db.prepare('SELECT id FROM pages WHERE key = ?').get(key);
  if (found) return found.id;
  db.prepare('INSERT INTO pages (key, created_at) VALUES (?, ?)').run(key, Date.now());
  return db.prepare('SELECT id FROM pages WHERE key = ?').get(key).id;
}

export function listPages(db) {
  return db.prepare(`
    SELECT p.key, COUNT(s.id) AS sessions, MAX(s.last_seen_at) AS last
    FROM pages p LEFT JOIN sessions s ON s.page_id = p.id
    GROUP BY p.id ORDER BY last DESC NULLS LAST
  `).all();
}

/** Versões e dispositivos que realmente têm dados — o painel só oferece o que existe. */
export function facets(db, key) {
  const p = db.prepare('SELECT id FROM pages WHERE key = ?').get(key);
  if (!p) return { versions: [], devices: [] };
  const rows = db.prepare(`
    SELECT version, device, COUNT(*) AS n FROM sessions
    WHERE page_id = ? GROUP BY version, device
  `).all(p.id);
  return {
    versions: [...new Set(rows.map(r => r.version))].sort(),
    devices: [...new Set(rows.map(r => r.device))].sort(),
    counts: rows,
  };
}
