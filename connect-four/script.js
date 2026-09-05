const boardEl = document.getElementById("board");
const turnLabel = document.getElementById("turn-label");
const hudModeEl = document.getElementById("hud-mode");
const recordEl = document.getElementById("record");
const recordWrap = document.getElementById("record-wrap");
const messageEl = document.getElementById("message");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const viewBoardBtn = document.getElementById("view-board-btn");
const gamesBtn = document.getElementById("games-btn");
const menuBtn = document.getElementById("menu-btn");
const modeBtns = [...document.querySelectorAll("#mode-picker .pick-btn")];
const diffBtns = [...document.querySelectorAll("#difficulty-picker .pick-btn")];
const difficultyPicker = document.getElementById("difficulty-picker");

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;
const STATS_KEY = "connect-four-stats";

const PLAYER = {
  [RED]: { name: "Red", className: "red" },
  [YELLOW]: { name: "Yellow", className: "yellow" }
};

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
];

const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

let board = [];
let current = RED;
let mode = "two";
let difficulty = "easy";
let running = false;
let menuMode = "start";
let winningCells = [];
let thinking = false;
let onlineUnsub = null;

const onlinePanel = document.getElementById("online-panel");
const onlineStatus = document.getElementById("online-status");
const onlineCode = document.getElementById("online-code");
const onlineFriends = document.getElementById("online-friends");
const onlineInvites = document.getElementById("online-invites");
const onlineQuickBtn = document.getElementById("online-quick-btn");
const onlineCreateBtn = document.getElementById("online-create-btn");
const onlineJoinBtn = document.getElementById("online-join-btn");
const onlineJoinInput = document.getElementById("online-join-input");
const onlineCancelBtn = document.getElementById("online-cancel-btn");
const startBtnEl = startBtn;

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function getValidColumns(state = board) {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    if (state[0][c] === EMPTY) cols.push(c);
  }
  return cols;
}

function dropInColumn(state, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state[r][col] === EMPTY) {
      state[r][col] = player;
      return r;
    }
  }
  return -1;
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function findWinningCells(state, row, col, player) {
  for (const [dr, dc] of DIRS) {
    const cells = [{ row, col }];

    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && state[r][c] === player) {
      cells.push({ row: r, col: c });
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && state[r][c] === player) {
      cells.unshift({ row: r, col: c });
      r -= dr;
      c -= dc;
    }

    if (cells.length >= 4) {
      return cells.slice(0, 4);
    }
  }
  return null;
}

function getWinner(state) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = state[r][c];
      if (player === EMPTY) continue;
      if (findWinningCells(state, r, c, player)) return player;
    }
  }
  return null;
}

function isDraw(state) {
  return getValidColumns(state).length === 0 && !getWinner(state);
}

function cloneBoard(state) {
  return state.map((row) => [...row]);
}

function updateRecordDisplay() {
  if (mode === "two" || mode === "online") {
    recordWrap.classList.add("hidden");
    return;
  }

  recordWrap.classList.remove("hidden");
  const stats = loadStats();
  const diffStats = stats[difficulty] || { wins: 0, losses: 0, draws: 0 };
  recordEl.textContent = `${diffStats.wins}W · ${diffStats.losses}L · ${diffStats.draws}D`;
}

function updateHud() {
  const player = PLAYER[current];
  turnLabel.textContent = player.name;
  turnLabel.className = player.className;
  if (mode === "online") {
    const room = window.HubOnlineMatch?.getRoom?.();
    const opp = window.HubOnlineMatch?.opponent?.(room);
    if (room?.status === "waiting") hudModeEl.textContent = "Online · waiting";
    else if (opp?.name) hudModeEl.textContent = `Online vs ${opp.name}`;
    else hudModeEl.textContent = "Online";
  } else {
    hudModeEl.textContent = mode === "two" ? "2 Player" : `vs CPU (${difficulty})`;
  }
  updateRecordDisplay();
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let c = 0; c < COLS; c++) {
    const colBtn = document.createElement("button");
    colBtn.type = "button";
    colBtn.className = "column";
    colBtn.dataset.col = String(c);
    colBtn.setAttribute("aria-label", `Column ${c + 1}`);
    colBtn.disabled = !running || thinking || board[0][c] !== EMPTY;

    for (let r = 0; r < ROWS; r++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const isWin = winningCells.some((w) => w.row === r && w.col === c);
      if (isWin) cell.classList.add("win");

      const value = board[r][c];
      if (value !== EMPTY) {
        const disc = document.createElement("div");
        disc.className = `disc ${PLAYER[value].className}`;
        cell.appendChild(disc);
      }

      colBtn.appendChild(cell);
    }

    colBtn.addEventListener("click", () => playColumn(c));
    boardEl.appendChild(colBtn);
  }
}

function showMenu(kind, title, text) {
  menuMode = kind;
  if (kind !== "playing") running = false;

  overlayTitle.textContent = title;
  overlayText.textContent = text;

  modeBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  diffBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.diff === difficulty));
  difficultyPicker.classList.toggle("hidden", mode !== "cpu");
  onlinePanel?.classList.toggle("hidden", mode !== "online");
  startBtnEl.classList.toggle("hidden", mode === "online" && kind !== "over");

  if (mode === "online" && kind !== "over") refreshOnlineLobby();

  if (kind === "pause") {
    resumeBtn.classList.remove("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  } else if (kind === "over") {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.remove("hidden");
    startBtn.textContent = mode === "online" ? "Menu" : "Play Again";
    startBtnEl.classList.remove("hidden");
  } else {
    resumeBtn.classList.add("hidden");
    viewBoardBtn?.classList.add("hidden");
    startBtn.textContent = "New Game";
  }

  overlay.classList.remove("hidden");
  renderBoard();
}

function viewBoard() {
  if (menuMode !== "over") return;
  overlay.classList.add("hidden");
  renderBoard();
  if (!messageEl.textContent) {
    messageEl.textContent = "Tap Menu to return to the result screen.";
  } else if (!/menu/i.test(messageEl.textContent)) {
    messageEl.textContent = `${messageEl.textContent} · Tap Menu for Play Again.`;
  }
}

function openPauseMenu() {
  if (menuMode === "over") {
    overlay.classList.remove("hidden");
    return;
  }
  if (!running) return;
  showMenu("pause", "Menu", "Resume, start a new game, or go back to Games.");
}

function resetGame() {
  board = createBoard();
  current = RED;
  winningCells = [];
  thinking = false;
  messageEl.textContent = "";
  updateHud();
  renderBoard();
}

function startGame() {
  if (mode === "online") {
    window.HubOnlineMatch?.leaveRoom?.();
    onlineCancelBtn?.classList.add("hidden");
    onlineCode?.classList.add("hidden");
    setOnlineStatus("Play a random opponent, invite a friend, or use a room code.");
    refreshOnlineLobby();
    showMenu("start", "Online Connect Four", "Use Quick Play, invite a friend, or join with a code.");
    return;
  }
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("connect-four");
  resetGame();
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  renderBoard();
}

function resumeGame() {
  if (menuMode !== "pause") return;
  overlay.classList.add("hidden");
  menuMode = "playing";
  running = true;
  renderBoard();
}

function goToGames() {
  window.HubOnlineMatch?.leaveRoom?.();
  window.HubOnlineMatch?.cancelQuickMatch?.("connect-four");
  window.location.href = "../index.html#games";
}

function recordCpuResult(result) {
  const stats = loadStats();
  if (!stats[difficulty]) stats[difficulty] = { wins: 0, losses: 0, draws: 0 };
  stats[difficulty][result] += 1;
  saveStats(stats);
  updateRecordDisplay();
  let wins = 0;
  for (const entry of Object.values(stats || {})) wins += entry.wins || 0;
  if (wins > 0) window.HubLeaderboard?.submit("connect-four", wins);
}

function endGame(winner, isDrawGame) {
  running = false;
  menuMode = "over";

  if (isDrawGame) {
    messageEl.textContent = "It's a draw!";
    if (mode === "cpu") recordCpuResult("draws");
    window.HubSound?.play("draw");
    showMenu("over", "Draw", "The board is full with no winner.");
    return;
  }

  const player = PLAYER[winner];
  messageEl.textContent = `${player.name} wins!`;

  if (mode === "cpu") {
    if (winner === RED) recordCpuResult("wins");
    else recordCpuResult("losses");
  }

  const onlineWin =
    mode === "online" &&
    (() => {
      const room = window.HubOnlineMatch?.getRoom?.();
      const role = window.HubOnlineMatch?.myRole?.(room);
      const myMark = role === "guest" ? YELLOW : RED;
      return winner === myMark;
    })();
  if (window.HubAchievements && (mode === "two" || (mode === "cpu" && winner === RED) || onlineWin)) {
    HubAchievements.unlock("connect4_win");
    try {
      const n = Number(localStorage.getItem("connect4-wins-count") || 0) + 1;
      localStorage.setItem("connect4-wins-count", String(n));
      if (n >= 3) HubAchievements.unlock("connect4_win_3");
    } catch {}
  }
  window.HubSound?.play("win");
  showMenu("over", `${player.name} Wins!`, `${player.name} connected four in a row.`);
}

function applyMove(col, player) {
  const row = dropInColumn(board, col, player);
  if (row < 0) return false;
  window.HubSound?.play("place");

  const winCells = findWinningCells(board, row, col, player);
  if (winCells) {
    winningCells = winCells;
    renderBoard();
    endGame(player, false);
    return true;
  }

  if (isDraw(board)) {
    renderBoard();
    endGame(null, true);
    return true;
  }

  current = player === RED ? YELLOW : RED;
  updateHud();
  renderBoard();
  return true;
}

function pickWinningMove(state, player) {
  for (const col of getValidColumns(state)) {
    const next = cloneBoard(state);
    const row = dropInColumn(next, col, player);
    if (row >= 0 && findWinningCells(next, row, col, player)) return col;
  }
  return null;
}

function pickMediumMove() {
  const win = pickWinningMove(board, YELLOW);
  if (win !== null) return win;

  const block = pickWinningMove(board, RED);
  if (block !== null) return block;

  const valid = new Set(getValidColumns());
  for (const col of CENTER_ORDER) {
    if (valid.has(col)) return col;
  }

  const cols = getValidColumns();
  return cols[Math.floor(Math.random() * cols.length)];
}

function evaluateWindow(windowCells, ai, human) {
  let aiCount = 0;
  let humanCount = 0;
  let empty = 0;

  for (const cell of windowCells) {
    if (cell === ai) aiCount += 1;
    else if (cell === human) humanCount += 1;
    else empty += 1;
  }

  if (aiCount > 0 && humanCount > 0) return 0;
  if (aiCount === 4) return 100000;
  if (humanCount === 4) return -100000;
  if (aiCount === 3 && empty === 1) return 120;
  if (humanCount === 3 && empty === 1) return -140;
  if (aiCount === 2 && empty === 2) return 12;
  if (humanCount === 2 && empty === 2) return -14;
  return 0;
}

function scoreBoard(state, ai, human) {
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += evaluateWindow(
        [state[r][c], state[r][c + 1], state[r][c + 2], state[r][c + 3]],
        ai,
        human
      );
    }
  }

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      score += evaluateWindow(
        [state[r][c], state[r + 1][c], state[r + 2][c], state[r + 3][c]],
        ai,
        human
      );
    }
  }

  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += evaluateWindow(
        [state[r][c], state[r + 1][c + 1], state[r + 2][c + 2], state[r + 3][c + 3]],
        ai,
        human
      );
    }
  }

  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += evaluateWindow(
        [state[r][c], state[r - 1][c + 1], state[r - 2][c + 2], state[r - 3][c + 3]],
        ai,
        human
      );
    }
  }

  for (const col of CENTER_ORDER) {
    if (state[ROWS - 1][col] === ai) score += 4;
    if (state[ROWS - 1][col] === human) score -= 4;
  }

  return score;
}

function minimax(state, depth, alpha, beta, maximizing, ai, human) {
  const winner = getWinner(state);
  if (winner === ai) return 100000 + depth;
  if (winner === human) return -100000 - depth;
  if (isDraw(state) || depth === 0) return scoreBoard(state, ai, human);

  const cols = getValidColumns(state);
  const ordered = CENTER_ORDER.filter((c) => cols.includes(c)).concat(
    cols.filter((c) => !CENTER_ORDER.includes(c))
  );

  if (maximizing) {
    let value = -Infinity;
    for (const col of ordered) {
      const next = cloneBoard(state);
      dropInColumn(next, col, ai);
      value = Math.max(value, minimax(next, depth - 1, alpha, beta, false, ai, human));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const col of ordered) {
    const next = cloneBoard(state);
    dropInColumn(next, col, human);
    value = Math.min(value, minimax(next, depth - 1, alpha, beta, true, ai, human));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function pickHardMove() {
  const win = pickWinningMove(board, YELLOW);
  if (win !== null) return win;

  const block = pickWinningMove(board, RED);
  if (block !== null) return block;

  let bestCol = CENTER_ORDER.find((c) => board[0][c] === EMPTY) ?? 0;
  let bestScore = -Infinity;
  const cols = getValidColumns();

  for (const col of cols) {
    const next = cloneBoard(board);
    dropInColumn(next, col, YELLOW);
    const score = minimax(next, 6, -Infinity, Infinity, false, YELLOW, RED);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}

function pickCpuMove() {
  if (difficulty === "easy") {
    const cols = getValidColumns();
    return cols[Math.floor(Math.random() * cols.length)];
  }
  if (difficulty === "medium") return pickMediumMove();
  return pickHardMove();
}

function maybeCpuTurn() {
  if (!running || mode !== "cpu" || current !== YELLOW) return;

  thinking = true;
  renderBoard();

  window.setTimeout(() => {
    if (!running || current !== YELLOW) {
      thinking = false;
      renderBoard();
      return;
    }

    const col = pickCpuMove();
    thinking = false;
    applyMove(col, YELLOW);
  }, 450);
}

function playColumn(col) {
  if (!running || thinking || board[0][col] !== EMPTY) return;
  if (mode === "cpu" && current !== RED) return;
  if (mode === "online") {
    playOnlineColumn(col);
    return;
  }

  applyMove(col, current);
  if (running) maybeCpuTurn();
}

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running && menuMode === "playing") return;
    mode = btn.dataset.mode;
    modeBtns.forEach((b) => b.classList.toggle("active", b === btn));
    difficultyPicker.classList.toggle("hidden", mode !== "cpu");
    onlinePanel?.classList.toggle("hidden", mode !== "online");
    startBtnEl.classList.toggle("hidden", mode === "online");
    if (mode === "online") refreshOnlineLobby();
    updateRecordDisplay();
  });
});

diffBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (running && menuMode === "playing") return;
    difficulty = btn.dataset.diff;
    diffBtns.forEach((b) => b.classList.toggle("active", b === btn));
    updateRecordDisplay();
  });
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (menuMode === "pause" && !overlay.classList.contains("hidden")) resumeGame();
    else if (running) openPauseMenu();
    else overlay.classList.remove("hidden");
    return;
  }

  if (!running || thinking) return;

  const colMap = {
    Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6,
    Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6
  };

  const col = colMap[e.code];
  if (col !== undefined) {
    e.preventDefault();
    playColumn(col);
  }
});

menuBtn.addEventListener("click", () => {
  if (menuMode === "over") {
    overlay.classList.remove("hidden");
    return;
  }
  if (running) openPauseMenu();
  else if (menuMode === "pause") resumeGame();
  else overlay.classList.remove("hidden");
});

startBtn.addEventListener("click", () => startGame());
resumeBtn.addEventListener("click", () => resumeGame());
viewBoardBtn?.addEventListener("click", () => viewBoard());
gamesBtn.addEventListener("click", () => goToGames());

updateHud();
renderBoard();
showMenu(
  "start",
  "Connect Four",
  "Drop discs and connect four in a row — horizontal, vertical, or diagonal."
);

function setOnlineStatus(text) {
  if (onlineStatus) onlineStatus.textContent = text;
}

function escapeOnline(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function refreshOnlineLobby() {
  if (typeof HubFriends !== "undefined") {
    HubFriends.sync?.().then(() => paintOnlineFriends()).catch(() => paintOnlineFriends());
  } else paintOnlineFriends();
}

function paintOnlineFriends() {
  if (!onlineFriends) return;
  const friends = window.HubFriends?.getFriends?.() || [];
  const invites = (window.HubFriends?.getInvites?.() || []).filter(
    (i) => i.game === "connect-four"
  );
  if (onlineInvites) {
    onlineInvites.innerHTML = invites.length
      ? `<p class="online-sub">Invites</p>${invites
          .map(
            (inv) =>
              `<button type="button" class="btn btn-secondary online-friend-btn" data-accept-invite="${inv.id}">Accept ${escapeOnline(inv.fromName)}</button>`
          )
          .join("")}`
      : "";
  }
  if (!friends.length) {
    onlineFriends.innerHTML = `<p class="online-sub">Friends — add people in the hub Friends panel</p>`;
    return;
  }
  onlineFriends.innerHTML = `<p class="online-sub">Invite a friend</p>${friends
    .map(
      (f) =>
        `<button type="button" class="btn btn-secondary online-friend-btn" data-invite-friend="${f.playerId}">Invite ${escapeOnline(f.name)}</button>`
    )
    .join("")}`;
}

function syncBoardFromRoom(room) {
  if (!room?.state?.grid) return;
  board = room.state.grid.map((row) => [...row]);
  winningCells = room.state.winningCells || [];
  current = room.turn === 2 ? YELLOW : RED;
  updateHud();
  renderBoard();
}

function beginOnlineMatch(room) {
  if (!room) return;
  onlineCancelBtn?.classList.add("hidden");
  if (window.HubStreak) HubStreak.recordPlay();
  if (window.HubPlays) HubPlays.record("connect-four");
  syncBoardFromRoom(room);
  messageEl.textContent = "";
  if (room.status === "waiting") {
    setOnlineStatus(`Waiting for opponent… Code ${room.code}`);
    if (onlineCode) {
      onlineCode.textContent = `Room code: ${room.code}`;
      onlineCode.classList.remove("hidden");
    }
    overlay.classList.remove("hidden");
    menuMode = "start";
    running = false;
  } else {
    overlay.classList.add("hidden");
    menuMode = "playing";
    running = true;
  }
  ensureOnlineSub();
}

function ensureOnlineSub() {
  if (onlineUnsub) return;
  onlineUnsub = window.HubOnlineMatch?.subscribe?.((room) => {
    if (!room) return;
    if (room.status === "playing" && menuMode !== "playing") {
      beginOnlineMatch(room);
      return;
    }
    if (room.status === "playing") {
      syncBoardFromRoom(room);
      const role = window.HubOnlineMatch.myRole(room);
      const myMark = role === "guest" ? YELLOW : RED;
      messageEl.textContent =
        current === myMark
          ? "Your turn"
          : `Waiting for ${window.HubOnlineMatch.opponent(room)?.name || "opponent"}…`;
    }
    if (room.status === "finished") {
      syncBoardFromRoom(room);
      running = false;
      const res = room.result || {};
      endGame(res.winner || null, res.type === "draw");
    }
    if (room.status === "abandoned") {
      running = false;
      showMenu("over", "Opponent left", "Your opponent left the match.");
    }
  });
}

async function playOnlineColumn(col) {
  const room = window.HubOnlineMatch?.getRoom?.();
  if (!room || room.status !== "playing") return;
  const role = window.HubOnlineMatch.myRole(room);
  const myMark = role === "guest" ? YELLOW : RED;
  if (current !== myMark || board[0][col] !== EMPTY) return;

  const next = cloneBoard(board);
  const row = dropInColumn(next, col, myMark);
  if (row < 0) return;
  const winCells = findWinningCells(next, row, col, myMark);
  const full = getValidColumns(next).length === 0;
  const nextTurn = myMark === RED ? 2 : 1;
  const result = winCells
    ? { type: "win", winner: myMark }
    : full
      ? { type: "draw" }
      : null;

  board = next;
  winningCells = winCells || [];
  current = nextTurn === 2 ? YELLOW : RED;
  renderBoard();
  updateHud();

  const submitted = await window.HubOnlineMatch.submitState({
    state: {
      grid: next.map((r) => [...r]),
      lastDrop: { row, col },
      winningCells: winCells || []
    },
    turn: nextTurn,
    result
  });
  if (!submitted.ok) {
    messageEl.textContent = submitted.error || "Move failed";
    await window.HubOnlineMatch.refresh?.();
    syncBoardFromRoom(window.HubOnlineMatch.getRoom());
    return;
  }
  if (result) endGame(result.winner || null, result.type === "draw");
}

onlineQuickBtn?.addEventListener("click", async () => {
  setOnlineStatus("Looking for a player…");
  onlineCancelBtn?.classList.remove("hidden");
  const result = await window.HubOnlineMatch?.quickMatch?.("connect-four");
  if (!result?.ok) {
    setOnlineStatus(result?.error || "Quick Play failed");
    onlineCancelBtn?.classList.add("hidden");
    return;
  }
  beginOnlineMatch(result.room);
  if (result.room?.status === "waiting") setOnlineStatus("Looking for a player…");
});

onlineCancelBtn?.addEventListener("click", async () => {
  await window.HubOnlineMatch?.cancelQuickMatch?.("connect-four");
  onlineCancelBtn?.classList.add("hidden");
  onlineCode?.classList.add("hidden");
  setOnlineStatus("Search cancelled.");
});

onlineCreateBtn?.addEventListener("click", async () => {
  const result = await window.HubOnlineMatch?.createRoom?.("connect-four", "private");
  if (!result?.ok) {
    setOnlineStatus(result?.error || "Couldn't create room");
    return;
  }
  beginOnlineMatch(result.room);
  setOnlineStatus(`Share code ${result.room.code}`);
  if (onlineCode) {
    onlineCode.textContent = `Room code: ${result.room.code}`;
    onlineCode.classList.remove("hidden");
  }
});

onlineJoinBtn?.addEventListener("click", async () => {
  const result = await window.HubOnlineMatch?.joinRoom?.(
    "connect-four",
    onlineJoinInput?.value || ""
  );
  if (!result?.ok) {
    setOnlineStatus(result?.error || "Couldn't join");
    return;
  }
  beginOnlineMatch(result.room);
});

onlineFriends?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-invite-friend]");
  if (!btn) return;
  const result = await window.HubOnlineMatch?.inviteFriend?.(
    "connect-four",
    btn.dataset.inviteFriend
  );
  if (!result?.ok) {
    setOnlineStatus(result?.error || "Invite failed");
    return;
  }
  beginOnlineMatch(result.room);
  setOnlineStatus(`Invite sent · code ${result.room.code}`);
});

onlineInvites?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accept-invite]");
  if (!btn || typeof HubFriends === "undefined") return;
  const accepted = await HubFriends.respondInvite(btn.dataset.acceptInvite, true);
  if (!accepted.ok) {
    setOnlineStatus(accepted.error || "Invite expired");
    return;
  }
  const joined = accepted.roomId
    ? await window.HubOnlineMatch?.joinRoomById?.(accepted.roomId)
    : await window.HubOnlineMatch?.joinRoom?.("connect-four", accepted.code);
  if (!joined?.ok) {
    setOnlineStatus(joined?.error || "Couldn't join invite");
    return;
  }
  beginOnlineMatch(joined.room);
});

(async function bootOnlineParams() {
  const params = new URLSearchParams(location.search);
  const inviteId = params.get("invite");
  const inviteFriend = params.get("inviteFriend");
  if (inviteId || inviteFriend) {
    mode = "online";
    modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === "online"));
    onlinePanel?.classList.remove("hidden");
    startBtnEl.classList.add("hidden");
    difficultyPicker.classList.add("hidden");
    showMenu("start", "Online Connect Four", "Connecting…");
  }
  if (inviteId && typeof HubFriends !== "undefined") {
    await HubFriends.sync?.();
    const accepted = await HubFriends.respondInvite(inviteId, true);
    if (accepted.ok) {
      const joined = accepted.roomId
        ? await HubOnlineMatch.joinRoomById(accepted.roomId)
        : await HubOnlineMatch.joinRoom("connect-four", accepted.code);
      if (joined.ok) beginOnlineMatch(joined.room);
      else setOnlineStatus(joined.error || "Couldn't join");
    }
  } else if (inviteFriend && typeof HubOnlineMatch !== "undefined") {
    const result = await HubOnlineMatch.inviteFriend("connect-four", inviteFriend);
    if (result.ok) {
      beginOnlineMatch(result.room);
      setOnlineStatus(`Invite sent · code ${result.room.code}`);
    } else setOnlineStatus(result.error || "Invite failed");
  }
})();

