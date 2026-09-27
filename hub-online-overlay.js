/**
 * Hold Tab to see who's online (hub + every game that loads HubPlays).
 */
(function () {
  if (window.HubOnlineOverlay) return;

  const Z = 12050;
  let root = null;
  let listEl = null;
  let countEl = null;
  let holding = false;
  let refreshTimer = 0;

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

  function ensureDom() {
    if (root) return;
    const style = document.createElement("style");
    style.id = "hub-online-overlay-style";
    style.textContent = `
#hub-online-overlay{position:fixed;inset:0;z-index:${Z};display:flex;align-items:flex-start;justify-content:center;
padding:4.5rem 1rem 1rem;background:rgba(4,10,18,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
font-family:Outfit,Segoe UI,system-ui,sans-serif;color:#e8f4ff;pointer-events:none;opacity:0;
transition:opacity .12s ease}
#hub-online-overlay.is-open{opacity:1}
#hub-online-overlay .hub-online-card{width:min(22rem,100%);max-height:min(70vh,28rem);display:flex;flex-direction:column;
background:linear-gradient(180deg,rgba(18,32,52,.96),rgba(10,18,30,.96));border:1px solid rgba(62,198,255,.35);
border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.45);overflow:hidden}
#hub-online-overlay .hub-online-head{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;
padding:.85rem 1rem .55rem;border-bottom:1px solid rgba(62,198,255,.18)}
#hub-online-overlay .hub-online-head h2{margin:0;font-size:1.05rem;font-weight:800;letter-spacing:.02em}
#hub-online-overlay .hub-online-count{font-size:.82rem;font-weight:700;color:#8aa4c0}
#hub-online-overlay .hub-online-list{list-style:none;margin:0;padding:.45rem .55rem .65rem;overflow:auto;display:grid;gap:.28rem}
#hub-online-overlay .hub-online-list li{display:flex;justify-content:space-between;align-items:center;gap:.75rem;
padding:.4rem .55rem;border-radius:10px;background:rgba(255,255,255,.04);font-size:.92rem;font-weight:650}
#hub-online-overlay .hub-online-list li.is-you{background:rgba(62,198,255,.12);outline:1px solid rgba(62,198,255,.28)}
#hub-online-overlay .hub-online-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hub-online-overlay .hub-online-game{flex:0 0 auto;color:#8aa4c0;font-size:.78rem;font-weight:600;white-space:nowrap}
#hub-online-overlay .hub-online-empty{margin:0;padding:1.1rem 1rem;text-align:center;color:#8aa4c0;font-size:.9rem}
#hub-online-overlay .hub-online-hint{margin:0;padding:.35rem 1rem .7rem;text-align:center;color:#6b829c;font-size:.72rem}
`;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "hub-online-overlay";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="hub-online-card" role="dialog" aria-label="Players online">
        <div class="hub-online-head">
          <h2>Online</h2>
          <span class="hub-online-count" id="hub-online-overlay-count">0</span>
        </div>
        <ul class="hub-online-list" id="hub-online-overlay-list"></ul>
        <p class="hub-online-hint">Hold Tab</p>
      </div>
    `;
    document.body.appendChild(root);
    listEl = root.querySelector("#hub-online-overlay-list");
    countEl = root.querySelector("#hub-online-overlay-count");
  }

  function formatGame(p) {
    const game = String(p.game || "");
    if (!game || game === "hub") return "Hub";
    if (p.gameName) return p.gameName;
    try {
      if (window.HubPlays?.gameLabel) return HubPlays.gameLabel(game);
    } catch {}
    return game;
  }

  function paintName(name) {
    const safe = escapeHtml(name);
    let accent = "";
    try {
      accent = window.HubPlays?.getAccentColor?.(name) || "";
    } catch {}
    if (accent) {
      return `<strong class="hub-online-name" style="color:${escapeHtml(accent)}">${safe}</strong>`;
    }
    return `<strong class="hub-online-name">${safe}</strong>`;
  }

  function refresh() {
    ensureDom();
    if (!listEl || !countEl) return;
    let players = [];
    try {
      if (window.HubPlays?.getOnlinePlayers) {
        players = HubPlays.getOnlinePlayers() || [];
      }
    } catch {}
    const me = (() => {
      try {
        return HubPlays?.getPlayerId?.() || "";
      } catch {
        return "";
      }
    })();

    countEl.textContent =
      players.length === 1 ? "1 player" : `${players.length} players`;

    if (!players.length) {
      listEl.innerHTML = `<li class="hub-online-empty" style="display:block;background:transparent">Nobody online right now.</li>`;
      return;
    }

    listEl.innerHTML = players
      .map((p) => {
        const you = me && p.playerId === me;
        return `<li class="${you ? "is-you" : ""}"><span>${paintName(p.name)}${
          you ? " · you" : ""
        }</span><span class="hub-online-game">${escapeHtml(formatGame(p))}</span></li>`;
      })
      .join("");
  }

  function show() {
    ensureDom();
    holding = true;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    refresh();
    try {
      HubPlays?.heartbeat?.();
    } catch {}
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!holding) return;
      refresh();
    }, 2000);
  }

  function hide() {
    holding = false;
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = 0;
    }
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
  }

  function onKeyDown(e) {
    if (e.key !== "Tab") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    if (e.repeat && holding) return;
    show();
  }

  function onKeyUp(e) {
    if (e.key !== "Tab") return;
    hide();
  }

  function onBlur() {
    hide();
  }

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hide();
  });

  window.HubOnlineOverlay = { show, hide, refresh };
})();
