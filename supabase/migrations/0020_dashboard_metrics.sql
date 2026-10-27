-- =====================================================================
-- Função RPC pra dashboard admin — retorna conversas no período com
-- o timestamp da primeira resposta de agente (pra calcular SLA de espera
-- e primeira resposta sem fazer N+1 queries no cliente).
-- =====================================================================

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
  where c.first_message_at >= p_start
    and c.first_message_at < p_end
  order by c.first_message_at desc;
$$;

grant execute on function public.dashboard_conversations(timestamptz, timestamptz) to authenticated;
