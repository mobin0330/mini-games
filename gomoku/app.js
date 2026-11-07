/*
 * Gomoku browser UI.
 *
 * Browser: exposes the global `GomokuUI` object and mounts the board when the
 * document is ready. CommonJS: exports { create, init } so the same UI code can
 * be exercised against a minimal DOM in tests.
 *
 * The UI is a thin layer over the pure engine: it never mutates the game state
 * itself and only re-renders after a successful engine operation.
 */
(function (root, factory) {
  'use strict';

  var api = factory(root);

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GomokuUI = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SIZE = 15;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;

  var PLAYER_NAMES = { 1: '黑方', 2: '白方' };
  var STONE_NAMES = { 1: '黑棋', 2: '白棋' };

  function cellLabel(row, col, value, isLast, isWinning) {
    var parts = ['第' + (row + 1) + '行第' + (col + 1) + '列'];
    parts.push(value === EMPTY ? '空位' : STONE_NAMES[value]);
    if (isWinning) {
      parts.push('获胜连线');
    }
    if (isLast) {
      parts.push('最后一手');
    }
    return parts.join('，');
  }

  function createUI(doc, engineApi) {
    doc = doc || (root && root.document);
    engineApi = engineApi || (root && root.Gomoku);

    if (!doc || typeof doc.getElementById !== 'function') {
      throw new Error('GomokuUI.create requires a document');
    }
    if (!engineApi || typeof engineApi.createGame !== 'function') {
      throw new Error('GomokuUI.create requires the Gomoku engine');
    }

    var boardEl = doc.getElementById('board');
    var statusEl = doc.getElementById('status');
    var moveCountEl = doc.getElementById('move-count');
    var undoBtn = doc.getElementById('undo');
    var resetBtn = doc.getElementById('reset');

    if (!boardEl || !statusEl || !undoBtn || !resetBtn) {
      throw new Error('GomokuUI.create could not find the required elements');
    }

    var game = engineApi.createGame();
    var cells = [];

    boardEl.setAttribute('role', 'grid');
    boardEl.setAttribute('aria-label', '15乘15五子棋棋盘');
    boardEl.setAttribute('aria-rowcount', String(SIZE));
    boardEl.setAttribute('aria-colcount', String(SIZE));
    boardEl.textContent = '';

    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

    function place(row, col) {
      if (game.winner !== 0 || game.draw) {
        return false;
      }
      var moved = engineApi.play(game, row, col);
      if (!moved) {
        return false;
      }
      render();
      return true;
    }

    function handleKeyDown(row, col, event) {
      if (!event) {
        return;
      }
      var key = event.key;
      if (key === 'Enter' || key === ' ' || key === 'Space' || key === 'Spacebar') {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        place(row, col);
      }
    }

    function createCell(row, col) {
      var cell = doc.createElement('button');
      cell.setAttribute('type', 'button');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', String(row + 1));
      cell.setAttribute('aria-colindex', String(col + 1));
      cell.setAttribute('aria-label', cellLabel(row, col, EMPTY, false, false));
      cell.className = 'cell';
      cell.addEventListener('click', function () {
        place(row, col);
      });
      cell.addEventListener('keydown', function (event) {
        handleKeyDown(row, col, event);
      });
      return cell;
    }

    for (var row = 0; row < SIZE; row += 1) {
      for (var col = 0; col < SIZE; col += 1) {
        var cell = createCell(row, col);
        cells.push(cell);
        boardEl.appendChild(cell);
      }
    }

    function render() {
      var last = game.history.length > 0 ? game.history[game.history.length - 1] : null;
      var winning = {};
      for (var i = 0; i < game.winningLine.length; i += 1) {
        var winCell = game.winningLine[i];
        winning[winCell.row + ',' + winCell.col] = true;
      }

      for (var r = 0; r < SIZE; r += 1) {
        for (var c = 0; c < SIZE; c += 1) {
          var value = game.board[r][c];
          var isLast = last !== null && last.row === r && last.col === c;
          var isWinning = winning[r + ',' + c] === true;
          var cellEl = cells[r * SIZE + c];
          var className = 'cell';

          if (value === BLACK) {
            className += ' cell--black';
          } else if (value === WHITE) {
            className += ' cell--white';
          }
          if (isLast) {
            className += ' cell--last';
          }
          if (isWinning) {
            className += ' cell--winning';
          }

          cellEl.className = className;
          cellEl.disabled = game.winner !== 0 || game.draw;
          cellEl.setAttribute('aria-label', cellLabel(r, c, value, isLast, isWinning));
        }
      }

      var statusText;
      var statusClass = 'status';

      if (game.winner !== 0) {
        statusText = PLAYER_NAMES[game.winner] + '获胜！';
        statusClass += ' status--win';
      } else if (game.draw) {
        statusText = '和棋，棋盘已满。';
        statusClass += ' status--draw';
      } else {
        statusText = PLAYER_NAMES[game.currentPlayer] + '回合';
      }

      statusEl.textContent = statusText;
      statusEl.className = statusClass;

      if (moveCountEl) {
        moveCountEl.textContent = '已落子 ' + game.history.length + ' 手';
      }

      undoBtn.disabled = game.history.length === 0;
      resetBtn.disabled = false;
    }

    function undo() {
      var changed = engineApi.undo(game);
      if (changed) {
        render();
      }
      return changed;
    }

    function reset() {
      engineApi.reset(game);
      render();
      return true;
    }

    undoBtn.addEventListener('click', undo);
    resetBtn.addEventListener('click', reset);

    render();

    return {
      game: game,
      cells: cells,
      boardEl: boardEl,
      statusEl: statusEl,
      moveCountEl: moveCountEl,
      undoButton: undoBtn,
      resetButton: resetBtn,
      place: place,
      undo: undo,
      reset: reset,
      render: render
    };
  }

  var api = {
    create: createUI,
    init: init,
    instance: null
  };

  function init() {
    if (!root || !root.document) {
      return null;
    }
    var ui = createUI(root.document, root.Gomoku);
    api.instance = ui;
    return ui;
  }

  if (root && root.document && typeof root.document.getElementById === 'function') {
    if (
      root.document.readyState === 'loading' &&
      typeof root.document.addEventListener === 'function'
    ) {
      root.document.addEventListener('DOMContentLoaded', function () {
        if (!api.instance) {
          init();
        }
      });
    } else {
      init();
    }
  }

  return api;
});
