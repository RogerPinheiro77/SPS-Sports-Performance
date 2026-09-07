-- ============================================================
-- SPORT PERFORMANCE SYSTEM — Supabase Migration
-- Colar no SQL Editor do teu projeto Supabase
-- https://app.supabase.com → SQL Editor → New query
-- ============================================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- 1. CLUBES
-- ─────────────────────────────────────────────
create table if not exists clubs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  short_name  text,
  color       text default '#1a3a5c',
  sport       text default 'Futebol Feminino',
  season      text,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 2. ATLETAS
-- ─────────────────────────────────────────────
create table if not exists athletes (
  id          text primary key,
  club_id     uuid references clubs(id) on delete cascade,
  name        text not null,
  pos         text,
  num         int,
  dob         text,
  nationality text,
  height      text,
  foot        text,
  photo       text,
  club        text,
  created_at  timestamptz default now()
);
create index if not exists athletes_club_idx on athletes(club_id);

-- ─────────────────────────────────────────────
-- 3. WELLNESS
-- ─────────────────────────────────────────────
create table if not exists wellness_records (
  id           text primary key,
  club_id      uuid references clubs(id) on delete cascade,
  athlete_id   text,
  date         text,
  sleep        int,
  fatigue      int,
  stress       int,
  pain         int,
  mood         int,
  score        int,
  cycle        text,
  submitted_at timestamptz default now()
);
create index if not exists wellness_club_date_idx on wellness_records(club_id, date);

-- ─────────────────────────────────────────────
-- 4. PSE / CARGA
-- ─────────────────────────────────────────────
create table if not exists pse_records (
  id           text primary key,
  club_id      uuid references clubs(id) on delete cascade,
  athlete_id   text,
  date         text,
  pse          numeric,
  duration     int,
  ua           numeric,
  session_type text,
  submitted_at timestamptz default now()
);
create index if not exists pse_club_date_idx on pse_records(club_id, date);

-- ─────────────────────────────────────────────
-- 5. LESÕES
-- ─────────────────────────────────────────────
create table if not exists injuries (
  id             text primary key,
  club_id        uuid references clubs(id) on delete cascade,
  athlete_id     text,
  date           text,
  type           text,
  diagnosis      text,
  severity       text,
  status         text default 'indisponivel',
  return_date    text,
  notes          text,
  phase          int  default 1,
  phase_desc     text,
  progress       int  default 0,
  registered_by  text,
  registered_at  timestamptz default now()
);
create index if not exists injuries_club_idx on injuries(club_id);

-- ─────────────────────────────────────────────
-- 6. NUTRIÇÃO
-- ─────────────────────────────────────────────
create table if not exists nutrition_records (
  id            text primary key,
  club_id       uuid references clubs(id) on delete cascade,
  athlete_id    text,
  date          text,
  weight        numeric,
  height        numeric,
  imc           numeric,
  body_fat      numeric,
  tricipital    numeric,
  suprailiaca   numeric,
  hydration     text,
  notes         text,
  registered_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 7. AGENDA
-- ─────────────────────────────────────────────
create table if not exists schedule_events (
  id         text primary key,
  club_id    uuid references clubs(id) on delete cascade,
  type       text,
  title      text,
  date       text,
  time       text,
  location   text,
  duration   int,
  notes      text,
  created_at timestamptz default now()
);
create index if not exists schedule_club_date_idx on schedule_events(club_id, date);

-- ─────────────────────────────────────────────
-- 8. TREINOS INDIVIDUALIZADOS
-- ─────────────────────────────────────────────
create table if not exists training_plans (
  id          text primary key,
  club_id     uuid references clubs(id) on delete cascade,
  athlete_id  text,
  title       text,
  type        text,
  description text,
  week        text,
  done        boolean default false,
  note        text,
  volume      text,
  created_at  timestamptz default now()
);
create index if not exists training_club_idx on training_plans(club_id);

-- ─────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (acesso público via anon key)
-- ─────────────────────────────────────────────
-- Simplificado: acesso total via anon key (clube protegido por club_id que
-- apenas quem tem o UUID pode aceder). Em produção adicionar auth.
alter table clubs            enable row level security;
alter table athletes         enable row level security;
alter table wellness_records enable row level security;
alter table pse_records      enable row level security;
alter table injuries         enable row level security;
alter table nutrition_records enable row level security;
alter table schedule_events  enable row level security;
alter table training_plans   enable row level security;

create policy "anon_all" on clubs            for all using (true) with check (true);
create policy "anon_all" on athletes         for all using (true) with check (true);
create policy "anon_all" on wellness_records for all using (true) with check (true);
create policy "anon_all" on pse_records      for all using (true) with check (true);
create policy "anon_all" on injuries         for all using (true) with check (true);
create policy "anon_all" on nutrition_records for all using (true) with check (true);
create policy "anon_all" on schedule_events  for all using (true) with check (true);
create policy "anon_all" on training_plans   for all using (true) with check (true);

-- ─────────────────────────────────────────────
-- 10. REALTIME — activar tabelas para subscriptions
-- ─────────────────────────────────────────────
-- Correr no SQL Editor do Supabase:
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table wellness_records;
alter publication supabase_realtime add table pse_records;
alter publication supabase_realtime add table injuries;
alter publication supabase_realtime add table nutrition_records;
alter publication supabase_realtime add table schedule_events;
alter publication supabase_realtime add table training_plans;
alter publication supabase_realtime add table athletes;

-- ✅ Migração concluída.
-- Próximo passo: copiar o URL e a Anon Key do teu projeto
-- (Supabase → Settings → API) para o Sport Performance System.
