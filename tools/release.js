"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "desktop"]);

function parseArgs(argv) {
  const result = { notes: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--build") result.build = argv[++i];
    else if (arg === "--note") result.notes.push(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!/^\d{8}[a-z]+$/.test(result.build || "")) {
    throw new Error("--build must look like 20261015a");
  }
  if (!result.notes.length || result.notes.some((note) => !String(note || "").trim())) {
    throw new Error("Provide at least one non-empty --note");
  }
  return result;
}

function htmlFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, files);
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

function writeIfChanged(file, next, changed) {
  const previous = fs.readFileSync(file, "utf8");
  if (next === previous) return;
  fs.writeFileSync(file, next, "utf8");
  changed.push(path.relative(ROOT, file).replace(/\\/g, "/"));
}

const { build, notes } = parseArgs(process.argv.slice(2));
const manifestPath = path.join(ROOT, "build-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const current = manifest?.build;
if (!/^\d{8}[a-z]+$/.test(current || "")) {
  throw new Error("build-manifest.json must contain a valid build");
}

const indexPath = path.join(ROOT, "index.html");
const indexBefore = fs.readFileSync(indexPath, "utf8");
const indexBuild = /window\.WORDLE_BUILD = "([^"]+)"/.exec(indexBefore)?.[1];
if (indexBuild !== current) {
  throw new Error(
    `Generated index build ${indexBuild || "(missing)"} does not match manifest ${current}`
  );
}
if (current === build) throw new Error(`Build ${build} is already current`);

const changed = [];
writeIfChanged(manifestPath, `${JSON.stringify({ ...manifest, build }, null, 2)}\n`, changed);
for (const file of htmlFiles(ROOT)) {
  const previous = fs.readFileSync(file, "utf8");
  let next = previous;
  if (file === indexPath) {
    next = next.replace(/window\.WORDLE_BUILD = "[^"]+"/, `window.WORDLE_BUILD = "${build}"`);
    next = next.replace(
      /(href=["'](?:styles\.css|css\/(?:themes|guessword|hub)\.css))(?:\?v=[^"']+)?/gi,
      `$1?v=${build}`
    );
  }
  next = next.replace(/(\.\.\/hub-[a-z-]+\.js)(?:\?v=[^"'\s>]+)?/gi, `$1?v=${build}`);
  next = next.replace(
    /((?:src|href)=["'](?:site-config|hub-[a-z-]+)\.js)(?:\?v=[^"'\s>]+)?/gi,
    `$1?v=${build}`
  );
  writeIfChanged(file, next, changed);
}

const swPath = path.join(ROOT, "sw.js");
const swBefore = fs.readFileSync(swPath, "utf8");
const swNext = swBefore.replace(/const BUILD = "[^"]+";/, `const BUILD = "${build}";`);
if (swNext === swBefore) throw new Error("Could not update BUILD in sw.js");
writeIfChanged(swPath, swNext, changed);

const changelogPath = path.join(ROOT, "changelog.json");
const changelog = JSON.parse(fs.readFileSync(changelogPath, "utf8"));
if (!changelog || typeof changelog !== "object" || Array.isArray(changelog)) {
  throw new Error("changelog.json must contain an object");
}
if (Object.prototype.hasOwnProperty.call(changelog, build)) {
  throw new Error(`Changelog already contains ${build}`);
}
const cleanNotes = notes.map((note) => String(note).trim());
const nextChangelog = { [build]: cleanNotes, ...changelog };
writeIfChanged(changelogPath, `${JSON.stringify(nextChangelog, null, 2)}\n`, changed);

const latestPath = path.join(ROOT, "latest-changelog.js");
const latestSource = `window.MYGAMES_LATEST_CHANGELOG = ${JSON.stringify(
  { build, notes: cleanNotes },
  null,
  2
)};\n`;
writeIfChanged(latestPath, latestSource, changed);

console.log(`Build ${current} -> ${build}`);
console.log(`Updated ${changed.length} files:`);
changed.forEach((file) => console.log(`- ${file}`));
