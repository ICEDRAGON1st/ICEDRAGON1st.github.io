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
