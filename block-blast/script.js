(function () {
  const HIGH_SCORE_KEY = "block-blast-high-score";
  const SIZE = 8;
  const COLORS = [
    "#5ec8ff",
    "#5dde9a",
    "#ffb454",
    "#ff6b7a",
    "#c084fc",
    "#f472b6",
    "#67e8f9",
    "#facc15"
  ];

  const SHAPES = [
    { cells: [[0, 0]], weight: 8 },
    { cells: [[0, 0], [0, 1]], weight: 10 },
    { cells: [[0, 0], [1, 0]], weight: 10 },
    { cells: [[0, 0], [0, 1], [0, 2]], weight: 9 },
    { cells: [[0, 0], [1, 0], [2, 0]], weight: 9 },
    { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 8 },
    { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 6 },
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 6 },
    { cells: [[0, 0], [1, 0], [1, 1]], weight: 8 },
    { cells: [[0, 1], [1, 0], [1, 1]], weight: 8 },
    { cells: [[0, 0], [0, 1], [1, 1]], weight: 8 },
    { cells: [[0, 0], [0, 1], [1, 0]], weight: 8 },
    { cells: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 6 },
    { cells: [[0, 1], [1, 1], [2, 0], [2, 1]], weight: 6 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], weight: 6 },
    { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], weight: 6 },
    { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], weight: 5 },
    { cells: [[0, 1], [1, 1], [2, 0], [2, 1]], weight: 5 },
    { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], weight: 5 },
    { cells: [[0, 1], [1, 0], [1, 1], [2, 0]], weight: 5 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]], weight: 3 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 5 },
    { cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], weight: 3 },
    { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], weight: 2 },
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], weight: 2 }
  ];

  const boardEl = document.getElementById("board");
  const trayEl = document.getElementById("tray");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const comboEl = document.getElementById("combo");
  const statusEl = document.getElementById("status");
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
  let selected = -1;
  let score = 0;
  let combo = 0;
  let playing = false;
  let sessionStarted = false;
  let lastSubmitAt = 0;
  let clearing = false;
  let dragActive = false;
  let suppressClick = false;
  let hoverCell = null;
  let cellEls = [];

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
    const last = SHAPES[SHAPES.length - 1];
    return {
      cells: last.cells.map(([r, c]) => [r, c]),
      color: COLORS[0]
    };
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

  function applyClears(rows, cols) {
    rows.forEach((r) => {
      for (let c = 0; c < SIZE; c += 1) grid[r][c] = 0;
    });
    cols.forEach((c) => {
      for (let r = 0; r < SIZE; r += 1) grid[r][c] = 0;
    });
  }

  function scorePlacement(pieceCells, clearCount) {
    const base = pieceCells * 10;
    if (clearCount <= 0) {
      combo = 0;
      return base;
    }
    combo += 1;
    const linePts = clearCount * 100;
    const comboBonus = Math.max(0, combo - 1) * 50 * clearCount;
    return base + linePts + comboBonus;
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

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("good", "warn");
    if (kind) statusEl.classList.add(kind);
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (comboEl) comboEl.textContent = `×${Math.max(1, combo)}`;
    if (overlayBest) overlayBest.textContent = String(best);
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

  function renderPiecePreview(piece, cellSize) {
    const wrap = document.createElement("div");
    wrap.className = "piece-grid";
    const { rows, cols } = shapeBounds(piece.cells);
    wrap.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    wrap.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
    const map = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = document.createElement("div");
        if (map.has(`${r},${c}`)) {
          cell.className = "piece-cell";
          cell.style.background = piece.color;
          cell.style.width = `${cellSize}px`;
          cell.style.height = `${cellSize}px`;
        } else {
          cell.style.width = `${cellSize}px`;
          cell.style.height = `${cellSize}px`;
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
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `piece-slot${piece ? "" : " empty"}${selected === idx ? " selected" : ""}`;
      slot.dataset.idx = String(idx);
      if (piece) {
        slot.appendChild(renderPiecePreview(piece, 16));
        slot.setAttribute("aria-label", `Select piece ${idx + 1}`);
      } else {
        slot.setAttribute("aria-label", `Empty slot ${idx + 1}`);
        slot.disabled = true;
      }
      trayEl.appendChild(slot);
    });
  }

  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest ? el.closest(".cell") : null;
    if (!cell || !boardEl.contains(cell)) return null;
    return {
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col)
    };
  }

  function anchorForHover(piece, row, col) {
    // Place so the grabbed/top-left of the shape sits near the hovered cell.
    return { row, col };
  }

  function showGhost(piece, clientX, clientY) {
    if (!ghostEl || !piece) {
      if (ghostEl) ghostEl.hidden = true;
      return;
    }
    ghostEl.hidden = false;
    ghostEl.innerHTML = "";
    ghostEl.appendChild(renderPiecePreview(piece, 18));
    const rect = ghostEl.getBoundingClientRect();
    ghostEl.style.left = `${clientX - rect.width / 2}px`;
    ghostEl.style.top = `${clientY - rect.height / 2}px`;
  }

  function hideGhost() {
    if (!ghostEl) return;
    ghostEl.hidden = true;
    ghostEl.innerHTML = "";
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

  function afterPlace(piece, placedCells) {
    const { rows, cols } = findClears();
    const clearCount = rows.length + cols.length;
    const gained = scorePlacement(placedCells, clearCount);
    score += gained;
    saveBest();
    checkAchievements();
    updateHud();

    if (clearCount > 0) {
      clearing = true;
      markClearing(rows, cols);
      window.HubSound?.play?.("merge");
      setStatus(
        clearCount === 1
          ? `Cleared a line · +${gained}`
          : `Cleared ${clearCount} lines · +${gained}`,
        "good"
      );
      if (clearCount >= 3) window.HubConfetti?.burst?.();
      setTimeout(() => {
        applyClears(rows, cols);
        clearing = false;
        paintBoard(null);
        finishTurn();
      }, 260);
    } else {
      window.HubSound?.play?.("click");
      setStatus(`Placed · +${gained}`);
      paintBoard(null);
      finishTurn();
    }
  }

  function finishTurn() {
    refillTray();
    selected = tray.findIndex(Boolean);
    renderTray();
    paintBoard(null);
    if (!hasMoves()) {
      endGame();
      return;
    }
    if (selected >= 0) {
      setStatus("Pick a block to place");
    }
  }

  function tryPlaceAt(row, col) {
    if (!playing || clearing || selected < 0) return false;
    const piece = tray[selected];
    if (!piece || !canPlace(piece, row, col)) {
      window.HubSound?.play?.("error");
      setStatus("Can't place there", "warn");
      return false;
    }
    const cells = piece.cells.length;
    placePiece(piece, row, col);
    tray[selected] = null;
    selected = -1;
    hideGhost();
    hoverCell = null;
    afterPlace(piece, cells);
    return true;
  }

  function selectPiece(idx) {
    if (!playing || clearing) return;
    if (!tray[idx]) return;
    selected = idx;
    renderTray();
    setStatus("Tap the board to place");
    window.HubSound?.play?.("click");
  }

  function startGame() {
    ensureSession();
    grid = emptyGrid();
    tray = [null, null, null];
    refillTray();
    selected = 0;
    score = 0;
    combo = 0;
    playing = true;
    clearing = false;
    hoverCell = null;
    hideGhost();
    overlay?.classList.add("hidden");
    updateHud();
    renderTray();
    paintBoard(null);
    setStatus("Pick a block to place");
  }

  function endGame() {
    playing = false;
    selected = -1;
    hideGhost();
    saveBest();
    maybeSubmit(true);
    checkAchievements();
    if (overlayTitle) overlayTitle.textContent = "Board locked";
    if (overlayText) {
      overlayText.textContent = `No more moves. Score ${score}. Best ${best}.`;
    }
    if (startBtn) startBtn.textContent = "Play again";
    overlay?.classList.remove("hidden");
    window.HubSound?.play?.("error");
    setStatus("No moves left", "warn");
  }

  function showMenu() {
    if (overlayTitle) overlayTitle.textContent = "Block Blast";
    if (overlayText) {
      overlayText.textContent = playing
        ? "Paused. Resume or start a fresh board."
        : "Place colorful blocks on the grid. Clear full rows and columns to keep going.";
    }
    if (startBtn) startBtn.textContent = playing ? "Resume" : score ? "Play again" : "Play";
    overlay?.classList.remove("hidden");
  }

  buildBoard();
  updateHud();
  renderTray();
  paintBoard(null);

  trayEl?.addEventListener("click", (e) => {
    const slot = e.target.closest(".piece-slot");
    if (!slot || slot.classList.contains("empty")) return;
    selectPiece(Number(slot.dataset.idx));
  });

  boardEl?.addEventListener("pointerdown", (e) => {
    if (!playing || clearing || selected < 0 || !tray[selected]) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragActive = true;
    boardEl.setPointerCapture?.(e.pointerId);
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell) {
      hoverCell = cell;
      paintBoard({ piece: tray[selected], ...anchorForHover(tray[selected], cell.row, cell.col) });
    }
    showGhost(tray[selected], e.clientX, e.clientY);
    e.preventDefault();
  });

  boardEl?.addEventListener("pointermove", (e) => {
    if (!dragActive || !playing || selected < 0 || !tray[selected]) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell) {
      hoverCell = cell;
      paintBoard({ piece: tray[selected], ...anchorForHover(tray[selected], cell.row, cell.col) });
    }
    showGhost(tray[selected], e.clientX, e.clientY);
  });

  function endPointer(e, commit) {
    if (!dragActive) return;
    dragActive = false;
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    try {
      boardEl.releasePointerCapture?.(e.pointerId);
    } catch {}
    hideGhost();
    if (!commit || !hoverCell || selected < 0) {
      paintBoard(null);
      return;
    }
    tryPlaceAt(hoverCell.row, hoverCell.col);
    hoverCell = null;
  }

  boardEl?.addEventListener("pointerup", (e) => endPointer(e, true));
  boardEl?.addEventListener("pointercancel", (e) => endPointer(e, false));

  boardEl?.addEventListener("click", (e) => {
    if (suppressClick || dragActive || !playing || clearing || selected < 0) return;
    const cell = e.target.closest(".cell");
    if (!cell) return;
    tryPlaceAt(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  startBtn?.addEventListener("click", () => {
    if (playing && !overlay?.classList.contains("hidden") && startBtn.textContent === "Resume") {
      overlay.classList.add("hidden");
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
