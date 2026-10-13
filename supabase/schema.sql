-- Optiver OA Trainer schema. Run in the Supabase SQL editor (idempotent).
-- Every table carries user_id and is protected by RLS: a user can only see/modify their own rows.

create table if not exists public.attempts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  module text not null,
  mode text not null check (mode in ('exam', 'training')),
  config jsonb not null default '{}'::jsonb,
  meta jsonb,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  score double precision not null,
  max_score double precision not null
);
create index if not exists attempts_user_finished on public.attempts (user_id, finished_at);

create table if not exists public.item_results (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  module text not null,
  family text not null,
  difficulty smallint not null,
  seed bigint not null,
  response jsonb,
  correct boolean,
  score double precision not null,
  ms_taken integer not null,
  created_at timestamptz not null default now()
);
create index if not exists item_results_user_family on public.item_results (user_id, family);
create index if not exists item_results_attempt on public.item_results (attempt_id);

create table if not exists public.skill (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  family text not null,
  rating double precision not null default 1000,
  n integer not null default 0,
  last_seen timestamptz,
  next_due timestamptz,
  avg_ms double precision,
  primary key (user_id, family)
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.attempts enable row level security;
alter table public.item_results enable row level security;
alter table public.skill enable row level security;
alter table public.settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['attempts', 'item_results', 'skill', 'settings'] loop
    execute format('drop policy if exists "owner select" on public.%I', t);
    execute format('drop policy if exists "owner insert" on public.%I', t);
    execute format('drop policy if exists "owner update" on public.%I', t);
    execute format('drop policy if exists "owner delete" on public.%I', t);
    execute format('create policy "owner select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "owner insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "owner update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "owner delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;
