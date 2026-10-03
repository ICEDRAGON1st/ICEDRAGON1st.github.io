/**
 * In-game Help Assistant — local FAQ search + selectable mascot personalities.
 * Core answers stay in help-data.json + GAME_INFO.txt; mascots only change voice, avatar, and wrap.
 * Open with F (or F1 in letter games), or the ? button. Pauses typical minigames while open.
 */
(function () {
  if (window.HubHelp) return;

  const Z = 12100;
  const MASCOT_KEY = "hub-help-mascot-v1";
  const UNLOCK_KEY = "hub-help-mascot-unlocks-v1";
  const DEFAULT_MASCOT = "normal";

  /** Parsed fields from GAME_INFO.txt (project knowledge base). */
  let gameInfo = null;
  let gameInfoRaw = "";

  /** Minimal offline fallback if help-data.json cannot load. */
  const FALLBACK = {
    quick: [
      { label: "How do I play?", query: "how to play", icon: "🎮" },
      { label: "My username", query: "what is my username", icon: "👤" },
      { label: "My player code", query: "what is my player code", icon: "🔑" },
      { label: "Achievements", query: "achievements", icon: "🏆" },
      { label: "Settings", query: "settings options", icon: "⚙️" },
      { label: "Leaderboards", query: "leaderboard", icon: "📊" }
    ],
    topics: [
      {
        id: "hub-overview",
        games: ["hub", "*"],
        keywords: ["hub", "games", "help", "how to play", "achievements", "settings", "leaderboard"],
        title: "My Games help",
        answer:
          "Tap a game card to play. On the hub: Achievements, Leaderboards, Settings, Friends, and more are in the top/toolbar buttons. Press F for this assistant (F1 in letter games like Guessword). Open Help again inside a minigame for that game's controls."
      }
    ]
  };

  /**
   * Mascot roster. `starter: true` = unlocked by default.
   * Locked mascots wait for later coin unlocks via HubHelp.unlockMascot(id).
   */
  const MASCOTS = [
    {
      id: "normal",
      name: "Helper",
      fullName: "Helper",
      blurb: "Plain helpful answers — no character voice",
      icon: "💬",
      starter: true,
      plain: true,
      wrap: (core) => String(core || ""),
      refuseCheat:
        "I can't spoil secret words, hidden tiles, or puzzle answers. Ask about rules and controls instead.",
      refuseOffTopic:
        "I'm here for My Games, so I can't help with that one. Ask me anything about the hub or the games!",
      refusePrivacy:
        "That's private — I can't show other players' codes, usernames, or account info. You can only ask about your own.",
      refusePassword:
        "I can't show passwords. Check Hub → Settings to set or change a login password. I can tell you your username or player code instead.",
      greet:
        "Hi! Ask how to play, where achievements or settings are, or tap a quick question. I only help with these games.",
      helpOffer: (where) =>
        `Yes — I can help you. Just ask. I can help with how to play ${where}, controls, achievements, settings, leaderboards, and your username or player code.`
    },
    {
      id: "chip",
      name: "Chip",
      fullName: "Chip the Arcade Cabinet",
      blurb: "Enthusiastic retro arcade host",
      icon: "🕹️",
      starter: true,
      wrap: (core) => `INSERT COIN—and listen up, player! ${core} High-score vibes only—don't tilt the cabinet!`,
      refuseCheat:
        "TILT! No free credits for spoilers — I don't reveal secret words, tiles, or puzzle keys. Play fair and chase that high score!",
      refuseOffTopic:
        "Wrong cabinet for that one — I'm here for My Games. Ask me about the hub or any game!",
      greet:
        "Hey player! Chip online — ask how to play, where achievements are, or tap a quick question. Let's chase that high score!",
      helpOffer: (where) =>
        `You bet I can help! Just ask — I can help with how to play ${where}, controls, achievements, settings, leaderboards, and your username or player code. Tap a button or type a question!`
    },
    {
      id: "spark-e",
      name: "SPARK-E",
      fullName: "SPARK-E the Robot",
      blurb: "Eager cheerleader drone",
      icon: "🤖",
      starter: true,
      wrap: (core) => `Beep-boop! Hype systems online! ${core} You have got this—boosters fired! ⚡`,
      refuseCheat:
        "ERROR! My protocols prevent me from spoiling the fun or answering non-game trivia!",
      refuseOffTopic:
        "Beep — that's outside My Games. Ask me about the hub or a game instead!",
      greet: "Beep-boop hi!! Hype systems online — ask me about this game, menus, or achievements! ⚡",
      helpOffer: (where) =>
        `Yes! Help mode ON! Ask me anything about ${where} — how to play, controls, achievements, settings, or your username / player code. Just type a question! ⚡`
    },
    {
      id: "whiskers",
      name: "Whiskers",
      fullName: "Professor Whiskers the Cat",
      blurb: "Cozy, wise, slightly sarcastic",
      icon: "🐱",
      starter: false,
      wrap: (core) => `*adjusts tiny wizard hat* Hmph. Pay attention. ${core} …Yes, even you. Now run along before I nap on the keyboard.`,
      refuseCheat:
        "A true master finds the secret word on their own, human. No hints from me!",
      refuseOffTopic:
        "That's outside my tutoring hours. Ask me about My Games instead.",
      greet: "Hm. Hello. Ask about the games if you must — I suppose I can spare a moment before my nap.",
      helpOffer: (where) =>
        `Fine, I can help. Ask about ${where}: how to play, controls, achievements, settings, or your own username and player code. Don't make me repeat myself.`
    },
    {
      id: "glitch",
      name: "Glitch",
      fullName: "Glitch the Pixel",
      blurb: "Playful mischievous insider",
      icon: "👾",
      starter: false,
      wrap: (core) => `psst—don't tell the patch notes, but… ${core} heh. I totally didn't rearrange your HUD. (or did i)`,
      refuseCheat:
        "nice try~ I'm chaotic, not a cheat engine. secret answers stay corrupted on purpose. go guess it yourself ;)",
      refuseOffTopic:
        "lol not in this build — ask me about My Games instead~",
      greet: "heyyy~ glitch here. ask about games/menus… i promise i only mostly broke the UI",
      helpOffer: (where) =>
        `yep i can help~ just ask. i know ${where} tips: how to play, controls, achievements, settings, your username/code. tap a button or type something :)`
    },
    {
      id: "pixel-8",
      name: "Pixel-8",
      fullName: "Pixel-8 the Game Dev",
      blurb: "Sleepy pajama developer",
      icon: "💻",
      starter: false,
      wrap: (core) => `*yawns in commit history* okay so basically— ${core} anyway i'm shipping this note and going back to bed. please don't file a bug about the pajamas.`,
      refuseCheat:
        "yeah no — i'm not shipping spoilers. secret words and puzzle keys stay out of the help build. go play it.",
      refuseOffTopic:
        "outside the repo — ask me about My Games instead.",
      greet: "hey… *yawns* ask about the hub or a game. then i'm going back to bed.",
      helpOffer: (where) =>
        `yeah i can help. ask about ${where} — how to play, controls, achievements, settings, or your username/player code. then maybe let me sleep.`
    },
    {
      id: "barnaby",
      name: "Barnaby",
      fullName: "Barnaby the Hype-Man",
      blurb: "80s gym instructor energy",
      icon: "📣",
      starter: false,
      wrap: (core) => `CAN YOU HEAR ME IN THE BACK?! ${core} NOW DROP AND GIVE ME ONE MORE TRY—YOU'RE A CHAMPION!`,
      refuseCheat:
        "NO SHORTCUTS ON MY WATCH! Spoilers are for quitters — earn that win with SWEAT and REPS!",
      refuseOffTopic:
        "Wrong gym for that one! Ask me about My Games instead!",
      greet: "HEYYY CHAMP! Ask me how to play or where the menus are — LET'S GET THOSE GAINS!",
      helpOffer: (where) =>
        `YES I CAN HELP YOU!! Ask me about ${where}: how to play, controls, achievements, settings, leaderboards, YOUR username or player code — JUST ASK!!`
    },
    {
      id: "goldsworth",
      name: "Sir Goldsworth",
      fullName: "Sir Goldsworth the Goblin",
      blurb: "Treasure-obsessed coin goblin",
      icon: "🪙",
      starter: false,
      wrap: (core) => `Yesss, shiny seeker… listen close from my coin sack. ${core} More loot awaits. Leave the goblin his tip.`,
      refuseCheat:
        "Greedy, yes — cheater, never. I won't sell secret words or puzzle keys. Dig up the treasure yourself!",
      refuseOffTopic:
        "That shiny isn't from this dungeon. Ask me about My Games instead.",
      greet: "Yesss, hello shiny seeker… ask about games and loot menus. Leave the goblin a tip.",
      helpOffer: (where) =>
        `Yesss, I can help… Ask about ${where}: how to play, controls, achievements, settings, or your own username and player code. Then leave the goblin a tip.`
    },
    {
      id: "astra",
      name: "Astra",
      fullName: "Astra the Space Explorer",
      blurb: "Curious alien mission officer",
      icon: "🚀",
      starter: false,
      wrap: (core) => `Mission briefing, star-cadet: ${core} Chart a course, log the discovery, and may your high score reach orbit.`,
      refuseCheat:
        "Spoiler signals are jammed, cadet. I will not transmit secret words or puzzle solutions. Complete the mission yourself.",
      refuseOffTopic:
        "Outside this star system. Ask me about My Games instead, cadet.",
      greet: "Greetings, star-cadet. Ready for a briefing? Ask about controls, rules, or hub menus.",
      helpOffer: (where) =>
        `Affirmative — I can help. Ask about ${where}: how to play, controls, achievements, settings, or your username and player code. Transmit your question when ready.`
    },
    {
      id: "gusto",
      name: "Chef Gusto",
      fullName: "Chef Gusto",
      blurb: "Cheerful cooking metaphors",
      icon: "👨‍🍳",
      starter: false,
      wrap: (core) => `Bon appétit, chef! Here's the recipe: ${core} Season with practice, plate with confidence—and don't burn the combo!`,
      refuseCheat:
        "Ah-ah! No tasting the secret ingredient early — I won't serve spoilers or puzzle answers. Cook it yourself!",
      refuseOffTopic:
        "Wrong kitchen for that dish — ask me about My Games instead!",
      greet: "Bonjour, chef! Hungry for game tips? Ask how to play or where the menus are!",
      helpOffer: (where) =>
        `Of course I can help! Ask about ${where} — how to play, controls, achievements, settings, or your username and player code. What's cooking?`
    },
    {
      id: "shadow",
      name: "Shadow",
      fullName: "Shadow the Detective",
      blurb: "Noir detective, classified files",
      icon: "🕵️",
      starter: false,
      wrap: (core) => `Case file — confidential. ${core} That's all the dossier says, kid. Keep it under your hat.`,
      refuseCheat:
        "That information is top secret, detective. You'll have to solve this case yourself.",
      refuseOffTopic:
        "Wrong beat, kid. Ask me about My Games instead.",
      greet: "Evening, kid. You looking for a case tip? Ask about the games, menus, or achievements.",
      helpOffer: (where) =>
        `Yeah, I can help. Ask about ${where}: how to play, controls, achievements, settings, or your own username and player code. What's the case?`
    }
  ];

  const MASCOT_BY_ID = Object.fromEntries(MASCOTS.map((m) => [m.id, m]));

  let data = FALLBACK;
  let root = null;
  let chatEl = null;
  let inputEl = null;
  let quickEl = null;
  let contextEl = null;
  let titleEl = null;
  let avatarEl = null;
  let open = false;
  let wePausedHost = false;
  let ready = false;

  function scriptBase() {
    try {
      const scripts = document.getElementsByTagName("script");
      for (let i = 0; i < scripts.length; i += 1) {
        const src = scripts[i].src || "";
        if (/hub-help\.js/i.test(src)) return src.replace(/hub-help\.js[^/]*$/i, "");
      }
      for (let i = 0; i < scripts.length; i += 1) {
        const src = scripts[i].src || "";
        if (/hub-plays\.js/i.test(src)) return src.replace(/hub-plays\.js[^/]*$/i, "");
      }
    } catch {}
    try {
      const path = String(location.pathname || "").replace(/\\/g, "/");
      const segs = path.split("/").filter(Boolean);
      const last = segs[segs.length - 1] || "";
      if (last && !/\.html?$/i.test(last) && last !== "Wordle") return "../";
      if (/\.html?$/i.test(last) && segs.length > 1) return "../";
    } catch {}
    return "";
  }

  function currentGameId() {
    try {
      if (window.HubPlays?.getActiveGame) {
        const id = String(HubPlays.getActiveGame() || "hub");
        if (id) return id;
      }
    } catch {}
    try {
      if (document.documentElement.classList.contains("playing-guessword")) return "wordle";
    } catch {}
    try {
      const path = String(location.pathname || "").replace(/\\/g, "/").toLowerCase();
      const segs = path.split("/").filter(Boolean);
      const map = {
        "space-shooter": "space",
        "memory-match": "memory",
        "wing-hop": "flappy",
        "flappy-bird": "flappy",
        "tic-tac-toe": "tictactoe",
        "pixel-drop": "pixletris",
        pixletris: "pixletris",
        runosaur: "dino",
        "ramp-rush": "ramp",
        "block-sweep": "blockblast",
        "block-blast": "blockblast",
        "paper-io": "paper",
        "cross-walk": "crossy",
        "guac-a-mole": "guac",
        "bubble-pop": "bubble",
        "cafe-queue": "cafe",
        "garden-snap": "garden",
        dudes: "lemmings",
        lemmings: "lemmings"
      };
      for (let i = segs.length - 1; i >= 0; i -= 1) {
        let seg = segs[i];
        if (!seg || /\.html?$/i.test(seg)) continue;
        if (map[seg]) return map[seg];
        if (
          /^(snake|breakout|hangman|2048|quiz|math|sudoku|clicker|stacker|fishing|cows|mine|wordle)$/i.test(
            seg
          )
        ) {
          return seg;
        }
      }
    } catch {}
    return "hub";
  }

  function gameLabel(id) {
    try {
      if (window.HubPlays?.gameLabel) return HubPlays.gameLabel(id);
    } catch {}
    return id === "hub" ? "Hub" : id;
  }

  function isTypingTarget(el) {
    if (!el || el === document.body) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return !!(el.closest && el.closest("input, textarea, select, [contenteditable='true']"));
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s+×x]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(s) {
    return normalize(s)
      .split(" ")
      .filter((w) => w.length > 1);
  }

  /** Common help words for typo fixing (e.g. "ser" → "user"). */
  const HELP_VOCAB = [
    "user",
    "username",
    "name",
    "nickname",
    "handle",
    "code",
    "player",
    "players",
    "played",
    "playing",
    "people",
    "users",
    "password",
    "account",
    "achievement",
    "achievements",
    "settings",
    "options",
    "leaderboard",
    "leaderboards",
    "controls",
    "control",
    "play",
    "how",
    "many",
    "have",
    "online",
    "active",
    "total",
    "count",
    "help",
    "menu",
    "menus",
    "hub",
    "friends",
    "friend",
    "chat",
    "score",
    "scores",
    "rules",
    "rule",
    "guide",
    "tutorial",
    "assistant",
    "mascot",
    "fishing",
    "mine",
    "snake",
    "guessword",
    "wordle"
  ];

  const TYPO_MAP = {
    ser: "user",
    usr: "user",
    usre: "user",
    uesr: "user",
    ure: "user",
    usar: "user",
    userr: "user",
    usernme: "username",
    usename: "username",
    userame: "username",
    usernam: "username",
    useranme: "username",
    nickame: "nickname",
    nicknme: "nickname",
    plaer: "player",
    playyer: "player",
    playe: "player",
    cod: "code",
    coed: "code",
    kode: "code",
    passowrd: "password",
    passord: "password",
    pasword: "password",
    acheivement: "achievement",
    acheivements: "achievements",
    achievments: "achievements",
    settigns: "settings",
    setings: "settings",
    settins: "settings",
    optoins: "options",
    leaderbord: "leaderboard",
    leaderboad: "leaderboard",
    controlls: "controls",
    contols: "controls",
    teh: "the",
    wat: "what",
    wht: "what",
    wut: "what",
    waht: "what",
    wats: "whats",
    hwo: "how",
    ply: "play",
    paly: "play"
  };

  /** Never fuzzy-correct these (stops "what" → "chat", "played" → "player"). Explicit TYPO_MAP still applies. */
  const LOCKED_WORDS = {
    what: 1,
    whats: 1,
    is: 1,
    my: 1,
    me: 1,
    the: 1,
    a: 1,
    an: 1,
    to: 1,
    for: 1,
    do: 1,
    i: 1,
    am: 1,
    are: 1,
    you: 1,
    your: 1,
    and: 1,
    or: 1,
    in: 1,
    on: 1,
    of: 1,
    it: 1,
    this: 1,
    that: 1,
    where: 1,
    who: 1,
    how: 1,
    why: 1,
    can: 1,
    please: 1,
    have: 1,
    has: 1,
    had: 1,
    many: 1,
    much: 1,
    some: 1,
    any: 1,
    all: 1,
    most: 1,
    been: 1,
    was: 1,
    were: 1,
    players: 1,
    played: 1,
    playing: 1,
    people: 1,
    online: 1,
    active: 1,
    total: 1,
    count: 1
  };

  function editDistance(a, b) {
    const s = String(a || "");
    const t = String(b || "");
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const rows = s.length + 1;
    const cols = t.length + 1;
    const prev = new Array(cols);
    const cur = new Array(cols);
    for (let j = 0; j < cols; j += 1) prev[j] = j;
    for (let i = 1; i < rows; i += 1) {
      cur[0] = i;
      for (let j = 1; j < cols; j += 1) {
        const cost = s.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j < cols; j += 1) prev[j] = cur[j];
    }
    return prev[cols - 1];
  }

  function correctToken(tok) {
    const w = String(tok || "").toLowerCase();
    if (!w) return tok;
    if (Object.prototype.hasOwnProperty.call(TYPO_MAP, w)) return TYPO_MAP[w];
    // Locked common words: never fuzzy-match (e.g. what ≠ chat, played ≠ player)
    if (LOCKED_WORDS[w]) return w;
    if (HELP_VOCAB.indexOf(w) !== -1) return w;
    if (w.length < 3) return w;
    // Don't strip a trailing "s" / "ed" / "ing" onto a shorter vocab stem (players→player).
    const maxD = w.length <= 4 ? 1 : 2;
    let best = null;
    let bestD = 99;
    for (let i = 0; i < HELP_VOCAB.length; i += 1) {
      const v = HELP_VOCAB[i];
      if (Math.abs(v.length - w.length) > maxD) continue;
      // Plural / tense form of a vocab word — keep the typed form.
      if (w.length > v.length && w.startsWith(v) && /^(s|es|ed|ing)$/.test(w.slice(v.length))) {
        continue;
      }
      if (v.length > w.length && v.startsWith(w) && /^(s|es|ed|ing)$/.test(v.slice(w.length))) {
        continue;
      }
      const d = editDistance(w, v);
      if (d > 0 && d <= maxD && d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best || w;
  }

  /** Kid-friendly phrase fixes after token pass. */
  function fixKidPhrases(text) {
    let s = String(text || "");
    // "me user" / "me code" → my …
    s = s.replace(/\bme\s+(user|username|name|nickname|handle|code|player\s*code)\b/gi, "my $1");
    // "whats my user" / "whats me user"
    s = s.replace(/\bwhats\b/gi, "what's");
    s = s.replace(/\bwhat\s+is\s+me\s+/gi, "what is my ");
    s = s.replace(/\bwhat'?s\s+me\s+/gi, "what's my ");
    return s;
  }

  /** Fix typos in a help question; returns { text, corrected }. */
  function autocorrectQuery(query) {
    const raw = String(query || "").trim();
    if (!raw) return { text: "", corrected: false };
    const parts = raw.split(/(\s+)/);
    let corrected = false;
    const out = parts.map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      const m = part.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
      if (!m) return part;
      const fixed = correctToken(m[2]);
      if (fixed.toLowerCase() !== m[2].toLowerCase()) {
        corrected = true;
        const keep =
          m[2] === m[2].toUpperCase()
            ? fixed.toUpperCase()
            : m[2][0] === m[2][0].toUpperCase()
              ? fixed.charAt(0).toUpperCase() + fixed.slice(1)
              : fixed;
        return m[1] + keep + m[3];
      }
      return part;
    });
    let text = fixKidPhrases(out.join(""));
    if (normalize(text) !== normalize(raw)) corrected = true;
    return { text, corrected };
  }

  /* ── Mascot save / unlock ── */

  function readUnlockMap() {
    const map = {};
    MASCOTS.forEach((m) => {
      if (m.starter) map[m.id] = true;
    });
    try {
      const raw = localStorage.getItem(UNLOCK_KEY);
      if (!raw) return map;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        Object.keys(parsed).forEach((id) => {
          if (MASCOT_BY_ID[id] && parsed[id]) map[id] = true;
        });
      }
    } catch {}
    return map;
  }

  function writeUnlockMap(map) {
    try {
      const out = {};
      Object.keys(map || {}).forEach((id) => {
        if (map[id] && MASCOT_BY_ID[id] && !MASCOT_BY_ID[id].starter) out[id] = true;
      });
      localStorage.setItem(UNLOCK_KEY, JSON.stringify(out));
    } catch {}
  }

  function isUnlocked(id) {
    const m = MASCOT_BY_ID[id];
    if (!m) return false;
    if (m.starter) return true;
    return !!readUnlockMap()[id];
  }

  function unlockMascot(id) {
    const m = MASCOT_BY_ID[id];
    if (!m) return false;
    const map = readUnlockMap();
    map[id] = true;
    writeUnlockMap(map);
    renderMascotPicker();
    refreshChrome();
    try {
      document.dispatchEvent(new CustomEvent("hub-help-mascot-unlocked", { detail: { id } }));
    } catch {}
    return true;
  }

  function getMascotId() {
    try {
      const id = String(localStorage.getItem(MASCOT_KEY) || "").trim();
      if (id && MASCOT_BY_ID[id] && isUnlocked(id)) return id;
    } catch {}
    return DEFAULT_MASCOT;
  }

  function getMascot() {
    return MASCOT_BY_ID[getMascotId()] || MASCOT_BY_ID[DEFAULT_MASCOT];
  }

  function setMascot(id) {
    const m = MASCOT_BY_ID[id];
    if (!m) return { ok: false, error: "Unknown mascot" };
    if (!isUnlocked(id)) return { ok: false, error: "Locked", locked: true };
    try {
      localStorage.setItem(MASCOT_KEY, id);
    } catch {}
    refreshChrome();
    renderMascotPicker();
    try {
      document.dispatchEvent(new CustomEvent("hub-help-mascot-changed", { detail: { id } }));
    } catch {}
    return { ok: true, id };
  }

  function listMascots() {
    const active = getMascotId();
    return MASCOTS.map((m) => ({
      id: m.id,
      name: m.name,
      fullName: m.fullName,
      blurb: m.blurb,
      icon: m.icon,
      starter: !!m.starter,
      unlocked: isUnlocked(m.id),
      active: m.id === active
    }));
  }

  function styleAnswer(core) {
    const m = getMascot();
    const text = String(core || "").trim();
    if (m.plain) return text;
    try {
      return typeof m.wrap === "function" ? m.wrap(text) : text;
    } catch {
      return text;
    }
  }

  function topicApplies(topic, gameId) {
    const games = Array.isArray(topic.games) ? topic.games : ["*"];
    if (games.includes(gameId)) return true;
    if (games.includes("*")) return true;
    return false;
  }

  function scoreTopic(topic, query, gameId) {
    if (!topicApplies(topic, gameId)) return -1;
    const q = normalize(query);
    if (!q) return -1;
    const tokens = tokenize(q);
    let score = 0;
    const title = normalize(topic.title);
    const answer = normalize(topic.answer);
    const keywords = (topic.keywords || []).map(normalize);

    if (title === q) score += 120;
    else if (title.includes(q)) score += 70;
    if (keywords.some((k) => k === q)) score += 100;
    keywords.forEach((k) => {
      if (k && q.includes(k)) score += 40;
      if (k && k.includes(q) && q.length >= 4) score += 25;
      tokens.forEach((t) => {
        if (t.length < 2) return;
        if (k === t) score += 18;
        else if (k.includes(t)) score += 8;
      });
    });
    tokens.forEach((t) => {
      if (t.length < 2) return;
      if (title.includes(t)) score += 10;
      if (answer.includes(t)) score += 3;
    });

    const games = topic.games || [];
    if (games.includes(gameId)) score += 50;
    else if (games.includes("hub") && gameId === "hub") score += 40;
    else if (games.includes("*")) score += 5;

    if (/\b(how|play|control|tutorial|guide)\b/.test(q) && /how to play|controls/i.test(topic.title)) {
      score += 35;
    }
    return score;
  }

  /** Fair-play / scope guardrails — never reads live game state or answer keys. */
  const CHEAT_RE =
    /\b(secret\s*word|today'?s\s*word|daily\s*word|what\s*is\s*the\s*word|tell\s*me\s*the\s*word|give\s*me\s*the\s*(word|answer)|reveal\s*(the\s*)?(word|answer|solution)|spoil(er|s|ing)?|cheat(code|s)?|answer\s*key|puzzle\s*key|solve\s*(it|this|the\s*puzzle)|what'?s\s*the\s*(answer|solution|word)|hidden\s*(tile|word|answer)|mine\s*(location|spot)|which\s*tile|exact\s*answer|walkthrough\s*answer)\b/i;

  const SCOPE_RE =
    /\b(how|play|control|controls|rule|rules|menu|menus|setting|settings|option|options|achievement|achievements|leaderboard|leaderboards|hub|game|games|hotkey|button|pause|resume|cast|dig|fish|score|upgrade|shop|tutorial|guide|help|assistant|mascot|friends|chat|nickname|player|streak|fair\s*play|spoiler|hint|hints|coin|ore|rod|keyboard|wasd|username|user\s*name|player\s*code)\b/i;

  // Small talk is fine; school/trivia/math is not.
  const GREET_RE =
    /^(hi|hii+|hello|hey+|yo|sup|howdy|hiya|heya|hai|good\s*(morning|afternoon|evening|day)|thanks|thank\s*you|ty|thx|bye|goodbye|see\s*ya|cya|what'?s\s*up|wassup|how\s*are\s*you)(\s+(there|chat|assistant|friend|buddy|chip|spark.?e))?[!?.]*$/i;

  // "can you help me" / "i need help" → offer help, don't treat as offtopic.
  const HELP_OFFER_RE =
    /\b((can|could|will|would)\s+you\s+help(\s+me)?|help\s+me(\s+please)?|i\s+need\s+help|need\s+help|please\s+help|can\s+u\s+help|help\s+please|i\s+want\s+help|how\s+can\s+you\s+help)\b/i;

  // Clearly non-game / real-world asks only (never block game ownership, lore, etc.).
  const TRIVIA_RE =
    /(\d+\s*[\+\-\*\/x×÷]\s*\d+|what\s*is\s+\d+|how\s*much\s*is\s+\d+|calculate\s+\d|capital\s+of\s+\w+|weather\s+(today|tomorrow)|define\s+\w+|translate\s+\w+|president\s+of|prime\s*minister|united\s*states|\busa\b|what\s+is\s+the\s+capital|homework|school\s*test|math\s*problem|recipe\s+for|how\s+to\s+cook|bake\s+a|real\s*world\s+advice)\b/i;

  // Anything that sounds like My Games / this hub stays in-scope.
  const GAME_RELATED_RE =
    /\b(my\s*games|hub|game|games|minigame|owner|creator|developer|dev|studio|publisher|admin|ice[_\s-]?dragon|lore|story|backstory|character|plot|world|patch|update|changelog|bug|glitch|troubleshoot|achievement|leaderboard|controls?|menu|settings?|mascot|assistant|fishing|mine|snake|guessword|wordle|player\s*code|username|cast|dig|ore|rod)\b/i;

  // Never reveal passwords — refuse even if somehow stored.
  const PASSWORD_RE =
    /\b(passwords?|pass\s*phrases?|login\s*password|account\s*password|(my|the|your)\s*password|what'?s\s*(my|the)\s*password|tell\s*me\s*(my|the)\s*password|show\s*(my|the)\s*password|reveal\s*(my|the)\s*password)\b/i;

  // Only YOUR account (must say my/me) — not other players.
  const ACCOUNT_USER_RE =
    /\b((what('?s|\s+is)|show|tell\s*me|whats)\s+(my|me)\s+(user(\s*name)?|username|nickname|name|handle)|(my|me)\s+(user(\s*name)?|username|nickname|handle)|who\s+am\s+i)\b/i;

  const ACCOUNT_CODE_RE =
    /\b((what('?s|\s+is)|show|tell\s*me|whats)\s+(my|me)\s+((player\s*)?code)|(my|me)\s+(player\s*)?code|my\s+player\s*code)\b/i;

  const ACCOUNT_BOTH_RE =
    /\b(my\s+account|my\s+account\s+(info|details)|my\s+username\s+and\s+(player\s*)?code|my\s+(player\s*)?code\s+and\s+(user(\s*name)?|username))\b/i;

  // Other people's codes / usernames / accounts — always private.
  const PRIVACY_RE =
    /\b((code|username|user\s*name|password|player\s*code)\s+(to|for|of)\s+|(his|her|their|someone'?s|somebody'?s)\s+(code|username|user\s*name|password|account|player\s*code)|([A-Za-z][\w-]{1,24})'s\s+(code|username|password|account|player\s*code)|(code|username|password)\s+to\s+\w[\w-]{0,24}\s+account|what\s+is\s+\w[\w-]{0,24}\s*('s)?\s*(code|username|password|player\s*code))\b/i;

  const OWNER_RE =
    /\b(who\s+(is|made|created|owns|runs|built)|who'?s\s+the|(owner|creator|developer|dev|admin|publisher)\s+of|(made|created|owns)\s+(this|the|my)\s+(game|games|hub|site|website)|who\s+(runs|built)\s+(this|the|my)\s+(game|games|hub|site)|owner\s+of\s+(the\s+)?(game|hub|site|my\s*games))\b/i;

  // Live / dynamic stats Help cannot truthfully stream from a live DB.
  const LIVE_STATS_RE =
    /\b(how\s+many\s+(players?|people|users?)|player\s+count|players?\s+(online|playing|active|have\s+played|total)|online\s+(players?|count|now)|active\s+(players?|users?)|live\s+(stats?|leaderboard|rankings?)|real[-\s]?time\s+(stats?|leaderboard|players?)|total\s+(players?|accounts?|users?)|how\s+popular|most\s+played\s+right\s+now)\b/i;

  function isGreeting(query) {
    const raw = String(query || "").trim();
    const q = normalize(raw);
    if (!q || q.length > 48) return false;
    return GREET_RE.test(q) || GREET_RE.test(raw);
  }

  function isOtherAccountAsk(query) {
    const q = normalize(query);
    const raw = String(query || "");
    if (!q) return false;
    // Own-account asks are allowed elsewhere.
    if (
      ACCOUNT_BOTH_RE.test(q) ||
      ACCOUNT_USER_RE.test(q) ||
      ACCOUNT_CODE_RE.test(q) ||
      ACCOUNT_BOTH_RE.test(raw) ||
      ACCOUNT_USER_RE.test(raw) ||
      ACCOUNT_CODE_RE.test(raw)
    ) {
      return false;
    }
    if (PRIVACY_RE.test(q) || PRIVACY_RE.test(raw)) return true;
    // "hjalte account code", "account code for bob", etc.
    if (
      /\baccount\b/.test(q) &&
      /\b(code|username|password|user)\b/.test(q) &&
      !/\b(my|me)\b/.test(q)
    ) {
      return true;
    }
    return false;
  }

  function classifyGuard(query) {
    const q = normalize(query);
    const raw = String(query || "");
    if (!q) return "empty";
    if (isGreeting(query)) return "greet";
    if (HELP_OFFER_RE.test(q) || HELP_OFFER_RE.test(raw)) return "helpoffer";
    if (OWNER_RE.test(q) || OWNER_RE.test(raw)) return "owner";
    if (LIVE_STATS_RE.test(q) || LIVE_STATS_RE.test(raw)) return "livestats";
    if (PASSWORD_RE.test(q) || PASSWORD_RE.test(raw)) return "password";
    if (isOtherAccountAsk(query)) return "privacy";
    if (
      ACCOUNT_BOTH_RE.test(q) ||
      ACCOUNT_BOTH_RE.test(raw) ||
      ACCOUNT_USER_RE.test(q) ||
      ACCOUNT_USER_RE.test(raw) ||
      ACCOUNT_CODE_RE.test(q) ||
      ACCOUNT_CODE_RE.test(raw)
    ) {
      return "account";
    }
    if (CHEAT_RE.test(q) || CHEAT_RE.test(raw)) return "cheat";
    // Game-related asks always stay in scope (owner, lore, updates, etc.).
    if (GAME_RELATED_RE.test(q) || GAME_RELATED_RE.test(raw)) return "ok";
    // Only refuse clearly non-game / real-world questions.
    if (TRIVIA_RE.test(q) || TRIVIA_RE.test(raw)) return "offtopic";
    return "ok";
  }

  function unknownGameLine() {
    return "I don't have the exact details on that right now, but feel free to check our official updates or community channels!";
  }

  function discordInvite() {
    try {
      const url = window.SITE_CONFIG?.discord?.invite;
      if (url) return String(url);
    } catch {}
    return "https://discord.gg/6NHYfPwAwg";
  }

  function isGameInfoPlaceholder(val) {
    const s = String(val || "").trim();
    if (!s) return true;
    return /^\[insert\b/i.test(s) || /\[insert\b/i.test(s);
  }

  function gameInfoField(key) {
    if (!gameInfo || !key) return "";
    const val = gameInfo[key];
    if (isGameInfoPlaceholder(val)) return "";
    return String(val).trim();
  }

  /** Parse GAME_INFO.txt `Key: value` lines into a flat object. */
  function parseGameInfo(text) {
    const out = {
      gameName: "",
      owner: "",
      platform: "",
      releaseDate: "",
      objective: "",
      controls: "",
      menus: "",
      totalPlays: "",
      peakConcurrent: "",
      liveStatsNote: "",
      rules: "",
      supportLinks: ""
    };
    const map = [
      [/^\s*game\s*name\s*:/i, "gameName"],
      [/^\s*owner\s*&\s*developer\s*:/i, "owner"],
      [/^\s*owner\s*:/i, "owner"],
      [/^\s*platform\s*:/i, "platform"],
      [/^\s*release\s*date\s*:/i, "releaseDate"],
      [/^\s*main\s*objective\s*:/i, "objective"],
      [/^\s*controls?\s*:/i, "controls"],
      [/^\s*menus?\s*:/i, "menus"],
      [/^\s*total\s*plays?(\s*\/\s*visits?)?\s*:/i, "totalPlays"],
      [/^\s*peak\s*concurrent(\s*players?)?\s*:/i, "peakConcurrent"],
      [/^\s*live\s*stats?\s*note\s*:/i, "liveStatsNote"],
      [/^\s*rules?\s*:/i, "rules"],
      [/^\s*support\s*links?\s*:/i, "supportLinks"]
    ];
    String(text || "")
      .split(/\r?\n/)
      .forEach((line) => {
        for (const [re, key] of map) {
          if (!re.test(line)) continue;
          const val = line.replace(re, "").trim();
          if (val) out[key] = val;
          break;
        }
      });
    return out;
  }

  function liveStatsLine() {
    const m = getMascot();
    if (typeof m.liveStats === "function") {
      try {
        return m.liveStats();
      } catch {}
    }

    let snapshot = "";
    const milestones = [];
    const total = gameInfoField("totalPlays");
    const peak = gameInfoField("peakConcurrent");
    if (total) milestones.push(`listed total plays/visits: ${total}`);
    if (peak) milestones.push(`listed peak concurrent: ${peak}`);
    if (milestones.length) {
      snapshot = ` Closest public milestone from GAME_INFO: ${milestones.join("; ")}.`;
    }

    try {
      const status = window.HubPlays?.getStatus?.();
      const online = Number(status?.online);
      const allTime = Number(status?.allTime);
      const bits = [];
      if (Number.isFinite(online) && online > 0) {
        bits.push(`about ${online} look online in the current hub snapshot`);
      }
      if (Number.isFinite(allTime) && allTime > 0) {
        bits.push(`roughly ${allTime} names show up in the all-time players list on this device`);
      }
      if (bits.length) {
        snapshot += ` Closest public snapshot I can see: ${bits.join(", ")} — these are not live official totals.`;
      }
    } catch {}

    const note =
      gameInfoField("liveStatsNote") ||
      "Exact live numbers update in real time on the main game page, Players list, Leaderboards, and Discord.";

    return (
      "I don't have live database stats in chat (exact active players, real-time online counts, or live leaderboards)." +
      snapshot +
      " " +
      note +
      " For the best numbers, check Players and Leaderboards on the hub, hold Tab to peek who's online, or visit Discord: " +
      discordInvite() +
      "."
    );
  }

  /**
   * Answer ownership / gameplay / controls / rules / support from GAME_INFO.txt
   * when those fields are filled in (not still `[Insert …]`).
   */
  function answerFromGameInfo(query) {
    const q = normalize(query);
    const raw = String(query || "");
    if (!q || !gameInfo) return null;

    const owner = gameInfoField("owner");
    const gameName = gameInfoField("gameName");
    const platform = gameInfoField("platform");
    const releaseDate = gameInfoField("releaseDate");
    const objective = gameInfoField("objective");
    const controls = gameInfoField("controls");
    const menus = gameInfoField("menus");
    const rules = gameInfoField("rules");
    const support = gameInfoField("supportLinks");

    if (OWNER_RE.test(q) || OWNER_RE.test(raw)) {
      if (owner) {
        return {
          title: "Owner",
          answer: gameName
            ? `The owner & developer of ${gameName} is ${owner}.`
            : `The owner & developer is ${owner}.`
        };
      }
      return null;
    }

    if (/\b(support|discord|social|website|community\s*link|invite)\b/i.test(q) && support) {
      return { title: "Support links", answer: support };
    }

    if (/\b(rules?|community\s*rules?|fair\s*play|code\s*of\s*conduct)\b/i.test(q) && rules) {
      return { title: "Rules", answer: rules };
    }

    if (/\b(controls?|hotkeys?|keybinds?|keyboard|wasd|buttons?)\b/i.test(q) && controls) {
      return { title: "Controls", answer: controls };
    }

    if (/\b(menus?|navigation|where\s+(is|are)|settings?\s*menu)\b/i.test(q) && menus) {
      return { title: "Menus", answer: menus };
    }

    if (
      /\b(main\s*objective|objective|goal|how\s+to\s+play|gameplay|what\s+do\s+i\s+do)\b/i.test(q) &&
      objective
    ) {
      return { title: "Gameplay", answer: objective };
    }

    if (
      /\b(game\s*name|what\s+game|platform|release\s*date|when\s+(was|did).*(release|launch)|about\s+(the\s+)?game)\b/i.test(
        q
      )
    ) {
      const bits = [];
      if (gameName) bits.push(`Game name: ${gameName}`);
      if (owner) bits.push(`Owner & developer: ${owner}`);
      if (platform) bits.push(`Platform: ${platform}`);
      if (releaseDate) bits.push(`Release date: ${releaseDate}`);
      if (bits.length) return { title: "About", answer: bits.join(" · ") };
    }

    return null;
  }

  function refusalLine(kind) {
    const m = getMascot();
    if (kind === "privacy") {
      return (
        m.refusePrivacy ||
        "That's private — I can't share other players' account details."
      );
    }
    if (kind === "password") {
      return (
        m.refusePassword ||
        "I can't show passwords. You can manage a login password in Hub → Settings."
      );
    }
    if (kind === "cheat") {
      return (
        m.refuseCheat ||
        "I can't spoil secret answers or puzzle solutions — that would ruin the fun."
      );
    }
    // Polite turn-away — no long rule lists.
    return (
      m.refuseOffTopic ||
      "I'm here for My Games, so I can't help with that one. Ask me anything about the hub or the games!"
    );
  }

  function greetLine() {
    const m = getMascot();
    return (
      m.greet ||
      `Hey! I'm ${m.name}. Ask how to play, where achievements are, or tap a quick question — game stuff only.`
    );
  }

  function helpOfferLine() {
    const m = getMascot();
    const game = gameLabel(currentGameId());
    const where = currentGameId() === "hub" ? "the hub and any game" : game;
    if (m.helpOffer) {
      try {
        return m.helpOffer(where);
      } catch {}
    }
    return `Yes — I can help you! Just ask me. I can help with how to play ${where}, controls, achievements, settings, leaderboards, and your username or player code. Tap a blue button above, or type a question.`;
  }

  function ownerLine() {
    const m = getMascot();
    if (m.ownerLine) {
      try {
        return m.ownerLine();
      } catch {}
    }
    const owner = gameInfoField("owner");
    const gameName = gameInfoField("gameName") || "My Games";
    if (owner) return `The owner & developer of ${gameName} is ${owner}.`;
    return "The owner of My Games is ICE_DRAGON.";
  }

  function readAccountName() {
    try {
      const n = window.HubPlays?.getName?.();
      return String(n || "").trim();
    } catch {
      return "";
    }
  }

  function readPlayerCode() {
    try {
      let code = window.HubPlays?.getPlayerCode?.() || "";
      if (window.HubPlays?.formatPlayerCode) {
        code = HubPlays.formatPlayerCode(code) || code;
      }
      return String(code || "").trim();
    } catch {
      return "";
    }
  }

  function accountAnswer(query) {
    const q = normalize(query);
    const raw = String(query || "");
    const name = readAccountName();
    const code = readPlayerCode();
    const wantBoth = ACCOUNT_BOTH_RE.test(q) || ACCOUNT_BOTH_RE.test(raw);
    const wantUser =
      wantBoth || ACCOUNT_USER_RE.test(q) || ACCOUNT_USER_RE.test(raw) || /\b(user|username|nickname|handle)\b/i.test(q);
    const wantCode =
      wantBoth ||
      ACCOUNT_CODE_RE.test(q) ||
      ACCOUNT_CODE_RE.test(raw) ||
      (/\bcode\b/i.test(q) && !/\bcheat\b/i.test(q) && !/\bpassword\b/i.test(q));

    const bits = [];
    if (wantUser) {
      bits.push(name ? `Your username is ${name}.` : "You don't have a username set yet — open the hub and pick one.");
    }
    if (wantCode) {
      bits.push(
        code
          ? `Your player code is ${code}.`
          : "I can't find a player code on this device yet — open Hub → Settings to see or restore your code."
      );
    }
    if (!bits.length) {
      bits.push(
        name ? `Your username is ${name}.` : "No username set yet.",
        code ? `Your player code is ${code}.` : "No player code found on this device."
      );
    }
    return bits.join(" ");
  }

  function search(query, gameId) {
    // Dataset-only search. Never accept or merge live game-state / answer keys.
    // One best tip per ask — don't dump multiple FAQ cards for a single question.
    const g = gameId || currentGameId();
    const topics = Array.isArray(data.topics) ? data.topics : [];
    const ranked = topics
      .map((t) => ({ t, s: scoreTopic(t, query, g) }))
      .filter((x) => x.s >= 20)
      .sort((a, b) => b.s - a.s || a.t.title.localeCompare(b.t.title));
    if (!ranked.length) return [];
    return [{ topic: ranked[0].t, score: ranked[0].s }];
  }

  function ensureDom() {
    if (root) return;

    const style = document.createElement("style");
    style.id = "hub-help-style";
    style.textContent = `
/* Sit left of the Chat FAB (right:1rem;bottom:1rem) so they don't overlap */
#hub-help-fab{position:fixed;right:max(7.35rem,calc(6.5rem + env(safe-area-inset-right)));
bottom:max(0.9rem,env(safe-area-inset-bottom));
z-index:${Z};width:3rem;height:3rem;border-radius:999px;border:2px solid rgba(156,190,255,.55);
background:linear-gradient(160deg,#3a5a9a,#1a2a4a);color:#e8eefc;font:800 1.2rem/1 Outfit,Segoe UI,system-ui,sans-serif;
box-shadow:0 10px 28px rgba(0,0,0,.45);cursor:pointer;display:grid;place-items:center;padding:0;
transition:transform .12s ease,box-shadow .12s ease}
#hub-help-fab:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(0,0,0,.55)}
#hub-help-fab:focus-visible{outline:2px solid #9cbcff;outline-offset:3px}
#hub-help-root{position:fixed;inset:0;z-index:${Z + 1};display:none;align-items:flex-end;justify-content:center;
padding:0.75rem;padding-bottom:max(0.75rem,env(safe-area-inset-bottom));background:rgba(4,10,18,.58);
backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#e8f4ff}
#hub-help-root.is-open{display:flex}
#hub-help-root .hub-help-panel{width:min(28rem,100%);max-height:min(82vh,40rem);display:flex;flex-direction:column;
background:linear-gradient(180deg,#182848 0%,#101c34 45%,#0c1528 100%);border:1px solid rgba(140,175,255,.4);
border-radius:22px;box-shadow:0 28px 70px rgba(0,0,0,.55);overflow:hidden}
#hub-help-root .hub-help-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;
padding:1rem 1rem .85rem;background:linear-gradient(180deg,rgba(90,130,220,.18),transparent);
border-bottom:1px solid rgba(140,175,255,.16)}
#hub-help-root .hub-help-head-main{display:flex;gap:.75rem;align-items:center;min-width:0}
#hub-help-root .hub-help-avatar{flex:0 0 auto;width:3.1rem;height:3.1rem;border-radius:16px;display:grid;place-items:center;
font-size:1.55rem;background:linear-gradient(160deg,rgba(150,185,255,.25),rgba(80,120,200,.12));
border:1px solid rgba(160,195,255,.4);box-shadow:0 6px 16px rgba(0,0,0,.25)}
#hub-help-root .hub-help-head h2{margin:0;font-size:1.15rem;font-weight:800;letter-spacing:.01em}
#hub-help-root .hub-help-eyebrow{margin:0 0 .15rem;font-size:.68rem;font-weight:800;letter-spacing:.08em;
text-transform:uppercase;color:#8eb0e0}
#hub-help-root .hub-help-context{margin:.15rem 0 0;font-size:.84rem;font-weight:650;color:#a8c0e0;line-height:1.3}
#hub-help-root .hub-help-game-pill{display:inline-flex;align-items:center;gap:.3rem;margin-top:.35rem;
padding:.2rem .55rem;border-radius:999px;background:rgba(100,170,255,.16);border:1px solid rgba(120,180,255,.3);
font-size:.72rem;font-weight:800;color:#d4e6ff}
#hub-help-root .hub-help-close{border:0;background:rgba(255,255,255,.08);color:#e8f4ff;width:2.25rem;height:2.25rem;
border-radius:12px;font-size:1.25rem;cursor:pointer;line-height:1;flex:0 0 auto}
#hub-help-root .hub-help-close:hover{background:rgba(255,255,255,.14)}
#hub-help-root .hub-help-quick-wrap{padding:.65rem .85rem .7rem;border-bottom:1px solid rgba(140,175,255,.12)}
#hub-help-root .hub-help-quick-label{margin:0 0 .45rem;font-size:.78rem;font-weight:800;color:#c5d8f5}
#hub-help-root .hub-help-quick{display:flex;flex-wrap:wrap;gap:.45rem}
#hub-help-root .hub-help-chip{border:1px solid rgba(140,175,255,.32);background:rgba(100,150,240,.12);color:#eef4ff;
border-radius:999px;padding:.42rem .75rem;font-size:.82rem;font-weight:750;cursor:pointer;
display:inline-flex;align-items:center;gap:.35rem}
#hub-help-root .hub-help-chip:hover{background:rgba(120,170,255,.22);border-color:rgba(160,195,255,.5)}
#hub-help-root .hub-help-chip-icon{font-size:1rem;line-height:1}
#hub-help-root .hub-help-chat{flex:1;min-height:11rem;overflow:auto;padding:.85rem;display:flex;flex-direction:column;gap:.65rem;
background:rgba(0,0,0,.12)}
#hub-help-root .hub-help-msg{max-width:94%;padding:.7rem .85rem;border-radius:16px;font-size:.95rem;font-weight:550;line-height:1.4;
white-space:pre-wrap;word-break:break-word}
#hub-help-root .hub-help-msg.user{align-self:flex-end;background:linear-gradient(160deg,rgba(90,140,255,.35),rgba(70,110,220,.22));
border:1px solid rgba(140,180,255,.4);border-bottom-right-radius:6px}
#hub-help-root .hub-help-msg.user .hub-help-who{display:block;font-size:.68rem;font-weight:800;letter-spacing:.06em;
text-transform:uppercase;color:#b8d0ff;margin-bottom:.25rem}
#hub-help-root .hub-help-msg.bot{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);
border-bottom-left-radius:6px;display:grid;grid-template-columns:auto 1fr;gap:.65rem;align-items:start}
#hub-help-root .hub-help-msg .hub-help-msg-icon{width:2.1rem;height:2.1rem;border-radius:12px;display:grid;place-items:center;
font-size:1.15rem;background:rgba(120,160,255,.16);border:1px solid rgba(140,180,255,.25)}
#hub-help-root .hub-help-msg .hub-help-msg-title{display:block;font-weight:800;margin-bottom:.2rem;color:#dce8ff;font-size:.92rem}
#hub-help-root .hub-help-msg .hub-help-meant{display:inline-flex;margin:.15rem 0 .4rem;padding:.18rem .5rem;border-radius:999px;
background:rgba(255,210,120,.14);border:1px solid rgba(255,200,100,.35);color:#ffe2a8;font-size:.72rem;font-weight:750}
#hub-help-root .hub-help-msg .hub-help-body{color:#e8f0ff}
#hub-help-root .hub-help-form{display:flex;gap:.5rem;padding:.75rem .85rem .55rem;border-top:1px solid rgba(140,175,255,.14);
background:rgba(0,0,0,.15)}
#hub-help-root .hub-help-form input{flex:1;min-width:0;border-radius:14px;border:1px solid rgba(140,175,255,.32);
background:rgba(0,0,0,.28);color:#e8f4ff;padding:.7rem .85rem;font:650 .95rem Outfit,Segoe UI,system-ui,sans-serif}
#hub-help-root .hub-help-form input::placeholder{color:#7f96b8}
#hub-help-root .hub-help-form input:focus{outline:2px solid rgba(140,180,255,.55);outline-offset:1px}
#hub-help-root .hub-help-form button{border:0;border-radius:14px;padding:.7rem 1.05rem;font:800 .92rem Outfit,Segoe UI,system-ui,sans-serif;
background:linear-gradient(180deg,#7a9dff,#4d6fe0);color:#fff;cursor:pointer;box-shadow:0 6px 16px rgba(50,90,200,.35)}
#hub-help-root .hub-help-form button:hover{filter:brightness(1.06)}
#hub-help-root .hub-help-hint{margin:0;padding:0 .85rem .75rem;font-size:.74rem;color:#7f96b8;text-align:center;line-height:1.35}
html.hub-help-open #overlay.hub-help-host-pause{visibility:hidden!important;pointer-events:none!important}
`;
    document.head.appendChild(style);

    const fab = document.createElement("button");
    fab.id = "hub-help-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open help assistant");
    fab.title = helpHotkeyLabel();
    fab.textContent = "?";
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    document.body.appendChild(fab);

    root = document.createElement("div");
    root.id = "hub-help-root";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="hub-help-panel" role="dialog" aria-modal="true" aria-labelledby="hub-help-title">
        <div class="hub-help-head">
          <div class="hub-help-head-main">
            <div class="hub-help-avatar" id="hub-help-avatar" aria-hidden="true">🤖</div>
            <div>
              <p class="hub-help-eyebrow">Help Assistant</p>
              <h2 id="hub-help-title">Ask me anything</h2>
              <p class="hub-help-context" id="hub-help-context">I explain games, menus, and your account.</p>
              <span class="hub-help-game-pill" id="hub-help-game-pill">Playing: Hub</span>
            </div>
          </div>
          <button type="button" class="hub-help-close" id="hub-help-close" aria-label="Close help">×</button>
        </div>
        <div class="hub-help-quick-wrap">
          <p class="hub-help-quick-label">Tap a question — or type your own below</p>
          <div class="hub-help-quick" id="hub-help-quick"></div>
        </div>
        <div class="hub-help-chat" id="hub-help-chat" aria-live="polite"></div>
        <form class="hub-help-form" id="hub-help-form" autocomplete="off">
          <input id="hub-help-input" type="text" maxlength="160" placeholder="Example: how do I play?" aria-label="Ask a help question" />
          <button type="submit">Ask</button>
        </form>
        <p class="hub-help-hint" id="hub-help-hint">Tip: press F for Help · change helper in Settings · Esc closes</p>
      </div>
    `;
    document.body.appendChild(root);

    chatEl = root.querySelector("#hub-help-chat");
    inputEl = root.querySelector("#hub-help-input");
    quickEl = root.querySelector("#hub-help-quick");
    contextEl = root.querySelector("#hub-help-context");
    titleEl = root.querySelector("#hub-help-title");
    avatarEl = root.querySelector("#hub-help-avatar");

    root.querySelector("#hub-help-close").addEventListener("click", () => close());
    root.addEventListener("click", (e) => {
      if (e.target === root) close();
    });
    root.querySelector("#hub-help-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (inputEl.value || "").trim();
      if (!q) return;
      inputEl.value = "";
      ask(q);
    });

    paintQuick();
    refreshChrome();
    pushBot(
      "Hi!",
      "I'm your My Games assistant. Ask about gameplay, menus, your account, the owner, updates, lore, or tap a button above. I stay focused on My Games — not homework or real-world trivia.",
      { raw: true }
    );
  }

  function helpHotkeyLabel() {
    return isLetterGameplayActive() ? "Help (F1)" : "Help (F)";
  }

  function refreshChrome() {
    const m = getMascot();
    const key = isLetterGameplayActive() ? "F1" : "F";
    const gameName = gameLabel(currentGameId());
    const fab = document.getElementById("hub-help-fab");
    if (fab) {
      fab.textContent = m.icon || "?";
      fab.title = `${m.name} — Help (${key})`;
      fab.setAttribute("aria-label", `Open help assistant (${m.fullName})`);
    }
    if (titleEl) titleEl.textContent = m.name;
    if (avatarEl) avatarEl.textContent = m.icon || "?";
    if (contextEl) {
      contextEl.textContent = `${m.fullName} · My Games help (play, account, owner, updates, and more).`;
    }
    const pill = root?.querySelector?.("#hub-help-game-pill");
    if (pill) {
      pill.textContent =
        currentGameId() === "hub" ? "On the My Games hub" : `Helping with: ${gameName}`;
    }
    const hint = root?.querySelector?.("#hub-help-hint");
    if (hint) {
      hint.textContent = `Tip: press ${key} for Help · pick a different helper in Settings · Esc closes`;
    }
    if (inputEl) {
      inputEl.placeholder =
        currentGameId() === "hub"
          ? "Example: what is my username?"
          : `Example: how do I play ${gameName}?`;
    }
  }

  function paintQuick() {
    if (!quickEl) return;
    const items = Array.isArray(data.quick) && data.quick.length ? data.quick : FALLBACK.quick;
    quickEl.innerHTML = items
      .map((q) => {
        const icon = q.icon ? `<span class="hub-help-chip-icon" aria-hidden="true">${escapeHtml(q.icon)}</span>` : "";
        return `<button type="button" class="hub-help-chip" data-q="${escapeHtml(q.query)}">${icon}<span>${escapeHtml(
          q.label
        )}</span></button>`;
      })
      .join("");
    quickEl.querySelectorAll(".hub-help-chip").forEach((btn) => {
      btn.addEventListener("click", () => ask(btn.getAttribute("data-q") || ""));
    });
  }

  function pushUser(text) {
    if (!chatEl) return;
    const el = document.createElement("div");
    el.className = "hub-help-msg user";
    el.innerHTML = `<span class="hub-help-who">You asked</span>${escapeHtml(text)}`;
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function pushBot(title, coreAnswer, opts) {
    if (!chatEl) return;
    const m = getMascot();
    const styled = opts && opts.raw ? String(coreAnswer || "") : styleAnswer(coreAnswer);
    const meant = opts && opts.meant ? String(opts.meant) : "";
    const meantHtml = meant
      ? `<span class="hub-help-meant">I understood: ${escapeHtml(meant)}</span>`
      : "";
    const el = document.createElement("div");
    el.className = "hub-help-msg bot";
    el.innerHTML =
      `<span class="hub-help-msg-icon" aria-hidden="true">${escapeHtml(m.icon)}</span>` +
      `<div><span class="hub-help-msg-title">${escapeHtml(title)}</span>${meantHtml}` +
      `<div class="hub-help-body">${escapeHtml(styled)}</div></div>`;
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function ask(query) {
    ensureDom();
    const typed = String(query || "").trim();
    if (!typed) return;
    const fixed = autocorrectQuery(typed);
    const q = fixed.text || typed;
    refreshChrome();
    pushUser(typed);

    const guard = classifyGuard(q);
    const meant = fixed.corrected && normalize(q) !== normalize(typed) ? q : "";
    const withMeant = (extra) => Object.assign({ raw: true }, extra || {}, meant ? { meant } : {});

    if (guard === "greet") {
      pushBot("Hey there!", greetLine(), withMeant());
      return;
    }
    if (guard === "helpoffer") {
      pushBot("I can help!", helpOfferLine(), withMeant());
      return;
    }
    if (guard === "owner") {
      pushBot("Owner", ownerLine(), withMeant());
      return;
    }
    if (guard === "livestats") {
      pushBot("Live stats", liveStatsLine(), withMeant());
      return;
    }
    if (guard === "password") {
      pushBot("That's private", refusalLine("password"), withMeant());
      return;
    }
    if (guard === "privacy") {
      pushBot("That's private", refusalLine("privacy"), withMeant());
      return;
    }
    if (guard === "account") {
      pushBot("Your account", accountAnswer(q), withMeant());
      return;
    }
    if (guard === "cheat") {
      pushBot("No spoilers", refusalLine("cheat"), withMeant());
      return;
    }
    if (guard === "offtopic") {
      pushBot("Hmm…", refusalLine("offtopic"), withMeant());
      return;
    }

    // Prefer filled GAME_INFO.txt fields for ownership / gameplay / controls / rules.
    const fromInfo = answerFromGameInfo(q);
    if (fromInfo && fromInfo.answer) {
      pushBot(fromInfo.title || "Game info", fromInfo.answer, meant ? { meant } : undefined);
      return;
    }

    const gameId = currentGameId();
    const hits = search(q, gameId);
    if (!hits.length) {
      // Valid game ask with no FAQ hit — never treat as forbidden.
      pushBot("Still digging…", unknownGameLine(), withMeant());
      return;
    }
    const t = hits[0].topic;
    if (t && typeof t.answer === "string") {
      pushBot(t.title, t.answer, meant ? { meant } : undefined);
    }
  }

  /* ── Pause host minigame while help is open ── */

  function isHubGamesScreenOpen() {
    try {
      const gs = document.getElementById("games-screen");
      if (gs && !gs.classList.contains("hidden") && !gs.hidden) return true;
    } catch {}
    return false;
  }

  function pauseHostGame() {
    wePausedHost = false;
    window.__hubHelpPaused = true;
    try {
      // Hub page: #menu-btn is Guessword's menu — clicking it leaves My Games.
      if (isHubGamesScreenOpen() || currentGameId() === "hub") return;

      const overlay = document.getElementById("overlay");
      const menuBtn = document.getElementById("menu-btn");
      // Only auto-pause real minigames that use the shared #overlay pattern.
      if (!overlay || !menuBtn) {
        if (typeof window.pauseGame === "function") {
          window.pauseGame();
          wePausedHost = true;
        }
        return;
      }
      const overlayHidden = overlay.classList.contains("hidden") || overlay.hidden;
      if (overlayHidden) {
        wePausedHost = true;
        overlay.classList.add("hub-help-host-pause");
        menuBtn.click();
        overlay.classList.add("hub-help-host-pause");
        return;
      }
      if (typeof window.pauseGame === "function") {
        window.pauseGame();
        wePausedHost = true;
      }
    } catch {
      wePausedHost = false;
    }
  }

  function resumeHostGame() {
    window.__hubHelpPaused = false;
    try {
      const overlay = document.getElementById("overlay");
      if (overlay) overlay.classList.remove("hub-help-host-pause");
      if (!wePausedHost) return;
      const resumeBtn = document.getElementById("resume-btn");
      if (resumeBtn && !resumeBtn.classList.contains("hidden") && !resumeBtn.hidden) {
        resumeBtn.click();
      } else if (typeof window.resumeGame === "function") {
        window.resumeGame();
      } else {
        const startBtn = document.getElementById("start-btn");
        if (startBtn && /resume/i.test(startBtn.textContent || "")) startBtn.click();
      }
    } catch {}
    wePausedHost = false;
  }

  function openHelp() {
    ensureDom();
    if (open) return;
    open = true;
    refreshChrome();
    paintQuick();
    document.documentElement.classList.add("hub-help-open");
    pauseHostGame();
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    try {
      window.dispatchEvent(
        new CustomEvent("hubhelp:open", { detail: { game: currentGameId(), mascot: getMascotId() } })
      );
    } catch {}
    setTimeout(() => {
      try {
        inputEl?.focus();
      } catch {}
    }, 30);
  }

  function close() {
    if (!open) return;
    open = false;
    if (root) {
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
    }
    document.documentElement.classList.remove("hub-help-open");
    resumeHostGame();
    try {
      window.dispatchEvent(
        new CustomEvent("hubhelp:close", { detail: { game: currentGameId(), mascot: getMascotId() } })
      );
    } catch {}
  }

  function toggle() {
    if (open) close();
    else openHelp();
  }

  function onKeyDown(e) {
    if (!e) return;
    if (open && e.code === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (isTypingTarget(e.target)) return;

    const letterGame = isLetterGameplayActive();
    const wantF1 = letterGame && (e.code === "F1" || e.key === "F1");
    const wantF =
      !letterGame &&
      (e.key === "f" || e.key === "F" || e.code === "KeyF") &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey;

    if (!wantF1 && !wantF) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    toggle();
  }

  function isLetterGameplayActive() {
    try {
      // Hub My Games screen is open — F is free for Help.
      if (isHubGamesScreenOpen()) return false;
      // Guessword board is up on the hub page.
      if (document.documentElement.classList.contains("playing-guessword")) return true;
      const path = String(location.pathname || "").toLowerCase();
      // Games where F is needed for typing / answers
      if (/\/(hangman|quiz|sudoku)(\/|$)/i.test(path)) return true;
    } catch {}
    return false;
  }

  /* ── Settings character grid ── */

  function renderMascotPicker(container) {
    const el =
      container ||
      document.getElementById("hub-help-mascot-picker") ||
      document.querySelector("[data-hub-help-mascot-picker]");
    if (!el) return;

    const active = getMascotId();
    el.innerHTML = listMascots()
      .map((m) => {
        const locked = !m.unlocked;
        const classes = [
          "hub-mascot-btn",
          m.active ? "active" : "",
          locked ? "is-locked" : ""
        ]
          .filter(Boolean)
          .join(" ");
        const lockNote = locked ? `<span class="hub-mascot-lock">Locked · coins later</span>` : "";
        return `<button type="button" class="${classes}" data-hub-mascot="${escapeHtml(m.id)}" ${
          locked ? 'aria-disabled="true"' : ""
        } title="${escapeHtml(m.fullName)} — ${escapeHtml(m.blurb)}">
          <span class="hub-mascot-icon" aria-hidden="true">${escapeHtml(m.icon)}</span>
          <span class="hub-mascot-name">${escapeHtml(m.name)}</span>
          <span class="hub-mascot-blurb">${escapeHtml(m.blurb)}</span>
          ${lockNote}
        </button>`;
      })
      .join("");

    function setPickerStatus(msg) {
      const status = document.getElementById("hub-help-mascot-status");
      if (status) status.textContent = msg || "";
      try {
        if (typeof window.showGamesMessage === "function") window.showGamesMessage(msg, 1600);
      } catch {}
    }

    if (el.dataset.hubMascotBound !== "1") {
      el.dataset.hubMascotBound = "1";
      el.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-hub-mascot]");
        if (!btn || !el.contains(btn)) return;
        const id = btn.getAttribute("data-hub-mascot");
        if (!id) return;
        if (!isUnlocked(id)) {
          setPickerStatus("Locked — unlock with coins later");
          btn.classList.add("is-shake");
          setTimeout(() => btn.classList.remove("is-shake"), 320);
          return;
        }
        const res = setMascot(id);
        if (res.ok) {
          const m = MASCOT_BY_ID[id];
          setPickerStatus(`Help assistant: ${m?.fullName || id}`);
          if (open && chatEl) {
            pushBot(
              "Assistant swapped",
              `You're now chatting with ${getMascot().fullName}. Same tips, new vibe.`
            );
          }
        }
      });
    }
  }

  async function loadGameInfo() {
    const base = scriptBase();
    const v = window.WORDLE_BUILD || "1";
    const url = `${base}GAME_INFO.txt?v=${encodeURIComponent(v)}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const text = await res.text();
      gameInfoRaw = String(text || "");
      gameInfo = parseGameInfo(gameInfoRaw);
    } catch {
      gameInfoRaw = "";
      gameInfo = parseGameInfo("");
    }
  }

  async function loadData() {
    const base = scriptBase();
    const v = window.WORDLE_BUILD || "1";
    const url = `${base}help-data.json?v=${encodeURIComponent(v)}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const json = await res.json();
      if (json && Array.isArray(json.topics) && json.topics.length) {
        data = json;
        if (quickEl) paintQuick();
      }
    } catch {
      data = FALLBACK;
    }
    await loadGameInfo();
    ready = true;
  }

  function boot() {
    ensureDom();
    loadData();
    renderMascotPicker();
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("hub-help-mascot-changed", () => {
      refreshChrome();
      renderMascotPicker();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.HubHelp = {
    open: openHelp,
    close,
    toggle,
    ask,
    search,
    classifyGuard,
    isOpen: () => open,
    currentGame: currentGameId,
    ready: () => ready,
    getMascotId,
    getMascot,
    setMascot,
    listMascots,
    isUnlocked,
    unlockMascot,
    renderMascotPicker,
    getGameInfo: () => gameInfo,
    reloadGameInfo: loadGameInfo,
    MASCOTS
  };
})();
