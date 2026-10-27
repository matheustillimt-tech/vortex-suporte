-- =====================================================================
-- Widget CMS: settings, home blocks, updates, suggestions, business hours
-- =====================================================================

-- ------- Widget settings (singleton por project) -----------------------
create table if not exists public.widget_settings (
  project_key text primary key default 'principal',
  greeting_title text not null default 'Olá 👋',
  greeting_subtitle text not null default 'Como podemos ajudar você hoje?',
  show_home boolean not null default true,
  show_chat boolean not null default true,
  show_updates boolean not null default true,
  show_suggestions boolean not null default true,
  offline_message text default '⚠️ No momento estamos fora do horário de atendimento. Deixe sua mensagem que respondemos assim que possível.',
  brand_color text not null default '#7c3aed',
  timezone text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);

insert into public.widget_settings (project_key) values ('principal') on conflict do nothing;

-- ------- Home blocks (CTAs configuráveis) ------------------------------
create table if not exists public.home_blocks (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'principal',
  title text not null,
  description text,
  icon text not null default 'MessageCircle', -- nome do ícone Lucide
  accent text not null default 'primary' check (accent in ('primary','blue','red','amber','purple','muted')),
  action_type text not null check (action_type in ('open_chat','open_url','switch_tab','report_bug')),
  action_value text, -- URL para open_url, tab id para switch_tab
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists home_blocks_order_idx on public.home_blocks (project_key, enabled, sort_order);

-- ------- Updates / Changelog -------------------------------------------
create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'principal',
  title text not null,
  excerpt text,
  body text, -- markdown ou html simples
  cover_image_url text,
  pinned boolean not null default false,
  published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists updates_feed_idx on public.updates (project_key, published, pinned desc, published_at desc);

-- ------- Suggestions / Roadmap voting ----------------------------------
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'principal',
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open','planned','in_progress','completed','declined')),
  vote_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suggestions_ranking_idx on public.suggestions (project_key, status, vote_count desc, created_at desc);

create table if not exists public.suggestion_votes (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, contact_id)
);

create or replace function public.refresh_suggestion_vote_count()
returns trigger language plpgsql as $$
begin
  update public.suggestions
     set vote_count = (
       select count(*) from public.suggestion_votes
        where suggestion_id = coalesce(new.suggestion_id, old.suggestion_id)
     )
   where id = coalesce(new.suggestion_id, old.suggestion_id);
  return null;
end$$;

drop trigger if exists suggestion_votes_refresh on public.suggestion_votes;
create trigger suggestion_votes_refresh
  after insert or delete on public.suggestion_votes
  for each row execute function public.refresh_suggestion_vote_count();

-- ------- Business hours por departamento -------------------------------
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0=domingo, 6=sábado
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (department_id, weekday, start_time)
);

create index if not exists bh_dept_idx on public.business_hours (department_id, weekday);

-- Verifica se algum departamento está aberto agora (na timezone configurada)
create or replace function public.is_any_dept_open(at_ts timestamptz default now())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text;
  local_ts timestamp;
  dow int;
  local_time time;
begin
  select timezone into tz from public.widget_settings limit 1;
  tz := coalesce(tz, 'America/Sao_Paulo');
  local_ts := at_ts at time zone tz;
  dow := extract(dow from local_ts);
  local_time := local_ts::time;
  return exists (
    select 1 from public.business_hours
     where weekday = dow and local_time >= start_time and local_time < end_time
  );
end$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.widget_settings    enable row level security;
alter table public.home_blocks        enable row level security;
alter table public.updates            enable row level security;
alter table public.suggestions        enable row level security;
alter table public.suggestion_votes   enable row level security;
alter table public.business_hours     enable row level security;

-- widget_settings: leitura pra qualquer agente, escrita só admin
drop policy if exists "settings read agents" on public.widget_settings;
create policy "settings read agents" on public.widget_settings
  for select to authenticated using (public.is_agent());
drop policy if exists "settings write admin" on public.widget_settings;
create policy "settings write admin" on public.widget_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- home_blocks: leitura agentes, escrita admin
drop policy if exists "blocks read agents" on public.home_blocks;
create policy "blocks read agents" on public.home_blocks
  for select to authenticated using (public.is_agent());
drop policy if exists "blocks write admin" on public.home_blocks;
create policy "blocks write admin" on public.home_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- updates: leitura agentes, escrita admin
drop policy if exists "updates read agents" on public.updates;
create policy "updates read agents" on public.updates
  for select to authenticated using (public.is_agent());
drop policy if exists "updates write admin" on public.updates;
create policy "updates write admin" on public.updates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- suggestions: leitura agentes, escrita admin (criação pelo contato via API)
drop policy if exists "suggestions read agents" on public.suggestions;
create policy "suggestions read agents" on public.suggestions
  for select to authenticated using (public.is_agent());
drop policy if exists "suggestions write admin" on public.suggestions;
create policy "suggestions write admin" on public.suggestions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- suggestion_votes: só leitura pra agentes (count agregado), votos vem via API
drop policy if exists "votes read agents" on public.suggestion_votes;
create policy "votes read agents" on public.suggestion_votes
  for select to authenticated using (public.is_agent());

-- business_hours: leitura agentes, escrita admin
drop policy if exists "hours read agents" on public.business_hours;
create policy "hours read agents" on public.business_hours
  for select to authenticated using (public.is_agent());
drop policy if exists "hours write admin" on public.business_hours;
create policy "hours write admin" on public.business_hours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Grant nas funções para o widget conseguir checar via service_role
grant execute on function public.is_any_dept_open(timestamptz) to authenticated, anon, service_role;

-- =====================================================================
-- Seed inicial: blocos padrão da Home (dá pra editar no painel)
-- =====================================================================
insert into public.home_blocks (title, description, icon, accent, action_type, action_value, sort_order)
values
  ('Suporte oficial',  'Como podemos te ajudar?',           'MessageCircle', 'primary', 'open_chat',   null,           1),
  ('Reportar bug',     'Encontrou um bug? Reporte por favor', 'Bug',         'red',     'report_bug',  null,           2),
  ('Ver novidades',    'Veja as atualizações mais recentes',  'Sparkles',     'blue',    'switch_tab',  'updates',      3)
on conflict do nothing;
