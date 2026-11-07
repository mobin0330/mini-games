'use strict';

const SIZE = 20;
const MOVES = {
  up: {x: 0, y: -1},
  down: {x: 0, y: 1},
  left: {x: -1, y: 0},
  right: {x: 1, y: 0},
};

function pickFood(game) {
  const empty = [];
  for (let y = 0; y < game.size; y += 1) {
    for (let x = 0; x < game.size; x += 1) {
      if (!game.snake.some((part) => part.x === x && part.y === y)) {
        empty.push({x, y});
      }
    }
  }
  if (empty.length === 0) return null;
  const raw = Math.floor(game.random() * empty.length);
  const index = Math.max(0, Math.min(empty.length - 1, raw));
  return empty[index];
}

function createGame(options = {}) {
  const requested = options.size == null ? SIZE : Number(options.size);
  const size = Number.isFinite(requested) ? Math.max(4, Math.floor(requested)) : SIZE;
  const center = Math.floor(size / 2);
  const game = {
    size,
    snake: [
      {x: center, y: center},
      {x: center - 1, y: center},
      {x: center - 2, y: center},
    ],
    direction: 'right',
    pendingDirection: null,
    score: 0,
    status: 'ready',
    food: null,
    random: typeof options.random === 'function' ? options.random : Math.random,
  };
  game.food = pickFood(game);
  return game;
}

function startGame(game) {
  if (game.status !== 'ready') return false;
  game.status = 'running';
  return true;
}

function setDirection(game, direction) {
  if (game.status !== 'running' || game.pendingDirection !== null) return false;
  const move = MOVES[direction];
  if (!move) return false;
  const current = MOVES[game.direction];
  if (move.x === -current.x && move.y === -current.y) return false;
  game.pendingDirection = direction;
  return true;
}

function tick(game) {
  if (game.status !== 'running') return false;

  if (game.pendingDirection !== null) {
    game.direction = game.pendingDirection;
    game.pendingDirection = null;
  }

  const head = game.snake[0];
  const move = MOVES[game.direction];
  const next = {x: head.x + move.x, y: head.y + move.y};
  const eating = game.food !== null && next.x === game.food.x && next.y === game.food.y;

  const outside =
    next.x < 0 || next.y < 0 || next.x >= game.size || next.y >= game.size;
  const body = eating ? game.snake : game.snake.slice(0, -1);
  const hitsBody = body.some((part) => part.x === next.x && part.y === next.y);

  if (outside || hitsBody) {
    game.status = 'gameover';
    return true;
  }

  game.snake.unshift(next);

  if (eating) {
    game.score += 10;
    game.food = pickFood(game);
    if (game.food === null) game.status = 'won';
  } else {
    game.snake.pop();
  }

  return true;
}

function togglePause(game) {
  if (game.status === 'running') {
    game.status = 'paused';
    return true;
  }
  if (game.status === 'paused') {
    game.status = 'running';
    return true;
  }
  return false;
}

const SnakeEngine = {
  SIZE,
  createGame,
  startGame,
  setDirection,
  tick,
  togglePause,
};

if (typeof module !== 'undefined' && module.exports) module.exports = SnakeEngine;
if (typeof globalThis !== 'undefined') globalThis.SnakeEngine = SnakeEngine;
