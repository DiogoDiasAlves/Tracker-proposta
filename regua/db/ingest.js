/*
 * Coleta sobre Postgres.
 *
 * As mesmas garantias da versão SQLite, que continuam valendo:
 *   • totais acumulados, nunca deltas — reenvio é inofensivo
 *   • lote com seq menor é descartado, não sobrescreve estado mais novo
 *   • nome de etapa e de CTA validados: viram rótulo no painel
 * O que entra: toda escrita agora exige uma conta, resolvida pela site key.
 */
import { accountBySiteKey, assetId } from './index.js';

const MAX_BODY = 64 * 1024;
const LABEL_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const label = v => (typeof v === 'string' && LABEL_RE.test(v) ? v : null);
const text = (v, max = 120) => (typeof v === 'string' && v.length ? v.slice(0, max) : null);
function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

/** Meta manda o id do anúncio em utm_content quando as URL tags usam
 *  {{ad.id}}. É a chave que amarra gasto de criativo a comportamento. */
const adIdDe = utmContent => (/^\d{6,}$/.test(utmContent || '') ? utmContent : null);

export async function ingest(db, raw) {
  if (raw.length > MAX_BODY) throw new Error('payload grande demais');

  let p;
  try { p = JSON.parse(raw); } catch { throw new Error('json inválido'); }

  const sid = text(p.s, 64);
  const assetKey = label(p.p);
  const siteKey = text(p.k, 64);
  if (!sid || !assetKey) throw new Error('sessão ou página ausente');
  if (!siteKey) throw new Error('site key ausente');

  const accountId = await accountBySiteKey(db, siteKey);
  if (!accountId) throw new Error('site key desconhecida');

  const version = text(p.v, 32) || '1';
  const device = p.d === 'desktop' ? 'desktop' : 'mobile';
  const seq = clampInt(p.n, 0, 1e9);

  const c = await db.connect();
  try {
    await c.query('BEGIN');

    const aid = await assetId(c, accountId, assetKey, 'page');

    const found = (await c.query(
      `SELECT id, seq FROM sessions WHERE account_id = $1 AND sid = $2 FOR UPDATE`,
      [accountId, sid]
    )).rows[0];

    let sessionId;
    if (!found) {
      const st = p.st || {};
      sessionId = (await c.query(`
        INSERT INTO sessions (account_id, asset_id, sid, version, device,
          started_at, last_seen_at, seq,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, ad_id, referrer_host)
        VALUES ($1,$2,$3,$4,$5, now(), now(), $6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id`,
        [accountId, aid, sid, version, device, seq,
         text(st.us), text(st.um), text(st.uc), text(st.uo), text(st.ut),
         adIdDe(st.uo), text(st.rf)]
      )).rows[0].id;
    } else {
      sessionId = found.id;
      // Lote antigo chegando atrasado não pode sobrescrever estado mais novo.
      if (seq < found.seq) { await c.query('COMMIT'); return { ok: true, stale: true }; }
      await c.query('UPDATE sessions SET last_seen_at = now(), seq = $1 WHERE id = $2',
                    [seq, sessionId]);
    }

    // Totais acumulados: sobrescrever é a operação correta e torna o reenvio
    // inofensivo.
    if (Array.isArray(p.b) && p.b.length) {
      for (const b of p.b.slice(0, 200)) {
        const step = label(b.i);
        if (!step) continue;
        await c.query(`
          INSERT INTO step_stats (session_id, step, ord, height, dwell_ms, entries)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (session_id, step) DO UPDATE SET
            ord = EXCLUDED.ord, height = EXCLUDED.height,
            dwell_ms = EXCLUDED.dwell_ms, entries = EXCLUDED.entries`,
          [sessionId, step, clampInt(b.o, 0, 999), clampInt(b.h, 0, 200000),
           clampInt(b.t, 0, 6 * 3600 * 1000), clampInt(b.e, 0, 10000)]
        );
      }
    }

    // Cliques são reenviados a cada lote; apaga e regrava para não duplicar.
    if (Array.isArray(p.c) && p.c.length) {
      await c.query('DELETE FROM cta_clicks WHERE session_id = $1', [sessionId]);
      for (const k of p.c.slice(0, 100)) {
        const cta = label(k.k);
        if (!cta) continue;
        await c.query(
          `INSERT INTO cta_clicks (session_id, cta, step, at)
           VALUES ($1,$2,$3, to_timestamp($4/1000.0))`,
          [sessionId, cta, label(k.b), clampInt(k.t, 0, 4e12)]
        );
      }
    }

    if (p.x) {
      await c.query('UPDATE sessions SET exit_step = $1, exit_via_cta = $2 WHERE id = $3',
                    [label(p.x.b), !!p.x.cta, sessionId]);
    }
    if (p.cv) await c.query('UPDATE sessions SET converted = true WHERE id = $1', [sessionId]);

    await c.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Conversão reportada de fora da página (obrigado/checkout), via ?rg_s=<sid>. */
export async function convert(db, sid) {
  const s = text(sid, 64);
  if (!s) return false;
  const r = await db.query('UPDATE sessions SET converted = true WHERE sid = $1', [s]);
  return r.rowCount > 0;
}
