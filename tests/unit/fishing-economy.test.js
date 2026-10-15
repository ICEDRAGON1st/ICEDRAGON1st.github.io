"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const economy = require(path.join(ROOT, "fishing/economy.js"));
const catalog = require(path.join(ROOT, "fishing/catalog.js"));

function fish(id) {
  return catalog.FISH.find((row) => row.id === id);
}

test("Fishing sell pricing lives in the economy helper", () => {
  const script = fs.readFileSync(path.join(ROOT, "fishing/script.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "fishing/index.html"), "utf8");
  assert.match(script, /window\.FishingEconomy/);
  assert.match(script, /fishingEconomy\.fishValue/);
  assert.match(html, /economy\.js/);
});

test("looks and sell bonuses stack the same way as the live game", () => {
  assert.equal(
    economy.variantValueMult({ variant: "gold", shiny: true, mutation: "lava" }),
    2 * 3 * 5
  );
  assert.equal(economy.normalizeVariant("GOLD"), "gold");
  assert.equal(economy.normalizeMutation("neon"), "neon");
  assert.equal(economy.normalizeVariant("blue"), "");

  const trout = fish("trout");
  assert.equal(economy.bookLookValue(trout, { variant: "gold", shiny: false }), 28);
  assert.equal(
    economy.fishValue(trout, { valueMult: 1 }, { variant: "", shiny: false, perfect: false }, {}),
    14
  );
  assert.equal(
    economy.fishValue(
      trout,
      { valueMult: 2 },
      { variant: "gold", shiny: true, perfect: true },
      { sellBonus: 1, spotMastery: 0.015, combo: 0.015, perfectBonus: 0.5, treasureMoney: 2 }
    ),
    Math.floor(14 * 2 * (1 + 1 + 0.015 + 0.015 + 0.5) * 2 * (2 * 3))
  );

  const exclusive = { id: "soultwin", rarity: "exclusive", value: 9 };
  assert.equal(economy.isExclusiveFish(exclusive), true);
  assert.equal(economy.isUnsellableFish(exclusive, {}), true);
  assert.equal(
    economy.fishValue(exclusive, { valueMult: 3 }, { lockedValue: 40 }, { sellBonus: 4 }),
    600
  );
  assert.equal(economy.canSetBestCatch(exclusive), false);
  assert.equal(economy.canSetBestCatch(trout), true);
  assert.equal(
    economy.shouldAutoSellFish(
      trout,
      { mutation: "toxic" },
      { autoSellRarity: true, autoSellMutations: false }
    ),
    false
  );
  assert.equal(
    economy.shouldAutoSellFish(
      trout,
      { mutation: "toxic" },
      { autoSellRarity: true, autoSellMutations: true }
    ),
    true
  );
});
