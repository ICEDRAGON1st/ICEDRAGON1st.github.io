const fs = require("fs");
const path = require("path");
const next = "20261001ft";

let html = fs.readFileSync("index.html", "utf8");
const cur = /WORDLE_BUILD = "([^"]+)"/.exec(html)?.[1];
if (!cur) throw new Error("no WORDLE_BUILD");
html = html.split(cur).join(next);
fs.writeFileSync("index.html", html);

let script = fs.readFileSync("script.js", "utf8");
if (!script.includes(`"${next}"`)) {
  script = script.replace(
    "const CHANGELOG = {",
    `const CHANGELOG = {\n  "${next}": [\n    "Cup Flow: 1× / 2× slow / 3× slow water speed buttons"\n  ],`
  );
  fs.writeFileSync("script.js", script);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "desktop") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(ent.name)) out.push(p);
  }
  return out;
}

let n = 0;
for (const file of walk(".")) {
  let c = fs.readFileSync(file, "utf8");
  const before = c;
  c = c.replace(/hub-afk\.js\?v=[^"'\s>]+/g, `hub-afk.js?v=${next}`);
  c = c.replace(/hub-game-boot\.js\?v=[^"'\s>]+/g, `hub-game-boot.js?v=${next}`);
  if (file.replace(/\\/g, "/").endsWith("cup-flow/index.html")) {
    c = c.replace(/styles\.css\?v=[^"'\s>]+/g, `styles.css?v=${next}`);
    c = c.replace(/(?<![-\w])script\.js\?v=[^"'\s>]+/g, `script.js?v=${next}`);
  }
  if (c !== before) {
    fs.writeFileSync(file, c);
    n += 1;
  }
}
console.log("build", cur, "->", next, "html", n);
