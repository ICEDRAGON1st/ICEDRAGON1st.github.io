"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

test("desktop shell keep-alive refresh and allowlist stay aligned", () => {
  const main = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8");
  const hub = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const supabaseUrl = /const SUPABASE_URL = "([^"]+)"/.exec(hub)?.[1];
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "";

  assert.ok(supabaseHost, "hub supabase host is present");
  assert.match(main, /icedragon1st\.github\.io/);
  assert.match(main, new RegExp(supabaseHost.replaceAll(".", "\\.")));
  assert.doesNotMatch(main, /clkamsflzyvdcepvelks/);
  assert.match(main, /reloadIgnoringCache\(\)/);
  assert.match(main, /webContents\.reload\(\)/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
});

test("browser clients no longer target the retired Supabase hostname", () => {
  const files = ["hub-supabase.js", "hub-discord.js", "hub-net.js", "tools/announce-hub-update.js"];
  for (const relative of files) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.doesNotMatch(text, /clkamsflzyvdcepvelks/, `${relative} left the retired host`);
    assert.match(text, /uqyhomsydmnglbaemwbu/, `${relative} uses the replacement project`);
  }
});
