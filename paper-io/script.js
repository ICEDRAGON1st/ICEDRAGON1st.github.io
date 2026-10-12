(function () {
  const HIGH_KEY = "paper-io-best-pct";
  const WORLD = 360;
  const VIEW_SPAN_MIN = 72; // slightly wider than tight paper.io zoom
  const VIEW_SPAN_MAX = 160;
  const LAND_PX = 8; // hi-res land texture so zoom stays smooth
  const SPEED = 24;
  const TURN_RATE = 10.5; // rad/s — sharp cuts, not huge arcs
  const TURN_RATE_HARD = 16; // extra snap for big direction changes
  const PLAYER_R = 1.55;
  /** Match drawn head size (arc uses PLAYER_R * 1.15). */
  const HEAD_DRAW_R = PLAYER_R * 1.15;
  const HEAD_SEP = HEAD_DRAW_R * 2; // solid disks — bump, don't pass through
  const TRAIL_W = 1.2;
  const START_R = 6.5;
  const SPAWN_MIN_DIST = 72; // keep players/NPCs well apart on spawn
  const SPAWN_MIN_DIST_RELAXED = 48;
  const SPAWN_CLEAR_R = START_R + 5;
  const TRAIL_STEP = 0.85; // slightly longer steps = fewer points, still continuous
  const TRAIL_IMMUNE_DIST = 18; // can't hit your own recent trail (paper.io)
  const MIN_TRAIL_FOR_SUICIDE = 22;
  const TRAIL_SOFT_CAP = 640; // compact older points above this (trail stays connected)
  const TRAIL_KEEP_TAIL = 140; // recent tip stays dense for fair cutting
  const MAX_PLAYERS = 8;
  const NET_POLL_MS = 120;
  const DOC_PREFIX = "paper-io-room-";
  const LOBBY_DOC = "paper-io-lobbies";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const COLORS = [
    { fill: "#3ec6ff", soft: "rgba(62,198,255,0.78)", name: "Cyan" },
    { fill: "#ff6b5a", soft: "rgba(255,107,90,0.78)", name: "Coral" },
    { fill: "#7dff9a", soft: "rgba(125,255,154,0.78)", name: "Mint" },
    { fill: "#ffd166", soft: "rgba(255,209,102,0.78)", name: "Gold" },
    { fill: "#c792ff", soft: "rgba(199,146,255,0.78)", name: "Violet" },
    { fill: "#ff9ecd", soft: "rgba(255,158,205,0.78)", name: "Pink" },
    { fill: "#5eead4", soft: "rgba(94,234,212,0.78)", name: "Teal" },
    { fill: "#fda4af", soft: "rgba(253,164,175,0.78)", name: "Rose" }
  ];

  const SKIN_KEY = "paper-claim-skin";
  const SKINS = Object.assign(
    {
      classic: {
        label: "Classic",
        locked: false,
        fill: COLORS[0].fill,
        soft: COLORS[0].soft,
        bg0: "#102338",
        bg1: "#060d16",
        grid: "rgba(62,198,255,0.06)",
        border: "rgba(62,198,255,0.35)",
        trailGlow: COLORS[0].fill,
        head: "classic"
      }
    },
    window.PaperClaimThemePacks?.skins || {}
  );

  let skinId = "classic";
  try {
    const saved = String(localStorage.getItem(SKIN_KEY) || "classic");
    if (SKINS[saved]) skinId = saved;
  } catch {}

  function skin() {
    return SKINS[skinId] || SKINS.classic;
  }

  function skinUnlocked(id) {
    const s = SKINS[id];
    if (!s) return false;
    if (!s.locked && !s.coinItem) return true;
    const itemId = s.coinItem;
    if (!itemId) return false;
    try {
      if (window.HubCoins?.hasPurchase?.(itemId)) return true;
    } catch {}
    return false;
  }

  function setSkin(id) {
    if (!SKINS[id]) return false;
    if (!skinUnlocked(id)) return false;
    skinId = id;
    try {
      localStorage.setItem(SKIN_KEY, id);
    } catch {}
    landDirty = true;
    miniDirty = true;
    refreshSkinPicker();
    refreshSkinPreview();
    return true;
  }

  function tryBuySkin(id) {
    const s = SKINS[id];
    if (!s?.coinItem) return;
    if (typeof window.HubCoins === "undefined") {
      setSkinHint("Coins aren't loaded — open the hub Coin shop to buy this skin.");
      return;
    }
    const res = HubCoins.buy(s.coinItem);
    if (!res.ok) {
      setSkinHint(res.error || HubCoins.NEED_MORE || "You need more coins for this item!");
      return;
    }
    setSkin(id);
    setSkinHint(`Unlocked ${s.label}!`);
  }

  function setSkinHint(msg) {
    const el = document.getElementById("skin-lock-hint");
    if (el) el.textContent = msg || "";
  }

  function refreshSkinPicker() {
    const picker = document.getElementById("skin-picker");
    if (!picker) return;
    if (!skinUnlocked(skinId)) skinId = "classic";
    picker.querySelectorAll("[data-skin]").forEach((btn) => {
      const id = btn.dataset.skin;
      const s = SKINS[id];
      const locked = !skinUnlocked(id);
      btn.classList.toggle("active", id === skinId);
      btn.classList.toggle("skin-btn-locked", locked);
      if (s?.coinCost && locked) {
        btn.textContent = `${s.label} · ${s.coinCost}🪙`;
      } else if (s) {
        btn.textContent = s.label;
      }
    });
  }

  const RAINBOW_COLS = ["#ff6b6b", "#fcc419", "#51cf66", "#339af0", "#cc5de8"];
  function rainbowAt(i) {
    return RAINBOW_COLS[Math.abs(i) % RAINBOW_COLS.length];
  }

  function hexToRgb(hex) {
    const h = String(hex || "").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    if (!Number.isFinite(n)) return { r: 62, g: 198, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lerpHex(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const u = Math.max(0, Math.min(1, t));
    const r = Math.round(A.r + (B.r - A.r) * u);
    const g = Math.round(A.g + (B.g - A.g) * u);
    const bl = Math.round(A.b + (B.b - A.b) * u);
    return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
  }

  function rgbaFromHex(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function isAnimLandSkin(head) {
    return head === "rainbow" || head === "neon";
  }

  /** Rainbow cycles the spectrum; neon only pulses cyan ↔ hot pink. */
  function landAnimColor(head, now) {
    const t = now != null ? now : performance.now();
    if (head === "neon") {
      // Smooth back-and-forth (not a multi-hue loop)
      const u = (Math.sin(t / 380) + 1) * 0.5;
      return lerpHex("#22d3ee", "#ff2bd6", u);
    }
    if (head === "rainbow") {
      const cols = RAINBOW_COLS;
      const f = ((t / 520) % cols.length + cols.length) % cols.length;
      const i = f | 0;
      return lerpHex(cols[i], cols[(i + 1) % cols.length], f - i);
    }
    return null;
  }

  function previewColors() {
    const sk = skin();
    if (skinId !== "classic" && sk?.fill) {
      return {
        fill: sk.fill,
        glow: sk.trailGlow || sk.fill,
        head: sk.head || "classic",
        rainbow: !!sk.rainbow
      };
    }
    return {
      fill: COLORS[0].fill,
      glow: COLORS[0].fill,
      head: "classic",
      rainbow: false
    };
  }

  function paintSkinTrailPreview(g, head, fill, glow, rainbow, W, H) {
    g.lineCap = "round";
    g.lineJoin = "round";
    const x0 = 42;
    const y0 = H * 0.8;
    const x1 = 142;
    const y1 = H * 0.4;
    const midX = 100;
    const midY = H * 0.52;
    if (rainbow || head === "rainbow") {
      g.lineWidth = 18;
      for (let i = 0; i < RAINBOW_COLS.length; i++) {
        g.strokeStyle = RAINBOW_COLS[i];
        g.beginPath();
        g.moveTo(x0 + i * 8, y0);
        g.quadraticCurveTo(midX, midY - i * 4, x1, y1);
        g.stroke();
      }
      return;
    }
    g.shadowColor = glow;
    g.shadowBlur = 16;
    g.strokeStyle = fill;
    if (head === "pixel") {
      g.shadowBlur = 0;
      g.lineWidth = 16;
      g.lineCap = "square";
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(70, y0);
      g.lineTo(70, midY);
      g.lineTo(110, midY);
      g.lineTo(110, y1);
      g.lineTo(x1, y1);
      g.stroke();
    } else if (head === "honey" || head === "candy") {
      g.lineWidth = 14;
      g.setLineDash([10, 8]);
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(midX, midY, x1, y1);
      g.stroke();
      g.setLineDash([]);
    } else if (head === "blueprint" || head === "ice") {
      g.lineWidth = 12;
      g.setLineDash([14, 10]);
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(midX, midY, x1, y1);
      g.stroke();
      g.setLineDash([]);
    } else if (head === "neon") {
      g.lineWidth = 10;
      g.strokeStyle = "#e93cac";
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(midX, midY, x1, y1);
      g.stroke();
      g.strokeStyle = fill;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(midX, midY, x1, y1);
      g.stroke();
    } else if (head === "storm") {
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(70, midY + 20);
      g.lineTo(95, midY - 10);
      g.lineTo(120, midY + 18);
      g.lineTo(x1, y1);
      g.stroke();
    } else {
      g.lineWidth = head === "ink" ? 22 : 18;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(midX, midY, x1, y1);
      g.stroke();
    }
    g.shadowBlur = 0;
    if (head === "ocean" || head === "lava") {
      g.fillStyle = head === "ocean" ? "rgba(200,240,255,0.85)" : "rgba(255,220,80,0.9)";
      for (let i = 0; i < 5; i++) {
        const t = (i + 1) / 6;
        const bx = x0 + (x1 - x0) * t;
        const by = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 18;
        g.beginPath();
        g.arc(bx, by, head === "ocean" ? 5 : 4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  /** Distinct silhouette per skin (shared by in-game head + menu preview). */
  function paintSkinFigura(g, x, y, r, angle, opts) {
    const head = opts.head || "classic";
    const fill = opts.fill;
    const glow = opts.glow || fill;
    const selected = !!opts.selected;
    const showFace = opts.showFace !== false;
    const lw = Math.max(r * 0.08, opts.lineScale || 0.2);

    g.save();
    g.translate(x, y);
    g.rotate(angle || 0);
    g.shadowColor = glow;
    g.shadowBlur = r * (head === "neon" || head === "lava" || head === "gold" ? 0.55 : 0.35);
    g.fillStyle = fill;
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = lw;
    g.lineCap = "round";
    g.lineJoin = "round";

    if (head === "pixel") {
      g.shadowBlur = 0;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.fillStyle = "#1a1b26";
      g.fillRect(-r * 0.55, -r * 0.35, r * 0.35, r * 0.35);
      g.fillRect(r * 0.2, -r * 0.35, r * 0.35, r * 0.35);
      g.fillStyle = "#ffd43b";
      g.fillRect(-r * 0.35, r * 0.25, r * 0.7, r * 0.22);
    } else if (head === "ink") {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-r * 0.15, r * 0.7);
      g.quadraticCurveTo(0, r * 1.55, r * 0.35, r * 1.15);
      g.quadraticCurveTo(r * 0.15, r * 0.85, 0, r * 0.75);
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(-r * 0.55, r * 0.35, r * 0.22, 0, Math.PI * 2);
      g.arc(r * 0.65, -r * 0.2, r * 0.16, 0, Math.PI * 2);
      g.fill();
    } else if (head === "neon") {
      g.shadowBlur = r * 0.7;
      g.shadowColor = "#e93cac";
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = "#e93cac";
      g.lineWidth = lw * 1.4;
      g.stroke();
      g.strokeStyle = fill;
      g.beginPath();
      g.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      g.stroke();
    } else if (head === "honey") {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(120,50,0,0.28)";
      g.fillRect(-r * 0.7, -r * 0.35, r * 1.4, r * 0.22);
      g.fillRect(-r * 0.7, r * 0.12, r * 1.4, r * 0.22);
      g.strokeStyle = "rgba(120,50,0,0.45)";
      g.lineWidth = lw;
      g.beginPath();
      g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      g.stroke();
    } else if (head === "lava") {
      g.beginPath();
      g.moveTo(0, -r * 1.05);
      g.quadraticCurveTo(r * 1.1, -r * 0.4, r * 0.85, r * 0.55);
      g.quadraticCurveTo(r * 0.2, r * 1.15, -r * 0.55, r * 0.85);
      g.quadraticCurveTo(-r * 1.15, r * 0.15, -r * 0.7, -r * 0.55);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      const core = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.75);
      core.addColorStop(0, "#fff3bf");
      core.addColorStop(0.45, "#ff922b");
      core.addColorStop(1, "rgba(255,107,44,0)");
      g.fillStyle = core;
      g.beginPath();
      g.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      g.fill();
    } else if (head === "ice") {
      g.beginPath();
      g.moveTo(0, -r * 1.15);
      g.lineTo(r * 0.85, -r * 0.15);
      g.lineTo(r * 0.55, r * 0.95);
      g.lineTo(-r * 0.55, r * 0.95);
      g.lineTo(-r * 0.85, -r * 0.15);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = lw;
      g.stroke();
      g.beginPath();
      g.moveTo(0, -r * 0.9);
      g.lineTo(0, r * 0.7);
      g.moveTo(-r * 0.45, -r * 0.1);
      g.lineTo(r * 0.45, -r * 0.1);
      g.stroke();
    } else if (head === "shadow") {
      g.globalAlpha = 0.92;
      g.beginPath();
      g.moveTo(-r * 0.85, r * 0.35);
      g.quadraticCurveTo(-r * 1.05, -r * 0.4, -r * 0.35, -r * 0.95);
      g.quadraticCurveTo(0, -r * 1.2, r * 0.35, -r * 0.95);
      g.quadraticCurveTo(r * 1.05, -r * 0.4, r * 0.85, r * 0.35);
      g.quadraticCurveTo(r * 0.55, r * 1.05, 0, r * 0.75);
      g.quadraticCurveTo(-r * 0.55, r * 1.05, -r * 0.85, r * 0.35);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      g.fillStyle = "rgba(190,75,219,0.95)";
      g.beginPath();
      g.ellipse(-r * 0.28, -r * 0.15, r * 0.18, r * 0.28, 0, 0, Math.PI * 2);
      g.ellipse(r * 0.28, -r * 0.15, r * 0.18, r * 0.28, 0, 0, Math.PI * 2);
      g.fill();
    } else if (head === "rainbow") {
      for (let i = RAINBOW_COLS.length - 1; i >= 0; i--) {
        g.fillStyle = RAINBOW_COLS[i];
        g.beginPath();
        g.arc(0, 0, r * (0.45 + i * 0.11), 0, Math.PI * 2);
        g.fill();
      }
    } else if (head === "gold") {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#f59f00";
      g.beginPath();
      g.moveTo(-r * 0.85, -r * 0.55);
      g.lineTo(-r * 0.55, -r * 1.15);
      g.lineTo(-r * 0.2, -r * 0.65);
      g.lineTo(0, -r * 1.25);
      g.lineTo(r * 0.2, -r * 0.65);
      g.lineTo(r * 0.55, -r * 1.15);
      g.lineTo(r * 0.85, -r * 0.55);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = lw;
      g.beginPath();
      g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      g.stroke();
    } else if (head === "ocean") {
      g.beginPath();
      g.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-r * 0.95, 0);
      g.lineTo(-r * 1.55, -r * 0.55);
      g.lineTo(-r * 1.35, 0);
      g.lineTo(-r * 1.55, r * 0.55);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.ellipse(r * 0.15, -r * 0.15, r * 0.55, r * 0.22, -0.4, 0, Math.PI * 2);
      g.fill();
    } else if (head === "graffiti") {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i - Math.PI / 8;
        const rr = i % 2 === 0 ? r * 1.15 : r * 0.7;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#ffd43b";
      g.beginPath();
      g.moveTo(0, -r * 0.45);
      g.lineTo(r * 0.18, -r * 0.1);
      g.lineTo(r * 0.5, -r * 0.1);
      g.lineTo(r * 0.22, r * 0.12);
      g.lineTo(r * 0.35, r * 0.48);
      g.lineTo(0, r * 0.25);
      g.lineTo(-r * 0.35, r * 0.48);
      g.lineTo(-r * 0.22, r * 0.12);
      g.lineTo(-r * 0.5, -r * 0.1);
      g.lineTo(-r * 0.18, -r * 0.1);
      g.closePath();
      g.fill();
    } else if (head === "forest") {
      g.beginPath();
      g.arc(0, r * 0.15, r * 0.85, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#2b8a3e";
      g.beginPath();
      g.ellipse(0, -r * 0.55, r * 0.55, r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8ce99a";
      g.beginPath();
      g.ellipse(-r * 0.45, -r * 0.15, r * 0.4, r * 0.5, -0.4, 0, Math.PI * 2);
      g.ellipse(r * 0.45, -r * 0.15, r * 0.4, r * 0.5, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#5c3d1e";
      g.fillRect(-r * 0.12, r * 0.15, r * 0.24, r * 0.7);
    } else if (head === "storm") {
      g.fillStyle = "#adb5bd";
      g.beginPath();
      g.ellipse(0, -r * 0.15, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(-r * 0.45, -r * 0.25, r * 0.45, 0, Math.PI * 2);
      g.arc(r * 0.35, -r * 0.35, r * 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = fill;
      g.beginPath();
      g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#ffe066";
      g.beginPath();
      g.moveTo(r * 0.05, -r * 0.15);
      g.lineTo(-r * 0.2, r * 0.35);
      g.lineTo(r * 0.05, r * 0.35);
      g.lineTo(-r * 0.05, r * 0.95);
      g.lineTo(r * 0.45, r * 0.2);
      g.lineTo(r * 0.15, r * 0.2);
      g.closePath();
      g.fill();
    } else if (head === "candy") {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#fff";
      g.lineWidth = lw * 1.6;
      g.beginPath();
      g.arc(0, 0, r * 0.72, 0.2, Math.PI * 1.1);
      g.stroke();
      g.strokeStyle = "#be4bdb";
      g.beginPath();
      g.arc(0, 0, r * 0.45, -0.8, Math.PI * 0.7);
      g.stroke();
      g.fillStyle = "#fff";
      g.fillRect(r * 0.75, -r * 0.12, r * 0.55, r * 0.24);
      g.strokeStyle = "#be4bdb";
      g.strokeRect(r * 0.75, -r * 0.12, r * 0.55, r * 0.24);
    } else if (head === "blueprint") {
      g.shadowBlur = 0;
      g.fillStyle = "rgba(231,245,255,0.35)";
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = lw * 1.2;
      g.stroke();
      g.beginPath();
      g.moveTo(-r * 1.1, 0);
      g.lineTo(r * 1.1, 0);
      g.moveTo(0, -r * 1.1);
      g.lineTo(0, r * 1.1);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      g.stroke();
      g.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    } else {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      if (showFace) {
        g.shadowBlur = 0;
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.beginPath();
        g.arc(-r * 0.28, -r * 0.28, r * 0.32, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.shadowBlur = 0;
    if (
      showFace &&
      head !== "pixel" &&
      head !== "shadow" &&
      head !== "blueprint" &&
      head !== "storm" &&
      head !== "graffiti"
    ) {
      g.fillStyle = "rgba(15,30,50,0.75)";
      g.beginPath();
      g.arc(-r * 0.32, -r * 0.08, r * 0.16, 0, Math.PI * 2);
      g.arc(r * 0.32, -r * 0.08, r * 0.16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(-r * 0.26, -r * 0.14, r * 0.06, 0, Math.PI * 2);
      g.arc(r * 0.38, -r * 0.14, r * 0.06, 0, Math.PI * 2);
      g.fill();
    }

    // Facing tick (skip for menu preview + some ornate heads)
    if (
      opts.showAim !== false &&
      head !== "gold" &&
      head !== "storm" &&
      head !== "candy" &&
      head !== "forest"
    ) {
      g.strokeStyle = head === "neon" ? "#e93cac" : "rgba(255,255,255,0.85)";
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(r * 0.15, 0);
      g.lineTo(r * 1.35, 0);
      g.stroke();
    }

    if (selected) {
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.lineWidth = lw * 1.35;
      g.beginPath();
      if (head === "pixel") {
        g.strokeRect(-r - lw, -r - lw, (r + lw) * 2, (r + lw) * 2);
      } else if (head === "ice") {
        g.moveTo(0, -r * 1.25);
        g.lineTo(r * 0.95, -r * 0.2);
        g.lineTo(r * 0.65, r * 1.05);
        g.lineTo(-r * 0.65, r * 1.05);
        g.lineTo(-r * 0.95, -r * 0.2);
        g.closePath();
        g.stroke();
      } else {
        g.arc(0, 0, r + lw * 1.6, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
  }

  function refreshSkinPreview() {
    const cnv = document.getElementById("skin-preview");
    if (!cnv) return;
    const g = cnv.getContext("2d");
    if (!g) return;
    const W = cnv.width;
    const H = cnv.height;
    g.clearRect(0, 0, W, H);
    const col = previewColors();
    paintSkinTrailPreview(g, col.head, col.fill, col.glow, col.rainbow, W, H);
    paintSkinFigura(g, W * 0.56, H * 0.36, 54, -0.35, {
      head: col.head,
      fill: col.fill,
      glow: col.glow,
      selected: false,
      showFace: true,
      showAim: false,
      lineScale: 3.2
    });
  }

  function refreshMenuProfile() {
    const av = document.getElementById("menu-avatar");
    const wrap = document.getElementById("menu-profile");
    const name = playerName();
    if (av) av.textContent = (name === "You" ? "P" : name.charAt(0)).toUpperCase();
    if (wrap) wrap.title = name;
  }

  function setPlayLabel(label) {
    if (!startBtn) return;
    const text = label || "Play";
    startBtn.setAttribute("aria-label", text);
    startBtn.title = text;
    if (!startBtn.querySelector(".menu-play-tri")) {
      startBtn.innerHTML = '<span class="menu-play-tri" aria-hidden="true"></span>';
    }
  }

  function syncDockActive() {
    const shown = overlay?.dataset.panel || "home";
    document.querySelectorAll(".menu-dock .dock-btn[data-panel]").forEach((btn) => {
      const id = btn.dataset.panel;
      let on = false;
      if (id === "skins") on = shown === "skins";
      else if (id === "online") on = shown === "home" && mode === "online";
      else if (id === "home") on = shown === "home" && mode !== "online";
      else on = false;
      btn.classList.toggle("active", on);
    });
  }

  function setMenuPanel(panel) {
    if (!overlay) return;
    const want = panel || "home";
    if (want === "games") {
      location.href = "../index.html#games";
      return;
    }
    if (want === "online") {
      overlay.dataset.panel = "home";
      setMode("online");
    } else if (want === "home") {
      overlay.dataset.panel = "home";
      // Only flip back to vs NPC from the Play dock when not mid-match
      if (!running) setMode("npc");
    } else {
      overlay.dataset.panel = want;
    }
    const shown = overlay.dataset.panel || "home";
    overlay.querySelectorAll(".menu-panel[data-show]").forEach((el) => {
      el.classList.toggle("hidden", el.getAttribute("data-show") !== shown);
    });
    syncDockActive();
    refreshSkinPreview();
    if (want === "online" || (want === "home" && mode === "online")) {
      onlinePanel?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }

  /** Local human uses equipped pack colors; everyone else keeps slot colors. */
  function colorFor(p) {
    if (p && p.id === localId) {
      const sk = skin();
      if (sk && skinId !== "classic" && sk.fill) {
        const head = sk.head || "classic";
        if (isAnimLandSkin(head)) {
          const fill = landAnimColor(head) || sk.fill;
          return { fill, soft: rgbaFromHex(fill, 0.8), name: sk.label || "You" };
        }
        return { fill: sk.fill, soft: sk.soft || sk.fill, name: sk.label || "You" };
      }
    }
    return COLORS[(p?.color || 0) % COLORS.length];
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const landLayer = document.createElement("canvas");
  const landCtx = landLayer.getContext("2d");
  const animLandMask = document.createElement("canvas");
  const animLandMaskCtx = animLandMask.getContext("2d");
  const animLandTint = document.createElement("canvas");
  const animLandTintCtx = animLandTint.getContext("2d");
  const miniLayer = document.createElement("canvas");
  const miniCtx = miniLayer.getContext("2d", { alpha: false });
  let landDirty = true;
  let miniDirty = true;
  let hasAnimLandMask = false;
  let lastMiniAnimAt = 0;

  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high-score");
  const hudMode = document.getElementById("hud-mode");
  const liveBoard = document.getElementById("leaderboard");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBest = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const modePicker = document.getElementById("mode-picker");
  const npcPanel = document.getElementById("npc-panel");
  const onlinePanel = document.getElementById("online-panel");
  const onlineStatus = document.getElementById("online-status");
  const onlineCode = document.getElementById("online-code");
  const onlineQuickBtn = document.getElementById("online-quick-btn");
  const onlineCreateBtn = document.getElementById("online-create-btn");
  const onlineJoinBtn = document.getElementById("online-join-btn");
  const onlineJoinInput = document.getElementById("online-join-input");
  const onlineCancelBtn = document.getElementById("online-cancel-btn");

  let bestPct = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_KEY)) || 0));
  let mode = "npc";
  let botCount = 4;
  let running = false;
  let paused = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let animId = 0;
  let lastFrame = 0;

  /** Ownership bitmap — same resolution as world for simple mapping */
  /** @type {Int16Array} */
  let grid = new Int16Array(WORLD * WORLD);
  /** @type {any[]} */
  let players = [];
  let localId = "";
  let nextBotId = 1;

  const keys = { up: false, down: false, left: false, right: false };
  let pointerAim = false;
  let aimX = WORLD / 2;
  let aimY = WORLD / 2;
  let aimDirX = 1;
  let aimDirY = 0;
  let pendingAngle = 0;
  const AIM_DEADZONE_PX = 36; // ignore mouse when it's on/near your blob
  let camX = WORLD / 2;
  let camY = WORLD / 2;
  let viewSpan = VIEW_SPAN_MIN;

  let roomCode = "";
  let isHost = false;
  let netPollTimer = 0;
  let netBusy = false;
  let lobbyAwaiting = false;
  let lobbyWatch = 0;

  let deathNote = "";
  let deathUntil = 0;

  const idMap = new Map();
  let idSeq = 1;

  function idx(x, y) {
    return y * WORLD + x;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function cellAt(x, y) {
    const cx = clamp(x | 0, 0, WORLD - 1);
    const cy = clamp(y | 0, 0, WORLD - 1);
    return grid[idx(cx, cy)];
  }

  function idHash(id) {
    if (idMap.has(id)) return idMap.get(id);
    const n = idSeq++;
    idMap.set(id, n);
    return n;
  }

  function idFromHash(n) {
    for (const [k, v] of idMap) if (v === n) return k;
    return "";
  }

  function playerName() {
    if (typeof HubPlays === "undefined") return "You";
    const name = HubPlays.sanitizeName
      ? HubPlays.sanitizeName(HubPlays.getName() || "")
      : String(HubPlays.getName() || "").trim();
    if (!name || /^guest-/i.test(name) || name.toLowerCase() === "player") return "You";
    return name.slice(0, 16);
  }

  function playerId() {
    return typeof HubPlays !== "undefined" && HubPlays.getPlayerId
      ? HubPlays.getPlayerId()
      : `local-${Math.random().toString(36).slice(2, 8)}`;
  }

  function makeCode() {
    let code = "";
    for (let i = 0; i < 4; i++) code += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    return code;
  }

  function updateBestHud() {
    if (highEl) highEl.textContent = `${bestPct}%`;
    if (overlayBest) overlayBest.innerHTML = `Best claim · <strong>${bestPct}%</strong>`;
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    window.HubPlays?.record?.("paper");
    window.HubStreak?.recordPlay?.();
  }

  function maybeSubmit(pct) {
    if (pct > bestPct) {
      bestPct = Math.floor(pct);
      try {
        localStorage.setItem(HIGH_KEY, String(bestPct));
      } catch {}
      updateBestHud();
    }
    if (bestPct <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (now - lastSubmitAt < 5000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("paper", bestPct).catch?.(() => {});
  }

  function checkAchievements(pct) {
    if (!window.HubAchievements) return;
    if (pct >= 5) HubAchievements.unlock("paper_claim_5");
    if (pct >= 15) HubAchievements.unlock("paper_claim_15");
    if (pct >= 30) HubAchievements.unlock("paper_claim_30");
  }

  function markLandDirty() {
    landDirty = true;
    miniDirty = true;
  }

  function clearGrid() {
    grid.fill(0);
    markLandDirty();
  }

  function paintDisk(hid, cx, cy, r) {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(WORLD - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(WORLD - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) grid[idx(x, y)] = hid;
      }
    }
    markLandDirty();
  }

  function paintStroke(hid, x0, y0, x1, y1, half) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.ceil(len / 0.45);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintDisk(hid, x0 + dx * t, y0 + dy * t, half);
    }
  }

  function spawnAreaClear(cx, cy, r) {
    const r2 = (r + 0.75) * (r + 0.75);
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(WORLD - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(WORLD - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        if (grid[idx(x, y)] !== 0) return false;
      }
    }
    return true;
  }

  function spawnTooClose(x, y, avoid, minDist) {
    for (const p of avoid) {
      if (!p || !p.alive) continue;
      if (Math.hypot(p.x - x, p.y - y) < minDist) return true;
    }
    return false;
  }

  function findSpawn(avoid, minDist = SPAWN_MIN_DIST) {
    const margin = Math.max(SPAWN_CLEAR_R + 12, START_R + 18);
    for (let tries = 0; tries < 400; tries++) {
      const x = margin + Math.random() * (WORLD - margin * 2);
      const y = margin + Math.random() * (WORLD - margin * 2);
      if (!spawnAreaClear(x, y, SPAWN_CLEAR_R)) continue;
      if (spawnTooClose(x, y, avoid, minDist)) continue;
      return { x, y };
    }
    // Fallback: scan for any empty pocket far enough from others
    for (let y = margin; y < WORLD - margin; y += 5) {
      for (let x = margin; x < WORLD - margin; x += 5) {
        if (!spawnAreaClear(x, y, SPAWN_CLEAR_R)) continue;
        if (spawnTooClose(x, y, avoid, minDist)) continue;
        return { x, y };
      }
    }
    return null;
  }

  /** Last resort: farthest clear spot from every living player. */
  function findFarthestSpawn(avoid) {
    const margin = Math.max(SPAWN_CLEAR_R + 12, START_R + 18);
    let best = null;
    let bestScore = -1;
    for (let tries = 0; tries < 500; tries++) {
      const x = margin + Math.random() * (WORLD - margin * 2);
      const y = margin + Math.random() * (WORLD - margin * 2);
      if (!spawnAreaClear(x, y, SPAWN_CLEAR_R)) continue;
      let nearest = Infinity;
      for (const p of avoid) {
        if (!p || !p.alive) continue;
        nearest = Math.min(nearest, Math.hypot(p.x - x, p.y - y));
      }
      if (!Number.isFinite(nearest)) nearest = WORLD;
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x, y };
      }
    }
    return best;
  }

  function pickSpawn(avoid) {
    return (
      findSpawn(avoid, SPAWN_MIN_DIST) ||
      findSpawn(avoid, SPAWN_MIN_DIST_RELAXED) ||
      findFarthestSpawn(avoid)
    );
  }

  function makePlayer(id, name, color, human) {
    const spot = pickSpawn(players) || { x: WORLD / 2, y: WORLD / 2 };
    const ang = Math.random() * Math.PI * 2;
    const p = {
      id,
      name,
      color,
      x: spot.x,
      y: spot.y,
      angle: ang,
      wantAngle: ang,
      alive: true,
      human,
      trail: /** @type {{x:number,y:number}[]} */ ([]),
      distAcc: 0,
      outside: false,
      respawnAt: 0,
      botThink: 0,
      botAngle: ang,
      botMode: "raid",
      botRaidUntil: 0
    };
    paintDisk(idHash(id), spot.x, spot.y, START_R);
    return p;
  }

  function resetArena(humans, bots) {
    clearGrid();
    idMap.clear();
    idSeq = 1;
    players = [];
    nextBotId = 1;
    for (let i = 0; i < humans.length; i++) {
      const h = humans[i];
      players.push(makePlayer(h.id, h.name, i % COLORS.length, true));
    }
    for (let i = 0; i < bots; i++) {
      const color = (humans.length + i) % COLORS.length;
      players.push(makePlayer(`bot-${nextBotId++}`, `NPC ${i + 1}`, color, false));
    }
    viewSpan = VIEW_SPAN_MIN;
    const me = localPlayer();
    if (me) {
      camX = me.x;
      camY = me.y;
    } else {
      camX = WORLD / 2;
      camY = WORLD / 2;
    }
    updateCamera(1);
  }

  function localPlayer() {
    return players.find((p) => p.id === localId) || players.find((p) => p.human) || null;
  }

  function territoryCount(hash) {
    let n = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === hash) n++;
    return n;
  }

  function pctFor(p) {
    if (!p) return 0;
    const n = territoryCount(idHash(p.id));
    if (n >= grid.length) return 100;
    // One-decimal display; treat near-full maps as 100 once sealed
    const raw = (1000 * n) / grid.length;
    return Math.round(raw) / 10;
  }

  function hasNeighborOwned(x, y, hid) {
    if (x > 0 && grid[idx(x - 1, y)] === hid) return true;
    if (x < WORLD - 1 && grid[idx(x + 1, y)] === hid) return true;
    if (y > 0 && grid[idx(x, y - 1)] === hid) return true;
    if (y < WORLD - 1 && grid[idx(x, y + 1)] === hid) return true;
    return false;
  }

  /** Fill 1-cell holes fully surrounded by your land. */
  function fillEnclosedGaps(hid) {
    let filled = 0;
    for (let y = 1; y < WORLD - 1; y++) {
      for (let x = 1; x < WORLD - 1; x++) {
        const i = idx(x, y);
        if (grid[i]) continue;
        if (
          grid[idx(x - 1, y)] === hid &&
          grid[idx(x + 1, y)] === hid &&
          grid[idx(x, y - 1)] === hid &&
          grid[idx(x, y + 1)] === hid
        ) {
          grid[i] = hid;
          filled++;
        }
      }
    }
    return filled;
  }

  /**
   * Claim empty rim cells that touch your land (walls are claimable paint,
   * but enclosure flood never fills the map border on its own).
   */
  function claimTouchingEdge(hid) {
    let filled = 0;
    let guard = 0;
    let grew = true;
    while (grew && guard++ < WORLD + 4) {
      grew = false;
      for (let x = 0; x < WORLD; x++) {
        for (const y of [0, WORLD - 1]) {
          const i = idx(x, y);
          if (grid[i]) continue;
          if (hasNeighborOwned(x, y, hid)) {
            grid[i] = hid;
            filled++;
            grew = true;
          }
        }
      }
      for (let y = 1; y < WORLD - 1; y++) {
        for (const x of [0, WORLD - 1]) {
          const i = idx(x, y);
          if (grid[i]) continue;
          if (hasNeighborOwned(x, y, hid)) {
            grid[i] = hid;
            filled++;
            grew = true;
          }
        }
      }
    }
    return filled;
  }

  /**
   * If nobody else owns any land, absorb leftover empty cells (the classic
   * ~1.1% map-rim gap that enclosure flood leaves behind).
   */
  function absorbLeftoverEmpty(p) {
    if (!p || !p.alive) return false;
    const hid = idHash(p.id);
    let empty = 0;
    let other = 0;
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v) empty++;
      else if (v !== hid) other++;
    }
    if (other > 0 || empty === 0) return false;
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]) grid[i] = hid;
    }
    markLandDirty();
    return true;
  }

  function finalizeClaim(p) {
    if (!p) return;
    const hid = idHash(p.id);
    fillEnclosedGaps(hid);
    claimTouchingEdge(hid);
    absorbLeftoverEmpty(p);
    markLandDirty();
  }

  function isOwnLand(p, x, y) {
    return cellAt(x, y) === idHash(p.id);
  }

  function showDeathFlash(reason) {
    deathNote = reason || "KO";
    deathUntil = performance.now() + 1400;
  }

  function clearPlayerCells(p) {
    const hid = idHash(p.id);
    for (let i = 0; i < grid.length; i++) if (grid[i] === hid) grid[i] = 0;
    p.trail = [];
    markLandDirty();
  }

  let stealNote = "";
  let stealUntil = 0;

  /** Steal victim's territory (+ unused trail paint) into the killer's color. */
  function transferTerritory(killer, victim) {
    if (!killer || !victim || killer === victim) {
      clearPlayerCells(victim);
      return 0;
    }
    const from = idHash(victim.id);
    const to = idHash(killer.id);
    let stolen = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === from) {
        grid[i] = to;
        stolen++;
      }
    }
    // Convert open trail into claimed land for the killer
    if (victim.trail.length) {
      let px = victim.trail[0].x;
      let py = victim.trail[0].y;
      for (let i = 1; i < victim.trail.length; i++) {
        paintStroke(to, px, py, victim.trail[i].x, victim.trail[i].y, TRAIL_W * 1.1);
        px = victim.trail[i].x;
        py = victim.trail[i].y;
      }
      paintStroke(to, px, py, victim.x, victim.y, TRAIL_W * 1.1);
    }
    victim.trail = [];
    markLandDirty();
    return stolen;
  }

  function kill(p, reason, killer) {
    if (!p.alive) return;
    const beforePct = killer && killer.alive ? pctFor(killer) : 0;
    p.alive = false;
    p.outside = false;
    let stolen = 0;
    if (killer && killer !== p && killer.alive) {
      stolen = transferTerritory(killer, p);
      finalizeClaim(killer);
    } else {
      clearPlayerCells(p);
    }
    // NPCs can come back; humans are game-over
    if (!p.human) {
      p.respawnAt = performance.now() + 2200;
    } else {
      p.respawnAt = 0;
    }
    if (killer && killer.id === localId && killer !== p) {
      window.HubSound?.play?.("score");
      const pct = pctFor(killer);
      const gained = Math.max(0, Math.round((pct - beforePct) * 10) / 10);
      stealNote = stolen > 0 ? `Took ${p.name}'s land! +${gained}%` : `Eliminated ${p.name}`;
      stealUntil = performance.now() + 2200;
      maybeSubmit(pct);
      checkAchievements(pct);
      window.HubConfetti?.burst?.();
    }
    if (p.id === localId) {
      window.HubSound?.play?.("hit");
      showDeathFlash(reason);
      gameOver(reason);
    }
  }

  function gameOver(reason) {
    if (!running) return;
    running = false;
    paused = false;
    pointerAim = false;
    const me = localPlayer();
    const pct = me ? pctFor(me) : 0;
    maybeSubmit(pct);
    checkAchievements(pct);
    resumeBtn.classList.add("hidden");
    overlayTitle.textContent = "Game Over";
    overlayText.textContent = `${reason || "You were eliminated"}. Area claimed: ${pct}%. Hit Play to try again.`;
    setPlayLabel("Play again");
    overlay.dataset.state = "over";
    setMenuPanel("home");
    refreshMenuProfile();
    refreshSkinPreview();
    overlay.classList.remove("hidden");
    cancelAnimationFrame(animId);
    draw();
    updateHud();
  }

  function capture(p) {
    const hid = idHash(p.id);
    const wasMine = new Uint8Array(grid.length);
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === hid) wasMine[i] = 1;
    }
    if (p.trail.length) {
      let px = p.trail[0].x;
      let py = p.trail[0].y;
      for (let i = 1; i < p.trail.length; i++) {
        paintStroke(hid, px, py, p.trail[i].x, p.trail[i].y, TRAIL_W * 0.85);
        px = p.trail[i].x;
        py = p.trail[i].y;
      }
      paintStroke(hid, px, py, p.x, p.y, TRAIL_W * 0.85);
    }
    p.trail = [];
    p.outside = false;

    const visited = new Uint8Array(WORLD * WORLD);
    const qx = new Int16Array(WORLD * WORLD);
    const qy = new Int16Array(WORLD * WORLD);
    let qh = 0;
    let qt = 0;
    function push(x, y) {
      if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return;
      const i = idx(x, y);
      if (visited[i] || grid[i] === hid) return;
      visited[i] = 1;
      qx[qt] = x;
      qy[qt] = y;
      qt++;
    }
    for (let x = 0; x < WORLD; x++) {
      push(x, 0);
      push(x, WORLD - 1);
    }
    for (let y = 0; y < WORLD; y++) {
      push(0, y);
      push(WORLD - 1, y);
    }
    while (qh < qt) {
      const x = qx[qh];
      const y = qy[qh++];
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    for (let i = 0; i < grid.length; i++) {
      if (!visited[i] && grid[i] !== hid) grid[i] = hid;
    }
    finalizeClaim(p);

    // Kill rivals trapped in newly claimed cells (enemy/empty land you just took)
    for (const other of players) {
      if (!other.alive || other === p || other.id === p.id) continue;
      // Never kill the capturer (guards against duplicate player rows)
      if (p.id === localId && other.id === localId) continue;
      const cx = clamp(other.x | 0, 0, WORLD - 1);
      const cy = clamp(other.y | 0, 0, WORLD - 1);
      const i = idx(cx, cy);
      if (grid[i] === hid && !wasMine[i]) {
        kill(other, `${p.name} enclosed ${other.name}`, p);
      }
    }

    // Snip rival trails that ran through the land you just stole
    for (const other of players) {
      if (!other.alive || other === p || !other.trail.length) continue;
      other.trail = other.trail.filter((pt) => {
        const i = idx(clamp(pt.x | 0, 0, WORLD - 1), clamp(pt.y | 0, 0, WORLD - 1));
        return !(grid[i] === hid && !wasMine[i]);
      });
      if (other.trail.length < 2) {
        other.trail = [];
        if (isOwnLand(other, other.x, other.y)) other.outside = false;
      }
    }
  }

  function compactTrail(trail) {
    if (!trail || trail.length <= TRAIL_SOFT_CAP) return trail;
    const head = trail[0];
    const tailStart = Math.max(1, trail.length - TRAIL_KEEP_TAIL);
    const budget = Math.max(8, TRAIL_SOFT_CAP - TRAIL_KEEP_TAIL - 1);
    const midLen = Math.max(0, tailStart - 1);
    const stride = Math.max(1, Math.ceil(midLen / budget));
    const out = [head];
    for (let i = 1; i < tailStart; i += stride) {
      out.push(trail[i]);
    }
    // Keep the joint into the dense tip so the path stays sealed to home
    const joint = trail[tailStart - 1];
    if (joint && out[out.length - 1] !== joint) out.push(joint);
    for (let i = tailStart; i < trail.length; i++) out.push(trail[i]);
    return out;
  }

  function maybeCompactTrail(p) {
    if (p.trail.length > TRAIL_SOFT_CAP) {
      p.trail = compactTrail(p.trail);
    }
  }

  function trailDrawStride(len) {
    if (len <= 400) return 1;
    if (len <= 900) return 2;
    return Math.max(3, Math.floor(len / 400));
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / ab2;
    t = clamp(t, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  }

  /**
   * True if (ox,oy) cuts p's open trail. Head bumps never count —
   * only the ribbon behind the body.
   */
  function trailHit(p, ox, oy, ignoreRecent) {
    const trail = p.trail;
    if (!trail || trail.length < 1) return false;

    // Attacker disk vs trail half-width (matches drawn ribbon)
    const hitR = ignoreRecent
      ? PLAYER_R * 0.75 + TRAIL_W * 0.45
      : PLAYER_R * 0.95 + TRAIL_W * 0.65;

    // Overlapping heads = bump, not a cut
    if (!ignoreRecent && Math.hypot(ox - p.x, oy - p.y) < PLAYER_R * 2.05) {
      return false;
    }

    function hitSeg(ax, ay, bx, by) {
      const minX = (ax < bx ? ax : bx) - hitR;
      const maxX = (ax > bx ? ax : bx) + hitR;
      const minY = (ay < by ? ay : by) - hitR;
      const maxY = (ay > by ? ay : by) + hitR;
      if (ox < minX || ox > maxX || oy < minY || oy > maxY) return false;
      return distToSeg(ox, oy, ax, ay, bx, by) <= hitR;
    }

    // Build killable polyline: trail points, then tip stopped at the head's edge
    const pts = trail.slice();
    if (pts.length >= 1) {
      const tip = pts[pts.length - 1];
      const dx = p.x - tip.x;
      const dy = p.y - tip.y;
      const len = Math.hypot(dx, dy);
      const gap = PLAYER_R * 1.05;
      if (len > gap + 0.05) {
        pts.push({
          x: tip.x + (dx / len) * (len - gap),
          y: tip.y + (dy / len) * (len - gap)
        });
      }
    }

    if (pts.length < 2) return false;

    if (ignoreRecent) {
      let dist = 0;
      let cut = pts.length;
      for (let i = pts.length - 1; i > 0; i--) {
        dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (dist >= TRAIL_IMMUNE_DIST) {
          cut = i;
          break;
        }
        cut = i;
      }
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      if (total < MIN_TRAIL_FOR_SUICIDE) return false;
      for (let i = 1; i < cut; i++) {
        if (hitSeg(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)) return true;
      }
      return false;
    }

    const denseFrom = Math.max(1, pts.length - 180);
    for (let i = denseFrom; i < pts.length; i++) {
      if (hitSeg(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)) return true;
    }
    const stride = pts.length > 500 ? 3 : pts.length > 250 ? 2 : 1;
    for (let i = stride; i < denseFrom; i += stride) {
      const a = pts[i - stride];
      const b = pts[i];
      if (hitSeg(a.x, a.y, b.x, b.y)) return true;
    }
    return false;
  }

  function respawn(p) {
    const spot = pickSpawn(players.filter((o) => o.alive && o !== p));
    if (!spot) {
      // Map too full — try again shortly instead of landing in someone's land
      p.respawnAt = performance.now() + 1200;
      return;
    }
    p.x = spot.x;
    p.y = spot.y;
    p.alive = true;
    p.trail = [];
    p.outside = false;
    p.distAcc = 0;
    p.angle = Math.random() * Math.PI * 2;
    p.wantAngle = p.angle;
    paintDisk(idHash(p.id), spot.x, spot.y, START_R);
  }

  function steerFromKeys() {
    let dx = 0;
    let dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (!dx && !dy) return null;
    const len = Math.hypot(dx, dy) || 1;
    return Math.atan2(dy / len, dx / len);
  }

  function shortestAngleDiff(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function applyTurn(p, dt) {
    const diff = shortestAngleDiff(p.angle, p.wantAngle);
    // Big redirects (side / reverse) turn faster so you can cut short
    const rate = Math.abs(diff) > 1.1 ? TURN_RATE_HARD : TURN_RATE;
    const maxStep = rate * dt;
    if (Math.abs(diff) <= maxStep) p.angle = p.wantAngle;
    else p.angle += Math.sign(diff) * maxStep;
  }

  function setLocalSteer(p) {
    if (p.id !== localId) return;
    const keyAng = steerFromKeys();
    if (keyAng != null) {
      p.wantAngle = keyAng;
      pointerAim = false;
    } else if (pointerAim) {
      // Screen-relative aim — stable with camera follow; deadzone avoids spin
      p.wantAngle = Math.atan2(aimDirY, aimDirX);
    }
    pendingAngle = p.wantAngle;
  }

  function botDecide(p, now) {
    if (now < p.botThink) {
      p.wantAngle = p.botAngle;
      return;
    }
    // Think often, with jitter so packs don't sync
    p.botThink = now + 120 + Math.random() * 380;

    if (!p.botMode) p.botMode = "raid";
    if (!p.botRaidUntil) p.botRaidUntil = 0;

    const home = isOwnLand(p, p.x, p.y);
    const trailLen = p.trail.length;
    const origin = trailLen ? p.trail[0] : null;
    const outDist = origin ? Math.hypot(p.x - origin.x, p.y - origin.y) : 0;

    // Sometimes chase a nearby exposed rival tip
    if (Math.random() < 0.4) {
      let hunt = null;
      let huntD = 36 + Math.random() * 28;
      for (const other of players) {
        if (other === p || !other.alive || !other.outside || other.trail.length < 3) {
          continue;
        }
        const tip = other.trail[other.trail.length - 1];
        const d = Math.hypot(tip.x - p.x, tip.y - p.y);
        if (d < huntD) {
          huntD = d;
          hunt = tip;
        }
      }
      if (hunt) {
        p.botMode = "raid";
        p.botRaidUntil = Math.max(p.botRaidUntil, now + 900 + Math.random() * 1600);
        p.botAngle = Math.atan2(hunt.y - p.y, hunt.x - p.x) + (Math.random() - 0.5) * 0.35;
        p.wantAngle = p.botAngle;
        return;
      }
    }

    if (home) {
      // Push out of base — commit to a longer raid
      p.botMode = "raid";
      p.botRaidUntil = now + 2800 + Math.random() * 7000; // ~3–10s out
      p.botAngle = Math.random() * Math.PI * 2;
      // Prefer leaving toward open map, not staying in base
      p.botAngle += (Math.random() - 0.5) * 0.5;
    } else if (
      p.botMode === "raid" &&
      now < p.botRaidUntil &&
      trailLen < 520 &&
      outDist < 110 + Math.random() * 50
    ) {
      // Stay out exploring — wiggly / sudden new headings
      if (Math.random() < 0.22) {
        p.botAngle = Math.random() * Math.PI * 2;
      } else {
        p.botAngle += (Math.random() - 0.5) * 1.6;
      }
      // Rare mid-raid spiral cut to make tasty loops
      if (Math.random() < 0.08) {
        p.botAngle += (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.2);
      }
    } else {
      // Head home, but not in a perfect laser line
      p.botMode = "return";
      let best = null;
      let bestD = 1e9;
      const hid = idHash(p.id);
      const step = 5 + ((idHash(p.id) * 3) % 4);
      for (let y = 2; y < WORLD; y += step) {
        for (let x = 2; x < WORLD; x += step) {
          if (grid[idx(x, y)] !== hid) continue;
          const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
          if (d < bestD) {
            bestD = d;
            best = { x: x + 0.5, y: y + 0.5 };
          }
        }
      }
      if (best) {
        p.botAngle =
          Math.atan2(best.y - p.y, best.x - p.x) + (Math.random() - 0.5) * 0.75;
      } else {
        p.botAngle += (Math.random() - 0.5) * 1.1;
      }
      // After a successful return, plan another raid soon
      if (home) {
        p.botMode = "raid";
        p.botRaidUntil = now + 2000 + Math.random() * 5000;
      }
    }

    // Soft edge avoidance
    const margin = 16;
    if (p.x < margin) p.botAngle = 0.15 + Math.random() * 0.4;
    if (p.x > WORLD - margin) p.botAngle = Math.PI - (0.15 + Math.random() * 0.4);
    if (p.y < margin) p.botAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    if (p.y > WORLD - margin) p.botAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;

    p.wantAngle = p.botAngle;
  }

  function stepPlayer(p, dt) {
    if (!p.alive) return;

    if (p.human) {
      if (mode === "online" && p.id !== localId) {
        // angle set from net inputs → wantAngle
      } else {
        setLocalSteer(p);
      }
      applyTurn(p, dt);
    } else {
      botDecide(p, performance.now());
      applyTurn(p, dt);
    }

    const nxRaw = p.x + Math.cos(p.angle) * SPEED * dt;
    const nyRaw = p.y + Math.sin(p.angle) * SPEED * dt;

    // Walls are solid — slide along them (no bounce), never KO
    const edge = PLAYER_R + 0.35;
    let nx = clamp(nxRaw, edge, WORLD - edge);
    let ny = clamp(nyRaw, edge, WORLD - edge);

    // Solid heads: block / slide, never tunnel through, never KO
    {
      const moved = separateFromHeads(p, nx, ny, edge);
      nx = moved.x;
      ny = moved.y;
    }

    // Trail cuts kill; head bumps only block (above). Can cut from your own land too.
    for (const other of players) {
      if (other === p || !other.alive) continue;
      if (!other.outside || other.trail.length < 1) continue;
      // Don't count a cut while glued to their head
      if (Math.hypot(nx - other.x, ny - other.y) < HEAD_SEP * 0.98) continue;
      if (trailHit(other, nx, ny, false)) {
        kill(other, `${p.name} eliminated ${other.name}`, p);
      }
    }

    const wasHome = isOwnLand(p, p.x, p.y);
    const nowHome = isOwnLand(p, nx, ny);

    const ox = p.x;
    const oy = p.y;
    p.x = nx;
    p.y = ny;

    // Only leave a trail once you actually leave your land
    if (wasHome && !nowHome) {
      p.outside = true;
      p.trail = [{ x: ox, y: oy }, { x: nx, y: ny }];
      p.distAcc = 0;
    } else if (p.outside && !nowHome) {
      p.distAcc += Math.hypot(nx - ox, ny - oy);
      while (p.distAcc >= TRAIL_STEP) {
        p.distAcc -= TRAIL_STEP;
        p.trail.push({ x: p.x, y: p.y });
      }
      maybeCompactTrail(p);
    } else if (p.outside && nowHome && p.trail.length >= 2) {
      capture(p);
      if (p.id === localId) {
        window.HubSound?.play?.("score");
        const pct = pctFor(p);
        maybeSubmit(pct);
        checkAchievements(pct);
        if (pct >= 20) window.HubConfetti?.burst?.();
      }
    } else if (wasHome && nowHome) {
      p.outside = false;
      p.trail = [];
    }
  }

  /**
   * Keep proposed (nx,ny) outside every other head.
   * Block + slide only — no heading bounce.
   */
  function separateFromHeads(p, nx, ny, edge) {
    for (let iter = 0; iter < 5; iter++) {
      let hit = false;
      for (const other of players) {
        if (other === p || !other.alive) continue;
        let dx = nx - other.x;
        let dy = ny - other.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= HEAD_SEP) continue;
        hit = true;

        const ox = p.x - other.x;
        const oy = p.y - other.y;
        const odist = Math.hypot(ox, oy);

        // Stay on the approach side (prevents tunneling to the far side)
        if (odist > 1e-5 && (dist < 1e-5 || ox * dx + oy * dy < 0)) {
          dx = ox;
          dy = oy;
          dist = odist;
        }
        if (dist < 1e-5) {
          dx = Math.cos(p.angle + Math.PI);
          dy = Math.sin(p.angle + Math.PI);
          dist = 1;
        }

        const nxN = dx / dist;
        const nyN = dy / dist;
        // Snap to surface, then keep only the tangential part of this step
        let sx = other.x + nxN * HEAD_SEP;
        let sy = other.y + nyN * HEAD_SEP;
        const mx = nx - p.x;
        const my = ny - p.y;
        const into = mx * nxN + my * nyN;
        if (into < 0) {
          // Moving into the other head — cancel inward component (slide)
          sx = p.x + mx - nxN * into;
          sy = p.y + my - nyN * into;
          // Re-enforce surface if still overlapping
          const dx2 = sx - other.x;
          const dy2 = sy - other.y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 < HEAD_SEP && d2 > 1e-5) {
            sx = other.x + (dx2 / d2) * HEAD_SEP;
            sy = other.y + (dy2 / d2) * HEAD_SEP;
          } else if (d2 <= 1e-5) {
            sx = other.x + nxN * HEAD_SEP;
            sy = other.y + nyN * HEAD_SEP;
          }
        }
        nx = clamp(sx, edge, WORLD - edge);
        ny = clamp(sy, edge, WORLD - edge);
      }
      if (!hit) break;
    }
    return { x: nx, y: ny };
  }

  function resolveHeadCollisions() {
    const edge = PLAYER_R + 0.35;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < players.length; i++) {
        const a = players[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < players.length; j++) {
          const b = players[j];
          if (!b.alive) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist >= HEAD_SEP) continue;
          if (dist < 1e-6) {
            const ang = a.angle + Math.PI * 0.5;
            dx = Math.cos(ang);
            dy = Math.sin(ang);
            dist = 1e-6;
          }
          const overlap = (HEAD_SEP - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x = clamp(a.x - nx * overlap, edge, WORLD - edge);
          a.y = clamp(a.y - ny * overlap, edge, WORLD - edge);
          b.x = clamp(b.x + nx * overlap, edge, WORLD - edge);
          b.y = clamp(b.y + ny * overlap, edge, WORLD - edge);
        }
      }
    }
  }

  function tick(dt) {
    const now = performance.now();
    // Cap huge frames so collision can't be skipped by a long stall
    const stepDt = Math.min(0.05, Math.max(0, dt || 0.016));
    for (const p of players) {
      if (!p.alive) {
        // Only NPCs respawn; humans stay out until Play again
        if (!p.human && p.respawnAt && now >= p.respawnAt) {
          p.respawnAt = 0;
          respawn(p);
        }
        continue;
      }
      stepPlayer(p, stepDt);
    }

    resolveHeadCollisions();
  }

  function worldToScreen(x, y) {
    const s = Math.min(canvas.width, canvas.height) / viewSpan;
    return {
      x: (x - camX) * s + canvas.width / 2,
      y: (y - camY) * s + canvas.height / 2
    };
  }

  function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const s = Math.min(canvas.width, canvas.height) / viewSpan;
    const cx = ((sx - rect.left) / rect.width) * canvas.width;
    const cy = ((sy - rect.top) / rect.height) * canvas.height;
    return {
      x: (cx - canvas.width / 2) / s + camX,
      y: (cy - canvas.height / 2) / s + camY
    };
  }

  function updateCamera(dt) {
    const me = typeof localPlayer === "function" ? localPlayer() : null;
    if (me) {
      const pct = Math.max(0, pctFor(me)) / 100;
      const targetSpan = clamp(
        VIEW_SPAN_MIN + pct * (VIEW_SPAN_MAX - VIEW_SPAN_MIN) * 1.15,
        VIEW_SPAN_MIN,
        VIEW_SPAN_MAX
      );
      const k = 1 - Math.exp(-Math.max(0.001, dt || 0.016) * 9);
      viewSpan += (targetSpan - viewSpan) * k;
      camX += (me.x - camX) * k;
      camY += (me.y - camY) * k;
    }
    if (viewSpan >= WORLD) {
      camX = WORLD / 2;
      camY = WORLD / 2;
    } else {
      const half = viewSpan / 2;
      camX = clamp(camX, half, WORLD - half);
      camY = clamp(camY, half, WORLD - half);
    }
  }

  function landSkinHead() {
    if (!localId || skinId === "classic") return "classic";
    return skin()?.head || "classic";
  }

  function cellSeed(x, y) {
    return (Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
  }

  function isInteriorOwned(x, y, hid) {
    if (x <= 0 || y <= 0 || x >= WORLD - 1 || y >= WORLD - 1) return false;
    return (
      grid[idx(x - 1, y)] === hid &&
      grid[idx(x + 1, y)] === hid &&
      grid[idx(x, y - 1)] === hid &&
      grid[idx(x, y + 1)] === hid
    );
  }

  /** Themed props inside claimed land (trees, waves, hexes, …). */
  function stampLandMotif(g, cx, cy, px, head, seed, fill) {
    // Props span ~2–3 cells so they read clearly when zoomed out
    const s = px * 2.35;
    if (head === "forest") {
      if (seed % 72 !== 0) return;
      g.fillStyle = "#5c3d1e";
      g.fillRect(cx - s * 0.14, cy - s * 0.05, s * 0.28, s * 0.85);
      g.fillStyle = seed % 144 === 0 ? "#2f9e44" : "#40c057";
      g.beginPath();
      g.moveTo(cx, cy - s * 1.35);
      g.lineTo(cx + s * 0.7, cy - s * 0.05);
      g.lineTo(cx - s * 0.7, cy - s * 0.05);
      g.closePath();
      g.fill();
      g.fillStyle = "#8ce99a";
      g.beginPath();
      g.moveTo(cx, cy - s * 0.85);
      g.lineTo(cx + s * 0.52, cy + s * 0.15);
      g.lineTo(cx - s * 0.52, cy + s * 0.15);
      g.closePath();
      g.fill();
      return;
    }
    if (head === "ocean") {
      if (seed % 48 === 0) {
        g.strokeStyle = "rgba(200,240,255,0.6)";
        g.lineWidth = px * 0.28;
        g.beginPath();
        g.moveTo(cx - s * 0.7, cy);
        g.quadraticCurveTo(cx - s * 0.25, cy - s * 0.45, cx + s * 0.2, cy);
        g.quadraticCurveTo(cx + s * 0.5, cy + s * 0.4, cx + s * 0.85, cy - s * 0.05);
        g.stroke();
      }
      if (seed % 61 === 0) {
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.beginPath();
        g.arc(cx + s * 0.25, cy - s * 0.3, s * 0.28, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    if (head === "lava") {
      if (seed % 52 === 0) {
        g.strokeStyle = "rgba(255,212,59,0.75)";
        g.lineWidth = px * 0.24;
        g.beginPath();
        g.moveTo(cx - s * 0.55, cy - s * 0.25);
        g.lineTo(cx - s * 0.05, cy + s * 0.2);
        g.lineTo(cx + s * 0.45, cy - s * 0.15);
        g.lineTo(cx + s * 0.7, cy + s * 0.45);
        g.stroke();
      }
      if (seed % 41 === 0) {
        g.fillStyle = seed % 82 === 0 ? "#ffe066" : "#ff922b";
        g.beginPath();
        g.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    if (head === "ice") {
      if (seed % 55 !== 0) return;
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = px * 0.22;
      g.beginPath();
      g.moveTo(cx, cy - s * 0.75);
      g.lineTo(cx, cy + s * 0.75);
      g.moveTo(cx - s * 0.65, cy);
      g.lineTo(cx + s * 0.65, cy);
      g.moveTo(cx - s * 0.5, cy - s * 0.5);
      g.lineTo(cx + s * 0.5, cy + s * 0.5);
      g.stroke();
      return;
    }
    if (head === "ink") {
      if (seed % 58 !== 0) return;
      g.fillStyle = "rgba(10,10,14,0.5)";
      g.beginPath();
      g.ellipse(cx, cy, s * 0.5, s * 0.32, (seed % 5) * 0.4, 0, Math.PI * 2);
      g.fill();
      return;
    }
    if (head === "neon") {
      if (seed % 64 !== 0) return;
      g.strokeStyle = seed % 128 === 0 ? "#e93cac" : fill || "#22d3ee";
      g.lineWidth = px * 0.28;
      g.beginPath();
      g.moveTo(cx - s * 0.5, cy);
      g.lineTo(cx + s * 0.5, cy);
      g.moveTo(cx, cy - s * 0.5);
      g.lineTo(cx, cy + s * 0.5);
      g.stroke();
      return;
    }
    if (head === "shadow") {
      if (seed % 58 !== 0) return;
      g.fillStyle = "rgba(190,75,219,0.4)";
      g.beginPath();
      g.ellipse(cx, cy, s * 0.55, s * 0.35, 0.3, 0, Math.PI * 2);
      g.fill();
      return;
    }
    if (head === "rainbow") {
      if (seed % 78 !== 0) return;
      g.lineWidth = px * 0.22;
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = RAINBOW_COLS[i];
        g.beginPath();
        g.arc(cx, cy + s * 0.25, s * (0.35 + i * 0.12), Math.PI, 0);
        g.stroke();
      }
      return;
    }
    if (head === "gold") {
      if (seed % 64 !== 0) return;
      g.fillStyle = "rgba(255,236,153,0.75)";
      g.beginPath();
      g.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(230,119,0,0.7)";
      g.lineWidth = px * 0.18;
      g.stroke();
      return;
    }
    if (head === "graffiti") {
      if (seed % 55 !== 0) return;
      g.fillStyle = seed % 110 === 0 ? "#ffd43b" : fill || "#ff6bcb";
      g.beginPath();
      g.moveTo(cx, cy - s * 0.55);
      g.lineTo(cx + s * 0.2, cy - s * 0.1);
      g.lineTo(cx + s * 0.58, cy - s * 0.1);
      g.lineTo(cx + s * 0.28, cy + s * 0.16);
      g.lineTo(cx + s * 0.38, cy + s * 0.58);
      g.lineTo(cx, cy + s * 0.28);
      g.lineTo(cx - s * 0.38, cy + s * 0.58);
      g.lineTo(cx - s * 0.28, cy + s * 0.16);
      g.lineTo(cx - s * 0.58, cy - s * 0.1);
      g.lineTo(cx - s * 0.2, cy - s * 0.1);
      g.closePath();
      g.fill();
      return;
    }
    if (head === "storm") {
      if (seed % 68 !== 0) return;
      g.fillStyle = "#ffe066";
      g.beginPath();
      g.moveTo(cx + s * 0.08, cy - s * 0.65);
      g.lineTo(cx - s * 0.3, cy + s * 0.05);
      g.lineTo(cx + s * 0.08, cy + s * 0.05);
      g.lineTo(cx - s * 0.08, cy + s * 0.7);
      g.lineTo(cx + s * 0.5, cy - s * 0.05);
      g.lineTo(cx + s * 0.15, cy - s * 0.05);
      g.closePath();
      g.fill();
      return;
    }
    if (head === "candy") {
      if (seed % 61 !== 0) return;
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#be4bdb";
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, s * 0.42, -0.4, 1.2);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, s * 0.42, 2.4, 4.0);
      g.closePath();
      g.fill();
      return;
    }
    if (head === "blueprint") {
      if (seed % 45 !== 0) return;
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.lineWidth = px * 0.16;
      g.strokeRect(cx - s * 0.5, cy - s * 0.5, s, s);
      g.beginPath();
      g.moveTo(cx - s * 0.65, cy);
      g.lineTo(cx + s * 0.65, cy);
      g.moveTo(cx, cy - s * 0.65);
      g.lineTo(cx, cy + s * 0.65);
      g.stroke();
    }
  }

  function ensureAnimLandCanvases(W) {
    if (animLandMask.width !== W || animLandMask.height !== W) {
      animLandMask.width = W;
      animLandMask.height = W;
      animLandTint.width = W;
      animLandTint.height = W;
    }
  }

  function drawAnimLandTint(scale) {
    const head = landSkinHead();
    if (!hasAnimLandMask || !isAnimLandSkin(head)) return;
    const W = animLandMask.width;
    if (!W) return;
    const fill = landAnimColor(head) || skin()?.fill || "#ffffff";
    animLandTintCtx.save();
    animLandTintCtx.setTransform(1, 0, 0, 1, 0, 0);
    animLandTintCtx.globalCompositeOperation = "copy";
    animLandTintCtx.fillStyle = rgbaFromHex(fill, 0.82);
    animLandTintCtx.fillRect(0, 0, W, W);
    animLandTintCtx.globalCompositeOperation = "destination-in";
    animLandTintCtx.drawImage(animLandMask, 0, 0);
    animLandTintCtx.restore();

    if (typeof ctx.filter === "string") {
      ctx.filter = `blur(${(0.22 * scale).toFixed(2)}px)`;
      ctx.drawImage(animLandTint, 0, 0, W, W, 0, 0, WORLD, WORLD);
      ctx.filter = "none";
      ctx.globalAlpha = 0.65;
      ctx.drawImage(animLandTint, 0, 0, W, W, 0, 0, WORLD, WORLD);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(animLandTint, 0, 0, W, W, 0, 0, WORLD, WORLD);
    }
  }

  function paintLandLayer() {
    const W = WORLD * LAND_PX;
    if (landLayer.width !== W || landLayer.height !== W) {
      landLayer.width = W;
      landLayer.height = W;
      landDirty = true;
    }
    ensureAnimLandCanvases(W);
    if (!landDirty) return;
    landDirty = false;
    landCtx.clearRect(0, 0, W, W);
    landCtx.imageSmoothingEnabled = true;
    animLandMaskCtx.clearRect(0, 0, W, W);
    animLandMaskCtx.imageSmoothingEnabled = true;
    hasAnimLandMask = false;

    const animHead = landSkinHead();
    const animLocal = isAnimLandSkin(animHead) && localId;
    const localHid = animLocal ? idHash(localId) : 0;

    // Soft overlapping disks at hi-res merge into smooth blobs when zoomed
    const rad = LAND_PX * 0.78;
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        const owner = grid[idx(x, y)];
        if (!owner) continue;
        const cx = (x + 0.5) * LAND_PX;
        const cy = (y + 0.5) * LAND_PX;
        if (animLocal && owner === localHid) {
          // White mask — tinted each frame for rainbow/neon land
          animLandMaskCtx.fillStyle = "rgba(255,255,255,0.92)";
          animLandMaskCtx.beginPath();
          animLandMaskCtx.arc(cx, cy, rad, 0, Math.PI * 2);
          animLandMaskCtx.fill();
          hasAnimLandMask = true;
          continue;
        }
        const pid = idFromHash(owner);
        const pl = players.find((p) => p.id === pid);
        const color = pl
          ? colorFor(pl)
          : COLORS[(owner - 1) % COLORS.length];
        landCtx.fillStyle = color.soft;
        landCtx.beginPath();
        landCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        landCtx.fill();
      }
    }

    // Themed props inside your claimed land (arena floor stays classic)
    const head = animHead;
    if (head !== "classic" && localId) {
      const hid = idHash(localId);
      const fill = skin()?.fill || COLORS[0].fill;
      const px = LAND_PX;
      // Props sit on the static layer for non-anim skins; for rainbow/neon
      // draw them into the mask so they tint with the land.
      const propCtx = isAnimLandSkin(head) ? animLandMaskCtx : landCtx;
      propCtx.save();
      propCtx.lineCap = "round";
      propCtx.lineJoin = "round";
      for (let y = 0; y < WORLD; y++) {
        for (let x = 0; x < WORLD; x++) {
          if (grid[idx(x, y)] !== hid) continue;
          const seed = cellSeed(x, y);
          const cx = (x + 0.5) * px;
          const cy = (y + 0.5) * px;

          if (head === "pixel") {
            if (x % 4 === 0 && y % 4 === 0) {
              propCtx.fillStyle = "rgba(255,255,255,0.16)";
              propCtx.fillRect(x * px, y * px, px * 2, px * 2);
            } else if (seed % 72 === 0 && isInteriorOwned(x, y, hid)) {
              propCtx.fillStyle = "#ffd43b";
              propCtx.fillRect(cx - px * 0.55, cy - px * 0.55, px * 1.1, px * 1.1);
            }
            continue;
          }

          if (head === "honey") {
            if (x % 6 === 0 && y % 6 === 0 && isInteriorOwned(x, y, hid)) {
              propCtx.strokeStyle = "rgba(120,50,0,0.38)";
              propCtx.lineWidth = px * 0.2;
              propCtx.beginPath();
              const hs = px * 2.1;
              for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i + Math.PI / 6;
                const hx = cx + Math.cos(a) * hs * 0.55;
                const hy = cy + Math.sin(a) * hs * 0.55;
                if (i === 0) propCtx.moveTo(hx, hy);
                else propCtx.lineTo(hx, hy);
              }
              propCtx.closePath();
              propCtx.stroke();
            }
            continue;
          }

          if (
            (head === "forest" ||
              head === "storm" ||
              head === "gold" ||
              head === "graffiti" ||
              head === "rainbow") &&
            !isInteriorOwned(x, y, hid)
          ) {
            continue;
          }
          stampLandMotif(propCtx, cx, cy, px, head, seed, fill);
        }
      }
      propCtx.restore();
    }
  }

  function paintMiniLayer() {
    if (miniLayer.width !== WORLD || miniLayer.height !== WORLD) {
      miniLayer.width = WORLD;
      miniLayer.height = WORLD;
      miniDirty = true;
    }
    if (!miniDirty) return;
    miniDirty = false;
    miniCtx.fillStyle = "#0c1a2a";
    miniCtx.fillRect(0, 0, WORLD, WORLD);
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        const owner = grid[idx(x, y)];
        if (!owner) continue;
        const pid = idFromHash(owner);
        const pl = players.find((p) => p.id === pid);
        const color = pl
          ? colorFor(pl)
          : COLORS[(owner - 1) % COLORS.length];
        miniCtx.fillStyle = color.fill;
        miniCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawMinimap(w, h) {
    const size = Math.round(Math.min(w, h) * 0.2);
    const pad = Math.round(Math.min(w, h) * 0.022);
    const x0 = w - size - pad;
    const y0 = h - size - pad;
    const inset = 4;
    const mapX = x0 + inset;
    const mapY = y0 + inset;
    const mapS = size - inset * 2;
    const cell = mapS / WORLD;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    // Panel chrome
    ctx.fillStyle = "rgba(6, 12, 20, 0.88)";
    ctx.strokeStyle = "rgba(62, 198, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = 10;
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + size, y0, x0 + size, y0 + size, r);
    ctx.arcTo(x0 + size, y0 + size, x0, y0 + size, r);
    ctx.arcTo(x0, y0 + size, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + size, y0, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Clip map contents so nothing bleeds past the frame
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapS, mapS);
    ctx.clip();

    paintMiniLayer();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(miniLayer, 0, 0, WORLD, WORLD, mapX, mapY, mapS, mapS);

    // Trails — subsample so long trails don't flicker/overdraw
    for (const p of players) {
      if (!p.alive || p.trail.length < 2) continue;
      const c = colorFor(p);
      const step = Math.max(1, Math.floor(p.trail.length / 80));
      ctx.strokeStyle = c.fill;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1.25, cell * 1.4);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(mapX + p.trail[0].x * cell, mapY + p.trail[0].y * cell);
      for (let i = step; i < p.trail.length; i += step) {
        ctx.lineTo(mapX + p.trail[i].x * cell, mapY + p.trail[i].y * cell);
      }
      ctx.lineTo(mapX + p.x * cell, mapY + p.y * cell);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Players
    for (const p of players) {
      if (!p.alive) continue;
      const c = colorFor(p);
      const px = mapX + p.x * cell;
      const py = mapY + p.y * cell;
      const isMe = p.id === localId;
      const pr = isMe ? 3.2 : 2.2;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      if (isMe) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.restore(); // end clip

    ctx.strokeStyle = "rgba(62, 198, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX + 0.5, mapY + 0.5, mapS - 1, mapS - 1);
    ctx.restore();
  }

  function drawPlayerHead(p, c) {
    const r = HEAD_DRAW_R;
    const sk = p.id === localId ? skin() : null;
    const head = sk?.head || "classic";
    const glow = sk?.trailGlow || c.fill;

    paintSkinFigura(ctx, p.x, p.y, r, p.angle, {
      head: p.id === localId ? head : "classic",
      fill: c.fill,
      glow,
      selected: false,
      showFace: true,
      lineScale: 0.22
    });

    ctx.fillStyle = "rgba(6,12,20,0.72)";
    ctx.font = "bold 1.85px Fredoka,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(p.name.slice(0, 10), p.x, p.y - r - 0.55);
  }

  function trailPoints(p) {
    const stride = trailDrawStride(p.trail.length);
    const pts = [];
    if (!p.trail.length) return pts;
    pts.push(p.trail[0]);
    for (let i = stride; i < p.trail.length; i += stride) pts.push(p.trail[i]);
    const last = p.trail[p.trail.length - 1];
    if (last) pts.push(last);
    const tip = pts[pts.length - 1] || { x: p.x, y: p.y };
    const dx = p.x - tip.x;
    const dy = p.y - tip.y;
    const len = Math.hypot(dx, dy) || 1;
    const gap = PLAYER_R * 1.05;
    if (len > gap) {
      pts.push({ x: p.x - (dx / len) * gap, y: p.y - (dy / len) * gap });
    }
    return pts;
  }

  function strokeTrailPath(pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function drawTrail(p, c) {
    if (!p.alive || p.trail.length < 1) return;
    const sk = p.id === localId ? skin() : null;
    const head = sk && p.id === localId ? sk.head || "classic" : "classic";
    const glow = sk?.trailGlow || c.fill;
    const useRainbow = !!(sk?.rainbow && p.id === localId) || head === "rainbow";
    const pts = trailPoints(p);
    if (pts.length < 2) return;

    ctx.globalAlpha = 0.92;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 0;

    if (useRainbow) {
      ctx.lineWidth = TRAIL_W * 1.2;
      for (let i = 1; i < pts.length; i++) {
        ctx.strokeStyle = rainbowAt(i);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    } else if (head === "neon") {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 2.2;
      ctx.strokeStyle = "#e93cac";
      ctx.lineWidth = TRAIL_W * 1.55;
      strokeTrailPath(pts);
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 0.7;
      strokeTrailPath(pts);
    } else if (head === "pixel") {
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.35;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        ctx.lineTo(b.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    } else if (head === "honey" || head === "candy") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.2;
      ctx.setLineDash([TRAIL_W * 1.8, TRAIL_W * 1.2]);
      if (p.trail.length < 220) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 1.2;
      }
      strokeTrailPath(pts);
      ctx.setLineDash([]);
    } else if (head === "blueprint" || head === "ice") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.05;
      ctx.setLineDash([TRAIL_W * 2.4, TRAIL_W * 1.6]);
      strokeTrailPath(pts);
      ctx.setLineDash([]);
    } else if (head === "storm") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.15;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 1.6;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        const ox = (b.y - a.y) * (i % 2 === 0 ? 0.35 : -0.35);
        const oy = (a.x - b.x) * (i % 2 === 0 ? 0.35 : -0.35);
        ctx.lineTo(mx + ox, my + oy);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    } else if (head === "shadow") {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.6;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 2.4;
      strokeTrailPath(pts);
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = TRAIL_W * 0.7;
      ctx.strokeStyle = "rgba(190,75,219,0.75)";
      strokeTrailPath(pts);
    } else if (head === "ink") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.45;
      ctx.lineCap = "round";
      if (p.trail.length < 220) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 1.2;
      }
      strokeTrailPath(pts);
      ctx.fillStyle = c.fill;
      for (let i = 2; i < pts.length; i += 3) {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, TRAIL_W * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (head === "graffiti") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.25;
      strokeTrailPath(pts);
      ctx.strokeStyle = "#ffd43b";
      ctx.lineWidth = TRAIL_W * 0.45;
      ctx.setLineDash([TRAIL_W * 0.8, TRAIL_W * 1.4]);
      strokeTrailPath(pts);
      ctx.setLineDash([]);
    } else if (head === "forest") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.2;
      strokeTrailPath(pts);
      ctx.fillStyle = "#8ce99a";
      for (let i = 2; i < pts.length; i += 4) {
        const q = pts[i];
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, TRAIL_W * 0.55, TRAIL_W * 0.85, i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (head === "gold") {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.3;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 2;
      strokeTrailPath(pts);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = TRAIL_W * 0.35;
      ctx.shadowBlur = 0;
      strokeTrailPath(pts);
    } else {
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = TRAIL_W * 1.15;
      if (p.trail.length < 220) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 1.4;
      }
      strokeTrailPath(pts);
    }

    if (head === "ocean" || head === "lava") {
      ctx.shadowBlur = 0;
      ctx.fillStyle = head === "ocean" ? "rgba(200,240,255,0.8)" : "rgba(255,220,80,0.85)";
      const step = Math.max(2, Math.floor(pts.length / 18));
      for (let i = step; i < pts.length; i += step) {
        const q = pts[i];
        ctx.beginPath();
        ctx.arc(q.x, q.y, TRAIL_W * (head === "ocean" ? 0.45 : 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const scale = Math.min(w, h) / viewSpan;
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.08, w * 0.5, h * 0.5, w * 0.75);
    bg.addColorStop(0, "#102338");
    bg.addColorStop(1, "#060d16");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    // Soft border (walls don't kill) — world units (arena stays classic for all skins)
    ctx.strokeStyle = "rgba(62,198,255,0.35)";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(0.5, 0.5, WORLD - 1, WORLD - 1);

    // Faint grid so zoomed view keeps depth
    ctx.strokeStyle = "rgba(62,198,255,0.06)";
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    for (let g = 0; g <= WORLD; g += 10) {
      ctx.moveTo(g, 0);
      ctx.lineTo(g, WORLD);
      ctx.moveTo(0, g);
      ctx.lineTo(WORLD, g);
    }
    ctx.stroke();

    paintLandLayer();
    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = "high";
    } catch {}
    // Light screen-space soften so cell edges don't read as pixels when zoomed
    if (typeof ctx.filter === "string") {
      ctx.filter = `blur(${(0.22 * scale).toFixed(2)}px)`;
      ctx.drawImage(landLayer, 0, 0, landLayer.width, landLayer.height, 0, 0, WORLD, WORLD);
      ctx.filter = "none";
      ctx.globalAlpha = 0.65;
      ctx.drawImage(landLayer, 0, 0, landLayer.width, landLayer.height, 0, 0, WORLD, WORLD);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(landLayer, 0, 0, landLayer.width, landLayer.height, 0, 0, WORLD, WORLD);
    }
    drawAnimLandTint(scale);

    // Keep minimap in sync while land color cycles
    if (isAnimLandSkin(landSkinHead())) {
      const now = performance.now();
      if (now - lastMiniAnimAt > 80) {
        lastMiniAnimAt = now;
        miniDirty = true;
      }
    }

    for (const p of players) drawTrail(p, colorFor(p));
    for (const p of players) {
      if (!p.alive) continue;
      drawPlayerHead(p, colorFor(p));
    }

    ctx.restore();

    drawMinimap(w, h);

    if (performance.now() < stealUntil) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, h * 0.12, w, h * 0.12);
      ctx.fillStyle = "#7dff9a";
      ctx.font = "bold 26px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stealNote, w / 2, h * 0.18);
    }

    if (performance.now() < deathUntil) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, h * 0.42, w, h * 0.16);
      ctx.fillStyle = "#ffb4ab";
      ctx.font = "bold 28px Outfit,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(deathNote, w / 2, h * 0.5);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateHud() {
    const me = localPlayer();
    const pct = me ? pctFor(me) : 0;
    if (scoreEl) scoreEl.textContent = `${pct}%`;
    maybeSubmit(pct);
    if (liveBoard) {
      const ranked = players
        .map((p) => ({ p, pct: pctFor(p) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6);
      liveBoard.innerHTML = ranked
        .map(({ p, pct: v }) => {
          const c = colorFor(p).fill;
          const mark = p.id === localId ? "★ " : "";
          const dead = p.alive ? "" : " (out)";
          return `<span class="lb-item"><span class="swatch" style="background:${c}"></span>${mark}${escapeHtml(
            p.name
          )} ${v}%${dead}</span>`;
        })
        .join("");
    }
  }

  function loop(ts) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (paused) {
      draw();
      return;
    }
    if (!lastFrame) lastFrame = ts;
    let dt = (ts - lastFrame) / 1000;
    lastFrame = ts;
    if (dt > 0.05) dt = 0.05;
    if (mode !== "online" || isHost) tick(dt);
    updateCamera(dt);
    draw();
    updateHud();
  }

  function startNpc(opts) {
    ensureSession();
    localId = opts.localId || playerId();
    const humans = opts.humans || [{ id: localId, name: playerName() }];
    const bots = opts.bots ?? botCount;
    pointerAim = false;
    keys.up = keys.down = keys.left = keys.right = false;
    resetArena(humans, bots);
    running = true;
    paused = false;
    lastFrame = 0;
    overlay.classList.add("hidden");
    resumeBtn.classList.add("hidden");
    overlay.dataset.state = "home";
    setPlayLabel(mode === "online" && isHost ? "Start match" : "Play");
    if (hudMode) {
      hudMode.textContent =
        mode === "online" ? (isHost ? `Online host · ${roomCode}` : `Online · ${roomCode}`) : `vs ${bots} NPC`;
    }
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
    window.HubSound?.play?.("start");
  }

  function openMenu(fromPause) {
    if (running && !fromPause) {
      paused = true;
      resumeBtn.classList.remove("hidden");
      overlayTitle.textContent = "Paused";
      overlayText.textContent = "Resume, or start a fresh arena.";
      overlay.dataset.state = "paused";
    } else if (!running) {
      resumeBtn.classList.add("hidden");
      overlayTitle.textContent = "Paper Claim";
      overlayText.textContent = "Claim territory, cut trails, and grow your map.";
      overlay.dataset.state = "home";
    } else if (fromPause) {
      resumeBtn.classList.remove("hidden");
      overlayTitle.textContent = "Paused";
      overlayText.textContent = "Resume, or start a fresh arena.";
      overlay.dataset.state = "paused";
    }
    setMenuPanel(overlay.dataset.panel === "skins" ? "skins" : "home");
    refreshMenuProfile();
    refreshSkinPreview();
    updateBestHud();
    overlay.classList.remove("hidden");
  }

  function setMode(next) {
    mode = next;
    modePicker?.querySelectorAll(".pick-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    npcPanel?.classList.toggle("hidden", mode !== "npc");
    onlinePanel?.classList.toggle("hidden", mode !== "online");
    if (overlay && !overlay.classList.contains("hidden")) syncDockActive();
  }

  // —— Networking ——
  async function sbGet(id) {
    if (!window.HubSupabase?.getDoc) return null;
    try {
      return await HubSupabase.getDoc(id);
    } catch {
      return null;
    }
  }

  async function sbPut(id, data) {
    if (!window.HubSupabase?.upsertDoc) throw new Error("no supabase");
    await HubSupabase.upsertDoc(id, data);
  }

  function encodeGrid() {
    const parts = [];
    let i = 0;
    while (i < grid.length) {
      const v = grid[i];
      let n = 1;
      while (i + n < grid.length && grid[i + n] === v && n < 9999) n++;
      parts.push(`${v}:${n}`);
      i += n;
    }
    return parts.join(",");
  }

  function decodeGrid(rle) {
    if (!rle) return;
    const out = new Int16Array(WORLD * WORLD);
    let i = 0;
    for (const part of String(rle).split(",")) {
      const [vs, ns] = part.split(":");
      const v = Number(vs) || 0;
      const n = Number(ns) || 0;
      for (let k = 0; k < n && i < out.length; k++) out[i++] = v;
    }
    grid = out;
    markLandDirty();
  }

  function snapshotPlayers() {
    return players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: +p.x.toFixed(2),
      y: +p.y.toFixed(2),
      angle: +p.angle.toFixed(3),
      alive: p.alive,
      human: p.human,
      outside: p.outside,
      trail: p.trail.slice(-160).map((t) => [+t.x.toFixed(2), +t.y.toFixed(2)]),
      respawnAt: p.respawnAt ? Date.now() + (p.respawnAt - performance.now()) : 0
    }));
  }

  function applySnapshot(snap) {
    if (!snap) return;
    if (snap.grid) decodeGrid(snap.grid);
    if (snap.idMap) {
      idMap.clear();
      for (const [k, v] of Object.entries(snap.idMap)) {
        idMap.set(k, Number(v));
        idSeq = Math.max(idSeq, Number(v) + 1);
      }
    }
    if (Array.isArray(snap.players)) {
      players = snap.players.map((raw) => ({
        id: raw.id,
        name: raw.name,
        color: raw.color | 0,
        x: Number(raw.x) || 0,
        y: Number(raw.y) || 0,
        angle: Number(raw.angle) || 0,
        wantAngle: Number(raw.angle) || 0,
        alive: !!raw.alive,
        human: !!raw.human,
        outside: !!raw.outside,
        trail: Array.isArray(raw.trail)
          ? raw.trail.map((t) => (Array.isArray(t) ? { x: t[0], y: t[1] } : t))
          : [],
        distAcc: 0,
        respawnAt: raw.respawnAt ? performance.now() + Math.max(0, raw.respawnAt - Date.now()) : 0,
        botThink: 0,
        botAngle: Number(raw.angle) || 0
      }));
    }
  }

  function roomDocId(code) {
    return DOC_PREFIX + String(code || "").toUpperCase();
  }

  async function pushHostState() {
    if (!isHost || !roomCode) return;
    const idMapObj = {};
    for (const [k, v] of idMap) idMapObj[k] = v;
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) return;
    const inputs = doc.inputs || {};
    for (const p of players) {
      if (!p.human || p.id === localId) continue;
      const ang = inputs[p.id];
      if (typeof ang === "number" && Number.isFinite(ang)) {
        p.wantAngle = ang;
      }
    }
    await sbPut(roomDocId(roomCode), {
      ...doc,
      updatedAt: Date.now(),
      status: "playing",
      hostId: localId,
      snap: {
        grid: encodeGrid(),
        idMap: idMapObj,
        players: snapshotPlayers(),
        t: Date.now()
      },
      inputs: { ...(doc.inputs || {}), [localId]: pendingAngle }
    });
  }

  async function pushGuestInput() {
    if (isHost || !roomCode) return;
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) return;
    await sbPut(roomDocId(roomCode), {
      ...doc,
      updatedAt: Date.now(),
      inputs: { ...(doc.inputs || {}), [localId]: pendingAngle }
    });
    if (doc.snap) applySnapshot(doc.snap);
  }

  async function netTick() {
    if (mode !== "online" || !roomCode || !running || netBusy) return;
    netBusy = true;
    try {
      if (isHost) await pushHostState();
      else await pushGuestInput();
    } catch (err) {
      console.warn("[paper-io] net", err);
    } finally {
      netBusy = false;
    }
  }

  function stopNet() {
    clearInterval(netPollTimer);
    netPollTimer = 0;
  }

  function startNet() {
    stopNet();
    netPollTimer = setInterval(() => netTick(), NET_POLL_MS);
  }

  async function createOnlineRoom() {
    const me = playerId();
    const name = playerName();
    if (!name || name === "You") {
      onlineStatus.textContent = "Set a nickname on the hub first.";
      return;
    }
    localId = me;
    roomCode = makeCode();
    isHost = true;
    lobbyAwaiting = true;
    await sbPut(roomDocId(roomCode), {
      code: roomCode,
      hostId: me,
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      seats: { [me]: { name, color: 0, joinedAt: Date.now() } },
      inputs: {},
      snap: null
    });
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      lobbies.rooms = lobbies.rooms || {};
      lobbies.rooms[roomCode] = { code: roomCode, hostId: me, status: "waiting", updatedAt: Date.now() };
      const now = Date.now();
      for (const [k, r] of Object.entries(lobbies.rooms)) {
        if (!r || now - (r.updatedAt || 0) > 10 * 60 * 1000) delete lobbies.rooms[k];
      }
      await sbPut(LOBBY_DOC, lobbies);
    } catch {}
    onlineCode.classList.remove("hidden");
    onlineCode.textContent = `Room ${roomCode} — waiting for players…`;
    onlineCancelBtn.classList.remove("hidden");
    onlineStatus.textContent = "Share the code. Press Play when ready (bots fill empty slots).";
    setPlayLabel("Start match");
  }

  async function joinOnlineRoom(code) {
    const want = String(code || "")
      .trim()
      .toUpperCase();
    if (!want) {
      onlineStatus.textContent = "Enter a room code.";
      return;
    }
    const me = playerId();
    const name = playerName();
    if (!name || name === "You") {
      onlineStatus.textContent = "Set a nickname on the hub first.";
      return;
    }
    const doc = await sbGet(roomDocId(want));
    if (!doc || (doc.status !== "waiting" && doc.status !== "playing")) {
      onlineStatus.textContent = "Room not found.";
      return;
    }
    const seats = { ...(doc.seats || {}) };
    const seatCount = Object.keys(seats).length;
    if (!seats[me] && seatCount >= MAX_PLAYERS) {
      onlineStatus.textContent = "Room is full.";
      return;
    }
    seats[me] = { name, color: seatCount % COLORS.length, joinedAt: Date.now() };
    await sbPut(roomDocId(want), { ...doc, seats, updatedAt: Date.now() });
    roomCode = want;
    localId = me;
    isHost = doc.hostId === me;
    lobbyAwaiting = doc.status === "waiting";
    onlineCode.classList.remove("hidden");
    onlineCode.textContent = isHost ? `Room ${roomCode}` : `Joined ${roomCode}`;
    onlineCancelBtn.classList.remove("hidden");
    onlineStatus.textContent = isHost ? "You are host. Press Play to start." : "Waiting for host to start…";
    setPlayLabel(isHost ? "Start match" : "Waiting…");
    if (!isHost) watchLobbyStart();
  }

  function watchLobbyStart() {
    clearInterval(lobbyWatch);
    lobbyWatch = setInterval(async () => {
      if (!roomCode || isHost) return;
      const doc = await sbGet(roomDocId(roomCode));
      if (!doc) return;
      if (doc.status === "playing" && doc.snap) {
        clearInterval(lobbyWatch);
        lobbyAwaiting = false;
        applySnapshot(doc.snap);
        running = true;
        paused = false;
        lastFrame = 0;
        overlay.classList.add("hidden");
        if (hudMode) hudMode.textContent = `Online · ${roomCode}`;
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(loop);
        startNet();
        window.HubSound?.play?.("start");
      }
    }, 500);
  }

  async function quickPlay() {
    onlineStatus.textContent = "Searching…";
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      const now = Date.now();
      const open = Object.values(lobbies.rooms || {}).filter(
        (r) => r && r.status === "waiting" && now - (r.updatedAt || 0) < 3 * 60 * 1000
      );
      if (open.length) {
        await joinOnlineRoom(open[0].code);
        return;
      }
    } catch {}
    await createOnlineRoom();
  }

  async function leaveOnline() {
    stopNet();
    clearInterval(lobbyWatch);
    lobbyAwaiting = false;
    if (roomCode && isHost) {
      try {
        const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
        if (lobbies.rooms) delete lobbies.rooms[roomCode];
        await sbPut(LOBBY_DOC, lobbies);
        await sbPut(roomDocId(roomCode), { code: roomCode, status: "closed", updatedAt: Date.now() });
      } catch {}
    }
    roomCode = "";
    isHost = false;
    onlineCode.classList.add("hidden");
    onlineCancelBtn.classList.add("hidden");
    onlineStatus.textContent = "Match with others, or host a room code.";
    setPlayLabel("Play");
  }

  async function startOnlineMatch() {
    if (!roomCode) {
      onlineStatus.textContent = "Create or join a room first.";
      return;
    }
    const doc = await sbGet(roomDocId(roomCode));
    if (!doc) {
      onlineStatus.textContent = "Room expired.";
      return;
    }
    if (!isHost) {
      onlineStatus.textContent = "Waiting for host…";
      watchLobbyStart();
      return;
    }
    const seats = doc.seats || {};
    const humans = Object.entries(seats).map(([id, s]) => ({
      id,
      name: s.name || "Player"
    }));
    const bots = Math.max(0, Math.min(6, MAX_PLAYERS - humans.length));
    localId = playerId();
    startNpc({ localId, humans, bots });
    for (const p of players) {
      const seat = seats[p.id];
      if (seat && seat.color != null) p.color = seat.color % COLORS.length;
    }
    lobbyAwaiting = false;
    const idMapObj = {};
    for (const [k, v] of idMap) idMapObj[k] = v;
    await sbPut(roomDocId(roomCode), {
      ...doc,
      status: "playing",
      updatedAt: Date.now(),
      hostId: localId,
      snap: {
        grid: encodeGrid(),
        idMap: idMapObj,
        players: snapshotPlayers(),
        t: Date.now()
      },
      inputs: {}
    });
    try {
      const lobbies = (await sbGet(LOBBY_DOC)) || { rooms: {} };
      if (lobbies.rooms?.[roomCode]) {
        lobbies.rooms[roomCode].status = "playing";
        lobbies.rooms[roomCode].updatedAt = Date.now();
        await sbPut(LOBBY_DOC, lobbies);
      }
    } catch {}
    startNet();
  }

  // —— Input ——
  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right"
  };

  window.addEventListener("keydown", (e) => {
    const k = keyMap[e.key];
    if (!k) return;
    e.preventDefault();
    keys[k] = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = keyMap[e.key];
    if (!k) return;
    keys[k] = false;
  });

  function aimFromEvent(e) {
    if (!running || paused) return;
    const pt = e.touches ? e.touches[0] : e;
    if (!pt) return;
    const me = localPlayer();
    if (!me || !me.alive) {
      const w = screenToWorld(pt.clientX, pt.clientY);
      aimX = w.x;
      aimY = w.y;
      pointerAim = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const sx = ((pt.clientX - rect.left) / rect.width) * canvas.width;
    const sy = ((pt.clientY - rect.top) / rect.height) * canvas.height;
    const ps = worldToScreen(me.x, me.y);
    const dx = sx - ps.x;
    const dy = sy - ps.y;
    const dist = Math.hypot(dx, dy);
    // Keep last aim while cursor sits on you / your nearby land under the blob
    if (dist < AIM_DEADZONE_PX) return;
    const len = dist || 1;
    aimDirX = dx / len;
    aimDirY = dy / len;
    const w = screenToWorld(pt.clientX, pt.clientY);
    aimX = w.x;
    aimY = w.y;
    pointerAim = true;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!running || paused) return;
    canvas.setPointerCapture?.(e.pointerId);
    aimFromEvent(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!running || paused) return;
    if (e.buttons || e.pointerType === "touch" || pointerAim) aimFromEvent(e);
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!running || paused) return;
    if (!keys.up && !keys.down && !keys.left && !keys.right) {
      aimFromEvent(e);
    }
  });

  document.getElementById("skin-picker")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skin]");
    if (!btn) return;
    const id = btn.dataset.skin;
    if (!SKINS[id]) return;
    if (skinUnlocked(id)) {
      setSkin(id);
      setSkinHint("");
    } else {
      tryBuySkin(id);
      refreshSkinPicker();
      refreshSkinPreview();
    }
  });

  try {
    window.HubCoins?.onChange?.(() => {
      refreshSkinPicker();
      refreshSkinPreview();
    });
  } catch {}
  refreshSkinPicker();
  refreshSkinPreview();
  refreshMenuProfile();
  setPlayLabel("Play");

  document.querySelector(".menu-dock")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".dock-btn[data-panel]");
    if (!btn || !document.querySelector(".menu-dock")?.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuPanel(btn.dataset.panel);
  });

  modePicker?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    setMode(btn.dataset.mode);
    if (overlay) overlay.dataset.panel = "home";
    syncDockActive();
    if (mode === "online") {
      onlinePanel?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  });

  npcPanel?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bots]");
    if (!btn) return;
    botCount = Number(btn.dataset.bots) || 4;
    npcPanel.querySelectorAll(".pick-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
  });

  startBtn?.addEventListener("click", async () => {
    if (mode === "npc") {
      stopNet();
      leaveOnline().catch(() => {});
      startNpc({ bots: botCount });
      return;
    }
    await startOnlineMatch();
  });

  resumeBtn?.addEventListener("click", () => {
    paused = false;
    overlay.classList.add("hidden");
  });

  menuBtn?.addEventListener("click", () => openMenu(false));
  gamesBtn?.addEventListener("click", () => {
    location.href = "../index.html#games";
  });

  onlineQuickBtn?.addEventListener("click", () => quickPlay());
  onlineCreateBtn?.addEventListener("click", () => createOnlineRoom());
  onlineJoinBtn?.addEventListener("click", () => joinOnlineRoom(onlineJoinInput?.value));
  onlineJoinInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinOnlineRoom(onlineJoinInput.value);
  });
  onlineCancelBtn?.addEventListener("click", () => leaveOnline());

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      paused = true;
      openMenu(true);
    }
  });

  updateBestHud();
  setMode("npc");
  setMenuPanel("home");
  refreshMenuProfile();
  refreshSkinPreview();
  draw();
})();
