-- Cria o bucket 'uploads' no Storage
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true);

-- Permite que usuários autenticados façam upload
create policy "Usuários autenticados podem fazer upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'uploads');

-- Permite que usuários autenticados leiam os arquivos
create policy "Usuários autenticados podem ler arquivos"
on storage.objects for select
to authenticated
using (bucket_id = 'uploads');
