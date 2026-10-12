const { contextBridge, ipcRenderer } = require("electron");

function mountChrome() {
  if (!document.documentElement) return;
  document.documentElement.dataset.mygamesDesktop = "1";
  if (document.getElementById("mygames-desktop-chrome")) return;

  const style = document.createElement("style");
  style.textContent = `
    #mygames-desktop-chrome {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 42px;
      padding: 0 10px;
      box-sizing: border-box;
      font: 600 13px/1.2 "Segoe UI", system-ui, sans-serif;
      color: #e8eef8;
      background: linear-gradient(180deg, rgba(77,163,255,.12), transparent 80%), #0d1524;
      border-bottom: 1px solid rgba(140,180,230,.18);
      pointer-events: auto;
    }
    #mygames-desktop-chrome .brand {
      margin-right: 4px;
      letter-spacing: .04em;
    }
    #mygames-desktop-chrome button {
      appearance: none;
      border: 1px solid rgba(140,180,230,.18);
      background: rgba(255,255,255,.04);
      color: #e8eef8;
      border-radius: 8px;
      height: 28px;
      padding: 0 12px;
      font: inherit;
      cursor: pointer;
    }
    #mygames-desktop-chrome button:hover {
      border-color: rgba(77,163,255,.55);
      background: rgba(77,163,255,.14);
    }
    #mygames-desktop-chrome button.primary {
      background: linear-gradient(135deg, #7ec8ff, #4da3ff);
      border-color: transparent;
      color: #061018;
    }
    #mygames-desktop-chrome .spacer { flex: 1; }
    #mygames-desktop-chrome .hint {
      color: #9bb0cc;
      font-weight: 500;
      font-size: 11px;
    }
    /* Keep Refresh bar fixed; push hub/games content below it */
    html[data-mygames-desktop="1"] {
      --mg-desk-chrome-h: 42px;
      scroll-padding-top: var(--mg-desk-chrome-h);
    }
    html[data-mygames-desktop="1"] body {
      padding-top: var(--mg-desk-chrome-h) !important;
      box-sizing: border-box !important;
      scroll-padding-top: var(--mg-desk-chrome-h);
      min-height: 100vh;
    }
    html[data-mygames-desktop="1"] .overlay,
    html[data-mygames-desktop="1"] .modal,
    html[data-mygames-desktop="1"] #coins-panel.coins-shop-overlay,
    html[data-mygames-desktop="1"] #hub-help-root {
      top: var(--mg-desk-chrome-h) !important;
      right: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      width: auto !important;
      height: auto !important;
      max-height: none !important;
    }
  `;

  const bar = document.createElement("div");
  bar.id = "mygames-desktop-chrome";
  bar.innerHTML = `
    <span class="brand">My Games</span>
    <button type="button" class="primary" data-act="refresh" title="Reload (Ctrl+R / F5)">↻ Refresh</button>
    <button type="button" data-act="home" title="Hub home">Home</button>
    <span class="spacer"></span>
    <span class="hint">Ctrl+R · F5</span>
  `;
  bar.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const act = btn.getAttribute("data-act");
    if (act === "refresh") ipcRenderer.send("hub-refresh");
    if (act === "home") ipcRenderer.send("hub-home");
  });

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(bar);
}

contextBridge.exposeInMainWorld("MyGamesDesktop", {
  mountChrome,
  refresh: () => ipcRenderer.send("hub-refresh"),
  home: () => ipcRenderer.send("hub-home")
});

window.addEventListener("DOMContentLoaded", mountChrome);
if (document.readyState !== "loading") {
  try {
    mountChrome();
  } catch {}
}
