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
