/*
 * Gomoku rules engine.
 *
 * Browser: exposes the global `Gomoku` object (works from file://).
 * CommonJS: exports { createGame, play, undo, reset }.
 *
 * Pure rules only: no DOM, no network, no dependencies.
 */
(function (root, factory) {
  'use strict';

  var api = factory();

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.Gomoku = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SIZE = 15;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;

  var DIRECTIONS = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1]   // diagonal down-left
  ];

  function createBoard() {
    var board = [];
    for (var row = 0; row < SIZE; row += 1) {
      var cells = [];
      for (var col = 0; col < SIZE; col += 1) {
        cells.push(EMPTY);
      }
      board.push(cells);
    }
    return board;
  }

  function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function otherPlayer(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function collectLine(board, row, col, dr, dc, player) {
    var cells = [];
    var r = row;
    var c = col;

    // Walk to the first stone of the run, then collect forwards.
    while (inBounds(r - dr, c - dc) && board[r - dr][c - dc] === player) {
      r -= dr;
      c -= dc;
    }
    while (inBounds(r, c) && board[r][c] === player) {
      cells.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    return cells;
  }

  function findWinningLine(board, row, col, player) {
    for (var i = 0; i < DIRECTIONS.length; i += 1) {
      var dr = DIRECTIONS[i][0];
      var dc = DIRECTIONS[i][1];
      var line = collectLine(board, row, col, dr, dc, player);
      if (line.length >= 5) {
        return line;
      }
    }
    return null;
  }

  function isFull(board) {
    for (var row = 0; row < SIZE; row += 1) {
      for (var col = 0; col < SIZE; col += 1) {
        if (board[row][col] === EMPTY) {
          return false;
        }
      }
    }
    return true;
  }

  function createGame() {
    return {
      board: createBoard(),
      currentPlayer: BLACK,
      winner: 0,
      draw: false,
      history: [],
      winningLine: []
    };
  }

  function play(game, row, col) {
    if (!game || typeof game !== 'object') {
      return false;
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return false;
    }
    if (!inBounds(row, col)) {
      return false;
    }
    if (!Array.isArray(game.board) || !Array.isArray(game.board[row])) {
      return false;
    }
    if (game.winner !== 0 || game.draw === true) {
      return false;
    }
    if (game.currentPlayer !== BLACK && game.currentPlayer !== WHITE) {
      return false;
    }
    if (game.board[row][col] !== EMPTY) {
      return false;
    }

    var player = game.currentPlayer;
    game.board[row][col] = player;
    game.history.push({ row: row, col: col, player: player });

    var winningLine = findWinningLine(game.board, row, col, player);
    if (winningLine) {
      game.winner = player;
      game.winningLine = winningLine;
      // The winner keeps the turn when the game ends.
      return true;
    }

    if (isFull(game.board)) {
      game.draw = true;
    }
    game.currentPlayer = otherPlayer(player);
    return true;
  }

  function undo(game) {
    if (!game || typeof game !== 'object') {
      return false;
    }
    if (!Array.isArray(game.history) || game.history.length === 0) {
      return false;
    }

    var last = game.history[game.history.length - 1];
    if (!last || !Number.isInteger(last.row) || !Number.isInteger(last.col)) {
      return false;
    }

    if (Array.isArray(game.board) && Array.isArray(game.board[last.row])) {
      game.board[last.row][last.col] = EMPTY;
    }
    game.history.pop();

    game.currentPlayer = last.player === WHITE ? WHITE : BLACK;
    game.winner = 0;
    game.draw = false;
    game.winningLine = [];
    return true;
  }

  function reset(game) {
    if (!game || typeof game !== 'object') {
      return game;
    }

    game.board = createBoard();
    game.currentPlayer = BLACK;
    game.winner = 0;
    game.draw = false;
    game.history = [];
    game.winningLine = [];
    return game;
  }

  return {
    createGame: createGame,
    play: play,
    undo: undo,
    reset: reset
  };
});
