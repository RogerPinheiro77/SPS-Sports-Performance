-- ============================================================
--  FIX: Apagar políticas existentes e recriar
-- ============================================================

-- Apagar políticas antigas
drop policy if exists "anon_all" on clubs;
drop policy if exists "anon_all" on teams;
drop policy if exists "anon_all" on athletes;
drop policy if exists "anon_all" on wellness_records;
drop policy if exists "anon_all" on pse_records;
drop policy if exists "anon_all" on injuries;
drop policy if exists "anon_all" on treatments;
drop policy if exists "anon_all" on nutrition_records;
drop policy if exists "anon_all" on nutrition_plans;
drop policy if exists "anon_all" on schedule_events;
drop policy if exists "anon_all" on training_plans;

-- Criar tabelas novas (se não existirem)
create table if not exists teams (
  id text primary key, club_id uuid references clubs(id) on delete cascade,
  name text not null, type text default 'principal', cat text,
  created_at timestamptz default now()
);
create table if not exists treatments (
  id text primary key, club_id uuid references clubs(id) on delete cascade,
  injury_id text, athlete_id text, date text, type text,
  description text, response text, professional_name text,
  registered_at timestamptz default now()
);
create table if not exists nutrition_plans (
  id text primary key, club_id uuid references clubs(id) on delete cascade,
  athlete_id text, name text, objective text, kcal numeric,
  protein numeric, carbs numeric, fat numeric,
  meals jsonb default '[]', active boolean default true,
  start_date text, created_at timestamptz default now()
);

-- Adicionar colunas novas que possam não existir
alter table athletes       add column if not exists team_id text;
alter table injuries       add column if not exists body_part text;
alter table injuries       add column if not exists phase_desc text;
alter table nutrition_records add column if not exists muscle numeric;
alter table schedule_events   add column if not exists dur int;
alter table training_plans    add column if not exists note text;
alter table training_plans    add column if not exists volume text;
alter table training_plans    add column if not exists done_at text;

-- Recriar políticas
alter table clubs             enable row level security;
alter table teams             enable row level security;
alter table athletes          enable row level security;
alter table wellness_records  enable row level security;
alter table pse_records       enable row level security;
alter table injuries          enable row level security;
alter table treatments        enable row level security;
alter table nutrition_records enable row level security;
alter table nutrition_plans   enable row level security;
alter table schedule_events   enable row level security;
alter table training_plans    enable row level security;

create policy "anon_all" on clubs             for all using (true) with check (true);
create policy "anon_all" on teams             for all using (true) with check (true);
create policy "anon_all" on athletes          for all using (true) with check (true);
create policy "anon_all" on wellness_records  for all using (true) with check (true);
create policy "anon_all" on pse_records       for all using (true) with check (true);
create policy "anon_all" on injuries          for all using (true) with check (true);
create policy "anon_all" on treatments        for all using (true) with check (true);
create policy "anon_all" on nutrition_records for all using (true) with check (true);
create policy "anon_all" on nutrition_plans   for all using (true) with check (true);
create policy "anon_all" on schedule_events   for all using (true) with check (true);
create policy "anon_all" on training_plans    for all using (true) with check (true);

-- REALTIME
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table wellness_records;
alter publication supabase_realtime add table pse_records;
alter publication supabase_realtime add table injuries;
alter publication supabase_realtime add table treatments;
alter publication supabase_realtime add table nutrition_records;
alter publication supabase_realtime add table nutrition_plans;
alter publication supabase_realtime add table schedule_events;
alter publication supabase_realtime add table training_plans;
alter publication supabase_realtime add table athletes;

-- ✅ Concluído.
