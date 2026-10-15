"use strict";

const { execFileSync } = require("node:child_process");

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8"
})
  .split("\0")
  .filter(Boolean)
  .map((file) => file.replaceAll("\\", "/"));

const forbidden = tracked.filter((file) => {
  if (/^(?:desktop\/dist|playwright-report|test-results)\//i.test(file)) return true;
  if (/^tools\/(?:_tmp-|bump-).*\.js$/i.test(file)) return true;
  if (/^test-.*\.html$/i.test(file)) return true;
  if (/(?:^|\/)\.env(?:\.|$)/i.test(file)) return true;
  if (/discord-secrets\.local\.(?:js|json)$/i.test(file)) return true;
  return false;
});

if (forbidden.length > 0) {
  console.error("Forbidden generated, temporary, or sensitive files are tracked:");
  forbidden.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log(`Artifact policy OK (${tracked.length} tracked files).`);
