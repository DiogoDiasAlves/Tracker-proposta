-- ═══════════════════════════════════════════════════════════════════════
-- 0012 — tour de instalação
--
-- NULL = ainda não viu. Quem já tinha conta antes desta coluna existir não
-- pode ser pego de surpresa por um tutorial do nada — por isso o backfill
-- marca todo mundo que já existe como concluído; só quem se cadastra a
-- partir de agora nasce com NULL e vê o tour no primeiro login.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN tour_concluido_em TIMESTAMPTZ;
UPDATE users SET tour_concluido_em = now();
