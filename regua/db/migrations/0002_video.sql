-- ═══════════════════════════════════════════════════════════════════════
-- 0002 — reprodução de vídeo
--
-- Uma linha por (sessão, vídeo). Os segundos assistidos vêm comprimidos em
-- faixas [inicio, fim): um VSL de 30 minutos cabe em poucas centenas de
-- bytes, e "rever" sai de graça — é a mesma estrutura contada duas vezes.
--
-- `parcial` marca player que não expõe a posição do vídeo. Nesse caso há
-- play e pausa, mas não há curva de retenção. O painel precisa saber a
-- diferença entre "ninguém assistiu" e "não deu para medir".
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE vsl_playback (
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  video      TEXT NOT NULL,
  tipo       TEXT,                      -- html5 | vturb | youtube | vimeo
  duracao    INTEGER NOT NULL DEFAULT 0,
  plays      INTEGER NOT NULL DEFAULT 0,
  max_pos    INTEGER NOT NULL DEFAULT 0,
  faixas     JSONB NOT NULL DEFAULT '[]',  -- assistido ao menos uma vez
  revistas   JSONB NOT NULL DEFAULT '[]',  -- assistido duas ou mais
  autoplay   BOOLEAN NOT NULL DEFAULT false,
  mudo       BOOLEAN NOT NULL DEFAULT false,
  pitch      INTEGER,                   -- segundo em que a oferta aparece
  parcial    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (session_id, video)
);

CREATE INDEX idx_vsl_video ON vsl_playback (video);
