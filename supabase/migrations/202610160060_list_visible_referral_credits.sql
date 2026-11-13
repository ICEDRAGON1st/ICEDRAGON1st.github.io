begin;

-- Return invite credits for the public count, with login codes and names
-- only on rows this player sent or received. Keep the table read so older
-- clients still load invites until a later migration limits those reads.

create or replace function public.list_visible_referral_credits()
returns table (
  player_id text,
  inviter_id text,
  inviter_code text,
  invitee_name text,
  credited_at timestamptz,
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
    select r.player_id
    from public.referral_contributions r
    where r.user_id = auth.uid()
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
  select
    f.player_id,
    f.inviter_id,
    case
      when f.player_id = viewer or f.inviter_id = viewer then f.inviter_code
      else ''
    end,
    case
      when f.player_id = viewer or f.inviter_id = viewer then f.invitee_name
      else ''
    end,
    f.credited_at,
    f.updated_at
  from public.referral_contributions f;
end;
$$;

revoke all on function public.list_visible_referral_credits() from public, anon;
grant execute on function public.list_visible_referral_credits() to authenticated;

commit;
