(function () {
  'use strict';

  var SIZE = 8;
  var CELLS = SIZE * SIZE;
  var STORAGE_BEST = 'match3.best';
  var STORAGE_SOUND = 'match3.sound';
  var STORAGE_HAPTICS = 'match3.haptics';
  var DESSERTS = ['草莓软糖', '蓝莓蛋糕', '柠檬挞', '抹茶巧克力', '葡萄果冻', '蜜桃星星饼干'];
  var ART = [
    'assets/candy-strawberry.svg',
    'assets/candy-blueberry.svg',
    'assets/candy-lemon.svg',
    'assets/candy-matcha.svg',
    'assets/candy-grape.svg',
    'assets/candy-peach.svg'
  ];
  var SPECIAL_NAMES = {
    1: '横排火箭糖',
    2: '竖排火箭糖',
    3: '巧克力炸弹',
    4: '彩虹棒棒糖'
  };
  var SPECIAL_CLASS = {
    1: 'tile--rocket-row',
    2: 'tile--rocket-col',
    3: 'tile--bomb',
    4: 'tile--rainbow'
  };
  var PARTICLE_COLORS = ['#ff6b81', '#5b8ef5', '#ffd84a', '#62b963', '#a363ea', '#ffac62'];
  var GLINT_COLORS = ['#ffffff', '#fff3b0', '#ffe6f0'];
  var TIMING = {
    swap: 100,
    clear: 148,
    clearSettle: 118,
    clearStagger: 8,
    clearStaggerMax: 72,
    drop: 172,
    dropStagger: 5,
    beat: 64,
    unlockPad: 36
  };

  var win = typeof window !== 'undefined' ? window : null;
  if (!win) {
    return;
  }

  var doc = win.document;
  var Engine = win.Match3Engine;
  if (!doc || !Engine) {
    return;
  }

  var game = null;
  var best = 0;
  var selectedIndex = null;
  var hintPair = [];
  var focusedIndex = 0;
  var locked = false;
  var epoch = 0;
  var timers = {};
  var tiles = [];
  var artElements = [];
  var reduceMotion = false;
  var suppressClick = false;
  var swipeStart = null;
  var soundOn = true;
  var hapticsOn = true;
  var displayedScore = 0;
  var comboTimer = null;
  var elements = {};
  var fx = {
    ctx: null,
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    rings: [],
    beams: [],
    running: false
  };

  function ms(key) {
    return reduceMotion ? 1 : TIMING[key];
  }

  function byId(id) {
    return doc.getElementById(id);
  }

  function rowOf(index) {
    return Math.floor(index / SIZE);
  }

  function colOf(index) {
    return index % SIZE;
  }

  function typeOf(value) {
    return Engine.tileType ? Engine.tileType(value) : value % 6;
  }

  function kindOf(value) {
    return Engine.specialKind ? Engine.specialKind(value) : Math.floor(value / 6);
  }

  function artFor(value) {
    return kindOf(value) === 4 ? 'assets/candy-rainbow.svg' : ART[typeOf(value)];
  }

  function tileName(index, value) {
    var name = '第' + (rowOf(index) + 1) + '行第' + (colOf(index) + 1) + '列，' + DESSERTS[typeOf(value)];
    var kind = kindOf(value);
    if (kind && SPECIAL_NAMES[kind]) {
      name += '，' + SPECIAL_NAMES[kind];
    }
    return name;
  }

  function isAdjacent(a, b) {
    return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
  }

  function readReduceMotion() {
    try {
      return Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (error) {
      return false;
    }
  }

  function readNumber(key) {
    try {
      var raw = win.localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '') {
        return 0;
      }
      var value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return 0;
      }
      return Math.floor(value);
    } catch (error) {
      return 0;
    }
  }

  function writeNumber(key, value) {
    try {
      win.localStorage.setItem(key, String(value));
    } catch (error) {
      /* Storage is a bonus, never a blocker. */
    }
  }

  function readFlag(key, fallback) {
    try {
      var raw = win.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        return fallback;
      }
      return raw === 'on';
    } catch (error) {
      return fallback;
    }
  }

  function writeFlag(key, value) {
    try {
      win.localStorage.setItem(key, value ? 'on' : 'off');
    } catch (error) {
      /* Storage is a bonus, never a blocker. */
    }
  }

  function schedule(callback, delay) {
    var id = win.setTimeout(function () {
      delete timers[id];
      callback();
    }, delay);
    timers[id] = true;
    return id;
  }

  function cancelTimers() {
    Object.keys(timers).forEach(function (key) {
      win.clearTimeout(Number(key));
    });
    timers = {};
    comboTimer = null;
  }

  function setStatus(message, tone) {
    if (!elements.status) {
      return;
    }
    elements.status.textContent = message;
    elements.status.setAttribute('data-tone', tone || 'neutral');
  }

  function pulse(element) {
    if (!element || !element.classList) {
      return;
    }
    element.classList.remove('is-bumping');
    if (element.offsetWidth !== undefined) {
      /* Force a reflow so repeated pops restart the animation. */
      void element.offsetWidth;
    }
    element.classList.add('is-bumping');
    schedule(function () {
      if (element.classList) {
        element.classList.remove('is-bumping');
      }
    }, 280);
  }

  function setDisplayedScore(value) {
    displayedScore = value;
    if (elements.score && elements.score.textContent !== String(value)) {
      elements.score.textContent = String(value);
    }
  }

  function updateStats() {
    displayedScore = game.score;
    if (elements.score && elements.score.textContent !== String(game.score)) {
      elements.score.textContent = String(game.score);
    }
    if (elements.best && elements.best.textContent !== String(best)) {
      elements.best.textContent = String(best);
    }
    if (elements.moves && elements.moves.textContent !== String(game.moves)) {
      elements.moves.textContent = String(game.moves);
    }
  }

  function updateBest() {
    if (game.score > best) {
      best = game.score;
      writeNumber(STORAGE_BEST, best);
      if (elements.best && elements.best.textContent !== String(best)) {
        elements.best.textContent = String(best);
      }
      return true;
    }
    if (elements.best && elements.best.textContent !== String(best)) {
      elements.best.textContent = String(best);
    }
    return false;
  }

  function updateToggleState() {
    if (elements.sound) {
      elements.sound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      elements.sound.classList.toggle('is-off', !soundOn);
      if (elements.soundLabel) {
        elements.soundLabel.textContent = soundOn ? '开' : '关';
      }
    }
    if (elements.haptics) {
      elements.haptics.setAttribute('aria-pressed', hapticsOn ? 'true' : 'false');
      elements.haptics.classList.toggle('is-off', !hapticsOn);
      if (elements.hapticsLabel) {
        elements.hapticsLabel.textContent = hapticsOn ? '开' : '关';
      }
    }
  }

  function updateLockState() {
    if (elements.board) {
      elements.board.setAttribute('aria-busy', locked ? 'true' : 'false');
      if (locked) {
        elements.board.classList.add('is-locked');
      } else {
        elements.board.classList.remove('is-locked');
      }
    }
    if (elements.hint) {
      elements.hint.disabled = locked;
    }
  }

  function applySelectionState() {
    for (var i = 0; i < CELLS; i++) {
      var tile = tiles[i];
      if (!tile) {
        continue;
      }
      var selected = i === selectedIndex;
      if (selected !== tile.classList.contains('is-selected')) {
        if (selected) {
          tile.classList.add('is-selected');
        } else {
          tile.classList.remove('is-selected');
        }
        tile.setAttribute('aria-selected', selected ? 'true' : 'false');
      }
    }
  }

  function clearHint() {
    for (var i = 0; i < hintPair.length; i++) {
      if (tiles[hintPair[i]]) {
        tiles[hintPair[i]].classList.remove('is-hint');
      }
    }
    hintPair = [];
  }

  function applyHintState() {
    for (var j = 0; j < hintPair.length; j++) {
      if (tiles[hintPair[j]]) {
        tiles[hintPair[j]].classList.add('is-hint');
      }
    }
  }

  function baseClassFor(value) {
    var kind = kindOf(value);
    var base = 'tile tile--type-' + typeOf(value);
    if (kind && SPECIAL_CLASS[kind]) {
      base += ' tile--special ' + SPECIAL_CLASS[kind];
    }
    return base;
  }

  /* Incremental render: only touch the DOM when a tile actually changed. */
  function renderBoard(board, force) {
    for (var i = 0; i < CELLS; i++) {
      var value = board[i];
      var tile = tiles[i];
      var art = artElements[i];
      if (!tile) {
        continue;
      }

      var kind = kindOf(value);
      var base = baseClassFor(value);
      if (force || tile.__baseClass !== base) {
        var selected = tile.classList.contains('is-selected');
        var hinted = tile.classList.contains('is-hint');
        tile.className = base;
        tile.__baseClass = base;
        if (selected) {
          tile.classList.add('is-selected');
        }
        if (hinted) {
          tile.classList.add('is-hint');
        }
      }

      if (force || tile.dataset.value !== String(value)) {
        tile.dataset.value = String(value);
        tile.dataset.type = String(typeOf(value));
        tile.dataset.kind = String(kind);
        tile.setAttribute('aria-label', tileName(i, value));
      }

      if (art) {
        var artPath = artFor(value);
        if (force || art.__artPath !== artPath) {
          art.__artPath = artPath;
          art.className = 'tile__art';
          art.dataset.art = artPath;
          if (art.style) {
            art.style.backgroundImage = 'url("' + artPath + '")';
          }
        }
      }
    }
    applySelectionState();
    applyHintState();
  }

  function setRovingTabIndex(index) {
    focusedIndex = index;
    for (var i = 0; i < CELLS; i++) {
      if (tiles[i]) {
        tiles[i].tabIndex = i === index ? 0 : -1;
      }
    }
  }

  function focusTile(index) {
    if (!tiles[index]) {
      return;
    }
    setRovingTabIndex(index);
    try {
      tiles[index].focus();
    } catch (error) {
      /* Older or partial DOM implementations may not support focus. */
    }
  }

  function buildBoard() {
    tiles = [];
    artElements = [];

    for (var i = 0; i < CELLS; i++) {
      var tile = doc.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(i);
      tile.dataset.row = String(rowOf(i) + 1);
      tile.dataset.col = String(colOf(i) + 1);
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-selected', 'false');
      tile.setAttribute('aria-rowindex', String(rowOf(i) + 1));
      tile.setAttribute('aria-colindex', String(colOf(i) + 1));
      tile.tabIndex = i === 0 ? 0 : -1;

      var art = doc.createElement('span');
      art.className = 'tile__art';
      art.setAttribute('aria-hidden', 'true');
      tile.appendChild(art);

      addTileListeners(tile, i);
      elements.board.appendChild(tile);

      tiles.push(tile);
      artElements.push(art);
    }
  }

  function addTileListeners(tile, index) {
    tile.addEventListener('click', function () {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      selectTile(index);
    });

    tile.addEventListener('keydown', function (event) {
      handleTileKeydown(event, index);
    });

    tile.addEventListener('focus', function () {
      setRovingTabIndex(index);
    });
  }

  function handleTileKeydown(event, index) {
    var key = event.key;

    if (key === 'Enter' || key === ' ' || key === 'Space' || key === 'Spacebar') {
      event.preventDefault();
      if (!locked) {
        selectTile(index);
      }
      return;
    }

    if (key === 'Escape' || key === 'Esc') {
      event.preventDefault();
      if (locked) {
        return;
      }
      clearHint();
      selectedIndex = null;
      applySelectionState();
      setStatus('已取消选择。', 'neutral');
      return;
    }

    var row = rowOf(index);
    var col = colOf(index);
    var nextRow = row;
    var nextCol = col;

    if (key === 'ArrowLeft') {
      nextCol = Math.max(0, col - 1);
    } else if (key === 'ArrowRight') {
      nextCol = Math.min(SIZE - 1, col + 1);
    } else if (key === 'ArrowUp') {
      nextRow = Math.max(0, row - 1);
    } else if (key === 'ArrowDown') {
      nextRow = Math.min(SIZE - 1, row + 1);
    } else if (key === 'Home') {
      nextCol = 0;
    } else if (key === 'End') {
      nextCol = SIZE - 1;
    } else {
      return;
    }

    event.preventDefault();
    if (nextRow === row && nextCol === col) {
      return;
    }
    focusTile(nextRow * SIZE + nextCol);
  }

  function selectTile(index) {
    if (locked) {
      return;
    }

    clearHint();

    if (selectedIndex === index) {
      selectedIndex = null;
      applySelectionState();
      setStatus('已取消选择。', 'neutral');
      return;
    }

    if (selectedIndex === null) {
      selectedIndex = index;
      applySelectionState();
      sfx('select');
      vibrate(8);
      setStatus('已选中' + tileName(index, game.board[index]) + '，请选择相邻方块。', 'neutral');
      return;
    }

    if (!isAdjacent(selectedIndex, index)) {
      selectedIndex = index;
      applySelectionState();
      sfx('select');
      setStatus('已改选' + tileName(index, game.board[index]) + '，请选择与它相邻的方块。', 'neutral');
      return;
    }

    var first = selectedIndex;
    selectedIndex = null;
    applySelectionState();
    performSwap(first, index);
  }

  function showInvalid(pair) {
    var currentEpoch = epoch;
    for (var i = 0; i < pair.length; i++) {
      if (tiles[pair[i]]) {
        tiles[pair[i]].classList.add('is-invalid');
      }
    }
    schedule(function () {
      if (currentEpoch !== epoch) {
        return;
      }
      for (var j = 0; j < pair.length; j++) {
        if (tiles[pair[j]]) {
          tiles[pair[j]].classList.remove('is-invalid');
        }
      }
    }, reduceMotion ? 60 : 340);
  }

  function animateSwap(a, b, done) {
    if (reduceMotion || !tiles[a] || !tiles[b]) {
      schedule(done, 1);
      return;
    }

    var dc = colOf(b) - colOf(a);
    var dr = rowOf(b) - rowOf(a);
    var dirA = dc === 1 ? 'swap-right' : dc === -1 ? 'swap-left' : dr === 1 ? 'swap-down' : 'swap-up';
    var dirB = dc === 1 ? 'swap-left' : dc === -1 ? 'swap-right' : dr === 1 ? 'swap-up' : 'swap-down';

    tiles[a].classList.add('is-swapping', dirA);
    tiles[b].classList.add('is-swapping', dirB);

    schedule(function () {
      if (tiles[a]) {
        tiles[a].classList.remove('is-swapping', dirA);
      }
      if (tiles[b]) {
        tiles[b].classList.remove('is-swapping', dirB);
      }
      done();
    }, ms('swap'));
  }

  function addBeam(index, kind) {
    if (reduceMotion || !fx.ctx || !fx.width) {
      return;
    }
    var cell = fx.width / SIZE;
    var x = (colOf(index) + 0.5) * cell;
    var y = (rowOf(index) + 0.5) * cell;
    if (kind === 1 || kind === 2) {
      fx.beams.push({
        x1: kind === 1 ? cell * 0.1 : x,
        y1: kind === 1 ? y : cell * 0.1,
        x2: kind === 1 ? fx.width - cell * 0.1 : x,
        y2: kind === 1 ? y : fx.height - cell * 0.1,
        width: cell * 0.24,
        life: 0.24,
        maxLife: 0.24,
        color: kind === 1 ? '#ffd84a' : '#8fc7ff'
      });
      return;
    }
    fx.rings.push({
      x: x,
      y: y,
      radius: cell * 0.16,
      maxRadius: cell * (kind === 4 ? 2.6 : 1.15),
      life: kind === 4 ? 0.4 : 0.3,
      maxLife: kind === 4 ? 0.4 : 0.3,
      color: kind === 4 ? '#fff2a8' : '#ffb15e'
    });
  }

  function burst(index, type, strength) {
    if (reduceMotion || !fx.ctx || !fx.width) {
      return;
    }
    var cell = fx.width / SIZE;
    var x = (colOf(index) + 0.5) * cell;
    var y = (rowOf(index) + 0.5) * cell;
    var count = Math.min(15, 7 + strength * 2);
    var color = PARTICLE_COLORS[type] || '#ffd84a';

    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      var speed = 110 + Math.random() * 170 + strength * 26;
      var size = 2.6 + Math.random() * 4.4;
      var glint = Math.random() < 0.24;
      fx.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,
        size: size,
        stretch: 1 + Math.random() * 0.9,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 14,
        life: 0.42 + Math.random() * 0.32,
        maxLife: 0.74,
        color: glint ? GLINT_COLORS[i % GLINT_COLORS.length] : color,
        glint: glint
      });
    }
    fx.rings.push({
      x: x,
      y: y,
      radius: cell * 0.12,
      maxRadius: cell * (0.46 + Math.min(strength, 4) * 0.07),
      life: 0.26,
      maxLife: 0.26,
      color: '#fff1c2'
    });
    startFx();
  }

  function startFx() {
    if (fx.running || !fx.ctx || !win.requestAnimationFrame) {
      return;
    }
    fx.running = true;
    var last = 0;
    function frame(now) {
      var time = typeof now === 'number' ? now : 0;
      var dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016;
      last = time;
      var ctx = fx.ctx;
      ctx.clearRect(0, 0, fx.width * fx.dpr, fx.height * fx.dpr);
      ctx.save();
      ctx.scale(fx.dpr, fx.dpr);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      var beams = [];
      for (var b = 0; b < fx.beams.length; b++) {
        var beam = fx.beams[b];
        beam.life -= dt;
        if (beam.life <= 0) {
          continue;
        }
        var beamAlpha = beam.life / beam.maxLife;
        ctx.globalAlpha = beamAlpha * 0.9;
        ctx.strokeStyle = beam.color;
        ctx.lineWidth = beam.width * beamAlpha;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
        beams.push(beam);
      }
      fx.beams = beams;

      var rings = [];
      for (var r = 0; r < fx.rings.length; r++) {
        var ring = fx.rings[r];
        ring.life -= dt;
        if (ring.life <= 0) {
          continue;
        }
        var progress = 1 - ring.life / ring.maxLife;
        ctx.globalAlpha = Math.max(0, 1 - progress) * 0.85;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = Math.max(1, (1 - progress) * 4);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius + (ring.maxRadius - ring.radius) * progress, 0, Math.PI * 2);
        ctx.stroke();
        rings.push(ring);
      }
      fx.rings = rings;

      var alive = [];
      for (var i = 0; i < fx.particles.length; i++) {
        var p = fx.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 560 * dt;
        p.vx *= 0.988;
        p.rotation += p.spin * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.fillStyle = p.color;
        if (p.glint) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size * p.stretch / 2, p.size, p.size * p.stretch);
          ctx.restore();
        }
        alive.push(p);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      fx.particles = alive;
      if (alive.length || rings.length || beams.length) {
        win.requestAnimationFrame(frame);
      } else {
        fx.running = false;
        ctx.clearRect(0, 0, fx.width * fx.dpr, fx.height * fx.dpr);
      }
    }
    win.requestAnimationFrame(frame);
  }

  function flash(strength) {
    if (reduceMotion || !elements.flash || !elements.flash.classList) {
      return;
    }
    elements.flash.classList.remove('is-flash', 'is-flash-strong');
    void (elements.flash.offsetWidth || 0);
    elements.flash.classList.add(strength >= 2 ? 'is-flash-strong' : 'is-flash');
    schedule(function () {
      if (elements.flash && elements.flash.classList) {
        elements.flash.classList.remove('is-flash', 'is-flash-strong');
      }
    }, strength >= 2 ? 300 : 200);
  }

  function resizeFx() {
    if (!fx.ctx || !elements.board) {
      return;
    }
    var rect = null;
    if (elements.board.getBoundingClientRect) {
      rect = elements.board.getBoundingClientRect();
    }
    if (!rect || !rect.width || !rect.height) {
      return;
    }
    var dpr = Math.min(win.devicePixelRatio || 1, 2);
    fx.dpr = dpr;
    fx.width = rect.width;
    fx.height = rect.height;
    elements.fx.width = Math.round(rect.width * dpr);
    elements.fx.height = Math.round(rect.height * dpr);
    if (elements.fx.style) {
      elements.fx.style.width = rect.width + 'px';
      elements.fx.style.height = rect.height + 'px';
    }
  }

  function initFx() {
    if (!elements.fx || !elements.fx.getContext) {
      return;
    }
    try {
      fx.ctx = elements.fx.getContext('2d');
    } catch (error) {
      fx.ctx = null;
    }
    if (!fx.ctx) {
      return;
    }
    resizeFx();
    if (win.addEventListener) {
      win.addEventListener('resize', resizeFx);
      win.addEventListener('load', resizeFx);
    }
  }

  function shake(strength) {
    if (reduceMotion || !elements.stage || !elements.stage.classList) {
      return;
    }
    elements.stage.classList.remove('is-shaking', 'is-shaking-strong');
    void (elements.stage.offsetWidth || 0);
    elements.stage.classList.add(strength >= 2 ? 'is-shaking-strong' : 'is-shaking');
    schedule(function () {
      if (elements.stage && elements.stage.classList) {
        elements.stage.classList.remove('is-shaking', 'is-shaking-strong');
      }
    }, 320);
  }

  function floatScore(row, col, amount, depth) {
    if (!elements.scoreFx || !elements.scoreFx.appendChild) {
      return;
    }
    var node = doc.createElement('span');
    node.className = 'score-float' + (depth >= 4 ? ' score-float--big' : depth >= 2 ? ' score-float--combo' : '');
    node.textContent = amount;
    node.setAttribute('aria-hidden', 'true');
    if (node.style) {
      node.style.left = (((col + 0.5) / SIZE) * 100) + '%';
      node.style.top = (((row + 0.5) / SIZE) * 100) + '%';
    }
    elements.scoreFx.appendChild(node);
    schedule(function () {
      if (node.parentNode && node.parentNode.removeChild) {
        node.parentNode.removeChild(node);
      }
    }, 1000);
  }

  function showCombo(depth) {
    if (!elements.combo) {
      return;
    }
    var tier = depth >= 5 ? 3 : depth >= 3 ? 2 : 1;
    var label = depth >= 5 ? '无敌' : depth >= 4 ? '太棒了' : depth >= 3 ? '超赞' : '连锁';
    elements.combo.textContent = label + ' ×' + depth;
    elements.combo.className = 'combo-badge is-visible combo-badge--' + tier;
    elements.combo.setAttribute('aria-hidden', 'true');
    if (comboTimer) {
      win.clearTimeout(comboTimer);
      delete timers[comboTimer];
    }
    comboTimer = schedule(function () {
      if (elements.combo) {
        elements.combo.className = 'combo-badge';
      }
      comboTimer = null;
    }, 950);
  }

  function showRecord() {
    if (!elements.record) {
      return;
    }
    elements.record.className = 'record-badge is-visible';
    elements.record.setAttribute('aria-hidden', 'true');
    schedule(function () {
      if (elements.record) {
        elements.record.className = 'record-badge';
      }
    }, 1800);
  }

  function sfx(name, options) {
    if (!soundOn) {
      return;
    }
    var audio = win.Match3SFX;
    if (audio && typeof audio.play === 'function') {
      audio.play(name, options || {});
    }
  }

  function vibrate(pattern) {
    if (!hapticsOn) {
      return;
    }
    try {
      if (win.navigator && typeof win.navigator.vibrate === 'function') {
        win.navigator.vibrate(pattern);
      }
    } catch (error) {
      /* Haptics are a bonus, never a blocker. */
    }
  }

  function toggleSound() {
    soundOn = !soundOn;
    writeFlag(STORAGE_SOUND, soundOn);
    if (win.Match3SFX && typeof win.Match3SFX.setEnabled === 'function') {
      win.Match3SFX.setEnabled(soundOn);
    }
    updateToggleState();
    if (soundOn) {
      sfx('click');
    }
  }

  function toggleHaptics() {
    hapticsOn = !hapticsOn;
    writeFlag(STORAGE_HAPTICS, hapticsOn);
    updateToggleState();
    if (hapticsOn) {
      vibrate([12, 30, 12]);
      sfx('click');
    }
  }

  function specialSounds(cascade) {
    var flags = { rocket: false, bomb: false, rainbow: false };
    for (var i = 0; i < cascade.activated.length; i++) {
      var value = cascade.board[cascade.activated[i]];
      var kind = kindOf(value);
      if (kind === 1 || kind === 2) {
        flags.rocket = true;
      } else if (kind === 3) {
        flags.bomb = true;
      } else if (kind === 4) {
        flags.rainbow = true;
      }
    }
    if (flags.rocket) {
      sfx('special', { rate: 1 + Math.min(cascade.depth - 1, 4) * 0.06 });
    }
    if (flags.bomb) {
      sfx('bomb');
    }
    if (flags.rainbow) {
      sfx('rainbow');
    }
    return flags;
  }

  function clearPhaseClasses() {
    for (var i = 0; i < CELLS; i++) {
      if (tiles[i]) {
        tiles[i].classList.remove('is-clearing', 'is-dropping', 'is-spawning');
      }
    }
  }

  /* Translate the engine's collapse into per-tile fall distances and stagger. */
  function applyDropAnimation(cascade) {
    if (reduceMotion) {
      return 0;
    }
    var cleared = {};
    var spawnAt = {};
    var removedInColumn = [];
    var c;
    for (c = 0; c < SIZE; c++) {
      removedInColumn.push(0);
    }
    for (var i = 0; i < cascade.indices.length; i++) {
      cleared[cascade.indices[i]] = true;
      removedInColumn[colOf(cascade.indices[i])] += 1;
    }
    for (var s = 0; s < cascade.spawns.length; s++) {
      spawnAt[cascade.spawns[s].index] = true;
    }

    var maxDelay = 0;
    for (var index = 0; index < CELLS; index++) {
      if (spawnAt[index] || !tiles[index]) {
        continue;
      }
      var col = colOf(index);
      var row = rowOf(index);
      if (!removedInColumn[col]) {
        continue;
      }
      var above = 0;
      for (var r = 0; r < row; r++) {
        if (cleared[r * SIZE + col]) {
          above += 1;
        }
      }
      var rows = row < removedInColumn[col]
        ? Math.max(2, removedInColumn[col] - row + 1)
        : above;
      if (rows <= 0) {
        continue;
      }
      var delay = col * ms('dropStagger');
      if (delay > maxDelay) {
        maxDelay = delay;
      }
      if (tiles[index].style && tiles[index].style.setProperty) {
        tiles[index].style.setProperty('--drop-rows', String(rows));
        tiles[index].style.setProperty('--drop-delay', delay + 'ms');
        tiles[index].style.setProperty('--drop-ms', ms('drop') + 'ms');
      }
      tiles[index].classList.add('is-dropping');
    }

    for (var d = 0; d < cascade.spawns.length; d++) {
      var spawnIndex = cascade.spawns[d].index;
      if (!tiles[spawnIndex]) {
        continue;
      }
      tiles[spawnIndex].classList.remove('is-dropping');
      if (tiles[spawnIndex].style && tiles[spawnIndex].style.setProperty) {
        tiles[spawnIndex].style.setProperty('--spawn-delay', (colOf(spawnIndex) * 6) + 'ms');
      }
      tiles[spawnIndex].classList.add('is-spawning');
    }
    return maxDelay;
  }

  function performSwap(a, b) {
    if (locked) {
      return;
    }

    clearHint();
    selectedIndex = null;
    applySelectionState();

    var scoreBefore = game.score;
    var rainbowSwap = Boolean(Engine.isRainbow && (
      Engine.isRainbow(game.board[a]) || Engine.isRainbow(game.board[b])
    ));
    var result = Engine.swap(game, a, b);

    if (!result.valid) {
      renderBoard(game.board);
      showInvalid([a, b]);
      sfx('invalid');
      vibrate(25);
      setStatus('这两个方块交换后不能消除，已恢复原状，步数不变。请重新选择相邻方块。', 'warn');
      return;
    }

    locked = true;
    updateLockState();
    if (elements.moves) {
      elements.moves.textContent = String(game.moves);
    }
    sfx('swap');
    vibrate(12);
    setStatus('正在结算消除与连锁…', 'busy');

    var currentEpoch = epoch;
    var cascades = result.cascades;
    var display = scoreBefore;

    function finish() {
      if (currentEpoch !== epoch) {
        return;
      }

      clearPhaseClasses();
      renderBoard(game.board);
      updateStats();
      var isRecord = updateBest();
      locked = false;
      updateLockState();

      var removed = 0;
      for (var i = 0; i < cascades.length; i++) {
        removed += cascades[i].indices.length;
      }
      var gained = game.score - scoreBefore;
      var maxDepth = cascades.length;
      var message = '连锁 ' + maxDepth + ' 次，共消除 ' + removed +
        ' 个方块，得分 +' + gained + '。当前得分 ' + game.score + '。';

      if (result.reshuffled) {
        message += ' 没有可用组合，已自动重新排列，分数和步数保留。';
      }

      if (isRecord) {
        showRecord();
        sfx('newbest');
        shake(2);
        burst(27, 2, 4);
        burst(36, 4, 4);
        setStatus(message + ' 新纪录！', 'record');
      } else {
        setStatus(message, result.reshuffled ? 'hint' : maxDepth >= 3 ? 'combo' : 'good');
      }
    }

    function afterClear(index) {
      if (currentEpoch !== epoch) {
        return;
      }
      var cascade = cascades[index];
      clearPhaseClasses();
      renderBoard(cascade.after);
      var columnDelay = applyDropAnimation(cascade);

      for (var s = 0; s < cascade.spawns.length; s++) {
        var spawn = cascade.spawns[s];
        if (spawn.kind === 4) {
          sfx('rainbow', { rate: 1.08 });
          vibrate([15, 30, 15]);
        } else if (spawn.kind === 3) {
          sfx('special');
          vibrate([12, 24, 12]);
        } else {
          sfx('special', { rate: 0.94 });
        }
      }

      sfx('drop', { rate: 0.96 + Math.min(index, 3) * 0.04, gain: 0.5 });

      var settle = ms('drop') + columnDelay + ms('unlockPad');
      if (index === cascades.length - 1) {
        schedule(finish, settle);
      } else {
        schedule(function () {
          if (currentEpoch === epoch) {
            showCascade(index + 1);
          }
        }, ms('drop') + columnDelay + ms('beat'));
      }
    }

    function showCascade(index) {
      if (currentEpoch !== epoch) {
        return;
      }
      if (index >= cascades.length) {
        finish();
        return;
      }

      var cascade = cascades[index];
      clearPhaseClasses();
      renderBoard(cascade.board);

      var clearHold = 0;
      for (var i = 0; i < cascade.indices.length; i++) {
        var clearIndex = cascade.indices[i];
        var delay = Math.min(i * ms('clearStagger'), ms('clearStaggerMax'));
        if (delay > clearHold) {
          clearHold = delay;
        }
        if (tiles[clearIndex]) {
          if (tiles[clearIndex].style && tiles[clearIndex].style.setProperty) {
            tiles[clearIndex].style.setProperty('--clear-delay', delay + 'ms');
          }
          tiles[clearIndex].classList.add('is-clearing');
        }
        burst(clearIndex, typeOf(cascade.board[clearIndex]), cascade.depth);
      }

      var activated = cascade.activated || [];
      for (var act = 0; act < activated.length; act++) {
        addBeam(activated[act], kindOf(cascade.board[activated[act]]));
      }

      display += cascade.gained;
      setDisplayedScore(display);
      pulse(elements.score);

      var sumRow = 0;
      var sumCol = 0;
      for (var p = 0; p < cascade.indices.length; p++) {
        sumRow += rowOf(cascade.indices[p]);
        sumCol += colOf(cascade.indices[p]);
      }
      if (cascade.indices.length) {
        floatScore(
          Math.round(sumRow / cascade.indices.length),
          Math.round(sumCol / cascade.indices.length),
          '+' + cascade.gained,
          cascade.depth
        );
      }

      var flags = specialSounds(cascade);
      if (rainbowSwap && cascade.depth === 1) {
        flags.rainbow = true;
      }

      sfx('break', { rate: 0.95 + Math.min(index, 4) * 0.04, gain: 0.62 });

      if (cascade.depth >= 2) {
        showCombo(cascade.depth);
        sfx('combo', { rate: 1 + Math.min(cascade.depth - 2, 4) * 0.07 });
        vibrate(cascade.depth >= 3 ? [15, 30, 20, 30, 25] : [10, 30, 15]);
        shake(cascade.depth >= 3 ? 2 : 1);
      } else {
        sfx('match', { rate: 1 + Math.min(index, 4) * 0.05 });
        vibrate(10);
      }

      if (flags.rainbow) {
        shake(2);
        flash(2);
      } else if (flags.bomb) {
        shake(1);
        flash(1);
      } else if (cascade.depth >= 4) {
        flash(1);
      }

      if (cascade.depth === 1) {
        setStatus('正在结算消除与连锁… 暂不接受操作。', 'busy');
      } else {
        setStatus('连锁 ' + cascade.depth + ' 次！正在结算…', 'busy');
      }

      schedule(function () {
        afterClear(index);
      }, clearHold + ms('clearSettle'));
    }

    animateSwap(a, b, function () {
      if (currentEpoch === epoch) {
        showCascade(0);
      }
    });
  }

  function showHint() {
    if (locked) {
      return;
    }

    clearHint();
    selectedIndex = null;
    applySelectionState();

    var pair = Engine.findMove(game.board);
    if (!pair) {
      Engine.reshuffle(game);
      renderBoard(game.board);
      updateStats();
      sfx('special', { rate: 0.9 });
      setStatus('没有可用组合，已自动重新排列，分数和步数保留。', 'hint');
      return;
    }

    hintPair = [pair[0], pair[1]];
    applyHintState();
    sfx('select');
    setStatus(
      '提示：高亮的' + tileName(pair[0], game.board[pair[0]]) + '与' +
      tileName(pair[1], game.board[pair[1]]) +
      '可以交换，不消耗步数。',
      'hint'
    );
  }

  function restart() {
    epoch += 1;
    cancelTimers();

    selectedIndex = null;
    hintPair = [];
    locked = false;
    suppressClick = false;
    swipeStart = null;
    displayedScore = 0;

    game = Engine.createGame();
    var storedBest = readNumber(STORAGE_BEST);
    if (storedBest > best) {
      best = storedBest;
    }
    for (var i = 0; i < CELLS; i++) {
      if (tiles[i]) {
        tiles[i].classList.remove(
          'is-clearing', 'is-dropping', 'is-spawning', 'is-swapping',
          'is-invalid', 'is-pressed', 'is-selected', 'is-hint', 'is-dragging'
        );
        if (tiles[i].style && tiles[i].style.removeProperty) {
          tiles[i].style.removeProperty('--drag-x');
          tiles[i].style.removeProperty('--drag-y');
          tiles[i].style.removeProperty('--clear-delay');
          tiles[i].style.removeProperty('--drop-rows');
          tiles[i].style.removeProperty('--drop-delay');
          tiles[i].style.removeProperty('--drop-ms');
          tiles[i].style.removeProperty('--spawn-delay');
        }
      }
    }
    renderBoard(game.board, true);
    updateStats();
    updateLockState();
    setRovingTabIndex(focusedIndex);
    if (elements.combo) {
      elements.combo.className = 'combo-badge';
    }
    if (elements.record) {
      elements.record.className = 'record-badge';
    }
    if (elements.scoreFx) {
      elements.scoreFx.textContent = '';
    }
    if (fx.ctx) {
      fx.particles = [];
      fx.rings = [];
      fx.beams = [];
      fx.running = false;
      fx.ctx.clearRect(0, 0, fx.width * fx.dpr, fx.height * fx.dpr);
    }
    if (elements.flash && elements.flash.classList) {
      elements.flash.classList.remove('is-flash', 'is-flash-strong');
    }
    setStatus('已重新开始。不限时、不限步数，慢慢来。', 'good');
  }

  function tileIndexFromTarget(target) {
    var node = target;
    while (node && node !== elements.board) {
      if (node.dataset && node.dataset.index !== undefined) {
        return Number(node.dataset.index);
      }
      node = node.parentNode;
    }
    return -1;
  }

  function clearDrag(index) {
    if (tiles[index]) {
      tiles[index].classList.remove('is-dragging', 'is-pressed');
      if (tiles[index].style && tiles[index].style.removeProperty) {
        tiles[index].style.removeProperty('--drag-x');
        tiles[index].style.removeProperty('--drag-y');
      }
    }
  }

  function pressTile(index, pressed) {
    if (tiles[index]) {
      tiles[index].classList.toggle('is-pressed', Boolean(pressed));
    }
  }

  function bindPointerSwipe() {
    if (!elements.board || !elements.board.addEventListener) {
      return;
    }

    elements.board.addEventListener('pointerdown', function (event) {
      if (locked) {
        return;
      }
      var index = tileIndexFromTarget(event.target);
      if (index < 0) {
        return;
      }
      swipeStart = {
        index: index,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        dragging: false
      };
      pressTile(index, true);
    });

    elements.board.addEventListener('pointermove', function (event) {
      if (!swipeStart || locked) {
        return;
      }
      var tile = tiles[swipeStart.index];
      if (!tile || !tile.style || !tile.style.setProperty) {
        return;
      }
      var dx = event.clientX - swipeStart.x;
      var dy = event.clientY - swipeStart.y;
      if (!swipeStart.dragging && Math.max(Math.abs(dx), Math.abs(dy)) < 7) {
        return;
      }
      if (!swipeStart.dragging) {
        swipeStart.dragging = true;
        tile.classList.add('is-dragging');
      }
      tile.style.setProperty('--drag-x', Math.max(-28, Math.min(28, dx)) + 'px');
      tile.style.setProperty('--drag-y', Math.max(-28, Math.min(28, dy)) + 'px');
    });

    elements.board.addEventListener('pointerup', function (event) {
      if (!swipeStart || locked) {
        swipeStart = null;
        return;
      }

      var start = swipeStart;
      swipeStart = null;
      clearDrag(start.index);

      var dx = event.clientX - start.x;
      var dy = event.clientY - start.y;
      var distance = Math.max(Math.abs(dx), Math.abs(dy));

      if (distance < 24) {
        return;
      }

      var target = start.index;
      if (Math.abs(dx) > Math.abs(dy)) {
        target += dx > 0 ? 1 : -1;
        if (rowOf(target) !== rowOf(start.index)) {
          return;
        }
      } else {
        target += dy > 0 ? SIZE : -SIZE;
      }

      if (target < 0 || target >= CELLS || !isAdjacent(start.index, target)) {
        return;
      }

      suppressClick = true;
      performSwap(start.index, target);
      schedule(function () {
        suppressClick = false;
      }, 0);
    });

    elements.board.addEventListener('pointercancel', function () {
      if (swipeStart) {
        clearDrag(swipeStart.index);
      }
      swipeStart = null;
    });
  }

  function unlockAudio() {
    if (win.Match3SFX && typeof win.Match3SFX.unlock === 'function') {
      win.Match3SFX.unlock();
    }
  }

  function bindControls() {
    if (elements.hint) {
      elements.hint.addEventListener('click', showHint);
    }
    if (elements.restart) {
      elements.restart.addEventListener('click', restart);
    }
    if (elements.sound) {
      elements.sound.addEventListener('click', toggleSound);
    }
    if (elements.haptics) {
      elements.haptics.addEventListener('click', toggleHaptics);
    }
    bindPointerSwipe();

    if (doc.addEventListener) {
      doc.addEventListener('pointerdown', unlockAudio, { once: true });
      doc.addEventListener('keydown', unlockAudio, { once: true });
    }
  }

  function init() {
    elements.board = byId('board');
    elements.stage = byId('stage');
    elements.score = byId('score');
    elements.best = byId('best');
    elements.moves = byId('moves');
    elements.status = byId('status');
    elements.hint = byId('hint');
    elements.restart = byId('restart');
    elements.sound = byId('sound');
    elements.haptics = byId('haptics');
    elements.soundLabel = byId('sound-state');
    elements.hapticsLabel = byId('haptics-state');
    elements.combo = byId('combo');
    elements.record = byId('record');
    elements.fx = byId('fx');
    elements.flash = byId('flash');
    elements.scoreFx = byId('score-fx');

    if (!elements.board) {
      return;
    }

    reduceMotion = readReduceMotion();
    soundOn = readFlag(STORAGE_SOUND, true);
    hapticsOn = readFlag(STORAGE_HAPTICS, true);
    best = readNumber(STORAGE_BEST);
    game = Engine.createGame();

    if (win.Match3SFX && typeof win.Match3SFX.preload === 'function') {
      win.Match3SFX.preload();
    }
    if (win.Match3SFX && typeof win.Match3SFX.setEnabled === 'function') {
      win.Match3SFX.setEnabled(soundOn);
    }

    buildBoard();
    bindControls();
    renderBoard(game.board);
    initFx();
    updateStats();
    updateLockState();
    updateToggleState();
    setRovingTabIndex(0);
    setStatus('选择相邻的两个甜品交换，连成三个或更多即可消除。四连、五连会生成特殊甜品。', 'neutral');
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
