begin;

-- Authenticated postgres_changes for invite credits.
-- Replica identity full so UPDATE/DELETE payloads include player_id and inviter_id.
alter table public.referral_contributions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'referral_contributions'
  ) then
    execute 'alter publication supabase_realtime add table public.referral_contributions';
  end if;
end $$;

commit;
