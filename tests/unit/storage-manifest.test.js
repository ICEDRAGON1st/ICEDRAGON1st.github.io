"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "storage-manifest.json"), "utf8"));

test("storage manifest entries are unique and classified", () => {
  assert.equal(manifest.version, 1);
  assert.ok(manifest.entries.length > 100, "expected a full persisted-key inventory");

  const signatures = new Set();
  for (const entry of manifest.entries) {
    assert.ok(["exact", "pattern"].includes(entry.type));
    assert.ok(entry.value);
    assert.ok(["account", "device", "transient-device"].includes(entry.scope));
    assert.ok(["max", "domain", "latest"].includes(entry.merge));
    assert.ok(Array.isArray(entry.owners) && entry.owners.length > 0);

    const signature = `${entry.type}:${entry.value}`;
    assert.ok(!signatures.has(signature), `duplicate storage entry ${signature}`);
    signatures.add(signature);
  }
});

test("critical account saves remain in the account-scoped inventory", () => {
  const byValue = new Map(manifest.entries.map((entry) => [entry.value, entry]));
  for (const key of [
    "fishing-save-v3",
    "wordle-game",
    "wordle-stats",
    "hub-achievements-v1",
    "hub-coins-v1",
    "hub-coins-v1:*",
    "paper-io-best-pct",
    "cup-flow-best-level",
    "dudes-skin-v1",
    "space-waves-high-score",
    "sticker-garage-save-v1"
  ]) {
    assert.equal(byValue.get(key)?.scope, "account", `${key} must follow the player account`);
  }
});
