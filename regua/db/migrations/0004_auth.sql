-- ═══════════════════════════════════════════════════════════════════════
-- 0004 — login
--
-- Sessão de USUÁRIO, que não tem nada a ver com a sessão de visitante que o
-- tracker cria. Nomes separados de propósito: confundir as duas seria o tipo
-- de erro que vaza dado entre contas.
--
-- O token nunca é gravado em claro: guarda-se o SHA-256 dele. Vazamento do
-- banco não vira sessão ativa de ninguém.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  criada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_user_sessions_user ON user_sessions (user_id);
