/**
 * Screen-reader alternatives for canvas minigames.
 */
(function (root) {
  const PATH_IDS = [
    ["/space-shooter", "space"],
    ["/breakout", "breakout"],
    ["/snake", "snake"],
    ["/wing-hop", "flappy"],
    ["/pixel-drop", "pixletris"],
    ["/stacker", "stacker"],
    ["/cross-walk", "crossy"],
    ["/runosaur", "dino"],
    ["/ramp-rush", "ramp"],
    ["/dudes", "lemmings"],
    ["/paper-io", "paper"],
    ["/space-waves", "waves"],
    ["/cup-flow", "cup"]
  ];

  const INSTRUCTIONS = {
    space: "Space Shooter: move with the mouse or WASD, shoot with Space or click, and open Menu or Esc to pause.",
    breakout: "Bounce Break: move the paddle to bounce the ball and clear bricks. Do not let the ball fall. Menu or Esc pauses.",
    snake: "Snake: use arrow keys or WASD to move. Eat apples to grow. Avoid walls and yourself. Menu or Esc pauses.",
    flappy: "Wing Hop: tap, click, or press Space to flap and dodge towers. Menu or Esc pauses.",
    pixletris: "Pixel Drop: landed blocks become sand. Bridge one color left to right to clear. Menu or Esc pauses.",
    stacker: "Tower Stack 3D: tap to stack the moving slab. Misses trim the tower. Menu or Esc pauses.",
    crossy: "Cross Walk: hop across lanes and dodge hazards. Menu or Esc pauses.",
    dino: "Runosaur: Space or tap to jump crystals, duck bats, and stay ahead of the dragon. Menu or Esc pauses.",
    ramp: "Ramp Rush: steer with A and D or arrows, hit gold pads, and dodge killers. Menu or Esc pauses.",
    lemmings: "Dudes: walkers leave the yellow IN. Get enough into the green OUT. Later levels: pick a skill, then tap a walker.",
    paper: "Paper Claim: paint territory and do not get cut while your trail is open. Menu or Esc pauses.",
    waves: "Space Waves: hold to rise, release to fall, and stay inside the neon tunnel. Menu or Esc pauses.",
    cup: "Cup Flow: draw a path from the tap to the cup, then Pour. Undo or Clear if you spill. Menu or Esc pauses."
  };

  function gameIdFromPath(pathname) {
    const path = String(pathname || "")
      .replace(/\\/g, "/")
      .toLowerCase();
    for (const [needle, id] of PATH_IDS) {
      if (path.includes(needle)) return id;
    }
    return "";
  }

  function describe(pathname) {
    const id = gameIdFromPath(pathname);
    return id ? INSTRUCTIONS[id] || "" : "";
  }

  function ensureStyle(doc) {
    if (!doc || doc.getElementById("hub-canvas-alt-style")) return;
    const style = doc.createElement("style");
    style.id = "hub-canvas-alt-style";
    style.textContent =
      ".hub-canvas-alt{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;" +
      "clip:rect(0,0,0,0);white-space:nowrap;border:0}";
    (doc.head || doc.documentElement).appendChild(style);
  }

  function apply(doc, pathname) {
    if (!doc || typeof doc.querySelector !== "function") return null;
    const canvas = doc.querySelector("canvas#game");
    const text = describe(pathname);
    if (!canvas || !text) return null;
    ensureStyle(doc);
    let el = doc.getElementById("hub-canvas-alt");
    if (!el) {
      el = doc.createElement("p");
      el.id = "hub-canvas-alt";
      el.className = "hub-canvas-alt";
      canvas.insertAdjacentElement("afterend", el);
    }
    el.textContent = text;
    canvas.setAttribute("aria-describedby", "hub-canvas-alt");
    return el;
  }

  const api = {
    INSTRUCTIONS,
    gameIdFromPath,
    describe,
    apply
  };
  if (root) root.HubCanvasAlt = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
