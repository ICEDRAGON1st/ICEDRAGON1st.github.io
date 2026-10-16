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
  assert.match(script, /if \(!fetched\) return null;/);
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

  assert.match(script, /persistAquaTankContribution/);
  assert.match(script, /fetchAquaShareTableRemote/);
  assert.match(script, /overlayAquaTanks/);
  assert.match(script, /if \(tableWrote && !rewriteShared\) return true/);

  const now = Date.now();
  const overlaid = save.overlayAquaTanks(
    {
      tanks: {
        "p-adaxxxxx": { playerId: "p-adaxxxxx", updatedAt: now - 100, level: 1, fish: [] },
        "p-guestxxx": { playerId: "p-guestxxx", updatedAt: now, level: 9, fish: [] }
      }
    },
    [
      {
        player_id: "p-adaxxxxx",
        tank: { playerId: "p-adaxxxxx", updatedAt: now, level: 4, fish: [{ id: "minnow" }] }
      },
      {
        player_id: "p-beaxxxxx",
        tank: { playerId: "p-beaxxxxx", updatedAt: now, level: 7, fish: [] }
      },
      {
        player_id: "",
        tank: { playerId: "p-skipxxxx", updatedAt: now, level: 99, fish: [] }
      }
    ],
    now
  );
  assert.equal(overlaid.tanks["p-adaxxxxx"].level, 4);
  assert.equal(overlaid.tanks["p-beaxxxxx"].level, 7);
  assert.equal(overlaid.tanks["p-guestxxx"].level, 9);
  assert.equal(overlaid.tanks["p-skipxxxx"], undefined);

  const liveRow = save.applyAquaTankChange(
    {
      tanks: {
        "p-adaxxxxx": { playerId: "p-adaxxxxx", updatedAt: now - 100, level: 1, fish: [] },
        "p-guestxxx": { playerId: "p-guestxxx", updatedAt: now, level: 9, fish: [] }
      }
    },
    {
      type: "UPDATE",
      new: {
        player_id: "p-adaxxxxx",
        tank: { playerId: "p-adaxxxxx", updatedAt: now, level: 4, fish: [{ id: "minnow" }] }
      }
    },
    now
  );
  assert.equal(liveRow.tanks["p-adaxxxxx"].level, 4);
  assert.equal(liveRow.tanks["p-guestxxx"].level, 9);

  const afterDelete = save.applyAquaTankChange(
    liveRow,
    { type: "DELETE", old_record: { player_id: "p-adaxxxxx" } },
    now
  );
  assert.equal(afterDelete.tanks["p-adaxxxxx"].level, 4);
  assert.equal(afterDelete.tanks["p-guestxxx"].level, 9);
});

test("fishing community uses account-server prefer and skips the old backup write after success", () => {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  assert.match(script, /api\.getPrefer\(\s*COMMUNITY_DOC/);
  assert.match(script, /if \(raw && typeof raw === "object"\) \{/);
  assert.match(script, /remoteOk = true;/);
  assert.match(script, /api\.pushPrefer\(\s*COMMUNITY_DOC/);
  assert.equal(script.includes("await api.upsertDoc(COMMUNITY_DOC"), false);
  assert.equal(script.includes("mantledb.sh"), false);
  assert.equal(script.includes("COMMUNITY_API"), false);
  assert.match(script, /persistCommunityCastContribution/);
  assert.match(script, /fetchCommunityTableRemote/);
  assert.match(script, /overlayCommunityCasts/);
  assert.match(script, /if \(tableWrote && !rewriteShared\) return true/);
});

test("community cast overlay sums this week's rows without shrinking a richer shared meter", () => {
  const hub = {
    weekKey: "2026-10-16",
    total: 100,
    goal: 2500,
    rewardUntil: 0,
    rewardMult: 2,
    lbWave: 0
  };
  const rows = [
    { player_id: "p-ada", week_key: "2026-10-16", casts: 40 },
    { player_id: "p-bea", week_key: "2026-10-16", casts: 80 },
    { player_id: "p-cal", week_key: "2026-10-9", casts: 999 },
    { player_id: "", week_key: "2026-10-16", casts: 50 },
    { playerId: "p-dan", weekKey: "2026-10-16", casts: 5 }
  ];
  const overlaid = save.overlayCommunityCasts(hub, rows, "2026-10-16");
  assert.equal(overlaid.total, 125);
  assert.equal(overlaid.weekKey, "2026-10-16");
  assert.equal(overlaid.goal, 2500);
  assert.equal(overlaid.rewardUntil, 0);
  assert.equal(overlaid.lbWave, 0);
  assert.equal(overlaid.rewardMult, 2);

  const kept = save.overlayCommunityCasts({ ...hub, total: 500 }, rows, "2026-10-16");
  assert.equal(kept.total, 500);

  assert.equal(save.overlayCommunityCasts(hub, rows, "2026-10-9").total, 999);

  const liveRow = save.applyCommunityCastChange(
    hub,
    {
      type: "UPDATE",
      new: { player_id: "p-cal", week_key: "2026-10-16", casts: 30 }
    },
    "2026-10-16",
    rows
  );
  assert.equal(liveRow.total, 155);
  assert.equal(liveRow.rows.length, 5);

  const afterDelete = save.applyCommunityCastChange(
    liveRow,
    { type: "DELETE", old_record: { player_id: "p-cal" } },
    "2026-10-16",
    liveRow.rows
  );
  assert.equal(afterDelete.total, 155);
  assert.equal(afterDelete.rows.length, 5);
});

test("fishing player mail uses account-owned rows and skips the shared rewrite after success", () => {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  const mail = fs.readFileSync(path.resolve(__dirname, "../../hub-fishing-mail.js"), "utf8");
  const plays = fs.readFileSync(path.resolve(__dirname, "../../hub-plays.js"), "utf8");
  assert.match(script, /persistFishingMailContribution/);
  assert.match(script, /fetchPlayerMailTableRemote/);
  assert.match(script, /overlayPlayerMail/);
  assert.match(script, /if \(tableWrote && !rewriteShared\) return true/);
  assert.match(mail, /persistMailContribution/);
  assert.match(mail, /listFishingMailContributions/);
  assert.match(mail, /if \(tableWrote && !rewriteShared\) return true/);
  assert.match(mail, /if \(!fetched\) return null;/);
  assert.match(mail, /ensureMailRealtime/);
  assert.match(mail, /applyMailRealtime/);
  assert.match(mail, /subscribeFishingMailContributions/);
  assert.match(script, /ensurePlayerMailRealtime/);
  assert.match(script, /applyPlayerMailRealtime/);
  assert.match(script, /subscribeFishingMailContributions/);
  assert.doesNotMatch(
    mail.slice(mail.indexOf("function applyMailRealtime"), mail.indexOf("function stopMailRealtime")),
    /persistMailContribution|pushPrefer|fetchDoc/
  );
  assert.match(plays, /fishing\/save\.js/);
});

test("player mail overlay merges owned gifts and trades without copying others or un-claiming", () => {
  const now = 1_700_000_000_000;
  const hub = {
    gifts: {
      "pg-hub": {
        id: "pg-hub",
        fromId: "p-guestxxxx",
        toPlayerId: "p-adaxxxxx",
        items: [{ kind: "chest", chestKind: "money", count: 1 }],
        at: now,
        claimed: false
      }
    },
    trades: {}
  };
  const rows = [
    {
      player_id: "p-adaxxxxx",
      gifts: {
        "pg-1": {
          id: "pg-1",
          fromId: "p-adaxxxxx",
          toPlayerId: "p-beaxxxxx",
          items: [{ kind: "fish", fishId: "minnow" }],
          at: now,
          claimed: false
        }
      },
      trades: {
        "tr-1": {
          id: "tr-1",
          aId: "p-adaxxxxx",
          bId: "p-beaxxxxx",
          aItems: [],
          bItems: [],
          status: "open",
          at: now,
          updatedAt: now
        }
      }
    },
    {
      player_id: "p-beaxxxxx",
      gifts: {
        "pg-1": {
          id: "pg-1",
          fromId: "p-adaxxxxx",
          toPlayerId: "p-beaxxxxx",
          items: [{ kind: "fish", fishId: "minnow" }],
          at: now,
          claimed: true,
          claimedAt: now + 5
        }
      },
      trades: {
        "tr-1": {
          id: "tr-1",
          aId: "p-adaxxxxx",
          bId: "p-beaxxxxx",
          status: "done",
          updatedAt: now + 8,
          appliedBy: { "p-beaxxxxx": now + 8 }
        }
      }
    },
    {
      player_id: "",
      gifts: {
        "pg-skip": {
          id: "pg-skip",
          fromId: "p-calxxxxx",
          toPlayerId: "p-adaxxxxx",
          items: [{ kind: "fish", fishId: "shark" }],
          at: now
        }
      }
    }
  ];
  const overlaid = save.overlayPlayerMail(hub, rows, now);
  assert.equal(overlaid.gifts["pg-hub"].claimed, false);
  assert.equal(overlaid.gifts["pg-1"].claimed, true);
  assert.equal(overlaid.gifts["pg-skip"], undefined);
  assert.equal(overlaid.trades["tr-1"].status, "done");
  assert.equal(overlaid.trades["tr-1"].appliedBy["p-beaxxxxx"], now + 8);

  const mine = save.collectPlayerMailMine(overlaid.gifts, overlaid.trades, "p-adaxxxxx");
  assert.equal(mine.gifts["pg-1"].id, "pg-1");
  assert.equal(mine.gifts["pg-hub"].id, "pg-hub");
  assert.equal(mine.trades["tr-1"].id, "tr-1");
  assert.equal(save.collectPlayerMailMine(overlaid.gifts, overlaid.trades, "p-calxxxxx").gifts["pg-1"], undefined);

  const liveRow = save.applyPlayerMailChange(
    hub,
    {
      type: "UPDATE",
      new: {
        player_id: "p-beaxxxxx",
        gifts: {
          "pg-1": {
            id: "pg-1",
            fromId: "p-adaxxxxx",
            toPlayerId: "p-beaxxxxx",
            items: [{ kind: "fish", fishId: "minnow" }],
            at: now,
            claimed: true,
            claimedAt: now + 5
          }
        },
        trades: {}
      }
    },
    now
  );
  assert.equal(liveRow.gifts["pg-hub"].claimed, false);
  assert.equal(liveRow.gifts["pg-1"].claimed, true);

  const afterDelete = save.applyPlayerMailChange(
    liveRow,
    { type: "DELETE", old_record: { player_id: "p-beaxxxxx" } },
    now
  );
  assert.equal(afterDelete.gifts["pg-1"].claimed, true);
  assert.equal(afterDelete.gifts["pg-hub"].claimed, false);
});

test("fishing mail live rows subscribe without rewriting the shared board", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const mail = fs.readFileSync(path.resolve(__dirname, "../../hub-fishing-mail.js"), "utf8");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  const supabase = fs.readFileSync(path.resolve(__dirname, "../../hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.resolve(__dirname, "../../supabase/migrations/202610160025_fishing_mail_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(mail, /ensureMailRealtime/);
  assert.match(script, /ensurePlayerMailRealtime/);
  assert.match(supabase, /function subscribeFishingMailContributions/);
  assert.match(sql, /alter table public\.fishing_mail_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.fishing_mail_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing admin gifts use account-owned claim rows and skip the shared rewrite after success", () => {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  const gifts = fs.readFileSync(path.resolve(__dirname, "../../hub-fishing-gifts.js"), "utf8");
  assert.match(script, /persistFishGiftContribution/);
  assert.match(script, /fetchFishGiftsTableRemote/);
  assert.match(script, /overlayAdminFishGifts/);
  assert.match(script, /postFishGiftsDoc\(\{ gifts \}, \{ rewriteShared: true \}\)/);
  assert.match(script, /if \(!remote \|\| typeof remote !== "object"\) return false;/);
  assert.match(gifts, /if \(!fetched\) return null;/);
  assert.match(gifts, /persistGiftContribution/);
  assert.match(gifts, /listFishingGiftContributions/);
  assert.match(gifts, /if \(tableWrote && !rewriteShared\) return true/);
  assert.match(gifts, /ensureGiftsRealtime/);
  assert.match(gifts, /applyGiftsRealtime/);
  assert.match(gifts, /subscribeFishingGiftContributions/);
  assert.match(script, /ensureFishGiftsRealtime/);
  assert.match(script, /applyFishGiftsRealtime/);
  assert.match(script, /subscribeFishingGiftContributions/);
  assert.doesNotMatch(
    gifts.slice(gifts.indexOf("function applyGiftsRealtime"), gifts.indexOf("function stopGiftsRealtime")),
    /persistGiftContribution|pushPrefer|fetchDoc/
  );
});

test("admin fish-gift overlay merges broadcast claims without un-claiming someone else", () => {
  const now = 1_700_000_000_000;
  const hub = {
    gifts: {
      "g-hub": {
        id: "g-hub",
        fromId: "p-icexxxxx",
        broadcast: true,
        fishId: "minnow",
        at: now,
        claimed: false,
        claimedBy: {}
      }
    }
  };
  const rows = [
    {
      player_id: "p-adaxxxxx",
      gifts: {
        "g-hub": {
          id: "g-hub",
          fromId: "p-icexxxxx",
          broadcast: true,
          fishId: "minnow",
          at: now,
          claimedBy: { "p-adaxxxxx": now + 2 }
        }
      }
    },
    {
      player_id: "p-beaxxxxx",
      gifts: {
        "g-hub": {
          id: "g-hub",
          fromId: "p-icexxxxx",
          broadcast: true,
          fishId: "minnow",
          at: now,
          claimedBy: { "p-beaxxxxx": now + 4 }
        },
        "g-bea": {
          id: "g-bea",
          fromId: "p-icexxxxx",
          toPlayerId: "p-beaxxxxx",
          fishId: "shark",
          at: now,
          claimed: true,
          claimedBy: "p-beaxxxxx",
          claimedAt: now + 3
        }
      }
    },
    {
      player_id: "",
      gifts: {
        "g-skip": {
          id: "g-skip",
          fromId: "p-icexxxxx",
          toPlayerId: "p-adaxxxxx",
          fishId: "tuna",
          at: now
        }
      }
    }
  ];
  const overlaid = save.overlayAdminFishGifts(hub, rows, now);
  assert.equal(overlaid.gifts["g-hub"].claimed, false);
  assert.equal(overlaid.gifts["g-hub"].claimedBy["p-adaxxxxx"], now + 2);
  assert.equal(overlaid.gifts["g-hub"].claimedBy["p-beaxxxxx"], now + 4);
  assert.equal(overlaid.gifts["g-bea"].claimed, true);
  assert.equal(overlaid.gifts["g-skip"], undefined);

  const ada = save.collectAdminFishGiftsMine(overlaid.gifts, "p-adaxxxxx");
  assert.equal(ada.gifts["g-hub"].id, "g-hub");
  assert.equal(ada.gifts["g-bea"], undefined);
  const ice = save.collectAdminFishGiftsMine(overlaid.gifts, "p-icexxxxx");
  assert.equal(ice.gifts["g-hub"].id, "g-hub");
  assert.equal(ice.gifts["g-bea"].id, "g-bea");

  const liveRow = save.applyAdminFishGiftsChange(
    hub,
    {
      type: "UPDATE",
      new: {
        player_id: "p-beaxxxxx",
        gifts: {
          "g-hub": {
            id: "g-hub",
            fromId: "p-icexxxxx",
            broadcast: true,
            fishId: "minnow",
            at: now,
            claimedBy: { "p-beaxxxxx": now + 4 }
          }
        }
      }
    },
    now
  );
  assert.equal(liveRow.gifts["g-hub"].claimed, false);
  assert.equal(liveRow.gifts["g-hub"].claimedBy["p-beaxxxxx"], now + 4);

  const afterDelete = save.applyAdminFishGiftsChange(
    liveRow,
    { type: "DELETE", old_record: { player_id: "p-beaxxxxx" } },
    now
  );
  assert.equal(afterDelete.gifts["g-hub"].claimedBy["p-beaxxxxx"], now + 4);
});

test("fishing admin gift live rows subscribe without rewriting the shared board", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const gifts = fs.readFileSync(path.resolve(__dirname, "../../hub-fishing-gifts.js"), "utf8");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  const supabase = fs.readFileSync(path.resolve(__dirname, "../../hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../supabase/migrations/202610160026_fishing_gift_contributions_realtime.sql"
    ),
    "utf8"
  );
  assert.match(gifts, /ensureGiftsRealtime/);
  assert.match(script, /ensureFishGiftsRealtime/);
  assert.match(supabase, /function subscribeFishingGiftContributions/);
  assert.match(sql, /alter table public\.fishing_gift_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.fishing_gift_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing aquarium live rows subscribe without rewriting the shared board", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  const supabase = fs.readFileSync(path.resolve(__dirname, "../../hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../supabase/migrations/202610160027_aquarium_tank_contributions_realtime.sql"
    ),
    "utf8"
  );
  assert.match(script, /ensureAquaShareRealtime/);
  assert.match(script, /applyAquaShareRealtime/);
  assert.match(script, /subscribeAquariumTankContributions/);
  assert.match(supabase, /function subscribeAquariumTankContributions/);
  assert.match(sql, /alter table public\.aquarium_tank_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.aquarium_tank_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("fishing community live rows subscribe without rewriting the shared meter", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const script = fs.readFileSync(path.resolve(__dirname, "../../fishing/script.js"), "utf8");
  const supabase = fs.readFileSync(path.resolve(__dirname, "../../hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../supabase/migrations/202610160028_community_cast_contributions_realtime.sql"
    ),
    "utf8"
  );
  assert.match(script, /ensureCommunityRealtime/);
  assert.match(script, /applyCommunityCastRealtime/);
  assert.match(script, /subscribeCommunityCastContributions/);
  assert.match(supabase, /function subscribeCommunityCastContributions/);
  assert.match(sql, /alter table public\.community_cast_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.community_cast_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});
