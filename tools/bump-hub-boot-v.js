const fs = require("fs");
const path = require("path");

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.name === "node_modules" || e.name === ".git") continue;
    if (e.isDirectory()) walk(p, a);
    else if (e.name.endsWith(".html")) a.push(p);
  }
  return a;
}

let n = 0;
for (const f of walk(".")) {
  let c = fs.readFileSync(f, "utf8");
  const o = c;
  c = c.replace(/hub-game-boot\.js\?v=[^"'>\s]+/g, "hub-game-boot.js?v=20261001bj");
  if (c !== o) {
    fs.writeFileSync(f, c);
    n += 1;
    console.log(f);
  }
}
console.log("updated", n);
