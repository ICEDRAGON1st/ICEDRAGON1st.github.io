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
