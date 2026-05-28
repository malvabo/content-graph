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
  anthropic_key text default '',
  openai_key text default '',
  google_key text default '',
  groq_key text default '',
  together_key text default ''
);

alter table user_settings enable row level security;

create policy "Users can read own settings"
  on user_settings for select using (auth.uid() = user_id);

create policy "Users can upsert own settings"
  on user_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update using (auth.uid() = user_id);

-- Apple Sign in users captured by the iOS onboarding flow.
-- The Vercel backend writes this table with the Supabase service role after
-- verifying Apple's identity token. There are no client RLS policies.
create table if not exists apple_auth_users (
  apple_sub text primary key,
  email text,
  full_name text,
  supabase_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table apple_auth_users enable row level security;

-- Run these when applying to an existing database:
-- alter table apple_auth_users add column if not exists supabase_user_id uuid references auth.users(id) on delete set null;
-- alter table user_settings add column if not exists groq_key text default '';
-- alter table user_settings add column if not exists together_key text default '';

-- iOS notes synced from the app. Drawing data is excluded (text only).
create table if not exists ios_notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null,
  is_pinned boolean not null default false,
  tags text[] not null default '{}',
  kind text not null default 'text'
);

create index if not exists ios_notes_user_id_idx on ios_notes(user_id);

alter table ios_notes enable row level security;

create policy "Users can read own ios notes"
  on ios_notes for select using (auth.uid() = user_id);

create policy "Users can insert own ios notes"
  on ios_notes for insert with check (auth.uid() = user_id);

create policy "Users can update own ios notes"
  on ios_notes for update using (auth.uid() = user_id);

create policy "Users can delete own ios notes"
  on ios_notes for delete using (auth.uid() = user_id);

-- iOS generations synced from the app.
create table if not exists ios_generations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  source_note_ids uuid[] not null default '{}',
  source_labels text[] not null default '{}',
  output_type text not null default '',
  content text not null default '',
  date timestamptz not null
);

create index if not exists ios_generations_user_id_idx on ios_generations(user_id);
create index if not exists ios_generations_note_id_idx on ios_generations(note_id);

alter table ios_generations enable row level security;

create policy "Users can read own ios generations"
  on ios_generations for select using (auth.uid() = user_id);

create policy "Users can insert own ios generations"
  on ios_generations for insert with check (auth.uid() = user_id);

create policy "Users can update own ios generations"
  on ios_generations for update using (auth.uid() = user_id);

create policy "Users can delete own ios generations"
  on ios_generations for delete using (auth.uid() = user_id);

-- AI generation usage counters (keyed by Apple sub / user_sub from the session token).
-- Written by the Vercel backend using the service role; no client access.
create table if not exists ai_generation_counts (
  user_sub text primary key,
  count    integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table ai_generation_counts enable row level security;

-- Atomically increments the counter for a given sub, inserting the row if absent.
create or replace function increment_ai_usage(p_sub text)
returns void
language plpgsql
security definer
as $$
begin
  insert into ai_generation_counts (user_sub, count, updated_at)
    values (p_sub, 1, now())
  on conflict (user_sub)
  do update set
    count      = ai_generation_counts.count + 1,
    updated_at = now();
end;
$$;
