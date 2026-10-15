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
