-- Teto por arquivo no bucket de anexos (400 MiB). Mantém os tipos permitidos e as políticas.
-- Quem manda de verdade é o MENOR entre este teto e o limite global do projeto
-- (Supabase > Storage > Settings). No plano grátis o limite global é 50 MB.
-- O limite que o widget e o painel aceitam vem de NEXT_PUBLIC_MAX_UPLOAD_MB.
update storage.buckets
set file_size_limit = 419430400
where id = 'support-attachments';
