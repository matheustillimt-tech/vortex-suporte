-- =====================================================================
-- Adiciona image/svg+xml às MIMEs permitidas no bucket de anexos
-- (precisamos pra ícones custom dos blocos da Home).
-- =====================================================================
update storage.buckets
   set allowed_mime_types = allowed_mime_types || array['image/svg+xml']
 where id = 'support-attachments'
   and not ('image/svg+xml' = any(allowed_mime_types));
