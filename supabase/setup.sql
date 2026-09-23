-- Run this once in Supabase: SQL Editor → New query → Paste → Run
-- Enables leaderboards / hub docs (same shape Mantle used).

create table if not exists public.hub_docs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hub_docs enable row level security;

-- Browser hub has no login — public read/write like Mantle free tier.
drop policy if exists "hub_docs_select" on public.hub_docs;
drop policy if exists "hub_docs_insert" on public.hub_docs;
drop policy if exists "hub_docs_update" on public.hub_docs;

create policy "hub_docs_select" on public.hub_docs
  for select using (true);

create policy "hub_docs_insert" on public.hub_docs
  for insert with check (true);

create policy "hub_docs_update" on public.hub_docs
  for update using (true) with check (true);

-- Seed empty leaderboards doc
insert into public.hub_docs (id, data)
values ('leaderboards', '{"games":{},"resets":{}}'::jsonb)
on conflict (id) do nothing;
