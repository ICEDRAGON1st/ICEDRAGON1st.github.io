const fs = require("fs");
const s = fs.readFileSync("cup-flow/levels-data.js", "utf8");
const L = eval(s.match(/=\s*(\[[\s\S]*\]);/)[1]);
const hist = {};
let zig = 0;
for (const lv of L) {
  hist[lv.blocks.length] = (hist[lv.blocks.length] || 0) + 1;
  const longs = lv.blocks.filter((b) => b.h < 0.09 && b.w >= 0.38);
  if (longs.length >= 4) zig += 1;
}
const fps = new Set(
  L.map((l) =>
    l.blocks
      .map((b) => [b.x, b.y, b.w, b.h].map((n) => n.toFixed(2)).join(","))
      .sort()
      .join("|")
  )
);
const solsPath = "tools/_cup-flow-sols.json";
const sols = fs.existsSync(solsPath) ? JSON.parse(fs.readFileSync(solsPath, "utf8")) : null;
console.log(
  JSON.stringify(
    {
      levels: L.length,
      unique: fps.size,
      zig4: zig,
      sols: sols ? sols.length : 0,
      hist,
      sample: [1, 10, 25, 50, 100].map((id) => ({
        id,
        n: L[id - 1].blocks.length,
        name: L[id - 1].name,
        maxW: Math.max(...L[id - 1].blocks.map((b) => b.w))
      }))
    },
    null,
    2
  )
);
