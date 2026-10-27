-- O encerramento é exclusivo; mantém a hora local sem reconversão de fuso.
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
