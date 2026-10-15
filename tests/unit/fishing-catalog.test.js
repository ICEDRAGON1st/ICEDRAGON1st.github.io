"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const catalog = require(path.resolve(__dirname, "../../fishing/catalog.js"));

function uniqueIds(rows, label) {
  const ids = rows.map((row) => row.id);
  assert.ok(ids.every(Boolean), `${label} missing ids`);
  assert.equal(new Set(ids).size, ids.length, `${label} ids must be unique`);
}

test("Fishing catalogs stay complete after the script split", () => {
  assert.ok(catalog.FISH.length >= 40);
  assert.ok(catalog.SPOTS.length >= 20);
  assert.ok(catalog.GEAR.length >= 100);
  uniqueIds(catalog.FISH, "fish");
  uniqueIds(catalog.SPOTS, "spots");
  uniqueIds(catalog.GEAR, "gear");

  for (const fish of catalog.FISH) {
    assert.ok(fish.name);
    assert.ok(fish.rarity);
    assert.equal(typeof fish.value, "number");
  }
  for (const spot of catalog.SPOTS) {
    assert.ok(spot.name);
    assert.ok(Array.isArray(spot.wait));
    assert.equal(typeof spot.rarity, "number");
  }
  for (const gear of catalog.GEAR) {
    assert.ok(gear.name);
    assert.ok(gear.kind);
    assert.equal(typeof gear.cost, "number");
  }

  const maxSpot = Math.max(...catalog.SPOTS.map((spot) => spot.rarity));
  assert.equal(catalog.MAX_SPOT_RARITY, maxSpot);
  assert.equal(catalog.AQUARIUM_MAX_LEVEL, catalog.AQUARIUM_TIERS.length - 1);
  assert.equal(catalog.AQUARIUM_TIERS[0], null);
});
