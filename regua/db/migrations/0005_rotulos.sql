-- ═══════════════════════════════════════════════════════════════════════
-- 0005 — dicionário de rótulos de opção
--
-- UMA linha por opção do quiz, não por sessão. Essa é a diferença que
-- importa: o rótulo é conteúdo do quiz (copy escrita pelo dono), enquanto a
-- resposta de cada pessoa continua sendo só a chave, em quiz_answers.
--
-- Se algum dia um rótulo trouxer algo indevido, é uma linha — visível,
-- editável e apagável — e não algo espalhado por milhares de sessões.
--
-- A CHAVE continua sendo a identidade. Reescrever "Acima de R$ 300" para
-- "Mais de 300 reais" troca o rótulo e mantém o histórico comparável, pela
-- mesma razão que nome de bloco deve ser estável entre versões.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE quiz_labels (
  asset_id     BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  pergunta     TEXT NOT NULL,
  opcao        TEXT NOT NULL,
  rotulo       TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, pergunta, opcao)
);
