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
});

test("owned identity mine restores code and name without reminting a different player id", () => {
  const plays = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../../hub-plays.js"),
    "utf8"
  );
  assert.match(plays, /persistIdentityMine/);
  assert.match(plays, /pullIdentityMine/);
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
  assert.equal(identity.PASSWORD_MINE_KEY, "password-mine");

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
});

test("owned name reservations dual-write without stealing another player's lock", () => {
  const fs = require("node:fs");
  const plays = fs.readFileSync(path.join(__dirname, "../../hub-plays.js"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "../../script.js"), "utf8");
  assert.match(plays, /persistReservationsMine/);
  assert.match(plays, /pullReservationsMine/);
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
});
