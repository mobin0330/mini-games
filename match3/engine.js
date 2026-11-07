'use strict';

/*
 * Pure Match-3 engine with dessert specials.
 *
 * No DOM, storage, timers or other host dependencies. The module works both as
 * a CommonJS module and as a plain browser script that exposes
 * window.Match3Engine.
 *
 * Board values:
 *   0..5              normal desserts
 *   type + 6 * kind   special dessert that keeps its color for matching
 *
 * Special kinds:
 *   1  row rocket     clears its row
 *   2  column rocket  clears its column
 *   3  chocolate bomb  clears a 3x3 area
 *   4  rainbow lollipop clears every dessert of the paired color
 */

var SIZE = 8;
var CELLS = SIZE * SIZE;
var TYPES = 6;
var MAX_GENERATION_ATTEMPTS = 32;
var MAX_CASCADE_DEPTH = 100;

var SPECIAL = {
  NONE: 0,
  ROW: 1,
  COL: 2,
  BOMB: 3,
  RAINBOW: 4
};

var BASE_TILE_SCORE = 20;
var EXTRA_TILE_SCORE = 15;
var SPECIAL_ACTIVATION_SCORE = 30;
var CASCADE_MULTIPLIERS = [1, 1.5, 2, 3, 4];

/*
 * A fixed, stable, playable board used as the last-resort fallback when a
 * hostile random source prevents generation from finding a legal move.
 *
 * It has no initial matches and contains a legal swap at [1, 9].
 */
var FALLBACK_BOARD = [
  1, 2, 1, 0, 2, 4, 0, 2,
  1, 1, 5, 1, 3, 5, 1, 3,
  2, 4, 0, 2, 4, 0, 2, 4,
  3, 5, 1, 3, 5, 1, 3, 5,
  4, 0, 2, 4, 0, 2, 4, 0,
  5, 1, 3, 5, 1, 3, 5, 1,
  0, 2, 4, 0, 2, 4, 0, 2,
  1, 3, 5, 1, 3, 5, 1, 3
];

function asRandom(random) {
  return typeof random === 'function' ? random : Math.random;
}

function tileType(value) {
  return value % TYPES;
}

function specialKind(value) {
  return Math.floor(value / TYPES);
}

function isRainbow(value) {
  return specialKind(value) === SPECIAL.RAINBOW;
}

function isColored(value) {
  return specialKind(value) !== SPECIAL.RAINBOW;
}

function makeSpecial(type, kind) {
  return type + kind * TYPES;
}

function sameColor(a, b) {
  return isColored(a) && isColored(b) && tileType(a) === tileType(b);
}

/* Read one tile type. Tolerates hostile random sources (throws, NaN, 1, ...). */
function pickTile(random) {
  var value;
  try {
    value = Number(random());
  } catch (error) {
    value = 0;
  }
  if (!Number.isFinite(value)) {
    value = 0;
  }
  var scaled = value * TYPES;
  if (!Number.isFinite(scaled)) {
    scaled = 0;
  }
  value = Math.floor(scaled) % TYPES;
  if (!Number.isFinite(value)) {
    value = 0;
  }
  if (value < 0) {
    value += TYPES;
  }
  return value;
}

function wouldCompleteMatch(board, index, value) {
  var row = Math.floor(index / SIZE);
  var col = index % SIZE;

  if (col >= 2 && board[index - 1] === value && board[index - 2] === value) {
    return true;
  }
  if (row >= 2 && board[index - SIZE] === value && board[index - 2 * SIZE] === value) {
    return true;
  }
  return false;
}

/*
 * Fill the board row by row. At every cell there is at most one forbidden
 * value coming from the horizontal pair and at most one from the vertical
 * pair, so among six tile types one is always available.
 */
function buildCandidateBoard(random, attempt) {
  var board = new Array(CELLS);

  for (var i = 0; i < CELLS; i++) {
    var start = pickTile(random);
    var chosen = -1;

    for (var k = 0; k < TYPES; k++) {
      var value = (start + k + i * (attempt + 1) + attempt * 3) % TYPES;
      if (!wouldCompleteMatch(board, i, value)) {
        chosen = value;
        break;
      }
    }

    /* Defensive only; the loop above always finds a value. */
    if (chosen < 0) {
      chosen = (start + 1) % TYPES;
    }
    board[i] = chosen;
  }

  return board;
}

function generateBoard(random) {
  var rnd = asRandom(random);

  for (var attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    var board = buildCandidateBoard(rnd, attempt);
    if (findMatches(board).length === 0 && findMove(board) !== null) {
      return board;
    }
  }

  return FALLBACK_BOARD.slice();
}

function findMatches(board) {
  var matches = new Set();

  if (!Array.isArray(board) || board.length !== CELLS) {
    return [];
  }

  /* Horizontal runs. */
  for (var row = 0; row < SIZE; row++) {
    var rowStart = 0;
    for (var col = 1; col <= SIZE; col++) {
      var sameRow = col < SIZE &&
        sameColor(board[row * SIZE + col], board[row * SIZE + col - 1]);
      if (!sameRow) {
        var rowLength = col - rowStart;
        if (rowLength >= 3) {
          for (var rc = rowStart; rc < col; rc++) {
            matches.add(row * SIZE + rc);
          }
        }
        rowStart = col;
      }
    }
  }

  /* Vertical runs. Runs never wrap between rows or columns. */
  for (var column = 0; column < SIZE; column++) {
    var colStart = 0;
    for (var r = 1; r <= SIZE; r++) {
      var sameCol = r < SIZE &&
        sameColor(board[r * SIZE + column], board[(r - 1) * SIZE + column]);
      if (!sameCol) {
        var colLength = r - colStart;
        if (colLength >= 3) {
          for (var rr = colStart; rr < r; rr++) {
            matches.add(rr * SIZE + column);
          }
        }
        colStart = r;
      }
    }
  }

  return Array.from(matches).sort(function (a, b) {
    return a - b;
  });
}

function findGroups(board) {
  var groups = [];

  if (!Array.isArray(board) || board.length !== CELLS) {
    return groups;
  }

  for (var row = 0; row < SIZE; row++) {
    var rowStart = 0;
    for (var col = 1; col <= SIZE; col++) {
      var sameRow = col < SIZE &&
        sameColor(board[row * SIZE + col], board[row * SIZE + col - 1]);
      if (!sameRow) {
        var rowLength = col - rowStart;
        if (rowLength >= 3) {
          var rowIndices = [];
          for (var rc = rowStart; rc < col; rc++) {
            rowIndices.push(row * SIZE + rc);
          }
          groups.push({
            indices: rowIndices,
            orientation: 'h',
            type: tileType(board[row * SIZE + rowStart]),
            length: rowLength
          });
        }
        rowStart = col;
      }
    }
  }

  for (var column = 0; column < SIZE; column++) {
    var colStart = 0;
    for (var r = 1; r <= SIZE; r++) {
      var sameCol = r < SIZE &&
        sameColor(board[r * SIZE + column], board[(r - 1) * SIZE + column]);
      if (!sameCol) {
        var colLength = r - colStart;
        if (colLength >= 3) {
          var colIndices = [];
          for (var rr = colStart; rr < r; rr++) {
            colIndices.push(rr * SIZE + column);
          }
          groups.push({
            indices: colIndices,
            orientation: 'v',
            type: tileType(board[colStart * SIZE + column]),
            length: colLength
          });
        }
        colStart = r;
      }
    }
  }

  return groups;
}

function findMove(board) {
  if (!Array.isArray(board) || board.length !== CELLS) {
    return null;
  }

  for (var i = 0; i < CELLS; i++) {
    var row = Math.floor(i / SIZE);
    var col = i % SIZE;

    if (col + 1 < SIZE) {
      var right = i + 1;
      if (isRainbow(board[i]) || isRainbow(board[right])) {
        return [i, right];
      }
      var horizontal = board.slice();
      var tempH = horizontal[i];
      horizontal[i] = horizontal[right];
      horizontal[right] = tempH;
      if (findMatches(horizontal).length > 0) {
        return [i, right];
      }
    }

    if (row + 1 < SIZE) {
      var down = i + SIZE;
      if (isRainbow(board[i]) || isRainbow(board[down])) {
        return [i, down];
      }
      var vertical = board.slice();
      var tempV = vertical[i];
      vertical[i] = vertical[down];
      vertical[down] = tempV;
      if (findMatches(vertical).length > 0) {
        return [i, down];
      }
    }
  }

  return null;
}

function removeAndRefill(board, removedIndices, random) {
  var removed = new Set(removedIndices);

  for (var column = 0; column < SIZE; column++) {
    var writeRow = SIZE - 1;

    for (var readRow = SIZE - 1; readRow >= 0; readRow--) {
      var readIndex = readRow * SIZE + column;
      if (!removed.has(readIndex)) {
        if (writeRow !== readRow) {
          board[writeRow * SIZE + column] = board[readIndex];
        }
        writeRow--;
      }
    }

    for (; writeRow >= 0; writeRow--) {
      board[writeRow * SIZE + column] = pickTile(random);
    }
  }
}

function createGame(options) {
  var opts = options && typeof options === 'object' ? options : {};
  var random = asRandom(opts.random);

  return {
    board: generateBoard(random),
    score: 0,
    moves: 0,
    random: random
  };
}

function reshuffle(game) {
  if (!game || typeof game !== 'object') {
    return game;
  }
  var random = asRandom(game.random);
  game.board = generateBoard(random);
  return game;
}

function invalidSwap() {
  return { valid: false, cascades: [], reshuffled: false };
}

function isAdjacent(a, b) {
  var rowA = Math.floor(a / SIZE);
  var colA = a % SIZE;
  var rowB = Math.floor(b / SIZE);
  var colB = b % SIZE;
  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
}

function cascadeMultiplier(depth) {
  var index = Math.min(Math.max(0, depth - 1), CASCADE_MULTIPLIERS.length - 1);
  return CASCADE_MULTIPLIERS[index];
}

function chooseSpawnIndex(group, preferredA, preferredB, used) {
  var order = [];

  if (group.indices.indexOf(preferredA) >= 0) {
    order.push(preferredA);
  }
  if (group.indices.indexOf(preferredB) >= 0) {
    order.push(preferredB);
  }

  var middle = group.indices[Math.floor(group.indices.length / 2)];
  order.push(middle);

  for (var i = 0; i < group.indices.length; i++) {
    order.push(group.indices[i]);
  }

  for (var j = 0; j < order.length; j++) {
    var index = order[j];
    if (index !== undefined && !used[index]) {
      return index;
    }
  }

  return null;
}

/*
 * Decide which matched groups leave a special behind. Priority:
 * five-in-a-row rainbow, L/T bomb, then four-in-a-row rocket.
 * At most one special is created per group.
 */
function planSpawns(groups, preferredA, preferredB) {
  var spawns = [];
  var used = Object.create(null);
  var consumed = new Set();

  function addSpawn(group, kind, index) {
    if (index === null || used[index] || spawns.length >= 4) {
      return false;
    }
    used[index] = true;
    spawns.push({
      index: index,
      kind: kind,
      type: group.type,
      value: makeSpecial(group.type, kind)
    });
    return true;
  }

  /* Straight five (or longer) creates a rainbow lollipop. */
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    if (group.length >= 5 && !consumed.has(group)) {
      var rainbowIndex = chooseSpawnIndex(group, preferredA, preferredB, used);
      if (addSpawn(group, SPECIAL.RAINBOW, rainbowIndex)) {
        consumed.add(group);
      }
    }
  }

  /* L/T intersections of at least five tiles create a bomb. */
  for (var h = 0; h < groups.length; h++) {
    var horizontal = groups[h];
    if (horizontal.orientation !== 'h' || consumed.has(horizontal)) {
      continue;
    }
    for (var v = 0; v < groups.length; v++) {
      var vertical = groups[v];
      if (vertical.orientation !== 'v' || consumed.has(vertical)) {
        continue;
      }
      var intersection = null;
      for (var hi = 0; hi < horizontal.indices.length; hi++) {
        if (vertical.indices.indexOf(horizontal.indices[hi]) >= 0) {
          intersection = horizontal.indices[hi];
          break;
        }
      }
      if (intersection === null) {
        continue;
      }
      var uniqueCount = new Set(horizontal.indices.concat(vertical.indices)).size;
      if (uniqueCount < 5) {
        continue;
      }
      if (addSpawn(horizontal, SPECIAL.BOMB, intersection)) {
        consumed.add(horizontal);
        consumed.add(vertical);
        break;
      }
    }
  }

  /* Four-in-a-row creates a rocket matching its direction. */
  for (var g = 0; g < groups.length; g++) {
    var four = groups[g];
    if (consumed.has(four) || four.length !== 4) {
      continue;
    }
    var kind = four.orientation === 'h' ? SPECIAL.ROW : SPECIAL.COL;
    var rocketIndex = chooseSpawnIndex(four, preferredA, preferredB, used);
    if (addSpawn(four, kind, rocketIndex)) {
      consumed.add(four);
    }
  }

  return spawns;
}

function mostCommonType(board, excluded) {
  var counts = [0, 0, 0, 0, 0, 0];

  for (var i = 0; i < CELLS; i++) {
    if (excluded && excluded.has(i)) {
      continue;
    }
    var value = board[i];
    if (isColored(value)) {
      counts[tileType(value)]++;
    }
  }

  var bestType = 0;
  for (var type = 1; type < TYPES; type++) {
    if (counts[type] > counts[bestType]) {
      bestType = type;
    }
  }
  return bestType;
}

/*
 * Expand a set of cleared cells into the full blast, activating every
 * special caught in the chain exactly once.
 */
function expandBlast(board, initial, skipRainbow) {
  var clear = new Set(initial);
  var queue = Array.from(clear);
  var activated = new Set();

  for (var qi = 0; qi < queue.length; qi++) {
    var index = queue[qi];
    var value = board[index];
    var kind = specialKind(value);

    if (kind === SPECIAL.NONE || activated.has(index)) {
      continue;
    }
    activated.add(index);

    var added = [];
    var row = Math.floor(index / SIZE);
    var col = index % SIZE;

    if (kind === SPECIAL.ROW) {
      for (var c = 0; c < SIZE; c++) {
        added.push(row * SIZE + c);
      }
    } else if (kind === SPECIAL.COL) {
      for (var r = 0; r < SIZE; r++) {
        added.push(r * SIZE + col);
      }
    } else if (kind === SPECIAL.BOMB) {
      for (var br = row - 1; br <= row + 1; br++) {
        for (var bc = col - 1; bc <= col + 1; bc++) {
          if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE) {
            added.push(br * SIZE + bc);
          }
        }
      }
    } else if (kind === SPECIAL.RAINBOW) {
      if (!skipRainbow || !skipRainbow.has(index)) {
        var targetType = mostCommonType(board, clear);
        for (var t = 0; t < CELLS; t++) {
          if (isColored(board[t]) && tileType(board[t]) === targetType) {
            added.push(t);
          }
        }
      }
    }

    for (var a = 0; a < added.length; a++) {
      if (!clear.has(added[a])) {
        clear.add(added[a]);
        queue.push(added[a]);
      }
    }
  }

  return {
    clear: clear,
    activated: Array.from(activated)
  };
}

function swap(game, a, b) {
  if (!game || typeof game !== 'object' || !Array.isArray(game.board) ||
      game.board.length !== CELLS) {
    return invalidSwap();
  }
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return invalidSwap();
  }
  if (a < 0 || a >= CELLS || b < 0 || b >= CELLS || a === b) {
    return invalidSwap();
  }
  if (!isAdjacent(a, b)) {
    return invalidSwap();
  }

  var originalA = game.board[a];
  var originalB = game.board[b];
  var rainbowSwap = isRainbow(originalA) || isRainbow(originalB);

  var trial = game.board.slice();
  var temp = trial[a];
  trial[a] = trial[b];
  trial[b] = temp;

  /* A normal swap must create a match; rainbow swaps are always legal. */
  if (!rainbowSwap && findMatches(trial).length === 0) {
    return invalidSwap();
  }

  game.board = trial;
  game.moves = (Number.isFinite(game.moves) ? game.moves : 0) + 1;

  var random = asRandom(game.random);
  var cascades = [];
  var depth = 1;

  while (depth <= MAX_CASCADE_DEPTH) {
    var groups = findGroups(game.board);
    var initial = new Set();
    var rainbowSwapThisRound = depth === 1 && rainbowSwap;

    if (groups.length === 0 && !rainbowSwapThisRound) {
      break;
    }

    for (var gi = 0; gi < groups.length; gi++) {
      for (var gj = 0; gj < groups[gi].indices.length; gj++) {
        initial.add(groups[gi].indices[gj]);
      }
    }

    if (rainbowSwapThisRound) {
      initial.add(a);
      initial.add(b);

      if (isRainbow(originalA) && isRainbow(originalB)) {
        for (var all = 0; all < CELLS; all++) {
          initial.add(all);
        }
      } else {
        var other = isRainbow(originalA) ? originalB : originalA;
        if (isColored(other)) {
          var otherType = tileType(other);
          for (var ci = 0; ci < CELLS; ci++) {
            if (isColored(game.board[ci]) && tileType(game.board[ci]) === otherType) {
              initial.add(ci);
            }
          }
        }
      }
    }

    if (initial.size === 0) {
      break;
    }

    var preClear = game.board.slice();
    var skipRainbow = null;
    if (rainbowSwapThisRound) {
      skipRainbow = new Set();
      for (var ri = 0; ri < CELLS; ri++) {
        if (isRainbow(preClear[ri]) && initial.has(ri)) {
          skipRainbow.add(ri);
        }
      }
    }
    var blast = expandBlast(preClear, initial, skipRainbow);
    var clear = blast.clear;
    var spawns = planSpawns(groups, a, b);

    var multiplier = cascadeMultiplier(depth);
    var groupBonus = 0;
    for (var bi = 0; bi < groups.length; bi++) {
      groupBonus += Math.max(0, groups[bi].length - 3) * EXTRA_TILE_SCORE;
    }
    var gained = Math.round(
      (clear.size * BASE_TILE_SCORE +
        groupBonus +
        blast.activated.length * SPECIAL_ACTIVATION_SCORE) * multiplier
    );

    removeAndRefill(game.board, clear, random);

    for (var si = 0; si < spawns.length; si++) {
      game.board[spawns[si].index] = spawns[si].value;
    }

    var after = game.board.slice();
    var indices = Array.from(clear).sort(function (x, y) {
      return x - y;
    });

    cascades.push({
      indices: indices,
      board: preClear,
      after: after,
      depth: depth,
      groups: groups,
      spawns: spawns,
      activated: blast.activated.slice().sort(function (x, y) {
        return x - y;
      }),
      gained: gained
    });

    game.score = (Number.isFinite(game.score) ? game.score : 0) + gained;
    depth++;
  }

  /* Finite guard: hostile random can keep producing matches forever. */
  if (findMatches(game.board).length > 0) {
    game.board = generateBoard(random);
  }

  var reshuffled = false;
  if (!findMove(game.board)) {
    game.board = generateBoard(random);
    reshuffled = true;
  }

  return {
    valid: true,
    cascades: cascades,
    reshuffled: reshuffled
  };
}

var Match3Engine = {
  createGame: createGame,
  findMatches: findMatches,
  findGroups: findGroups,
  findMove: findMove,
  swap: swap,
  reshuffle: reshuffle,
  tileType: tileType,
  specialKind: specialKind,
  isRainbow: isRainbow,
  makeSpecial: makeSpecial,
  SPECIAL: SPECIAL
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Match3Engine;
}

if (typeof window !== 'undefined') {
  window.Match3Engine = Match3Engine;
}
