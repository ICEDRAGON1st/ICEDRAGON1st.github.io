const fs = require("fs");
const from = "20261001w";
const to = "20261001x";
for (const f of ["index.html", "mine/index.html"]) {
  let c = fs.readFileSync(f, "utf8");
  c = c.split(from).join(to);
  fs.writeFileSync(f, c);
  console.log(f, from, "->", to);
}
let s = fs.readFileSync("script.js", "utf8");
if (!s.includes('"20261001x"')) {
  s = s.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {
  "20261001x": [
    "Mine Depth: deeper layers stretch much longer — digs only clear a small bite, so bands take real time"
  ],`
  );
  fs.writeFileSync("script.js", s);
  console.log("changelog ok");
} else {
  console.log("changelog already");
}
