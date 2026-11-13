"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
require(path.join(ROOT, "hub-identity.js"));
const names = require(path.join(ROOT, "hub-names.js"));

test("unique nickname claims live outside hub-plays and load before it", () => {
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const boot = fs.readFileSync(path.join(ROOT, "hub-game-boot.js"), "utf8");
  assert.match(plays, /window\.HubNames/);
  assert.match(plays, /namesApi\.mergeNameMaps/);
  assert.match(plays, /namesApi\.TITLE_DEFS/);
  assert.match(plays, /namesApi\.sanitizeColor/);
  assert.match(plays, /namesApi\.extraColorIdsForName/);
  assert.doesNotMatch(plays, /const TITLE_DEFS = \{/);
  assert.match(index, /hub-names\.js/);
  assert.match(boot, /hub-names\.js/);
});

test("player titles and colors live with unique nicknames", () => {
  assert.equal(names.TITLE_DEFS.owner.label, "OWNER");
  assert.equal(names.TITLE_DEFS.master_fisher.className, "player-title-master-fisher");
  assert.equal(names.TITLE_COLORS.legend, "#f1c40f");
  assert.equal(names.TITLE_COLORS.inviter, "#7c3aed");
  assert.equal(names.EXTRA_COLORS.aurora.animated, true);
  assert.equal(names.sanitizeColor("#F1C40F"), "#f1c40f");
  assert.equal(names.sanitizeColor("red"), "");
  assert.equal(names.sanitizeColor("aurora"), "");
  assert.equal(names.contrastText("#f1c40f"), "#1a1a1a");
  assert.equal(names.contrastText("#1c7ed6"), "#ffffff");
  assert.deepEqual(names.extraColorIdsForName("ice_dragon").sort(), ["aurora", "mono", "tide"]);
  assert.deepEqual(names.extraColorIdsForName("hjalte"), ["mono"]);
  assert.deepEqual(names.extraColorIdsForName("oscarvr29").sort(), ["aurora", "tide"]);
  assert.deepEqual(names.extraColorIdsForName(""), []);
  assert.equal(names.isCheesyColor("#f0b429"), true);
  assert.equal(names.isCheesyColor("#1c7ed6"), false);
  assert.deepEqual(names.HUB_POINTS_TITLE_IDS, ["hub1", "hub2", "hub3"]);
  assert.equal(names.COLOR_OPTIONS[1].value, "#1c7ed6");
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

test("owned nickname claims dual-write without stealing another player's name", () => {
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  assert.match(plays, /persistNamesMine/);
  assert.match(plays, /pullNamesMine/);
  assert.match(plays, /persistNicknameClaim/);
  assert.match(plays, /fetchNamesTableRemote/);
  assert.match(plays, /if \(tableResult === true\) return/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchNamesRemote"),
      plays.indexOf("async function pushNamesRemote")
    ),
    /fetchDoc/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function pushNamesRemote"),
      plays.indexOf("function mergeLogs")
    ),
    /pushDoc/
  );
  assert.equal(names.SAVE_KEY, "names-mine");

  const snapshot = names.collectMine(
    {
      playerId: "p-ada",
      name: "Ada",
      claimedAt: 10,
      legend: true,
      legendAt: 20,
      activeTitle: "legend",
      accentColor: "#0ff",
      playerCode: "AB23-CD45"
    },
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(snapshot.key, "ada");
  assert.equal(snapshot.claim.legend, true);
  assert.equal(snapshot.claim.playerCode, "AB23CD45");

  const stolen = names.collectMine(
    { playerId: "p-eve", name: "Ada", claimedAt: 1, legend: true },
    "p-ada"
  );
  assert.equal(stolen.claim, null);

  const restored = names.applyMine({}, snapshot, "p-ada");
  assert.equal(restored.ada.playerId, "p-ada");
  assert.equal(restored.ada.legend, true);

  const keepFirst = names.applyMine(
    { ada: { playerId: "p-bea", name: "Ada", claimedAt: 5 } },
    snapshot,
    "p-ada"
  );
  assert.equal(keepFirst.ada.playerId, "p-bea");

  const richer = names.applyMine(
    {
      ada: {
        playerId: "p-ada",
        name: "Ada",
        claimedAt: 10,
        masterFisher: true,
        activeTitle: "ACE",
        profileUpdatedAt: 50
      }
    },
    snapshot,
    "p-ada"
  );
  assert.equal(richer.ada.legend, true);
  assert.equal(richer.ada.masterFisher, true);
  assert.equal(richer.ada.activeTitle, "ACE");

  const fromRows = names.rowsToNameMap([
    {
      player_id: "p-ada",
      name_key: "ada",
      claim: { playerId: "p-ada", name: "Ada", claimedAt: 10, legend: true }
    },
    {
      player_id: "p-eve",
      name_key: "ada",
      claim: { playerId: "p-bea", name: "Ada", claimedAt: 1 }
    }
  ]);
  assert.equal(fromRows.ada.playerId, "p-ada");
  assert.equal(fromRows.ada.legend, true);
  assert.equal(fromRows.skip, undefined);

  const hidden = names.visibleNameMap(
    {
      ada: { playerId: "p-ada", name: "Ada", playerCode: "ABCD2345", activeTitle: "legend" },
      bea: { playerId: "p-bea", name: "Bea", playerCode: "ZZZZ2345", activeTitle: "og" }
    },
    "p-ada"
  );
  assert.equal(hidden.ada.playerCode, "ABCD2345");
  assert.equal(hidden.ada.activeTitle, "legend");
  assert.equal(hidden.bea.playerCode, undefined);
  assert.equal(hidden.bea.name, "Bea");
  assert.equal(hidden.bea.activeTitle, "og");

  const liveRow = names.applyChange(
    { names: { ada: { playerId: "p-ada", name: "Ada", claimedAt: 10 } } },
    {
      type: "UPDATE",
      new: {
        player_id: "p-cal",
        name_key: "cal",
        claim: { playerId: "p-cal", name: "Cal", claimedAt: 40 }
      }
    },
    [
      {
        player_id: "p-ada",
        name_key: "ada",
        claim: { playerId: "p-ada", name: "Ada", claimedAt: 10 }
      }
    ]
  );
  assert.equal(liveRow.names.ada.playerId, "p-ada");
  assert.equal(liveRow.names.cal.playerId, "p-cal");
  assert.equal(liveRow.rows.length, 2);

  const stolenLive = names.applyChange(
    liveRow,
    {
      type: "UPDATE",
      new: {
        player_id: "p-eve",
        name_key: "ada",
        claim: { playerId: "p-eve", name: "Ada", claimedAt: 99 }
      }
    },
    liveRow.rows
  );
  assert.equal(stolenLive.names.ada.playerId, "p-ada");

  const afterDelete = names.applyChange(
    stolenLive,
    { type: "DELETE", old_record: { player_id: "p-cal" } },
    stolenLive.rows
  );
  assert.equal(afterDelete.names.cal.playerId, "p-cal");
  assert.equal(afterDelete.rows.length, 3);
});

test("nickname live rows subscribe without rewriting the shared name registry", () => {
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160033_nickname_claims_realtime.sql"),
    "utf8"
  );
  assert.match(plays, /ensureNamesRealtime/);
  assert.match(plays, /visibleNameMap/);
  assert.match(plays, /nicknamesAreScoped/);
  assert.match(
    plays.slice(plays.indexOf("function ensureNamesRealtime"), plays.indexOf("function applyAllTimeRealtime")),
    /nicknamesAreScoped/
  );
  assert.match(plays, /applyNamesRealtime/);
  assert.match(plays, /playsLiveJoined\("nickname_claims"\)/);
  assert.match(
    plays.slice(
      plays.indexOf("async function ensureDragonPurged"),
      plays.indexOf("async function ensureRainbowPurged")
    ),
    /playsLiveJoined\("nickname_claims"\)/
  );
  assert.match(plays, /subscribeNicknameClaims/);
  assert.doesNotMatch(
    plays.slice(plays.indexOf("function ensureNamesRealtime"), plays.indexOf("function applyAllTimeRealtime")),
    /subscribeNicknameClaims\(/
  );
  assert.match(
    plays.slice(
      plays.indexOf("async function fetchNamesRemote"),
      plays.indexOf("async function pushNamesRemote")
    ),
    /playsLiveJoined\("nickname_claims"\)/
  );
  assert.match(plays, /getNameRegistry/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("function applyNamesRealtime"),
      plays.indexOf("function stopNamesRealtime")
    ),
    /pushNamesRemote|pushDoc/
  );
  assert.match(supabase, /function subscribeNicknameClaims/);
  assert.match(sql, /alter table public\.nickname_claims replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.nickname_claims/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("nickname remotes skip leftover shared boards", async () => {
  const src = fs.readFileSync(path.join(ROOT, "hub-names.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  assert.doesNotMatch(src, /getPrefer|pushPrefer|fetchDoc|pushDoc|hub_docs/);
  assert.match(plays, /namesApi\.fetchNicknameClaimRows/);
  assert.match(plays, /namesApi\.persistNicknameClaim/);
  assert.match(plays, /namesApi\.persistOwnedMine/);
  assert.match(plays, /namesApi\.readOwnedMine/);
  const calls = [];
  const api = {
    async listNicknameClaims() {
      return [{ player_id: "p-ada", name_key: "ada", claim: { playerId: "p-ada", name: "Ada" } }];
    },
    async upsertNicknameClaim(row) {
      calls.push(row);
    }
  };
  assert.equal((await names.fetchNicknameClaimRows(api)).length, 1);
  assert.equal(
    await names.persistNicknameClaim(api, "p-ada", {
      playerId: "p-ada",
      name: "Ada",
      claimedAt: 9
    }),
    true
  );
  assert.equal(
    await names.pushNicknameClaims(api, "p-ada", {
      ada: { playerId: "p-ada", name: "Ada", claimedAt: 9 }
    }),
    true
  );
  assert.equal(calls.length >= 1, true);
  assert.equal(calls[0].playerId, "p-ada");
});
