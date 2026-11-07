'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function onSnake(game, point) {
  return game.snake.some((part) => part.x === point.x && part.y === point.y);
}

function runningGame(options) {
  const game = E.createGame(options);
  E.startGame(game);
  return game;
}

test('createGame builds the documented initial state', () => {
  assert.equal(E.SIZE, 20);

  const game = E.createGame();
  assert.equal(game.size, 20);
  assert.deepEqual(game.snake, [
    {x: 10, y: 10},
    {x: 9, y: 10},
    {x: 8, y: 10},
  ]);
  assert.equal(game.direction, 'right');
  assert.equal(game.pendingDirection, null);
  assert.equal(game.score, 0);
  assert.equal(game.status, 'ready');
  assert.equal(typeof game.random, 'function');
  assert.ok(game.food);
  assert.ok(!onSnake(game, game.food));
});

test('createGame honors size, clamps it, and picks deterministic food', () => {
  const small = E.createGame({size: 2, random: () => 0});
  assert.equal(small.size, 4);
  assert.deepEqual(small.snake[0], {x: 2, y: 2});

  const game = E.createGame({size: 6, random: () => 0});
  assert.equal(game.size, 6);
  assert.deepEqual(game.snake, [
    {x: 3, y: 3},
    {x: 2, y: 3},
    {x: 1, y: 3},
  ]);
  assert.deepEqual(game.food, {x: 0, y: 0});

  const last = E.createGame({size: 4, random: () => 0.999});
  assert.deepEqual(last.food, {x: 3, y: 3});
  assert.ok(!onSnake(last, last.food));
});

test('start and pause only happen from the documented states', () => {
  const ready = E.createGame({random: () => 0});
  assert.equal(E.togglePause(ready), false);
  const before = JSON.stringify(ready);
  assert.equal(E.tick(ready), false);
  assert.equal(E.setDirection(ready, 'up'), false);
  assert.equal(JSON.stringify(ready), before);

  assert.equal(E.startGame(ready), true);
  assert.equal(ready.status, 'running');
  assert.equal(E.startGame(ready), false);

  assert.equal(E.togglePause(ready), true);
  assert.equal(ready.status, 'paused');
  assert.equal(E.setDirection(ready, 'up'), false);
  assert.equal(E.tick(ready), false);
  assert.equal(E.togglePause(ready), true);
  assert.equal(ready.status, 'running');

  ready.status = 'gameover';
  assert.equal(E.togglePause(ready), false);
  assert.equal(E.startGame(ready), false);
  assert.equal(ready.status, 'gameover');
});

test('one direction per tick and no immediate reversal', () => {
  const game = runningGame({random: () => 0});
  assert.equal(E.setDirection(game, 'left'), false);
  assert.equal(game.pendingDirection, null);
  assert.equal(E.setDirection(game, 'up'), true);
  assert.equal(E.setDirection(game, 'down'), false);
  assert.equal(E.setDirection(game, 'left'), false);
  assert.equal(game.pendingDirection, 'up');

  assert.equal(E.tick(game), true);
  assert.equal(game.direction, 'up');
  assert.equal(game.pendingDirection, null);
  assert.deepEqual(game.snake[0], {x: 10, y: 9});

  assert.equal(E.setDirection(game, 'up'), true);
  assert.equal(E.tick(game), true);
  assert.deepEqual(game.snake[0], {x: 10, y: 8});
});

test('invalid directions are rejected without using the input slot', () => {
  const game = runningGame({random: () => 0});
  assert.equal(E.setDirection(game, 'north-east'), false);
  assert.equal(E.setDirection(game, ''), false);
  assert.equal(game.pendingDirection, null);
  assert.equal(E.setDirection(game, 'down'), true);
  assert.equal(game.pendingDirection, 'down');
});

test('eating grows the snake, scores, and respawns off the body', () => {
  const game = runningGame({size: 6, random: () => 0});
  game.food = {x: 4, y: 3};

  assert.equal(E.tick(game), true);
  assert.equal(game.snake.length, 4);
  assert.equal(game.score, 10);
  assert.deepEqual(game.snake[0], {x: 4, y: 3});
  assert.ok(game.food);
  assert.ok(!onSnake(game, game.food));

  game.food = {x: 5, y: 3};
  E.tick(game);
  assert.equal(game.snake.length, 5);
  assert.equal(game.score, 20);
  assert.deepEqual(game.snake[0], {x: 5, y: 3});
});

test('respawned food follows the supplied random source', () => {
  const game = runningGame({size: 4, random: () => 0.999});
  game.food = {x: 3, y: 2};
  E.tick(game);
  assert.deepEqual(game.snake, [
    {x: 3, y: 2},
    {x: 2, y: 2},
    {x: 1, y: 2},
    {x: 0, y: 2},
  ]);
  assert.deepEqual(game.food, {x: 3, y: 3});
});

test('wall collision ends the game without moving the snake', () => {
  const game = runningGame({size: 4, random: () => 0});
  game.food = {x: 0, y: 0};

  assert.equal(E.tick(game), true);
  assert.deepEqual(game.snake[0], {x: 3, y: 2});
  assert.equal(game.status, 'running');

  assert.equal(E.tick(game), true);
  assert.equal(game.status, 'gameover');
  assert.deepEqual(game.snake[0], {x: 3, y: 2});
  assert.equal(game.snake.length, 3);

  const before = JSON.stringify(game);
  assert.equal(E.tick(game), false);
  assert.equal(E.setDirection(game, 'up'), false);
  assert.equal(JSON.stringify(game), before);
});

test('self collision ends the game, but the departing tail is safe', () => {
  const makeGame = () => {
    const game = E.createGame({size: 6, random: () => 0});
    game.status = 'running';
    game.direction = 'up';
    game.pendingDirection = null;
    game.snake = [
      {x: 2, y: 2},
      {x: 2, y: 3},
      {x: 1, y: 3},
      {x: 1, y: 2},
    ];
    game.food = {x: 5, y: 5};
    return game;
  };

  const tail = makeGame();
  assert.equal(E.setDirection(tail, 'left'), true);
  assert.equal(E.tick(tail), true);
  assert.equal(tail.status, 'running');
  assert.deepEqual(tail.snake[0], {x: 1, y: 2});
  assert.equal(tail.snake.length, 4);

  const collision = makeGame();
  collision.snake.push({x: 0, y: 2});
  assert.equal(E.setDirection(collision, 'left'), true);
  assert.equal(E.tick(collision), true);
  assert.equal(collision.status, 'gameover');
  assert.deepEqual(collision.snake[0], {x: 2, y: 2});
});

test('filling the board wins and clears the food', () => {
  const game = E.createGame({size: 4, random: () => 0});
  game.status = 'running';
  game.direction = 'right';
  game.pendingDirection = null;
  game.snake = [
    {x: 2, y: 0}, {x: 1, y: 0}, {x: 0, y: 0}, {x: 0, y: 1},
    {x: 1, y: 1}, {x: 2, y: 1}, {x: 3, y: 1}, {x: 3, y: 2},
    {x: 2, y: 2}, {x: 1, y: 2}, {x: 0, y: 2}, {x: 0, y: 3},
    {x: 1, y: 3}, {x: 2, y: 3}, {x: 3, y: 3},
  ];
  game.food = {x: 3, y: 0};

  assert.equal(E.tick(game), true);
  assert.equal(game.status, 'won');
  assert.equal(game.food, null);
  assert.equal(game.snake.length, 16);
  assert.equal(game.score, 10);

  const before = JSON.stringify(game);
  assert.equal(E.tick(game), false);
  assert.equal(JSON.stringify(game), before);
});

test('pausing keeps queued input until the game resumes', () => {
  const game = runningGame({random: () => 0});
  assert.equal(E.setDirection(game, 'up'), true);
  assert.equal(E.togglePause(game), true);

  const before = JSON.stringify(game);
  assert.equal(E.tick(game), false);
  assert.equal(JSON.stringify(game), before);

  assert.equal(E.togglePause(game), true);
  assert.equal(E.tick(game), true);
  assert.equal(game.direction, 'up');
  assert.deepEqual(game.snake[0], {x: 10, y: 9});
});
