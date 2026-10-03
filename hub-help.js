/**
 * In-game Help Assistant — local FAQ search, no API key.
 * Auto-injects ? button + popup. Open with ? / F1 or the button.
 * Pauses typical hub games while open (menu-btn → resume-btn).
 */
(function () {
  if (window.HubHelp) return;

  const Z = 12100;

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

  let data = FALLBACK;
  let root = null;
  let chatEl = null;
  let inputEl = null;
  let quickEl = null;
  let contextEl = null;
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
      if (/\/[^/]+\.(html?)?$/i.test(path) && /\/(snake|mine|fishing|hub)?/i.test(path)) {
        /* game subfolder */
      }
      if (/\/[a-z0-9-]+\/[^/]*$/i.test(path) && !/index\.html?$/i.test(path.split("/").pop() || "")) {
        return "../";
      }
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

    // Prefer how-to when query looks like how-to-play
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
z-index:${Z};width:2.75rem;height:2.75rem;border-radius:999px;border:1px solid rgba(124,156,255,.45);
background:linear-gradient(180deg,#24365a,#152238);color:#e8eefc;font:800 1.25rem/1 Outfit,Segoe UI,system-ui,sans-serif;
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
#hub-help-root .hub-help-head h2{margin:0;font-size:1.1rem;font-weight:800;letter-spacing:.02em}
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
#hub-help-root .hub-help-msg.bot{align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
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
          <div>
            <h2 id="hub-help-title">Help Assistant</h2>
            <p class="hub-help-context" id="hub-help-context">Current: Hub</p>
          </div>
          <button type="button" class="hub-help-close" id="hub-help-close" aria-label="Close help">×</button>
        </div>
        <div class="hub-help-quick" id="hub-help-quick"></div>
        <div class="hub-help-chat" id="hub-help-chat" aria-live="polite"></div>
        <form class="hub-help-form" id="hub-help-form" autocomplete="off">
          <input id="hub-help-input" type="text" maxlength="160" placeholder="Ask about this game…" aria-label="Ask a help question" />
          <button type="submit">Ask</button>
        </form>
        <p class="hub-help-hint">Local answers · ? or F1 · Esc closes</p>
      </div>
    `;
    document.body.appendChild(root);

    chatEl = root.querySelector("#hub-help-chat");
    inputEl = root.querySelector("#hub-help-input");
    quickEl = root.querySelector("#hub-help-quick");
    contextEl = root.querySelector("#hub-help-context");

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
    pushBot(
      "Welcome",
      "Ask how to play, where achievements or settings are, or tap a quick question below. I use a local guide for this page's game."
    );
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

  function pushBot(title, answer) {
    if (!chatEl) return;
    const el = document.createElement("div");
    el.className = "hub-help-msg bot";
    el.innerHTML = `<span class="hub-help-msg-title">${escapeHtml(title)}</span>${escapeHtml(answer)}`;
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function refreshContext() {
    if (!contextEl) return;
    const id = currentGameId();
    contextEl.textContent = `Current: ${gameLabel(id)}`;
  }

  function ask(query) {
    ensureDom();
    const q = String(query || "").trim();
    if (!q) return;
    refreshContext();
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

  function pauseHostGame() {
    wePausedHost = false;
    try {
      const overlay = document.getElementById("overlay");
      const menuBtn = document.getElementById("menu-btn");
      if (!menuBtn) return;
      const overlayHidden = !overlay || overlay.classList.contains("hidden") || overlay.hidden;
      if (!overlayHidden) return;
      wePausedHost = true;
      if (overlay) overlay.classList.add("hub-help-host-pause");
      menuBtn.click();
      // Keep their pause overlay invisible under help
      if (overlay) overlay.classList.add("hub-help-host-pause");
    } catch {
      wePausedHost = false;
    }
  }

  function resumeHostGame() {
    try {
      const overlay = document.getElementById("overlay");
      if (overlay) overlay.classList.remove("hub-help-host-pause");
      if (!wePausedHost) return;
      const resumeBtn = document.getElementById("resume-btn");
      if (resumeBtn && !resumeBtn.classList.contains("hidden") && !resumeBtn.hidden) {
        resumeBtn.click();
      } else if (overlay && !overlay.classList.contains("hidden")) {
        // Some games resume by hiding overlay / start btn labeled Resume
        const startBtn = document.getElementById("start-btn");
        if (resumeBtn) resumeBtn.click();
        else if (startBtn && /resume/i.test(startBtn.textContent || "")) startBtn.click();
      }
    } catch {}
    wePausedHost = false;
  }

  function openHelp() {
    ensureDom();
    if (open) return;
    open = true;
    refreshContext();
    paintQuick();
    document.documentElement.classList.add("hub-help-open");
    pauseHostGame();
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    try {
      window.dispatchEvent(new CustomEvent("hubhelp:open", { detail: { game: currentGameId() } }));
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
      window.dispatchEvent(new CustomEvent("hubhelp:close", { detail: { game: currentGameId() } }));
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
      // Allow ? only when not typing elsewhere
      if (e.target !== inputEl) return;
    }
    if (e.code === "F1") {
      e.preventDefault();
      toggle();
      return;
    }
    // "?" key (Shift+/ on many layouts) or key === '?'
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isTypingTarget(e.target) && e.target !== inputEl) return;
      if (open && e.target === inputEl) return;
      e.preventDefault();
      toggle();
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
    document.addEventListener("keydown", onKeyDown, true);
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
    ready: () => ready
  };
})();
