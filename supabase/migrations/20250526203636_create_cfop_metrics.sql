-- 1. Cria a tabela que guardará as métricas por CFOP
create table public.cfop_metrics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users,
  cfop       text,
  valor      numeric,
  created_at timestamptz default now()
);

-- 2. Escreve uma política simples: o usuário só enxerga o que é dele
create policy "usuario_só_vê_suas_linhas"
on public.cfop_metrics
for select using ( auth.uid() = user_id );

create policy "usuario_só_insere_suas_linhas"
on public.cfop_metrics
for insert with check ( auth.uid() = user_id );

-- 3. Liga o Row Level Security (RLS) agora que a política existe
alter table public.cfop_metrics enable row level security;
