-- Create app_meta table to sync users, config, games, evaluations etc.
create table if not exists app_meta (
  club_id uuid references clubs(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),
  primary key (club_id)
);

-- Allow authenticated and anon access (same as other tables)
alter table app_meta enable row level security;

create policy "Allow all for anon" on app_meta
  for all using (true) with check (true);
