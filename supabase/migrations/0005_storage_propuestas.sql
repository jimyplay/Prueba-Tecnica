-- Bucket publico para los documentos de propuesta. Publico para que el URL
-- devuelto por Storage sea accesible directamente (requisito de "evidencia
-- de que el documento subido es accesible via URL real").

insert into storage.buckets (id, name, public)
values ('propuestas', 'propuestas', true)
on conflict (id) do nothing;

create policy "propuestas_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'propuestas');

create policy "propuestas_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'propuestas');
