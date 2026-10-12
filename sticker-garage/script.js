(() => {
  const GAME_ID = "stickers";
  const STORAGE_KEY = "sticker-garage-save-v1";
  const HIGH_KEY = "sticker-garage-high-score";

  const STICKERS = [
    { id: "star", emoji: "⭐", name: "Star", cost: 0, pack: "basic" },
    { id: "heart", emoji: "💖", name: "Heart", cost: 35, pack: "basic" },
    { id: "flame", emoji: "🔥", name: "Flame", cost: 70, pack: "basic" },
    { id: "bolt", emoji: "⚡", name: "Bolt", cost: 110, pack: "basic" },
    { id: "skull", emoji: "💀", name: "Skull", cost: 160, pack: "flashy" },
    { id: "rainbow", emoji: "🌈", name: "Rainbow", cost: 220, pack: "flashy" },
    { id: "crown", emoji: "👑", name: "Crown", cost: 300, pack: "flashy" },
    { id: "rocket", emoji: "🚀", name: "Rocket", cost: 400, pack: "flashy" },
    { id: "diamond", emoji: "💎", name: "Diamond", cost: 520, pack: "legend" },
    { id: "ghost", emoji: "👻", name: "Ghost", cost: 650, pack: "legend" },
    { id: "dragon", emoji: "🐉", name: "Dragon", cost: 850, pack: "legend" },
    { id: "unicorn", emoji: "🦄", name: "Unicorn", cost: 1100, pack: "legend" }
  ];

  const UPGRADES = [
    {
      id: "tip1",
      name: "Tip jar",
      desc: "+15% tips on perfect jobs",
      cost: 120,
      icon: "🪙",
      cat: "tips",
      apply: (s) => {
        s.tipMult = Math.max(s.tipMult || 1, 1.15);
      }
    },
    {
      id: "tip2",
      name: "VIP lounge",
      desc: "+30% tips on perfect jobs",
      cost: 350,
      icon: "🥂",
      cat: "tips",
      requires: "tip1",
      apply: (s) => {
        s.tipMult = Math.max(s.tipMult || 1, 1.3);
      }
    },
    {
      id: "pay1",
      name: "Neon sign",
      desc: "+20% base job pay",
      cost: 250,
      icon: "🪧",
      cat: "pay",
      apply: (s) => {
        s.payMult = Math.max(s.payMult || 1, 1.2);
      }
    },
    {
      id: "pay2",
      name: "Street cred",
      desc: "+40% base job pay",
      cost: 700,
      icon: "📣",
      cat: "pay",
      requires: "pay1",
      apply: (s) => {
        s.payMult = Math.max(s.payMult || 1, 1.4);
      }
    }
  ];

  const PAINTS = [
    { id: "primer", name: "Primer gray", hi: "#9aa3ad", lo: "#5c6570", cost: 0, starter: true, orderable: false },
    { id: "red", name: "Cherry red", hi: "#e85d4c", lo: "#a83228", cost: 0, starter: true },
    { id: "blue", name: "Sky blue", hi: "#4ea1ff", lo: "#1d5fad", cost: 0, starter: true },
    { id: "white", name: "Pearl white", hi: "#f2f2f2", lo: "#9a9a9a", cost: 0, starter: true },
    { id: "green", name: "Forest green", hi: "#3ecf8e", lo: "#1a7a52", cost: 55 },
    { id: "yellow", name: "Taxi yellow", hi: "#ffd24a", lo: "#c48a10", cost: 70 },
    { id: "orange", name: "Sunset orange", hi: "#ff8a3d", lo: "#b34e12", cost: 95 },
    { id: "purple", name: "Violet dusk", hi: "#c9a0ff", lo: "#6b3fa0", cost: 140 },
    { id: "teal", name: "Ocean teal", hi: "#2dd4bf", lo: "#0f766e", cost: 180 },
    { id: "pink", name: "Hot pink", hi: "#ff6ad5", lo: "#b01e86", cost: 240 },
    { id: "black", name: "Midnight", hi: "#3a3f48", lo: "#12151a", cost: 320 },
    { id: "gold", name: "Showroom gold", hi: "#ffe08a", lo: "#b8860b", cost: 480 }
  ];

  const SHOP_CATEGORIES = [
    { id: "paints", title: "Paints", blurb: "Unlock spray colors customers can request." },
    { id: "basic", title: "Basic packs", blurb: "Starter decals customers ask for early on." },
    { id: "flashy", title: "Flashy packs", blurb: "Bolder wraps that unlock juicier orders." },
    { id: "legend", title: "Legend packs", blurb: "Rare stickers for big tips and flex jobs." },
    { id: "tips", title: "Tip upgrades", blurb: "Earn more when you nail a perfect wrap." },
    { id: "pay", title: "Pay boost", blurb: "Raise base job pay across every customer." }
  ];

  const NAMES = [
    "Mia", "Jordan", "Kai", "Nova", "Riley", "Sam", "Ava", "Leo",
    "Zara", "Chris", "Nina", "Omar", "Jade", "Ben", "Lux", "Tess"
  ];
  const FACES = ["😎", "🤩", "😊", "🥸", "😺", "🤠", "🤓", "😇", "🥳", "😤"];

  const els = {
    cash: document.getElementById("cash"),
    jobs: document.getElementById("jobs"),
    high: document.getElementById("high-score"),
    face: document.getElementById("customer-face"),
    name: document.getElementById("customer-name"),
    order: document.getElementById("customer-order"),
    stage: document.getElementById("car-stage"),
    layer: document.getElementById("sticker-layer"),
    paintTray: document.getElementById("paint-tray"),
    tray: document.getElementById("sticker-tray"),
    hint: document.getElementById("bay-hint"),
    deliver: document.getElementById("deliver-btn"),
    undo: document.getElementById("undo-btn"),
    clear: document.getElementById("clear-btn"),
    shopBtn: document.getElementById("shop-btn"),
    shopModal: document.getElementById("shop-modal"),
    shopClose: document.getElementById("shop-close"),
    shopCats: document.getElementById("shop-cats"),
    shopCash: document.getElementById("shop-cash"),
    shopList: document.getElementById("shop-list"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayText: document.getElementById("overlay-text"),
    overlayBest: document.getElementById("overlay-best"),
    start: document.getElementById("start-btn"),
    resume: document.getElementById("resume-btn"),
    games: document.getElementById("games-btn"),
    menu: document.getElementById("menu-btn"),
    toast: document.getElementById("toast")
  };

  let save = loadSave();
  let selectedId = null;
  let placed = [];
  let currentPaintId = "primer";
  let job = null;
  let running = false;
  let paused = false;
  let recordedPlay = false;
  let toastTimer = 0;
  let shopCat = "all";

  function defaultSave() {
    return {
      cash: 40,
      earned: 0,
      jobs: 0,
      unlocked: ["star"],
      paints: PAINTS.filter((p) => p.starter).map((p) => p.id),
      upgrades: [],
      tipMult: 1,
      payMult: 1
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      const base = defaultSave();
      const next = { ...base, ...parsed };
      if (!Array.isArray(next.unlocked) || !next.unlocked.length) next.unlocked = ["star"];
      if (!next.unlocked.includes("star")) next.unlocked.push("star");
      if (!Array.isArray(next.paints) || !next.paints.length) {
        next.paints = PAINTS.filter((p) => p.starter).map((p) => p.id);
      }
      PAINTS.filter((p) => p.starter).forEach((p) => {
        if (!next.paints.includes(p.id)) next.paints.push(p.id);
      });
      if (!Array.isArray(next.upgrades)) next.upgrades = [];
      next.tipMult = Number(next.tipMult) || 1;
      next.payMult = Number(next.payMult) || 1;
      return next;
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      const best = Math.max(readHigh(), Math.floor(save.earned || 0));
      localStorage.setItem(HIGH_KEY, String(best));
    } catch {}
  }

  function readHigh() {
    try {
      const n = Number(localStorage.getItem(HIGH_KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  function fmt(n) {
    const v = Math.floor(Number(n) || 0);
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
    return String(v);
  }

  function stickerById(id) {
    return STICKERS.find((s) => s.id === id);
  }

  function paintById(id) {
    return PAINTS.find((p) => p.id === id);
  }

  function isUnlocked(id) {
    return save.unlocked.includes(id);
  }

  function isPaintUnlocked(id) {
    return save.paints.includes(id);
  }

  function hasUpgrade(id) {
    return save.upgrades.includes(id);
  }

  function orderablePaints() {
    return PAINTS.filter((p) => p.orderable !== false && isPaintUnlocked(p.id));
  }

  function showToast(msg, kind) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden", "is-good", "is-bad");
    if (kind) els.toast.classList.add(kind);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 1600);
  }

  function paintHud() {
    els.cash.textContent = fmt(save.cash);
    if (els.shopCash) els.shopCash.textContent = `$${fmt(save.cash)}`;
    els.jobs.textContent = String(save.jobs || 0);
    const best = Math.max(readHigh(), Math.floor(save.earned || 0));
    els.high.textContent = fmt(best);
    els.overlayBest.textContent = `$${fmt(best)}`;
  }

  function setCarColor(paint) {
    if (!paint) return;
    document.documentElement.style.setProperty("--car-hi", paint.hi);
    document.documentElement.style.setProperty("--car-lo", paint.lo);
  }

  function applyPaint(id) {
    if (!isPaintUnlocked(id) && id !== "primer") return;
    const paint = paintById(id);
    if (!paint) return;
    currentPaintId = id;
    setCarColor(paint);
    renderPaintTray();
    updateDeliverEnabled();
    els.hint.textContent =
      id === "primer"
        ? "Spray a color, then add stickers."
        : `Painted ${paint.name}. Add stickers to finish.`;
  }

  function renderPaintTray() {
    if (!els.paintTray) return;
    const unlocked = PAINTS.filter((p) => p.id !== "primer" && isPaintUnlocked(p.id));
    els.paintTray.innerHTML = "";
    unlocked.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "paint-chip" +
        (currentPaintId === p.id ? " is-active is-selected" : "");
      btn.title = p.name;
      btn.style.setProperty("--swatch-hi", p.hi);
      btn.style.setProperty("--swatch-lo", p.lo);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", p.name);
      btn.setAttribute("aria-selected", currentPaintId === p.id ? "true" : "false");
      btn.innerHTML = `<span class="paint-check" aria-hidden="true">✓</span>`;
      btn.addEventListener("click", () => {
        selectedId = null;
        renderTray();
        applyPaint(p.id);
        try {
          window.HubSound?.play?.("tap");
        } catch {}
      });
      els.paintTray.appendChild(btn);
    });
  }

  function renderTray() {
    const unlocked = STICKERS.filter((s) => isUnlocked(s.id));
    els.tray.innerHTML = "";
    unlocked.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sticker-chip" + (selectedId === s.id ? " is-selected" : "");
      btn.textContent = s.emoji;
      btn.title = s.name;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", selectedId === s.id ? "true" : "false");
      btn.addEventListener("click", () => {
        selectedId = selectedId === s.id ? null : s.id;
        renderTray();
        els.hint.textContent = selectedId
          ? `Selected ${s.emoji} — tap the car to place.`
          : "Pick a sticker, then tap the car to place it.";
      });
      els.tray.appendChild(btn);
    });
  }

  function updateDeliverEnabled() {
    const paintOk = !!(job && currentPaintId !== "primer");
    els.deliver.disabled = !running || !job || placed.length === 0 || !paintOk;
  }

  function renderPlaced() {
    els.layer.innerHTML = "";
    placed.forEach((p) => {
      const s = stickerById(p.id);
      if (!s) return;
      const el = document.createElement("span");
      el.className = "placed-sticker";
      el.textContent = s.emoji;
      el.style.left = `${p.x * 100}%`;
      el.style.top = `${p.y * 100}%`;
      el.style.setProperty("--rot", `${p.rot}deg`);
      els.layer.appendChild(el);
    });
    updateDeliverEnabled();
  }

  function pickOrder() {
    const unlocked = STICKERS.filter((s) => isUnlocked(s.id));
    const pool = unlocked.length ? unlocked : [STICKERS[0]];
    const kinds = 1 + (Math.random() < 0.55 && pool.length > 1 ? 1 : 0) + (Math.random() < 0.25 && pool.length > 2 ? 1 : 0);
    const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(kinds, pool.length));
    const needs = chosen.map((s) => ({
      id: s.id,
      count: 1 + Math.floor(Math.random() * (save.jobs > 8 ? 3 : 2))
    }));
    return needs;
  }

  function pickWantPaint() {
    const pool = orderablePaints();
    if (!pool.length) return paintById("red");
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function orderHtml(needs, wantPaint) {
    const paintBit = wantPaint
      ? `<span class="need-paint"><span class="need-swatch" style="--swatch-hi:${wantPaint.hi};--swatch-lo:${wantPaint.lo}"></span>${wantPaint.name}</span>`
      : "";
    const stickerBits = needs
      .map((n) => {
        const s = stickerById(n.id);
        return `<span class="need">${n.count}×${s?.emoji || "?"}</span>`;
      })
      .join("");
    return paintBit + stickerBits;
  }

  function orderSpeech(needs, wantPaint) {
    const bits = needs.map((n) => {
      const s = stickerById(n.id);
      return `${n.count} ${s?.name || "sticker"}${n.count > 1 ? "s" : ""}`;
    });
    const color = wantPaint?.name || "a fresh color";
    if (bits.length === 1) return `Paint it ${color} and hit me with ${bits[0]}!`;
    if (bits.length === 2) return `${color} paint, plus ${bits[0]} and ${bits[1]}.`;
    return `${color} paint, then ${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]}.`;
  }

  function nextJob() {
    placed = [];
    selectedId = selectedId && isUnlocked(selectedId) ? selectedId : null;
    const needs = pickOrder();
    const wantPaint = pickWantPaint();
    job = {
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      face: FACES[Math.floor(Math.random() * FACES.length)],
      needs,
      wantPaintId: wantPaint.id,
      basePay:
        22 +
        needs.reduce((a, n) => a + n.count * 8, 0) +
        10 +
        Math.floor(save.jobs / 3) * 2
    };
    applyPaint("primer");
    els.face.textContent = job.face;
    els.name.textContent = job.name;
    els.order.innerHTML = `${orderHtml(needs, wantPaint)} <span style="opacity:.75">${orderSpeech(needs, wantPaint)}</span>`;
    renderPlaced();
    renderTray();
    els.hint.textContent = "Spray their color first, then match the stickers.";
  }

  function countPlaced() {
    const map = {};
    placed.forEach((p) => {
      map[p.id] = (map[p.id] || 0) + 1;
    });
    return map;
  }

  function gradeJob() {
    const counts = countPlaced();
    let missing = 0;
    let matched = 0;
    let needed = 0;
    job.needs.forEach((n) => {
      needed += n.count;
      const have = counts[n.id] || 0;
      matched += Math.min(have, n.count);
      missing += Math.max(0, n.count - have);
      counts[n.id] = Math.max(0, have - n.count);
    });
    let extras = 0;
    Object.values(counts).forEach((c) => {
      extras += c;
    });
    const paintOk = currentPaintId === job.wantPaintId;
    const stickersPerfect = missing === 0 && extras === 0;
    const perfect = stickersPerfect && paintOk;
    const accuracy = needed ? matched / needed : 0;
    return { missing, extras, matched, needed, perfect, accuracy, paintOk, stickersPerfect };
  }

  function deliver() {
    if (!running || !job || !placed.length || currentPaintId === "primer") return;
    const g = gradeJob();
    const payMult = save.payMult || 1;
    const tipMult = save.tipMult || 1;
    let pay = Math.round(job.basePay * payMult * (0.35 + 0.65 * g.accuracy));
    if (!g.paintOk) pay = Math.max(4, Math.round(pay * 0.55));
    let tip = 0;
    if (g.perfect) {
      tip = Math.round(job.basePay * 0.45 * tipMult);
      pay += tip;
    } else {
      pay = Math.max(4, pay - g.extras * 4 - g.missing * 6);
    }
    save.cash += pay;
    save.earned += pay;
    save.jobs += 1;
    persist();
    submitScore();
    paintHud();

    if (g.perfect) {
      showToast(`Perfect paint + wrap! +$${pay}`, "is-good");
      try {
        window.HubConfetti?.burst?.();
      } catch {}
      try {
        window.HubSound?.play?.("success");
      } catch {}
    } else if (!g.paintOk && g.stickersPerfect) {
      showToast(`Wrong color — +$${pay}`, "is-bad");
    } else if (g.accuracy >= 0.7) {
      showToast(`Close enough — +$${pay}`, "is-good");
    } else {
      showToast(`Messy wrap — +$${pay}`, "is-bad");
    }

    nextJob();
  }

  function placeAt(clientX, clientY) {
    if (!running || paused || !job || !selectedId) return;
    const rect = els.stage.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    // Keep stickers roughly on the car body band
    if (x < 0.12 || x > 0.9 || y < 0.18 || y > 0.78) {
      showToast("Stick it on the car body", "is-bad");
      return;
    }
    placed.push({
      id: selectedId,
      x: Math.min(0.88, Math.max(0.14, x)),
      y: Math.min(0.72, Math.max(0.22, y)),
      rot: Math.round((Math.random() * 40 - 20) * 10) / 10
    });
    renderPlaced();
    try {
      window.HubSound?.play?.("tap");
    } catch {}
  }

  function shopItemsForCat(catId) {
    if (catId === "paints") {
      return PAINTS.filter((p) => p.cost > 0).map((p) => {
        const owned = isPaintUnlocked(p.id);
        return {
          key: `paint-${p.id}`,
          icon: `<span class="need-swatch" style="--swatch-hi:${p.hi};--swatch-lo:${p.lo};width:28px;height:28px;border-radius:8px;display:block"></span>`,
          title: p.name,
          desc: owned ? "In your paint tray" : "Spray color customers can request",
          status: owned ? "Owned" : save.cash >= p.cost ? "Ready to buy" : "Save up",
          cost: p.cost,
          owned,
          locked: false,
          htmlIcon: true,
          disabled: owned || save.cash < p.cost,
          onBuy: () => buyPaint(p.id)
        };
      });
    }
    if (catId === "tips" || catId === "pay") {
      return UPGRADES.filter((u) => u.cat === catId).map((u) => {
        const owned = hasUpgrade(u.id);
        const reqOk = !u.requires || hasUpgrade(u.requires);
        const reqName = u.requires
          ? UPGRADES.find((x) => x.id === u.requires)?.name || "prior upgrade"
          : "";
        return {
          key: `up-${u.id}`,
          icon: u.icon,
          title: u.name,
          desc: !reqOk ? `Needs ${reqName}` : u.desc,
          status: owned ? "Owned" : !reqOk ? "Locked" : save.cash >= u.cost ? "Ready to buy" : "Save up",
          cost: u.cost,
          owned,
          locked: !reqOk,
          disabled: owned || !reqOk || save.cash < u.cost,
          onBuy: () => buyUpgrade(u.id)
        };
      });
    }
    return STICKERS.filter((s) => s.pack === catId && s.cost > 0).map((s) => {
      const owned = isUnlocked(s.id);
      return {
        key: `sticker-${s.id}`,
        icon: s.emoji,
        title: s.name,
        desc: owned ? "In your tray" : "Sticker pack for the bay tray",
        status: owned ? "Owned" : save.cash >= s.cost ? "Ready to buy" : "Save up",
        cost: s.cost,
        owned,
        locked: false,
        disabled: owned || save.cash < s.cost,
        onBuy: () => buySticker(s.id)
      };
    });
  }

  function nextBuyKey(items) {
    const next = items.find((r) => !r.owned && !r.locked && save.cash >= r.cost);
    return next?.key || items.find((r) => !r.owned && !r.locked)?.key || null;
  }

  function renderShop() {
    if (!els.shopList) return;
    paintHud();

    const active = shopCat || "all";
    els.shopCats?.querySelectorAll("[data-shop-cat]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.shopCat === active);
    });

    const cats = SHOP_CATEGORIES.filter((c) => active === "all" || c.id === active);
    els.shopList.innerHTML = "";

    cats.forEach((cat) => {
      const items = shopItemsForCat(cat.id);
      if (!items.length) return;
      const nextKey = nextBuyKey(items);

      const section = document.createElement("div");
      section.className = "shop-category";
      section.dataset.category = cat.id;
      section.innerHTML = `
        <div class="shop-category-head">
          <div class="shop-category-title">${cat.title}</div>
          <div class="shop-category-blurb">${cat.blurb}</div>
        </div>
      `;

      const sorted = [...items].sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? 1 : -1;
        if (a.locked !== b.locked) return a.locked ? 1 : -1;
        return a.cost - b.cost;
      });

      sorted.forEach((r) => {
        const row = document.createElement("div");
        row.className =
          "shop-item" +
          (r.owned ? " is-owned-row" : "") +
          (r.key === nextKey ? " is-next" : "");
        row.setAttribute("role", "listitem");
        row.innerHTML = `
          <div class="shop-icon">${r.htmlIcon ? r.icon : ""}</div>
          <div class="shop-meta">
            <strong>${r.title}</strong>
            <span class="shop-desc">${r.desc}</span>
            <span class="shop-status">${r.status}</span>
          </div>
        `;
        if (!r.htmlIcon) {
          row.querySelector(".shop-icon").textContent = r.icon;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "buy-btn" + (r.owned ? " is-owned" : "");
        btn.textContent = r.owned ? "✓" : `$${r.cost}`;
        btn.disabled = r.disabled;
        btn.addEventListener("click", r.onBuy);
        row.appendChild(btn);
        section.appendChild(row);
      });

      els.shopList.appendChild(section);
    });
  }

  function buyPaint(id) {
    const p = paintById(id);
    if (!p || isPaintUnlocked(id) || save.cash < p.cost) return;
    save.cash -= p.cost;
    save.paints.push(id);
    persist();
    paintHud();
    renderPaintTray();
    renderShop();
    showToast(`Unlocked ${p.name} paint!`, "is-good");
  }

  function buySticker(id) {
    const s = stickerById(id);
    if (!s || isUnlocked(id) || save.cash < s.cost) return;
    save.cash -= s.cost;
    save.unlocked.push(id);
    persist();
    paintHud();
    renderTray();
    renderShop();
    showToast(`Unlocked ${s.emoji} ${s.name}!`, "is-good");
  }

  function buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || hasUpgrade(id) || save.cash < u.cost) return;
    if (u.requires && !hasUpgrade(u.requires)) return;
    save.cash -= u.cost;
    save.upgrades.push(id);
    u.apply(save);
    persist();
    paintHud();
    renderShop();
    showToast(`${u.name} installed!`, "is-good");
  }

  function openShop() {
    renderShop();
    els.shopModal.classList.remove("hidden");
    els.shopModal.setAttribute("aria-hidden", "false");
  }

  function closeShop() {
    els.shopModal.classList.add("hidden");
    els.shopModal.setAttribute("aria-hidden", "true");
  }

  function submitScore() {
    const best = Math.max(readHigh(), Math.floor(save.earned || 0));
    try {
      localStorage.setItem(HIGH_KEY, String(best));
    } catch {}
    try {
      window.HubLeaderboard?.submit?.(GAME_ID, best);
    } catch {}
  }

  function recordPlayOnce() {
    if (recordedPlay) return;
    recordedPlay = true;
    try {
      window.HubPlays?.record?.(GAME_ID);
    } catch {}
    try {
      window.HubStreak?.recordPlay?.();
    } catch {}
  }

  function showMenu(fromPause) {
    paused = true;
    els.overlay.classList.remove("hidden");
    els.resume.classList.toggle("hidden", !fromPause && !running);
    if (fromPause || running) {
      els.overlayTitle.textContent = "Bay paused";
      els.overlayText.textContent = "Customers can wait a second — shop upgrades or jump back in.";
      els.resume.classList.remove("hidden");
    } else {
      els.overlayTitle.textContent = "Sticker Garage";
      els.overlayText.textContent =
        "Customers want a paint job and stickers. Spray the right color, slap on the decals, cash out, and unlock more paints and packs.";
    }
    paintHud();
  }

  function hideMenu() {
    els.overlay.classList.add("hidden");
    paused = false;
  }

  function startGame() {
    running = true;
    paused = false;
    recordPlayOnce();
    hideMenu();
    closeShop();
    if (!job) nextJob();
  }

  // Events
  els.stage.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    placeAt(e.clientX, e.clientY);
  });

  els.undo.addEventListener("click", () => {
    if (!placed.length) return;
    placed.pop();
    renderPlaced();
  });

  els.clear.addEventListener("click", () => {
    placed = [];
    renderPlaced();
  });

  els.deliver.addEventListener("click", deliver);
  els.shopBtn.addEventListener("click", openShop);
  els.shopClose.addEventListener("click", closeShop);
  els.shopModal.addEventListener("click", (e) => {
    if (e.target === els.shopModal) closeShop();
  });
  els.shopCats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-shop-cat]");
    if (!btn) return;
    shopCat = btn.dataset.shopCat || "all";
    renderShop();
  });

  els.start.addEventListener("click", startGame);
  els.resume.addEventListener("click", () => {
    if (!running) startGame();
    else hideMenu();
  });
  els.menu.addEventListener("click", () => showMenu(true));
  els.games.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.code === "Escape") {
      if (!els.shopModal.classList.contains("hidden")) {
        closeShop();
        return;
      }
      if (els.overlay.classList.contains("hidden") && running) showMenu(true);
      else if (!els.overlay.classList.contains("hidden") && running) hideMenu();
    }
  });

  // Boot
  paintHud();
  applyPaint("primer");
  renderTray();
  showMenu(false);
})();
