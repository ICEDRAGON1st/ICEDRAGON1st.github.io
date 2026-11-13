begin;

-- Discord /link still writes through upsert_discord_link. The table itself
-- holds login codes, and the hub never reads it, so signed-in players should
-- not be able to list those rows.

revoke select on table public.discord_links from anon, authenticated;

drop policy if exists discord_links_read_authenticated on public.discord_links;

commit;
