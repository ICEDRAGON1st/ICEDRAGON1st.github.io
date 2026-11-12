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
