-- ═══════════════════════════════════════════════════════════════════════
-- 0011 — admin
--
-- Uma flag no usuário, não na conta: admin é quem opera o produto (você),
-- não um plano de cliente. Continua sem cruzar a fronteira de tenant — o
-- painel /admin lê todas as contas de propósito, é o único lugar do código
-- onde isso é correto, e chega lá só quem tem esta flag.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
