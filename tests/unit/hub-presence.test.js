"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

require(path.resolve(__dirname, "../../hub-identity.js"));
const presence = require(path.resolve(__dirname, "../../hub-presence.js"));

test("hub presence merges newer pings and drops stale guests", () => {
  const now = 1_700_000_000_000;
  const merged = presence.mergePresence(
    { "p-old": { at: now - 1000, name: "Ada" } },
    {
      "p-old": { at: now, name: "Ada" },
      "p-new": { at: now - 10, name: "Bea" }
    }
  );
  assert.equal(merged["p-old"].at, now);
  assert.equal(merged["p-new"].name, "Bea");

  const pruned = presence.prunePresence(
    {
      "p-live": { at: now - 1000, name: "Ada" },
      "p-stale": { at: now - presence.PRESENCE_KEEP_MS - 1, name: "Old" }
    },
    now
  );
  assert.ok(pruned["p-live"]);
  assert.equal(pruned["p-stale"], undefined);

  const online = presence.countOnline(
    {
      "p-ada": { at: now - 1000, name: "Ada" },
      "p-guest": { at: now - 1000, name: "Guest" },
      "p-late": { at: now - presence.ONLINE_TTL_MS - 1, name: "Bea" }
    },
    now
  );
  assert.equal(online, 1);
  assert.equal(presence.isPlaceholderName("Guest"), true);
  assert.equal(presence.isPlaceholderName("Ada"), false);
  assert.equal(presence.sanitizePresenceGame("hub"), "hub");
  assert.equal(presence.sanitizePresenceGame("snake", { snake: "Snake" }), "snake");
});

test("presence table rows map to the shared online list without dropping other players", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.resolve(__dirname, "../../hub-plays.js"), "utf8");
  assert.match(plays, /persistPresencePing/);
  assert.match(plays, /fetchPresenceTableRemote/);
  assert.match(plays, /if \(!tableWrote\) await pushPresenceRemote/);
  assert.equal(typeof presence.rowsToMap, "function");

  const mapped = presence.rowsToMap([
    {
      player_id: "p-ada",
      display_name: "Ada",
      game: "snake",
      pinged_at: "2023-11-14T22:13:20.000Z"
    },
    {
      player_id: "p-bea",
      display_name: "Bea",
      game: "hub",
      pinged_at: "2023-11-14T22:13:25.000Z"
    },
    { player_id: "", display_name: "Skip" }
  ]);
  assert.equal(mapped["p-ada"].name, "Ada");
  assert.equal(mapped["p-ada"].game, "snake");
  assert.equal(mapped["p-bea"].name, "Bea");
  assert.equal(Object.keys(mapped).length, 2);
});

test("presence realtime merges a live ping without dropping other players", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.resolve(__dirname, "../../hub-plays.js"), "utf8");
  const supabase = fs.readFileSync(path.resolve(__dirname, "../../hub-supabase.js"), "utf8");
  const hub = fs.readFileSync(path.resolve(__dirname, "../../script.js"), "utf8");
  assert.match(plays, /ensurePresenceRealtime/);
  assert.match(plays, /applyPresenceRealtime/);
  assert.match(plays, /hub-plays-presence/);
  assert.match(plays, /stopPresenceRealtime\(\);/);
  assert.doesNotMatch(
    plays.slice(plays.indexOf("function applyPresenceRealtime"), plays.indexOf("function stopPresenceRealtime")),
    /pushPresenceRemote/
  );
  assert.match(supabase, /function subscribePresencePings/);
  assert.match(supabase, /realtime\/v1\/websocket/);
  assert.match(supabase, /postgres_changes/);
  assert.match(supabase, /presence_pings/);
  assert.match(hub, /hub-plays-presence/);
  assert.equal(typeof presence.applyChange, "function");

  const now = 1_700_000_000_000;
  const merged = presence.applyChange(
    {
      "p-adaxxxx": { at: now - 1000, name: "Ada", game: "hub" },
      "p-guestxxx": { at: now - 500, name: "Bea", game: "snake" }
    },
    {
      type: "UPDATE",
      record: {
        player_id: "p-adaxxxx",
        display_name: "Ada",
        game: "fishing",
        pinged_at: new Date(now).toISOString()
      }
    },
    now
  );
  assert.equal(merged["p-adaxxxx"].game, "fishing");
  assert.equal(merged["p-guestxxx"].name, "Bea");

  const afterDelete = presence.applyChange(
    merged,
    {
      event: "postgres_changes",
      payload: {
        data: {
          type: "DELETE",
          old_record: { player_id: "p-guestxxx" }
        }
      }
    },
    now
  );
  assert.equal(afterDelete["p-guestxxx"], undefined);
  assert.equal(afterDelete["p-adaxxxx"].name, "Ada");

  const skipped = presence.applyChange(
    { "p-keepxxxx": { at: now, name: "Cee", game: "hub" } },
    { type: "DELETE", old_record: { player_id: "" } },
    now
  );
  assert.equal(skipped["p-keepxxxx"].name, "Cee");
});
