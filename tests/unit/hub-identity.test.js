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
