"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

function readCss(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

test("hub, Guessword, and theme CSS live in separate files", () => {
  const themes = readCss("css/themes.css");
  const guessword = readCss("css/guessword.css");
  const hub = readCss("css/hub.css");
  const entry = readCss("styles.css");

  assert.match(themes, /:root/);
  assert.match(themes, /data-guess-colors="ice"/);
  assert.match(themes, /data-guess-colors="arcade"/);
  assert.match(themes, /data-guess-colors="warm"/);
  assert.match(themes, /@keyframes guessBgDrift/);

  assert.match(guessword, /^\.app\s*\{/m);
  assert.match(guessword, /\.board\s*\{/);
  assert.match(guessword, /\.keyboard\s*\{/);
  assert.match(guessword, /@keyframes fadeIn/);

  assert.match(hub, /^\.games-screen\s*\{/m);
  assert.match(hub, /\.game-card\s*\{/);
  assert.match(hub, /\.hub-theme-arcade\s*\{/);
  assert.match(hub, /\.hub-theme-ice\s*\{/);

  assert.match(entry, /@import url\("\.\/css\/themes\.css"\)/);
  assert.match(entry, /@import url\("\.\/css\/guessword\.css"\)/);
  assert.match(entry, /@import url\("\.\/css\/hub\.css"\)/);
  assert.doesNotMatch(entry, /\.games-screen\s*\{/);
  assert.doesNotMatch(entry, /\.board\s*\{/);
});
