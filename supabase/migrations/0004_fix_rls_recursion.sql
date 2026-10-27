-- =====================================================================
-- Fix: recursão de RLS nas funções is_agent() / is_admin()
-- =====================================================================
-- Bug: as funções faziam SELECT em public.agents, mas a própria policy
-- de SELECT em agents chama is_agent(), causando recursão e bloqueando o
-- acesso. Solução: rodar como SECURITY DEFINER (executa com privilégios
-- do owner, bypassando RLS na consulta interna).
-- =====================================================================

create or replace function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.agents where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.agents where id = auth.uid() and role = 'admin');
$$;

-- Garantir que authenticated pode executar as funções.
grant execute on function public.is_agent()  to authenticated;
grant execute on function public.is_admin()  to authenticated;
