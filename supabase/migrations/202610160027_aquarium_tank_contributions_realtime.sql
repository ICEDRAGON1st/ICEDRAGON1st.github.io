begin;

-- Authenticated postgres_changes for Fishing aquarium tanks.
-- Replica identity full so UPDATE/DELETE payloads include player_id and tank.
alter table public.aquarium_tank_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'aquarium_tank_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.aquarium_tank_contributions';
  end if;
end $$;

commit;
