"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const a11y = require(path.resolve(__dirname, "../../hub-a11y.js"));

test("hub dialogs wrap Tab at the first and last control", () => {
  const items = ["first", "middle", "last"];
  assert.equal(a11y.nextFocus(items, "last", false), "first");
  assert.equal(a11y.nextFocus(items, "first", true), "last");
  assert.equal(a11y.nextFocus(items, "middle", false), "last");
  assert.equal(a11y.nextFocus([], "first", false), null);
  assert.equal(a11y.nextFocus(items, "missing", false), "first");
  assert.ok(a11y.DIALOG_IDS.includes("whats-new-modal"));
  assert.ok(a11y.DIALOG_IDS.includes("player-name-modal"));
  assert.equal(a11y.DIALOG_IDS.includes("games-screen"), false);
});
