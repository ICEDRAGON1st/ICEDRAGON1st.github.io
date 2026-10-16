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
  assert.equal(supabase.shouldWriteMantleBackup(false), true);
  assert.match(src, /if \(wrote\) return/);
  assert.match(src, /shouldWriteMantleBackup\(wrote\)/);
});

test("shared docs skip the old backup read when the account server errors", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.equal(supabase.shouldReadMantleBackup(true), false);
  assert.equal(supabase.shouldReadMantleBackup(false), true);
  assert.match(src, /shouldReadMantleBackup\(false\)/);
  assert.match(src, /console\.warn\("\[HubSupabase\] getPrefer", docId, err\);\s*throw err;/);
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
  assert.match(src, /presence_pings/);
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
  assert.match(src, /call_signal_contributions/);
});

test("friend edges use auth-owned rows instead of rewriting the shared friends board", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.join(__dirname, "../../hub-supabase.js"), "utf8");
  assert.match(src, /async function listFriendEdgeContributions/);
  assert.match(src, /async function upsertFriendEdgeContribution/);
  assert.match(src, /friend_edge_contributions/);
});
