"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const rules = require(path.join(ROOT, "hub-match-rules.js"));

function tttRoom(board, turn = 1) {
  return {
    game: "tictactoe",
    status: "playing",
    turn,
    state: { board, winLine: null },
    result: null
  };
}

function c4Room(grid, turn = 1) {
  return {
    game: "connect-four",
    status: "playing",
    turn,
    state: { grid, lastDrop: null, winningCells: [] },
    result: null
  };
}

function emptyC4() {
  return Array.from({ length: 6 }, () => Array(7).fill(0));
}

test("Tic Tac Toe accepts one legal mark and rejects overwrites or force", () => {
  const room = tttRoom(Array(9).fill(0), 1);
  const legal = Array(9).fill(0);
  legal[0] = 1;
  assert.equal(
    rules.validateSubmit(
      "tictactoe",
      room,
      { state: { board: legal, winLine: null }, turn: 2, result: null },
      1
    ).ok,
    true
  );
  assert.equal(
    rules.validateSubmit(
      "tictactoe",
      room,
      { state: { board: legal, winLine: null }, turn: 2, result: null },
      2
    ).ok,
    false
  );
  assert.match(
    rules.validateSubmit(
      "tictactoe",
      room,
      { state: { board: legal, winLine: null }, turn: 2, result: null, force: true },
      1
    ).error,
    /Forced/
  );

  const occupied = tttRoom(legal, 2);
  const overwrite = legal.slice();
  overwrite[0] = 2;
  assert.equal(
    rules.validateSubmit(
      "tictactoe",
      occupied,
      { state: { board: overwrite, winLine: null }, turn: 1, result: null },
      2
    ).ok,
    false
  );
});

test("Tic Tac Toe win and draw results must match the board", () => {
  const almost = [1, 1, 0, 2, 2, 0, 0, 0, 0];
  const won = [1, 1, 1, 2, 2, 0, 0, 0, 0];
  assert.equal(
    rules.validateSubmit(
      "tictactoe",
      tttRoom(almost, 1),
      { state: { board: won, winLine: [0, 1, 2] }, turn: 2, result: { type: "win", winner: 1 } },
      1
    ).ok,
    true
  );
  assert.equal(
    rules.validateSubmit(
      "tictactoe",
      tttRoom(almost, 1),
      { state: { board: won, winLine: [0, 1, 2] }, turn: 2, result: null },
      1
    ).ok,
    false
  );
});

test("Drop Four accepts a fallen disc and rejects a floating or extra disc", () => {
  const grid = emptyC4();
  const next = emptyC4();
  next[5][3] = 1;
  assert.equal(
    rules.validateSubmit(
      "connect-four",
      c4Room(grid, 1),
      {
        state: { grid: next, lastDrop: { row: 5, col: 3 }, winningCells: [] },
        turn: 2,
        result: null
      },
      1
    ).ok,
    true
  );

  const floating = emptyC4();
  floating[3][3] = 1;
  assert.equal(
    rules.validateSubmit(
      "connect-four",
      c4Room(grid, 1),
      {
        state: { grid: floating, lastDrop: { row: 3, col: 3 }, winningCells: [] },
        turn: 2,
        result: null
      },
      1
    ).ok,
    false
  );

  const two = emptyC4();
  two[5][3] = 1;
  two[5][4] = 1;
  assert.equal(
    rules.validateSubmit(
      "connect-four",
      c4Room(grid, 1),
      {
        state: { grid: two, lastDrop: { row: 5, col: 4 }, winningCells: [] },
        turn: 2,
        result: null
      },
      1
    ).ok,
    false
  );
});

test("remote snapshots ignore illegal jumps but recover one missed ply", () => {
  const start = tttRoom(Array(9).fill(0), 1);
  const one = tttRoom([1, 0, 0, 0, 0, 0, 0, 0, 0], 2);
  const two = tttRoom([1, 2, 0, 0, 0, 0, 0, 0, 0], 1);
  const jump = tttRoom([1, 2, 1, 2, 1, 2, 0, 0, 0], 1);

  assert.ok(rules.acceptRemote("tictactoe", start, one));
  assert.ok(rules.acceptRemote("tictactoe", start, two));
  assert.equal(rules.acceptRemote("tictactoe", start, jump), null);
});

test("online match helper no longer honors a client force flag", () => {
  const source = fs.readFileSync(path.join(ROOT, "hub-online-match.js"), "utf8");
  assert.doesNotMatch(source, /!patch\.force/);
  assert.match(source, /HubMatchRules/);
});
