begin;

-- Lock leftover Fishing weekend luck and Paper Claim boards now that
-- community_meter_state and paper_room_contributions are live.
-- Do not put hub_docs on Realtime.

drop policy if exists hub_docs_insert_non_admin on public.hub_docs;
create policy hub_docs_insert_non_admin
  on public.hub_docs
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and id not like 'account-bag:%'
    and id not like 'paper-io-%'
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates',
      'hub-leaderboard-resets',
      'hub-feedback-deletes',
      'leaderboards',
      'plays-log',
      'name-registry',
      'player-codes',
      'name-reservations',
      'presence',
      'players-alltime',
      'friend-chat',
      'friends',
      'player-feedback',
      'online-matches',
      'fishing-gifts',
      'fishing-player-mail',
      'fishing-aquariums',
      'fishing-community',
      'hub-calls',
      'hub-referrals-v1',
      'hub-game-popularity-v1',
      'player-passwords'
    )
  );

drop policy if exists hub_docs_update_non_admin on public.hub_docs;
create policy hub_docs_update_non_admin
  on public.hub_docs
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and id not like 'account-bag:%'
    and id not like 'paper-io-%'
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates',
      'hub-leaderboard-resets',
      'hub-feedback-deletes',
      'leaderboards',
      'plays-log',
      'name-registry',
      'player-codes',
      'name-reservations',
      'presence',
      'players-alltime',
      'friend-chat',
      'friends',
      'player-feedback',
      'online-matches',
      'fishing-gifts',
      'fishing-player-mail',
      'fishing-aquariums',
      'fishing-community',
      'hub-calls',
      'hub-referrals-v1',
      'hub-game-popularity-v1',
      'player-passwords'
    )
  )
  with check (
    (select auth.uid()) is not null
    and id not like 'account-bag:%'
    and id not like 'paper-io-%'
    and id not in (
      'fishing-admin-events',
      'fishing-admin-audit',
      'fishing-admin-announce',
      'hub-admin-announce',
      'hub-admin-maintenance',
      'hub-admin-moderation',
      'hub-admin-grants',
      'hub-discord-site-updates',
      'hub-leaderboard-resets',
      'hub-feedback-deletes',
      'leaderboards',
      'plays-log',
      'name-registry',
      'player-codes',
      'name-reservations',
      'presence',
      'players-alltime',
      'friend-chat',
      'friends',
      'player-feedback',
      'online-matches',
      'fishing-gifts',
      'fishing-player-mail',
      'fishing-aquariums',
      'fishing-community',
      'hub-calls',
      'hub-referrals-v1',
      'hub-game-popularity-v1',
      'player-passwords'
    )
  );

commit;
