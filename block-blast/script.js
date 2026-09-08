(function () {
  const HIGH_SCORE_KEY = "block-blast-high-score";
  const SIZE = 8;
  const COLORS = [
    "#ff5a5a",
    "#ff9f1c",
    "#ffd60a",
    "#2ec4b6",
    "#4cc9f0",
    "#7b2cbf",
    "#f72585",
    "#80ed99"
  ];

  // Classic Block Blast-style polyominoes (no rotation).
  const SHAPES = [
    { cells: [[0, 0]], weight: 6 },
    { cells: [[0, 0], [0, 1]], weight: 10 },
    { cells: [[0, 0], [1, 0]], weight: 10 },
    { cells: [[0, 0], [0, 1], [0, 2]], weight: 10 },
    { cells: [[0, 0], [1, 0], [2, 0]], weight: 10 },
    { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 9 },
    { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 7 },
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 7 },
    { cells: [[0, 0], [1, 0], [1, 1]], weight: 8 },
    { cells: [[0, 1], [1, 0], [1, 1]], weight: 8 },
    { cells: [[0, 0], [0, 1], [1, 1]], weight: 8 },
    { cells: [[0, 0], [0, 1], [1, 0]], weight: 8 },
    { cells: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 6 },
    { cells: [[0, 1], [1, 1], [2, 0], [2, 1]], weight: 6 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 0]], weight: 6 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], weight: 6 },
    { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], weight: 6 },
    { cells: [[0, 2], [1, 0], [1, 1], [1, 2]], weight: 6 },
    { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], weight: 5 },
    { cells: [[0, 1], [1, 1], [2, 0], [2, 1]], weight: 5 },
    { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], weight: 5 },
    { cells: [[0, 1], [1, 0], [1, 1], [2, 0]], weight: 5 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 5 },
    { cells: [[0, 1], [1, 0], [1, 1], [1, 2]], weight: 5 },
    { cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], weight: 3 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]], weight: 3 },
    { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], weight: 2 },
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], weight: 2 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], weight: 1 }
  ];

  const PRAISE = [
    { min: 1, text: "Nice!", tier: 1 },
    { min: 2, text: "Great!", tier: 2 },
    { min: 3, text: "Awesome!", tier: 3 },
    { min: 4, text: "Excellent!", tier: 4 },
    { min: 5, text: "Legendary!", tier: 5 }
  ];

  const boardEl = document.getElementById("board");
  const trayEl = document.getElementById("tray");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const fxLayer = document.getElementById("fx-layer");
  const praiseEl = document.getElementById("praise");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBest = document.getElementById("overlay-best");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const ghostEl = document.getElementById("ghost");

  let best = Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  let grid = emptyGrid();
  let tray = [null, null, null];
  let score = 0;
  let streak = 0;
  let playing = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let clearing = false;
  let cellEls = [];
  let cellSize = 40;

  let drag = null; // { idx, piece, pointerId, grabDr, grabDc }

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubPlays) HubPlays.record("blockblast");
    if (window.HubStreak) HubStreak.recordPlay();
  }

  function shapeBounds(cells) {
    let maxR = 0;
    let maxC = 0;
    cells.forEach(([r, c]) => {
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
    });
    return { rows: maxR + 1, cols: maxC + 1 };
  }

  function pickShape() {
    const total = SHAPES.reduce((s, sh) => s + sh.weight, 0);
    let roll = Math.random() * total;
    for (const sh of SHAPES) {
      roll -= sh.weight;
      if (roll <= 0) {
        return {
          cells: sh.cells.map(([r, c]) => [r, c]),
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        };
      }
    }
    const last = SHAPES[0];
    return { cells: last.cells.map(([r, c]) => [r, c]), color: COLORS[0] };
  }

  function refillTray() {
    if (tray.some(Boolean)) return;
    tray = [pickShape(), pickShape(), pickShape()];
  }

  function canPlace(piece, row, col) {
    if (!piece) return false;
    for (const [dr, dc] of piece.cells) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
      if (grid[r][c]) return false;
    }
    return true;
  }

  function anyPlacement(piece) {
    if (!piece) return false;
    const { rows, cols } = shapeBounds(piece.cells);
    for (let r = 0; r <= SIZE - rows; r += 1) {
      for (let c = 0; c <= SIZE - cols; c += 1) {
        if (canPlace(piece, r, c)) return true;
      }
    }
    return false;
  }

  function hasMoves() {
    return tray.some((p) => anyPlacement(p));
  }

  function placePiece(piece, row, col) {
    for (const [dr, dc] of piece.cells) {
      grid[row + dr][col + dc] = piece.color;
    }
  }

  function findClears() {
    const rows = [];
    const cols = [];
    for (let r = 0; r < SIZE; r += 1) {
      if (grid[r].every(Boolean)) rows.push(r);
    }
    for (let c = 0; c < SIZE; c += 1) {
      let full = true;
      for (let r = 0; r < SIZE; r += 1) {
        if (!grid[r][c]) {
          full = false;
          break;
        }
      }
      if (full) cols.push(c);
    }
    return { rows, cols };
  }

  function countClearedBlocks(rows, cols) {
    const set = new Set();
    rows.forEach((r) => {
      for (let c = 0; c < SIZE; c += 1) set.add(`${r},${c}`);
    });
    cols.forEach((c) => {
      for (let r = 0; r < SIZE; r += 1) set.add(`${r},${c}`);
    });
    return set.size;
  }

  function applyClears(rows, cols) {
    rows.forEach((r) => {
      for (let c = 0; c < SIZE; c += 1) grid[r][c] = 0;
    });
    cols.forEach((c) => {
      for (let r = 0; r < SIZE; r += 1) grid[r][c] = 0;
    });
  }

  function boardEmpty() {
    return grid.every((row) => row.every((v) => !v));
  }

  // Block Blast-ish: 10 per cleared cell, multi-line bonus, streak multiplier.
  function scoreClear(lines, clearedBlocks) {
    if (lines <= 0) {
      streak = 0;
      return 0;
    }
    streak += 1;
    const base = clearedBlocks * 10;
    const multiBonus = lines * (10 + lines * 10);
    const streakMult = 1 + Math.max(0, streak - 1) * 0.5;
    return Math.floor((base + multiBonus) * streakMult);
  }

  function saveBest() {
    if (score <= best) return;
    best = score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
    updateHud();
    maybeSubmit(true);
    if (best >= 2000) window.HubConfetti?.burst?.();
  }

  function maybeSubmit(force) {
    if (best <= 0 || !window.HubLeaderboard) return;
    const now = Date.now();
    if (!force && now - lastSubmitAt < 6000) return;
    lastSubmitAt = now;
    HubLeaderboard.submit("blockblast", best).catch?.(() => {});
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    if (score >= 250) HubAchievements.unlock("blockblast_score_250");
    if (score >= 1000) HubAchievements.unlock("blockblast_score_1000");
    if (score >= 2500) HubAchievements.unlock("blockblast_score_2500");
    if (best >= 5000) HubAchievements.unlock("blockblast_score_5000");
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (overlayBest) overlayBest.textContent = String(best);
  }

  function measureCell() {
    const first = cellEls[0];
    if (!first) return;
    cellSize = first.getBoundingClientRect().width || 40;
  }

  function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = "";
    cellEls = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.setAttribute("role", "gridcell");
        boardEl.appendChild(cell);
        cellEls.push(cell);
      }
    }
    measureCell();
  }

  function paintBoard(preview) {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const el = cellEls[r * SIZE + c];
        if (!el) continue;
        const filled = grid[r][c];
        el.classList.remove("filled", "preview-ok", "preview-bad");
        if (filled) {
          el.classList.add("filled");
          el.style.background = filled;
        } else {
          el.style.background = "";
        }
      }
    }
    if (!preview || !preview.piece) return;
    const ok = canPlace(preview.piece, preview.row, preview.col);
    for (const [dr, dc] of preview.piece.cells) {
      const r = preview.row + dr;
      const c = preview.col + dc;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
      const el = cellEls[r * SIZE + c];
      if (!el) continue;
      el.classList.add(ok ? "preview-ok" : "preview-bad");
      if (ok) el.style.background = preview.piece.color;
    }
  }

  function renderPiecePreview(piece, size) {
    const wrap = document.createElement("div");
    wrap.className = "piece-grid";
    const { rows, cols } = shapeBounds(piece.cells);
    wrap.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
    wrap.style.gridTemplateRows = `repeat(${rows}, ${size}px)`;
    const map = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = document.createElement("div");
        cell.style.width = `${size}px`;
        cell.style.height = `${size}px`;
        if (map.has(`${r},${c}`)) {
          cell.className = "piece-cell";
          cell.style.background = piece.color;
        }
        wrap.appendChild(cell);
      }
    }
    return wrap;
  }

  function renderTray() {
    if (!trayEl) return;
    trayEl.innerHTML = "";
    tray.forEach((piece, idx) => {
      const slot = document.createElement("div");
      slot.className = `piece-slot${piece ? "" : " empty"}${drag && drag.idx === idx ? " dragging" : ""}`;
      slot.dataset.idx = String(idx);
      if (piece) {
        slot.appendChild(renderPiecePreview(piece, 18));
        slot.setAttribute("aria-label", `Block ${idx + 1}. Drag onto board`);
      } else {
        slot.setAttribute("aria-label", `Empty slot ${idx + 1}`);
      }
      trayEl.appendChild(slot);
    });
  }

  function showPraise(lines) {
    if (!praiseEl || lines <= 0) return;
    let pick = PRAISE[0];
    for (const p of PRAISE) {
      if (lines >= p.min) pick = p;
    }
    praiseEl.hidden = false;
    praiseEl.textContent = pick.text;
    praiseEl.className = `praise tier-${pick.tier}`;
    clearTimeout(showPraise._t);
    showPraise._t = setTimeout(() => {
      praiseEl.hidden = true;
    }, 850);
  }

  function floatScore(points, row, col) {
    if (!fxLayer || points <= 0) return;
    const el = document.createElement("div");
    el.className = "float-score";
    el.textContent = `+${points}`;
    const cell = cellEls[row * SIZE + col];
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cell ? cell.getBoundingClientRect() : boardRect;
    el.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
    el.style.top = `${cellRect.top - boardRect.top + cellRect.height / 2}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function markClearing(rows, cols) {
    const marked = new Set();
    rows.forEach((r) => {
      for (let c = 0; c < SIZE; c += 1) marked.add(`${r},${c}`);
    });
    cols.forEach((c) => {
      for (let r = 0; r < SIZE; r += 1) marked.add(`${r},${c}`);
    });
    marked.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const el = cellEls[r * SIZE + c];
      if (el) el.classList.add("clearing");
    });
  }

  function afterPlace(piece, row, col) {
    // Small placement points (feels alive while filling).
    const placePts = piece.cells.length;
    score += placePts;

    const { rows, cols } = findClears();
    const lines = rows.length + cols.length;
    const clearedBlocks = countClearedBlocks(rows, cols);
    const midR = row + Math.floor(shapeBounds(piece.cells).rows / 2);
    const midC = col + Math.floor(shapeBounds(piece.cells).cols / 2);

    if (lines > 0) {
      let clearPts = scoreClear(lines, clearedBlocks);
      clearing = true;
      markClearing(rows, cols);
      window.HubSound?.play?.("merge");
      showPraise(lines);
      setTimeout(() => {
        applyClears(rows, cols);
        if (boardEmpty()) {
          clearPts += 500;
          showPraise(5);
          window.HubConfetti?.burst?.();
        }
        score += clearPts;
        saveBest();
        checkAchievements();
        updateHud();
        floatScore(placePts + clearPts, Math.min(SIZE - 1, midR), Math.min(SIZE - 1, midC));
        clearing = false;
        paintBoard(null);
        finishTurn();
      }, 280);
    } else {
      streak = 0;
      window.HubSound?.play?.("click");
      saveBest();
      checkAchievements();
      updateHud();
      floatScore(placePts, Math.min(SIZE - 1, midR), Math.min(SIZE - 1, midC));
      paintBoard(null);
      finishTurn();
    }
  }

  function finishTurn() {
    refillTray();
    renderTray();
    paintBoard(null);
    if (!hasMoves()) endGame();
  }

  function tryPlaceAt(piece, row, col, idx) {
    if (!playing || clearing || !piece) return false;
    if (!canPlace(piece, row, col)) {
      window.HubSound?.play?.("error");
      return false;
    }
    placePiece(piece, row, col);
    tray[idx] = null;
    afterPlace(piece, row, col);
    return true;
  }

  function boardCellFromPoint(clientX, clientY) {
    const rect = boardEl.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientY < rect.top ||
      clientX > rect.right ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const pad = 10;
    const gap = 4;
    const innerW = rect.width - pad * 2;
    const innerH = rect.height - pad * 2;
    const stepX = (innerW - gap * (SIZE - 1)) / SIZE + gap;
    const stepY = (innerH - gap * (SIZE - 1)) / SIZE + gap;
    const x = clientX - rect.left - pad;
    const y = clientY - rect.top - pad;
    const col = Math.floor(x / stepX);
    const row = Math.floor(y / stepY);
    if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return null;
    return { row, col };
  }

  function placementFromPointer(piece, clientX, clientY) {
    // Ghost sits above finger; map finger to an anchor cell, then offset by grab cell.
    const hover = boardCellFromPoint(clientX, clientY);
    if (!hover || !drag) return null;
    const row = hover.row - drag.grabDr;
    const col = hover.col - drag.grabDc;
    return { row, col };
  }

  function showGhost(piece, clientX, clientY) {
    if (!ghostEl || !piece) {
      if (ghostEl) ghostEl.hidden = true;
      return;
    }
    measureCell();
    const size = Math.max(28, Math.floor(cellSize));
    ghostEl.hidden = false;
    ghostEl.innerHTML = "";
    ghostEl.appendChild(renderPiecePreview(piece, size));
    ghostEl.style.left = `${clientX}px`;
    ghostEl.style.top = `${clientY}px`;
  }

  function hideGhost() {
    if (!ghostEl) return;
    ghostEl.hidden = true;
    ghostEl.innerHTML = "";
  }

  function startDrag(idx, pointerId, clientX, clientY, target) {
    if (!playing || clearing) return;
    const piece = tray[idx];
    if (!piece) return;
    const bounds = shapeBounds(piece.cells);
    // Grab near center of shape for natural feel.
    const grabDr = Math.floor(bounds.rows / 2);
    const grabDc = Math.floor(bounds.cols / 2);
    drag = { idx, piece, pointerId, grabDr, grabDc };
    try {
      target.setPointerCapture?.(pointerId);
    } catch {}
    renderTray();
    showGhost(piece, clientX, clientY);
    const place = placementFromPointer(piece, clientX, clientY);
    if (place) paintBoard({ piece, row: place.row, col: place.col });
    window.HubSound?.play?.("click");
  }

  function moveDrag(clientX, clientY) {
    if (!drag) return;
    showGhost(drag.piece, clientX, clientY);
    const place = placementFromPointer(drag.piece, clientX, clientY);
    if (place) paintBoard({ piece: drag.piece, row: place.row, col: place.col });
    else paintBoard(null);
  }

  function endDrag(clientX, clientY, commit) {
    if (!drag) return;
    const { idx, piece } = drag;
    const place = commit ? placementFromPointer(piece, clientX, clientY) : null;
    drag = null;
    hideGhost();
    renderTray();
    if (place && tryPlaceAt(piece, place.row, place.col, idx)) return;
    paintBoard(null);
    if (commit && place) window.HubSound?.play?.("error");
  }

  function startGame() {
    ensureSession();
    grid = emptyGrid();
    tray = [null, null, null];
    refillTray();
    score = 0;
    streak = 0;
    playing = true;
    clearing = false;
    drag = null;
    hideGhost();
    overlay?.classList.add("hidden");
    updateHud();
    renderTray();
    paintBoard(null);
  }

  function endGame() {
    playing = false;
    drag = null;
    hideGhost();
    saveBest();
    maybeSubmit(true);
    checkAchievements();
    if (overlayTitle) overlayTitle.textContent = "No more moves";
    if (overlayText) overlayText.textContent = `Score ${score}. Best ${best}. Drag again to beat it.`;
    if (startBtn) startBtn.textContent = "Play again";
    overlay?.classList.remove("hidden");
    window.HubSound?.play?.("error");
  }

  function showMenu() {
    if (overlayTitle) overlayTitle.textContent = "Block Blast";
    if (overlayText) {
      overlayText.textContent = playing
        ? "Paused. Resume or start a fresh board."
        : "Drag colorful blocks onto the 8×8 board. Clear lines, chain combos, beat your best.";
    }
    if (startBtn) startBtn.textContent = playing ? "Resume" : score ? "Play again" : "Play";
    overlay?.classList.remove("hidden");
  }

  buildBoard();
  updateHud();
  renderTray();
  paintBoard(null);
  window.addEventListener("resize", measureCell);

  trayEl?.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const slot = e.target.closest(".piece-slot");
    if (!slot || slot.classList.contains("empty")) return;
    e.preventDefault();
    startDrag(Number(slot.dataset.idx), e.pointerId, e.clientX, e.clientY, slot);
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  });

  window.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag(e.clientX, e.clientY, true);
  });

  window.addEventListener("pointercancel", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag(e.clientX, e.clientY, false);
  });

  startBtn?.addEventListener("click", () => {
    if (playing && startBtn.textContent === "Resume") {
      overlay?.classList.add("hidden");
      return;
    }
    startGame();
  });
  menuBtn?.addEventListener("click", () => showMenu());
  gamesBtn?.addEventListener("click", () => {
    window.location.href = "../index.html#games";
  });

  window.addEventListener("beforeunload", () => maybeSubmit(true));
  maybeSubmit(false);
})();
