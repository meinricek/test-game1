// Nahraje plynulý průchod demem jako video (PC, 1280×720, 30 fps, se zvukem).
// Hra běží ve virtuálním čase: každý snímek se vyrenderuje a vyfotí zvlášť, takže video
// je plynulé i v headless Chromiu bez GPU. Zvuk se místo reproduktoru renderuje
// do OfflineAudioContext a na konci se přimíchá k videu (potřebuje ffmpeg).
// Použití:  npm run build && node scripts/record-video.mjs [výstup.mp4]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4174;
const URL = `http://localhost:${PORT}/`;
const FPS = 30;
const DT = 1000 / FPS;
const VIEW = { width: 1280, height: 720 };
const AUDIO_MAX_S = 260;
const OUT = path.resolve(process.argv[2] || 'video/pruchod.mp4');
const TMP_VIDEO = OUT.replace(/\.mp4$/, '.video.mp4');
const TMP_AUDIO = OUT.replace(/\.mp4$/, '.wav');
mkdirSync(path.dirname(OUT), { recursive: true });

// ---------------------------------------------------------------- virtuální čas (v prohlížeči)
// Běží před skripty hry: nahradí hodiny, časovače, rAF a AudioContext.
function installVirtualTime({ audioMax }) {
  const realSetTimeout = window.setTimeout.bind(window);
  let vnow = 0;
  const epoch = Date.now();
  const RealDate = Date;
  window.Date = class extends RealDate {
    constructor(...a) {
      if (a.length) super(...a);
      else super(epoch + vnow);
    }
    static now() {
      return epoch + vnow;
    }
  };
  performance.now = () => vnow;

  let nextId = 1;
  const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { id, at: vnow + Math.max(0, +ms || 0), fn, args });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const iv = Math.max(1, +ms || 0);
    timers.set(id, { id, at: vnow + iv, fn, args, iv });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const rafs = new Map();
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    rafs.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => rafs.delete(id);

  // CSS animace/přechody se posouvají ručně podle virtuálního času.
  const seen = new WeakMap();
  const syncAnimations = () => {
    for (const a of document.getAnimations()) {
      let start = seen.get(a);
      if (start === 'done') continue;
      if (start === undefined) {
        start = vnow;
        seen.set(a, start);
        a.pause();
      }
      const local = vnow - start;
      const end = a.effect?.getComputedTiming().endTime;
      if (Number.isFinite(end) && local >= end) {
        a.finish();
        seen.set(a, 'done');
      } else a.currentTime = local;
    }
  };
  const yieldReal = () => new Promise((r) => realSetTimeout(r, 0));

  // Zvuk: OfflineAudioContext, jehož currentTime ukazuje virtuální čas.
  let offline = null;
  let audioStart = null;
  function FakeAudioContext() {
    offline = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(44100 * audioMax), sampleRate: 44100 });
    audioStart = vnow;
    return new Proxy(offline, {
      get(target, prop) {
        if (prop === 'currentTime') return (vnow - audioStart) / 1000;
        if (prop === 'state') return 'running';
        if (prop === 'resume' || prop === 'suspend' || prop === 'close') return () => Promise.resolve();
        const v = Reflect.get(target, prop, target);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
  }
  window.AudioContext = window.webkitAudioContext = FakeAudioContext;

  let wav = null;
  window.__vt = {
    get now() {
      return vnow;
    },
    get audioStart() {
      return audioStart;
    },
    async step(dt) {
      const target = vnow + dt;
      for (;;) {
        let due = null;
        for (const t of timers.values()) {
          if (t.at <= target && (!due || t.at < due.at || (t.at === due.at && t.id < due.id))) due = t;
        }
        if (!due) break;
        vnow = Math.max(vnow, due.at);
        if (due.iv) due.at += due.iv;
        else timers.delete(due.id);
        try {
          if (typeof due.fn === 'function') due.fn(...due.args);
        } catch (e) {
          console.error(e);
        }
        await yieldReal();
      }
      vnow = target;
      syncAnimations();
      const cbs = [...rafs.values()];
      rafs.clear();
      for (const cb of cbs) cb(vnow);
      await yieldReal();
      syncAnimations();
    },
    /** Vyrenderuje zvuk do WAV (16 bit stereo), vrátí velikost v bajtech. */
    async renderAudio(endV) {
      if (!offline) return 0;
      const buf = await offline.startRendering();
      const frames = Math.min(buf.length, Math.ceil(((endV - audioStart) / 1000) * buf.sampleRate));
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      wav = new Uint8Array(44 + frames * 4);
      const v = new DataView(wav.buffer);
      const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF');
      v.setUint32(4, 36 + frames * 4, true);
      str(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 2, true);
      v.setUint32(24, buf.sampleRate, true);
      v.setUint32(28, buf.sampleRate * 4, true);
      v.setUint16(32, 4, true);
      v.setUint16(34, 16, true);
      str(36, 'data');
      v.setUint32(40, frames * 4, true);
      let peak = 0;
      for (let i = 0; i < frames; i++) {
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
        v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
        v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
      }
      console.log(`[audio] peak ${peak.toFixed(3)}`);
      return wav.length;
    },
    wavChunk(offset, size) {
      const part = wav.subarray(offset, offset + size);
      let s = '';
      for (let i = 0; i < part.length; i += 0x8000) s += String.fromCharCode.apply(null, part.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
}

// ---------------------------------------------------------------- server, prohlížeč, ffmpeg
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('server nenaběhl')), 20000);
  server.on('exit', (code) => reject(new Error(`vite preview skončil (kód ${code})`)));
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  });
});

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
await context.addInitScript(installVirtualTime, { audioMax: AUDIO_MAX_S });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  else if (m.text().startsWith('[audio]')) console.log(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const cdp = await context.newCDPSession(page);

const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', TMP_VIDEO,
], { stdio: ['pipe', 'inherit', 'inherit'] });

// ---------------------------------------------------------------- snímky a ovládání
let S = null; // poslední stav hry
let frames = 0;
let firstFrameV = null;
const t0 = Date.now();

/** Jeden snímek: nastaví ovládání, posune hru o 1/30 s a vyfotí obrazovku. */
async function frame(ctrl = {}) {
  S = await page.evaluate(
    async ({ c, dt }) => {
      const g = window.__game;
      const p = g.player;
      g.input.joy.x = c.joy ? c.joy[0] : 0;
      g.input.joy.y = c.joy ? c.joy[1] : 0;
      if (!p.override) {
        if (c.yaw != null) p.yaw = c.yaw;
        if (c.pitch != null) p.pitch = c.pitch;
      }
      await window.__vt.step(dt);
      const d = g.dialogue;
      return {
        ...window.__debug.state(),
        v: window.__vt.now,
        x: p.position.x,
        z: p.position.z,
        yaw: p.yaw,
        pitch: p.pitch,
        line: d.current?.text || null,
        talking: !!d.current || d.queue.length > 0,
      };
    },
    { c: ctrl, dt: DT },
  );
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
  if (firstFrameV === null) firstFrameV = S.v;
  if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await once(ff.stdin, 'drain');
  frames++;
  if (frames % (FPS * 10) === 0) {
    const real = (Date.now() - t0) / 1000;
    console.log(`  ${(frames / FPS).toFixed(0)} s videa (${real.toFixed(0)} s reálně)`);
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const deg = (d) => (d * Math.PI) / 180;

async function idle(seconds, ctrl = {}) {
  const n = Math.round(seconds * FPS);
  for (let i = 0; i < n; i++) await frame(ctrl);
}

async function until(desc, fn, maxSeconds = 20, ctrl = {}) {
  for (let i = 0; i < maxSeconds * FPS; i++) {
    if (fn(S)) return;
    await frame(ctrl);
  }
  throw new Error(`timeout: ${desc} :: ${JSON.stringify(S)}`);
}

/** Plynulé otočení pohledu (yaw/pitch v radiánech). */
async function turnTo(yaw, pitch, seconds = 1) {
  const from = { yaw: S.yaw, pitch: S.pitch };
  const dy = wrap(yaw - from.yaw);
  const n = Math.max(1, Math.round(seconds * FPS));
  for (let i = 1; i <= n; i++) {
    const k = ease(i / n);
    await frame({ yaw: from.yaw + dy * k, pitch: from.pitch + (pitch - from.pitch) * k });
  }
}

/** Úhly pohledu z aktuální pozice hráče na střed objektu. */
const aimAngles = (name) =>
  page.evaluate((name) => {
    const g = window.__game;
    const obj = g.scene.getObject(name);
    const box = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => {
      if (!o.geometry) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      for (const k of ['x', 'y', 'z']) {
        box.min[k] = Math.min(box.min[k], b.min[k]);
        box.max[k] = Math.max(box.max[k], b.max[k]);
      }
    });
    const c = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
    const p = g.player;
    const d = { x: c.x - p.position.x, y: c.y - p.height, z: c.z - p.position.z };
    const len = Math.hypot(d.x, d.y, d.z);
    return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y / len) };
  }, name);

async function lookAt(name, seconds = 0.9, pitchOffset = 0) {
  const a = await aimAngles(name);
  await turnTo(a.yaw, a.pitch + pitchOffset, seconds);
}

/** Chůze přes body [x, z]; pohled se plynule stáčí do směru chůze. */
async function walk(points, { speed = 0.72, pitch = deg(-7) } = {}) {
  let vel = 0;
  for (let i = 0; i < points.length; i++) {
    const [tx, tz] = points[i];
    const last = i === points.length - 1;
    for (let guard = 0; guard < FPS * 15; guard++) {
      const dx = tx - S.x;
      const dz = tz - S.z;
      const dist = Math.hypot(dx, dz);
      if (dist < (last ? 0.05 : 0.22)) break;
      const want = Math.atan2(-dx, -dz);
      const diff = wrap(want - S.yaw);
      const yaw = S.yaw + diff * Math.min(1, 5 / FPS);
      const p = S.pitch + (pitch - S.pitch) * Math.min(1, 3 / FPS);
      let mag = speed * Math.max(0.25, Math.cos(diff));
      if (last) mag *= Math.min(1, Math.max(0.3, dist / 0.45));
      vel += (mag - vel) * 0.12;
      // směr ve světě -> lokální osy joysticku (x = doprava, y = dopředu)
      const wx = dx / dist;
      const wz = dz / dist;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const jx = wx * cos - wz * sin;
      const jz = -(wx * sin + wz * cos);
      await frame({ yaw, pitch: p, joy: [jx * vel, jz * vel] });
    }
  }
  // dobrzdění
  await idle(0.15);
}

async function use(expectPrompt) {
  if (S.prompt !== expectPrompt) {
    await frame();
    if (S.prompt !== expectPrompt) throw new Error(`čekal jsem výzvu "${expectPrompt}", je "${S.prompt}"`);
  }
  await page.keyboard.press('KeyE');
  await frame();
}

const quiet = (max = 15) => until('ticho', (s) => !s.talking, max);

// ---------------------------------------------------------------- průchod
try {
  await page.goto(URL);
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.__debug && !!window.__vt)); i++) await sleep(100);
  // ambient: hodnotu hlasitosti si pamatujeme sami (OfflineAudioContext ji nevrací zpětně)
  await page.evaluate(() => {
    const a = window.__game.audio;
    let track = null;
    a.ambient = function (state, fade = 2) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (!this.ambientNodes) this._buildAmbient();
      const target = state === 'on' ? 1 : state === 'low' ? 0.35 : 0;
      let cur = 0;
      if (track) cur = t >= track.t1 ? track.v1 : track.v0 + ((track.v1 - track.v0) * (t - track.t0)) / (track.t1 - track.t0);
      const g = this.ambientNodes.bus.gain;
      const t1 = t + Math.max(0.05, fade);
      g.cancelScheduledValues(t);
      g.setValueAtTime(cur, t);
      g.linearRampToValueAtTime(target, t1);
      track = { t0: t, v0: cur, t1, v1: target };
    };
  });

  console.log('úvodní obrazovka');
  await idle(4);
  await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
  await frame();
  if (S.mode !== 'playing') throw new Error('hra se nespustila');

  console.log('intro');
  await idle(2.6);
  await turnTo(deg(38), deg(-6), 2.6); // stůl s monitorem
  await idle(1.0);
  await turnTo(deg(-20), deg(-3), 2.0); // okno
  await until('telefon zavibroval', (s) => s.flags.phoneBuzzed, 6);
  await idle(0.4);
  await lookAt('phone', 1.0);
  await idle(0.8);

  console.log('telefon');
  await walk([[0.55, 0.62]]);
  await lookAt('phone', 0.7);
  await use('Zvednout telefon');
  await until('telefon otevřen', (s) => s.deviceReady, 12);
  await idle(2.6);
  await page.keyboard.press('KeyE');
  await until('úkol lampa', (s) => s.objectives[1].visible, 8);

  console.log('lampa');
  await idle(1.0);
  await lookAt('lamp', 1.1);
  await walk([[0.65, -0.5], [1.0, -0.95]]);
  await lookAt('lamp', 0.8);
  await quiet();
  await idle(0.4);
  await use('Zhasnout lampu');
  await until('nápověda k baterce', (s) => s.line?.startsWith('(Baterku'), 8);
  await idle(1.2);
  await page.keyboard.press('KeyF');
  await frame();

  console.log('plakát');
  await quiet();
  await lookAt('poster', 1.4);
  await until('monolog u plakátu', (s) => s.line?.startsWith('Sivý'), 5);
  await quiet();

  console.log('monitor');
  await lookAt('monitor', 1.3, deg(-8));
  await walk([[0.2, -0.7], [-0.65, -0.5]]);
  await lookAt('monitor', 0.8);
  await use('Podívat se na monitor');
  await until('monitor otevřen', (s) => s.deviceReady, 12);
  await idle(3.0);
  await page.keyboard.press('KeyE');
  await until('monolog o host_0', (s) => s.line?.includes('host_0'), 5);

  console.log('skříň');
  await idle(1.0);
  await walk([[-0.6, 0.35], [-1.1, 0.95]]);
  await lookAt('wardrobe', 0.9);
  await quiet();
  await use('Otevřít skříň');
  await idle(1.4);
  await turnTo(S.yaw, deg(5), 1.2);
  await quiet();

  console.log('dveře');
  await walk([[-0.4, 1.45], [0.3, 1.6]]);
  await lookAt('door', 0.8);
  await use('Otevřít dveře');
  await idle(2.5);

  console.log('okno');
  await walk([[0.45, 0.2], [0.6, -1.45]], { speed: 0.6 });
  await lookAt('window', 0.9);
  await quiet();
  await use('Podívat se z okna');
  await until('pohled z okna skončil', (s) => s.flags.lookedOutside && !s.override, 20);

  console.log('outro');
  // pomalu couvneme od okna
  for (let i = 0; i < FPS * 1.6; i++) await frame({ joy: [0, -0.3 * Math.sin((Math.PI * i) / (FPS * 1.6))] });
  await until('konec dema', (s) => s.mode === 'ended', 60);
  await idle(4.0);

  const endV = S.v;
  console.log(`hotovo: ${frames} snímků (${(frames / FPS).toFixed(1)} s)`);
  ff.stdin.end();
  await once(ff, 'exit');

  console.log('render zvuku…');
  const size = await page.evaluate((v) => window.__vt.renderAudio(v), endV);
  const audioDelay = Math.max(0, (await page.evaluate(() => window.__vt.audioStart)) - firstFrameV);
  const chunks = [];
  for (let off = 0; off < size; off += 4 << 20) {
    chunks.push(Buffer.from(await page.evaluate(([o, s]) => window.__vt.wavChunk(o, s), [off, 4 << 20]), 'base64'));
  }
  writeFileSync(TMP_AUDIO, Buffer.concat(chunks));

  console.log('spojuju video a zvuk…');
  const mux = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', TMP_VIDEO, '-i', TMP_AUDIO,
    '-filter_complex', `[1:a]adelay=${Math.round(audioDelay)}:all=1,apad[a]`, '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT,
  ], { stdio: 'inherit' });
  const [code] = await once(mux, 'exit');
  if (code !== 0) throw new Error('ffmpeg (mux) selhal');
  rmSync(TMP_VIDEO);
  rmSync(TMP_AUDIO);
  console.log(`video: ${OUT}`);
} catch (e) {
  console.error('CHYBA:', e.message);
  await cdp.send('Page.captureScreenshot', { format: 'png' }).then((s) => writeFileSync(OUT.replace(/\.mp4$/, '.chyba.png'), Buffer.from(s.data, 'base64'))).catch(() => {});
  process.exitCode = 1;
  ff.stdin.end();
}

const relevant = errors.filter((e) => !/GPU stall|GL_CLOSE_PATH|Automatic fallback to software WebGL/i.test(e));
if (relevant.length) console.error(`chyby/varování v konzoli:\n  ${relevant.join('\n  ')}`);
await browser.close();
server.kill();
process.exit(process.exitCode ?? 0);
