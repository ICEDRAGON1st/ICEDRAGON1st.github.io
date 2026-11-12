begin;

-- Per-account invite credits. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs hub-referrals-v1 board once this table is live.
create table if not exists public.referral_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  inviter_id text not null,
  inviter_code text not null,
  invitee_name text not null default '',
  credited_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint referral_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint referral_contributions_inviter_id_format
    check (inviter_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint referral_contributions_player_id_unique unique (player_id),
  constraint referral_contributions_not_self
    check (player_id <> inviter_id),
  constraint referral_contributions_code_format
    check (inviter_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  constraint referral_contributions_name_length
    check (char_length(invitee_name) <= 16)
);

alter table public.referral_contributions enable row level security;
alter table public.referral_contributions force row level security;

revoke all on table public.referral_contributions from anon, authenticated;
grant select, insert, update, delete on table public.referral_contributions to authenticated;

drop policy if exists referral_contributions_read_authenticated on public.referral_contributions;
create policy referral_contributions_read_authenticated
  on public.referral_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists referral_contributions_insert_own on public.referral_contributions;
create policy referral_contributions_insert_own
  on public.referral_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists referral_contributions_update_own on public.referral_contributions;
create policy referral_contributions_update_own
  on public.referral_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists referral_contributions_delete_own on public.referral_contributions;
create policy referral_contributions_delete_own
  on public.referral_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
