const fs = require("fs");
const from = "20261001aa";
const to = "20261001ab";
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
if (!s.includes('"20261001ab"')) {
  s = s.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {
  "20261001ab": [
    "Mine Depth: see layer thickness clearly, plus Numbers and Depth menus (km, Bm, Dc, and what they mean)"
  ],`
  );
  fs.writeFileSync("script.js", s);
  console.log("changelog ok");
} else {
  console.log("changelog already");
}
