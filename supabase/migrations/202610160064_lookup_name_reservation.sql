begin;

-- Check a locked name without handing back someone else's login code.
-- Older clients can still read the table until a later migration limits that.

create or replace function public.lookup_name_reservation(raw_name text, raw_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  key text;
  norm text;
  owner uuid;
  pid text;
  dname text;
  locked timestamptz;
  stored text;
begin
  if auth.uid() is null then
    return null;
  end if;

  key := left(lower(btrim(coalesce(raw_name, ''))), 16);
  if key = '' then
    return null;
  end if;

  norm := left(
    upper(regexp_replace(coalesce(raw_code, ''), '[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]', '', 'g')),
    8
  );
  if norm !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$' then
    norm := '';
  end if;

  select l.user_id, l.player_id, l.display_name, l.locked_at, l.code
    into owner, pid, dname, locked, stored
  from public.name_reservation_locks l
  where l.name_key = key;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'playerId', pid,
    'nameKey', key,
    'displayName', dname,
    'lockedAt', locked,
    'allowed', (owner = auth.uid() or (norm <> '' and stored = norm)),
    'code', case when owner = auth.uid() then stored else '' end
  );
end;
$$;

revoke all on function public.lookup_name_reservation(text, text) from public, anon;
grant execute on function public.lookup_name_reservation(text, text) to authenticated;

commit;
