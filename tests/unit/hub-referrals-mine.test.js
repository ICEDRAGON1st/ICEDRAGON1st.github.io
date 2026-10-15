"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-referrals-mine.js"));

test("owned invite status lives in a helper used by referrals", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-referrals.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubReferralsMine/);
  assert.match(ui, /persistMine/);
  assert.match(ui, /pullMine/);
  assert.match(index, /hub-referrals-mine\.js/);
  assert.equal(mine.SAVE_KEY, "invite-mine");
});

test("invite status merges the higher count and keeps credited/unlocked", () => {
  const snapshot = mine.collectMine({ count: 3, unlocked: true, credited: true }, "p-me");
  assert.equal(snapshot.playerId, "p-me");
  assert.equal(snapshot.count, 3);
  assert.equal(snapshot.unlocked, true);
  assert.equal(snapshot.credited, true);

  const restored = mine.applyMine({ count: 0, unlocked: false, credited: false }, snapshot);
  assert.equal(restored.count, 3);
  assert.equal(restored.unlocked, true);
  assert.equal(restored.credited, true);

  const richer = mine.applyMine({ count: 4, unlocked: false, credited: false }, snapshot);
  assert.equal(richer.count, 4);
  assert.equal(richer.unlocked, true);
  assert.equal(richer.credited, true);

  const keepLocalCredit = mine.applyMine(
    { count: 1, unlocked: false, credited: true },
    { count: 0, unlocked: false, credited: false }
  );
  assert.equal(keepLocalCredit.count, 1);
  assert.equal(keepLocalCredit.credited, true);
  assert.equal(keepLocalCredit.unlocked, false);
});
