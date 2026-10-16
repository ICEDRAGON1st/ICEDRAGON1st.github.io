begin;

-- Authenticated postgres_changes for online match rooms.
-- Replica identity full so UPDATE/DELETE payloads include player_id and rooms.
alter table public.match_room_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_room_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.match_room_contributions';
  end if;
end $$;

commit;
