"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

function effectiveBgmVolumeFrom(state) {
  if (state?.callDucked || state?.muted) return 0;
  return Math.max(0, Math.min(1, Number(state?.volume) || 0));
}

test("call duck silences music without treating it as a saved mute", () => {
  assert.equal(effectiveBgmVolumeFrom({ volume: 0.8, muted: false, callDucked: true }), 0);
  assert.equal(effectiveBgmVolumeFrom({ volume: 0.8, muted: false, callDucked: false }), 0.8);
  assert.equal(effectiveBgmVolumeFrom({ volume: 0.8, muted: true, callDucked: false }), 0);

  const audio = fs.readFileSync(path.join(ROOT, "hub-audio.js"), "utf8");
  assert.match(audio, /function duckForCall/);
  assert.match(audio, /function unduckForCall/);
  assert.match(audio, /if \(state\?\.callDucked \|\| state\?\.muted\) return 0/);
  assert.doesNotMatch(audio, /function duckForCall\(\) \{[\s\S]{0,180}persist\(/);
});

test("voice calls duck hub music on start and restore it on hang up", () => {
  const calls = fs.readFileSync(path.join(ROOT, "hub-calls.js"), "utf8");
  assert.match(calls, /HubAudio\?\.duckForCall/);
  assert.match(calls, /HubAudio\?\.unduckForCall/);
  const hangUp = calls.slice(
    calls.indexOf("async function hangUp"),
    calls.indexOf("function toggleMute")
  );
  assert.match(hangUp, /unduckForCall/);
});
