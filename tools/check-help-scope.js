const fs = require("fs");
const c = fs.readFileSync("hub-help.js", "utf8");
console.log("GAME_RELATED", c.includes("GAME_RELATED_RE"));
console.log("unknownGameLine", c.includes("unknownGameLine"));
console.log("Still digging", c.includes("Still digging"));
const lines = [...c.matchAll(/refuseOffTopic:\s*\n\s*"([^"]*)"/g)].map((m) => m[1]);
console.log("refuseOffTopic count", lines.length);
lines.forEach((l, i) => console.log(i + 1, l.slice(0, 70)));
