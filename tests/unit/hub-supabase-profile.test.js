"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const supabase = require(path.resolve(__dirname, "../../hub-supabase.js"));

test("hub supabase accepts only auth-owned player profiles", () => {
  assert.equal(supabase.parseProfile(null), null);
  assert.equal(supabase.parseProfile({ player_id: "p-abc" }), null);
  assert.equal(
    supabase.parseProfile({
      user_id: "not-a-uuid",
      player_id: "p-0123456789abcd"
    }),
    null
  );
  assert.equal(
    supabase.parseProfile({
      user_id: "11111111-2222-3333-4444-555555555555",
      player_id: "p-local-hyphen"
    }),
    null
  );
  assert.deepEqual(
    supabase.parseProfile({
      user_id: "11111111-2222-3333-4444-555555555555",
      player_id: "p-0123456789abcdef",
      display_name: "  Ice <Dragon>  "
    }),
    {
      userId: "11111111-2222-3333-4444-555555555555",
      playerId: "p-0123456789abcdef",
      displayName: "Ice Dragon"
    }
  );
});

test("auth bind keeps hyphenated local player ids and restores only when local is empty", () => {
  assert.equal(supabase.parseLocalPlayerId("p-lkh3x2a-ab12cd"), "p-lkh3x2a-ab12cd");
  assert.equal(supabase.parseLocalPlayerId("p-0123456789abcd"), "p-0123456789abcd");
  assert.equal(supabase.parseLocalPlayerId("p-abc"), "");
  assert.equal(supabase.parseLocalPlayerId("p-undefined"), "");
  assert.equal(supabase.parseLocalPlayerId(""), "");

  assert.deepEqual(
    supabase.resolveBoundPlayerId({
      localId: "p-localid12-zz99",
      boundId: "p-0123456789abcd",
      metadataId: "p-metaid1234-aa"
    }),
    { playerId: "p-localid12-zz99", source: "local", persist: true }
  );
  assert.deepEqual(
    supabase.resolveBoundPlayerId({
      localId: "",
      boundId: "p-savedbind1-aa",
      metadataId: "p-metaid1234-aa"
    }),
    { playerId: "p-savedbind1-aa", source: "bound", persist: false }
  );
  assert.deepEqual(
    supabase.resolveBoundPlayerId({
      localId: "",
      boundId: "",
      metadataId: "p-metaid1234-aa"
    }),
    { playerId: "p-metaid1234-aa", source: "metadata", persist: false }
  );
  assert.deepEqual(supabase.resolveBoundPlayerId({}), {
    playerId: "",
    source: "",
    persist: false
  });
});

test("hub supabase accepts only well-formed player_saves rows", () => {
  assert.equal(supabase.parseSave(null), null);
  assert.equal(supabase.parseSave({ save_key: "bad key", payload: { kv: {} } }), null);
  assert.equal(supabase.parseSave({ save_key: "account-bag:p-abc", payload: null }), null);
  assert.deepEqual(
    supabase.parseSave({
      save_key: "account-bag:p-0123456789ab",
      payload: { playerId: "p-0123456789ab", kv: { "hub-look-theme": "ice" } },
      schema_version: 1,
      updated_at: "2026-10-15T00:00:00.000Z"
    }),
    {
      saveKey: "account-bag:p-0123456789ab",
      payload: { playerId: "p-0123456789ab", kv: { "hub-look-theme": "ice" } },
      schemaVersion: 1,
      updatedAt: "2026-10-15T00:00:00.000Z"
    }
  );
});

test("shared docs skip the old backup write after a successful account-server save", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.equal(supabase.shouldWriteMantleBackup(true), false);
  assert.equal(supabase.shouldWriteMantleBackup(false), false);
  const pushPreferSrc = src.slice(
    src.indexOf("async function pushPrefer"),
    src.indexOf("const api = {")
  );
  assert.doesNotMatch(pushPreferSrc, /fetch\(_?mantleUrl/);
  assert.doesNotMatch(pushPreferSrc, /upsertDoc\(/);
  assert.match(pushPreferSrc, /throw new Error\("push failed"\)/);
});

test("shared docs skip the old backup read when the account server errors", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  assert.equal(supabase.shouldReadMantleBackup(true), false);
  assert.equal(supabase.shouldReadMantleBackup(false), false);
  const getPreferSrc = src.slice(
    src.indexOf("async function getPrefer"),
    src.indexOf("function shouldWriteMantleBackup")
  );
  assert.doesNotMatch(getPreferSrc, /fetch\(_?mantleUrl/);
  assert.doesNotMatch(getPreferSrc, /getDoc\(/);
  assert.match(getPreferSrc, /return null;/);
  assert.match(
    plays.slice(
      plays.indexOf("async function fetchPresenceRemote"),
      plays.indexOf("async function fetchPresenceTableRemote")
    ),
    /throw new Error\("presence-unavailable"\)/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchPresenceRemote"),
      plays.indexOf("async function fetchPresenceTableRemote")
    ),
    /fetchDoc/
  );
  assert.match(
    plays.slice(
      plays.indexOf("async function fetchCodesRemote"),
      plays.indexOf("async function fetchCodesTableRemote")
    ),
    /throw new Error\("codes-unavailable"\)/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchCodesRemote"),
      plays.indexOf("async function fetchCodesTableRemote")
    ),
    /fetchDoc/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function syncPopularity"),
      plays.indexOf("function getMostPopularGameId")
    ),
    /fetchDoc|pushDoc/
  );
});

test("signed-in leftover tables retry once after a PostgREST schema reload", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160052_remaining_leftover.sql"),
    "utf8"
  );
  assert.match(src, /async function hubFetch/);
  assert.match(src, /reload_postgrest_schema/);
  assert.match(src, /PGRST205/);
  assert.match(src, /schemaReloadAttempted/);
  assert.match(src, /await hubFetch\(`\$\{SUPABASE_URL\}\/rest\/v1\/community_meter_state`/);
  assert.match(src, /await hubFetch\(`\$\{SUPABASE_URL\}\/rest\/v1\/paper_room_contributions`/);
  assert.match(sql, /create or replace function public\.reload_postgrest_schema/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
  assert.match(sql, /create table if not exists public\.community_meter_state/);
  assert.match(sql, /create table if not exists public\.paper_room_contributions/);
  assert.match(sql, /create table if not exists public\.community_cast_contributions/);
  assert.match(sql, /create table if not exists public\.discord_links/);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /grant execute on function public\.reload_postgrest_schema\(\) to anon/);
});

test("contracted leftover boards skip hub_docs reads and writes", async () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.equal(typeof supabase.isLeftoverLockedDoc, "function");
  assert.equal(typeof supabase.isLeftoverOpenDoc, "function");
  assert.equal(supabase.isLeftoverLockedDoc("leaderboards"), true);
  assert.equal(supabase.isLeftoverLockedDoc("player-feedback"), true);
  assert.equal(supabase.isLeftoverLockedDoc("name-registry"), true);
  assert.equal(supabase.isLeftoverLockedDoc("friends"), true);
  assert.equal(supabase.isLeftoverLockedDoc("player-passwords"), true);
  assert.equal(supabase.isLeftoverLockedDoc("discord-links-v1"), true);
  assert.equal(supabase.isLeftoverLockedDoc("account-bag:p-0123456789ab"), true);
  assert.equal(supabase.isLeftoverLockedDoc("fishing-community"), true);
  assert.equal(supabase.isLeftoverLockedDoc("paper-io-lobbies"), true);
  assert.equal(supabase.isLeftoverLockedDoc("paper-io-room-AB12"), true);
  assert.equal(supabase.isLeftoverLockedDoc("hub-admin-announce"), false);
  assert.equal(supabase.isLeftoverOpenDoc("fishing-community"), false);
  assert.equal(supabase.isLeftoverOpenDoc("paper-io-lobbies"), false);
  assert.equal(supabase.isLeftoverOpenDoc("paper-io-room-AB12"), false);
  assert.equal(supabase.isLeftoverOpenDoc("paper-io-input-AB12-p-0123456789ab"), false);
  assert.equal(supabase.isLeftoverOpenDoc("leaderboards"), false);
  assert.equal(supabase.isLeftoverOpenDoc("friends"), false);
  assert.equal(supabase.isLeftoverOpenDoc("hub-admin-announce"), false);
  const getDocSrc = src.slice(src.indexOf("async function getDoc"), src.indexOf("async function upsertDoc"));
  const upsertDocSrc = src.slice(
    src.indexOf("async function upsertDoc"),
    src.indexOf("async function upsertAdminDoc")
  );
  assert.match(getDocSrc, /return null;/);
  assert.doesNotMatch(getDocSrc, /isLeftoverOpenDoc|isLeftoverLockedDoc|hubFetch/);
  assert.match(upsertDocSrc, /throw new Error\("leftover-locked"\)/);
  assert.doesNotMatch(upsertDocSrc, /isLeftoverOpenDoc|isLeftoverLockedDoc|isAdminDoc|hubFetch/);
  assert.doesNotMatch(getDocSrc, /rest\/v1\/hub_docs/);
  assert.doesNotMatch(upsertDocSrc, /rest\/v1\/hub_docs/);
  assert.doesNotMatch(getDocSrc, /hubFetch/);
  assert.doesNotMatch(upsertDocSrc, /hubFetch/);
  const getPreferSrc = src.slice(
    src.indexOf("async function getPrefer"),
    src.indexOf("function shouldWriteMantleBackup")
  );
  const pushPreferSrc = src.slice(
    src.indexOf("async function pushPrefer"),
    src.indexOf("const api = {")
  );
  assert.doesNotMatch(getPreferSrc, /getDoc\(/);
  assert.doesNotMatch(pushPreferSrc, /upsertDoc\(/);
  assert.equal(await supabase.getPrefer("fishing-community"), null);
  await assert.rejects(() => supabase.pushPrefer("fishing-community", {}), /push failed/);
});

test("locked admin docs use the trusted RPC instead of a direct hub_docs upsert", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const admin = fs.readFileSync(path.join(__dirname, "../../hub-admin.js"), "utf8");
  const fishing = fs.readFileSync(path.join(__dirname, "../../fishing/script.js"), "utf8");
  assert.equal(supabase.isAdminDoc("fishing-admin-events"), true);
  assert.equal(supabase.isAdminDoc("fishing-admin-announce"), true);
  assert.equal(supabase.isAdminDoc("hub-admin-grants"), true);
  assert.equal(supabase.isAdminDoc("fishing-community"), false);
  assert.match(src, /upsert_admin_hub_doc/);
  assert.match(admin, /api\.upsertAdminDoc/);
  assert.match(fishing, /upsertAdminDoc\(ADMIN_EVENT_DOC/);
  assert.match(fishing, /return \{ ok: true, rateLimited: false \}/);
  assert.doesNotMatch(
    fishing.slice(
      fishing.indexOf("async function pushAdminBundleRemote"),
      fishing.indexOf("async function maybeRetryPendingAdminPush")
    ),
    /upsertDoc|pushPrefer/
  );
  assert.match(fishing, /upsertAdminDoc\(ADMIN_ANNOUNCE_DOC/);
});

test("presence pings use auth-owned rows instead of rewriting the shared presence document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPresencePings/);
  assert.match(src, /async function upsertPresencePing/);
  assert.match(src, /async function deletePresencePing/);
  assert.match(src, /function subscribePresencePings/);
  assert.match(src, /function subscribeChatThreadContributions/);
  assert.match(src, /function subscribeFriendEdgeContributions/);
  assert.match(src, /function subscribeCallSignalContributions/);
  assert.match(src, /function subscribeMatchRoomContributions/);
  assert.match(src, /function subscribePaperRoomContributions/);
  assert.match(src, /function subscribeFishingMailContributions/);
  assert.match(src, /function subscribeFishingGiftContributions/);
  assert.match(src, /function subscribeAquariumTankContributions/);
  assert.match(src, /function subscribeCommunityCastContributions/);
  assert.match(src, /function subscribeFeedbackItemContributions/);
  assert.match(src, /function subscribeLeaderboardPbContributions/);
  assert.match(src, /function subscribePopularityContributions/);
  assert.match(src, /function subscribePlayLogContributions/);
  assert.match(src, /function subscribeNicknameClaims/);
  assert.match(src, /function subscribeAlltimeRoster/);
  assert.match(src, /function subscribePlayerCodeClaims/);
  assert.match(src, /function subscribeNameReservationLocks/);
  assert.match(src, /function subscribeAdminBroadcasts/);
  assert.match(src, /realtime\/v1\/websocket/);
  assert.match(src, /presence_pings/);
  assert.match(src, /chat_thread_contributions/);
  assert.match(src, /friend_edge_contributions/);
});

test("popularity contributions use auth-owned rows instead of rewriting the shared play-count document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPopularityContributions/);
  assert.match(src, /async function upsertPopularityContribution/);
  assert.match(src, /function subscribePopularityContributions/);
  assert.match(src, /popularity_contributions/);
});

test("play log contributions use auth-owned rows instead of rewriting the shared plays document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPlayLogContributions/);
  assert.match(src, /async function upsertPlayLogContribution/);
  assert.match(src, /function subscribePlayLogContributions/);
  assert.match(src, /play_log_contributions/);
});

test("player code claims use auth-owned rows instead of rewriting the shared code document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPlayerCodeClaims/);
  assert.match(src, /async function getPlayerCodeClaim/);
  assert.match(src, /async function getPlayerCodeClaimByPlayerId/);
  assert.match(src, /player_id=eq\.\$\{encodeURIComponent\(id\)\}/);
  const codeLookup = src.slice(
    src.indexOf("async function getPlayerCodeClaim"),
    src.indexOf("async function getPlayerCodeClaimByPlayerId")
  );
  assert.match(codeLookup, /rpc\/lookup_player_by_code/);
  assert.match(codeLookup, /raw_code: norm/);
  assert.match(codeLookup, /if \(rpc\.status !== 404\)/);
  assert.match(codeLookup, /code=eq\.\$\{encodeURIComponent\(norm\)\}/);
  const codeList = src.slice(
    src.indexOf("async function listPlayerCodeClaims"),
    src.indexOf("async function getPlayerCodeClaim")
  );
  assert.match(codeList, /return null/);
  assert.doesNotMatch(codeList, /player_code_claims\?select=/);
  const lockList = src.slice(
    src.indexOf("async function listNameReservationLocks"),
    src.indexOf("async function getNameReservationLock")
  );
  assert.match(lockList, /return null/);
  assert.doesNotMatch(lockList, /name_reservation_locks\?select=/);
  const byPlayer = src.slice(
    src.indexOf("async function getPlayerCodeClaimByPlayerId"),
    src.indexOf("async function upsertPlayerCodeClaim")
  );
  assert.match(byPlayer, /select=player_id,user_id,display_name,claimed_at/);
  assert.match(byPlayer, /row\.user_id === sessionUserId\(session\)/);
  assert.match(byPlayer, /select=player_id,code,display_name,claimed_at/);
  assert.match(src, /async function upsertPlayerCodeClaim/);
  assert.match(src, /function subscribePlayerCodeClaims/);
  assert.match(src, /player_code_claims/);
});

test("nickname claims use auth-owned rows instead of rewriting the shared name registry", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listNicknameClaims/);
  assert.match(src, /async function upsertNicknameClaim/);
  assert.match(src, /function subscribeNicknameClaims/);
  assert.match(src, /nickname_claims/);
  const list = src.slice(
    src.indexOf("async function listNicknameClaims"),
    src.indexOf("async function upsertNicknameClaim")
  );
  assert.match(list, /rpc\/list_visible_nickname_claims/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleNicknamesReady = true/);
  assert.match(list, /nickname_claims\?select=player_id,name_key,claim/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160061_list_visible_nickname_claims.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_nickname_claims/);
  assert.match(sql, /security definer/);
  assert.match(sql, /ice_dragon/);
  assert.match(sql, /playerCode/);
  assert.match(sql, /grant execute on function public\.list_visible_nickname_claims\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("name reservation locks use auth-owned rows instead of rewriting the shared lock document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  assert.match(src, /async function listNameReservationLocks/);
  assert.match(src, /async function getNameReservationLock/);
  assert.match(src, /name_key=eq\.\$\{encodeURIComponent\(key\)\}/);
  assert.match(src, /async function upsertNameReservationLock/);
  assert.match(src, /function subscribeNameReservationLocks/);
  assert.match(src, /name_reservation_locks/);
  const lookup = src.slice(
    src.indexOf("async function getNameReservationLock"),
    src.indexOf("async function upsertNameReservationLock")
  );
  assert.match(lookup, /rpc\/lookup_name_reservation/);
  assert.match(lookup, /raw_name: key/);
  assert.match(lookup, /raw_code: submitted/);
  assert.match(lookup, /if \(rpc\.status !== 404\)/);
  assert.match(lookup, /select=player_id,user_id,name_key,display_name,locked_at/);
  assert.match(lookup, /row\.user_id === sessionUserId\(session\)/);
  assert.match(lookup, /code=eq\.\$\{encodeURIComponent\(submitted\)\}/);
  assert.match(lookup, /select=player_id,name_key,display_name,locked_at&limit=1/);
  assert.match(lookup, /select=player_id,name_key,code,display_name,locked_at/);
  assert.match(lookup, /code: ownCode\.length === 8 \? ownCode : allowed && submitted\.length === 8 \? submitted : ""/);
  assert.match(plays, /resolveNameReservation\(key, myCode\)/);
  assert.match(plays, /fetchReservationsRemote\(name, norm\)/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160064_lookup_name_reservation.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.lookup_name_reservation\(text, text\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /owner = auth\.uid\(\) or \(norm <> '' and stored = norm\)/);
  assert.match(sql, /case when owner = auth\.uid\(\) then stored else '' end/);
  assert.match(
    sql,
    /grant execute on function public\.lookup_name_reservation\(text, text\) to authenticated/
  );
  assert.doesNotMatch(sql, /drop policy/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("player password hashes use auth-owned rows instead of rewriting the shared password document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPlayerPasswordHashes/);
  assert.match(src, /async function upsertPlayerPasswordHash/);
  assert.match(src, /player_password_hashes/);
  assert.doesNotMatch(src, /password_hash: String\(row\?\.password\)/);
  const lookup = src.slice(
    src.indexOf("async function listPlayerPasswordHashes"),
    src.indexOf("function normalizeStoredPasswordHash")
  );
  assert.match(lookup, /rpc\/lookup_player_password_hash/);
  assert.match(lookup, /p_hash: passwordHash/);
  assert.match(lookup, /if \(rpc\.status !== 404\)/);
  assert.match(lookup, /password_hash=eq\.\$\{encodeURIComponent\(passwordHash\)\}/);
  assert.match(lookup, /if \(!passwordHash\) return \[\]/);
  assert.doesNotMatch(lookup, /player_password_hashes\?select=/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160054_lookup_player_password_hash.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.lookup_player_password_hash/);
  assert.match(sql, /security definer/);
  assert.match(sql, /grant execute on function public\.lookup_player_password_hash\(text\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("password Auth uses a derived email and never stores the typed password", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  assert.equal(
    supabase.playerAuthEmail("p-0123456789abcd"),
    "p-0123456789abcd@players.icedragon1st.github.io"
  );
  assert.equal(supabase.playerAuthEmail("p-abc"), "");
  assert.equal(supabase.playerAuthEmail(""), "");
  assert.match(src, /function playerAuthEmail/);
  const sessionSlice = src.slice(src.indexOf("async function ensureSession"), src.indexOf("async function accessToken"));
  assert.match(sessionSlice, /if \(sessionPromise\) return sessionPromise/);
  assert.match(sessionSlice, /if \(sessionPromise === pending\) sessionPromise = null/);
  assert.match(src, /async function signInWithPasswordAccount/);
  assert.match(src, /async function upgradeAnonymousPassword/);
  assert.match(src, /grant_type=password/);
  assert.match(src, /players\.icedragon1st\.github\.io/);
  assert.doesNotMatch(src, /password_hash: pw/);
  assert.doesNotMatch(src, /payload: \{[^}]*password: pw/);
  assert.match(plays, /upgradeAnonymousPassword/);
  assert.match(plays, /signInWithPasswordAccount/);
  assert.doesNotMatch(plays, /localStorage\.setItem\([^)]*password: pw/);
});

test("all-time roster uses auth-owned rows instead of rewriting the shared player list", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listAlltimeRoster/);
  assert.match(src, /async function upsertAlltimeRoster/);
  assert.match(src, /function subscribeAlltimeRoster/);
  assert.match(src, /alltime_roster/);
});

test("call signaling uses auth-owned rows instead of rewriting the shared call board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listCallSignalContributions/);
  assert.match(src, /async function upsertCallSignalContribution/);
  assert.match(src, /function subscribeCallSignalContributions/);
  assert.match(src, /call_signal_contributions/);
  const list = src.slice(
    src.indexOf("async function listCallSignalContributions"),
    src.indexOf("async function upsertCallSignalContribution")
  );
  assert.match(list, /rpc\/list_visible_call_signals/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleCallsReady = true/);
  assert.match(list, /call_signal_contributions\?select=player_id,rooms/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160057_list_visible_call_signals.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_call_signals/);
  assert.match(sql, /security definer/);
  assert.match(sql, /identity-bind/);
  assert.match(sql, /jsonb_exists/);
  assert.match(sql, /grant execute on function public\.list_visible_call_signals\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("friend edges use auth-owned rows instead of rewriting the shared friends board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFriendEdgeContributions/);
  assert.match(src, /async function upsertFriendEdgeContribution/);
  assert.match(src, /function subscribeFriendEdgeContributions/);
  assert.match(src, /friend_edge_contributions/);
  const list = src.slice(
    src.indexOf("async function listFriendEdgeContributions"),
    src.indexOf("async function upsertFriendEdgeContribution")
  );
  assert.match(list, /rpc\/list_visible_friend_edges/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleFriendsReady = true/);
  assert.match(
    list,
    /friend_edge_contributions\?select=player_id,display_name,friends,outgoing,incoming,invites,updated_at/
  );
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160056_list_visible_friend_edges.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_friend_edges/);
  assert.match(sql, /security definer/);
  assert.match(sql, /identity-bind/);
  assert.match(sql, /jsonb_exists/);
  assert.match(sql, /grant execute on function public\.list_visible_friend_edges\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("friend chat uses auth-owned rows instead of rewriting the shared chat board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listChatThreadContributions/);
  assert.match(src, /async function upsertChatThreadContribution/);
  assert.match(src, /function subscribeChatThreadContributions/);
  assert.match(src, /chat_thread_contributions/);
  const list = src.slice(
    src.indexOf("async function listChatThreadContributions"),
    src.indexOf("async function upsertChatThreadContribution")
  );
  assert.match(list, /rpc\/list_visible_chat_threads/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleChatReady = true/);
  assert.match(list, /chat_thread_contributions\?select=player_id,threads,updated_at/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160055_list_visible_chat_threads.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_chat_threads/);
  assert.match(sql, /security definer/);
  assert.match(sql, /identity-bind/);
  assert.match(sql, /jsonb_exists/);
  assert.match(sql, /grant execute on function public\.list_visible_chat_threads\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("leaderboard personal bests use auth-owned rows instead of rewriting the shared board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listLeaderboardPbContributions/);
  assert.match(src, /async function upsertLeaderboardPbContribution/);
  assert.match(src, /function subscribeLeaderboardPbContributions/);
  assert.match(src, /leaderboard_pb_contributions/);
  assert.match(src, /id === "__namebind"/);
});

test("online match rooms use auth-owned rows instead of rewriting the shared match board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listMatchRoomContributions/);
  assert.match(src, /async function upsertMatchRoomContribution/);
  assert.match(src, /function subscribeMatchRoomContributions/);
  assert.match(src, /match_room_contributions/);
});

test("Paper Claim rooms use auth-owned rows instead of rewriting the shared arena documents", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPaperRoomContributions/);
  assert.match(src, /async function upsertPaperRoomContribution/);
  assert.match(src, /function subscribePaperRoomContributions/);
  assert.match(src, /paper_room_contributions/);
  assert.match(src, /hostId !== me/);
});

test("feedback tickets use auth-owned rows instead of rewriting the shared inbox", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFeedbackItemContributions/);
  assert.match(src, /async function upsertFeedbackItemContribution/);
  assert.match(src, /function subscribeFeedbackItemContributions/);
  assert.match(src, /feedback_item_contributions/);
  const feedbackList = src.slice(
    src.indexOf("async function listFeedbackItemContributions"),
    src.indexOf("async function upsertFeedbackItemContribution")
  );
  assert.match(feedbackList, /player_id=eq\.\$\{encodeURIComponent\(id\)\}/);
  assert.match(feedbackList, /if \(id\) url \+=/);
});

test("fishing community casts use auth-owned rows instead of rewriting the shared meter", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listCommunityCastContributions/);
  assert.match(src, /async function upsertCommunityCastContribution/);
  assert.match(src, /function subscribeCommunityCastContributions/);
  assert.match(src, /community_cast_contributions/);
});

test("fishing community luck reward uses signed-in meter state instead of rewriting the shared meter", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listCommunityMeterState/);
  assert.match(src, /async function upsertCommunityMeterState/);
  assert.match(src, /function subscribeCommunityMeterState/);
  assert.match(src, /community_meter_state/);
});

test("fishing player mail uses auth-owned rows instead of rewriting the shared mail board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFishingMailContributions/);
  assert.match(src, /async function upsertFishingMailContribution/);
  assert.match(src, /function subscribeFishingMailContributions/);
  assert.match(src, /fishing_mail_contributions/);
  const list = src.slice(
    src.indexOf("async function listFishingMailContributions"),
    src.indexOf("async function upsertFishingMailContribution")
  );
  assert.match(list, /rpc\/list_visible_fishing_mail/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleMailReady = true/);
  assert.match(list, /fishing_mail_contributions\?select=player_id,gifts,trades,updated_at/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160058_list_visible_fishing_mail.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_fishing_mail/);
  assert.match(sql, /security definer/);
  assert.match(sql, /identity-bind/);
  assert.match(sql, /toPlayerId/);
  assert.match(sql, /grant execute on function public\.list_visible_fishing_mail\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("fishing admin gifts use auth-owned rows instead of rewriting the shared gift board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFishingGiftContributions/);
  assert.match(src, /async function upsertFishingGiftContribution/);
  assert.match(src, /function subscribeFishingGiftContributions/);
  assert.match(src, /fishing_gift_contributions/);
  const list = src.slice(
    src.indexOf("async function listFishingGiftContributions"),
    src.indexOf("async function upsertFishingGiftContribution")
  );
  assert.match(list, /rpc\/list_visible_fishing_gifts/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleGiftsReady = true/);
  assert.match(list, /fishing_gift_contributions\?select=player_id,gifts,updated_at/);
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160059_list_visible_fishing_gifts.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_fishing_gifts/);
  assert.match(sql, /security definer/);
  assert.match(sql, /identity-bind/);
  assert.match(sql, /broadcast/);
  assert.match(sql, /grant execute on function public\.list_visible_fishing_gifts\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("admin broadcasts use a dedicated table instead of publishing hub_docs", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const admin = fs.readFileSync(path.join(__dirname, "../../hub-admin.js"), "utf8");
  assert.match(src, /async function listAdminBroadcasts/);
  assert.match(src, /function subscribeAdminBroadcasts/);
  assert.match(src, /admin_broadcasts/);
  assert.match(src, /hub-leaderboard-resets/);
  assert.match(src, /hub-feedback-deletes/);
  assert.match(admin, /api\.upsertAdminDoc/);
  assert.match(admin, /listAdminBroadcasts/);
  assert.doesNotMatch(src, /async function upsertAdminBroadcast/);
});

test("invite credits use auth-owned rows instead of rewriting the shared referral board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listReferralContributions/);
  assert.match(src, /async function upsertReferralContribution/);
  assert.match(src, /function subscribeReferralContributions/);
  assert.match(src, /referral_contributions/);
  const list = src.slice(
    src.indexOf("async function listReferralContributions"),
    src.indexOf("async function upsertReferralContribution")
  );
  assert.match(list, /rpc\/list_visible_referral_credits/);
  assert.match(list, /if \(rpc\.status !== 404\)/);
  assert.match(list, /visibleReferralsReady = true/);
  assert.match(
    list,
    /referral_contributions\?select=player_id,inviter_id,inviter_code,invitee_name,credited_at,updated_at/
  );
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160060_list_visible_referral_credits.sql"),
    "utf8"
  );
  assert.match(sql, /function public\.list_visible_referral_credits/);
  assert.match(sql, /security definer/);
  assert.match(sql, /identity-bind/);
  assert.match(sql, /inviter_code/);
  assert.match(sql, /grant execute on function public\.list_visible_referral_credits\(\) to authenticated/);
  assert.doesNotMatch(sql, /drop policy/i);
});

test("fishing aquariums use auth-owned rows instead of rewriting the shared tank board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listAquariumTankContributions/);
  assert.match(src, /async function upsertAquariumTankContribution/);
  assert.match(src, /function subscribeAquariumTankContributions/);
  assert.match(src, /aquarium_tank_contributions/);
});

test("realtime join ack marks a table live and an error unmarks it", () => {
  assert.equal(typeof supabase.isRealtimeJoined, "function");
  assert.equal(typeof supabase.applyRealtimeMessage, "function");
  assert.equal(supabase.isRealtimeJoined("chat_thread_contributions"), false);
  const unsub = supabase.subscribeChatThreadContributions(() => {});
  assert.equal(supabase.isRealtimeJoined("chat_thread_contributions"), false);
  supabase.applyRealtimeMessage({
    topic: "realtime:chat-thread-contributions",
    event: "phx_reply",
    payload: {
      status: "ok",
      response: {
        postgres_changes: [
          { event: "*", schema: "public", table: "chat_thread_contributions" }
        ]
      }
    }
  });
  assert.equal(supabase.isRealtimeJoined("chat_thread_contributions"), true);
  supabase.applyRealtimeMessage({
    topic: "realtime:chat-thread-contributions",
    event: "phx_reply",
    payload: { status: "error", response: { reason: "Unable to subscribe" } }
  });
  assert.equal(supabase.isRealtimeJoined("chat_thread_contributions"), false);
  unsub();
  assert.equal(supabase.isRealtimeJoined("chat_thread_contributions"), false);
});
