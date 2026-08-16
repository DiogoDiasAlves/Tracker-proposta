-- ═══════════════════════════════════════════════════════════════════════
-- 0010 — URL do vídeo nativo
--
-- Só para <video> próprio do cliente, com arquivo público (http/https). É o
-- que permite o painel mostrar o vídeo de verdade em vez de só o nome —
-- sem hospedar nada, só apontando pro arquivo que já existe na página do
-- cliente. YouTube e Vimeo não precisam disto: o id já é público e o embed
-- se monta a partir dele. VTurb não tem URL própria reaproveitável.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE vsl_playback ADD COLUMN url TEXT;
