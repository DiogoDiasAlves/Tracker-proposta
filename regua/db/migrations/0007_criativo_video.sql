-- ═══════════════════════════════════════════════════════════════════════
-- 0007 — métricas de vídeo DO ANÚNCIO
--
-- Distinção que muda a leitura inteira: estas colunas medem a retenção do
-- criativo NO FEED, antes do clique. A curva que a Régua já tinha mede a
-- retenção da VSL na página, DEPOIS do clique.
--
-- São duas metades do mesmo funil, e é justamente por terem as duas que dá
-- para separar "o gancho não segura" de "a página não converte" — sem isso,
-- CPA ruim é ambíguo.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE meta_ad_insights
  ADD COLUMN views_3s   BIGINT NOT NULL DEFAULT 0,  -- parou de rolar
  ADD COLUMN thruplays  BIGINT NOT NULL DEFAULT 0,  -- assistiu o corpo
  ADD COLUMN v25        BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN v50        BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN v75        BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN v100       BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN compras    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN receita    NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Miniatura e id do vídeo do criativo, para o painel mostrar QUAL anúncio é.
-- Número sem o criativo ao lado obriga a pessoa a abrir o Gerenciador para
-- lembrar do que se trata.
ALTER TABLE meta_ad_insights
  ADD COLUMN thumb_url  TEXT,
  ADD COLUMN video_id   TEXT;
