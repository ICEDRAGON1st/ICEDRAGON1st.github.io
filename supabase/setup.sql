-- Run this once in Supabase: SQL Editor → New query → Paste → Run
-- Enables hub docs (leaderboards, players, chat, fishing admin, …).

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

-- Seed empty docs (same ids as former Mantle paths). Safe to re-run.
insert into public.hub_docs (id, data) values
  ('leaderboards', '{"games":{},"resets":{}}'::jsonb),
  ('plays-log', '{"plays":[],"counts":{}}'::jsonb),
  ('name-registry', '{"names":{}}'::jsonb),
  ('player-codes', '{"codes":{}}'::jsonb),
  ('name-reservations', '{"reservations":{}}'::jsonb),
  ('presence', '{"players":{}}'::jsonb),
  ('players-alltime', '{"players":{},"total":0}'::jsonb),
  ('friend-chat', '{"threads":{}}'::jsonb),
  ('friends', '{"profiles":{},"invites":{}}'::jsonb),
  ('player-feedback', '{"items":[]}'::jsonb),
  ('online-matches', '{"rooms":{}}'::jsonb),
  ('fishing-admin-events', '{}'::jsonb),
  ('fishing-community', '{}'::jsonb),
  ('fishing-gifts', '{"token":"ice-fish-gift-9f3a","gifts":{}}'::jsonb),
  ('fishing-player-mail', '{"token":"ice-fish-mail-9f3a","gifts":{},"trades":{}}'::jsonb),
  ('fishing-aquariums', '{"token":"ice-fish-aqua-9f3a","tanks":{}}'::jsonb)
on conflict (id) do nothing;
