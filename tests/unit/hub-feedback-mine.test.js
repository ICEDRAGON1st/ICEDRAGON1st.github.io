"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-feedback-mine.js"));

test("owned feedback lives in a helper used by the Feedback panel", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-feedback.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubFeedbackMine/);
  assert.match(ui, /persistMine/);
  assert.match(ui, /pullMine/);
  assert.match(index, /hub-feedback-mine\.js/);
  assert.equal(mine.SAVE_KEY, "feedback-mine");
});

test("owned feedback keeps only this player's tickets and never shrinks a richer local list", () => {
  const snapshot = mine.collectMine(
    [
      {
        id: "f1",
        fromId: "p-me",
        fromName: "Ada",
        type: "bug",
        game: "Snake",
        text: "Walls eat the tail",
        at: 20
      },
      {
        id: "f2",
        fromId: "p-other",
        fromName: "Bea",
        type: "idea",
        game: "Hub",
        text: "Should not copy other players",
        at: 21
      },
      { id: "f1", fromId: "p-me", fromName: "Ada", type: "bug", text: "dup", at: 1 }
    ],
    ["f1", "missing"],
    "p-me"
  );
  assert.equal(snapshot.playerId, "p-me");
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].id, "f1");
  assert.equal(snapshot.items[0].text, "Walls eat the tail");
  assert.deepEqual(snapshot.pendingIds, ["f1", "missing"]);

  const restored = mine.applyMine([], [], snapshot);
  assert.equal(restored.items[0].id, "f1");
  assert.ok(restored.pendingIds.includes("f1"));

  const richer = mine.applyMine(
    [
      {
        id: "local",
        fromId: "p-me",
        fromName: "Ada",
        type: "idea",
        game: "Hub",
        text: "Keep my local note",
        at: 9
      }
    ],
    ["local"],
    snapshot
  );
  assert.equal(richer.items.length, 2);
  assert.ok(richer.items.some((item) => item.id === "local"));
  assert.ok(richer.items.some((item) => item.id === "f1"));
  assert.ok(richer.pendingIds.includes("local"));
  assert.ok(richer.pendingIds.includes("f1"));
});
