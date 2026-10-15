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
