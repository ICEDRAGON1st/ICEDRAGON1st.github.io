"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const alltime = require(path.join(ROOT, "hub-alltime.js"));

test("all-time roster helpers live outside hub-plays and load before it", () => {
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const boot = fs.readFileSync(path.join(ROOT, "hub-game-boot.js"), "utf8");
  assert.match(plays, /window\.HubAllTime/);
  assert.match(plays, /alltimeApi\.mergeAllTime/);
  assert.match(index, /hub-alltime\.js/);
  assert.match(boot, /hub-alltime\.js/);
  assert.equal(alltime.MAX_ALLTIME, 5000);
});

test("all-time merge keeps earlier firstAt and later lastAt without shrinking", () => {
  const merged = alltime.mergeAllTime(
    { "p-a": { firstAt: 100, lastAt: 200, name: "Ada" } },
    {
      "p-a": { firstAt: 80, lastAt: 250, name: "Ada" },
      "p-b": { firstAt: 90, lastAt: 90, name: "Bea" }
    },
    (a, b) => String(a || b || "Guest")
  );
  assert.equal(merged["p-a"].firstAt, 80);
  assert.equal(merged["p-a"].lastAt, 250);
  assert.equal(merged["p-b"].name, "Bea");

  const remoteLast = alltime.mergeAllTimePreferRemoteLast(
    { "p-a": { firstAt: 100, lastAt: 120, name: "Ada" } },
    { "p-a": { firstAt: 100, lastAt: 999, name: "Ada" } },
    (a, b) => String(a || b || "Guest")
  );
  assert.equal(remoteLast["p-a"].lastAt, 120);

  const clamped = alltime.clampLastAtForWrite(
    {
      "p-me": { firstAt: 10, lastAt: 20, name: "Me" },
      "p-them": { firstAt: 10, lastAt: 20, name: "Them" }
    },
    {
      "p-me": { firstAt: 10, lastAt: 80, name: "Me" },
      "p-them": { firstAt: 10, lastAt: 80, name: "Them" }
    },
    "p-me",
    (a, b) => String(a || b || "Guest")
  );
  assert.equal(clamped["p-me"].lastAt, 80);
  assert.equal(clamped["p-them"].lastAt, 20);

  const seed = alltime.parseMilestoneSeed({
    count: 45,
    games: 32,
    mostPlayed: "Fishing Idle",
    achievements: 100,
    note: "pages"
  });
  assert.equal(seed.games, 32);
  assert.equal(seed.count, 45);

  const repaired = alltime.repairMassStampedLastAt({
    a: { firstAt: 1, lastAt: 50, name: "A" },
    b: { firstAt: 2, lastAt: 50, name: "B" },
    c: { firstAt: 3, lastAt: 50, name: "C" },
    d: { firstAt: 4, lastAt: 50, name: "D" },
    e: { firstAt: 5, lastAt: 50, name: "E" },
    f: { firstAt: 6, lastAt: 9, name: "F" }
  });
  assert.equal(repaired.a.lastAt, 1);
  assert.equal(repaired.f.lastAt, 9);

  assert.equal(
    alltime.allTimeNeedsWrite(
      { "p-me": { firstAt: 10, lastAt: 20, name: "Me" } },
      { "p-me": { firstAt: 10, lastAt: 20 + alltime.LAST_AT_WRITE_GAP_MS, name: "Me" } },
      "p-me"
    ),
    true
  );
  assert.equal(
    alltime.allTimeNeedsWrite(
      { "p-me": { firstAt: 10, lastAt: 20, name: "Me" } },
      { "p-me": { firstAt: 10, lastAt: 21, name: "Me" } },
      "p-me"
    ),
    false
  );
});

test("owned all-time row dual-writes without copying others or shrinking the roster", () => {
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  assert.match(plays, /persistAllTimeMine/);
  assert.match(plays, /pullAllTimeMine/);
  assert.equal(alltime.SAVE_KEY, "alltime-mine");

  const snapshot = alltime.collectMine(
    {
      "p-ada": { firstAt: 80, lastAt: 250, name: "Ada" },
      "p-bea": { firstAt: 90, lastAt: 90, name: "Bea" }
    },
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(snapshot.row.firstAt, 80);
  assert.equal(snapshot.row.lastAt, 250);
  assert.equal(snapshot.row.name, "Ada");
  assert.equal(snapshot.players, undefined);

  const restored = alltime.applyMine({}, snapshot, "p-ada");
  assert.equal(restored["p-ada"].firstAt, 80);
  assert.equal(Object.keys(restored).length, 1);

  const richer = alltime.applyMine(
    {
      "p-ada": { firstAt: 100, lastAt: 120, name: "Ada" },
      "p-bea": { firstAt: 90, lastAt: 90, name: "Bea" },
      "p-cal": { firstAt: 70, lastAt: 70, name: "Cal" }
    },
    snapshot,
    "p-ada"
  );
  assert.equal(richer["p-ada"].firstAt, 80);
  assert.equal(richer["p-ada"].lastAt, 250);
  assert.equal(richer["p-bea"].name, "Bea");
  assert.equal(richer["p-cal"].name, "Cal");
  assert.equal(Object.keys(richer).length, 3);

  const blocked = alltime.applyMine(
    { "p-bea": { firstAt: 1, lastAt: 2, name: "Bea" } },
    snapshot,
    "p-bea"
  );
  assert.equal(Object.keys(blocked).length, 1);
  assert.equal(blocked["p-bea"].name, "Bea");
  assert.equal(blocked["p-ada"], undefined);

  const leaked = alltime.applyMine(
    { "p-ada": { firstAt: 10, lastAt: 10, name: "Ada" } },
    {
      playerId: "p-ada",
      row: { firstAt: 5, lastAt: 20, name: "Ada" },
      players: { "p-eve": { firstAt: 1, lastAt: 1, name: "Eve" } }
    },
    "p-ada"
  );
  assert.equal(leaked["p-eve"], undefined);
  assert.equal(leaked["p-ada"].firstAt, 5);
});
