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
