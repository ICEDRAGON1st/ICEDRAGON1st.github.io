const fs = require("fs");
let c = fs.readFileSync("index.html", "utf8");
const m = /WORDLE_BUILD = "([^"]+)"/.exec(c);
const cur = m ? m[1] : "20260930j";
const next = "20260930k";
c = c.replace(`WORDLE_BUILD = "${cur}"`, `WORDLE_BUILD = "${next}"`);
c = c.replace(/styles\.css\?v=[^"]+/, `styles.css?v=${next}`);
fs.writeFileSync("index.html", c);
console.log("build", next);
