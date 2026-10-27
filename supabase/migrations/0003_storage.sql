-- =====================================================================
-- Storage bucket para anexos do chat
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  true,
  419430400, -- 400 MiB por arquivo
  array[
    'image/png','image/jpeg','image/gif','image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv','text/plain',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (anexos servidos diretamente).
-- Escrita só via service_role / agent autenticado (cobre os dois lados).
drop policy if exists "public read support attachments" on storage.objects;
create policy "public read support attachments"
  on storage.objects for select
  using (bucket_id = 'support-attachments');

drop policy if exists "agents write support attachments" on storage.objects;
create policy "agents write support attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments' and public.is_agent());
