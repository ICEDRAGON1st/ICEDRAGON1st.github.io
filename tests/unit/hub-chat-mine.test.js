"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-chat-mine.js"));

test("owned chat lives in a helper used by the shared friend-chat board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-chat.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubChatMine/);
  assert.match(ui, /persistMyChat/);
  assert.match(ui, /pullMyChat/);
  assert.match(ui, /persistChatThreadContribution/);
  assert.match(ui, /fetchChatTableRemote/);
  assert.match(ui, /skipShared: !fetched/);
  assert.match(plays, /hub-chat-mine\.js/);
  assert.match(index, /hub-chat-mine\.js/);
  assert.equal(mine.SAVE_KEY, "chat-mine");
});

test("owned chat restores missing DMs and groups but never global", () => {
  const snapshot = mine.collectMine(
    {
      threads: {
        global: {
          type: "global",
          messages: [{ id: "g1", from: "p-me", name: "Ada", text: "hi all", at: 1 }]
        },
        "p-me:p-pal": {
          messages: [{ id: "d1", from: "p-me", name: "Ada", text: "hey", at: 2 }]
        },
        "group:crew": {
          type: "group",
          name: "Crew",
          members: { "p-me": "Ada", "p-pal": "Pal" },
          createdBy: "p-me",
          createdAt: 3,
          messages: [{ id: "m1", from: "p-pal", name: "Pal", text: "yo", at: 4 }]
        },
        "p-other:p-stranger": {
          messages: [{ id: "x1", from: "p-other", name: "Other", text: "secret", at: 5 }]
        }
      }
    },
    "p-me"
  );

  assert.equal(snapshot.playerId, "p-me");
  assert.equal(snapshot.threads.global, undefined);
  assert.equal(snapshot.threads["p-other:p-stranger"], undefined);
  assert.equal(snapshot.threads["p-me:p-pal"].messages[0].text, "hey");
  assert.equal(snapshot.threads["group:crew"].name, "Crew");

  const restored = mine.applyMine({ threads: {} }, snapshot, "p-me");
  assert.equal(restored.threads["p-me:p-pal"].messages[0].id, "d1");
  assert.equal(restored.threads["group:crew"].members["p-me"], "Ada");
  assert.equal(restored.threads.global, undefined);

  const live = mine.applyMine(
    {
      threads: {
        "p-me:p-pal": {
          messages: [{ id: "live", from: "p-pal", name: "Pal", text: "later", at: 9 }]
        }
      }
    },
    snapshot,
    "p-me"
  );
  assert.equal(live.threads["p-me:p-pal"].messages[0].id, "live");
  assert.equal(live.threads["group:crew"].messages[0].text, "yo");

  const tableMine = mine.collectTableMine(
    {
      threads: {
        global: {
          type: "global",
          messages: [{ id: "g1", from: "p-me", name: "Ada", text: "hi all", at: 1 }]
        },
        "p-me:p-pal": {
          messages: [{ id: "d1", from: "p-me", name: "Ada", text: "hey", at: 2 }]
        },
        "p-other:p-stranger": {
          messages: [{ id: "x1", from: "p-other", name: "Other", text: "secret", at: 5 }]
        }
      }
    },
    "p-me"
  );
  assert.equal(tableMine.threads.global.messages[0].id, "g1");
  assert.equal(tableMine.threads["p-me:p-pal"].messages[0].id, "d1");
  assert.equal(tableMine.threads["p-other:p-stranger"], undefined);

  const overlaid = mine.overlayChatData(
    {
      threads: {
        global: {
          type: "global",
          messages: [{ id: "g0", from: "p-pal", name: "Pal", text: "earlier", at: 10 }]
        }
      }
    },
    [
      {
        player_id: "p-me",
        threads: {
          global: {
            type: "global",
            messages: [{ id: "g1", from: "p-me", name: "Ada", text: "hi all", at: 11 }]
          },
          "p-me:p-pal": {
            messages: [{ id: "d1", from: "p-me", name: "Ada", text: "hey", at: 2 }]
          }
        }
      },
      {
        player_id: "p-pal",
        threads: {
          "p-me:p-pal": {
            messages: [{ id: "d2", from: "p-pal", name: "Pal", text: "yo", at: 3 }]
          }
        }
      },
      { player_id: "", threads: { "p-skip:p-x": { messages: [{ id: "s", from: "p-skip", text: "no", at: 9 }] } } }
    ]
  );
  assert.equal(overlaid.threads.global.messages.map((m) => m.id).join(","), "g0,g1");
  assert.equal(overlaid.threads["p-me:p-pal"].messages.map((m) => m.id).join(","), "d1,d2");
  assert.equal(overlaid.threads["p-skip:p-x"], undefined);
});
