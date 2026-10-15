"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const helpInfo = require(path.join(ROOT, "hub-help-info.js"));

test("GAME_INFO parse lives in the helper, not the chat UI blob", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-help.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");

  assert.match(ui, /window\.HubHelpInfo/);
  assert.match(ui, /helpInfo\.parse/);
  assert.match(ui, /helpInfo\.field/);
  assert.doesNotMatch(ui, /\/\^\s\*game\\s\*name\\s\*:\/i/);
  assert.match(plays, /hub-help-info\.js/);
  assert.match(plays, /hub-games\.js/);
  assert.match(ui, /window\.HubGames/);
});

test("GAME_INFO.txt fills owner, lists, and per-game rows", () => {
  const raw = fs.readFileSync(path.join(ROOT, "GAME_INFO.txt"), "utf8");
  const info = helpInfo.parse(raw);

  assert.equal(helpInfo.field(info, "gameName"), "My Games");
  assert.equal(helpInfo.field(info, "owner"), "ICE_DRAGON");
  assert.match(helpInfo.field(info, "platform"), /GitHub Pages/i);
  assert.equal(helpInfo.field(info, "gameCount"), "32");
  assert.match(helpInfo.field(info, "gamesList"), /Guessword/);
  assert.match(helpInfo.field(info, "objective"), /browser minigames/i);
  assert.match(helpInfo.field(info, "rules"), /Be fair/i);
  assert.match(helpInfo.field(info, "supportLinks"), /discord\.gg/i);
  assert.ok(info.gamesDetail.length >= 32);

  const wordle = info.gamesDetail.find((game) => game.id === "wordle");
  assert.ok(wordle);
  assert.equal(wordle.title, "Guessword");
  assert.match(wordle.body, /Daily/);

  assert.equal(helpInfo.field(info, "missing"), "");
  assert.equal(helpInfo.isPlaceholder("[Insert peak concurrent]"), true);
  assert.equal(helpInfo.isPlaceholder("ICE_DRAGON"), false);

  const empty = helpInfo.parse("");
  assert.equal(empty.owner, "");
  assert.deepEqual(empty.gamesDetail, []);
  assert.equal(helpInfo.field({ owner: "[Insert owner]" }, "owner"), "");
});
