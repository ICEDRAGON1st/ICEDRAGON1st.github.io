/**
 * Shared legal-move checks for turn games.
 * Browser clients use these before writing a room; a later Edge Function
 * should run the same functions so REST cannot invent illegal boards.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HubMatchRules = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const TTT_WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  const C4_ROWS = 6;
  const C4_COLS = 7;
  const C4_DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  function emptyTttBoard() {
    return Array(9).fill(0);
  }

  function emptyC4Grid() {
    return Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0));
  }

  function tttBoard(state) {
    const board = Array.isArray(state?.board) ? state.board : emptyTttBoard();
    if (board.length !== 9) return null;
    return board.map((cell) => (cell === 1 || cell === 2 ? cell : 0));
  }

  function c4Grid(state) {
    const grid = Array.isArray(state?.grid) ? state.grid : emptyC4Grid();
    if (grid.length !== C4_ROWS) return null;
    const out = [];
    for (let r = 0; r < C4_ROWS; r++) {
      const row = Array.isArray(grid[r]) ? grid[r] : null;
      if (!row || row.length !== C4_COLS) return null;
      out.push(row.map((cell) => (cell === 1 || cell === 2 ? cell : 0)));
    }
    return out;
  }

  function tttWinner(board) {
    for (const [a, b, c] of TTT_WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: [a, b, c] };
      }
    }
    return null;
  }

  function c4InBounds(row, col) {
    return row >= 0 && row < C4_ROWS && col >= 0 && col < C4_COLS;
  }

  function c4WinnerFrom(grid, row, col, player) {
    for (const [dr, dc] of C4_DIRS) {
      let n = 1;
      let r = row + dr;
      let c = col + dc;
      while (c4InBounds(r, c) && grid[r][c] === player) {
        n += 1;
        r += dr;
        c += dc;
      }
      r = row - dr;
      c = col - dc;
      while (c4InBounds(r, c) && grid[r][c] === player) {
        n += 1;
        r -= dr;
        c -= dc;
      }
      if (n >= 4) return player;
    }
    return 0;
  }

  function c4Full(grid) {
    return grid[0].every((cell) => cell !== 0);
  }

  function sameArray(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function incomingPatch(room) {
    return {
      state: room?.state,
      turn: room?.turn,
      result: room?.result || null
    };
  }

  function sameSnapshot(prev, next) {
    return (
      sameArray(prev?.state, next?.state) &&
      prev?.turn === next?.turn &&
      sameArray(prev?.result || null, next?.result || null)
    );
  }

  function expectedResultTtt(board) {
    const win = tttWinner(board);
    if (win) return { type: "win", winner: win.winner };
    if (board.every((cell) => cell !== 0)) return { type: "draw" };
    return null;
  }

  function resultsMatch(expected, got) {
    if (!expected && !got) return true;
    if (!expected || !got) return false;
    if (expected.type !== got.type) return false;
    if (expected.type === "win" && expected.winner !== got.winner) return false;
    return true;
  }

  function validateTicTacToe(room, patch, seat) {
    const prev = tttBoard(room?.state);
    const next = tttBoard(patch?.state);
    if (!prev || !next) return { ok: false, error: "Invalid board" };
    if (seat !== 1 && seat !== 2) return { ok: false, error: "Invalid seat" };

    const changed = [];
    for (let i = 0; i < 9; i += 1) {
      if (prev[i] === next[i]) continue;
      if (prev[i] !== 0) return { ok: false, error: "Cannot overwrite a mark" };
      changed.push(i);
    }
    if (changed.length !== 1) return { ok: false, error: "Exactly one mark required" };
    if (next[changed[0]] !== seat) return { ok: false, error: "Wrong mark" };

    const expectedTurn = seat === 1 ? 2 : 1;
    if (patch.turn !== expectedTurn) return { ok: false, error: "Turn mismatch" };

    const expected = expectedResultTtt(next);
    if (!resultsMatch(expected, patch.result || null)) {
      return { ok: false, error: "Result does not match the board" };
    }
    return { ok: true };
  }

  function validateConnectFour(room, patch, seat) {
    const prev = c4Grid(room?.state);
    const next = c4Grid(patch?.state);
    if (!prev || !next) return { ok: false, error: "Invalid board" };
    if (seat !== 1 && seat !== 2) return { ok: false, error: "Invalid seat" };

    let drop = null;
    for (let r = 0; r < C4_ROWS; r += 1) {
      for (let c = 0; c < C4_COLS; c += 1) {
        if (prev[r][c] === next[r][c]) continue;
        if (prev[r][c] !== 0) return { ok: false, error: "Cannot overwrite a disc" };
        if (drop) return { ok: false, error: "Exactly one disc required" };
        if (next[r][c] !== seat) return { ok: false, error: "Wrong disc" };
        drop = { row: r, col: c };
      }
    }
    if (!drop) return { ok: false, error: "Exactly one disc required" };

    for (let r = drop.row + 1; r < C4_ROWS; r += 1) {
      if (next[r][drop.col] === 0) return { ok: false, error: "Disc must fall" };
    }

    const expectedTurn = seat === 1 ? 2 : 1;
    if (patch.turn !== expectedTurn) return { ok: false, error: "Turn mismatch" };

    const winner = c4WinnerFrom(next, drop.row, drop.col, seat);
    const expected = winner ? { type: "win", winner } : c4Full(next) ? { type: "draw" } : null;
    if (!resultsMatch(expected, patch.result || null)) {
      return { ok: false, error: "Result does not match the board" };
    }
    return { ok: true };
  }

  function validateSubmit(game, room, patch, seat) {
    if (!room || room.status !== "playing") return { ok: false, error: "No active match" };
    if (room.turn !== seat) return { ok: false, error: "Not your turn" };
    if (patch && Object.prototype.hasOwnProperty.call(patch, "force")) {
      return { ok: false, error: "Forced writes are not allowed" };
    }
    if (game === "tictactoe") return validateTicTacToe(room, patch, seat);
    if (game === "connect-four") return validateConnectFour(room, patch, seat);
    return { ok: false, error: "Unknown game" };
  }

  function allLegalSuccessors(game, room) {
    const seat = room?.turn;
    const out = [];
    if (game === "tictactoe") {
      const board = tttBoard(room?.state);
      if (!board) return out;
      for (let i = 0; i < 9; i += 1) {
        if (board[i]) continue;
        const nextBoard = board.slice();
        nextBoard[i] = seat;
        const result = expectedResultTtt(nextBoard);
        const mid = {
          ...room,
          state: {
            board: nextBoard,
            winLine: result?.type === "win" ? tttWinner(nextBoard)?.line : null
          },
          turn: seat === 1 ? 2 : 1,
          result,
          status: result ? "finished" : "playing"
        };
        if (validateSubmit(game, room, incomingPatch(mid), seat).ok) out.push(mid);
      }
    }
    if (game === "connect-four") {
      const grid = c4Grid(room?.state);
      if (!grid) return out;
      for (let col = 0; col < C4_COLS; col += 1) {
        let row = -1;
        for (let r = C4_ROWS - 1; r >= 0; r -= 1) {
          if (grid[r][col] === 0) {
            row = r;
            break;
          }
        }
        if (row < 0) continue;
        const nextGrid = grid.map((line) => line.slice());
        nextGrid[row][col] = seat;
        const winner = c4WinnerFrom(nextGrid, row, col, seat);
        const result = winner
          ? { type: "win", winner }
          : c4Full(nextGrid)
            ? { type: "draw" }
            : null;
        const mid = {
          ...room,
          state: { grid: nextGrid, lastDrop: { row, col }, winningCells: [] },
          turn: seat === 1 ? 2 : 1,
          result,
          status: result ? "finished" : "playing"
        };
        if (validateSubmit(game, room, incomingPatch(mid), seat).ok) out.push(mid);
      }
    }
    return out;
  }

  function acceptRemote(game, prev, incoming) {
    if (!incoming) return null;
    if (!prev || prev.status !== "playing" || incoming.status !== "playing") return incoming;
    if (sameSnapshot(prev, incoming)) return incoming;
    if (validateSubmit(game, prev, incomingPatch(incoming), prev.turn).ok) return incoming;
    for (const mid of allLegalSuccessors(game, prev)) {
      if (mid.status === "finished") continue;
      if (validateSubmit(game, mid, incomingPatch(incoming), mid.turn).ok) return incoming;
    }
    return null;
  }

  return {
    validateSubmit,
    acceptRemote,
    sameSnapshot
  };
});
