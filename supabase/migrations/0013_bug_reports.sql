-- =====================================================================
-- Bug reports — entidade separada, NÃO confunde com conversas de suporte.
--   * Cliente envia via widget → POST /api/bugs (sem virar conversa)
--   * Admin vê em /admin/bugs (lista + status)
-- =====================================================================

do $$ begin
  create type public.bug_status as enum ('open', 'investigating', 'fixed', 'wont_fix', 'duplicate');
exception when duplicate_object then null; end $$;

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'principal',
  contact_id uuid references public.contacts(id) on delete set null,
  reporter_email text,
  reporter_name text,
  description text not null,
  context jsonb not null default '{}'::jsonb,   -- userAgent, origin, URL, metadata
  attachments jsonb not null default '[]'::jsonb,
  status public.bug_status not null default 'open',
  assigned_agent_id uuid references public.agents(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists bugs_status_created_idx on public.bug_reports (status, created_at desc);
create index if not exists bugs_contact_idx on public.bug_reports (contact_id);

alter table public.bug_reports enable row level security;

drop policy if exists "agents read bugs" on public.bug_reports;
create policy "agents read bugs" on public.bug_reports for select to authenticated
  using (public.is_agent());

drop policy if exists "agents update bugs" on public.bug_reports;
create policy "agents update bugs" on public.bug_reports for update to authenticated
  using (public.is_agent()) with check (public.is_agent());

drop policy if exists "admins delete bugs" on public.bug_reports;
create policy "admins delete bugs" on public.bug_reports for delete to authenticated
  using (public.is_admin());

-- updated_at trigger
drop trigger if exists bugs_touch_updated on public.bug_reports;
create trigger bugs_touch_updated before update on public.bug_reports
  for each row execute function public.touch_updated_at();

-- Realtime
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.bug_reports';
  exception when duplicate_object then null; end;
end $$;
