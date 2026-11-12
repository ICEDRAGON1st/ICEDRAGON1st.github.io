begin;

-- Authenticated postgres_changes for the Fishing weekend luck window.
-- Replica identity full so UPDATE payloads include week_key, reward_until, and lb_wave.
alter table public.community_meter_state replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_meter_state'
  ) then
    execute 'alter publication supabase_realtime add table public.community_meter_state';
  end if;
end $$;

commit;
