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
