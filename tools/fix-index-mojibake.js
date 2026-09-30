const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
// Prefer clean HEAD content if current file was half-fixed with replacement chars
let s;
try {
  const { execSync } = require("child_process");
  s = execSync("git show HEAD:index.html", {
    encoding: "utf8",
    cwd: path.join(__dirname, ".."),
    maxBuffer: 10 * 1024 * 1024
  });
} catch {
  s = fs.readFileSync(file, "utf8");
}

// Mojibake from UTF-8 bytes misread as Windows-1252, then saved as UTF-8 again.
const reps = [
  ["\u00F0\u0178\u201D\u00A5", "\u{1F525}"], // 🔥
  ["\u00F0\u0178\u201D\u0160", "\u{1F50A}"], // 🔊
  ["\u00F0\u0178\u008F\u2020", "\u{1F3C6}"], // 🏆
  ["\u00F0\u0178\u201D\u201C", "\u{1F513}"], // 🔓
  ["\u00E2\u02DC\u20AC", "\u2600"], // ☀
  ["\u00E2\u02DC\u00B0", "\u2630"], // ☰
  ["\u00E2\u02DC\u2020", "\u2606"], // ☆
  ["\u00E2\u0161\u2122", "\u2699"], // ⚙
  ["\u00E2\u20AC\u00A6", "\u2026"], // …
  ["\u00E2\u20AC\u201D", "\u2014"], // —
  ["\u00E2\u20AC\u201C", "\u2013"], // –
  ["\u00E2\u20AC\u2122", "\u2019"], // ’
  ["\u00E2\u20AC\u0153", "\u201C"], // “
  ["\u00E2\u20AC\u009D", "\u201D"] // ”
];

// Also catch trophy if encoded with CP1252 0x8F (undefined) paths — detect live form
const trophyLive = s.match(/\u00F0\u0178.{0,2}Achievements/);
if (trophyLive) {
  console.log("trophy context", JSON.stringify(trophyLive[0]));
}

for (const [a, b] of reps) {
  const n = s.split(a).length - 1;
  if (n) console.log("replace", [...a].map((c) => "U+" + c.codePointAt(0).toString(16)).join(" "), "x" + n);
  s = s.split(a).join(b);
}

// Fix trophy: find remaining F0 178 ... before Achievements
s = s.replace(/\u00F0\u0178[^\x00-\x7F]{1,3}(?= Achievements)/, "\u{1F3C6}");
s = s.replace(/\u00F0\u0178[^\x00-\x7F]{1,3}(?= Unlock)/, "\u{1F513}");

const still = s.match(/[\u00F0\u00E2][\u0160-\u0178\u02DC\u20AC\u201C\u201D\u2020\u2122\u0153\u00A6\u00B0\u00A5]+/g);
if (still) {
  console.log("leftovers", still.map((x) => JSON.stringify(x) + " " + [...x].map((c) => c.codePointAt(0).toString(16)).join(" ")));
}

fs.writeFileSync(file, s, "utf8");
console.log({
  fire: s.includes("\u{1F525}"),
  sun: s.includes("\u2600"),
  speaker: s.includes("\u{1F50A}"),
  trophy: s.includes("\u{1F3C6}"),
  unlock: s.includes("\u{1F513}"),
  gear: s.includes("\u2699"),
  menu: s.includes("\u2630"),
  star: (s.match(/\u2606/g) || []).length,
  ellipsis: (s.match(/\u2026/g) || []).length,
  emdash: (s.match(/\u2014/g) || []).length,
  fffd: (s.match(/\uFFFD/g) || []).length
});
