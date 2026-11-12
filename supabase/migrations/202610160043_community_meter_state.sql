begin;

-- Shared Fishing weekend meter lifecycle (week_key + luck reward window).
-- Anyone signed in can read and write; same trust as the unlocked fishing-community
-- hub_docs board. Cast totals stay on community_cast_contributions.
create table if not exists public.community_meter_state (
  id text primary key,
  week_key text not null,
  goal integer not null default 2500,
  reward_until bigint not null default 0,
  reward_mult integer not null default 2,
  lb_wave bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint community_meter_state_id_check
    check (id = 'fishing-community'),
  constraint community_meter_state_week_key_len
    check (char_length(week_key) between 1 and 64),
  constraint community_meter_state_goal_range
    check (goal >= 500 and goal <= 100000),
  constraint community_meter_state_reward_until_range
    check (reward_until >= 0),
  constraint community_meter_state_reward_mult_range
    check (reward_mult >= 1 and reward_mult <= 10),
  constraint community_meter_state_lb_wave_range
    check (lb_wave >= 0)
);

alter table public.community_meter_state enable row level security;
alter table public.community_meter_state force row level security;

revoke all on table public.community_meter_state from anon, authenticated;
grant select, insert, update on table public.community_meter_state to authenticated;

drop policy if exists community_meter_state_read_authenticated on public.community_meter_state;
create policy community_meter_state_read_authenticated
  on public.community_meter_state
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists community_meter_state_insert_authenticated on public.community_meter_state;
create policy community_meter_state_insert_authenticated
  on public.community_meter_state
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists community_meter_state_update_authenticated on public.community_meter_state;
create policy community_meter_state_update_authenticated
  on public.community_meter_state
  for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

commit;
