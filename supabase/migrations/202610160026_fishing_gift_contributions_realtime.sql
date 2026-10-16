begin;

-- Authenticated postgres_changes for Fishing admin gifts.
-- Replica identity full so UPDATE/DELETE payloads include player_id and gifts.
alter table public.fishing_gift_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fishing_gift_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.fishing_gift_contributions';
  end if;
end $$;

commit;
