begin;

-- Authenticated postgres_changes for Who's online. Replica identity full so
-- UPDATE/DELETE payloads include player_id, not only the primary key.
alter table public.presence_pings replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'presence_pings'
  ) then
    execute 'alter publication supabase_realtime add table public.presence_pings';
  end if;
end $$;

commit;
