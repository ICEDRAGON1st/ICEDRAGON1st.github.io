begin;

-- Return gifts and trades that include this signed-in player.
-- Keep the table read so older clients still load mail until a later
-- migration limits those reads to the owner.

create or replace function public.list_visible_fishing_mail()
returns table (
  player_id text,
  gifts jsonb,
  trades jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer text;
begin
  if auth.uid() is null then
    return;
  end if;

  select owned.player_id
    into viewer
  from (
    select p.player_id
    from public.player_profiles p
    where p.user_id = auth.uid()
    union all
    select s.payload->>'playerId'
    from public.player_saves s
    where s.user_id = auth.uid()
      and s.save_key = 'identity-bind'
    union all
    select m.player_id
    from public.fishing_mail_contributions m
    where m.user_id = auth.uid()
    union all
    select g.player_id
    from public.presence_pings g
    where g.user_id = auth.uid()
  ) owned
  where owned.player_id ~ '^p-[a-z0-9][a-z0-9-]{6,80}$'
  limit 1;

  if viewer is null then
    return;
  end if;

  return query
  select f.player_id, visible.gifts, visible.trades, f.updated_at
  from public.fishing_mail_contributions f
  cross join lateral (
    select
      coalesce((
        select jsonb_object_agg(e.key, e.value)
        from jsonb_each(f.gifts) e
        where e.value->>'fromId' = viewer
           or e.value->>'toPlayerId' = viewer
      ), '{}'::jsonb) as gifts,
      coalesce((
        select jsonb_object_agg(e.key, e.value)
        from jsonb_each(f.trades) e
        where e.value->>'aId' = viewer
           or e.value->>'bId' = viewer
      ), '{}'::jsonb) as trades
  ) visible
  where visible.gifts <> '{}'::jsonb
     or visible.trades <> '{}'::jsonb;
end;
$$;

revoke all on function public.list_visible_fishing_mail() from public, anon;
grant execute on function public.list_visible_fishing_mail() to authenticated;

commit;
