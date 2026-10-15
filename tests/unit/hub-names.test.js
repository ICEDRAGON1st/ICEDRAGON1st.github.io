"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const names = require(path.join(ROOT, "hub-names.js"));

test("unique nickname claims live outside hub-plays and load before it", () => {
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const boot = fs.readFileSync(path.join(ROOT, "hub-game-boot.js"), "utf8");
  assert.match(plays, /window\.HubNames/);
  assert.match(plays, /namesApi\.mergeNameMaps/);
  assert.match(index, /hub-names\.js/);
  assert.match(boot, /hub-names\.js/);
});

test("first claimer keeps a nickname and same-player titles merge", () => {
  const parsed = names.parseNameRegistry({
    names: {
      ada: { playerId: "p-ada", name: "Ada", claimedAt: 10 },
      skip: { note: "not a claim" }
    },
    total: 1
  });
  assert.equal(parsed.ada.playerId, "p-ada");
  assert.equal(parsed.skip, undefined);

  const stolen = names.mergeNameMaps(
    { ada: { playerId: "p-ada", name: "Ada", claimedAt: 10 } },
    { ada: { playerId: "p-eve", name: "Ada", claimedAt: 99 } }
  );
  assert.equal(stolen.ada.playerId, "p-ada");

  const earlier = names.mergeNameMaps(
    { ada: { playerId: "p-ada", name: "Ada", claimedAt: 40 } },
    { ada: { playerId: "p-bea", name: "Ada", claimedAt: 5 } }
  );
  assert.equal(earlier.ada.playerId, "p-bea");

  const merged = names.mergeNameMaps(
    {
      ada: {
        playerId: "p-ada",
        name: "Ada",
        claimedAt: 10,
        legend: true,
        legendAt: 20,
        activeTitle: "ACE"
      }
    },
    {
      ada: {
        playerId: "p-ada",
        name: "Ada",
        claimedAt: 40,
        masterFisher: true,
        masterFisherAt: 30,
        accentColor: "#0ff",
        profileUpdatedAt: 50
      }
    }
  );
  assert.equal(merged.ada.playerId, "p-ada");
  assert.equal(merged.ada.claimedAt, 10);
  assert.equal(merged.ada.legend, true);
  assert.equal(merged.ada.masterFisher, true);
  assert.equal(merged.ada.activeTitle, "ACE");
  assert.equal(merged.ada.accentColor, "#0ff");

  const found = names.findClaimByPlayerId(
    {
      late: { playerId: "p-ada", name: "Ada2", claimedAt: 80 },
      early: { playerId: "p-ada", name: "Ada", claimedAt: 10 }
    },
    "p-ada"
  );
  assert.equal(found.name, "Ada");

  const purged = names.purgeNameRegistry(
    {
      ada: { playerId: "p-ada", name: "Ada", accentTitle: "rainbow", accentColor: "#0ff" },
      bad: { playerId: "p-bad", name: "Bad" }
    },
    {
      isPurgedKey: (key) => key === "bad",
      isPurgedPlayer: () => false
    }
  );
  assert.equal(purged.names.bad, undefined);
  assert.equal(purged.names.ada.accentTitle, "");
  assert.equal(purged.names.ada.accentColor, "#0ff");
  assert.equal(purged.changed, true);
});
