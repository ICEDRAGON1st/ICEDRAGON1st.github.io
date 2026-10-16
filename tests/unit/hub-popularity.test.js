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
  assert.match(plays, /persistPlayLogContribution/);
  assert.match(plays, /fetchPlaysTableRemote/);
  assert.match(plays, /skipShared: !fetched/);
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

test("play log contributions flatten owned rows without copying another player's events", () => {
  const fromRows = popularity.rowsToPlayLogs(
    [
      {
        player_id: "p-ada",
        plays: [
          { id: "mine-1", playerId: "p-ada", name: "Ada", game: "snake", gameName: "Snake", at: 20 },
          { id: "stolen", playerId: "p-bea", name: "Bea", game: "fishing", at: 21 }
        ]
      },
      {
        player_id: "p-bea",
        plays: [
          { id: "theirs", playerId: "p-bea", name: "Bea", game: "fishing", gameName: "Fishing Idle", at: 9 }
        ]
      },
      { player_id: "", plays: [{ id: "skip", playerId: "p-ada", game: "hub", at: 1 }] }
    ],
    10
  );
  assert.equal(fromRows.plays.length, 2);
  assert.ok(fromRows.plays.some((play) => play.id === "mine-1" && play.playerId === "p-ada"));
  assert.ok(fromRows.plays.some((play) => play.id === "theirs" && play.playerId === "p-bea"));
  assert.equal(
    fromRows.plays.some((play) => play.id === "stolen"),
    false
  );

  const livePop = popularity.applyPopularityChange(
    { games: { fishing: 100, snake: 7 } },
    {
      type: "UPDATE",
      new: { player_id: "p-bea", games: { snake: 8 } }
    },
    [
      { player_id: "p-ada", games: { snake: 2, fishing: 1 } },
      { player_id: "p-bea", games: { snake: 5 } }
    ]
  );
  assert.equal(livePop.games.fishing, 100);
  assert.equal(livePop.games.snake, 10);
  assert.equal(livePop.rows.length, 2);

  const afterPopDelete = popularity.applyPopularityChange(
    livePop,
    { type: "DELETE", old_record: { player_id: "p-bea" } },
    livePop.rows
  );
  assert.equal(afterPopDelete.games.snake, 10);
  assert.equal(afterPopDelete.rows.length, 2);

  const livePlays = popularity.applyPlayLogChange(
    {
      plays: [
        { id: "old", playerId: "p-ada", name: "Ada", game: "snake", gameName: "Snake", at: 5 }
      ],
      counts: { snake: 1 }
    },
    {
      type: "UPDATE",
      new: {
        player_id: "p-cal",
        plays: [
          { id: "fresh", playerId: "p-cal", name: "Cal", game: "mine", gameName: "Mine Depth", at: 30 }
        ]
      }
    },
    [
      {
        player_id: "p-ada",
        plays: [
          { id: "mine-1", playerId: "p-ada", name: "Ada", game: "snake", gameName: "Snake", at: 20 }
        ]
      },
      {
        player_id: "p-bea",
        plays: [
          { id: "theirs", playerId: "p-bea", name: "Bea", game: "fishing", gameName: "Fishing Idle", at: 9 }
        ]
      }
    ]
  );
  assert.ok(livePlays.plays.some((play) => play.id === "fresh" && play.playerId === "p-cal"));
  assert.ok(livePlays.plays.some((play) => play.id === "mine-1"));
  assert.ok(livePlays.plays.some((play) => play.id === "theirs"));
  assert.ok(livePlays.plays.some((play) => play.id === "old"));
  assert.equal(livePlays.rows.length, 3);

  const afterPlayDelete = popularity.applyPlayLogChange(
    livePlays,
    { type: "DELETE", old_record: { player_id: "p-cal" } },
    livePlays.rows
  );
  assert.ok(afterPlayDelete.plays.some((play) => play.id === "fresh"));
  assert.equal(afterPlayDelete.rows.length, 3);
});

test("popularity live rows subscribe without rewriting the shared play-count document", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ROOT = path.resolve(__dirname, "../..");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160031_popularity_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(plays, /ensurePopularityRealtime/);
  assert.match(plays, /applyPopularityRealtime/);
  assert.match(plays, /subscribePopularityContributions/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("function applyPopularityRealtime"),
      plays.indexOf("function stopPopularityRealtime")
    ),
    /pushDoc/
  );
  assert.match(supabase, /function subscribePopularityContributions/);
  assert.match(sql, /alter table public\.popularity_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.popularity_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("play log live rows subscribe without rewriting the shared plays document", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ROOT = path.resolve(__dirname, "../..");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160032_play_log_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(plays, /ensurePlayLogRealtime/);
  assert.match(plays, /applyPlayLogRealtime/);
  assert.match(plays, /subscribePlayLogContributions/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("function applyPlayLogRealtime"),
      plays.indexOf("function stopPlayLogRealtime")
    ),
    /pushPlaysRemote|pushDoc/
  );
  assert.match(supabase, /function subscribePlayLogContributions/);
  assert.match(sql, /alter table public\.play_log_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.play_log_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});
