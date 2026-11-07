'use strict';

(function () {
  var STATUS_LABELS = {
    ready: '准备开始',
    running: '进行中',
    paused: '已暂停',
    gameover: '游戏结束',
    won: '你赢了',
  };

  var KEY_DIRECTIONS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    W: 'up',
    a: 'left',
    A: 'left',
    s: 'down',
    S: 'down',
    d: 'right',
    D: 'right',
  };

  var BEST_KEY = 'snake.best';
  var SPEED = 140;
  var SWIPE_THRESHOLD = 24;

  function directionForKey(key) {
    return Object.prototype.hasOwnProperty.call(KEY_DIRECTIONS, key)
      ? KEY_DIRECTIONS[key]
      : null;
  }

  function readBest(storage) {
    try {
      if (!storage) return 0;
      var raw = storage.getItem(BEST_KEY);
      var value = Number.parseInt(raw, 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function writeBest(storage, value) {
    try {
      if (!storage) return false;
      storage.setItem(BEST_KEY, String(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function createController(options) {
    var settings = options || {};
    var engine =
      settings.engine ||
      (typeof globalThis !== 'undefined' ? globalThis.SnakeEngine : null);
    if (!engine) throw new Error('SnakeEngine is required');

    var storage = settings.storage || null;
    var render =
      typeof settings.render === 'function' ? settings.render : function () {};
    var schedule =
      typeof settings.schedule === 'function'
        ? settings.schedule
        : function (fn, ms) {
            return setTimeout(fn, ms);
          };
    var cancel =
      typeof settings.cancel === 'function'
        ? settings.cancel
        : function (id) {
            clearTimeout(id);
          };
    var speed = settings.speed || SPEED;

    var game = engine.createGame();
    var best = readBest(storage);
    var timer = null;

    function snapshot() {
      return {
        game: game,
        best: Math.max(best, game.score),
        timerActive: timer !== null,
      };
    }

    function notify() {
      render(snapshot());
    }

    function stopTimer() {
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
    }

    function recordBest() {
      if (game.score > best) {
        best = game.score;
        writeBest(storage, best);
      }
    }

    function scheduleNext() {
      if (timer !== null || game.status !== 'running') return;
      timer = schedule(runTick, speed);
    }

    function runTick() {
      timer = null;
      if (game.status !== 'running') return;
      engine.tick(game);
      recordBest();
      if (game.status !== 'running') stopTimer();
      notify();
      if (game.status === 'running') scheduleNext();
    }

    function start() {
      if (!engine.startGame(game)) return false;
      notify();
      scheduleNext();
      return true;
    }

    function pause() {
      if (!engine.togglePause(game)) return false;
      if (game.status === 'running') scheduleNext();
      else stopTimer();
      notify();
      return true;
    }

    function pauseIfRunning() {
      if (game.status !== 'running') return false;
      engine.togglePause(game);
      stopTimer();
      notify();
      return true;
    }

    function restart() {
      stopTimer();
      game = engine.createGame();
      notify();
      return snapshot();
    }

    function setDirection(direction) {
      return engine.setDirection(game, direction);
    }

    function destroy() {
      stopTimer();
    }

    return {
      start: start,
      pause: pause,
      pauseIfRunning: pauseIfRunning,
      restart: restart,
      setDirection: setDirection,
      snapshot: snapshot,
      destroy: destroy,
      runTick: runTick,
    };
  }

  function drawBoard(canvas, game) {
    if (!canvas || typeof canvas.getContext !== 'function' || !game) return;
    var context = canvas.getContext('2d');
    if (!context) return;

    var rect =
      typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : null;
    var width = Math.max(
      1,
      Math.round((rect && rect.width) || canvas.clientWidth || 400)
    );
    var ratio =
      typeof window !== 'undefined' && window.devicePixelRatio
        ? window.devicePixelRatio
        : 1;
    var dpr = Math.max(1, Math.min(3, ratio));
    var pixels = Math.max(1, Math.round(width * dpr));

    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;
    if (typeof context.setTransform === 'function') {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var size = game.size || 20;
    var cell = width / size;

    context.clearRect(0, 0, width, width);
    context.fillStyle = '#dfeedd';
    context.fillRect(0, 0, width, width);

    context.strokeStyle = 'rgba(36, 88, 62, 0.1)';
    context.lineWidth = 1;
    for (var i = 1; i < size; i += 1) {
      var offset = Math.round(i * cell) + 0.5;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, width);
      context.stroke();
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(width, offset);
      context.stroke();
    }

    if (game.food) {
      var foodX = (game.food.x + 0.5) * cell;
      var foodY = (game.food.y + 0.5) * cell;
      var radius = Math.max(2, cell * 0.31);
      context.fillStyle = '#d9603b';
      context.beginPath();
      if (typeof context.arc === 'function') {
        context.arc(foodX, foodY, radius, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(
          foodX - radius,
          foodY - radius,
          radius * 2,
          radius * 2
        );
      }
    }

    var inset = Math.max(1, cell * 0.07);
    var piece = Math.max(1, cell - inset * 2);
    game.snake.forEach(function (part, index) {
      context.fillStyle = index === 0 ? '#173d2a' : '#24583e';
      context.fillRect(
        part.x * cell + inset,
        part.y * cell + inset,
        piece,
        piece
      );
    });
  }

  function isTextEntry(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(
      target.closest('input, textarea, select, [contenteditable="true"]')
    );
  }

  function isActivatable(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('button, a'));
  }

  function getStorage() {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (error) {
      return null;
    }
  }

  function init() {
    var engine = typeof globalThis !== 'undefined' ? globalThis.SnakeEngine : null;
    var board = document.getElementById('board');
    if (!engine || !board) return;

    var scoreNode = document.getElementById('score');
    var bestNode = document.getElementById('best');
    var statusNode = document.getElementById('status');
    var startButton = document.getElementById('start');
    var pauseButton = document.getElementById('pause');
    var restartButton = document.getElementById('restart');
    var directionButtons = Array.prototype.slice.call(
      document.querySelectorAll('[data-direction]')
    );
    var swipeStart = null;

    function render(state) {
      var game = state.game;
      if (scoreNode) scoreNode.textContent = String(game.score);
      if (bestNode) bestNode.textContent = String(state.best);
      if (statusNode) {
        statusNode.textContent = STATUS_LABELS[game.status] || '准备开始';
        statusNode.setAttribute('data-status', game.status);
      }
      if (startButton) startButton.disabled = game.status !== 'ready';
      if (pauseButton) {
        pauseButton.disabled =
          game.status !== 'running' && game.status !== 'paused';
        pauseButton.textContent = game.status === 'paused' ? '继续' : '暂停';
      }
      drawBoard(board, game);
    }

    var controller = createController({
      engine: engine,
      storage: getStorage(),
      render: render,
      speed: SPEED,
    });

    function handleKeydown(event) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextEntry(event.target)) return;

      var direction = directionForKey(event.key);
      if (direction) {
        event.preventDefault();
        controller.setDirection(direction);
        return;
      }

      var isSpace =
        event.key === ' ' ||
        event.key === 'Spacebar' ||
        event.code === 'Space';
      if (!isSpace) return;
      if (isActivatable(event.target)) return;

      var status = controller.snapshot().game.status;
      if (status !== 'running' && status !== 'paused') return;

      event.preventDefault();
      if (!event.repeat) controller.pause();
    }

    function handleVisibilityChange() {
      if (document.hidden) controller.pauseIfRunning();
    }

    function handlePointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      swipeStart = {
        x: event.clientX,
        y: event.clientY,
      };
      board.classList.add('is-swiping');
      if (
        typeof board.setPointerCapture === 'function' &&
        event.pointerId != null
      ) {
        try {
          board.setPointerCapture(event.pointerId);
        } catch (error) {
          /* pointer capture is a progressive enhancement */
        }
      }
    }

    function handlePointerUp(event) {
      if (!swipeStart) return;
      var start = swipeStart;
      swipeStart = null;
      board.classList.remove('is-swiping');

      var dx = event.clientX - start.x;
      var dy = event.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

      var direction;
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }
      controller.setDirection(direction);
    }

    function handlePointerCancel() {
      swipeStart = null;
      board.classList.remove('is-swiping');
    }

    function redraw() {
      drawBoard(board, controller.snapshot().game);
    }

    if (startButton) {
      startButton.addEventListener('click', function () {
        controller.start();
      });
    }
    if (pauseButton) {
      pauseButton.addEventListener('click', function () {
        controller.pause();
      });
    }
    if (restartButton) {
      restartButton.addEventListener('click', function () {
        controller.restart();
      });
    }

    directionButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        controller.setDirection(button.getAttribute('data-direction'));
      });
    });

    board.addEventListener('pointerdown', handlePointerDown);
    board.addEventListener('pointerup', handlePointerUp);
    board.addEventListener('pointercancel', handlePointerCancel);

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', redraw);

    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(redraw);
      observer.observe(board);
    }

    render(controller.snapshot());
  }

  var SnakeUI = {
    STATUS_LABELS: STATUS_LABELS,
    KEY_DIRECTIONS: KEY_DIRECTIONS,
    BEST_KEY: BEST_KEY,
    SPEED: SPEED,
    SWIPE_THRESHOLD: SWIPE_THRESHOLD,
    directionForKey: directionForKey,
    readBest: readBest,
    writeBest: writeBest,
    createController: createController,
    drawBoard: drawBoard,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnakeUI;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.SnakeUI = SnakeUI;
  }
  if (
    typeof document !== 'undefined' &&
    document.getElementById &&
    document.getElementById('board')
  ) {
    init();
  }
})();
