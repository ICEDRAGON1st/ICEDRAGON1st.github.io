const fs = require("fs");
const from = "20261001ag";
const to = "20261001ah";
for (const f of ["index.html", "mine/index.html"]) {
  let c = fs.readFileSync(f, "utf8");
  if (!c.includes(from)) {
    console.log(f, "skip");
    continue;
  }
  c = c.split(from).join(to);
  fs.writeFileSync(f, c);
  console.log(f, from, "->", to);
}
let s = fs.readFileSync("script.js", "utf8");
if (!s.includes('"20261001ah"')) {
  s = s.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {
  "20261001ah": [
    "Help Assistant: tap ? or press F1 — local how-to answers for the hub and every minigame"
  ],`
  );
  fs.writeFileSync("script.js", s);
  console.log("changelog ok");
} else {
  console.log("changelog already");
}
