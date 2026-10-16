"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const pbs = require(path.join(ROOT, "hub-leaderboard-pbs.js"));

test("personal bests live in a helper used by the shared board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-leaderboard.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubLeaderboardPbs/);
  assert.match(ui, /persistMyPbs/);
  assert.match(ui, /pullMyPbs/);
  assert.match(ui, /persistLeaderboardPbContribution/);
  assert.match(ui, /fetchLeaderboardTableRemote/);
  assert.match(ui, /skipShared: !fetched/);
  assert.match(plays, /hub-leaderboard-pbs\.js/);
  assert.match(index, /hub-leaderboard-pbs\.js/);
  assert.equal(pbs.SAVE_KEY, "lb-pbs");
});

test("personal-best merge keeps the better score and restores a missing row", () => {
  assert.equal(pbs.isBetter(12, 10, false), true);
  assert.equal(pbs.isBetter(8, 10, true), true);
  assert.equal(pbs.isBetter(10, 10, false), false);

  const mine = pbs.collectMine(
    {
      snake: {
        you: { name: "You", score: 40, at: 20, playerId: "p-local" },
        them: { name: "Them", score: 90, at: 10, playerId: "p-other" }
      }
    },
    (entry) => entry.playerId === "p-local"
  );
  assert.equal(mine.games.snake.score, 40);
  assert.equal(mine.games.snake.playerId, "p-local");

  const restored = pbs.applyPersonalBests(
    { snake: { them: { name: "Them", score: 90, at: 10, playerId: "p-other" } } },
    mine,
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(restored.snake.you.score, 40);
  assert.equal(restored.snake.them.score, 90);

  const richer = pbs.applyPersonalBests(
    { snake: { you: { name: "You", score: 12, at: 1, playerId: "p-local" } } },
    mine,
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(richer.snake.you.score, 40);

  const overlaid = pbs.overlayLeaderboardGames(
    { games: { snake: { them: { name: "Them", score: 90, at: 10, playerId: "p-other" } } } },
    [
      {
        player_id: "p-local",
        games: { snake: { name: "You", score: 40, at: 20, playerId: "p-local" } }
      },
      {
        player_id: "p-other",
        games: { snake: { name: "Them", score: 120, at: 30, playerId: "p-other" } }
      },
      { player_id: "", games: { snake: { name: "Skip", score: 999, at: 40, playerId: "p-skip" } } }
    ],
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(overlaid.games.snake.you.score, 40);
  assert.equal(overlaid.games.snake.them.score, 120);
  assert.equal(overlaid.games.snake.skip, undefined);
});
