"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const edges = require(path.join(ROOT, "hub-friends-edges.js"));

test("friend edges live in a helper used by the shared friends board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-friends.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubFriendsEdges/);
  assert.match(ui, /persistMyEdges/);
  assert.match(ui, /pullMyEdges/);
  assert.match(ui, /persistFriendEdgeContribution/);
  assert.match(ui, /fetchFriendsTableRemote/);
  assert.match(ui, /skipShared: !fetched/);
  assert.match(plays, /hub-friends-edges\.js/);
  assert.match(index, /hub-friends-edges\.js/);
  assert.equal(edges.SAVE_KEY, "friends-edges");
});

test("owned friend edges restore only when the shared profile is empty", () => {
  const mine = edges.collectMine(
    {
      profiles: {
        "p-me": {
          name: "Ada",
          friends: { "p-pal": { name: "Pal", since: 10 } },
          outgoing: { "p-wait": { name: "Wait", at: 20 } },
          incoming: {}
        },
        "p-other": {
          name: "Other",
          friends: { "p-me": { name: "Ada", since: 10 } }
        }
      },
      invites: {
        "inv-1": {
          id: "inv-1",
          fromId: "p-me",
          fromName: "Ada",
          toId: "p-pal",
          toName: "Pal",
          game: "snake",
          roomId: "room-1",
          status: "pending",
          at: 30
        },
        "inv-2": {
          id: "inv-2",
          fromId: "p-other",
          fromName: "Other",
          toId: "p-stranger",
          toName: "Stranger",
          game: "quiz",
          roomId: "room-2",
          status: "pending",
          at: 31
        }
      }
    },
    "p-me"
  );

  assert.equal(mine.playerId, "p-me");
  assert.equal(mine.friends["p-pal"].name, "Pal");
  assert.equal(mine.outgoing["p-wait"].name, "Wait");
  assert.ok(mine.invites["inv-1"]);
  assert.equal(mine.invites["inv-2"], undefined);

  const restored = edges.applyMine({ profiles: {}, invites: {} }, mine, "p-me");
  assert.equal(restored.profiles["p-me"].friends["p-pal"].name, "Pal");
  assert.equal(restored.invites["inv-1"].game, "snake");

  const live = edges.applyMine(
    {
      profiles: {
        "p-me": {
          name: "Ada",
          friends: {},
          outgoing: {},
          incoming: { "p-new": { name: "New", at: 99 } }
        }
      },
      invites: {}
    },
    mine,
    "p-me"
  );
  assert.equal(live.profiles["p-me"].friends["p-pal"], undefined);
  assert.equal(live.profiles["p-me"].incoming["p-new"].name, "New");
  assert.equal(live.invites["inv-1"].id, "inv-1");

  const overlaid = edges.overlayFriendsData(
    {
      profiles: {
        "p-other": { name: "Other", friends: { "p-me": { name: "Ada" } }, outgoing: {}, incoming: {} }
      },
      invites: {}
    },
    [
      {
        player_id: "p-me",
        display_name: "Ada",
        friends: { "p-pal": { name: "Pal", since: 10 } },
        outgoing: {},
        incoming: {},
        invites: {
          "inv-1": {
            id: "inv-1",
            fromId: "p-me",
            toId: "p-pal",
            fromName: "Ada",
            toName: "Pal",
            game: "snake",
            at: 30
          }
        }
      },
      { player_id: "", friends: { "p-skip": { name: "Skip" } } }
    ]
  );
  assert.equal(overlaid.profiles["p-me"].friends["p-pal"].name, "Pal");
  assert.equal(overlaid.profiles["p-other"].friends["p-me"].name, "Ada");
  assert.equal(overlaid.invites["inv-1"].game, "snake");
  assert.equal(overlaid.profiles["p-skip"], undefined);
});
