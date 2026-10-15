"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-notifications-mine.js"));

test("owned notification inbox lives in a helper used by the local bell", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-notifications.js"), "utf8");
  const chat = fs.readFileSync(path.join(ROOT, "hub-chat.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubNotificationsMine/);
  assert.match(ui, /persistMyNotes/);
  assert.match(ui, /pullMyNotes/);
  assert.match(chat, /hub-notifications-mine\.js/);
  assert.match(index, /hub-notifications-mine\.js/);
  assert.equal(mine.SAVE_KEY, "notify-mine");
});

test("owned inbox restores only when the local list is empty", () => {
  const snapshot = mine.collectMine(
    [
      {
        id: "n1",
        kind: "chat",
        title: "New message",
        body: "Open Friends",
        href: "index.html#friends",
        at: 20
      },
      { id: "n1", kind: "chat", title: "dup", body: "skip", at: 1 }
    ],
    15,
    "p-me"
  );
  assert.equal(snapshot.playerId, "p-me");
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].title, "New message");
  assert.equal(snapshot.seenAt, 15);

  const restored = mine.applyMine([], 0, snapshot);
  assert.equal(restored.items[0].id, "n1");
  assert.equal(restored.seenAt, 15);

  const live = mine.applyMine(
    [{ id: "local", kind: "info", title: "Keep me", body: "", at: 9 }],
    3,
    snapshot
  );
  assert.equal(live.items[0].id, "local");
  assert.equal(live.seenAt, 3);
});
