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
