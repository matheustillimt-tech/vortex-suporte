-- =====================================================================
-- Broadcast de UPDATE em messages → widget vê edição/exclusão em tempo real.
-- Complemento da 0017_message_edit_delete — trigger separado pra não
-- depender de re-aplicar a migration anterior.
-- =====================================================================

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
