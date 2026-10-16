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
  assert.match(getPreferSrc, /return null;/);
  assert.match(src, /console\.warn\("\[HubSupabase\] getPrefer", docId, err\);\s*throw err;/);
  assert.match(plays, /if \(data == null\) throw new Error\("presence-unavailable"\)/);
  assert.match(plays, /if \(data == null\) throw new Error\("codes-unavailable"\)/);
  assert.match(
    plays,
    /if \(raw == null \|\| typeof raw !== "object"\) throw new Error\("popularity-unavailable"\)/
  );
});

test("locked admin docs use the trusted RPC instead of a direct hub_docs upsert", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  const admin = fs.readFileSync(path.join(__dirname, "../../hub-admin.js"), "utf8");
  const fishing = fs.readFileSync(path.join(__dirname, "../../fishing/script.js"), "utf8");
  assert.equal(supabase.isAdminDoc("fishing-admin-events"), true);
  assert.equal(supabase.isAdminDoc("hub-admin-grants"), true);
  assert.equal(supabase.isAdminDoc("fishing-community"), false);
  assert.match(src, /upsert_admin_hub_doc/);
  assert.match(admin, /api\.upsertAdminDoc/);
  assert.match(fishing, /upsertAdminDoc\(ADMIN_EVENT_DOC/);
  assert.match(fishing, /if \(ok\) return \{ ok: true, rateLimited: false \}/);
  assert.match(fishing, /pushPrefer\(\s*ADMIN_ANNOUNCE_DOC/);
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
  assert.match(src, /function subscribeFishingMailContributions/);
  assert.match(src, /function subscribeFishingGiftContributions/);
  assert.match(src, /function subscribeAquariumTankContributions/);
  assert.match(src, /function subscribeCommunityCastContributions/);
  assert.match(src, /function subscribeFeedbackItemContributions/);
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
  assert.match(src, /popularity_contributions/);
});

test("play log contributions use auth-owned rows instead of rewriting the shared plays document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPlayLogContributions/);
  assert.match(src, /async function upsertPlayLogContribution/);
  assert.match(src, /play_log_contributions/);
});

test("player code claims use auth-owned rows instead of rewriting the shared code document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPlayerCodeClaims/);
  assert.match(src, /async function getPlayerCodeClaim/);
  assert.match(src, /async function upsertPlayerCodeClaim/);
  assert.match(src, /player_code_claims/);
});

test("nickname claims use auth-owned rows instead of rewriting the shared name registry", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listNicknameClaims/);
  assert.match(src, /async function upsertNicknameClaim/);
  assert.match(src, /nickname_claims/);
});

test("name reservation locks use auth-owned rows instead of rewriting the shared lock document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listNameReservationLocks/);
  assert.match(src, /async function upsertNameReservationLock/);
  assert.match(src, /name_reservation_locks/);
});

test("player password hashes use auth-owned rows instead of rewriting the shared password document", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listPlayerPasswordHashes/);
  assert.match(src, /async function upsertPlayerPasswordHash/);
  assert.match(src, /player_password_hashes/);
  assert.doesNotMatch(src, /password_hash: String\(row\?\.password\)/);
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
  assert.match(src, /alltime_roster/);
});

test("call signaling uses auth-owned rows instead of rewriting the shared call board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listCallSignalContributions/);
  assert.match(src, /async function upsertCallSignalContribution/);
  assert.match(src, /function subscribeCallSignalContributions/);
  assert.match(src, /call_signal_contributions/);
});

test("friend edges use auth-owned rows instead of rewriting the shared friends board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFriendEdgeContributions/);
  assert.match(src, /async function upsertFriendEdgeContribution/);
  assert.match(src, /function subscribeFriendEdgeContributions/);
  assert.match(src, /friend_edge_contributions/);
});

test("friend chat uses auth-owned rows instead of rewriting the shared chat board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listChatThreadContributions/);
  assert.match(src, /async function upsertChatThreadContribution/);
  assert.match(src, /function subscribeChatThreadContributions/);
  assert.match(src, /chat_thread_contributions/);
});

test("leaderboard personal bests use auth-owned rows instead of rewriting the shared board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listLeaderboardPbContributions/);
  assert.match(src, /async function upsertLeaderboardPbContribution/);
  assert.match(src, /leaderboard_pb_contributions/);
});

test("online match rooms use auth-owned rows instead of rewriting the shared match board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listMatchRoomContributions/);
  assert.match(src, /async function upsertMatchRoomContribution/);
  assert.match(src, /function subscribeMatchRoomContributions/);
  assert.match(src, /match_room_contributions/);
});

test("feedback tickets use auth-owned rows instead of rewriting the shared inbox", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFeedbackItemContributions/);
  assert.match(src, /async function upsertFeedbackItemContribution/);
  assert.match(src, /function subscribeFeedbackItemContributions/);
  assert.match(src, /feedback_item_contributions/);
});

test("fishing community casts use auth-owned rows instead of rewriting the shared meter", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listCommunityCastContributions/);
  assert.match(src, /async function upsertCommunityCastContribution/);
  assert.match(src, /function subscribeCommunityCastContributions/);
  assert.match(src, /community_cast_contributions/);
});

test("fishing player mail uses auth-owned rows instead of rewriting the shared mail board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFishingMailContributions/);
  assert.match(src, /async function upsertFishingMailContribution/);
  assert.match(src, /function subscribeFishingMailContributions/);
  assert.match(src, /fishing_mail_contributions/);
});

test("fishing admin gifts use auth-owned rows instead of rewriting the shared gift board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFishingGiftContributions/);
  assert.match(src, /async function upsertFishingGiftContribution/);
  assert.match(src, /function subscribeFishingGiftContributions/);
  assert.match(src, /fishing_gift_contributions/);
});

test("fishing aquariums use auth-owned rows instead of rewriting the shared tank board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listAquariumTankContributions/);
  assert.match(src, /async function upsertAquariumTankContribution/);
  assert.match(src, /function subscribeAquariumTankContributions/);
  assert.match(src, /aquarium_tank_contributions/);
});
