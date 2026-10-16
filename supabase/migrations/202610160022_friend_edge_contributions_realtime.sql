begin;

-- Authenticated postgres_changes for friend lists and game invites.
-- Replica identity full so UPDATE/DELETE payloads include player_id and edges.
alter table public.friend_edge_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friend_edge_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.friend_edge_contributions';
  end if;
end $$;

commit;
