-- =====================================================================
-- Denormaliza nome do autor da mensagem (atendente OU contato).
-- Permite que o widget mostre "Maria" acima de cada bubble sem precisar
-- fazer JOIN dinâmico (mensagens chegam via realtime sem o join).
-- =====================================================================

alter table public.messages
  add column if not exists author_name text;

-- Trigger preenche author_name automaticamente no insert quando não vier.
create or replace function public.fill_message_author_name()
returns trigger language plpgsql as $$
begin
  if new.author_name is not null then
    return new;
  end if;

  if new.author_type = 'agent' and new.author_id is not null then
    select name into new.author_name from public.agents where id = new.author_id;
  elsif new.author_type = 'contact' and new.author_id is not null then
    select name into new.author_name from public.contacts where id = new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_fill_author on public.messages;
create trigger messages_fill_author
  before insert on public.messages
  for each row execute function public.fill_message_author_name();

-- Backfill mensagens antigas
update public.messages m
   set author_name = a.name
  from public.agents a
 where m.author_type = 'agent'
   and m.author_id = a.id
   and m.author_name is null;

update public.messages m
   set author_name = c.name
  from public.contacts c
 where m.author_type = 'contact'
   and m.author_id = c.id
   and m.author_name is null;
