"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const games = require(path.join(ROOT, "hub-games.js"));

test("hub navigation and Help read the shared game catalog", () => {
  const script = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
  const help = fs.readFileSync(path.join(ROOT, "hub-help.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");

  assert.match(script, /window\.HubGames\.list/);
  assert.match(script, /window\.HubGames\.leaderboardTabs/);
  assert.doesNotMatch(script, /const HUB_GAMES = \[/);
  assert.match(help, /window\.HubGames/);
  assert.match(help, /function gameCatalog\(/);
  assert.doesNotMatch(help, /id: "wordle", title: "Guessword"/);
  assert.match(index, /"hub-games\.js"/);
  assert.match(plays, /hub-games\.js/);
});

test("catalog includes every hub card and the newest three games", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const cards = [...index.matchAll(/data-game="([^"]+)"/g)].map((match) => match[1]);
  const uniqueCards = [...new Set(cards)].filter((id) => id !== "wordle" || true);

  assert.deepEqual(games.ids().slice().sort(), [...new Set(cards)].sort());
  assert.equal(games.ids().length, 32);
  assert.ok(games.byId("stickers"));
  assert.ok(games.byId("waves"));
  assert.ok(games.byId("cup"));
  assert.equal(games.byId("flappy").path, "wing-hop/index.html");
  assert.equal(games.idFromPath("/paper-io/"), "paper");
  assert.equal(games.idFromPath("/wing-hop/"), "flappy");
  assert.equal(games.idFromPath("/ramp-rush/run.html"), "ramp");
  assert.equal(games.idFromPath("/"), "");

  const tabs = games.leaderboardTabs();
  assert.equal(tabs[0].id, "hub-points");
  assert.ok(tabs.some((tab) => tab.id === "mine-ore"));
  assert.ok(tabs.some((tab) => tab.id === "cup"));
  assert.equal(uniqueCards.length, 32);
});
