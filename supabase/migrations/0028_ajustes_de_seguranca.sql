-- =====================================================================
-- Ajustes de segurança e de primeiro uso.
--
-- 1) Só atendente (ou admin) mexe em mensagem e em motivo de encerramento.
--    Antes, qualquer usuário logado no Supabase podia. Num projeto em que o
--    cadastro aberto ficou ligado, um estranho criava conta e editava tudo.
-- 2) O relatório do painel (dashboard_conversations) só responde pra atendente.
-- 3) Sem nenhum horário de atendimento cadastrado, o suporte fica ABERTO o
--    tempo todo. Antes ficava fechado (instalação nova parecia quebrada).
--    Cadastrou um horário em Horários de atendimento, passa a valer a agenda.
-- 4) Permissões padrão das tabelas pros papéis do Supabase (a segurança de
--    verdade continua sendo a RLS, ligada em todas as tabelas).
-- =====================================================================

-- 1a) Mensagens: só atendente atualiza (editar / apagar).
drop policy if exists messages_update_auth on public.messages;
create policy messages_update_auth on public.messages
  for update to authenticated
  using (public.is_agent()) with check (public.is_agent());

-- 1b) Motivos de encerramento: atendente lê, admin escreve.
drop policy if exists close_reasons_all_auth on public.close_reasons;
drop policy if exists "close reasons read agents" on public.close_reasons;
create policy "close reasons read agents" on public.close_reasons
  for select to authenticated using (public.is_agent());
drop policy if exists "close reasons write admin" on public.close_reasons;
create policy "close reasons write admin" on public.close_reasons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2) Relatório do painel: devolve vazio pra quem não é atendente.
create or replace function public.dashboard_conversations(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  id uuid,
  status text,
  first_message_at timestamptz,
  closed_at timestamptz,
  close_reason_label text,
  close_reason_note text,
  assigned_agent_id uuid,
  department_id uuid,
  first_agent_msg_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.status,
    c.first_message_at,
    c.closed_at,
    c.close_reason_label,
    c.close_reason_note,
    c.assigned_agent_id,
    c.department_id,
    (
      select min(m.created_at)
        from public.messages m
       where m.conversation_id = c.id
         and m.author_type = 'agent'
    ) as first_agent_msg_at
  from public.conversations c
  where public.is_agent()
    and c.first_message_at >= p_start
    and c.first_message_at < p_end
  order by c.first_message_at desc;
$$;

revoke execute on function public.dashboard_conversations(timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_conversations(timestamptz, timestamptz) to authenticated, service_role;

-- 3) Sem horário cadastrado = aberto. O encerramento de cada faixa continua
--    exclusivo (18:00 já é fora do horário numa faixa 09:00–18:00).
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
  if not exists (select 1 from public.business_hours) then
    return true;
  end if;
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

grant execute on function public.is_any_dept_open(timestamptz) to anon, authenticated, service_role;

-- 4) Permissões padrão (o Supabase já costuma aplicar; aqui fica garantido).
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant select on public.close_reasons to anon;

notify pgrst, 'reload schema';
