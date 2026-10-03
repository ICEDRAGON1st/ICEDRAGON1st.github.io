const fs = require("fs");
const path = "hub-help.js";
let c = fs.readFileSync(path, "utf8");

const replacements = [
  [
    /refuseOffTopic:\s*\n\s*"That isn't about these games[^"]*"/,
    `refuseOffTopic:\n        "I'm here for My Games, so I can't help with that one. Ask me anything about the hub or the games!"`
  ],
  [
    /refuseOffTopic:\s*\n\s*"Wrong cabinet, player![^"]*"/,
    `refuseOffTopic:\n        "Wrong cabinet for that one — I'm here for My Games. Ask me about the hub or any game!"`
  ],
  [
    /refuseOffTopic:\s*\n\s*"ERROR! My protocols[^"]*"/,
    `refuseOffTopic:\n        "Beep — that's outside My Games. Ask me about the hub or a game instead!"`
  ],
  [
    /refuseOffTopic:\s*\n\s*"I tutor games[^"]*"/,
    `refuseOffTopic:\n        "That's outside my tutoring hours. Ask me about My Games instead."`
  ],
  [
    /refuseOffTopic:\s*\n\s*"lol that question[^"]*"/,
    `refuseOffTopic:\n        "lol not in this build — ask me about My Games instead~"`
  ],
  [
    /refuseOffTopic:\s*\n\s*"that's outside the repo[^"]*"/,
    `refuseOffTopic:\n        "outside the repo — ask me about My Games instead."`
  ],
  [
    /refuseOffTopic:\s*\n\s*"WRONG WORKOUT PLAN![^"]*"/,
    `refuseOffTopic:\n        "Wrong gym for that one! Ask me about My Games instead!"`
  ],
  [
    /refuseOffTopic:\s*\n\s*"That shiny isn't from this dungeon[^"]*"/,
    `refuseOffTopic:\n        "That shiny isn't from this dungeon. Ask me about My Games instead."`
  ],
  [
    /refuseOffTopic:\s*\n\s*"That query is outside this star system[^"]*"/,
    `refuseOffTopic:\n        "Outside this star system. Ask me about My Games instead, cadet."`
  ],
  [
    /refuseOffTopic:\s*\n\s*"Wrong kitchen![^"]*"/,
    `refuseOffTopic:\n        "Wrong kitchen for that dish — ask me about My Games instead!"`
  ],
  [
    /refuseOffTopic:\s*\n\s*"Wrong beat, kid[^"]*"/,
    `refuseOffTopic:\n        "Wrong beat, kid. Ask me about My Games instead."`
  ]
];

let n = 0;
for (const [re, rep] of replacements) {
  if (re.test(c)) {
    c = c.replace(re, rep);
    n += 1;
  }
}
fs.writeFileSync(path, c);
console.log("softened", n, "refuseOffTopic lines");
