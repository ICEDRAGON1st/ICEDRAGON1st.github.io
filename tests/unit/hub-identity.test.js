"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const identity = require(path.resolve(__dirname, "../../hub-identity.js"));

test("hub identity sanitizes names and rejects poison player codes", () => {
  assert.equal(identity.sanitizeName("  Ice <Dragon>  "), "Ice Dragon");
  assert.equal(identity.sanitizeName("undefined"), "");
  assert.equal(identity.sanitizeName("null"), "");
  assert.equal(identity.nameKey("Ice Dragon"), "ice dragon");

  assert.equal(identity.normalizePlayerCode("ab-cd ef23"), "ABCDEF23");
  assert.equal(identity.normalizePlayerCode("AB23-CD45"), "AB23CD45");
  assert.equal(identity.formatPlayerCode("AB23CD45"), "AB23-CD45");
  assert.equal(identity.formatPlayerCode("undefined"), "");
  assert.equal(identity.isPoisonPlayerCode("UNDEFNED"), true);
  assert.equal(identity.isPoisonPlayerCode(""), false);
  assert.equal(identity.looksLikePlayerCode("AB23-CD45"), true);
  assert.equal(identity.looksLikePlayerCode("swordfish"), false);
  assert.equal(identity.looksLikePlayerCode("MG1:secret"), false);

  const hashed = identity.hashToCodeParts("player-1", "salt");
  assert.equal(hashed.length, 8);
  assert.equal(identity.hashToCodeParts("player-1", "salt"), hashed);
  assert.notEqual(identity.hashToCodeParts("player-1", "other"), hashed);
});

test("account transfer keys and player-code maps keep the first owner", () => {
  const plays = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../hub-plays.js"),
    "utf8"
  );
  assert.match(plays, /identity\.parseAccountTransferKey/);
  assert.match(plays, /identity\.parseCodesMap/);
  assert.match(plays, /identity\.reservationAllows/);
  const ui = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../script.js"),
    "utf8"
  );
  const transfer = ui.slice(
    ui.indexOf("player-code-transfer-btn"),
    ui.indexOf("player-code-restore-btn")
  );
  assert.match(transfer, /Couldn't copy transfer key/);
  assert.doesNotMatch(transfer, /setPlayerCodeStatus\(key/);
  const invite = ui.slice(
    ui.indexOf("player-invite-copy-btn"),
    ui.indexOf("hub-invite-credited")
  );
  assert.match(invite, /Couldn't copy invite link/);
  assert.doesNotMatch(invite, /setPlayerCodeStatus\(url/);

  const key = identity.formatAccountTransferKey("AB23-CD45", "p-ada", "Ada");
  assert.equal(key, "MG1:AB23CD45:p-ada:Ada");
  assert.deepEqual(identity.parseAccountTransferKey(key), {
    code: "AB23CD45",
    playerId: "p-ada",
    name: "Ada"
  });
  assert.equal(identity.parseAccountTransferKey("AB23-CD45"), null);
  assert.equal(identity.parseAccountTransferKey("MG1:UNDEFNED:p-ada:Ada"), null);

  const codes = identity.parseCodesMap({
    codes: {
      "ab23-cd45": { playerId: "p-ada", name: "Ada", at: 9 },
      UNDEFNED: { playerId: "p-bad", name: "Bad", at: 1 },
      skip: { name: "no id" }
    }
  });
  assert.equal(codes.AB23CD45.playerId, "p-ada");
  assert.equal(codes.UNDEFNED, undefined);
  assert.equal(codes.skip, undefined);

  assert.equal(identity.reservationAllows(null, "p-ada", "AB23CD45"), true);
  assert.equal(
    identity.reservationAllows({ playerId: "p-ada", code: "AB23CD45" }, "p-ada", "ZZ99YY88"),
    true
  );
  assert.equal(
    identity.reservationAllows({ playerId: "p-bea", code: "AB23CD45" }, "p-ada", "ZZ99YY88"),
    false
  );
  assert.equal(
    identity.reservationAllows({ playerId: "p-bea", code: "AB23CD45" }, "p-ada", "AB23-CD45"),
    true
  );

  const fromRows = identity.rowsToCodesMap([
    {
      player_id: "p-ada",
      code: "AB23CD45",
      display_name: "Ada",
      claimed_at: "2023-11-14T22:13:20.000Z"
    },
    { player_id: "p-bea", code: "UNDEFNED", display_name: "Bad" },
    { player_id: "", code: "ZZ99YY88", display_name: "Skip" }
  ]);
  assert.equal(fromRows.AB23CD45.playerId, "p-ada");
  assert.equal(fromRows.UNDEFNED, undefined);
  assert.equal(fromRows.ZZ99YY88, undefined);

  const merged = identity.mergeCodesMaps(
    { AB23CD45: { playerId: "p-ada", name: "Ada", at: 10 } },
    {
      AB23CD45: { playerId: "p-bea", name: "Bea", at: 1 },
      CD45AB23: { playerId: "p-bea", name: "Bea", at: 2 }
    }
  );
  assert.equal(merged.AB23CD45.playerId, "p-ada");
  assert.equal(merged.CD45AB23.playerId, "p-bea");

  const liveCode = identity.applyCodeChange(
    { codes: { AB23CD45: { playerId: "p-ada", name: "Ada", at: 10 } } },
    {
      type: "UPDATE",
      new: {
        player_id: "p-cal",
        code: "CD45AB23",
        display_name: "Cal",
        claimed_at: "2023-11-14T22:13:20.000Z"
      }
    },
    [
      {
        player_id: "p-ada",
        code: "AB23CD45",
        display_name: "Ada",
        claimed_at: "2023-11-14T22:13:20.000Z"
      }
    ]
  );
  assert.equal(liveCode.codes.AB23CD45.playerId, "p-ada");
  assert.equal(liveCode.codes.CD45AB23.playerId, "p-cal");
  assert.equal(liveCode.rows.length, 2);

  const stolenCode = identity.applyCodeChange(
    liveCode,
    {
      type: "UPDATE",
      new: {
        player_id: "p-eve",
        code: "AB23CD45",
        display_name: "Eve",
        claimed_at: "2023-11-14T22:13:20.000Z"
      }
    },
    liveCode.rows
  );
  assert.equal(stolenCode.codes.AB23CD45.playerId, "p-ada");

  const afterCodeDelete = identity.applyCodeChange(
    stolenCode,
    { type: "DELETE", old_record: { player_id: "p-cal" } },
    stolenCode.rows
  );
  assert.equal(afterCodeDelete.codes.CD45AB23.playerId, "p-cal");
  assert.equal(afterCodeDelete.rows.length, 3);
});

test("player-code live rows subscribe without rewriting the shared code document", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ROOT = path.join(__dirname, "../..");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160035_player_code_claims_realtime.sql"),
    "utf8"
  );
  assert.match(plays, /ensureCodesRealtime/);
  assert.match(plays, /applyCodesRealtime/);
  assert.match(plays, /playsLiveJoined\("player_code_claims"\)/);
  assert.match(plays, /subscribePlayerCodeClaims/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("function applyCodesRealtime"),
      plays.indexOf("function stopCodesRealtime")
    ),
    /pushCodesRemote|pushDoc/
  );
  assert.match(supabase, /function subscribePlayerCodeClaims/);
  assert.match(sql, /alter table public\.player_code_claims replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.player_code_claims/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("owned identity mine restores code and name without reminting a different player id", () => {
  const plays = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../hub-plays.js"),
    "utf8"
  );
  assert.match(plays, /persistIdentityMine/);
  assert.match(plays, /pullIdentityMine/);
  assert.match(plays, /persistPlayerCodeClaim/);
  assert.match(plays, /fetchCodesTableRemote/);
  assert.match(plays, /if \(!tableWrote\) throw new Error\("codes-unavailable"\)/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchCodesRemote"),
      plays.indexOf("async function persistPlayerCodeClaim")
    ),
    /fetchDoc/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function ensurePlayerCodeRegistered"),
      plays.indexOf("async function restoreWithPlayerCode")
    ),
    /pushDoc|pushCodesRemote/
  );
  assert.equal(identity.IDENTITY_MINE_KEY, "identity-mine");

  const snapshot = identity.collectIdentityMine(
    { code: "AB23-CD45", name: "Ada", locked: true },
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(snapshot.code, "AB23CD45");
  assert.equal(snapshot.name, "Ada");
  assert.equal(snapshot.locked, true);

  const poison = identity.collectIdentityMine(
    { code: "UNDEFNED", name: "undefined", locked: false },
    "p-ada"
  );
  assert.equal(poison.code, "");
  assert.equal(poison.name, "");

  const restored = identity.applyIdentityMine(
    { playerId: "p-ada", code: "", name: "", locked: false },
    snapshot
  );
  assert.equal(restored.playerId, "p-ada");
  assert.equal(restored.code, "AB23CD45");
  assert.equal(restored.name, "Ada");
  assert.equal(restored.locked, true);

  const keepLocal = identity.applyIdentityMine(
    { playerId: "p-ada", code: "ZZ99YY88", name: "LocalAda", locked: false },
    snapshot
  );
  assert.equal(keepLocal.code, "ZZ99YY88");
  assert.equal(keepLocal.name, "LocalAda");
  assert.equal(keepLocal.locked, true);

  const otherAccount = identity.applyIdentityMine(
    { playerId: "p-bea", code: "", name: "", locked: false },
    snapshot
  );
  assert.equal(otherAccount.playerId, "p-bea");
  assert.equal(otherAccount.code, "");
  assert.equal(otherAccount.name, "");
});

test("owned password hashes dual-write without plaintext or other players' logins", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  assert.match(plays, /persistPasswordMine/);
  assert.match(plays, /pullPasswordMine/);
  assert.match(plays, /persistPlayerPasswordHash/);
  assert.match(plays, /fetchPasswordsTableRemote/);
  assert.match(plays, /if \(tableWrote\) return/);
  assert.match(
    plays.slice(
      plays.indexOf("async function fetchPasswordsRemote"),
      plays.indexOf("async function pushPasswordsRemote")
    ),
    /if \(!tableRows\) throw/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchPasswordsRemote"),
      plays.indexOf("async function pushPasswordsRemote")
    ),
    /fetchDoc/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function pushPasswordsRemote"),
      plays.indexOf("function markVaultHasPassword")
    ),
    /pushDoc/
  );
  assert.equal(identity.PASSWORD_MINE_KEY, "password-mine");
  assert.match(plays, /upgradeAnonymousPassword/);
  assert.match(plays, /signInWithPasswordAccount/);
  assert.doesNotMatch(plays, /password: "secret"/);

  const adaHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const oldHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const beaHash = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const snapshot = identity.collectPasswordMine(
    {
      [adaHash]: {
        playerId: "p-ada",
        code: "AB23-CD45",
        name: "Ada",
        at: 20,
        password: "secret"
      },
      swordfish: { playerId: "p-ada", code: "AB23CD45", name: "Ada", at: 1 },
      [beaHash]: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", at: 9 }
    },
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(snapshot.cleared, false);
  assert.equal(Object.keys(snapshot.hashes).length, 1);
  assert.equal(snapshot.hashes[adaHash].playerId, "p-ada");
  assert.equal(snapshot.hashes[adaHash].code, "AB23CD45");
  assert.equal(snapshot.hashes[adaHash].password, undefined);
  assert.equal(snapshot.hashes[beaHash], undefined);
  assert.equal(snapshot.hashes.swordfish, undefined);

  const restored = identity.applyPasswordMine({}, snapshot, "p-ada");
  assert.equal(restored[adaHash].playerId, "p-ada");
  assert.equal(Object.keys(restored).length, 1);

  const richer = identity.applyPasswordMine(
    {
      [oldHash]: { playerId: "p-ada", code: "AB23CD45", name: "Ada", at: 1 },
      [beaHash]: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", at: 9 }
    },
    snapshot,
    "p-ada"
  );
  assert.equal(richer[adaHash].playerId, "p-ada");
  assert.equal(richer[oldHash], undefined);
  assert.equal(richer[beaHash].playerId, "p-bea");

  const blocked = identity.applyPasswordMine(
    { [beaHash]: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", at: 9 } },
    snapshot,
    "p-bea"
  );
  assert.equal(blocked[adaHash], undefined);
  assert.equal(blocked[beaHash].playerId, "p-bea");

  const cleared = identity.applyPasswordMine(
    {
      [adaHash]: { playerId: "p-ada", code: "AB23CD45", name: "Ada", at: 20 },
      [beaHash]: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", at: 9 }
    },
    identity.collectPasswordMine({}, "p-ada", { cleared: true }),
    "p-ada"
  );
  assert.equal(cleared[adaHash], undefined);
  assert.equal(cleared[beaHash].playerId, "p-bea");

  const fromRows = identity.rowsToPasswordMap([
    {
      player_id: "p-ada",
      password_hash: adaHash,
      code: "AB23CD45",
      display_name: "Ada",
      hashed_at: "2023-11-14T22:13:20.000Z"
    },
    {
      player_id: "p-bea",
      password_hash: beaHash,
      code: "ZZ99YY88",
      display_name: "Bea",
      cleared: true
    },
    { player_id: "p-ada", password_hash: "swordfish", display_name: "Skip" }
  ]);
  assert.equal(fromRows[adaHash].playerId, "p-ada");
  assert.equal(fromRows[adaHash].password, undefined);
  assert.equal(fromRows[beaHash], undefined);
  assert.equal(fromRows.swordfish, undefined);

  const overlaid = identity.overlayPasswordMaps(
    {
      [oldHash]: { playerId: "p-ada", code: "AB23CD45", name: "Ada", at: 1 },
      [beaHash]: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", at: 9 }
    },
    [
      {
        player_id: "p-ada",
        password_hash: adaHash,
        code: "AB23CD45",
        display_name: "Ada",
        hashed_at: "2023-11-14T22:13:20.000Z"
      }
    ]
  );
  assert.equal(overlaid[adaHash].playerId, "p-ada");
  assert.equal(overlaid[oldHash], undefined);
  assert.equal(overlaid[beaHash].playerId, "p-bea");

  const clearedOverlay = identity.overlayPasswordMaps(
    {
      [adaHash]: { playerId: "p-ada", code: "AB23CD45", name: "Ada", at: 20 },
      [beaHash]: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", at: 9 }
    },
    [{ player_id: "p-ada", password_hash: null, cleared: true }]
  );
  assert.equal(clearedOverlay[adaHash], undefined);
  assert.equal(clearedOverlay[beaHash].playerId, "p-bea");
});

test("owned name reservations dual-write without stealing another player's lock", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "../../script.js"), "utf8");
  assert.match(plays, /persistReservationsMine/);
  assert.match(plays, /pullReservationsMine/);
  assert.match(plays, /persistNameReservationLock/);
  assert.match(plays, /fetchReservationsTableRemote/);
  assert.match(plays, /if \(tableWrote\) return/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function fetchReservationsRemote"),
      plays.indexOf("async function pushReservationsRemote")
    ),
    /fetchDoc/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function pushReservationsRemote"),
      plays.indexOf("function reservationAllows")
    ),
    /pushDoc/
  );
  assert.equal(identity.RESERVATIONS_MINE_KEY, "reservations-mine");
  assert.doesNotMatch(script, /Copied \$\{code\}/);
  assert.doesNotMatch(script, /Your code is \$\{code\}/);
  assert.match(script, /Copied your player code — keep it private/);

  const snapshot = identity.collectReservationsMine(
    {
      ice_dragon: { playerId: "p-ada", code: "AB23-CD45", name: "ICE_DRAGON", lockedAt: 20 },
      bea: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", lockedAt: 9 }
    },
    "p-ada"
  );
  assert.equal(snapshot.playerId, "p-ada");
  assert.equal(Object.keys(snapshot.reservations).length, 1);
  assert.equal(snapshot.reservations.ice_dragon.playerId, "p-ada");
  assert.equal(snapshot.reservations.ice_dragon.code, "AB23CD45");
  assert.equal(snapshot.reservations.bea, undefined);

  const restored = identity.applyReservationsMine({}, snapshot, "p-ada");
  assert.equal(restored.ice_dragon.playerId, "p-ada");
  assert.equal(Object.keys(restored).length, 1);

  const richer = identity.applyReservationsMine(
    {
      ice_dragon: { playerId: "p-ada", code: "AB23CD45", name: "ICE_DRAGON", lockedAt: 50 },
      bea: { playerId: "p-bea", code: "ZZ99YY88", name: "Bea", lockedAt: 9 }
    },
    snapshot,
    "p-ada"
  );
  assert.equal(richer.ice_dragon.lockedAt, 20);
  assert.equal(richer.bea.playerId, "p-bea");
  assert.equal(Object.keys(richer).length, 2);

  const blocked = identity.applyReservationsMine(
    { ice_dragon: { playerId: "p-bea", code: "ZZ99YY88", name: "ICE_DRAGON", lockedAt: 1 } },
    snapshot,
    "p-ada"
  );
  assert.equal(blocked.ice_dragon.playerId, "p-bea");

  const fromRows = identity.rowsToReservationsMap([
    {
      player_id: "p-ada",
      name_key: "ice_dragon",
      code: "AB23CD45",
      display_name: "ICE_DRAGON",
      locked_at: "2023-11-14T22:13:20.000Z"
    },
    { player_id: "p-bea", name_key: "bea", code: "UNDEFNED", display_name: "Bea" }
  ]);
  assert.equal(fromRows.ice_dragon.playerId, "p-ada");
  assert.equal(fromRows.ice_dragon.code, "AB23CD45");
  assert.equal(fromRows.bea, undefined);

  const liveLock = identity.applyReservationChange(
    {
      reservations: {
        ice_dragon: { playerId: "p-ada", code: "AB23CD45", name: "ICE_DRAGON", lockedAt: 20 }
      }
    },
    {
      type: "UPDATE",
      new: {
        player_id: "p-cal",
        name_key: "cal",
        code: "CD45AB23",
        display_name: "Cal",
        locked_at: "2023-11-14T22:13:20.000Z"
      }
    },
    [
      {
        player_id: "p-ada",
        name_key: "ice_dragon",
        code: "AB23CD45",
        display_name: "ICE_DRAGON",
        locked_at: "2023-11-14T22:13:20.000Z"
      }
    ]
  );
  assert.equal(liveLock.reservations.ice_dragon.playerId, "p-ada");
  assert.equal(liveLock.reservations.cal.playerId, "p-cal");
  assert.equal(liveLock.rows.length, 2);

  const stolenLock = identity.applyReservationChange(
    liveLock,
    {
      type: "UPDATE",
      new: {
        player_id: "p-eve",
        name_key: "ice_dragon",
        code: "ZZ99YY88",
        display_name: "Eve",
        locked_at: "2023-11-14T22:13:20.000Z"
      }
    },
    liveLock.rows
  );
  assert.equal(stolenLock.reservations.ice_dragon.playerId, "p-ada");

  const afterLockDelete = identity.applyReservationChange(
    stolenLock,
    { type: "DELETE", old_record: { player_id: "p-cal" } },
    stolenLock.rows
  );
  assert.equal(afterLockDelete.reservations.cal.playerId, "p-cal");
  assert.equal(afterLockDelete.rows.length, 3);
});

test("name-reservation live rows subscribe without rewriting the shared lock document", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ROOT = path.join(__dirname, "../..");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160036_name_reservation_locks_realtime.sql"),
    "utf8"
  );
  assert.match(plays, /ensureReservationsRealtime/);
  assert.match(plays, /applyReservationsRealtime/);
  assert.match(plays, /subscribeNameReservationLocks/);
  assert.match(plays, /playsLiveJoined\("name_reservation_locks"\)/);
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("function applyReservationsRealtime"),
      plays.indexOf("function stopReservationsRealtime")
    ),
    /pushReservationsRemote|pushDoc/
  );
  assert.match(supabase, /function subscribeNameReservationLocks/);
  assert.match(sql, /alter table public\.name_reservation_locks replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.name_reservation_locks/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("device account vault keeps existing player ids and drops poison codes", () => {
  function memStore(initial) {
    const data = { "hub-accounts-v1": JSON.stringify(initial) };
    return {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem(key, value) {
        data[key] = String(value);
      }
    };
  }

  const store = memStore([
    { code: "AB23-CD45", playerId: "p-ada", name: "Ada", savedAt: 9, hasPassword: true },
    { code: "UNDEFNED", playerId: "p-bad", name: "Bad", savedAt: 8 },
    { code: "ZZ99YY88", name: "no id", savedAt: 7 }
  ]);
  const loaded = identity.readSavedAccounts(store);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].playerId, "p-ada");
  assert.equal(loaded[0].code, "AB23-CD45");
  assert.equal(identity.cleanSavedAccount({ code: "AB23CD45" }), null);

  const remembered = identity.rememberSavedAccount(
    { code: "zz99-yy88", playerId: "p-bea", name: "Bea", hasPassword: false },
    loaded
  );
  assert.equal(remembered[0].playerId, "p-bea");
  assert.equal(remembered[1].playerId, "p-ada");
  const noMint = identity.rememberSavedAccount({ code: "AB23CD45", name: "steal" }, remembered);
  assert.equal(noMint.length, 2);
  assert.equal(noMint.find((row) => row.playerId === "p-ada").name, "Ada");
  assert.equal(identity.removeSavedAccount("ZZ99-YY88", remembered).length, 1);
  assert.equal(identity.removeSavedAccount("ZZ99-YY88", remembered)[0].playerId, "p-ada");

  const plays = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../hub-plays.js"),
    "utf8"
  );
  assert.match(plays, /identity\.readSavedAccounts/);
  assert.match(plays, /identity\.writeSavedAccounts/);
  assert.match(plays, /identity\.rememberSavedAccount/);
  assert.match(plays, /identity\.removeSavedAccount/);
  assert.doesNotMatch(plays, /const ACCOUNTS_KEY = "hub-accounts-v1"/);
});

test("identity mints a player id only for new guests and hashes passwords without plaintext", async () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  const id = identity.mintPlayerId();
  assert.match(id, /^p-[a-z0-9][a-z0-9-]{6,80}$/);
  assert.notEqual(identity.mintPlayerId(), id);
  const hash = await identity.hashPassword("swordfish-test");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash.includes("swordfish"), false);
  assert.equal(await identity.hashPassword("swordfish-test"), hash);
  assert.equal(await identity.hashPassword("  swordfish-test  "), hash);
  assert.equal(await identity.hashPassword(""), "");
  assert.match(plays, /identity\.mintPlayerId/);
  assert.match(plays, /identity\.mintGuestAccount/);
  assert.match(plays, /identity\.hashPassword/);
  assert.doesNotMatch(plays, /MantleDB/);
  const guest = identity.mintGuestAccount();
  assert.match(guest.playerId, /^p-[a-z0-9][a-z0-9-]{6,80}$/);
  assert.match(guest.code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  assert.notEqual(identity.mintGuestAccount().playerId, guest.playerId);
  assert.match(
    plays.slice(
      plays.indexOf("async function createNewAccount"),
      plays.indexOf("async function fetchCodesRemote")
    ),
    /identity\.mintGuestAccount/
  );
  assert.doesNotMatch(
    plays.slice(
      plays.indexOf("async function restoreWithPlayerCode"),
      plays.indexOf("let sessionName")
    ),
    /mintPlayerId|playerIdForOfflineCode/
  );
  assert.doesNotMatch(plays, /playerIdForOfflineCode/);
  assert.match(plays, /identity\.resolveRestoreEntry/);
  const vaultHit = { playerId: "p-ada", name: "Ada", savedAt: 9, code: "AB23CD45" };
  const remote = { AB23CD45: { playerId: "p-other", name: "Other", at: 1 } };
  const fromVault = identity.resolveRestoreEntry({
    localHit: vaultHit,
    remote,
    norm: "AB23CD45"
  });
  assert.equal(fromVault.playerId, "p-ada");
  assert.equal(fromVault.name, "Ada");
  const fromTransfer = identity.resolveRestoreEntry({
    transfer: { playerId: "p-bea", name: "Bea", code: "ZZ99YY88" },
    localHit: vaultHit,
    remote,
    norm: "ZZ99YY88"
  });
  assert.equal(fromTransfer.playerId, "p-bea");
  assert.equal(fromTransfer.name, "Bea");
  assert.equal(
    identity.resolveRestoreEntry({
      remote,
      norm: "AB23CD45"
    }).playerId,
    "p-other"
  );
  assert.equal(identity.resolveRestoreEntry({ norm: "AB23CD45" }), null);
});

test("identity password, code, and reservation remotes skip leftover shared boards", async () => {
  const fs = require("node:fs");
  const identitySrc = fs.readFileSync(path.join(__dirname, "../../hub-identity.js"), "utf8");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  assert.doesNotMatch(identitySrc, /getPrefer|pushPrefer|fetchDoc|pushDoc|hub_docs/);
  assert.match(plays, /identity\.fetchPasswordHashRows/);
  assert.match(plays, /identity\.pushPasswordHashes/);
  assert.match(plays, /identity\.fetchCodeClaimRows/);
  assert.match(plays, /identity\.fetchReservationLockRows/);
  assert.match(plays, /identity\.persistPlayerCodeClaim/);
  assert.match(plays, /identity\.persistNameReservationLock/);

  const adaHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const calls = [];
  const api = {
    async listPlayerPasswordHashes() {
      return [
        {
          player_id: "p-ada",
          password_hash: adaHash,
          player_code: "AB23CD45",
          display_name: "Ada",
          hashed_at: 9
        }
      ];
    },
    async upsertPlayerPasswordHash(row) {
      calls.push(["pw", row]);
    },
    async listPlayerCodeClaims() {
      return [{ player_id: "p-ada", code: "AB23CD45", display_name: "Ada" }];
    },
    async upsertPlayerCodeClaim(row) {
      calls.push(["code", row]);
    },
    async listNameReservationLocks() {
      return [];
    },
    async upsertNameReservationLock(row) {
      calls.push(["lock", row]);
    }
  };

  const hashes = await identity.fetchPasswordHashRows(api);
  assert.equal(Array.isArray(hashes), true);
  assert.equal(hashes.length, 1);
  assert.equal(
    await identity.persistPlayerPasswordHash(api, "p-ada", adaHash, {
      playerId: "p-ada",
      code: "AB23CD45",
      name: "Ada",
      at: 9
    }),
    true
  );
  assert.equal(
    await identity.pushPasswordHashes(api, "p-ada", {
      [adaHash]: { playerId: "p-ada", code: "AB23CD45", name: "Ada", at: 9 }
    }),
    true
  );
  assert.equal((await identity.fetchCodeClaimRows(api)).length, 1);
  assert.equal(await identity.persistPlayerCodeClaim(api, "p-ada", "AB23CD45", "Ada"), true);
  assert.equal(await identity.fetchReservationLockRows(api).then((rows) => rows.length), 0);
  assert.equal(
    await identity.persistNameReservationLock(api, "p-ada", "ada", {
      playerId: "p-ada",
      code: "AB23CD45",
      name: "Ada",
      lockedAt: 9
    }),
    true
  );
  assert.equal(calls.some((row) => row[0] === "pw"), true);
  assert.equal(calls.some((row) => row[0] === "code"), true);
  assert.equal(calls.some((row) => row[0] === "lock"), true);

  const takenApi = {
    async upsertPlayerPasswordHash() {
      const err = new Error("taken");
      err.hashTaken = true;
      throw err;
    }
  };
  assert.equal(
    await identity.persistPlayerPasswordHash(takenApi, "p-ada", adaHash, {
      playerId: "p-ada",
      code: "AB23CD45",
      name: "Ada",
      at: 9
    }),
    "taken"
  );
});

test("owned signed-in backups skip leftover shared boards", async () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  const leaderboard = fs.readFileSync(path.join(__dirname, "../../hub-leaderboard.js"), "utf8");
  const feedback = fs.readFileSync(path.join(__dirname, "../../hub-feedback.js"), "utf8");
  const friends = fs.readFileSync(path.join(__dirname, "../../hub-friends.js"), "utf8");
  const chat = fs.readFileSync(path.join(__dirname, "../../hub-chat.js"), "utf8");
  const callUi = fs.readFileSync(path.join(__dirname, "../../hub-calls.js"), "utf8");
  const match = fs.readFileSync(path.join(__dirname, "../../hub-online-match.js"), "utf8");
  const referrals = fs.readFileSync(path.join(__dirname, "../../hub-referrals.js"), "utf8");
  const notes = fs.readFileSync(path.join(__dirname, "../../hub-notifications.js"), "utf8");
  const bags = fs.readFileSync(path.join(__dirname, "../../hub-account-bag.js"), "utf8");
  assert.match(plays, /identity\.persistIdentityOwned/);
  assert.match(plays, /identity\.readIdentityOwned/);
  assert.match(plays, /identity\.persistPasswordOwned/);
  assert.match(plays, /identity\.readPasswordOwned/);
  assert.match(plays, /identity\.persistReservationsOwned/);
  assert.match(plays, /identity\.readReservationsOwned/);
  assert.match(leaderboard, /identity\?\.persistOwnedSave/);
  assert.match(leaderboard, /listLeaderboardPbContributions/);
  assert.doesNotMatch(
    leaderboard.slice(leaderboard.indexOf("function supabaseReady"), leaderboard.indexOf("try {")),
    /getDoc|upsertDoc/
  );
  assert.match(feedback, /identity\?\.persistOwnedSave/);
  assert.match(friends, /identity\?\.persistOwnedSave/);
  assert.match(chat, /identity\?\.persistOwnedSave/);
  assert.match(callUi, /identity\?\.persistOwnedSave/);
  assert.match(match, /identity\?\.persistOwnedSave/);
  assert.match(referrals, /identity\?\.persistOwnedSave/);
  assert.match(notes, /identity\?\.persistOwnedSave/);
  assert.match(bags, /identity\?\.persistOwnedSave/);
  const mineSrc = plays.slice(
    plays.indexOf("async function persistPlaysMine"),
    plays.indexOf("function normalizePasswordInput")
  );
  assert.doesNotMatch(mineSrc, /api\.upsertSave|api\.getSave/);
  assert.doesNotMatch(mineSrc, /getPrefer|pushPrefer|fetchDoc|pushDoc|hub_docs/);

  const calls = [];
  const api = {
    async upsertSave(key, snapshot, rev) {
      calls.push(["put", key, snapshot, rev]);
    },
    async getSave(key) {
      calls.push(["get", key]);
      return { playerId: "p-ada" };
    }
  };
  assert.equal(await identity.persistOwnedSave(api, "plays-mine", { plays: [] }), true);
  assert.deepEqual(await identity.readOwnedSave(api, "plays-mine"), { playerId: "p-ada" });
  assert.equal(await identity.persistOwnedSave(api, "", { plays: [] }), false);
  assert.equal(await identity.readOwnedSave({}, "plays-mine"), null);
  assert.equal(calls[0][0], "put");
  assert.equal(calls[0][1], "plays-mine");
  assert.equal(calls[1][0], "get");
});
