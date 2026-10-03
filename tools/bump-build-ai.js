const fs = require("fs");
const from = "20261001ah";
const to = "20261001ai";
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
if (!s.includes('"20261001ai"')) {
  s = s.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {
  "20261001ai": [
    "Help Assistant mascots: pick Chip, SPARK-E, and more in Settings — same tips, different personality"
  ],`
  );
  fs.writeFileSync("script.js", s);
  console.log("changelog ok");
} else {
  console.log("changelog already");
}
