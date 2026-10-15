/**
 * Shared My Games catalog: ids, paths, tags, and leaderboard tabs.
 */
(function (root) {
  const GAMES = [
    { id: "wordle", name: "Guessword", path: null, blurb: "Ice-melt tiles · Flex 4/5/6", tags: ["word", "puzzle", "daily"] },
    { id: "space", name: "Space Shooter", path: "space-shooter/index.html", blurb: "Fly, dodge, and shoot", tags: ["action", "arcade", "shooter"] },
    { id: "quiz", name: "Quizmaster", path: "quiz/index.html", blurb: "General knowledge quiz", tags: ["quiz", "trivia", "puzzle"] },
    { id: "breakout", name: "Bounce Break", path: "breakout/index.html", blurb: "Bounce and smash bricks", tags: ["action", "arcade"] },
    { id: "hangman", name: "Hangman", path: "hangman/index.html", blurb: "Guess the word", tags: ["word", "puzzle"] },
    { id: "2048", name: "Block Merge", path: "2048/index.html", blurb: "Slide and merge tiles", tags: ["puzzle", "merge"] },
    { id: "snake", name: "Snake", path: "snake/index.html", blurb: "Eat food and grow", tags: ["action", "arcade"] },
    { id: "memory", name: "Memory Match", path: "memory-match/index.html", blurb: "Flip cards and find pairs", tags: ["puzzle", "memory"] },
    { id: "connect-four", name: "Drop Four", path: "connect-four/index.html", blurb: "Connect four in a row", tags: ["board", "strategy"] },
    { id: "math", name: "Math Sprint", path: "math/index.html", blurb: "Quick arithmetic quiz", tags: ["quiz", "math", "puzzle"] },
    { id: "sudoku", name: "Sudoku", path: "sudoku/index.html", blurb: "Classic 9×9 logic puzzle", tags: ["puzzle"] },
    { id: "flappy", name: "Wing Hop", path: "wing-hop/index.html", blurb: "Fly a dragon through castle towers", tags: ["action", "arcade", "flyer"] },
    { id: "tictactoe", name: "Tic Tac Toe", path: "tic-tac-toe/index.html", blurb: "Three in a row to win", tags: ["board", "strategy"] },
    { id: "pixletris", name: "Pixel Drop", path: "pixel-drop/index.html", blurb: "Drop blocks and clear lines", tags: ["puzzle", "arcade"] },
    { id: "clicker", name: "Crystal Clicker", path: "clicker/index.html", blurb: "Tap crystals, buy upgrades", tags: ["clicker", "idle", "incremental"] },
    { id: "stacker", name: "Tower Stack 3D", path: "stacker/index.html", blurb: "Stack 3D slabs — X then Z", tags: ["action", "arcade", "timing"] },
    { id: "crossy", name: "Cross Walk", path: "cross-walk/index.html", blurb: "Hop lava, ice, and carts", tags: ["action", "arcade"] },
    { id: "fishing", name: "Fishing Idle", path: "fishing/index.html", blurb: "Cast, reel, sell your catch", tags: ["idle", "incremental", "fishing"] },
    { id: "cows", name: "Cow Merge", path: "cows/index.html", blurb: "Merge cows and evolve your herd", tags: ["idle", "incremental", "merge"] },
    { id: "dino", name: "Runosaur", path: "runosaur/index.html", blurb: "3D cave runner — jump, duck, strafe", tags: ["action", "runner"] },
    { id: "ramp", name: "Ramp Rush", path: "ramp-rush/run.html", blurb: "Jump floating ramps over open void", tags: ["action", "runner"] },
    { id: "guac", name: "Guac-A-Mole", path: "guac-a-mole/index.html", blurb: "Whack ripe avocados — skip the rotten ones", tags: ["action", "arcade", "whack"] },
    { id: "bubble", name: "Bubble Pop Relay", path: "bubble-pop/index.html", blurb: "Clear color clusters before the tide rises", tags: ["puzzle", "arcade"] },
    { id: "stickers", name: "Sticker Garage", path: "sticker-garage/index.html", blurb: "Wrap cars with stickers, cash out, unlock packs", tags: ["puzzle"] },
    { id: "waves", name: "Space Waves", path: "space-waves/index.html", blurb: "Hold to rise through neon tunnels — don’t crash", tags: ["action", "arcade", "flyer"] },
    { id: "cup", name: "Cup Flow", path: "cup-flow/index.html", blurb: "Draw a path to pour water into the cup", tags: ["puzzle"] },
    { id: "cafe", name: "Cafe Queue", path: "cafe-queue/index.html", blurb: "Serve orders fast — keep the combo alive", tags: ["action", "timing"] },
    { id: "garden", name: "Garden Snap", path: "garden-snap/index.html", blurb: "Plant, water, harvest before the season ends", tags: ["puzzle", "timing"] },
    { id: "mine", name: "Mine Depth", path: "mine/index.html", blurb: "Dig down, sell ore, upgrade drills", tags: ["idle", "incremental", "mining"] },
    { id: "blockblast", name: "Block Sweep", path: "block-sweep/index.html", blurb: "Place blocks, clear rows and columns", tags: ["puzzle"] },
    { id: "lemmings", name: "Dudes", path: "dudes/index.html", blurb: "Assign skills and save the crew", tags: ["puzzle", "strategy"] },
    { id: "paper", name: "Paper Claim", path: "paper-io/index.html", blurb: "Claim land vs NPCs or online — paper.io style", tags: ["action", "online", "io"] }
  ];

  const PATH_ALIASES = {
    "flappy-bird": "flappy",
    pixletris: "pixletris",
    "block-blast": "blockblast",
    lemmings: "lemmings"
  };

  function cloneGame(game) {
    return {
      id: game.id,
      name: game.name,
      title: game.name,
      path: game.path,
      blurb: game.blurb,
      tags: game.tags.slice()
    };
  }

  function list() {
    return GAMES.map(cloneGame);
  }

  function catalog() {
    return list();
  }

  function ids() {
    return GAMES.map((game) => game.id);
  }

  function byId(id) {
    const hit = GAMES.find((game) => game.id === id);
    return hit ? cloneGame(hit) : null;
  }

  function folderOf(game) {
    if (!game || !game.path) return "";
    return String(game.path)
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)[0] || "";
  }

  function idFromPath(pathname) {
    const path = String(pathname || "")
      .replace(/\\/g, "/")
      .toLowerCase();
    for (const game of GAMES) {
      const folder = folderOf(game);
      if (folder && path.includes("/" + folder)) return game.id;
    }
    const segs = path.split("/").filter(Boolean);
    for (let i = segs.length - 1; i >= 0; i -= 1) {
      const seg = segs[i].replace(/\.html?$/i, "");
      if (PATH_ALIASES[seg]) return PATH_ALIASES[seg];
      if (GAMES.some((game) => game.id === seg)) return seg;
    }
    return "";
  }

  function leaderboardTabs() {
    const hub = [
      { id: "hub-points", name: "Hub Points" },
      { id: "online-time", name: "Time Online" },
      { id: "day-streak", name: "Day Streak" },
      { id: "invites", name: "Most Invites" }
    ];
    const games = GAMES.flatMap((game) =>
      game.id === "mine"
        ? [
            { id: "mine", name: "Mine Depth" },
            { id: "mine-ore", name: "Mine Best Ore" }
          ]
        : [{ id: game.id, name: game.name }]
    );
    return hub.concat(games);
  }

  const api = {
    GAMES,
    list,
    catalog,
    ids,
    byId,
    folderOf,
    idFromPath,
    leaderboardTabs
  };
  if (root) root.HubGames = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
