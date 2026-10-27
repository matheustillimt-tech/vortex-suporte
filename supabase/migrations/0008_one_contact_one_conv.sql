-- =====================================================================
-- 1 contato = 1 conversa
--   * Permite reabrir conversas closed (mexer em first_message_at e status)
--   * Tabela contact_notes (observações internas do atendente)
--   * Tabela conversation_events (linha do tempo: created/reopened/closed/transferred)
-- =====================================================================

-- 1. Relaxa o trigger anti-manipulação: agora só impede update de first_message_at
--    enquanto a conversa está waiting/in_progress. Quando ela está closed e
--    voltar pra waiting, faz sentido atualizar (vai pro fim da nova fila).
create or replace function public.protect_first_message_at()
returns trigger language plpgsql as $$
begin
  if old.status in ('waiting','in_progress')
     and new.status in ('waiting','in_progress')
     and new.first_message_at <> old.first_message_at then
    new.first_message_at := old.first_message_at;
  end if;
  return new;
end;
$$;

-- 2. Notas internas (visíveis apenas pra agents)
create table if not exists public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  author_id uuid references public.agents(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);

alter table public.contact_notes enable row level security;

drop policy if exists "agents read notes" on public.contact_notes;
create policy "agents read notes" on public.contact_notes for select to authenticated
  using (public.is_agent());

drop policy if exists "agents write notes" on public.contact_notes;
create policy "agents write notes" on public.contact_notes for all to authenticated
  using (public.is_agent()) with check (public.is_agent());

-- 3. Linha do tempo de eventos da conversa
do $$ begin
  create type public.conversation_event_type as enum
    ('created','assigned','transferred','closed','reopened','note');
exception when duplicate_object then null; end $$;

create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  type public.conversation_event_type not null,
  actor_id uuid, -- agent_id ou null se sistema
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists conv_events_conv_idx on public.conversation_events (conversation_id, created_at);

alter table public.conversation_events enable row level security;

drop policy if exists "agents read events" on public.conversation_events;
create policy "agents read events" on public.conversation_events for select to authenticated
  using (public.is_agent());

-- 4. Trigger: emite evento quando status muda
create or replace function public.emit_conversation_event()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.conversation_events (conversation_id, type, data)
      values (new.id, 'created', jsonb_build_object('status', new.status));
    return new;
  end if;

  -- UPDATE: detecta transições relevantes
  if new.status is distinct from old.status then
    if new.status = 'closed' then
      insert into public.conversation_events (conversation_id, type, actor_id, data)
        values (new.id, 'closed', new.assigned_agent_id, jsonb_build_object('from', old.status));
    elsif new.status = 'waiting' and old.status = 'closed' then
      insert into public.conversation_events (conversation_id, type, data)
        values (new.id, 'reopened', '{}'::jsonb);
    end if;
  end if;

  if new.assigned_agent_id is distinct from old.assigned_agent_id then
    if old.assigned_agent_id is null then
      insert into public.conversation_events (conversation_id, type, actor_id, data)
        values (new.id, 'assigned', new.assigned_agent_id, '{}'::jsonb);
    elsif new.assigned_agent_id is not null then
      insert into public.conversation_events (conversation_id, type, actor_id, data)
        values (new.id, 'transferred', new.assigned_agent_id,
                jsonb_build_object('from', old.assigned_agent_id, 'to', new.assigned_agent_id));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists conv_events_trigger_insert on public.conversations;
create trigger conv_events_trigger_insert
  after insert on public.conversations
  for each row execute function public.emit_conversation_event();

drop trigger if exists conv_events_trigger_update on public.conversations;
create trigger conv_events_trigger_update
  after update on public.conversations
  for each row execute function public.emit_conversation_event();

-- 5. Realtime para os novos canais
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.contact_notes';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.conversation_events';
  exception when duplicate_object then null; end;
end $$;

-- 6. Áudio + vídeo no bucket de anexos
update storage.buckets
   set allowed_mime_types = allowed_mime_types || array[
     'audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav',
     'video/webm','video/mp4','video/quicktime','video/ogg'
   ]
 where id = 'support-attachments';

-- 7. Mantém apenas a unicidade lógica: cada contato deve ter no máximo
--    uma conversa ATIVA. (A constraint completa "1 conv por contato" não
--    é segura aplicar agora pois já podem existir múltiplas closed; mas o
--    código garante que sempre reutilizamos a mais recente.)
create unique index if not exists conv_one_active_per_contact
  on public.conversations (contact_id)
  where status in ('waiting', 'in_progress');
