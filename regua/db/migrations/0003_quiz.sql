-- ═══════════════════════════════════════════════════════════════════════
-- 0003 — respostas de quiz
--
-- `opcao` guarda a CHAVE do data-quiz-option, nunca o texto exibido e nunca
-- valor digitado. Não existe coluna aqui capaz de receber texto livre — a
-- garantia é estrutural, igual à ausência de coluna de IP.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE quiz_answers (
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  pergunta   TEXT NOT NULL,
  opcao      TEXT NOT NULL,
  em         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (session_id, pergunta)
);

CREATE INDEX idx_quiz_pergunta ON quiz_answers (pergunta, opcao);

ALTER TABLE sessions
  ADD COLUMN quiz_completo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN quiz_lead     BOOLEAN NOT NULL DEFAULT false;
