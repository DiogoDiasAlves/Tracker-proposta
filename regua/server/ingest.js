import { pageId } from './db.js';

const MAX_BODY = 64 * 1024;
const BLOCK_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** Nomes de bloco e CTA viram rótulos no painel — não aceite lixo arbitrário. */
function label(v) {
  return typeof v === 'string' && BLOCK_RE.test(v) ? v : null;
}
function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
function text(v, max = 120) {
  return typeof v === 'string' && v.length ? v.slice(0, max) : null;
}

export function ingest(db, raw) {
  if (raw.length > MAX_BODY) throw new Error('payload grande demais');

  let p;
  try { p = JSON.parse(raw); } catch { throw new Error('json inválido'); }

  const sid = text(p.s, 64);
  const pageKey = label(p.p);
  if (!sid || !pageKey) throw new Error('sessão ou página ausente');

  const version = text(p.v, 32) || '1';
  const device = p.d === 'desktop' ? 'desktop' : 'mobile';
  const seq = clampInt(p.n, 0, 1e9);
  const now = Date.now();

  const pid = pageId(db, pageKey);

  const existing = db.prepare('SELECT id, seq FROM sessions WHERE sid = ?').get(sid);
  let sessionId;

  if (!existing) {
    const st = p.st || {};
    db.prepare(`
      INSERT INTO sessions (sid, page_id, version, device, started_at, last_seen_at, seq,
                            utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(sid, pid, version, device, now, now, seq,
           text(st.us), text(st.um), text(st.uc), text(st.uo), text(st.ut), text(st.rf));
    sessionId = db.prepare('SELECT id FROM sessions WHERE sid = ?').get(sid).id;
  } else {
    sessionId = existing.id;
    // Lote antigo chegando atrasado não pode sobrescrever estado mais novo.
    if (seq < existing.seq) return { ok: true, stale: true };
    db.prepare('UPDATE sessions SET last_seen_at = ?, seq = ? WHERE id = ?').run(now, seq, sessionId);
  }

  // Totais acumulados: sobrescrever é a operação correta, e torna o reenvio inofensivo.
  if (Array.isArray(p.b)) {
    const up = db.prepare(`
      INSERT INTO block_stats (session_id, block, ord, height, dwell_ms, entries)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(session_id, block) DO UPDATE SET
        ord = excluded.ord, height = excluded.height,
        dwell_ms = excluded.dwell_ms, entries = excluded.entries
    `);
    for (const b of p.b.slice(0, 200)) {
      const id = label(b.i);
      if (!id) continue;
      up.run(sessionId, id, clampInt(b.o, 0, 999), clampInt(b.h, 0, 200000),
             clampInt(b.t, 0, 6 * 3600 * 1000), clampInt(b.e, 0, 10000));
    }
  }

  // Cliques são reenviados a cada lote; apaga e regrava para não duplicar.
  if (Array.isArray(p.c) && p.c.length) {
    db.prepare('DELETE FROM cta_clicks WHERE session_id = ?').run(sessionId);
    const ins = db.prepare('INSERT INTO cta_clicks (session_id, cta, block, at) VALUES (?,?,?,?)');
    for (const c of p.c.slice(0, 100)) {
      const k = label(c.k);
      if (!k) continue;
      ins.run(sessionId, k, label(c.b), clampInt(c.t, 0, 4e12));
    }
  }

  if (p.x) {
    db.prepare('UPDATE sessions SET exit_block = ?, exit_via_cta = ? WHERE id = ?')
      .run(label(p.x.b), p.x.cta ? 1 : 0, sessionId);
  }

  if (p.cv) db.prepare('UPDATE sessions SET converted = 1 WHERE id = ?').run(sessionId);

  return { ok: true };
}

/** Conversão reportada de fora da página (obrigado/checkout), via ?rg_s=<sid>. */
export function convert(db, sid) {
  const s = text(sid, 64);
  if (!s) return false;
  const r = db.prepare('UPDATE sessions SET converted = 1 WHERE sid = ?').run(s);
  return r.changes > 0;
}
