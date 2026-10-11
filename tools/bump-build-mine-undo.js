const fs = require("fs");
const to = "20261001bg";
for (const f of ["index.html", "mine/index.html"]) {
  let c = fs.readFileSync(f, "utf8");
  c = c.replace(/20261001b[ef]/g, to);
  fs.writeFileSync(f, c);
  console.log(f, "->", to);
}
let s = fs.readFileSync("script.js", "utf8");
s = s.replace(
  /\n  "20261001bf": \[\n    "My Games: Mine Depth card moved back next to Runosaur"\n  ],/,
  ""
);
if (!s.includes('"20261001bg"')) {
  s = s.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {
  "20261001bg": [
    "My Games: put Mine Depth hub card back where it was"
  ],`
  );
}
fs.writeFileSync("script.js", s);
console.log("changelog ok");
