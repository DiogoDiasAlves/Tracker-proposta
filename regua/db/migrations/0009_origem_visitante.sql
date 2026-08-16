-- ═══════════════════════════════════════════════════════════════════════
-- 0009 — país, sistema operacional e navegador
--
-- Os três vêm de dados que o servidor JÁ recebe em toda requisição (o
-- cabeçalho User-Agent e o IP de origem) — não pedem nada novo do tracker.
--
-- País é derivado do IP no momento do ingest e o IP em si nunca é gravado:
-- essa é a mesma promessa que já vale para o limitador de vazão em
-- web/lib/coleta.ts. O que fica no banco é só o código do país (BR, US…).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sessions
  ADD COLUMN pais TEXT,
  ADD COLUMN sistema_operacional TEXT,
  ADD COLUMN navegador TEXT;

CREATE INDEX idx_sessions_pais ON sessions (account_id, pais) WHERE pais IS NOT NULL;
