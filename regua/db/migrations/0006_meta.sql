-- ═══════════════════════════════════════════════════════════════════════
-- 0006 — integração com a Meta
--
-- O token de conta de anúncios dá acesso de leitura ao gasto de mídia de
-- alguém. Ele NUNCA é gravado em claro: a coluna guarda o resultado de
-- AES-256-GCM, e a chave mora fora do banco, em variável de ambiente. Assim
-- um dump do banco não vira acesso à conta de anúncios de ninguém.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE meta_connections (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id       BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ad_account_id    TEXT,                       -- act_XXXXXXXX; nulo até escolher
  ad_account_name  TEXT,
  token_cifrado    TEXT NOT NULL,              -- AES-256-GCM, nunca em claro
  token_expira_em  TIMESTAMPTZ,
  escopos          TEXT,
  conectado_por    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  conectado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sincronizado_em  TIMESTAMPTZ,
  ultimo_erro      TEXT,
  revogado_em      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_meta_conta_ativa
  ON meta_connections (account_id) WHERE revogado_em IS NULL;

-- Uma linha por (anúncio, dia). time_increment=1 na API dá exatamente isso,
-- e a granularidade diária é o que permite recortar por período depois.
CREATE TABLE meta_ad_insights (
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  dia           DATE NOT NULL,
  ad_id         TEXT NOT NULL,
  adset_id      TEXT,
  campaign_id   TEXT,
  ad_name       TEXT,
  adset_name    TEXT,
  campaign_name TEXT,
  impressoes    BIGINT NOT NULL DEFAULT 0,
  cliques       BIGINT NOT NULL DEFAULT 0,
  alcance       BIGINT NOT NULL DEFAULT 0,
  gasto         NUMERIC(14,2) NOT NULL DEFAULT 0,
  frequencia    NUMERIC(8,3),
  -- conversões como a META conta. Fica ao lado, nunca no lugar, da conversão
  -- que a Régua mede: as duas discordam por construção e o painel mostra as
  -- duas justamente para a diferença ficar visível.
  acoes         JSONB,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, dia, ad_id)
);

CREATE INDEX idx_insights_ad ON meta_ad_insights (account_id, ad_id);
CREATE INDEX idx_insights_dia ON meta_ad_insights (account_id, dia);
