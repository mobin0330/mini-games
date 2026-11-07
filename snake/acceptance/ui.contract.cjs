'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
test('page has accessible controls and nested-route safe assets',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['board','score','best','status','start','pause','restart']) assert.match(html,new RegExp('id=["\\x27]'+id+'["\\x27]'));
 assert.match(html,/<canvas[^>]+id=["']board["']/i);
 for(const dir of ['up','down','left','right']) assert.match(html,new RegExp('data-direction=["\\x27]'+dir+'["\\x27]'));
 assert.match(html,/aria-live=/);assert.match(html,/href=["']\/["']/);
 for(const file of ['styles.css','engine.js','app.js']) assert.ok(html.includes(file));
 assert.doesNotMatch(html,/<script[^>]*src=["'](?:https?:)?\/\//);
 assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>\s*\S/i);
});
test('UI uses engine and handles visibility, touch, storage',()=>{
 const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
 for(const name of ['SnakeEngine','createGame','startGame','setDirection','tick','togglePause']) assert.ok(js.includes(name),'missing '+name);
 assert.match(js,/visibilitychange|document\.hidden/);assert.match(js,/localStorage/);
 assert.match(js,/touchstart|pointerdown/);assert.match(js,/touchend|pointerup/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|document\.cookie/);
});
