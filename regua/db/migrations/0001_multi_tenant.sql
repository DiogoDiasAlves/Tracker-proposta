-- ═══════════════════════════════════════════════════════════════════════
-- 0001 — multi-tenant e vocabulário de etapa
--
-- Duas mudanças de fundo em relação ao esquema SQLite:
--
-- 1. account_id nasce em toda tabela de dados. Enxertar isolamento depois é
--    retrabalho garantido, e um vazamento entre clientes é o pior defeito
--    possível num produto de analytics.
--
-- 2. `block` vira `step`. Página, VSL e quiz são o mesmo funil de etapas
--    ordenadas — só muda o que é etapa. Um vocabulário, três produtos.
--
-- O que NÃO muda: continua sem coluna capaz de guardar nome, e-mail, cookie
-- ou IP. A promessa da proposta é estrutural, não é política de uso.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE accounts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (account_id, user_id)
);

-- Chave pública, viaja no atributo data-key do script. Não autoriza leitura
-- de nada — só diz de qual conta é o evento que está chegando.
CREATE TABLE api_keys (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  site_key   TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- Agrupa assets que competem entre si, para a comparação de páginas
-- diferentes da mesma campanha.
CREATE TABLE campaigns (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O que é medido. Criado sozinho no primeiro evento: não há cadastro de
-- oferta a fazer, que é promessa do produto desde a proposta.
CREATE TABLE assets (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id  BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL DEFAULT 'page' CHECK (kind IN ('page','vsl','quiz')),
  key         TEXT NOT NULL,          -- data-page do script
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, key)
);

CREATE TABLE sessions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  asset_id      BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  sid           TEXT NOT NULL,        -- gerado no navegador, morre com a aba
  version       TEXT NOT NULL,
  device        TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL,
  seq           BIGINT NOT NULL DEFAULT 0,

  exit_step     TEXT,
  exit_via_cta  BOOLEAN NOT NULL DEFAULT false,
  converted     BOOLEAN NOT NULL DEFAULT false,

  -- variante do split simultâneo; NULL quando não há teste rodando
  variant       TEXT,

  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  utm_term      TEXT,
  -- id do anúncio na Meta, extraído de utm_content quando vem {{ad.id}}.
  -- É a chave que amarra gasto de criativo a comportamento na página.
  ad_id         TEXT,
  referrer_host TEXT,

  UNIQUE (account_id, sid)
);

CREATE INDEX idx_sessions_lookup ON sessions (asset_id, version, device, started_at);
CREATE INDEX idx_sessions_ad     ON sessions (account_id, ad_id) WHERE ad_id IS NOT NULL;

-- Uma linha por (sessão, etapa). A linha só nasce quando a etapa satisfaz a
-- regra de visibilidade — por isso a existência da linha É o alcance.
CREATE TABLE step_stats (
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step       TEXT NOT NULL,
  ord        INTEGER NOT NULL,
  height     INTEGER NOT NULL DEFAULT 0,  -- px renderizados; para o tempo por 100px
  dwell_ms   INTEGER NOT NULL DEFAULT 0,  -- só com a aba em primeiro plano
  entries    INTEGER NOT NULL DEFAULT 0,  -- 1 = linear; >1 = voltou
  extra      JSONB,                       -- específico do tipo de asset
  PRIMARY KEY (session_id, step)
);

CREATE INDEX idx_step_stats_step ON step_stats (step);

CREATE TABLE cta_clicks (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  cta        TEXT NOT NULL,
  step       TEXT,
  at         TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cta_session ON cta_clicks (session_id);
