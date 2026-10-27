-- =====================================================================
-- Adiciona suporte a ícone customizado (imagem) nos blocos da home.
-- Quando icon_url está preenchida, ela tem prioridade sobre o icon (Lucide).
-- =====================================================================
alter table public.home_blocks
  add column if not exists icon_url text;
