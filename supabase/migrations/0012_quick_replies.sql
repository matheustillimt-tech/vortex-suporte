-- =====================================================================
-- Respostas rápidas (canned responses)
--   * Compartilhadas: todos os agentes leem todas
--   * Cada agente CRUD nas suas; admin CRUD em qualquer uma
--   * Aceitam body + attachments (imagem/áudio/vídeo/arquivo)
-- =====================================================================

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.agents(id) on delete set null,
  title text not null,
  shortcut text,                                  -- opcional: "oi", "dados", pra busca rápida
  body text,
  attachments jsonb not null default '[]'::jsonb, -- [{url, mime, name, size}]
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qr_author_idx on public.quick_replies (author_id, sort_order);
create index if not exists qr_shortcut_idx on public.quick_replies (lower(shortcut));

alter table public.quick_replies enable row level security;

drop policy if exists "agents read all quick_replies" on public.quick_replies;
create policy "agents read all quick_replies" on public.quick_replies for select to authenticated
  using (public.is_agent());

drop policy if exists "agents insert own quick_replies" on public.quick_replies;
create policy "agents insert own quick_replies" on public.quick_replies for insert to authenticated
  with check (public.is_agent() and author_id = auth.uid());

drop policy if exists "agents update own quick_replies" on public.quick_replies;
create policy "agents update own quick_replies" on public.quick_replies for update to authenticated
  using ( public.is_agent() and (author_id = auth.uid() or public.is_admin()) )
  with check ( public.is_agent() and (author_id = auth.uid() or public.is_admin()) );

drop policy if exists "agents delete own quick_replies" on public.quick_replies;
create policy "agents delete own quick_replies" on public.quick_replies for delete to authenticated
  using ( public.is_agent() and (author_id = auth.uid() or public.is_admin()) );

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists qr_touch_updated on public.quick_replies;
create trigger qr_touch_updated before update on public.quick_replies
  for each row execute function public.touch_updated_at();
