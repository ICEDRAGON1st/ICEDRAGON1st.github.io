"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const popularity = require(path.resolve(__dirname, "../../hub-popularity.js"));

test("hub popularity merges pending counts and recent play logs", () => {
  assert.deepEqual(popularity.parsePopularityPayload(null), { games: {}, resetAt: 0 });
  assert.deepEqual(popularity.parsePopularityPayload({ fishing: 9, resetAt: 12, note: "x" }), {
    games: { fishing: 9 },
    resetAt: 12
  });
  assert.deepEqual(popularity.parsePopularityPayload({ games: { snake: 3 }, resetAt: 4 }), {
    games: { snake: 3 },
    resetAt: 4
  });

  assert.deepEqual(popularity.combinePopularity({ snake: 2 }, { snake: 1, fishing: 5 }), {
    snake: 3,
    fishing: 5
  });
  assert.deepEqual(
    popularity.mergePopularityRemote({ fishing: 10 }, { snake: 2 }, { fishing: 1, mine: 4 }),
    { fishing: 10, snake: 2, mine: 4 }
  );
  assert.equal(popularity.mostPopularGameId({ fishing: 10, snake: 2 }), "fishing");
  assert.equal(popularity.mostPopularGameId({ fishing: 10, snake: 2 }, ["snake"]), "snake");
  assert.equal(popularity.mostPopularGameId({}), "");

  const merged = popularity.mergePlayLogs(
    {
      plays: [
        { id: "a", at: 1 },
        { id: "b", at: 3 }
      ],
      counts: { snake: 1 }
    },
    {
      plays: [
        { id: "b", at: 4 },
        { id: "c", at: 2 }
      ],
      counts: { snake: 4, fishing: 1 }
    },
    2
  );
  assert.deepEqual(
    merged.plays.map((play) => play.id),
    ["b", "c"]
  );
  assert.equal(merged.counts.snake, 4);
  assert.equal(merged.counts.fishing, 1);
});

test("owned play logs dual-write without copying other players or shrinking a richer local list", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.resolve(__dirname, "../../hub-plays.js"), "utf8");
  assert.match(plays, /persistPlaysMine/);
  assert.match(plays, /pullPlaysMine/);
  assert.equal(popularity.SAVE_KEY, "plays-mine");

  const snapshot = popularity.collectMine(
    [
      { id: "mine-1", playerId: "p-ada", name: "Ada", game: "snake", gameName: "Snake", at: 20 },
      {
        id: "theirs",
        playerId: "p-bea",
        name: "Bea",
        game: "fishing",
        gameName: "Fishing Idle",
        at: 21
      },
      { id: "mine-1", playerId: "p-ada", name: "Ada", game: "snake", at: 1 }
    ],
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(snapshot.plays.length, 1);
  assert.equal(snapshot.plays[0].id, "mine-1");
  assert.equal(snapshot.plays[0].game, "snake");

  const restored = popularity.applyMine([], snapshot, "p-ada");
  assert.equal(restored[0].id, "mine-1");

  const richer = popularity.applyMine(
    [
      { id: "local", playerId: "p-ada", name: "Ada", game: "hub", gameName: "Hub", at: 9 },
      {
        id: "other",
        playerId: "p-bea",
        name: "Bea",
        game: "fishing",
        gameName: "Fishing Idle",
        at: 8
      }
    ],
    snapshot,
    "p-ada"
  );
  assert.equal(richer.length, 3);
  assert.ok(richer.some((play) => play.id === "local"));
  assert.ok(richer.some((play) => play.id === "mine-1"));
  assert.ok(richer.some((play) => play.id === "other"));

  const blocked = popularity.applyMine(
    [{ id: "keep", playerId: "p-bea", name: "Bea", game: "hub", at: 1 }],
    snapshot,
    "p-bea"
  );
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].id, "keep");
});

test("popularity contributions sum owned rows without copying another player's pending", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.resolve(__dirname, "../../hub-plays.js"), "utf8");
  assert.match(plays, /persistPopularityContribution/);
  assert.match(plays, /fetchPopularityTableRemote/);
  assert.match(plays, /if \(fetched && !tableWrote\)/);
  assert.match(plays, /if \(fetched && \(hasPending \|\| force\)\)/);
  assert.equal(typeof popularity.rowsToCounts, "function");

  assert.deepEqual(popularity.sanitizeContributionGames({ "snake!": 2, snake: 3.9, fishing: -1 }), {
    snake: 3
  });
  const summed = popularity.rowsToCounts([
    { player_id: "p-ada", games: { snake: 2, fishing: 1 } },
    { player_id: "p-bea", games: { snake: 5, mine: 4 } },
    { player_id: "p-skip", games: { "bad id": 9 } }
  ]);
  assert.equal(summed.snake, 7);
  assert.equal(summed.fishing, 1);
  assert.equal(summed.mine, 4);
  assert.equal(summed["bad id"], undefined);
  assert.deepEqual(popularity.readOwnContribution(summed, "p-ada"), {});
  assert.deepEqual(
    popularity.readOwnContribution(
      [
        { player_id: "p-ada", games: { snake: 2 } },
        { player_id: "p-bea", games: { snake: 9 } }
      ],
      "p-ada"
    ),
    { snake: 2 }
  );
  assert.deepEqual(popularity.addContributionGames({ snake: 2 }, { snake: 1, fishing: 4 }), {
    snake: 3,
    fishing: 4
  });
});
