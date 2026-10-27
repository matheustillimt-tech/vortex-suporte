-- =====================================================================
-- Liga/desliga a mensagem de encerramento sem perder o texto.
--   * Dá pra desativar hoje e religar depois com o mesmo conteúdo, em vez
--     de apagar o campo e ter que reescrever a mensagem.
--   * Default true preserva o comportamento atual: quem espera a despedida
--     não é surpreendido pelo deploy. Desligar é uma decisão explícita
--     no painel (/admin/widget).
-- =====================================================================

alter table public.widget_settings
  add column if not exists closing_message_enabled boolean not null default true;
