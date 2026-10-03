/**
 * In-game Help Assistant — local FAQ search + selectable mascot personalities.
 * Core answers stay in help-data.json; mascots only change voice, avatar, and wrap.
 * Open with ? / F1 or the ? button. Pauses typical minigames while open.
 */
(function () {
  if (window.HubHelp) return;

  const Z = 12100;
  const MASCOT_KEY = "hub-help-mascot-v1";
  const UNLOCK_KEY = "hub-help-mascot-unlocks-v1";
  const DEFAULT_MASCOT = "spark-e";

  /** Minimal offline fallback if help-data.json cannot load. */
  const FALLBACK = {
    quick: [
      { label: "How do I play?", query: "how to play" },
      { label: "Where are achievements?", query: "achievements" },
      { label: "Where are options?", query: "settings options" },
      { label: "Leaderboards?", query: "leaderboard" }
    ],
    topics: [
      {
        id: "hub-overview",
        games: ["hub", "*"],
        keywords: ["hub", "games", "help", "how to play", "achievements", "settings", "leaderboard"],
        title: "My Games help",
        answer:
          "Tap a game card to play. On the hub: Achievements, Leaderboards, Settings, Friends, and more are in the top/toolbar buttons. Press ? or F1 for this assistant. Open Help again inside a minigame for that game's controls."
      }
    ]
  };

  /**
   * Mascot roster. `starter: true` = unlocked by default.
   * Locked mascots wait for later coin unlocks via HubHelp.unlockMascot(id).
   */
  const MASCOTS = [
    {
      id: "chip",
      name: "Chip",
      fullName: "Chip the Arcade Cabinet",
      blurb: "Enthusiastic retro arcade host",
      icon: "🕹️",
      starter: true,
      wrap: (core) => `INSERT COIN—and listen up, player! ${core} High-score vibes only—don't tilt the cabinet!`
    },
    {
      id: "spark-e",
      name: "SPARK-E",
      fullName: "SPARK-E the Robot",
      blurb: "Eager cheerleader drone",
      icon: "🤖",
      starter: true,
      wrap: (core) => `Beep-boop! Hype systems online! ${core} You have got this—boosters fired! ⚡`
    },
    {
      id: "whiskers",
      name: "Whiskers",
      fullName: "Professor Whiskers the Cat",
      blurb: "Cozy, wise, slightly sarcastic",
      icon: "🐱",
      starter: false,
      wrap: (core) => `*adjusts tiny wizard hat* Hmph. Pay attention. ${core} …Yes, even you. Now run along before I nap on the keyboard.`
    },
    {
      id: "glitch",
      name: "Glitch",
      fullName: "Glitch the Pixel",
      blurb: "Playful mischievous insider",
      icon: "👾",
      starter: false,
      wrap: (core) => `psst—don't tell the patch notes, but… ${core} heh. I totally didn't rearrange your HUD. (or did i)`
    },
    {
      id: "pixel-8",
      name: "Pixel-8",
      fullName: "Pixel-8 the Game Dev",
      blurb: "Sleepy pajama developer",
      icon: "💻",
      starter: false,
      wrap: (core) => `*yawns in commit history* okay so basically— ${core} anyway i'm shipping this note and going back to bed. please don't file a bug about the pajamas.`
    },
    {
      id: "barnaby",
      name: "Barnaby",
      fullName: "Barnaby the Hype-Man",
      blurb: "80s gym instructor energy",
      icon: "📣",
      starter: false,
      wrap: (core) => `CAN YOU HEAR ME IN THE BACK?! ${core} NOW DROP AND GIVE ME ONE MORE TRY—YOU'RE A CHAMPION!`
    },
    {
      id: "goldsworth",
      name: "Sir Goldsworth",
      fullName: "Sir Goldsworth the Goblin",
      blurb: "Treasure-obsessed coin goblin",
      icon: "🪙",
      starter: false,
      wrap: (core) => `Yesss, shiny seeker… listen close from my coin sack. ${core} More loot awaits. Leave the goblin his tip.`
    },
    {
      id: "astra",
      name: "Astra",
      fullName: "Astra the Space Explorer",
      blurb: "Curious alien mission officer",
      icon: "🚀",
      starter: false,
      wrap: (core) => `Mission briefing, star-cadet: ${core} Chart a course, log the discovery, and may your high score reach orbit.`
    },
    {
      id: "gusto",
      name: "Chef Gusto",
      fullName: "Chef Gusto",
      blurb: "Cheerful cooking metaphors",
      icon: "👨‍🍳",
      starter: false,
      wrap: (core) => `Bon appétit, chef! Here's the recipe: ${core} Season with practice, plate with confidence—and don't burn the combo!`
    },
    {
      id: "shadow",
      name: "Shadow",
      fullName: "Shadow the Detective",
      blurb: "Noir detective, classified files",
      icon: "🕵️",
      starter: false,
      wrap: (core) => `Case file — confidential. ${core} That's all the dossier says, kid. Keep it under your hat.`
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

  function search(query, gameId) {
    const g = gameId || currentGameId();
    const topics = Array.isArray(data.topics) ? data.topics : [];
    const ranked = topics
      .map((t) => ({ t, s: scoreTopic(t, query, g) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.t.title.localeCompare(b.t.title));
    return ranked.slice(0, 3).map((x) => x.t);
  }

  function ensureDom() {
    if (root) return;

    const style = document.createElement("style");
    style.id = "hub-help-style";
    style.textContent = `
#hub-help-fab{position:fixed;right:max(0.75rem,env(safe-area-inset-right));bottom:max(0.75rem,env(safe-area-inset-bottom));
z-index:${Z};width:2.85rem;height:2.85rem;border-radius:999px;border:1px solid rgba(124,156,255,.45);
background:linear-gradient(180deg,#24365a,#152238);color:#e8eefc;font:800 1.15rem/1 Outfit,Segoe UI,system-ui,sans-serif;
box-shadow:0 10px 28px rgba(0,0,0,.4);cursor:pointer;display:grid;place-items:center;padding:0;
transition:transform .12s ease,box-shadow .12s ease}
#hub-help-fab:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(0,0,0,.5)}
#hub-help-fab:focus-visible{outline:2px solid #7c9cff;outline-offset:2px}
#hub-help-root{position:fixed;inset:0;z-index:${Z + 1};display:none;align-items:flex-end;justify-content:center;
padding:1rem;padding-bottom:max(1rem,env(safe-area-inset-bottom));background:rgba(4,10,18,.55);
backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#e8f4ff}
#hub-help-root.is-open{display:flex}
#hub-help-root .hub-help-panel{width:min(26rem,100%);max-height:min(78vh,36rem);display:flex;flex-direction:column;
background:linear-gradient(180deg,rgba(18,32,52,.98),rgba(10,18,30,.98));border:1px solid rgba(124,156,255,.35);
border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.5);overflow:hidden}
#hub-help-root .hub-help-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
padding:.9rem 1rem .65rem;border-bottom:1px solid rgba(124,156,255,.18)}
#hub-help-root .hub-help-head-main{display:flex;gap:.65rem;align-items:flex-start;min-width:0}
#hub-help-root .hub-help-avatar{flex:0 0 auto;width:2.6rem;height:2.6rem;border-radius:14px;display:grid;place-items:center;
font-size:1.35rem;background:rgba(124,156,255,.14);border:1px solid rgba(124,156,255,.28)}
#hub-help-root .hub-help-head h2{margin:0;font-size:1.05rem;font-weight:800;letter-spacing:.02em}
#hub-help-root .hub-help-context{margin:.2rem 0 0;font-size:.78rem;font-weight:650;color:#8aa4c0}
#hub-help-root .hub-help-close{border:0;background:rgba(255,255,255,.06);color:#e8f4ff;width:2rem;height:2rem;
border-radius:10px;font-size:1.1rem;cursor:pointer;line-height:1}
#hub-help-root .hub-help-close:hover{background:rgba(255,255,255,.12)}
#hub-help-root .hub-help-quick{display:flex;flex-wrap:wrap;gap:.4rem;padding:.55rem .75rem;border-bottom:1px solid rgba(124,156,255,.12)}
#hub-help-root .hub-help-chip{border:1px solid rgba(124,156,255,.28);background:rgba(124,156,255,.1);color:#dce7ff;
border-radius:999px;padding:.35rem .65rem;font-size:.78rem;font-weight:700;cursor:pointer}
#hub-help-root .hub-help-chip:hover{background:rgba(124,156,255,.2)}
#hub-help-root .hub-help-chat{flex:1;min-height:10rem;overflow:auto;padding:.75rem;display:flex;flex-direction:column;gap:.55rem}
#hub-help-root .hub-help-msg{max-width:95%;padding:.55rem .7rem;border-radius:12px;font-size:.9rem;font-weight:550;line-height:1.35;
white-space:pre-wrap;word-break:break-word}
#hub-help-root .hub-help-msg.user{align-self:flex-end;background:rgba(124,156,255,.22);border:1px solid rgba(124,156,255,.28)}
#hub-help-root .hub-help-msg.bot{align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
display:grid;grid-template-columns:auto 1fr;gap:.55rem;align-items:start}
#hub-help-root .hub-help-msg .hub-help-msg-icon{font-size:1.2rem;line-height:1.2}
#hub-help-root .hub-help-msg .hub-help-msg-title{display:block;font-weight:800;margin-bottom:.25rem;color:#b8ccff;font-size:.82rem}
#hub-help-root .hub-help-form{display:flex;gap:.45rem;padding:.65rem .75rem .8rem;border-top:1px solid rgba(124,156,255,.14)}
#hub-help-root .hub-help-form input{flex:1;min-width:0;border-radius:12px;border:1px solid rgba(124,156,255,.28);
background:rgba(0,0,0,.25);color:#e8f4ff;padding:.55rem .7rem;font:650 .9rem Outfit,Segoe UI,system-ui,sans-serif}
#hub-help-root .hub-help-form input:focus{outline:2px solid rgba(124,156,255,.45);outline-offset:1px}
#hub-help-root .hub-help-form button{border:0;border-radius:12px;padding:.55rem .85rem;font:800 .88rem Outfit,Segoe UI,system-ui,sans-serif;
background:linear-gradient(180deg,#6d8dff,#4a67d6);color:#fff;cursor:pointer}
#hub-help-root .hub-help-hint{margin:0;padding:0 .75rem .65rem;font-size:.72rem;color:#6b829c;text-align:center}
html.hub-help-open #overlay.hub-help-host-pause{visibility:hidden!important;pointer-events:none!important}
`;
    document.head.appendChild(style);

    const fab = document.createElement("button");
    fab.id = "hub-help-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open help assistant");
    fab.title = "Help (? or F1)";
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
              <h2 id="hub-help-title">Help Assistant</h2>
              <p class="hub-help-context" id="hub-help-context">Current: Hub</p>
            </div>
          </div>
          <button type="button" class="hub-help-close" id="hub-help-close" aria-label="Close help">×</button>
        </div>
        <div class="hub-help-quick" id="hub-help-quick"></div>
        <div class="hub-help-chat" id="hub-help-chat" aria-live="polite"></div>
        <form class="hub-help-form" id="hub-help-form" autocomplete="off">
          <input id="hub-help-input" type="text" maxlength="160" placeholder="Ask about this game…" aria-label="Ask a help question" />
          <button type="submit">Ask</button>
        </form>
        <p class="hub-help-hint">Local answers · swap mascot in Settings · ? / F1 · Esc closes</p>
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
      "Welcome",
      "Ask how to play, where achievements or settings are, or tap a quick question. Pick your assistant in Hub → Settings."
    );
  }

  function refreshChrome() {
    const m = getMascot();
    const fab = document.getElementById("hub-help-fab");
    if (fab) {
      fab.textContent = m.icon || "?";
      fab.title = `${m.name} — Help (? or F1)`;
      fab.setAttribute("aria-label", `Open help assistant (${m.fullName})`);
    }
    if (titleEl) titleEl.textContent = m.name;
    if (avatarEl) avatarEl.textContent = m.icon || "?";
    if (contextEl) {
      const id = currentGameId();
      contextEl.textContent = `${m.fullName} · ${gameLabel(id)}`;
    }
  }

  function paintQuick() {
    if (!quickEl) return;
    const items = Array.isArray(data.quick) && data.quick.length ? data.quick : FALLBACK.quick;
    quickEl.innerHTML = items
      .map(
        (q) =>
          `<button type="button" class="hub-help-chip" data-q="${escapeHtml(q.query)}">${escapeHtml(
            q.label
          )}</button>`
      )
      .join("");
    quickEl.querySelectorAll(".hub-help-chip").forEach((btn) => {
      btn.addEventListener("click", () => ask(btn.getAttribute("data-q") || btn.textContent || ""));
    });
  }

  function pushUser(text) {
    if (!chatEl) return;
    const el = document.createElement("div");
    el.className = "hub-help-msg user";
    el.textContent = text;
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function pushBot(title, coreAnswer, opts) {
    if (!chatEl) return;
    const m = getMascot();
    const styled = opts && opts.raw ? String(coreAnswer || "") : styleAnswer(coreAnswer);
    const el = document.createElement("div");
    el.className = "hub-help-msg bot";
    el.innerHTML =
      `<span class="hub-help-msg-icon" aria-hidden="true">${escapeHtml(m.icon)}</span>` +
      `<div><span class="hub-help-msg-title">${escapeHtml(title)}</span>${escapeHtml(styled)}</div>`;
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function ask(query) {
    ensureDom();
    const q = String(query || "").trim();
    if (!q) return;
    refreshChrome();
    pushUser(q);
    const gameId = currentGameId();
    const hits = search(q, gameId);
    if (!hits.length) {
      pushBot(
        "No match",
        `I don't have a note for that yet in ${gameLabel(gameId)}. Try “how to play”, “achievements”, “settings”, or “leaderboard”.`
      );
      return;
    }
    hits.forEach((t) => pushBot(t.title, t.answer));
  }

  /* ── Pause host minigame while help is open ── */

  function pauseHostGame() {
    wePausedHost = false;
    window.__hubHelpPaused = true;
    try {
      const overlay = document.getElementById("overlay");
      const menuBtn = document.getElementById("menu-btn");
      const overlayHidden = !overlay || overlay.classList.contains("hidden") || overlay.hidden;
      if (menuBtn && overlayHidden) {
        wePausedHost = true;
        if (overlay) overlay.classList.add("hub-help-host-pause");
        menuBtn.click();
        if (overlay) overlay.classList.add("hub-help-host-pause");
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
    if (isTypingTarget(e.target) && !(open && e.target === inputEl)) {
      if (e.target !== inputEl) return;
    }
    if (e.code === "F1") {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isTypingTarget(e.target) && e.target !== inputEl) return;
      if (open && e.target === inputEl) return;
      e.preventDefault();
      toggle();
    }
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
    MASCOTS
  };
})();
