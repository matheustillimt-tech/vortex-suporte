-- =====================================================================
-- Edição e exclusão de mensagens — como nos apps de mensagem.
--
-- Regras:
--   • Autor pode editar/apagar a própria mensagem (agente ou contato).
--   • Lado CLIENTE (widget) vê "Mensagem apagada" — o conteúdo some.
--   • Lado AGENTE (dashboard) continua vendo o original + selo "apagada por X"
--     pra dar trilha de moderação.
--   • Edição apenas marca `edited_at` — não guardamos versões anteriores.
-- =====================================================================

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_type text check (deleted_by_type in ('agent','contact')),
  add column if not exists deleted_by_id uuid,
  add column if not exists deleted_by_name text;

-- Policy: agente autenticado pode atualizar mensagens.
-- (Widget anon edita via API com session token — checagem fica na rota.)
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname='public' and tablename='messages' and policyname='messages_update_auth'
  ) then
    create policy messages_update_auth on public.messages
      for update to authenticated using (true) with check (true);
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Broadcast de UPDATE pra widget (edição/exclusão chega em tempo real).
-- ---------------------------------------------------------------------
create or replace function public.broadcast_msg_update_to_widget()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  if new.body is distinct from old.body
     or new.attachments is distinct from old.attachments
     or new.edited_at is distinct from old.edited_at
     or new.deleted_at is distinct from old.deleted_at then
    perform realtime.send(
      jsonb_build_object(
        'id',              new.id,
        'conversation_id', new.conversation_id,
        'body',            new.body,
        'attachments',     new.attachments,
        'edited_at',       new.edited_at,
        'deleted_at',      new.deleted_at,
        'deleted_by_type', new.deleted_by_type,
        'deleted_by_name', new.deleted_by_name
      ),
      'msg_update',
      'wc:' || new.conversation_id::text,
      false
    );
  end if;
  return new;
exception when others then
  raise warning 'broadcast_msg_update_to_widget failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists messages_update_widget_broadcast on public.messages;
create trigger messages_update_widget_broadcast
  after update on public.messages
  for each row execute function public.broadcast_msg_update_to_widget();
