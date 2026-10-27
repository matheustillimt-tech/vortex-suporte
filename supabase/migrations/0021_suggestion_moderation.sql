-- =====================================================================
-- Moderação de sugestões — nada que o cliente envia entra publicado.
--   * Fluxo: cliente envia -> pending -> admin aprova -> pública e votável
--   * `status` (open/planned/...) é o ANDAMENTO, e só vale depois de aprovada.
--     São dois eixos independentes: moderação decide se aparece, status conta
--     em que pé está.
--   * A coluna nasce com default 'approved' DE PROPÓSITO: as sugestões que já
--     existem estão públicas hoje e sumiriam da lista se nascessem 'pending'.
--     Só depois o default vira 'pending', que passa a valer para as novas.
-- =====================================================================

alter table public.suggestions
  add column if not exists moderation_status text not null default 'approved';

alter table public.suggestions
  alter column moderation_status set default 'pending';

alter table public.suggestions
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.agents(id) on delete set null;

do $$ begin
  alter table public.suggestions
    add constraint suggestions_moderation_status_check
    check (moderation_status in ('pending','approved','rejected'));
exception when duplicate_object then null; end $$;

-- As antigas já estavam públicas: carimba a data pra não parecerem aprovadas agora.
update public.suggestions
   set moderated_at = created_at
 where moderation_status = 'approved' and moderated_at is null;

-- A lista pública filtra por moderação e ordena por votos.
create index if not exists suggestions_public_idx
  on public.suggestions (project_key, moderation_status, vote_count desc, created_at desc);
