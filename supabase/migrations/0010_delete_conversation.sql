-- =====================================================================
-- Apagar conversa — só admins.
-- Cascateia em messages, conversation_events (FK ON DELETE CASCADE).
-- Notas do contato NÃO são deletadas (são por contato, não por conversa).
-- =====================================================================
drop policy if exists "admins delete conversations" on public.conversations;
create policy "admins delete conversations" on public.conversations
  for delete to authenticated using (public.is_admin());
