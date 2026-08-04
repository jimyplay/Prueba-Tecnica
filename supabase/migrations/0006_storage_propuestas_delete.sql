-- Permite borrar el documento de propuesta mientras la licitacion sigue en
-- borrador (para poder reemplazarlo antes de enviar). No existia politica
-- de DELETE sobre el bucket 'propuestas' hasta ahora.

create policy "propuestas_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'propuestas');
