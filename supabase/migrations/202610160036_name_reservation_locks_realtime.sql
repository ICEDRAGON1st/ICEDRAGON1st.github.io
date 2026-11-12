begin;

-- Authenticated postgres_changes for code-locked nicknames.
-- Replica identity full so UPDATE/DELETE payloads include player_id, name_key, and code.
alter table public.name_reservation_locks replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'name_reservation_locks'
  ) then
    execute 'alter publication supabase_realtime add table public.name_reservation_locks';
  end if;
end $$;

commit;
