-- Run this in the Supabase SQL Editor

-- Workflows table
create table if not exists workflows (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  saved_at timestamptz not null default now()
);

create index if not exists workflows_user_id_idx on workflows(user_id);

-- Row Level Security
alter table workflows enable row level security;

create policy "Users can read own workflows"
  on workflows for select using (auth.uid() = user_id);

create policy "Users can insert own workflows"
  on workflows for insert with check (auth.uid() = user_id);

create policy "Users can update own workflows"
  on workflows for update using (auth.uid() = user_id);

create policy "Users can delete own workflows"
  on workflows for delete using (auth.uid() = user_id);

-- User settings table
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  anthropic_key text default ''
);

alter table user_settings enable row level security;

create policy "Users can read own settings"
  on user_settings for select using (auth.uid() = user_id);

create policy "Users can upsert own settings"
  on user_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update using (auth.uid() = user_id);
