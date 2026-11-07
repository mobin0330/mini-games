(function () {
  'use strict';

  var win = typeof window !== 'undefined' ? window : null;
  if (!win) {
    return;
  }

  var FILES = {
    select: 'audio/select.mp3',
    swap: 'audio/swap.mp3',
    invalid: 'audio/invalid.mp3',
    match: 'audio/match.mp3',
    break: 'audio/break.mp3',
    special: 'audio/special.mp3',
    bomb: 'audio/bomb.mp3',
    rainbow: 'audio/rainbow.mp3',
    combo: 'audio/combo.mp3',
    drop: 'audio/drop.mp3',
    click: 'audio/click.mp3',
    newbest: 'audio/newbest.mp3',
    bgm: 'audio/bgm.mp3'
  };

  var GAINS = {
    select: 0.5,
    swap: 0.42,
    invalid: 0.45,
    match: 0.72,
    break: 0.62,
    special: 0.6,
    bomb: 0.72,
    rainbow: 0.7,
    combo: 0.55,
    drop: 0.4,
    click: 0.4,
    newbest: 0.7
  };

  var MUSIC_GAIN = 0.2;
  var context = null;
  var master = null;
  var compressor = null;
  var musicBus = null;
  var buffers = {};
  var loading = {};
  var enabled = true;
  var unlocked = false;
  var musicSource = null;

  function AudioCtor() {
    return win.AudioContext || win.webkitAudioContext || null;
  }

  function ensureContext() {
    if (context) {
      return context;
    }
    var Ctor = AudioCtor();
    if (!Ctor) {
      return null;
    }
    try {
      context = new Ctor();
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.24;
      compressor.connect(context.destination);

      master = context.createGain();
      master.gain.value = 0.9;
      master.connect(compressor);

      musicBus = context.createGain();
      musicBus.gain.value = MUSIC_GAIN;
      musicBus.connect(compressor);
    } catch (error) {
      context = null;
      master = null;
      compressor = null;
      musicBus = null;
    }
    return context;
  }

  function decode(arrayBuffer) {
    return new Promise(function (resolve, reject) {
      if (!context) {
        reject(new Error('no audio context'));
        return;
      }
      var result = context.decodeAudioData(arrayBuffer, resolve, reject);
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    });
  }

  function load(name) {
    if (buffers[name] || loading[name] || !context) {
      return;
    }
    loading[name] = true;
    var fetcher = win.fetch || (typeof fetch === 'function' ? fetch : null);
    if (!fetcher) {
      loading[name] = false;
      return;
    }
    fetcher(FILES[name])
      .then(function (response) {
        if (!response.ok) {
          throw new Error('audio fetch failed: ' + name);
        }
        return response.arrayBuffer();
      })
      .then(decode)
      .then(function (buffer) {
        buffers[name] = buffer;
        loading[name] = false;
        if (name === 'bgm') {
          startMusic();
        }
      })
      .catch(function () {
        loading[name] = false;
      });
  }

  function preload() {
    if (!ensureContext()) {
      return;
    }
    Object.keys(FILES).forEach(load);
  }

  function startMusic() {
    if (!enabled || !unlocked || !context || !buffers.bgm || musicSource) {
      return;
    }
    try {
      musicSource = context.createBufferSource();
      musicSource.buffer = buffers.bgm;
      musicSource.loop = true;
      musicSource.connect(musicBus);
      musicBus.gain.cancelScheduledValues(0);
      musicBus.gain.setValueAtTime(0, context.currentTime);
      musicBus.gain.linearRampToValueAtTime(MUSIC_GAIN, context.currentTime + 1.4);
      musicSource.start(0);
    } catch (error) {
      musicSource = null;
    }
  }

  function stopMusic() {
    if (!musicSource) {
      return;
    }
    try {
      musicSource.stop(0);
    } catch (error) {
      /* Already stopped. */
    }
    musicSource = null;
  }

  function unlock() {
    if (!ensureContext()) {
      return;
    }
    unlocked = true;
    if (context.state === 'suspended' && typeof context.resume === 'function') {
      try {
        context.resume();
      } catch (error) {
        /* Ignore browsers that resume on their own. */
      }
    }
    preload();
    startMusic();
  }

  function play(name, options) {
    if (!enabled || !ensureContext()) {
      return;
    }
    if (!buffers[name]) {
      load(name);
      return;
    }
    if (context.state === 'suspended') {
      if (!unlocked) {
        return;
      }
      try {
        context.resume();
      } catch (error) {
        /* Ignore. */
      }
    }

    var opts = options && typeof options === 'object' ? options : {};
    var source;
    var gain;
    try {
      source = context.createBufferSource();
      source.buffer = buffers[name];
      source.playbackRate.value = Number(opts.rate) > 0 ? Number(opts.rate) : 1;
      gain = context.createGain();
      var level = opts.gain !== undefined ? Number(opts.gain) : (GAINS[name] || 0.6);
      gain.gain.value = Math.max(0, Math.min(1.5, level));
      source.connect(gain);
      gain.connect(master);
      source.start(0);
    } catch (error) {
      /* Sound is a bonus, never a blocker. */
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (enabled) {
      preload();
      startMusic();
    } else {
      stopMusic();
    }
  }

  function isEnabled() {
    return enabled;
  }

  win.Match3SFX = {
    preload: preload,
    unlock: unlock,
    play: play,
    setEnabled: setEnabled,
    isEnabled: isEnabled
  };
}());
