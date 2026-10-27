-- =====================================================================
-- Vórtex Suporte — schema inicial
-- =====================================================================

create extension if not exists "pgcrypto";

-- ------- Departments ----------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ------- Agents ---------------------------------------------------------
create table if not exists public.agents (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'agent' check (role in ('agent','admin')),
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------- Contacts (clientes do seu site ou app) -------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  email text not null,
  name text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists contacts_email_idx on public.contacts (email);

-- ------- Conversations --------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting','in_progress','closed')),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  first_message_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists conv_status_first_msg_idx
  on public.conversations (status, first_message_at);

create index if not exists conv_contact_idx
  on public.conversations (contact_id, status);

-- ------- Messages -------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_type text not null check (author_type in ('contact','agent','system','bot')),
  author_id uuid,
  body text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists msg_conv_created_idx
  on public.messages (conversation_id, created_at);

-- ------- Triggers -------------------------------------------------------

-- Atualiza last_message_at na conversa quando chega mensagem nova
create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conv on public.messages;
create trigger messages_touch_conv
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- Regra anti-manipulação: first_message_at é imutável após a criação.
create or replace function public.protect_first_message_at()
returns trigger language plpgsql as $$
begin
  if new.first_message_at <> old.first_message_at then
    new.first_message_at := old.first_message_at;
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_lock_first_msg on public.conversations;
create trigger conversations_lock_first_msg
  before update on public.conversations
  for each row execute function public.protect_first_message_at();

-- Helper: posição na fila
create or replace function public.queue_position(conv_id uuid)
returns int language sql stable as $$
  select coalesce(
    (select count(*)::int + 1 from public.conversations c
      where c.status = 'waiting'
        and c.first_message_at <
            (select first_message_at from public.conversations where id = conv_id)),
    1
  );
$$;

-- ------- Realtime publication -----------------------------------------
-- Garante que as tabelas certas estão na publication padrão (supabase_realtime).
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.conversations';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.messages';
  exception when duplicate_object then null;
  end;
end$$;
