-- Fonte do vídeo do criativo, para o painel tocar o anúncio em vez de só
-- mostrar número. Vem de /{video_id}?fields=source, e pode não vir: vídeo
-- de página que não é do anunciante não expõe source. Por isso é opcional,
-- e a tela cai para a miniatura sem quebrar.
ALTER TABLE meta_ad_insights ADD COLUMN video_url TEXT;
