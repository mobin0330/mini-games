'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js');
test('initial state and start/pause transitions',()=>{
 assert.equal(E.SIZE,20);const g=E.createGame({random:()=>0});
 assert.equal(g.size,20);assert.equal(g.snake.length,3);assert.deepEqual(g.snake[0],{x:10,y:10});
 assert.equal(g.direction,'right');assert.equal(g.pendingDirection,null);assert.equal(g.status,'ready');assert.equal(g.score,0);
 const before=JSON.stringify(g);assert.equal(E.tick(g),false);assert.equal(JSON.stringify(g),before);
 assert.equal(E.startGame(g),true);assert.equal(E.startGame(g),false);
 assert.equal(E.togglePause(g),true);assert.equal(g.status,'paused');assert.equal(E.tick(g),false);
 assert.equal(E.togglePause(g),true);assert.equal(g.status,'running');
});
test('one queued direction and no reversal',()=>{
 const g=E.createGame();E.startGame(g);
 assert.equal(E.setDirection(g,'left'),false);assert.equal(E.setDirection(g,'up'),true);
 assert.equal(E.setDirection(g,'left'),false);E.tick(g);assert.equal(g.direction,'up');assert.equal(g.pendingDirection,null);
 assert.deepEqual(g.snake[0],{x:10,y:9});assert.equal(E.setDirection(g,'left'),true);
});
test('food grows snake and never respawns on snake',()=>{
 const g=E.createGame({size:6,random:()=>0});E.startGame(g);g.food={x:4,y:3};
 E.tick(g);assert.equal(g.snake.length,4);assert.equal(g.score,10);assert.ok(!g.snake.some(p=>p.x===g.food.x&&p.y===g.food.y));
});
test('wall collision terminal and no mutation after end',()=>{
 const g=E.createGame({size:4,random:()=>0});E.startGame(g);g.food={x:0,y:0};
 E.tick(g);E.tick(g);assert.equal(g.status,'gameover');const before=JSON.stringify(g);
 assert.equal(E.tick(g),false);assert.equal(E.setDirection(g,'up'),false);assert.equal(JSON.stringify(g),before);
});
test('body collision but tail escape allowed',()=>{
 const body=()=>{const g=E.createGame({size:5});g.status='running';g.snake=[{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2}];g.direction='up';g.food={x:4,y:4};return g;};
 const tail=body();E.setDirection(tail,'left');E.tick(tail);assert.equal(tail.status,'running');assert.deepEqual(tail.snake[0],{x:1,y:2});
 const collision=body();collision.snake.push({x:0,y:2});E.setDirection(collision,'left');E.tick(collision);assert.equal(collision.status,'gameover');
});
test('full board ends in won without infinite food loop',()=>{
 const g=E.createGame({size:4,random:()=>0});g.status='running';g.direction='right';g.pendingDirection=null;
 g.snake=[{x:2,y:0},{x:1,y:0},{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:3,y:2},{x:2,y:2},{x:1,y:2},{x:0,y:2},{x:0,y:3},{x:1,y:3},{x:2,y:3},{x:3,y:3}];g.food={x:3,y:0};
 E.tick(g);assert.equal(g.status,'won');assert.equal(g.food,null);assert.equal(g.snake.length,16);assert.equal(g.score,10);
});
