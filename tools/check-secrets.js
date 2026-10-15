"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mdc",
  ".sql",
  ".txt",
  ".yml",
  ".yaml"
]);

const RULES = [
  {
    name: "live Discord webhook",
    pattern:
      /https:\/\/discord(?:app)?\.com\/api\/webhooks\/(?!PASTE_ID\b)\d+\/[A-Za-z0-9._-]{20,}/g
  },
  {
    name: "GitHub access token",
    pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g
  },
  {
    name: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  },
  {
    name: "Supabase service-role JWT",
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g
  }
];

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: ROOT,
  encoding: "utf8"
})
  .split("\0")
  .filter(Boolean);

const findings = [];
for (const relative of tracked) {
  const extension = path.extname(relative).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension) && !path.basename(relative).startsWith(".env")) continue;
  const full = path.join(ROOT, relative);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${relative}:${line} ${rule.name}`);
    }
  }
}

if (findings.length) {
  console.error("Potential committed secrets found:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Secret scan OK (${tracked.length} tracked files).`);
}
