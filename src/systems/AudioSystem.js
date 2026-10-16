// Všechny zvuky jsou generované za běhu přes Web Audio API (žádné soubory, žádné licence).
// Nový zvuk = nová funkce v SOUNDS, pak ho lze volat z dat akcí { "type": "sound", "name": "..." }.

function noiseBuffer(ctx, seconds = 2, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

export class AudioSystem {
  constructor(bus) {
    this.bus = bus;
    this.ctx = null;
    this.volume = 0.8;
    this.ambientNodes = null;
    bus.on('sound', ({ name, volume, at }) => this.play(name, { volume, at }));
  }

  /** Musí se zavolat z uživatelského gesta (klepnutí) – odemkne zvuk na mobilu. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.white = noiseBuffer(this.ctx, 2, false);
      this.brown = noiseBuffer(this.ctx, 4, true);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  suspend(paused) {
    if (!this.ctx) return;
    if (paused) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  /** Posluchač = kamera (pro prostorové zvuky). */
  updateListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.position;
    const f = { x: 0, y: 0, z: -1 };
    const e = camera.matrixWorld.elements;
    f.x = -e[8];
    f.y = -e[9];
    f.z = -e[10];
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(p.x, t);
      l.positionY.setValueAtTime(p.y, t);
      l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(f.x, t);
      l.forwardY.setValueAtTime(f.y, t);
      l.forwardZ.setValueAtTime(f.z, t);
      l.upX.setValueAtTime(e[4], t);
      l.upY.setValueAtTime(e[5], t);
      l.upZ.setValueAtTime(e[6], t);
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, e[4], e[5], e[6]);
    }
  }

  play(name, { volume = 1, at = null } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const fn = SOUNDS[name];
    if (!fn) {
      console.warn(`[audio] neznámý zvuk "${name}"`);
      return;
    }
    const out = this.ctx.createGain();
    out.gain.value = volume;
    if (at) {
      const pan = this.ctx.createPanner();
      pan.panningModel = 'equalpower';
      pan.distanceModel = 'inverse';
      pan.refDistance = 1.2;
      pan.rolloffFactor = 1;
      if (pan.positionX) {
        pan.positionX.value = at.x;
        pan.positionY.value = at.y;
        pan.positionZ.value = at.z;
      } else pan.setPosition(at.x, at.y, at.z);
      out.connect(pan);
      pan.connect(this.master);
    } else out.connect(this.master);
    fn(this, out, this.ctx.currentTime);
  }

  // ---------- ambient ----------
  ambient(state, fade = 2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.ambientNodes) this._buildAmbient();
    const target = state === 'on' ? 1 : state === 'low' ? 0.35 : 0;
    this.ambientNodes.bus.gain.cancelScheduledValues(t);
    this.ambientNodes.bus.gain.setValueAtTime(this.ambientNodes.bus.gain.value, t);
    this.ambientNodes.bus.gain.linearRampToValueAtTime(target, t + Math.max(0.05, fade));
  }

  _buildAmbient() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);

    // hučení (elektrika / lednice)
    const humGain = ctx.createGain();
    humGain.gain.value = 0.018;
    [50, 100, 150.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = [1, 0.5, 0.2][i];
      o.connect(g).connect(humGain);
      o.start();
    });
    humGain.connect(bus);

    // vítr – hnědý šum přes pásmovou propust modulovanou LFO
    const wind = ctx.createBufferSource();
    wind.buffer = this.brown;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.14;
    lfo.connect(lfoGain).connect(windGain.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 160;
    lfo2.connect(lfo2Gain).connect(bp.frequency);
    wind.connect(bp).connect(windGain).connect(bus);
    wind.start();
    lfo.start();
    lfo2.start();

    // tiché pokojové šumění
    const room = ctx.createBufferSource();
    room.buffer = this.white;
    room.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.006;
    room.connect(lp).connect(roomGain).connect(bus);
    room.start();

    this.ambientNodes = { bus };
  }
}

// ---------- generátory zvuků ----------
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function noiseHit(au, out, t, { freq = 800, type = 'lowpass', q = 0.7, peak = 0.5, a = 0.004, d = 0.1, buffer }) {
  const ctx = au.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buffer || au.white;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, a, peak, d);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + a + d + 0.05);
}

function tone(au, out, t, { freq = 440, to = null, type = 'sine', peak = 0.3, a = 0.005, d = 0.2 }) {
  const ctx = au.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  const g = ctx.createGain();
  env(g, t, a, peak, d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + d + 0.05);
}

const SOUNDS = {
  step(au, out, t) {
    noiseHit(au, out, t, { freq: 380 + Math.random() * 220, peak: 0.22, d: 0.09 });
    noiseHit(au, out, t + 0.02, { freq: 1800, type: 'bandpass', q: 1.5, peak: 0.03, d: 0.04 });
  },
  click(au, out, t) {
    noiseHit(au, out, t, { freq: 3200, type: 'highpass', peak: 0.35, a: 0.001, d: 0.02 });
    tone(au, out, t, { freq: 2100, peak: 0.08, a: 0.001, d: 0.03 });
    noiseHit(au, out, t + 0.05, { freq: 2600, type: 'highpass', peak: 0.12, a: 0.001, d: 0.015 });
  },
  flashlight(au, out, t) {
    noiseHit(au, out, t, { freq: 2400, type: 'bandpass', q: 3, peak: 0.25, a: 0.001, d: 0.03 });
    tone(au, out, t, { freq: 900, peak: 0.05, a: 0.001, d: 0.02 });
  },
  knock(au, out, t) {
    [0, 0.32, 0.6].forEach((dt, i) => {
      const p = i === 2 ? 1.0 : 0.8;
      tone(au, out, t + dt, { freq: 95, to: 60, peak: 0.9 * p, a: 0.002, d: 0.16 });
      noiseHit(au, out, t + dt, { freq: 420, peak: 0.7 * p, a: 0.001, d: 0.07 });
    });
  },
  buzz(au, out, t) {
    [0, 0.5].forEach((dt) => {
      const ctx = au.ctx;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 170;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.12, t + dt + 0.02);
      g.gain.setValueAtTime(0.12, t + dt + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.34);
      o.connect(lp).connect(g).connect(out);
      o.start(t + dt);
      o.stop(t + dt + 0.4);
    });
  },
  creak(au, out, t) {
    const ctx = au.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(48, t);
    o.frequency.linearRampToValueAtTime(74, t + 0.9);
    o.frequency.linearRampToValueAtTime(58, t + 2.2);
    const vib = ctx.createOscillator();
    vib.frequency.value = 13;
    const vibG = ctx.createGain();
    vibG.gain.value = 6;
    vib.connect(vibG).connect(o.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
    g.gain.setValueAtTime(0.45, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(bp).connect(g).connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + 2.5);
    vib.stop(t + 2.5);
  },
  wardrobe(au, out, t) {
    SOUNDS.creak(au, out, t);
    noiseHit(au, out, t + 0.05, { freq: 300, peak: 0.25, d: 0.12 });
  },
  locked(au, out, t) {
    [0, 0.09, 0.2, 0.27].forEach((dt) => {
      noiseHit(au, out, t + dt, { freq: 1500, type: 'bandpass', q: 2, peak: 0.3, a: 0.001, d: 0.04 });
      tone(au, out, t + dt, { freq: 140, peak: 0.15, a: 0.001, d: 0.05 });
    });
  },
  sting(au, out, t) {
    const ctx = au.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    g.connect(out);
    [41, 43.7, 61.5, 87].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(120, t);
      lp.frequency.linearRampToValueAtTime(600, t + 2);
      o.connect(lp).connect(g);
      o.start(t);
      o.stop(t + 5.6);
    });
    noiseHit(au, out, t, { freq: 2000, type: 'bandpass', q: 0.8, peak: 0.08, a: 1.6, d: 2.5, buffer: au.brown });
  },
  whoosh(au, out, t) {
    noiseHit(au, out, t, { freq: 700, type: 'bandpass', q: 0.9, peak: 0.25, a: 0.25, d: 0.5 });
  },
  heartbeat(au, out, t) {
    [0, 0.22, 0.9, 1.12, 1.8, 2.02].forEach((dt, i) => {
      tone(au, out, t + dt, { freq: 55, to: 38, peak: i % 2 ? 0.5 : 0.7, a: 0.004, d: 0.14 });
    });
  },
  thud(au, out, t) {
    tone(au, out, t, { freq: 70, to: 40, peak: 0.6, a: 0.003, d: 0.25 });
    noiseHit(au, out, t, { freq: 250, peak: 0.4, d: 0.12 });
  },
};

export const SOUND_NAMES = Object.keys(SOUNDS);
