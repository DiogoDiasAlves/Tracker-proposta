-- Régua — esquema de dados
--
-- Princípio que governa este arquivo: a proposta promete "sem nome, e-mail, cookie
-- ou identificação, sem IP armazenado". Não existe coluna aqui capaz de guardar
-- qualquer uma dessas coisas. O identificador de sessão é gerado no navegador,
-- vive em sessionStorage e morre quando a aba fecha.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pages (
  id         INTEGER PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,   -- data-page do script
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY,
  sid          TEXT NOT NULL UNIQUE, -- gerado no cliente, some ao fechar a aba
  page_id      INTEGER NOT NULL REFERENCES pages(id),
  version      TEXT NOT NULL,        -- data-version
  device       TEXT NOT NULL,        -- 'mobile' | 'desktop'
  started_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  seq          INTEGER NOT NULL DEFAULT 0, -- descarta lotes fora de ordem

  -- saída: bloco visível mais profundo no encerramento
  exit_block   TEXT,
  exit_via_cta INTEGER NOT NULL DEFAULT 0, -- 1 = clicou CTA e saiu para o checkout
  converted    INTEGER NOT NULL DEFAULT 0,

  -- origem de tráfego: coletada desde já, sem filtro no painel ainda.
  -- A proposta trata isso como "versão final"; guardar agora evita descobrir
  -- daqui a três meses que os dados históricos não existem.
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  referrer_host TEXT                 -- só o host, nunca a URL completa
);

CREATE INDEX IF NOT EXISTS idx_sessions_lookup
  ON sessions(page_id, version, device, started_at);

-- Uma linha por (sessão, bloco). A linha só nasce quando o bloco satisfaz a
-- regra de visibilidade — por isso a existência da linha É o alcance.
CREATE TABLE IF NOT EXISTS block_stats (
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  block      TEXT NOT NULL,          -- data-block
  ord        INTEGER NOT NULL,       -- posição na página (0-indexed)
  height     INTEGER NOT NULL,       -- altura renderizada, para o tempo por 100px
  dwell_ms   INTEGER NOT NULL,       -- acumulado, só com a aba em primeiro plano
  entries    INTEGER NOT NULL,       -- 1 = leitura linear; >1 = voltou
  PRIMARY KEY (session_id, block)
);

CREATE INDEX IF NOT EXISTS idx_block_stats_block ON block_stats(block);

CREATE TABLE IF NOT EXISTS cta_clicks (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  cta        TEXT NOT NULL,          -- data-cta
  block      TEXT,                   -- bloco onde o CTA vive
  at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cta_session ON cta_clicks(session_id);
