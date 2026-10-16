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

test("owned aquarium row dual-writes without copying others or shrinking shared tanks", () => {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  assert.match(script, /persistAquaMine/);
  assert.match(script, /pullAquaMine/);
  assert.match(script, /canPostSharedAqua/);
  assert.match(script, /if \(!canPost\) return;/);
  assert.equal(save.AQUA_MINE_KEY, "aqua-mine");
  assert.equal(save.canPostSharedAqua(null), false);
  assert.equal(save.canPostSharedAqua({ tanks: {} }), true);

  const snapshot = save.collectAquaMine(
    {
      playerId: "p-ada",
      name: "Ada",
      updatedAt: 80,
      level: 3,
      fish: [{ id: "minnow", variant: "gold", shiny: true, mutation: "neon" }],
      extraOthers: true
    },
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(snapshot.fish[0].id, "minnow");
  assert.equal(snapshot.extraOthers, undefined);
  assert.equal(save.collectAquaMine({ playerId: "p-bea", name: "Bea" }, "p-ada"), null);

  const restored = save.applyAquaMine({}, snapshot, "p-ada");
  assert.equal(restored["p-ada"].level, 3);
  assert.equal(Object.keys(restored).length, 1);

  const kept = save.applyAquaMine(
    {
      "p-ada": { playerId: "p-ada", updatedAt: 50, level: 1, fish: [] },
      "p-bea": { playerId: "p-bea", updatedAt: 90, level: 8, fish: [] }
    },
    snapshot,
    "p-ada"
  );
  assert.equal(kept["p-ada"].level, 3);
  assert.equal(kept["p-bea"].level, 8);

  const older = save.applyAquaMine(kept, { ...snapshot, updatedAt: 10, level: 99 }, "p-ada");
  assert.equal(older["p-ada"].level, 3);
  assert.equal(older["p-bea"].level, 8);
});

test("fishing community uses account-server prefer and skips the old backup write after success", () => {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  assert.match(script, /api\.getPrefer\(\s*COMMUNITY_DOC/);
  assert.match(script, /api\.pushPrefer\(\s*COMMUNITY_DOC/);
  assert.equal(script.includes("await api.upsertDoc(COMMUNITY_DOC"), false);
  assert.match(script, /communityRateLimited\(\) \? "" : COMMUNITY_API/);
});
