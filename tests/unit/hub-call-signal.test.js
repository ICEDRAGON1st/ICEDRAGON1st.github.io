"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const signal = require(path.join(ROOT, "hub-call-signal.js"));

test("call signaling lives in a helper, not the call UI blob", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-calls.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  assert.match(ui, /window\.HubCallSignal/);
  assert.match(ui, /signal\.mergePeer/);
  assert.match(ui, /signal\.pruneRooms/);
  assert.doesNotMatch(ui, /function mergePeer\(a, b\) \{\s*if \(!a\) return b/);
  assert.match(plays, /hub-call-signal\.js/);
});

test("DM rooms, hang-up merges, and stale rooms stay deterministic", () => {
  assert.equal(signal.roomKey("dm", "p-b", "p-a"), "dm:p-a:p-b");
  assert.equal(signal.roomKey("dm", "p-a", "p-b"), "dm:p-a:p-b");
  assert.equal(signal.roomKey("group", "g1", "p-a"), "group:g1");
  assert.equal(signal.linkKey("p-b", "p-a"), "p-a:p-b");
  assert.equal(signal.peerJoined({ joinedAt: 10, left: false }), true);
  assert.equal(signal.peerJoined({ joinedAt: 10, left: true }), false);

  const left = signal.mergePeer(
    { joinedAt: 100, left: false, name: "A" },
    { joinedAt: 80, left: true, leftAt: 120, name: "A" }
  );
  assert.equal(left.left, true);
  assert.equal(left.ringing, false);

  const live = signal.mergePeer(
    { joinedAt: 50, left: true, leftAt: 60, name: "B" },
    { joinedAt: 90, left: false, name: "Bee" }
  );
  assert.equal(live.left, false);
  assert.equal(live.name, "Bee");

  const link = signal.mergeLink(
    { offerFrom: "p-a", offer: "o1", offerAt: 10 },
    { offerFrom: "p-a", offer: "o1", offerAt: 10, answer: "a1", answerAt: 12, answerFor: 10 }
  );
  assert.equal(link.offer, "o1");
  assert.equal(link.answer, "a1");
  assert.equal(link.offerAt, 10);

  const now = 200_000;
  const kept = signal.pruneRooms(
    {
      fresh: { updatedAt: now - 1000, peers: { "p-a": { joinedAt: now, left: false } }, signals: [], links: {} },
      stale: { updatedAt: now - signal.ROOM_TTL_MS - 10, peers: { "p-a": { joinedAt: 1, left: false } } }
    },
    now
  );
  assert.ok(kept.fresh);
  assert.equal(kept.stale, undefined);
});
