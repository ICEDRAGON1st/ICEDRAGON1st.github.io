"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const catalog = require(path.resolve(__dirname, "../../fishing/catalog.js"));
const save = require(path.resolve(__dirname, "../../fishing/save.js"));

const RARITIES = ["common", "uncommon", "rare"];
const ctxBase = {
  gear: catalog.GEAR,
  rarities: RARITIES,
  spots: catalog.SPOTS,
  echoLuckResetId: save.ECHO_LUCK_RESET_ID,
  now: 1_700_000_000_000,
  boatMax: 8,
  aquaMax: catalog.AQUARIUM_MAX_LEVEL,
  treasureHardMax: 999,
  luckyBlockMax: 50,
  echoLuckMax: 10,
  fishById: (id) => catalog.FISH.find((fish) => fish.id === id) || null,
  normalizeCoolerEntry: (entry) => {
    if (!entry) return null;
    if (typeof entry === "string")
      return catalog.FISH.some((fish) => fish.id === entry)
        ? { id: entry, variant: "", shiny: false, mutation: "" }
        : null;
    return catalog.FISH.some((fish) => fish.id === entry.id)
      ? {
          id: entry.id,
          variant: entry.variant || "",
          shiny: !!entry.shiny,
          mutation: entry.mutation || ""
        }
      : null;
  },
  normalizeCaughtRecord: (raw) =>
    raw && typeof raw === "object" ? { ...raw, any: true } : { any: true },
  normalizeVariant: (raw) => {
    const value = String(raw || "").toLowerCase();
    return ["silver", "gold", "diamond", "rainbow"].includes(value) ? value : "";
  },
  normalizeMutation: (raw) => {
    const value = String(raw || "").toLowerCase();
    return ["toxic", "lava", "neon"].includes(value) ? value : "";
  },
  resolveEquippedSpeed: () => "",
  migrateLegacyBoats: () => 0,
  migrateLegacyAquarium: () => 0,
  coolerMaxFromOwned: () => 12,
  getStoredBest: () => 0,
  fishFromCatchScore: () => null,
  sanitizeCatchScore: (n) => Math.max(0, Number(n) || 0),
  normalizeQuestsState: (quests) =>
    quests && typeof quests === "object"
      ? quests
      : { dailyKey: "", weeklyKey: "", daily: [], weekly: [] }
};

test("Fishing save hydrate keeps progress and migrates old flags", () => {
  const fresh = save.defaultState(ctxBase);
  assert.equal(fresh.coins, 25);
  assert.equal(fresh.spotId, "creek");
  assert.equal(fresh.owned.minnow, undefined);
  assert.equal(typeof fresh.owned[catalog.GEAR[0].id], "boolean");

  const richer = save.pickRicherSave(
    { lifetime: 10, coins: 5, catches: 1, cooler: [] },
    { lifetime: 40, coins: 2, catches: 3, cooler: [{ id: "minnow" }] }
  );
  assert.equal(richer.lifetime, 40);

  const hydrated = save.hydrateState(
    {
      coins: 80,
      lifetime: 400,
      spotId: "not-a-spot",
      autoSell: true,
      echoLuckLevel: 7,
      echoLuckReset: "old",
      weatherId: "fog",
      cooler: ["minnow", { id: "missing-fish" }],
      owned: { [catalog.GEAR[0].id]: true },
      treasureCount: 4
    },
    ctxBase
  );
  assert.equal(hydrated.coins, 80);
  assert.equal(hydrated.lifetime, 400);
  assert.equal(hydrated.spotId, "creek");
  assert.equal(hydrated.autoSellRarities.common, true);
  assert.equal(hydrated.echoLuckLevel, 0);
  assert.equal(hydrated.echoLuckReset, save.ECHO_LUCK_RESET_ID);
  assert.equal(hydrated.weatherId, "none");
  assert.equal(hydrated.cooler.length, 1);
  assert.equal(hydrated.cooler[0].id, "minnow");
  assert.equal(hydrated.owned[catalog.GEAR[0].id], true);
  assert.equal(hydrated.moneyChestCount, 4);
  assert.equal(hydrated.unlocked.creek, true);
});
