"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("release build and changelog metadata stay aligned", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const latestSource = fs.readFileSync(path.join(ROOT, "latest-changelog.js"), "utf8");
  const changelog = JSON.parse(fs.readFileSync(path.join(ROOT, "changelog.json"), "utf8"));

  const indexBuild = /window\.WORDLE_BUILD = "([^"]+)"/.exec(index)?.[1];
  const workerBuild = /const BUILD = "([^"]+)"/.exec(worker)?.[1];
  const latestMatch = /window\.MYGAMES_LATEST_CHANGELOG = (\{[\s\S]*\});\s*$/.exec(latestSource);

  assert.ok(indexBuild, "index build is present");
  assert.equal(workerBuild, indexBuild);
  assert.ok(latestMatch, "latest changelog metadata is parseable");

  const latest = JSON.parse(latestMatch[1]);
  assert.equal(latest.build, indexBuild);
  assert.deepEqual(latest.notes, changelog[indexBuild]);
  assert.ok(Array.isArray(latest.notes) && latest.notes.length > 0);
  assert.equal(Object.keys(changelog)[0], indexBuild);
});
