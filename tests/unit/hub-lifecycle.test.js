"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

const ACTION_GAMES = [
  "snake/script.js",
  "space-shooter/script.js",
  "wing-hop/script.js",
  "breakout/script.js",
  "pixel-drop/script.js",
  "stacker/script.js",
  "cross-walk/script.js",
  "runosaur/script.js",
  "ramp-rush/rr-bg-ak.js",
  "space-waves/script.js",
  "dudes/script.js"
];

test("action games pause when the tab is hidden", () => {
  const boot = fs.readFileSync(path.join(ROOT, "hub-game-boot.js"), "utf8");
  const afk = fs.readFileSync(path.join(ROOT, "hub-afk.js"), "utf8");
  assert.match(boot, /window\.HubLifecycle/);
  assert.match(boot, /_q/);
  assert.match(afk, /window\.HubLifecycle/);
  assert.match(afk, /onHiddenPause/);
  assert.match(afk, /queuedHiddenPause/);
  assert.match(afk, /runHiddenPauseHooks/);
  assert.match(afk, /pagehide/);
  assert.match(afk, /visibilitychange/);

  for (const relative of ACTION_GAMES) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.match(
      text,
      /HubLifecycle\?\.onHiddenPause/,
      `${relative} should pause in the background`
    );
  }
});
