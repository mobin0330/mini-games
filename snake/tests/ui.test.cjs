'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = require('../engine.js');
const ui = require('../app.js');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function makeClock() {
  let nextId = 1;
  const timers = new Map();

  return {
    schedule(fn, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, delay });
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    pending() {
      return timers.size;
    },
    fire() {
      const queued = Array.from(timers.values());
      timers.clear();
      queued.forEach((timer) => timer.fn());
    },
  };
}

function makeController(options) {
  const settings = options || {};
  const clock = settings.clock || makeClock();
  const controller = ui.createController({
    engine,
    storage: Object.prototype.hasOwnProperty.call(settings, 'storage')
      ? settings.storage
      : null,
    render: settings.render || function () {},
    schedule: clock.schedule,
    cancel: clock.cancel,
  });
  return { controller, clock };
}

test('index.html exposes the required accessible game controls', () => {
  const html = read('index.html');

  for (const id of [
    'board',
    'score',
    'best',
    'status',
    'start',
    'pause',
    'restart',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }

  assert.match(html, /<canvas[^>]+id=["']board["']/i);
  for (const direction of ['up', 'down', 'left', 'right']) {
    assert.match(html, new RegExp(`data-direction=["']${direction}["']`));
  }

  assert.match(html, /aria-live=/);
  assert.match(html, /href=["']\/["']/);
  assert.match(html, /href=["']https:\/\/home\.ericmo\.top["']/);

  for (const asset of ['styles.css', 'engine.js', 'app.js']) {
    assert.ok(html.includes(asset), `missing asset ${asset}`);
  }

  assert.doesNotMatch(html, /<script[^>]*src=["'](?:https?:)?\/\//);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>\s*\S/i);

  for (const label of ['准备开始', '进行中', '已暂停', '游戏结束', '你赢了']) {
    assert.ok(ui.STATUS_LABELS && Object.values(ui.STATUS_LABELS).includes(label));
  }
});

test('styles keep the board responsive and controls finger friendly', () => {
  const css = read('styles.css');

  assert.match(css, /--paper:\s*#f6f4ed/i);
  assert.match(css, /--ink:\s*#24382e/i);
  assert.match(css, /--green:\s*#24583e/i);
  assert.match(css, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /min-height:\s*(4[4-9]|[5-9]\d)px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test('controller starts, pauses, resumes, moves and restarts with one timer', () => {
  const { controller, clock } = makeController();

  const initial = controller.snapshot();
  assert.equal(initial.game.status, 'ready');
  assert.equal(initial.game.score, 0);
  assert.equal(initial.timerActive, false);
  assert.equal(clock.pending(), 0);

  assert.equal(controller.start(), true);
  assert.equal(controller.snapshot().game.status, 'running');
  assert.equal(clock.pending(), 1);

  assert.equal(controller.start(), false);
  assert.equal(clock.pending(), 1, 'a second start must not create a timer');

  assert.equal(controller.pause(), true);
  assert.equal(controller.snapshot().game.status, 'paused');
  assert.equal(clock.pending(), 0);

  assert.equal(controller.pause(), true);
  assert.equal(controller.snapshot().game.status, 'running');
  assert.equal(clock.pending(), 1);

  assert.equal(controller.setDirection('up'), true);
  assert.equal(controller.setDirection('left'), false);
  clock.fire();
  assert.deepEqual(controller.snapshot().game.snake[0], { x: 10, y: 9 });
  assert.equal(clock.pending(), 1);

  controller.restart();
  const restarted = controller.snapshot();
  assert.equal(restarted.game.status, 'ready');
  assert.equal(restarted.game.score, 0);
  assert.deepEqual(restarted.game.snake, [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  assert.equal(clock.pending(), 0, 'restart must destroy the old timer');
  assert.equal(controller.start(), true, 'restart returns to a playable ready state');
});

test('background pause stops the loop and never resumes by itself', () => {
  const { controller, clock } = makeController();
  controller.start();
  assert.equal(clock.pending(), 1);

  assert.equal(controller.pauseIfRunning(), true);
  assert.equal(controller.snapshot().game.status, 'paused');
  assert.equal(clock.pending(), 0);

  assert.equal(controller.pauseIfRunning(), false);
  assert.equal(controller.snapshot().game.status, 'paused');
  assert.equal(clock.pending(), 0);
});

test('eating scores, updates the local best, and broken storage is harmless', () => {
  const brokenStorage = {
    getItem() {
      throw new Error('storage disabled');
    },
    setItem() {
      throw new Error('storage disabled');
    },
  };
  const { controller, clock } = makeController({ storage: brokenStorage });

  const before = controller.snapshot();
  assert.equal(before.best, 0);
  before.game.food = { x: 11, y: 10 };

  assert.equal(controller.start(), true);
  clock.fire();

  const afterEat = controller.snapshot();
  assert.equal(afterEat.game.score, 10);
  assert.equal(afterEat.game.snake.length, 4);
  assert.deepEqual(afterEat.game.snake[0], { x: 11, y: 10 });
  assert.equal(afterEat.best, 10);
  assert.equal(afterEat.game.status, 'running');

  afterEat.game.snake = [
    { x: 19, y: 10 },
    { x: 18, y: 10 },
    { x: 17, y: 10 },
  ];
  afterEat.game.direction = 'right';
  afterEat.game.pendingDirection = null;
  afterEat.game.food = { x: 0, y: 0 };
  clock.fire();

  const ended = controller.snapshot();
  assert.equal(ended.game.status, 'gameover');
  assert.equal(ended.best, 10);
  assert.equal(clock.pending(), 0, 'game over stops the timer');
  assert.equal(controller.start(), false, 'a finished game cannot be started');
});

test('best-score helpers read, write and fail safely', () => {
  assert.equal(ui.readBest({ getItem: () => '90' }), 90);
  assert.equal(ui.readBest({ getItem: () => 'not-a-score' }), 0);
  assert.equal(ui.readBest({ getItem: () => '-5' }), 0);
  assert.equal(
    ui.readBest({
      getItem() {
        throw new Error('blocked');
      },
    }),
    0
  );
  assert.equal(ui.readBest(null), 0);

  const values = new Map();
  const storage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
  assert.equal(ui.writeBest(storage, 30), true);
  assert.equal(storage.getItem(ui.BEST_KEY), '30');
  assert.equal(
    ui.writeBest(
      {
        setItem() {
          throw new Error('blocked');
        },
      },
      40
    ),
    false
  );
});

test('keyboard directions cover arrows, WASD and ignore unrelated keys', () => {
  assert.equal(ui.directionForKey('ArrowUp'), 'up');
  assert.equal(ui.directionForKey('ArrowDown'), 'down');
  assert.equal(ui.directionForKey('ArrowLeft'), 'left');
  assert.equal(ui.directionForKey('ArrowRight'), 'right');
  assert.equal(ui.directionForKey('w'), 'up');
  assert.equal(ui.directionForKey('A'), 'left');
  assert.equal(ui.directionForKey('s'), 'down');
  assert.equal(ui.directionForKey('D'), 'right');
  assert.equal(ui.directionForKey(' '), null);
  assert.equal(ui.directionForKey('Enter'), null);
});

test('app source pauses on visibility changes and supports swipes without network calls', () => {
  const source = read('app.js');

  assert.match(source, /visibilitychange|document\.hidden/);
  assert.match(source, /localStorage/);
  assert.match(source, /pointerdown/);
  assert.match(source, /pointerup/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|document\.cookie/);
});
