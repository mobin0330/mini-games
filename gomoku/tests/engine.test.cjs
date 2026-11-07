'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../engine.js');
const { createGame, play, undo, reset } = engine;

const SIZE = 15;
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
];

function snapshot(game) {
  return JSON.stringify(game);
}

function cellKey(cell) {
  return `${cell.row},${cell.col}`;
}

function sortedKeys(cells) {
  return cells.map(cellKey).sort();
}

function assertSameCells(actual, expected, message) {
  const expectedCells = expected.map(([row, col]) => ({ row, col }));
  assert.deepEqual(sortedKeys(actual), sortedKeys(expectedCells), message);
}

// Longest run of `player` stones in any of the four directions.
function longestRun(board, player) {
  let longest = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      for (const [dr, dc] of DIRECTIONS) {
        const prevRow = row - dr;
        const prevCol = col - dc;
        if (
          prevRow >= 0 &&
          prevRow < SIZE &&
          prevCol >= 0 &&
          prevCol < SIZE &&
          board[prevRow][prevCol] === player
        ) {
          continue;
        }
        let length = 0;
        let r = row;
        let c = col;
        while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === player) {
          length += 1;
          r += dr;
          c += dc;
        }
        if (length > longest) {
          longest = length;
        }
      }
    }
  }
  return longest;
}

function playAlternating(game, blackMoves, whiteMoves) {
  for (let i = 0; i < blackMoves.length; i += 1) {
    const [blackRow, blackCol] = blackMoves[i];
    assert.equal(play(game, blackRow, blackCol), true, `black move ${i} should succeed`);
    if (i < whiteMoves.length) {
      const [whiteRow, whiteCol] = whiteMoves[i];
      assert.equal(play(game, whiteRow, whiteCol), true, `white move ${i} should succeed`);
    }
  }
}

test('createGame returns the documented initial state', () => {
  const game = createGame();

  assert.equal(Array.isArray(game.board), true);
  assert.equal(game.board.length, SIZE);
  for (const row of game.board) {
    assert.equal(Array.isArray(row), true);
    assert.equal(row.length, SIZE);
    for (const cell of row) {
      assert.equal(cell, 0);
    }
  }

  assert.equal(game.currentPlayer, 1);
  assert.equal(game.winner, 0);
  assert.equal(game.draw, false);
  assert.deepEqual(game.history, []);
  assert.deepEqual(game.winningLine, []);
});

test('exports the fixed API and exposes the browser global', () => {
  assert.deepEqual(Object.keys(engine).sort(), ['createGame', 'play', 'reset', 'undo']);
  assert.equal(typeof globalThis.Gomoku, 'object');
  assert.equal(globalThis.Gomoku.createGame, createGame);
  assert.equal(globalThis.Gomoku.play, play);
  assert.equal(globalThis.Gomoku.undo, undo);
  assert.equal(globalThis.Gomoku.reset, reset);
});

test('players alternate, black moving first', () => {
  const game = createGame();

  assert.equal(game.currentPlayer, 1);
  assert.equal(play(game, 7, 7), true);
  assert.equal(game.board[7][7], 1);
  assert.deepEqual(game.history[0], { row: 7, col: 7, player: 1 });
  assert.equal(game.currentPlayer, 2);

  assert.equal(play(game, 8, 8), true);
  assert.equal(game.board[8][8], 2);
  assert.deepEqual(game.history[1], { row: 8, col: 8, player: 2 });
  assert.equal(game.currentPlayer, 1);

  assert.equal(play(game, 6, 6), true);
  assert.equal(game.board[6][6], 1);
  assert.equal(game.currentPlayer, 2);
});

const WIN_CASES = [
  {
    name: 'horizontal',
    black: [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]],
    white: [[0, 0], [0, 2], [0, 4], [0, 6]]
  },
  {
    name: 'vertical',
    black: [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7]],
    white: [[14, 0], [14, 2], [14, 4], [14, 6]]
  },
  {
    name: 'diagonal down-right',
    black: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
    white: [[0, 14], [0, 12], [0, 10], [0, 8]]
  },
  {
    name: 'diagonal down-left',
    black: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]],
    white: [[14, 14], [14, 12], [14, 10], [14, 8]]
  },
  {
    name: 'bottom-edge horizontal',
    black: [[14, 10], [14, 11], [14, 12], [14, 13], [14, 14]],
    white: [[0, 0], [0, 2], [0, 4], [0, 6]]
  },
  {
    name: 'right-edge vertical',
    black: [[0, 14], [1, 14], [2, 14], [3, 14], [4, 14]],
    white: [[14, 0], [14, 2], [14, 4], [14, 6]]
  }
];

for (const winCase of WIN_CASES) {
  test(`detects a ${winCase.name} win`, () => {
    const game = createGame();

    playAlternating(game, winCase.black, winCase.white);

    assert.equal(game.winner, 1);
    assert.equal(game.currentPlayer, 1, 'the winner keeps the turn');
    assert.equal(game.draw, false);
    assert.equal(game.history.length, winCase.black.length + winCase.white.length);
    assert.equal(game.winningLine.length, 5);
    assertSameCells(game.winningLine, winCase.black);

    for (const cell of game.winningLine) {
      assert.equal(game.board[cell.row][cell.col], 1);
    }
  });
}

test('a winning line may be longer than five', () => {
  const game = createGame();
  const black = [[7, 0], [7, 1], [7, 2], [7, 4], [7, 5], [7, 3]];
  const white = [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8]];

  playAlternating(game, black, white);

  assert.equal(game.winner, 1);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.winningLine.length, 6);
  assertSameCells(game.winningLine, black);
});

test('invalid moves return false and change nothing', () => {
  const game = createGame();
  assert.equal(play(game, 7, 7), true);

  const before = snapshot(game);
  const invalidMoves = [
    [1.5, 7],
    [7, 1.5],
    ['7', 7],
    [7, '7'],
    [NaN, 7],
    [Infinity, 7],
    [null, 7],
    [undefined, 7],
    [-1, 7],
    [15, 7],
    [7, -1],
    [7, 15],
    [7, 7], // occupied
    [0, 0.5]
  ];

  for (const [row, col] of invalidMoves) {
    assert.equal(play(game, row, col), false, `move ${String(row)},${String(col)} should fail`);
    assert.equal(snapshot(game), before, 'a failed move must not mutate state');
  }

  assert.equal(play(null, 0, 0), false);
  assert.equal(play(undefined, 0, 0), false);
  assert.equal(play({}, 0, 0), false);

  assert.equal(game.history.length, 1);
  assert.equal(game.currentPlayer, 2);
});

test('no move is accepted after the game is won', () => {
  const game = createGame();
  playAlternating(
    game,
    [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]],
    [[0, 0], [0, 2], [0, 4], [0, 6]]
  );

  assert.equal(game.winner, 1);
  const before = snapshot(game);

  assert.equal(play(game, 5, 5), false);
  assert.equal(snapshot(game), before);

  assert.equal(play(game, 7, 4), false);
  assert.equal(snapshot(game), before);

  assert.equal(game.history.length, 9);
  assert.equal(game.currentPlayer, 1);
});

test('undo removes the last move and restores its player', () => {
  const game = createGame();
  const empty = snapshot(game);

  assert.equal(undo(game), false);
  assert.equal(snapshot(game), empty);

  assert.equal(play(game, 7, 7), true); // black
  assert.equal(play(game, 8, 8), true); // white

  assert.equal(undo(game), true);
  assert.equal(game.board[8][8], 0);
  assert.equal(game.board[7][7], 1);
  assert.equal(game.currentPlayer, 2);
  assert.equal(game.history.length, 1);
  assert.equal(game.winner, 0);
  assert.equal(game.draw, false);
  assert.deepEqual(game.winningLine, []);

  assert.equal(undo(game), true);
  assert.equal(game.board[7][7], 0);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.history.length, 0);

  assert.equal(undo(game), false);
});

test('undo reopens a finished game and allows the win to be replayed', () => {
  const game = createGame();
  playAlternating(
    game,
    [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]],
    [[0, 0], [0, 2], [0, 4], [0, 6]]
  );

  assert.equal(game.winner, 1);
  assert.equal(game.winningLine.length, 5);

  assert.equal(undo(game), true);
  assert.equal(game.winner, 0);
  assert.equal(game.draw, false);
  assert.deepEqual(game.winningLine, []);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.board[7][4], 0);
  assert.equal(game.history.length, 8);

  assert.equal(play(game, 7, 4), true);
  assert.equal(game.winner, 1);
  assert.equal(game.winningLine.length, 5);
  assert.equal(game.currentPlayer, 1);
});

test('reset restores the original object to the initial state', () => {
  const game = createGame();
  playAlternating(
    game,
    [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]],
    [[0, 0], [0, 2], [0, 4], [0, 6]]
  );

  assert.equal(game.winner, 1);

  const returned = reset(game);

  assert.equal(returned, game, 'reset returns the same object');
  assert.deepEqual(game, createGame());
});

test('a full board with no five in a row is a draw', () => {
  // 4-periodic colouring with no run of five in any direction.
  // Colour 1 is (row + 2*col) % 4 in {0, 1}; colour 2 is in {2, 3}.
  const blackCells = [];
  const whiteCells = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = (row + 2 * col) % 4;
      if (value < 2) {
        blackCells.push([row, col]);
      } else {
        whiteCells.push([row, col]);
      }
    }
  }

  assert.equal(blackCells.length, 113);
  assert.equal(whiteCells.length, 112);

  const game = createGame();
  for (let i = 0; i < whiteCells.length; i += 1) {
    assert.equal(play(game, blackCells[i][0], blackCells[i][1]), true);
    assert.equal(play(game, whiteCells[i][0], whiteCells[i][1]), true);
  }
  const [lastRow, lastCol] = blackCells[blackCells.length - 1];
  assert.equal(play(game, lastRow, lastCol), true);

  assert.equal(game.draw, true);
  assert.equal(game.winner, 0);
  assert.deepEqual(game.winningLine, []);
  assert.equal(game.history.length, 225);
  assert.ok(longestRun(game.board, 1) < 5, 'black must have no five in a row');
  assert.ok(longestRun(game.board, 2) < 5, 'white must have no five in a row');

  for (const row of game.board) {
    for (const cell of row) {
      assert.notEqual(cell, 0);
    }
  }

  const before = snapshot(game);
  assert.equal(play(game, 0, 0), false);
  assert.equal(snapshot(game), before);

  assert.equal(undo(game), true);
  assert.equal(game.draw, false);
  assert.equal(game.winner, 0);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.history.length, 224);
  assert.equal(game.board[lastRow][lastCol], 0);

  assert.equal(play(game, lastRow, lastCol), true);
  assert.equal(game.draw, true);
});
