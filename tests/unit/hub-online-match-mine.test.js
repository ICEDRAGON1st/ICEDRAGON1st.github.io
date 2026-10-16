"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-online-match-mine.js"));

test("owned match rooms live in a helper used by the shared room board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-online-match.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const ttt = fs.readFileSync(path.join(ROOT, "tic-tac-toe/index.html"), "utf8");
  const c4 = fs.readFileSync(path.join(ROOT, "connect-four/index.html"), "utf8");
  assert.match(ui, /window\.HubOnlineMatchMine/);
  assert.match(ui, /persistMyRooms/);
  assert.match(ui, /pullMyRooms/);
  assert.match(ui, /persistMatchRoomContribution/);
  assert.match(ui, /fetchMatchTableRemote/);
  assert.match(ui, /skipShared: !fetched/);
  assert.match(index, /hub-online-match-mine\.js/);
  assert.match(ttt, /hub-online-match-mine\.js/);
  assert.match(c4, /hub-online-match-mine\.js/);
  assert.equal(mine.SAVE_KEY, "match-mine");
});

test("owned match rooms restore only when I have no live rooms", () => {
  const now = Date.now();
  const mineRoom = {
    id: "room-1",
    game: "tictactoe",
    code: "ABCD",
    queue: "private",
    status: "playing",
    state: { board: [1, 0, 0, 0, 2, 0, 0, 0, 0], winLine: null },
    turn: 2,
    host: { playerId: "p-me", name: "Ada" },
    guest: { playerId: "p-pal", name: "Pal" },
    result: null,
    createdAt: now - 1000,
    updatedAt: now
  };
  const other = {
    ...mineRoom,
    id: "room-2",
    host: { playerId: "p-other", name: "Other" },
    guest: { playerId: "p-stranger", name: "Stranger" }
  };

  const snapshot = mine.collectMine({ rooms: { "room-1": mineRoom, "room-2": other } }, "p-me");
  assert.equal(snapshot.playerId, "p-me");
  assert.ok(snapshot.rooms["room-1"]);
  assert.equal(snapshot.rooms["room-2"], undefined);
  assert.deepEqual(snapshot.rooms["room-1"].state.board.slice(0, 2), [1, 0]);

  const restored = mine.applyMine({ rooms: {} }, snapshot, "p-me");
  assert.equal(restored.rooms["room-1"].guest.playerId, "p-pal");

  const live = mine.applyMine(
    {
      rooms: {
        "room-live": {
          ...mineRoom,
          id: "room-live",
          state: { board: Array(9).fill(0), winLine: null }
        }
      }
    },
    snapshot,
    "p-me"
  );
  assert.equal(live.rooms["room-1"], undefined);
  assert.equal(live.rooms["room-live"].id, "room-live");

  const newer = { ...mineRoom, updatedAt: now + 50, turn: 1 };
  const overlaid = mine.overlayMatchRooms(
    { rooms: { "room-1": mineRoom } },
    [
      { player_id: "p-pal", rooms: { "room-1": newer } },
      {
        player_id: "p-other",
        rooms: {
          "room-2": other
        }
      },
      { player_id: "", rooms: { "room-skip": { ...mineRoom, id: "room-skip" } } }
    ]
  );
  assert.equal(overlaid.rooms["room-1"].turn, 1);
  assert.equal(overlaid.rooms["room-2"].host.playerId, "p-other");
  assert.equal(overlaid.rooms["room-skip"], undefined);
});
