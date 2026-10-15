"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const FIXTURES = path.join(ROOT, "tests/fixtures/saves");

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

function loadAccountBagApi({ failWrites = false } = {}) {
  const values = new Map();
  const localStorage = {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      if (failWrites) throw new Error("quota exceeded");
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    }
  };
  const context = {
    console,
    localStorage,
    document: {
      readyState: "loading",
      addEventListener() {},
      dispatchEvent() {}
    },
    setInterval() {
      return 0;
    },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "hub-account-bag.js"), "utf8"), context);
  return { api: context.HubAccountBag, values };
}

test("golden account bags merge progress monotonically", () => {
  const { api } = loadAccountBagApi();
  const local = loadFixture("account-bag-local.json");
  const remote = loadFixture("account-bag-remote.json");
  const merged = JSON.parse(JSON.stringify(api.mergeBags(local, remote)));

  assert.equal(merged.playerId, "fixture-player");
  assert.equal(merged.updatedAt, 200);
  assert.equal(merged.kv["snake-high-score"], "1200");
  assert.equal(merged.kv["quizmaster-high-score-hard"], "55");
  assert.equal(merged.kv["paper-io-best-pct"], "31");
  assert.equal(merged.kv["fishing-best-catch-v2"], "9000");
  assert.equal(merged.kv["cup-flow-best-level"], "12");
  assert.equal(merged.kv["space-waves-high-score"], "450");
  assert.equal(merged.kv["sticker-garage-high-score"], "900");
  assert.equal(merged.kv["clicker-high-score-v3"], "4000");
  assert.equal(merged.kv["clicker-save-v3"], '{"coins":20,"prestige":0}');
  assert.equal(merged.kv["paper-claim-skin"], "classic");
  assert.deepEqual(JSON.parse(merged.kv["hub-coins-v1"]), {
    balance: 700,
    lifetimeEarned: 1200,
    lifetimeSpent: 500,
    lastDailyDay: "2099-12-31",
    lastAiQuestDay: "2099-12-29",
    lastPickupAt: 200,
    purchases: { blueTrail: true, goldName: true },
    updatedAt: 200
  });
  assert.equal(merged.kv["hub-achievements-pending"], undefined);
  assert.deepEqual(JSON.parse(merged.kv["hub-achievements-v1"]), {
    first_win: 200,
    collector: 500,
    traveler: 400
  });
  assert.deepEqual(JSON.parse(merged.kv["hub-daily-streak"]), {
    streak: 3,
    lastDate: "2099-12-30",
    lastPlayedAt: 4102444800000,
    best: 8,
    celebrate: false
  });
  assert.equal(merged.kv["hub-look-theme"], "classic");

  const fishing = JSON.parse(merged.kv["fishing-save-v3"]);
  assert.equal(fishing.coins, 500);
  assert.equal(fishing.lifetime, 250);
  assert.equal(fishing.catches, 12);
  assert.equal(fishing.aquariumLevel, 3);
  assert.equal(fishing.bestCatchScore, 9000);
  assert.equal(fishing.bestCatchId, "salmon");
  assert.equal(fishing.caught.salmon.gold, true);
  assert.equal(fishing.caught.tuna.shiny, true);
  assert.equal(fishing.owned.starter, true);
  assert.equal(fishing.owned.proRod, true);
  assert.equal(fishing.unlocked.creek, true);
  assert.equal(fishing.unlocked.lake, true);
});

test("bag merge is idempotent and apply tolerates storage quota failure", () => {
  const { api } = loadAccountBagApi();
  const local = loadFixture("account-bag-local.json");
  const remote = loadFixture("account-bag-remote.json");
  const once = JSON.parse(JSON.stringify(api.mergeBags(local, remote)));
  const twice = JSON.parse(JSON.stringify(api.mergeBags(once, once)));
  assert.deepEqual(twice, once);

  const { api: quotaApi } = loadAccountBagApi({ failWrites: true });
  assert.doesNotThrow(() => quotaApi.apply(once, { replace: true }));
});

test("coin wallets map only to the active account key", () => {
  const { api, values } = loadAccountBagApi();
  const bag = loadFixture("account-bag-local.json");

  api.apply(bag, { replace: true });
  assert.equal(values.has("hub-coins-v1"), false);
  assert.equal(values.get("hub-coins-v1:fixture-player"), bag.kv["hub-coins-v1"]);

  values.set(
    "hub-coins-v1:fixture-player",
    JSON.stringify({ balance: 9, lifetimeEarned: 10, lifetimeSpent: 1 })
  );
  values.set("hub-coins-v1:other-player", JSON.stringify({ balance: 999 }));
  const snapshot = JSON.parse(JSON.stringify(api.snapshot("fixture-player")));
  assert.equal(JSON.parse(snapshot.kv["hub-coins-v1"]).balance, 9);
  assert.equal(values.has("hub-coins-v1:other-player"), true);
});

test("Fishing merge keeps owners isolated and protects a rich cooler from a weak wipe", () => {
  const { api } = loadAccountBagApi();
  const fishBag = (updatedAt, save) => ({
    playerId: "fixture-player",
    updatedAt,
    kv: { "fishing-save-v3": JSON.stringify(save) }
  });

  const weakOwner = {
    ownerPlayerId: "owner-a",
    lifetime: 1,
    caught: { trout: { any: true } },
    cooler: []
  };
  const richOwner = {
    ownerPlayerId: "owner-b",
    lifetime: 500,
    caught: { salmon: { any: true, gold: true } },
    cooler: [{ id: "salmon" }]
  };
  const isolated = JSON.parse(
    api.mergeBags(fishBag(100, weakOwner), fishBag(200, richOwner)).kv["fishing-save-v3"]
  );
  assert.equal(isolated.ownerPlayerId, "owner-b");
  assert.equal(isolated.caught.trout, undefined);

  const richCooler = Array.from({ length: 25 }, (_, index) => ({ id: `fish-${index}` }));
  const older = {
    ownerPlayerId: "fixture-player",
    coins: 100,
    lifetime: 200,
    caught: { salmon: { any: true, gold: true, looks: { gold: "golden" } } },
    cooler: richCooler,
    lastTick: 100
  };
  const newerWeak = {
    ownerPlayerId: "fixture-player",
    coins: 99,
    lifetime: 199,
    caught: { salmon: { any: true, shiny: true, looks: { shiny: "sparkle" } } },
    cooler: [],
    lastTick: 200
  };
  const protectedSave = JSON.parse(
    api.mergeBags(fishBag(100, older), fishBag(200, newerWeak)).kv["fishing-save-v3"]
  );
  assert.equal(protectedSave.cooler.length, 25);
  assert.equal(protectedSave.caught.salmon.gold, true);
  assert.equal(protectedSave.caught.salmon.shiny, true);
  assert.deepEqual(JSON.parse(JSON.stringify(protectedSave.caught.salmon.looks)), {
    gold: "golden",
    shiny: "sparkle"
  });

  const realSell = { ...newerWeak, coins: 350, lifetime: 450 };
  const soldSave = JSON.parse(
    api.mergeBags(fishBag(100, older), fishBag(200, realSell)).kv["fishing-save-v3"]
  );
  assert.deepEqual(soldSave.cooler, []);
});

test("Mine wipe never restores old cloud progress over new local progress", () => {
  const { api, values } = loadAccountBagApi();
  values.set("hub-mine-local-wipe-v3", "done");
  values.set("mine-depth-save-v1", "new-local-progress");

  const merged = JSON.parse(
    JSON.stringify(
      api.mergeBags(
        {
          playerId: "fixture-player",
          updatedAt: 100,
          kv: { "mine-depth-best-v1": "10", "snake-high-score": "50" }
        },
        {
          playerId: "fixture-player",
          updatedAt: 200,
          kv: {
            "mine-depth-save-v1": "old-cloud-progress",
            "mine-depth-best-v1": "999",
            "snake-high-score": "75"
          }
        }
      )
    )
  );

  assert.equal(merged.kv["mine-depth-save-v1"], "new-local-progress");
  assert.equal(merged.kv["mine-depth-best-v1"], undefined);
  assert.equal(merged.kv["snake-high-score"], "75");

  api.apply(
    {
      playerId: "fixture-player",
      kv: {
        "mine-depth-save-v1": "old-cloud-progress",
        "snake-high-score": "80"
      }
    },
    { replace: true }
  );
  assert.equal(values.get("mine-depth-save-v1"), "new-local-progress");
  assert.equal(values.get("snake-high-score"), "80");
});

test("account restore never blends leftover keys or toast queues", () => {
  const { api, values } = loadAccountBagApi();
  values.set("hub-player-name", "Guest");
  values.set("snake-high-score", "50");
  values.set("clicker-high-score-v3", "900");
  values.set("hub-achievements-pending", '["live-toast"]');

  api.apply(
    {
      playerId: "restored-player",
      kv: {
        "hub-player-name": "undefined",
        "snake-high-score": "80",
        "hub-achievements-pending": '["bag-toast"]'
      }
    },
    { replace: true }
  );

  assert.equal(values.has("hub-player-name"), false);
  assert.equal(values.get("snake-high-score"), "80");
  assert.equal(values.has("clicker-high-score-v3"), false);
  assert.equal(values.has("hub-achievements-pending"), false);

  values.set("hub-achievements-pending", '["session-toast"]');
  api.apply({
    playerId: "restored-player",
    kv: {
      "snake-high-score": "90",
      "hub-achievements-pending": '["bag-toast"]'
    }
  });
  assert.equal(values.get("snake-high-score"), "90");
  assert.equal(values.get("hub-achievements-pending"), '["session-toast"]');
});
