begin;

-- Authenticated postgres_changes for unique nicknames.
-- Replica identity full so UPDATE/DELETE payloads include player_id, name_key, and claim.
alter table public.nickname_claims replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nickname_claims'
  ) then
    execute 'alter publication supabase_realtime add table public.nickname_claims';
  end if;
end $$;

commit;
