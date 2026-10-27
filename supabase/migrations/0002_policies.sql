-- =====================================================================
-- RLS policies
-- =====================================================================
-- Convenções:
--  * Tudo é acessível pra agentes autenticados (auth.uid() in agents).
--  * Contato (cliente do seu site ou app) NÃO se autentica no Supabase — acessa
--    via API routes do Next.js usando service_role (bypassa RLS).
--    Portanto não há policies pra anon role aqui.
-- =====================================================================

alter table public.departments  enable row level security;
alter table public.agents       enable row level security;
alter table public.contacts     enable row level security;
alter table public.conversations enable row level security;
alter table public.messages     enable row level security;

-- Helper inline: o uid logado é um agent?
create or replace function public.is_agent()
returns boolean language sql stable as $$
  select exists (select 1 from public.agents where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (select 1 from public.agents where id = auth.uid() and role = 'admin');
$$;

-- ----- departments
drop policy if exists "agents read departments" on public.departments;
create policy "agents read departments"
  on public.departments for select to authenticated
  using (public.is_agent());

drop policy if exists "admins write departments" on public.departments;
create policy "admins write departments"
  on public.departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----- agents
drop policy if exists "agents read agents" on public.agents;
create policy "agents read agents"
  on public.agents for select to authenticated
  using (public.is_agent());

drop policy if exists "agents update self" on public.agents;
create policy "agents update self"
  on public.agents for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admins write agents" on public.agents;
create policy "admins write agents"
  on public.agents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----- contacts
drop policy if exists "agents read contacts" on public.contacts;
create policy "agents read contacts"
  on public.contacts for select to authenticated
  using (public.is_agent());

drop policy if exists "agents update contacts" on public.contacts;
create policy "agents update contacts"
  on public.contacts for update to authenticated
  using (public.is_agent()) with check (public.is_agent());

-- ----- conversations
drop policy if exists "agents read conversations" on public.conversations;
create policy "agents read conversations"
  on public.conversations for select to authenticated
  using (public.is_agent());

drop policy if exists "agents update conversations" on public.conversations;
create policy "agents update conversations"
  on public.conversations for update to authenticated
  using (public.is_agent()) with check (public.is_agent());

-- ----- messages
drop policy if exists "agents read messages" on public.messages;
create policy "agents read messages"
  on public.messages for select to authenticated
  using (public.is_agent());

drop policy if exists "agents insert messages" on public.messages;
create policy "agents insert messages"
  on public.messages for insert to authenticated
  with check (
    public.is_agent()
    and author_type = 'agent'
    and author_id = auth.uid()
  );
