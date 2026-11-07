'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ENGINE_SOURCE = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

const SIZE = 15;

/* --------------------------------------------------------------------------
 * Minimal DOM used to exercise the real app.js UI code inside a Node VM.
 * It implements only the small surface the UI relies on.
 * ------------------------------------------------------------------------ */

class ClassList {
  constructor(element) {
    this.element = element;
  }

  items() {
    return this.element.className.split(/\s+/).filter(Boolean);
  }

  write(items) {
    this.element.className = items.join(' ');
  }

  add(...tokens) {
    const items = this.items();
    for (const token of tokens) {
      if (!items.includes(token)) {
        items.push(token);
      }
    }
    this.write(items);
  }

  remove(...tokens) {
    const removeSet = new Set(tokens);
    this.write(this.items().filter((token) => !removeSet.has(token)));
  }

  contains(token) {
    return this.items().includes(token);
  }

  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.contains(token) : Boolean(force);
    if (shouldAdd) {
      this.add(token);
    } else {
      this.remove(token);
    }
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = Object.create(null);
    this.listeners = Object.create(null);
    this.className = '';
    this._textContent = '';
    this.disabled = false;
    this.tabIndex = 0;
    this.id = '';
    this.classList = new ClassList(this);
  }

  get firstChild() {
    return this.children.length > 0 ? this.children[0] : null;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    for (const child of this.children) {
      child.parentNode = null;
    }
    this.children.length = 0;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attributes[name] = text;
    if (name === 'id') {
      this.id = text;
    }
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners[type];
    if (!handlers) {
      return;
    }
    const index = handlers.indexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  }

  dispatchEvent(event) {
    const dispatched = event && typeof event === 'object' ? event : {};
    dispatched.target = dispatched.target || this;
    dispatched.currentTarget = this;
    if (typeof dispatched.preventDefault !== 'function') {
      dispatched.defaultPrevented = false;
      dispatched.preventDefault = function preventDefault() {
        dispatched.defaultPrevented = true;
      };
    }
    const handlers = (this.listeners[dispatched.type] || []).slice();
    for (const handler of handlers) {
      handler.call(this, dispatched);
    }
    return !dispatched.defaultPrevented;
  }

  click() {
    return this.dispatchEvent({ type: 'click' });
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }
}

class FakeDocument {
  constructor(ids) {
    this.readyState = 'loading';
    this.elements = new Map();
    this.listeners = Object.create(null);
    this.activeElement = null;

    for (const id of ids) {
      let tagName = 'div';
      if (id === 'status') {
        tagName = 'p';
      } else if (id === 'undo' || id === 'reset') {
        tagName = 'button';
      }
      const element = new FakeElement(tagName, this);
      element.id = id;
      element.setAttribute('id', id);
      this.elements.set(id, element);
    }
  }

  getElementById(id) {
    return this.elements.has(id) ? this.elements.get(id) : null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners[type];
    if (!handlers) {
      return;
    }
    const index = handlers.indexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  }
}

function mountUI() {
  const document = new FakeDocument(['board', 'status', 'move-count', 'undo', 'reset']);
  const sandbox = { document, console };
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SOURCE, sandbox, { filename: 'engine.js' });
  vm.runInContext(APP_SOURCE, sandbox, { filename: 'app.js' });

  assert.equal(typeof sandbox.Gomoku, 'object', 'engine must load in the VM');
  assert.equal(typeof sandbox.GomokuUI, 'object', 'app must load in the VM');
  assert.equal(typeof sandbox.GomokuUI.create, 'function');

  const ui = sandbox.GomokuUI.create(document, sandbox.Gomoku);
  return { document, sandbox, ui };
}

function cellAt(ui, row, col) {
  return ui.cells[row * SIZE + col];
}

function snapshot(game) {
  return JSON.stringify(game);
}

function playSequence(ui, blackMoves, whiteMoves) {
  for (let i = 0; i < blackMoves.length; i += 1) {
    const [blackRow, blackCol] = blackMoves[i];
    cellAt(ui, blackRow, blackCol).click();
    if (i < whiteMoves.length) {
      const [whiteRow, whiteCol] = whiteMoves[i];
      cellAt(ui, whiteRow, whiteCol).click();
    }
  }
}

/* --------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------ */

test('initial UI renders 225 accessible cells and black to move', () => {
  const { ui } = mountUI();

  assert.equal(ui.cells.length, 225);
  assert.equal(ui.boardEl.children.length, 225);
  assert.equal(ui.boardEl.getAttribute('role'), 'grid');
  assert.match(ui.boardEl.getAttribute('aria-label'), /15/);
  assert.equal(ui.statusEl.getAttribute('role'), 'status');
  assert.equal(ui.statusEl.getAttribute('aria-live'), 'polite');
  assert.match(ui.statusEl.textContent, /黑方回合/);
  assert.equal(ui.moveCountEl.textContent, '已落子 0 手');
  assert.equal(ui.undoButton.disabled, true);
  assert.equal(ui.resetButton.disabled, false);

  for (const cell of ui.cells) {
    assert.equal(cell.tagName, 'BUTTON');
    assert.equal(cell.getAttribute('role'), 'gridcell');
    assert.equal(cell.disabled, false);
    assert.ok(cell.tabIndex >= 0, 'cells must be reachable with Tab');
    assert.match(cell.getAttribute('aria-label'), /空位/);
  }

  for (const row of ui.game.board) {
    for (const value of row) {
      assert.equal(value, 0);
    }
  }
});

test('clicking cells places alternating black and white stones', () => {
  const { ui } = mountUI();

  const blackCell = cellAt(ui, 7, 7);
  blackCell.click();

  assert.equal(ui.game.board[7][7], 1);
  assert.equal(ui.game.currentPlayer, 2);
  assert.equal(ui.game.history.length, 1);
  assert.ok(blackCell.classList.contains('cell--black'));
  assert.ok(blackCell.classList.contains('cell--last'));
  assert.match(blackCell.getAttribute('aria-label'), /黑棋/);
  assert.match(ui.statusEl.textContent, /白方回合/);
  assert.equal(ui.moveCountEl.textContent, '已落子 1 手');
  assert.equal(ui.undoButton.disabled, false);

  const whiteCell = cellAt(ui, 8, 8);
  whiteCell.click();

  assert.equal(ui.game.board[8][8], 2);
  assert.equal(ui.game.currentPlayer, 1);
  assert.equal(ui.game.history.length, 2);
  assert.ok(whiteCell.classList.contains('cell--white'));
  assert.ok(whiteCell.classList.contains('cell--last'));
  assert.equal(blackCell.classList.contains('cell--last'), false);
  assert.match(ui.statusEl.textContent, /黑方回合/);
  assert.equal(ui.moveCountEl.textContent, '已落子 2 手');
});

test('clicking an occupied cell does not duplicate or change the game', () => {
  const { ui } = mountUI();

  const cell = cellAt(ui, 7, 7);
  cell.click();
  const before = snapshot(ui.game);
  const statusBefore = ui.statusEl.textContent;

  cell.click();
  cell.click();

  assert.equal(snapshot(ui.game), before);
  assert.equal(ui.game.board[7][7], 1);
  assert.equal(ui.game.history.length, 1);
  assert.equal(ui.game.currentPlayer, 2);
  assert.equal(ui.statusEl.textContent, statusBefore);
});

test('undo removes the last move and restores the correct turn', () => {
  const { ui } = mountUI();

  cellAt(ui, 7, 7).click(); // black
  cellAt(ui, 8, 8).click(); // white

  ui.undoButton.click();

  assert.equal(ui.game.board[8][8], 0);
  assert.equal(ui.game.board[7][7], 1);
  assert.equal(ui.game.history.length, 1);
  assert.equal(ui.game.currentPlayer, 2);
  assert.match(ui.statusEl.textContent, /白方回合/);
  assert.equal(cellAt(ui, 8, 8).classList.contains('cell--white'), false);

  ui.undoButton.click();

  assert.equal(ui.game.board[7][7], 0);
  assert.equal(ui.game.history.length, 0);
  assert.equal(ui.game.currentPlayer, 1);
  assert.match(ui.statusEl.textContent, /黑方回合/);
  assert.equal(ui.undoButton.disabled, true);

  const before = snapshot(ui.game);
  ui.undoButton.click();
  assert.equal(snapshot(ui.game), before);
});

test('reset clears the board, history, and terminal styling', () => {
  const { ui } = mountUI();

  playSequence(
    ui,
    [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]],
    [[0, 0], [0, 2], [0, 4], [0, 6]]
  );
  assert.equal(ui.game.winner, 1);

  ui.resetButton.click();

  assert.equal(ui.game.winner, 0);
  assert.equal(ui.game.draw, false);
  assert.equal(ui.game.currentPlayer, 1);
  assert.equal(ui.game.history.length, 0);
  assert.equal(ui.game.winningLine.length, 0);
  assert.match(ui.statusEl.textContent, /黑方回合/);
  assert.equal(ui.moveCountEl.textContent, '已落子 0 手');
  assert.equal(ui.undoButton.disabled, true);
  assert.equal(ui.cells.some((cell) => cell.classList.contains('cell--winning')), false);
  assert.equal(ui.cells.some((cell) => cell.classList.contains('cell--last')), false);
  assert.equal(ui.cells.every((cell) => cell.disabled === false), true);

  for (const row of ui.game.board) {
    for (const value of row) {
      assert.equal(value, 0);
    }
  }
});

test('a win shows terminal feedback, highlights the line, and blocks further moves', () => {
  const { ui } = mountUI();

  playSequence(
    ui,
    [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]],
    [[0, 0], [0, 2], [0, 4], [0, 6]]
  );

  assert.equal(ui.game.winner, 1);
  assert.equal(ui.game.currentPlayer, 1);
  assert.match(ui.statusEl.textContent, /黑方获胜/);
  assert.ok(ui.statusEl.classList.contains('status--win'));
  assert.equal(ui.game.winningLine.length, 5);

  for (const cell of ui.game.winningLine) {
    assert.ok(
      cellAt(ui, cell.row, cell.col).classList.contains('cell--winning'),
      'each winning stone must be highlighted'
    );
  }

  assert.equal(ui.cells.every((cell) => cell.disabled === true), true);

  const before = snapshot(ui.game);
  cellAt(ui, 5, 5).click();
  assert.equal(snapshot(ui.game), before);

  ui.undoButton.click();

  assert.equal(ui.game.winner, 0);
  assert.equal(ui.game.currentPlayer, 1);
  assert.match(ui.statusEl.textContent, /黑方回合/);
  assert.equal(ui.cells.some((cell) => cell.classList.contains('cell--winning')), false);
  assert.equal(ui.cells.every((cell) => cell.disabled === false), true);

  cellAt(ui, 7, 4).click();
  assert.equal(ui.game.winner, 1);
  assert.match(ui.statusEl.textContent, /黑方获胜/);
});

test('keyboard Enter and Space place stones on focusable buttons', () => {
  const { ui } = mountUI();

  const first = cellAt(ui, 0, 0);
  assert.equal(first.tagName, 'BUTTON');
  assert.ok(first.tabIndex >= 0, 'Tab must be able to reach each cell');

  first.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert.equal(ui.game.board[0][0], 1);
  assert.equal(ui.game.currentPlayer, 2);

  const second = cellAt(ui, 0, 1);
  second.dispatchEvent({ type: 'keydown', key: ' ' });
  assert.equal(ui.game.board[0][1], 2);
  assert.equal(ui.game.currentPlayer, 1);

  const occupiedBefore = snapshot(ui.game);
  first.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert.equal(snapshot(ui.game), occupiedBefore);
});

test('a full board with no five reports a draw and disables play', () => {
  const { ui } = mountUI();

  // Same legal no-five pattern as the engine draw test.
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

  for (let i = 0; i < whiteCells.length; i += 1) {
    cellAt(ui, blackCells[i][0], blackCells[i][1]).click();
    cellAt(ui, whiteCells[i][0], whiteCells[i][1]).click();
  }
  const [lastRow, lastCol] = blackCells[blackCells.length - 1];
  cellAt(ui, lastRow, lastCol).click();

  assert.equal(ui.game.draw, true);
  assert.equal(ui.game.winner, 0);
  assert.equal(ui.game.history.length, 225);
  assert.match(ui.statusEl.textContent, /和棋/);
  assert.ok(ui.statusEl.classList.contains('status--draw'));
  assert.equal(ui.cells.every((cell) => cell.disabled === true), true);

  const before = snapshot(ui.game);
  cellAt(ui, 0, 0).click();
  assert.equal(snapshot(ui.game), before);

  ui.undoButton.click();
  assert.equal(ui.game.draw, false);
  assert.equal(ui.game.currentPlayer, 1);
  assert.match(ui.statusEl.textContent, /黑方回合/);
  assert.equal(ui.cells.every((cell) => cell.disabled === false), true);
});
