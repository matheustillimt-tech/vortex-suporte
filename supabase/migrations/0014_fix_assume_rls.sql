-- =====================================================================
-- Fix: Assumir atendimento dava 403 (Forbidden) por 2 motivos:
--   1) Trigger emit_conversation_event roda como o usuário autenticado
--      (agente) e tenta INSERT em conversation_events. Não havia policy
--      de INSERT pra essa tabela → trigger falhava → UPDATE inteiro
--      revertia (PATCH /conversations retornava 403)
--   2) Quando o agente insere msg de sistema ("X assumiu o atendimento"),
--      a policy de INSERT exigia author_type='agent' AND author_id=auth.uid().
--      System messages eram bloqueadas.
-- =====================================================================

-- 1) Triggers viram SECURITY DEFINER — rodam com os privilégios do dono
--    da função (postgres), bypassando RLS. É o padrão correto pra triggers
--    de bookkeeping interno.
alter function public.emit_conversation_event()      security definer set search_path = public;
alter function public.touch_conversation_on_message() security definer set search_path = public;
alter function public.protect_first_message_at()     security definer set search_path = public;
alter function public.fill_message_author_name()     security definer set search_path = public;
alter function public.touch_updated_at()             security definer set search_path = public;

-- 2) Policy de INSERT em messages aceita 'system' e 'bot' vindas de agentes
drop policy if exists "agents insert messages" on public.messages;
create policy "agents insert messages" on public.messages for insert to authenticated
  with check (
    public.is_agent()
    and (
      author_type in ('system', 'bot')
      or (author_type = 'agent' and author_id = auth.uid())
    )
  );
