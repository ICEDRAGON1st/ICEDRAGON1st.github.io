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
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "build-manifest.json"), "utf8"));

  const indexBuild = /window\.WORDLE_BUILD = "([^"]+)"/.exec(index)?.[1];
  const themeBuild = /href=["']css\/themes\.css\?v=([^"']+)/.exec(index)?.[1];
  const guesswordBuild = /href=["']css\/guessword\.css\?v=([^"']+)/.exec(index)?.[1];
  const hubCssBuild = /href=["']css\/hub\.css\?v=([^"']+)/.exec(index)?.[1];
  const a11yBuild = /src=["']hub-a11y\.js\?v=([^"']+)/.exec(index)?.[1];
  const workerBuild = /const BUILD = "([^"]+)"/.exec(worker)?.[1];
  const latestMatch = /window\.MYGAMES_LATEST_CHANGELOG = (\{[\s\S]*\});\s*$/.exec(latestSource);

  assert.ok(indexBuild, "index build is present");
  assert.equal(indexBuild, manifest.build);
  assert.equal(themeBuild, indexBuild);
  assert.equal(guesswordBuild, indexBuild);
  assert.equal(hubCssBuild, indexBuild);
  assert.equal(a11yBuild, indexBuild);
  assert.equal(workerBuild, indexBuild);
  assert.ok(latestMatch, "latest changelog metadata is parseable");

  const latest = JSON.parse(latestMatch[1]);
  assert.equal(latest.build, indexBuild);
  assert.deepEqual(latest.notes, changelog[indexBuild]);
  assert.ok(Array.isArray(latest.notes) && latest.notes.length > 0);
  assert.equal(Object.keys(changelog)[0], indexBuild);
  assert.match(worker, /event\.data\?\.type === "SKIP_WAITING"/);
});

test("service worker install only precaches the offline hub shell", () => {
  const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const precacheMatch = /const PRECACHE = (\[[\s\S]*?\]);/.exec(worker);
  assert.ok(precacheMatch, "service worker precache is parseable");

  const precache = JSON.parse(precacheMatch[1].replaceAll("'", '"'));
  const requiredShell = [
    "./",
    "./index.html",
    "./css/themes.css",
    "./css/guessword.css",
    "./css/hub.css",
    "./site-config.js",
    "./latest-changelog.js",
    "./hub-net.js",
    "./hub-afk.js",
    "./hub-a11y.js",
    "./hub-account-bag.js",
    "./script.js"
  ];

  for (const asset of requiredShell) {
    assert.ok(precache.includes(asset), `${asset} remains available in the offline shell`);
  }
  assert.ok(precache.length <= 23, "worker install stays within the shell asset budget");
  assert.equal(
    precache.some((asset) =>
      /(?:dictionary|words(?:-|\.js)|hub-(?:chat|calls|help|admin))/.test(asset)
    ),
    false,
    "large dictionaries and optional products load and cache only when requested"
  );
});
