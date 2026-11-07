'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');

const ROOT = path.join(__dirname, '..');
const ENGINE_SOURCE = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const HTML_SOURCE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const DESSERT_NAMES = ['草莓软糖', '蓝莓蛋糕', '柠檬挞', '抹茶巧克力', '葡萄果冻', '蜜桃星星饼干'];

class ClassList {
  constructor(element) {
    this.element = element;
  }

  add(...names) {
    for (const name of names) {
      for (const token of String(name).split(/\s+/)) {
        if (token) {
          this.element._classSet.add(token);
        }
      }
    }
  }

  remove(...names) {
    for (const name of names) {
      for (const token of String(name).split(/\s+/)) {
        if (token) {
          this.element._classSet.delete(token);
        }
      }
    }
  }

  contains(name) {
    return this.element._classSet.has(String(name));
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.contains(name) : Boolean(force);
    if (shouldAdd) {
      this.add(name);
    } else {
      this.remove(name);
    }
    return shouldAdd;
  }
}

class FakeElement {
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.type = '';
    this.disabled = false;
    this.tabIndex = -1;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this._classSet = new Set();
    this._text = '';
    this._listeners = new Map();
    this.classList = new ClassList(this);
  }

  get className() {
    return Array.from(this._classSet).join(' ');
  }

  set className(value) {
    this._classSet.clear();
    for (const token of String(value || '').split(/\s+/)) {
      if (token) {
        this._classSet.add(token);
      }
    }
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.children) {
      child.parentNode = null;
    }
    this.children = [];
    this._text = String(value);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);

    if (key === 'id') {
      this.id = text;
    } else if (key === 'class') {
      this.className = text;
    } else if (key === 'type') {
      this.type = text;
    } else if (key === 'tabindex') {
      this.tabIndex = Number(text);
    } else if (key === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(name) {
    const key = String(name);
    if (key === 'id') {
      return this.id || null;
    }
    if (key === 'class') {
      return this.className || null;
    }
    if (key === 'type') {
      return this.type || null;
    }
    if (key === 'tabindex') {
      return String(this.tabIndex);
    }
    if (key === 'disabled') {
      return this.disabled ? '' : null;
    }
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === 'id') {
      this.id = '';
    } else if (key === 'class') {
      this.className = '';
    } else if (key === 'tabindex') {
      this.tabIndex = -1;
    } else if (key === 'disabled') {
      this.disabled = false;
    }
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this._listeners.get(type);
    if (!listeners) {
      return;
    }
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  dispatchEvent(event) {
    if (!event || !event.type) {
      throw new Error('dispatchEvent requires an event with a type');
    }
    if (!event.target) {
      event.target = this;
    }
    event.currentTarget = this;
    const listeners = (this._listeners.get(event.type) || []).slice();
    for (const listener of listeners) {
      listener.call(this, event);
    }
    return !event.defaultPrevented;
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(makeEvent('focus'));
  }
}

class FakeDocument {
  constructor() {
    this.readyState = 'complete';
    this.elements = new Map();
    this.activeElement = null;
    this.defaultView = null;
    this._listeners = new Map();
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  getElementById(id) {
    return this.elements.get(String(id)) || null;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    if (!event.target) {
      event.target = this;
    }
    event.currentTarget = this;
    for (const listener of (this._listeners.get(event.type) || []).slice()) {
      listener.call(this, event);
    }
    return !event.defaultPrevented;
  }
}

function makeEvent(type, properties) {
  return Object.assign({
    type,
    target: null,
    currentTarget: null,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    }
  }, properties || {});
}

function addElement(document, tagName, id, text) {
  const element = document.createElement(tagName);
  element.id = id;
  if (text !== undefined) {
    element.textContent = text;
  }
  document.elements.set(id, element);
  return element;
}

function createMemoryStorage(initialBest) {
  const data = new Map();
  if (initialBest !== undefined) {
    data.set('match3.best', String(initialBest));
  }
  return {
    getItem(key) {
      return data.has(String(key)) ? data.get(String(key)) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(String(key));
    }
  };
}

function createFakeTimers() {
  let nextId = 1;
  let now = 0;
  const jobs = new Map();

  function setTimeoutFake(callback, delay) {
    const id = nextId++;
    jobs.set(id, {
      callback,
      at: now + Math.max(0, Number(delay) || 0)
    });
    return id;
  }

  function clearTimeoutFake(id) {
    jobs.delete(Number(id));
  }

  function runDue() {
    let safety = 0;
    while (safety < 10000) {
      safety++;
      const due = Array.from(jobs.entries())
        .filter(([, job]) => job.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);

      if (due.length === 0) {
        return;
      }

      for (const [id, job] of due) {
        if (!jobs.has(id)) {
          continue;
        }
        jobs.delete(id);
        job.callback();
      }
    }
    throw new Error('timer safety limit reached');
  }

  function tick(milliseconds) {
    now += Math.max(0, Number(milliseconds) || 0);
    runDue();
  }

  function runAll() {
    let safety = 0;
    while (jobs.size > 0) {
      safety++;
      if (safety > 10000) {
        throw new Error('timer safety limit reached');
      }
      let earliest = Infinity;
      for (const job of jobs.values()) {
        earliest = Math.min(earliest, job.at);
      }
      now = Math.max(now, earliest);
      runDue();
    }
  }

  return {
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    tick,
    runAll,
    pending: () => jobs.size,
    now: () => now
  };
}

function createHarness(options = {}) {
  const document = new FakeDocument();

  const board = addElement(document, 'div', 'board');
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', '消消乐棋盘，共 8 行 8 列');
  board.setAttribute('aria-busy', 'false');
  addElement(document, 'strong', 'score', '0');
  addElement(document, 'strong', 'best', '0');
  addElement(document, 'strong', 'moves', '0');
  addElement(document, 'p', 'status', '选择相邻的两个方块进行交换。');
  const hint = addElement(document, 'button', 'hint', '提示一步');
  hint.type = 'button';
  const restart = addElement(document, 'button', 'restart', '重新开始');
  restart.type = 'button';
  const sound = addElement(document, 'button', 'sound', '音效');
  sound.type = 'button';
  sound.setAttribute('aria-pressed', 'true');
  const haptics = addElement(document, 'button', 'haptics', '震动');
  haptics.type = 'button';
  haptics.setAttribute('aria-pressed', 'true');
  const soundState = addElement(document, 'span', 'sound-state', '开');
  const hapticsState = addElement(document, 'span', 'haptics-state', '开');
  addElement(document, 'div', 'combo');
  addElement(document, 'div', 'record');
  addElement(document, 'div', 'score-fx');
  addElement(document, 'canvas', 'fx');
  const stage = addElement(document, 'div', 'stage');

  const timers = createFakeTimers();
  const sfxCalls = [];
  const vibrations = [];
  const window = {
    document,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    navigator: {
      vibrate(pattern) {
        vibrations.push(pattern);
      }
    },
    matchMedia: options.reduceMotion
      ? () => ({ matches: true })
      : () => ({ matches: false })
  };
  window.Match3SFX = {
    preload() {},
    unlock() {},
    play(name) {
      sfxCalls.push(name);
    },
    setEnabled() {},
    isEnabled() {
      return true;
    }
  };
  document.defaultView = window;

  if (options.storageAccessThrows) {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage access blocked');
      }
    });
  } else {
    window.localStorage = options.storage || createMemoryStorage(options.best);
  }

  const context = vm.createContext({ window, console });
  vm.runInContext(ENGINE_SOURCE, context, { filename: 'engine.js' });

  let capturedGame = null;
  const realCreateGame = window.Match3Engine.createGame;
  window.Match3Engine.createGame = function (gameOptions) {
    const game = realCreateGame.call(this, gameOptions);
    capturedGame = game;
    return game;
  };

  vm.runInContext(APP_SOURCE, context, { filename: 'app.js' });

  return {
    document,
    window,
    board,
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    moves: document.getElementById('moves'),
    status: document.getElementById('status'),
    hint,
    restart,
    sound,
    haptics,
    soundState,
    hapticsState,
    combo: document.getElementById('combo'),
    record: document.getElementById('record'),
    stage,
    sfxCalls,
    vibrations,
    timers,
    get storage() {
      return window.localStorage;
    },
    getGame: () => capturedGame,
    tile: (index) => board.children[index]
  };
}

function click(element) {
  return element.dispatchEvent(makeEvent('click'));
}

function advanceUntil(harness, predicate, step = 20, limit = 6000) {
  for (let spent = 0; spent <= limit; spent += step) {
    if (predicate()) {
      return true;
    }
    harness.timers.tick(step);
  }
  return predicate();
}

function press(element, key) {
  const event = makeEvent('keydown', { key });
  element.dispatchEvent(event);
  return event;
}

function boardValues(boardElement) {
  return boardElement.children.map((tile) => Number(tile.dataset.value));
}

function findInvalidPair(board) {
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const candidates = [];
    if (col + 1 < 8) {
      candidates.push(i + 1);
    }
    if (row + 1 < 8) {
      candidates.push(i + 8);
    }

    for (const other of candidates) {
      const trial = board.slice();
      [trial[i], trial[other]] = [trial[other], trial[i]];
      if (E.findMatches(trial).length === 0) {
        return [i, other];
      }
    }
  }
  throw new Error('expected an adjacent non-matching pair');
}

function patternedBoard() {
  return Array.from({ length: 64 }, (_, index) =>
    (Math.floor(index / 8) * 2 + (index % 8)) % 6
  );
}

function seededFixture(seed) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const board = E.createGame({ random }).board;
  return { board, random };
}

function assertPlayable(board) {
  assert.equal(board.length, 64);
  assert.ok(board.every((value) => Number.isInteger(value) && value >= 0 && value < 30));
  assert.deepEqual(E.findMatches(board), []);
  assert.ok(E.findMove(board));
}

test('index.html exposes the required structure and external assets', () => {
  assert.match(HTML_SOURCE, /<link[^>]+rel="stylesheet"[^>]+href="styles\.css(?:\?[^"]*)?"/);

  const enginePosition = HTML_SOURCE.search(/<script src="engine\.js(?:\?[^"]*)?"[^>]*defer/);
  const sfxPosition = HTML_SOURCE.search(/<script src="sfx\.js(?:\?[^"]*)?"[^>]*defer/);
  const appPosition = HTML_SOURCE.search(/<script src="app\.js(?:\?[^"]*)?"[^>]*defer/);
  assert.ok(enginePosition >= 0, 'engine.js should be loaded with defer');
  assert.ok(sfxPosition > enginePosition, 'sfx.js should load after engine.js');
  assert.ok(appPosition > sfxPosition, 'app.js should load after sfx.js');

  for (const id of ['board', 'score', 'best', 'moves', 'status', 'hint', 'restart']) {
    assert.match(HTML_SOURCE, new RegExp('id="' + id + '"'));
  }

  assert.match(HTML_SOURCE, /href="\/"/);
  assert.match(HTML_SOURCE, /href="https:\/\/home\.ericmo\.top"/);
  assert.doesNotMatch(HTML_SOURCE, /<style[\s>]/i);
  assert.doesNotMatch(HTML_SOURCE, /\son[a-z]+=/i);
});

test('boots 64 accessible grid tiles, roving focus and initial stats', () => {
  const harness = createHarness({ best: 120 });

  assert.equal(harness.board.children.length, 64);
  assert.equal(harness.board.getAttribute('role'), 'grid');
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assert.equal(harness.score.textContent, '0');
  assert.equal(harness.best.textContent, '120');
  assert.equal(harness.moves.textContent, '0');
  assert.ok(harness.status.textContent.length > 0);
  assert.equal(harness.hint.type, 'button');
  assert.equal(harness.restart.type, 'button');

  harness.board.children.forEach((tile, index) => {
    const row = Math.floor(index / 8) + 1;
    const col = (index % 8) + 1;
    const value = Number(tile.dataset.value);

    assert.equal(tile.tagName, 'BUTTON');
    assert.equal(tile.type, 'button');
    assert.equal(tile.getAttribute('role'), 'gridcell');
    assert.equal(tile.getAttribute('aria-selected'), 'false');
    assert.equal(tile.getAttribute('aria-rowindex'), String(row));
    assert.equal(tile.getAttribute('aria-colindex'), String(col));
    assert.match(tile.getAttribute('aria-label'), new RegExp('第' + row + '行第' + col + '列'));
    assert.ok(DESSERT_NAMES.includes(tile.getAttribute('aria-label').split('，').pop()));
    assert.equal(tile.getAttribute('aria-label').split('，').pop(), DESSERT_NAMES[value]);
    assert.equal(tile.children.length, 1);
    assert.equal(tile.children[0].getAttribute('aria-hidden'), 'true');
    assert.equal(tile.tabIndex, index === 0 ? 0 : -1);
  });
});

test('selection, deselection and reselection are wired to the tile buttons', () => {
  const harness = createHarness();

  click(harness.tile(0));
  assert.equal(harness.tile(0).getAttribute('aria-selected'), 'true');
  assert.ok(harness.tile(0).classList.contains('is-selected'));
  assert.match(harness.status.textContent, /第1行第1列/);
  assert.equal(harness.moves.textContent, '0');

  click(harness.tile(0));
  assert.equal(harness.tile(0).getAttribute('aria-selected'), 'false');
  assert.match(harness.status.textContent, /取消选择/);

  click(harness.tile(0));
  click(harness.tile(10));
  assert.equal(harness.tile(0).getAttribute('aria-selected'), 'false');
  assert.equal(harness.tile(10).getAttribute('aria-selected'), 'true');
  assert.match(harness.status.textContent, /相邻/);
  assert.equal(harness.moves.textContent, '0');
});

test('invalid swaps restore the board and do not count a move', () => {
  const harness = createHarness();
  const before = boardValues(harness.board);
  const pair = findInvalidPair(before);

  click(harness.tile(pair[0]));
  click(harness.tile(pair[1]));

  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assert.equal(harness.score.textContent, '0');
  assert.equal(harness.moves.textContent, '0');
  assert.deepEqual(boardValues(harness.board), before);
  assert.equal(harness.tile(pair[0]).getAttribute('aria-selected'), 'false');
  assert.equal(harness.tile(pair[1]).getAttribute('aria-selected'), 'false');
  assert.match(harness.status.textContent, /不能消除/);
  assert.match(harness.status.textContent, /步数不变/);

  harness.timers.runAll();
  assert.equal(harness.tile(pair[0]).classList.contains('is-invalid'), false);
  assert.equal(harness.tile(pair[1]).classList.contains('is-invalid'), false);
});

test('valid swaps lock the board during animation, then unlock with score feedback', () => {
  const harness = createHarness();
  const pair = E.findMove(boardValues(harness.board));
  assert.ok(pair);

  click(harness.tile(pair[0]));
  click(harness.tile(pair[1]));

  assert.equal(harness.board.getAttribute('aria-busy'), 'true');
  assert.equal(harness.hint.disabled, true);
  assert.equal(harness.moves.textContent, '1');
  assert.ok(harness.timers.pending() > 0);

  const untouched = [0, 17, 33, 48, 63].find((index) => !pair.includes(index));
  click(harness.tile(untouched));
  assert.equal(harness.tile(untouched).getAttribute('aria-selected'), 'false');

  harness.timers.tick(20);
  assert.equal(harness.board.getAttribute('aria-busy'), 'true');
  assert.equal(harness.timers.pending() > 0, true);

  harness.timers.runAll();

  const finalBoard = boardValues(harness.board);
  const game = harness.getGame();
  const finalScore = Number(harness.score.textContent);

  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assert.equal(harness.hint.disabled, false);
  assert.equal(harness.moves.textContent, '1');
  assert.ok(finalScore > 0);
  assert.equal(finalScore, game.score);
  assert.equal(harness.best.textContent, String(finalScore));
  assert.equal(Number(harness.storage.getItem('match3.best')), finalScore);
  assert.deepEqual(finalBoard, Array.from(game.board));
  assertPlayable(finalBoard);
  assert.match(harness.status.textContent, /连锁 \d+ 次/);
  assert.match(harness.status.textContent, /得分 \+\d+/);
  assert.match(harness.status.textContent, /当前得分 \d+/);
});

test('hint highlights a legal pair without consuming a move and clears on action', () => {
  const harness = createHarness();

  click(harness.hint);

  const hinted = harness.board.children.filter((tile) => tile.classList.contains('is-hint'));
  assert.equal(hinted.length, 2);
  assert.equal(harness.moves.textContent, '0');
  assert.equal(harness.score.textContent, '0');
  assert.match(harness.status.textContent, /提示/);
  assert.match(harness.status.textContent, /不消耗步数/);

  const hintedIndices = hinted.map((tile) => Number(tile.dataset.index));
  const trial = boardValues(harness.board);
  [trial[hintedIndices[0]], trial[hintedIndices[1]]] =
    [trial[hintedIndices[1]], trial[hintedIndices[0]]];
  assert.ok(E.findMatches(trial).length > 0);

  const target = harness.board.children.findIndex((tile) =>
    !hintedIndices.includes(Number(tile.dataset.index))
  );
  click(harness.tile(target));

  for (const tile of harness.board.children) {
    assert.equal(tile.classList.contains('is-hint'), false);
  }
  assert.equal(harness.moves.textContent, '0');
});

test('keyboard arrows move roving focus and Enter/Space select and swap', () => {
  const harness = createHarness();
  const pair = E.findMove(boardValues(harness.board));
  assert.ok(pair);
  const direction = pair[1] === pair[0] + 1 ? 'ArrowRight' : 'ArrowDown';
  assert.ok(direction === 'ArrowRight' || pair[1] === pair[0] + 8);

  const firstTile = harness.tile(pair[0]);
  firstTile.focus();
  assert.equal(harness.document.activeElement, firstTile);
  assert.equal(firstTile.tabIndex, 0);

  const enterEvent = press(firstTile, 'Enter');
  assert.equal(enterEvent.defaultPrevented, true);
  assert.equal(firstTile.getAttribute('aria-selected'), 'true');

  press(firstTile, direction);
  const secondTile = harness.tile(pair[1]);
  assert.equal(harness.document.activeElement, secondTile);
  assert.equal(secondTile.tabIndex, 0);
  assert.equal(firstTile.tabIndex, -1);

  press(secondTile, ' ');
  assert.equal(harness.board.getAttribute('aria-busy'), 'true');
  assert.equal(harness.moves.textContent, '1');

  harness.timers.runAll();
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assert.ok(Number(harness.score.textContent) > 0);
  assertPlayable(boardValues(harness.board));
});

test('restart preserves best, resets counters and cancels stale animation actions', () => {
  const harness = createHarness();

  const firstPair = E.findMove(boardValues(harness.board));
  click(harness.tile(firstPair[0]));
  click(harness.tile(firstPair[1]));
  harness.timers.runAll();

  const earnedBest = Number(harness.best.textContent);
  assert.ok(earnedBest > 0);
  assert.equal(harness.best.textContent, harness.score.textContent);

  click(harness.restart);
  assert.equal(harness.score.textContent, '0');
  assert.equal(harness.moves.textContent, '0');
  assert.equal(harness.best.textContent, String(earnedBest));
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assert.match(harness.status.textContent, /重新开始/);
  assertPlayable(boardValues(harness.board));

  const secondPair = E.findMove(boardValues(harness.board));
  click(harness.tile(secondPair[0]));
  click(harness.tile(secondPair[1]));
  assert.equal(harness.board.getAttribute('aria-busy'), 'true');

  click(harness.restart);
  assert.equal(harness.score.textContent, '0');
  assert.equal(harness.moves.textContent, '0');
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assert.match(harness.status.textContent, /重新开始/);

  harness.timers.runAll();

  assert.equal(harness.score.textContent, '0');
  assert.equal(harness.moves.textContent, '0');
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  for (const tile of harness.board.children) {
    assert.equal(tile.classList.contains('is-clearing'), false);
    assert.equal(tile.classList.contains('is-hint'), false);
    assert.equal(tile.classList.contains('is-selected'), false);
  }
  assertPlayable(boardValues(harness.board));
});

test('storage failures never prevent play or in-memory best updates', () => {
  const throwingStorage = {
    getItem() {
      throw new Error('read blocked');
    },
    setItem() {
      throw new Error('write blocked');
    },
    removeItem() {
      throw new Error('remove blocked');
    }
  };

  const optionSets = [
    { storage: throwingStorage },
    { storageAccessThrows: true }
  ];

  for (const options of optionSets) {
    const harness = createHarness(options);
    assert.equal(harness.best.textContent, '0');

    const pair = E.findMove(boardValues(harness.board));
    click(harness.tile(pair[0]));
    click(harness.tile(pair[1]));
    harness.timers.runAll();

    assert.ok(Number(harness.score.textContent) > 0);
    assert.equal(harness.best.textContent, harness.score.textContent);
    assertPlayable(boardValues(harness.board));
  }

  const malformed = createHarness({ best: 'not-a-number' });
  assert.equal(malformed.best.textContent, '0');
});

test('hint reshuffles automatically when no legal move exists and keeps counters', () => {
  const harness = createHarness();
  const game = harness.getGame();

  game.board = patternedBoard();
  game.score = 42;
  game.moves = 5;
  assert.equal(E.findMove(game.board), null);

  click(harness.hint);

  assert.match(harness.status.textContent, /重新排列/);
  assert.equal(harness.score.textContent, '42');
  assert.equal(harness.moves.textContent, '5');
  assert.equal(game.score, 42);
  assert.equal(game.moves, 5);
  assertPlayable(boardValues(harness.board));
  assert.equal(
    harness.board.children.some((tile) => tile.classList.contains('is-hint')),
    false
  );
});

// Review regression: horizontal swipes work in both directions and never wrap rows.
test('touch swipes left/right and up/down swap without wrapping or duplicate clicks', () => {
  for (const delta of [1, -1, 8, -8]) {
    const h = createHarness();
    let pair = null;
    // A stable fixture with a horizontal legal move; transpose for vertical cases.
    let b = patternedBoard();
    b[0]=0; b[1]=1; b[2]=0; b[9]=0;
    if (Math.abs(delta)===8) b=Array.from({length:64},(_,i)=>b[(i%8)*8+Math.floor(i/8)]);
    for (let i=0;i<64;i++) {
      const j=i+delta;
      if(j<0||j>=64||Math.abs(Math.floor(i/8)-Math.floor(j/8))+Math.abs(i%8-j%8)!==1)continue;
      const trial=b.slice();[trial[i],trial[j]]=[trial[j],trial[i]];
      if(E.findMatches(trial).length){pair=[i,j];break;}
    }
    assert.ok(pair);
    h.getGame().board=b.slice();
    const origin=h.tile(pair[0]);
    h.board.dispatchEvent(makeEvent('pointerdown',{pointerType:'touch',target:origin,clientX:100,clientY:100}));
    h.board.dispatchEvent(makeEvent('pointerup',{pointerType:'touch',target:origin,clientX:100+(Math.abs(delta)===1?Math.sign(delta)*35:0),clientY:100+(Math.abs(delta)===8?Math.sign(delta)*35:0)}));
    assert.equal(h.moves.textContent,'1');
    click(origin);
    h.timers.runAll();
    assert.equal(h.moves.textContent,'1');assertPlayable(boardValues(h.board));
    click(h.restart);
    h.board.dispatchEvent(makeEvent('pointerdown',{pointerType:'touch',target:h.tile(7),clientX:100,clientY:100}));
    h.board.dispatchEvent(makeEvent('pointerup',{pointerType:'touch',target:h.tile(7),clientX:140,clientY:100}));
    assert.equal(h.moves.textContent,'0');
  }
});

test('sound and haptics toggles persist and suppress feedback', () => {
  const harness = createHarness();
  assert.equal(harness.sound.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.haptics.getAttribute('aria-pressed'), 'true');

  click(harness.sound);
  click(harness.haptics);
  assert.equal(harness.sound.getAttribute('aria-pressed'), 'false');
  assert.equal(harness.haptics.getAttribute('aria-pressed'), 'false');
  assert.equal(harness.storage.getItem('match3.sound'), 'off');
  assert.equal(harness.storage.getItem('match3.haptics'), 'off');

  const beforeCalls = harness.sfxCalls.length;
  const beforeVibrations = harness.vibrations.length;
  click(harness.tile(0));
  assert.equal(harness.sfxCalls.length, beforeCalls);
  assert.equal(harness.vibrations.length, beforeVibrations);

  click(harness.sound);
  click(harness.haptics);
  assert.equal(harness.storage.getItem('match3.sound'), 'on');
  assert.equal(harness.storage.getItem('match3.haptics'), 'on');
  assert.ok(harness.sfxCalls.includes('click'));
});

test('cascade depth shows a live combo badge and plays combo feedback', () => {
  const harness = createHarness();
  const fixture = seededFixture(37);
  harness.getGame().board = fixture.board;
  harness.getGame().random = fixture.random;

  click(harness.tile(0));
  click(harness.tile(8));
  assert.equal(harness.board.getAttribute('aria-busy'), 'true');

  assert.ok(advanceUntil(harness, () => harness.combo.classList.contains('is-visible')));
  assert.match(harness.combo.textContent, /×2/);
  assert.equal(harness.combo.getAttribute('aria-hidden'), 'true');
  assert.ok(harness.sfxCalls.includes('combo'));
  assert.ok(harness.vibrations.some((pattern) => Array.isArray(pattern)));

  harness.timers.runAll();
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assertPlayable(boardValues(harness.board));
});

test('a four match renders a rocket special during the clear animation', () => {
  const harness = createHarness();
  const board = patternedBoard();
  board[0] = 5;
  board[1] = 5;
  board[2] = 4;
  board[3] = 5;
  board[10] = 5;
  harness.getGame().board = board;

  click(harness.tile(2));
  click(harness.tile(10));
  assert.ok(advanceUntil(harness, () => harness.tile(2).classList.contains('is-spawning')));

  const tile = harness.tile(2);
  assert.equal(tile.dataset.kind, '1');
  assert.ok(tile.classList.contains('tile--rocket-row'));
  assert.ok(tile.classList.contains('is-spawning'));

  harness.timers.runAll();
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assertPlayable(boardValues(harness.board));
});

test('a rainbow swap clears the paired color and plays rainbow feedback', () => {
  const harness = createHarness();
  const board = patternedBoard();
  board[0] = E.makeSpecial(2, E.SPECIAL.RAINBOW);
  board[1] = 2;
  harness.getGame().board = board;

  click(harness.tile(0));
  click(harness.tile(1));
  assert.ok(advanceUntil(harness, () => harness.sfxCalls.includes('rainbow')));

  assert.ok(harness.stage.classList.contains('is-shaking-strong'));

  harness.timers.runAll();
  assert.equal(harness.board.getAttribute('aria-busy'), 'false');
  assertPlayable(boardValues(harness.board));
});
