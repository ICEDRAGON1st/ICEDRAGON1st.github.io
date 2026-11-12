-- One paste for leftover Fishing weekend luck, Paper Claim rooms, Discord /link,
-- and a PostgREST schema reload. Safe to re-run. Keep fishing-community and
-- paper-io-* writable until these tables are live.

-- from 202610160016_community_cast_contributions.sql
begin;

-- Per-account fishing community casts. Anyone signed in can read; only you can write your row.
-- Replaces rewriting the shared hub_docs fishing-community meter once this table is live.
create table if not exists public.community_cast_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  week_key text not null,
  casts bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint community_cast_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint community_cast_contributions_player_id_unique unique (player_id),
  constraint community_cast_contributions_week_key_len
    check (char_length(week_key) between 1 and 64),
  constraint community_cast_contributions_casts_range
    check (casts >= 0 and casts <= 10000)
);

alter table public.community_cast_contributions enable row level security;
alter table public.community_cast_contributions force row level security;

revoke all on table public.community_cast_contributions from anon, authenticated;
grant select, insert, update, delete on table public.community_cast_contributions to authenticated;

drop policy if exists community_cast_contributions_read_authenticated on public.community_cast_contributions;
create policy community_cast_contributions_read_authenticated
  on public.community_cast_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists community_cast_contributions_insert_own on public.community_cast_contributions;
create policy community_cast_contributions_insert_own
  on public.community_cast_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists community_cast_contributions_update_own on public.community_cast_contributions;
create policy community_cast_contributions_update_own
  on public.community_cast_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists community_cast_contributions_delete_own on public.community_cast_contributions;
create policy community_cast_contributions_delete_own
  on public.community_cast_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- from 202610160028_community_cast_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for the Fishing weekend meter.
-- Replica identity full so UPDATE/DELETE payloads include player_id, week_key, and casts.
alter table public.community_cast_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_cast_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.community_cast_contributions';
  end if;
end $$;

commit;

-- from 202610160043_community_meter_state.sql
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

-- from 202610160044_community_meter_state_realtime.sql
begin;

-- Authenticated postgres_changes for the Fishing weekend luck window.
-- Replica identity full so UPDATE payloads include week_key, reward_until, and lb_wave.
alter table public.community_meter_state replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_meter_state'
  ) then
    execute 'alter publication supabase_realtime add table public.community_meter_state';
  end if;
end $$;

commit;

-- from 202610160047_paper_room_contributions.sql
begin;

-- Per-account Paper Claim rooms. Anyone signed in can read; only you can write your row.
-- Host snapshots, guest seats/inputs, and the lobby overlay this table instead of
-- rewriting shared hub_docs paper-io-room / paper-io-input / paper-io-lobbies docs.
create table if not exists public.paper_room_contributions (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id text not null,
  rooms jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id),
  constraint paper_room_contributions_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint paper_room_contributions_player_id_unique unique (player_id),
  constraint paper_room_contributions_rooms_object
    check (jsonb_typeof(rooms) = 'object')
);

alter table public.paper_room_contributions enable row level security;
alter table public.paper_room_contributions force row level security;

revoke all on table public.paper_room_contributions from anon, authenticated;
grant select, insert, update, delete on table public.paper_room_contributions to authenticated;

drop policy if exists paper_room_contributions_read_authenticated on public.paper_room_contributions;
create policy paper_room_contributions_read_authenticated
  on public.paper_room_contributions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists paper_room_contributions_insert_own on public.paper_room_contributions;
create policy paper_room_contributions_insert_own
  on public.paper_room_contributions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists paper_room_contributions_update_own on public.paper_room_contributions;
create policy paper_room_contributions_update_own
  on public.paper_room_contributions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists paper_room_contributions_delete_own on public.paper_room_contributions;
create policy paper_room_contributions_delete_own
  on public.paper_room_contributions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- from 202610160048_paper_room_contributions_realtime.sql
begin;

-- Authenticated postgres_changes for Paper Claim rooms.
-- Replica identity full so UPDATE/DELETE payloads include player_id and rooms.
alter table public.paper_room_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'paper_room_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.paper_room_contributions';
  end if;
end $$;

commit;

-- from 202610160051_discord_links.sql
begin;

-- Discord /link looks up signed-in player codes. Do not copy leftover hub_docs.
-- Do not put hub_docs or discord_links on Realtime.

create table if not exists public.discord_links (
  discord_id text not null,
  player_id text not null,
  code text not null,
  display_name text not null default '',
  discord_tag text not null default '',
  linked_at timestamptz not null default now(),
  primary key (discord_id),
  constraint discord_links_discord_id_format
    check (discord_id ~ '^[0-9]{5,32}$'),
  constraint discord_links_player_id_format
    check (player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'),
  constraint discord_links_player_id_unique unique (player_id),
  constraint discord_links_code_format
    check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'),
  constraint discord_links_name_length
    check (char_length(display_name) <= 32),
  constraint discord_links_tag_length
    check (char_length(discord_tag) <= 64)
);

alter table public.discord_links enable row level security;
alter table public.discord_links force row level security;

revoke all on table public.discord_links from anon, authenticated;
grant select on table public.discord_links to authenticated;

drop policy if exists discord_links_read_authenticated on public.discord_links;
create policy discord_links_read_authenticated
  on public.discord_links
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create or replace function public.lookup_player_by_code(raw_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text;
  pid text;
  dname text;
begin
  norm := upper(regexp_replace(coalesce(raw_code, ''), '[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]', '', 'g'));
  if char_length(norm) <> 8 then
    return null;
  end if;
  select c.player_id, c.display_name
    into pid, dname
  from public.player_code_claims c
  where c.code = norm
  limit 1;
  if pid is null then
    return null;
  end if;
  if dname is null or btrim(dname) = '' then
    select coalesce(n.claim ->> 'name', '')
      into dname
    from public.nickname_claims n
    where n.player_id = pid
    limit 1;
  end if;
  return jsonb_build_object(
    'playerId', pid,
    'name', coalesce(btrim(dname), ''),
    'code', norm
  );
end;
$$;

create or replace function public.upsert_discord_link(
  p_discord_id text,
  p_code text,
  p_discord_tag text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found jsonb;
  pid text;
  dname text;
  norm text;
  did text;
begin
  did := regexp_replace(coalesce(p_discord_id, ''), '[^0-9]', '', 'g');
  if char_length(did) < 5 or char_length(did) > 32 then
    raise exception 'bad discord id' using errcode = '22023';
  end if;
  found := public.lookup_player_by_code(p_code);
  if found is null then
    return null;
  end if;
  pid := found ->> 'playerId';
  dname := left(coalesce(found ->> 'name', ''), 32);
  norm := found ->> 'code';
  delete from public.discord_links
  where player_id = pid
    and discord_id <> did;
  insert into public.discord_links as d (
    discord_id, player_id, code, display_name, discord_tag, linked_at
  )
  values (
    did,
    pid,
    norm,
    dname,
    left(coalesce(p_discord_tag, ''), 64),
    now()
  )
  on conflict (discord_id) do update
    set player_id = excluded.player_id,
        code = excluded.code,
        display_name = excluded.display_name,
        discord_tag = excluded.discord_tag,
        linked_at = now();
  return found;
end;
$$;

revoke all on function public.lookup_player_by_code(text) from public;
revoke all on function public.upsert_discord_link(text, text, text) from public;
grant execute on function public.lookup_player_by_code(text) to anon, authenticated;
grant execute on function public.upsert_discord_link(text, text, text) to anon, authenticated;

drop policy if exists hub_docs_insert_non_admin on public.hub_docs;
create policy hub_docs_insert_non_admin
  on public.hub_docs
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and id not like 'account-bag:%'
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates',
      'hub-leaderboard-resets',
      'hub-feedback-deletes',
      'leaderboards',
      'plays-log',
      'name-registry',
      'player-codes',
      'name-reservations',
      'presence',
      'players-alltime',
      'friend-chat',
      'friends',
      'player-feedback',
      'online-matches',
      'fishing-gifts',
      'fishing-player-mail',
      'fishing-aquariums',
      'hub-calls',
      'hub-referrals-v1',
      'hub-game-popularity-v1',
      'player-passwords',
      'discord-links-v1'
    )
  );

drop policy if exists hub_docs_update_non_admin on public.hub_docs;
create policy hub_docs_update_non_admin
  on public.hub_docs
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and id not like 'account-bag:%'
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates',
      'hub-leaderboard-resets',
      'hub-feedback-deletes',
      'leaderboards',
      'plays-log',
      'name-registry',
      'player-codes',
      'name-reservations',
      'presence',
      'players-alltime',
      'friend-chat',
      'friends',
      'player-feedback',
      'online-matches',
      'fishing-gifts',
      'fishing-player-mail',
      'fishing-aquariums',
      'hub-calls',
      'hub-referrals-v1',
      'hub-game-popularity-v1',
      'player-passwords',
      'discord-links-v1'
    )
  )
  with check (
    (select auth.uid()) is not null
    and id not like 'account-bag:%'
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates',
      'hub-leaderboard-resets',
      'hub-feedback-deletes',
      'leaderboards',
      'plays-log',
      'name-registry',
      'player-codes',
      'name-reservations',
      'presence',
      'players-alltime',
      'friend-chat',
      'friends',
      'player-feedback',
      'online-matches',
      'fishing-gifts',
      'fishing-player-mail',
      'fishing-aquariums',
      'hub-calls',
      'hub-referrals-v1',
      'hub-game-popularity-v1',
      'player-passwords',
      'discord-links-v1'
    )
  );

commit;

begin;

-- Reload PostgREST so leftover tables are visible to signed-in lists.
-- Safe to re-run. Do not put hub_docs on Realtime.
create or replace function public.reload_postgrest_schema()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

revoke all on function public.reload_postgrest_schema() from public, anon;
grant execute on function public.reload_postgrest_schema() to authenticated;

notify pgrst, 'reload schema';

commit;
