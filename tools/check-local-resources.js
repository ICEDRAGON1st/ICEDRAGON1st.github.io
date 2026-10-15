"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "dist"]);
const HTML_RESOURCE_TAGS = new Set(["script", "link", "img", "audio", "video", "source"]);

function walk(dir, extensions, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, files);
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function cleanUrl(value) {
  const raw = String(value || "").trim();
  if (
    !raw ||
    raw.startsWith("#") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("//") ||
    raw.includes("${") ||
    raw.includes("<%")
  ) {
    return null;
  }
  return raw.split(/[?#]/, 1)[0];
}

function resolveLocal(fromFile, value) {
  const cleaned = cleanUrl(value);
  if (!cleaned) return null;
  if (cleaned.startsWith("/")) return path.join(ROOT, cleaned.replace(/^\/+/, ""));
  return path.resolve(path.dirname(fromFile), cleaned);
}

const missing = [];

for (const file of walk(ROOT, new Set([".html"]))) {
  const text = fs.readFileSync(file, "utf8");
  const tagPattern = /<([a-z][\w-]*)\b([^>]*)>/gi;
  for (const tagMatch of text.matchAll(tagPattern)) {
    const tag = tagMatch[1].toLowerCase();
    if (!HTML_RESOURCE_TAGS.has(tag)) continue;
    const attr =
      tag === "script" || tag === "img" || tag === "audio" || tag === "video" || tag === "source"
        ? "src"
        : "href";
    const attrMatch = new RegExp(`\\b${attr}\\s*=\\s*([\"'])(.*?)\\1`, "i").exec(tagMatch[2]);
    if (!attrMatch) continue;
    const target = resolveLocal(file, attrMatch[2]);
    if (target && !fs.existsSync(target)) {
      missing.push(`${path.relative(ROOT, file)} -> ${attrMatch[2]}`);
    }
  }
}

for (const file of walk(ROOT, new Set([".css"]))) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/url\(\s*([\"']?)(.*?)\1\s*\)/gi)) {
    const target = resolveLocal(file, match[2]);
    if (target && !fs.existsSync(target)) {
      missing.push(`${path.relative(ROOT, file)} -> ${match[2]}`);
    }
  }
}

if (missing.length) {
  console.error(`Missing local resources (${missing.length}):`);
  missing.forEach((item) => console.error(`- ${item}`));
  process.exitCode = 1;
} else {
  console.log("Local HTML/CSS resource references are valid.");
}
