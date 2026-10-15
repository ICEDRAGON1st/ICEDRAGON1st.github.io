"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WRITE = process.argv.includes("--write");
const OPTIONAL_GAME_SCRIPTS = new Set([
  "hub-friends.js",
  "hub-chat.js",
  "hub-calls.js",
  "hub-call-signal.js",
  "hub-leaderboard.js",
  "hub-discord.js",
  "hub-coins.js",
  "hub-sound.js",
  "hub-audio.js",
  "hub-supabase.js",
  "hub-account-bag.js",
  "hub-plays.js"
]);
const SKIP_DIRS = new Set([
  ".git",
  ".github",
  ".cursor",
  "desktop",
  "docs",
  "node_modules",
  "tests",
  "tools"
]);

function gameIndexes() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map((entry) => path.join(ROOT, entry.name, "index.html"))
    .filter((file) => fs.existsSync(file))
    .filter((file) => /hub-game-boot\.js/i.test(fs.readFileSync(file, "utf8")));
}

function optionalScriptTagPattern() {
  const names = [...OPTIONAL_GAME_SCRIPTS].map((name) => name.replaceAll(".", "\\.")).join("|");
  return new RegExp(
    `^[\\t ]*<script\\b[^>]*src=["']\\.\\./(?:${names})(?:\\?[^"']*)?["'][^>]*>\\s*</script>[\\t ]*\\r?\\n?`,
    "gim"
  );
}

const violations = [];
const changed = [];
for (const file of gameIndexes()) {
  const source = fs.readFileSync(file, "utf8");
  const matches = source.match(optionalScriptTagPattern()) || [];
  if (!matches.length) continue;

  const relative = path.relative(ROOT, file).replaceAll("\\", "/");
  if (!/hub-game-boot\.js/i.test(source)) {
    violations.push(`${relative}: cannot defer shared scripts without hub-game-boot.js`);
    continue;
  }
  if (!WRITE) {
    violations.push(
      `${relative}: ${matches.length} shared scripts duplicate the game boot profile`
    );
    continue;
  }

  const next = source.replace(optionalScriptTagPattern(), "");
  fs.writeFileSync(file, next, "utf8");
  changed.push(`${relative} (${matches.length} deferred)`);
}

if (violations.length) {
  console.error("Game dependency profile violations:");
  violations.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else if (WRITE) {
  console.log(`Updated ${changed.length} game profiles.`);
  changed.forEach((message) => console.log(`- ${message}`));
} else {
  console.log(`Game dependency profiles OK (${gameIndexes().length} routes).`);
}
