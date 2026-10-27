create table public.labels (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 50),
 color text not null check (color ~ '^#[0-9a-f]{6}$'),
 created_at timestamptz not null default now()
);
create unique index labels_name_unique on public.labels (lower(btrim(name)));
create unique index labels_color_unique on public.labels (color);
create table public.contact_labels (
 contact_id uuid not null references public.contacts(id) on delete cascade,
 label_id uuid not null references public.labels(id) on delete cascade,
 primary key (contact_id, label_id)
);
create index contact_labels_label_idx on public.contact_labels(label_id);
alter table public.labels enable row level security;
alter table public.contact_labels enable row level security;
create policy "labels read agents" on public.labels for select to authenticated using (public.is_agent());
create policy "labels manage admins" on public.labels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact labels agents" on public.contact_labels for all to authenticated using (public.is_agent()) with check (public.is_agent());
grant select,insert,update,delete on public.labels, public.contact_labels to authenticated;
grant all on public.labels, public.contact_labels to service_role;
-- Preserva marcações existentes ao substituir o botão Prioridade.
insert into public.labels(name,color) select 'Prioridade','#f59e0b' where exists(select 1 from public.conversations where flagged_at is not null);
insert into public.contact_labels(contact_id,label_id)
select distinct c.contact_id,l.id from public.conversations c cross join public.labels l where c.flagged_at is not null and l.name='Prioridade' on conflict do nothing;
alter publication supabase_realtime add table public.labels, public.contact_labels;
notify pgrst, 'reload schema';
