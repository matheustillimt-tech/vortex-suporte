-- =====================================================================
-- Realtime via BROADCAST (não Postgres Changes) pro widget.
--
-- Por quê?  O widget usa anon key — não tem identidade Supabase.
-- Postgres Changes respeita RLS: como anon não tem SELECT em messages,
-- não recebe eventos. Resultado: cliente não via mensagens do agente
-- em tempo real (precisava refresh).
--
-- Solução: trigger Postgres que faz realtime.send() em canal PÚBLICO
-- (private=false) toda vez que uma message é inserida OU conversation
-- é atualizada. Widget assina o canal `wc:<id>` e recebe o payload.
--
-- Channel name: "wc:<uuid>" — uuid é difícil de adivinhar e só vaza
-- pelo session token do widget. Aceitável pra v1.
-- =====================================================================

-- Broadcast de nova mensagem
create or replace function public.broadcast_new_message_to_widget()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id',              new.id,
      'conversation_id', new.conversation_id,
      'author_type',     new.author_type,
      'author_id',       new.author_id,
      'author_name',     new.author_name,
      'body',            new.body,
      'attachments',     new.attachments,
      'created_at',      new.created_at
    ),
    'new_message',                            -- event
    'wc:' || new.conversation_id::text,       -- topic
    false                                     -- private? (false = público)
  );
  return new;
exception when others then
  -- nunca aborta o INSERT por causa de broadcast falho
  raise warning 'broadcast_new_message_to_widget failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists messages_widget_broadcast on public.messages;
create trigger messages_widget_broadcast
  after insert on public.messages
  for each row execute function public.broadcast_new_message_to_widget();

-- Broadcast de atualização de conversa (status, assigned_agent)
create or replace function public.broadcast_conv_update_to_widget()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  -- só broadcast se algo relevante mudou
  if new.status is distinct from old.status
     or new.assigned_agent_id is distinct from old.assigned_agent_id
     or new.first_message_at is distinct from old.first_message_at
     or new.closed_at is distinct from old.closed_at then
    perform realtime.send(
      jsonb_build_object(
        'id',                new.id,
        'status',            new.status,
        'assigned_agent_id', new.assigned_agent_id,
        'first_message_at',  new.first_message_at,
        'last_message_at',   new.last_message_at,
        'closed_at',         new.closed_at
      ),
      'conv_update',
      'wc:' || new.id::text,
      false
    );
  end if;
  return new;
exception when others then
  raise warning 'broadcast_conv_update_to_widget failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists conversations_widget_broadcast on public.conversations;
create trigger conversations_widget_broadcast
  after update on public.conversations
  for each row execute function public.broadcast_conv_update_to_widget();
