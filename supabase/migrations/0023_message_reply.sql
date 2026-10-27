-- =====================================================================
-- Responder uma mensagem específica (o "responder" dos apps de mensagem).
--   * Resolve o caso do cliente que manda 3 perguntas seguidas: a resposta
--     do atendente passa a apontar exatamente qual delas está respondendo.
--   * on delete set null: se a mensagem citada for removida de vez, a resposta
--     continua existindo, só perde a citação. O fluxo normal é soft delete
--     (deleted_at), e aí a citação permanece mostrando "Mensagem apagada".
--   * Coluna nullable, sem default: nenhuma mensagem existente muda.
-- =====================================================================

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

-- Índice parcial: só as respostas entram.
create index if not exists messages_reply_to_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;
