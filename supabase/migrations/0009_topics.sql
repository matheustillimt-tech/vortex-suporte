-- =====================================================================
-- Temas de suporte (chatbot inicial de roteamento)
--   * Cada tema aponta pra um departamento
--   * Tem mensagem automática enviada ao cliente quando ele escolhe
--   * Conversation passa a guardar topic_id pra filtragem futura
-- =====================================================================

create table if not exists public.support_topics (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'principal',
  name text not null,
  description text,
  icon text not null default 'MessageCircle',
  icon_url text,
  department_id uuid references public.departments(id) on delete set null,
  auto_message text,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists topics_project_order on public.support_topics (project_key, sort_order);

-- Vincula tema à conversa (e mantém department_id pro routing)
alter table public.conversations
  add column if not exists topic_id uuid references public.support_topics(id) on delete set null;

create index if not exists conv_topic_idx on public.conversations (topic_id);
create index if not exists conv_dept_status_first_idx
  on public.conversations (department_id, status, first_message_at);

-- RLS — admins gerenciam, todos os agentes leem
alter table public.support_topics enable row level security;

drop policy if exists "agents read topics" on public.support_topics;
create policy "agents read topics" on public.support_topics for select to authenticated
  using (public.is_agent());

drop policy if exists "admins write topics" on public.support_topics;
create policy "admins write topics" on public.support_topics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Departamentos iniciais (dá pra renomear ou apagar no painel, em Departamentos)
insert into public.departments (name)
select d.name from (values ('Suporte'), ('Financeiro'), ('Comercial')) as d(name)
where not exists (select 1 from public.departments x where x.name = d.name);

-- Seed mínimo (3 temas iniciais ligados aos 3 departamentos)
insert into public.support_topics (project_key, name, description, icon, sort_order, department_id, auto_message)
select 'principal', 'Suporte técnico', 'Bugs, erros e dúvidas sobre como usar', 'Wrench', 10,
       (select id from public.departments where name = 'Suporte' limit 1),
       'Você foi direcionado para o Suporte técnico. Em instantes um atendente vai te responder.'
where not exists (select 1 from public.support_topics where name = 'Suporte técnico');

insert into public.support_topics (project_key, name, description, icon, sort_order, department_id, auto_message)
select 'principal', 'Financeiro', 'Pagamentos, faturas, planos e reembolso', 'CreditCard', 20,
       (select id from public.departments where name = 'Financeiro' limit 1),
       'Você foi direcionado para o Financeiro. Em instantes te respondemos.'
where not exists (select 1 from public.support_topics where name = 'Financeiro');

insert into public.support_topics (project_key, name, description, icon, sort_order, department_id, auto_message)
select 'principal', 'Comercial', 'Novos planos, upgrade, contratação', 'Megaphone', 30,
       (select id from public.departments where name = 'Comercial' limit 1),
       'Você foi direcionado para o Comercial. Em instantes te respondemos.'
where not exists (select 1 from public.support_topics where name = 'Comercial');

-- Configuração: habilitar topic picker no widget (default ON)
alter table public.widget_settings
  add column if not exists topic_picker_enabled boolean not null default true;
