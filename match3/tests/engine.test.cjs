'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');

function rng(seed = 3) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function patternedBoard() {
  return Array.from({ length: 64 }, (_, i) =>
    (Math.floor(i / 8) * 2 + (i % 8)) % 6
  );
}

function assertPlayableStable(board) {
  assert.equal(board.length, 64);
  assert.ok(board.every((v) => Number.isInteger(v) && v >= 0 && v < 30));
  assert.deepEqual(E.findMatches(board), []);
  assert.ok(E.findMove(board));
}

test('exports the fixed API as CommonJS and window.Match3Engine', () => {
  for (const name of ['createGame', 'findMatches', 'findMove', 'swap', 'reshuffle']) {
    assert.equal(typeof E[name], 'function', name + ' should be exported');
  }

  const source = fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: 'engine.js' });

  assert.ok(sandbox.window.Match3Engine);
  for (const name of ['createGame', 'findMatches', 'findMove', 'swap', 'reshuffle']) {
    assert.equal(typeof sandbox.window.Match3Engine[name], 'function');
  }
});

test('createGame returns a playable stable board even with hostile random', () => {
  const randomSources = [
    undefined,
    rng(),
    () => 0,
    () => 0.999,
    () => Number.NaN,
    () => 1,
    () => -0.5,
    () => { throw new Error('hostile random'); }
  ];

  for (const random of randomSources) {
    const game = E.createGame(random === undefined ? undefined : { random });
    assert.equal(typeof game.random, 'function');
    assert.equal(game.score, 0);
    assert.equal(game.moves, 0);
    assertPlayableStable(game.board);
  }
});

test('findMatches finds deduplicated horizontal and vertical runs only', () => {
  const board = patternedBoard();
  assert.deepEqual(E.findMatches(board), []);

  /* Horizontal run of four at row 2, columns 1..4. */
  for (const index of [17, 18, 19, 20]) {
    board[index] = 5;
  }
  /* Vertical run of three at column 5, rows 4..6. */
  for (const index of [37, 45, 53]) {
    board[index] = 4;
  }

  assert.deepEqual(E.findMatches(board), [17, 18, 19, 20, 37, 45, 53]);
  assert.deepEqual(E.findMatches(board.slice()), E.findMatches(board));
});

test('findMatches never wraps a run across a row boundary', () => {
  const board = patternedBoard();
  board[7] = 5;
  board[8] = 5;
  board[9] = 5;

  assert.deepEqual(E.findMatches(board), []);
});

test('findMove returns null when no legal swap exists and never mutates', () => {
  const board = patternedBoard();
  const before = board.slice();

  assert.deepEqual(E.findMove(board), null);
  assert.deepEqual(board, before);
});

test('findMove returns adjacent indices whose swap creates matches', () => {
  const board = patternedBoard();
  board[0] = 1;
  board[1] = 2;
  board[2] = 1;
  board[9] = 1;

  const before = board.slice();
  const pair = E.findMove(board);

  assert.ok(pair);
  assert.equal(pair.length, 2);
  assert.equal(Math.abs(Math.floor(pair[0] / 8) - Math.floor(pair[1] / 8)) +
    Math.abs((pair[0] % 8) - (pair[1] % 8)), 1);

  const trial = board.slice();
  [trial[pair[0]], trial[pair[1]]] = [trial[pair[1]], trial[pair[0]]];
  assert.ok(E.findMatches(trial).length > 0);
  assert.deepEqual(board, before);
});

test('invalid swaps leave board, score and moves untouched', () => {
  const game = E.createGame({ random: rng(7) });
  game.score = 40;
  game.moves = 2;
  const before = JSON.stringify(game);

  const invalidPairs = [
    [-1, 0],
    [0, 64],
    [0, 0],
    [7, 8],
    [0, 16],
    [0, 9],
    [1.5, 2],
    [Number.NaN, 0]
  ];

  for (const pair of invalidPairs) {
    const result = E.swap(game, pair[0], pair[1]);
    assert.equal(result.valid, false);
    assert.deepEqual(result.cascades, []);
    assert.equal(JSON.stringify(game), before);
  }

  /* Find an adjacent swap that does not create a match. */
  let foundNonMatching = false;
  for (let i = 0; i < 63; i++) {
    if (i % 8 === 7) {
      continue;
    }
    const trial = game.board.slice();
    [trial[i], trial[i + 1]] = [trial[i + 1], trial[i]];
    if (E.findMatches(trial).length === 0) {
      assert.equal(E.swap(game, i, i + 1).valid, false);
      assert.equal(JSON.stringify(game), before);
      foundNonMatching = true;
      break;
    }
  }
  assert.ok(foundNonMatching, 'expected a non-matching adjacent pair');
});

test('valid swaps score cascades and always leave a stable playable board', () => {
  const game = E.createGame({ random: rng(11) });
  let previousScore = game.score;

  for (let move = 1; move <= 12; move++) {
    const pair = E.findMove(game.board);
    assert.ok(pair);

    const swapped = game.board.slice();
    [swapped[pair[0]], swapped[pair[1]]] = [swapped[pair[1]], swapped[pair[0]]];

    const result = E.swap(game, pair[0], pair[1]);
    assert.equal(result.valid, true);
    assert.equal(game.moves, move);
    assert.ok(result.cascades.length >= 1);

    assert.deepEqual(result.cascades[0].board, swapped);
    assert.equal(result.cascades[0].depth, 1);

    result.cascades.forEach((cascade, index) => {
      assert.equal(cascade.depth, index + 1);
      assert.equal(cascade.board.length, 64);
      assert.equal(cascade.after.length, 64);
      assert.ok(cascade.indices.length >= 3);
      assert.deepEqual(cascade.indices, cascade.indices.slice().sort((a, b) => a - b));
      assert.ok(cascade.gained > 0);
      assert.ok(E.findMatches(cascade.board).every((index) => cascade.indices.includes(index)));
    });

    const expectedDelta = result.cascades.reduce(
      (sum, cascade) => sum + cascade.gained,
      0
    );
    assert.equal(game.score, previousScore + expectedDelta);
    previousScore = game.score;

    assertPlayableStable(game.board);
  }
});

test('rainbow lollipops do not join normal color matches', () => {
  const board = patternedBoard();
  board[0] = E.makeSpecial(0, E.SPECIAL.RAINBOW);
  board[1] = E.makeSpecial(0, E.SPECIAL.RAINBOW);
  board[2] = E.makeSpecial(0, E.SPECIAL.RAINBOW);
  assert.deepEqual(E.findMatches(board), []);
  assert.deepEqual(E.findMove(board), [0, 1]);
});

test('four in a row creates a row rocket at the swap position', () => {
  const board = patternedBoard();
  board[0] = 5;
  board[1] = 5;
  board[2] = 4;
  board[3] = 5;
  board[10] = 5;
  assert.deepEqual(E.findMatches(board), []);

  const game = E.createGame({ random: rng(21) });
  game.board = board;
  const result = E.swap(game, 2, 10);

  assert.equal(result.valid, true);
  const spawn = result.cascades[0].spawns.find((item) => item.index === 2);
  assert.ok(spawn);
  assert.equal(spawn.kind, E.SPECIAL.ROW);
  assert.equal(spawn.type, 5);
  assert.equal(result.cascades[0].after[2], E.makeSpecial(5, E.SPECIAL.ROW));
});

test('five in a row creates a rainbow lollipop', () => {
  const board = patternedBoard();
  board[0] = 5;
  board[1] = 5;
  board[2] = 4;
  board[3] = 5;
  board[4] = 5;
  board[5] = 4;
  board[10] = 5;
  assert.deepEqual(E.findMatches(board), []);

  const game = E.createGame({ random: rng(22) });
  game.board = board;
  const result = E.swap(game, 2, 10);

  assert.equal(result.valid, true);
  const spawn = result.cascades[0].spawns.find((item) => item.index === 2);
  assert.ok(spawn);
  assert.equal(spawn.kind, E.SPECIAL.RAINBOW);
  assert.equal(result.cascades[0].after[2], E.makeSpecial(5, E.SPECIAL.RAINBOW));
});

test('T shape creates a chocolate bomb at the intersection', () => {
  const board = patternedBoard();
  board[8] = 5;
  board[9] = 4;
  board[10] = 5;
  board[1] = 5;
  board[17] = 5;
  board[25] = 5;
  assert.deepEqual(E.findMatches(board), []);

  const game = E.createGame({ random: rng(23) });
  game.board = board;
  const result = E.swap(game, 1, 9);

  assert.equal(result.valid, true);
  const spawn = result.cascades[0].spawns.find((item) => item.index === 9);
  assert.ok(spawn);
  assert.equal(spawn.kind, E.SPECIAL.BOMB);
  assert.equal(result.cascades[0].after[9], E.makeSpecial(5, E.SPECIAL.BOMB));
});

test('rainbow swap clears every dessert of the paired color', () => {
  const board = patternedBoard();
  board[0] = E.makeSpecial(2, E.SPECIAL.RAINBOW);
  board[1] = 2;
  assert.deepEqual(E.findMatches(board), []);

  const game = E.createGame({ random: rng(24) });
  game.board = board;
  const expected = [];
  for (let i = 0; i < 64; i++) {
    if (E.tileType(board[i]) === 2 && E.specialKind(board[i]) !== E.SPECIAL.RAINBOW) {
      expected.push(i);
    }
  }
  expected.push(0);

  const result = E.swap(game, 0, 1);
  assert.equal(result.valid, true);
  assert.equal(game.moves, 1);
  assert.deepEqual(
    result.cascades[0].indices,
    expected.slice().sort((a, b) => a - b)
  );
  assert.ok(result.cascades[0].activated.includes(1));
  assert.ok(game.score > 0);
  assert.equal(E.findMatches(game.board).length, 0);
  assert.ok(E.findMove(game.board));
});

test('reshuffle preserves counters and yields a playable stable board', () => {
  for (const random of [rng(5), () => 0, () => 0.999]) {
    const game = E.createGame({ random });
    game.score = 123;
    game.moves = 7;

    E.reshuffle(game);

    assert.equal(game.score, 123);
    assert.equal(game.moves, 7);
    assertPlayableStable(game.board);

    const pair = E.findMove(game.board);
    const result = E.swap(game, pair[0], pair[1]);
    assert.equal(result.valid, true);
    assert.equal(game.moves, 8);
    assertPlayableStable(game.board);
  }
});

test('hostile constant random terminates while preserving counters', () => {
  const game = E.createGame({ random: () => 0 });
  game.score = 50;
  game.moves = 3;

  for (let i = 0; i < 3; i++) {
    const pair = E.findMove(game.board);
    assert.ok(pair);

    const result = E.swap(game, pair[0], pair[1]);

    assert.equal(result.valid, true);
    assert.equal(game.moves, 4 + i);
    assert.ok(Number.isFinite(game.score));
    assert.ok(game.score >= 50);
    assertPlayableStable(game.board);
  }
});
