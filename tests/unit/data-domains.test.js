"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

const REMAINING_MANTLE_DOMAINS = {
  "hub-plays.js": [
    "plays-log",
    "name-registry",
    "player-codes",
    "player-passwords",
    "name-reservations",
    "presence",
    "players-alltime",
    "hub-game-popularity"
  ],
  "hub-leaderboard.js": ["leaderboards"],
  "hub-chat.js": ["friend-chat"],
  "hub-calls.js": ["hub-calls"],
  "hub-friends.js": ["friends", "name-registry"],
  "hub-feedback.js": ["player-feedback"],
  "hub-online-match.js": ["online-matches"],
  "hub-fishing-gifts.js": ["fishing-gifts"],
  "hub-fishing-mail.js": ["fishing-player-mail"],
  "fishing/script.js": [
    "fishing-admin-events",
    "fishing-admin-announce",
    "fishing-gifts",
    "fishing-player-mail",
    "fishing-aquariums",
    "fishing-community",
    "name-registry"
  ]
};

function collectMantlePaths(text) {
  const fromUrls = [
    ...text.matchAll(/mantledb\.sh\/v2\/(?:[^/"'`\s]+|\$\{NS\})\/([A-Za-z0-9-]+)/g)
  ].map((match) => match[1]);
  const fromConsts = [...text.matchAll(/const [A-Z_]*PATH = "([A-Za-z0-9-]+)"/g)].map(
    (match) => match[1]
  );
  return [...fromUrls, ...fromConsts];
}

test("remaining Mantle domains stay on the known retirement list", () => {
  const seen = new Set();
  for (const [relative, expected] of Object.entries(REMAINING_MANTLE_DOMAINS)) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    const paths = [...new Set(collectMantlePaths(text))].sort();
    assert.deepEqual(paths, [...expected].sort(), `${relative} changed Mantle domains`);
    paths.forEach((name) => seen.add(name));
  }

  assert.equal(seen.has("player-passwords"), true);
  assert.equal(
    fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8").includes("player-passwords"),
    true
  );
});

test("locked migrations keep admin hub_docs writes off the anon role", () => {
  const locked = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610150002_hub_docs_locked.sql"),
    "utf8"
  );
  for (const id of [
    "fishing-admin-events",
    "fishing-admin-audit",
    "hub-admin-announce",
    "hub-admin-maintenance",
    "hub-admin-moderation",
    "hub-admin-grants",
    "hub-discord-site-updates"
  ]) {
    assert.match(locked, new RegExp(id.replaceAll("-", "\\-")));
  }
  assert.match(locked, /authenticated/i);
  assert.doesNotMatch(locked, /to anon/i);
});
