-- =====================================================================
-- Marcar atendimento como prioridade / "voltar nesse caso depois".
--   * Marcação do TIME, não pessoal: qualquer atendente vê a marca, e
--     flagged_by registra quem marcou.
--   * Timestamp em vez de boolean: além de marcar, diz DESDE QUANDO o caso
--     está esperando retorno — dá pra ordenar e cobrar os mais antigos.
--   * Colunas nullable, sem default: nenhuma conversa existente muda de
--     comportamento (null = não marcada).
-- =====================================================================

alter table public.conversations
  add column if not exists flagged_at timestamptz,
  add column if not exists flagged_by uuid references public.agents(id) on delete set null;

-- Índice parcial: só as marcadas entram, então fica minúsculo.
create index if not exists conversations_flagged_idx
  on public.conversations (flagged_at desc)
  where flagged_at is not null;
