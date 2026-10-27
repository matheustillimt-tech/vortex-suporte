-- =====================================================================
-- Motivos de finalização — configurável pelo admin, escolhido ao Finalizar.
-- Permite mapear padrões de contato (dúvida, bug, financeiro, etc.)
-- pra alimentar o dashboard de métricas.
-- =====================================================================

create table if not exists public.close_reasons (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'principal',
  label text not null,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists close_reasons_project_sort on public.close_reasons (project_key, sort_order, label);

alter table public.conversations
  add column if not exists close_reason_id uuid references public.close_reasons(id) on delete set null,
  add column if not exists close_reason_label text,            -- snapshot do label no momento do fechamento
  add column if not exists close_reason_note text;             -- texto livre quando "Outros"

-- RLS
alter table public.close_reasons enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='close_reasons' and policyname='close_reasons_read_anon') then
    create policy close_reasons_read_anon on public.close_reasons for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='close_reasons' and policyname='close_reasons_all_auth') then
    create policy close_reasons_all_auth on public.close_reasons for all to authenticated using (true) with check (true);
  end if;
end$$;

-- Seed inicial — admin pode editar/remover depois pela UI.
insert into public.close_reasons (project_key, label, sort_order) values
  ('principal', 'Dúvida resolvida',          10),
  ('principal', 'Reportou um bug',           20),
  ('principal', 'Pedido financeiro',         30),
  ('principal', 'Cancelamento / desistência',40),
  ('principal', 'Suporte técnico',           50),
  ('principal', 'Sugestão de melhoria',      60)
on conflict do nothing;
