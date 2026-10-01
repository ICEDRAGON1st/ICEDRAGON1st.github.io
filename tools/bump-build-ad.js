const fs = require("fs");
const from = "20261001ac";
const to = "20261001ad";
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
if (!s.includes('"20261001ad"')) {
  s = s.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {
  "20261001ad": [
    "Mine Depth: clear Layer size chip plus how much of the layer is left"
  ],`
  );
  fs.writeFileSync("script.js", s);
  console.log("changelog ok");
} else {
  console.log("changelog already");
}
