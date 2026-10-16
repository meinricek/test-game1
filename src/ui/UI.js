import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

// Veškeré HTML UI nad canvasem: úvodní obrazovka, HUD, pauza, telefon/monitor, fade, konec.
export class UI {
  constructor(settings, { touch }) {
    this.settings = settings;
    this.touch = touch;
    this.el = {
      hud: $('hud'),
      objectives: $('objectives'),
      crosshair: $('crosshair'),
      prompt: $('prompt'),
      subtitles: $('subtitles'),
      fps: $('fps'),
      recTime: $('rec-time'),
      touch: $('touch'),
      useBtn: $('btn-use'),
      device: $('device'),
      deviceTitle: $('device-title'),
      deviceClock: $('device-clock'),
      deviceBody: $('device-body'),
      deviceHint: $('device-hint'),
      fade: $('fade'),
      bigtext: $('bigtext'),
      title: $('title'),
      pause: $('pause'),
      end: $('end'),
    };
    $('title-name').textContent = CONFIG.title;
    $('title-sub').textContent = CONFIG.subtitle;
    $('title-start').textContent = CONFIG.startText;
    document.title = CONFIG.title;
    $('title-controls').innerHTML = touch
      ? 'Levý palec: chůze &middot; pravý palec: rozhlížení<br>Použít / Baterka: tlačítka vpravo'
      : 'WASD chůze &middot; myš rozhlížení &middot; Shift rychleji &middot; Ctrl/C přikrčení<br>E interakce &middot; F baterka &middot; Esc pauza &middot; P FPS';
    this.deviceResolve = null;
    this._bindPause();
  }

  // ---------- obrazovky ----------
  onStart(fn) {
    const go = (e) => {
      e.preventDefault();
      this.el.title.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      fn();
    };
    this.el.title.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  }

  showGame() {
    this.el.title.classList.add('hidden');
    this.el.end.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.el.touch.classList.toggle('hidden', !this.touch);
  }

  showPause(on) {
    this.el.pause.classList.toggle('hidden', !on);
    if (on) this._syncPause();
  }

  get paused() {
    return !this.el.pause.classList.contains('hidden');
  }

  showEnd(text, sub) {
    $('end-text').textContent = text || 'Konec dema';
    $('end-sub').textContent = sub || '';
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.end.classList.remove('hidden');
  }

  onRestart(fn) {
    $('end-restart').addEventListener('click', fn);
    $('pause-restart').addEventListener('click', fn);
  }

  onResume(fn) {
    $('pause-resume').addEventListener('click', fn);
  }

  _bindPause() {
    const s = this.settings;
    const sens = $('opt-sens');
    const vol = $('opt-vol');
    sens.addEventListener('input', () => {
      s.set('sensitivity', parseFloat(sens.value));
      this._syncPause();
    });
    vol.addEventListener('input', () => {
      s.set('volume', parseFloat(vol.value));
      this._syncPause();
    });
    $('opt-ps1').addEventListener('change', (e) => s.set('ps1', e.target.checked));
    $('opt-fps').addEventListener('change', (e) => s.set('showFps', e.target.checked));
    s.onChange((k, v) => {
      if (k === 'showFps') this.el.fps.classList.toggle('hidden', !v);
    });
    this.el.fps.classList.toggle('hidden', !s.get('showFps'));
  }

  _syncPause() {
    const s = this.settings;
    $('opt-sens').value = s.get('sensitivity');
    $('opt-vol').value = s.get('volume');
    $('opt-ps1').checked = s.get('ps1');
    $('opt-fps').checked = s.get('showFps');
    $('sens-val').textContent = Number(s.get('sensitivity')).toFixed(1);
    $('vol-val').textContent = `${Math.round(s.get('volume') * 100)} %`;
  }

  // ---------- HUD ----------
  setPrompt(text) {
    const has = !!text;
    if (this._prompt !== text) {
      this._prompt = text;
      const key = this.touch ? '' : '[E] ';
      this.el.prompt.textContent = has ? key + text : '';
      this.el.prompt.classList.toggle('hidden', !has);
      this.el.crosshair.classList.toggle('active', has);
      this.el.useBtn.disabled = !has;
      if (this.touch) this.el.useBtn.textContent = has ? 'Použít' : 'Použít';
    }
  }

  renderObjectives(list) {
    const html = ['<div class="head">ÚKOLY</div>'];
    for (const o of list) {
      html.push(`<div class="obj ${o.done ? 'done' : ''} ${o.isNew ? 'new' : ''}">${o.text}</div>`);
    }
    this.el.objectives.innerHTML = list.length ? html.join('') : '';
  }

  setFps(fps) {
    this.el.fps.textContent = `${fps} FPS`;
  }

  setRecTime(seconds) {
    // záznam "kamery" začíná ve 2:47 ráno
    const s = Math.floor(seconds) + 2 * 3600 + 47 * 60;
    const pad = (n) => String(n).padStart(2, '0');
    this.el.recTime.textContent = `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }

  // ---------- titulky ----------
  setSubtitle(html) {
    this.el.subtitles.innerHTML = html;
  }

  // ---------- telefon / monitor ----------
  /** Otevře modální "zařízení". Vrací Promise, který se splní po zavření. */
  openDevice({ mode = 'phone', title = '', clock = '', items = [] }) {
    const el = this.el;
    el.device.classList.toggle('screen-mode', mode === 'screen');
    el.deviceTitle.textContent = title;
    el.deviceClock.textContent = clock;
    el.deviceBody.innerHTML = '';
    el.deviceHint.textContent = this.touch ? 'Klepni pro zavření' : '[E] Zavřít';
    el.device.classList.remove('hidden');
    this.deviceOpen = true;
    this.deviceReady = false;

    const run = async () => {
      for (const it of items) {
        await wait(it.delay ?? 0.35);
        if (!this.deviceOpen) return;
        const div = document.createElement('div');
        if (it.sep) {
          div.className = 'sep';
          div.textContent = it.sep;
        } else if (mode === 'screen') {
          div.className = 'line';
          div.textContent = it.text;
        } else {
          div.className = `msg ${it.kind || ''}`;
          div.innerHTML = `${it.from ? `<span class="from">${it.from}</span>` : ''}${it.text}`;
        }
        el.deviceBody.appendChild(div);
        el.deviceBody.scrollTop = el.deviceBody.scrollHeight;
        if (it.sound) this.onDeviceSound?.(it.sound);
      }
      this.deviceReady = true;
    };
    run();

    return new Promise((resolve) => {
      this.deviceResolve = resolve;
      // zavření klepnutím (s malou prodlevou, ať se hned nezavře)
      setTimeout(() => {
        const close = () => {
          el.device.removeEventListener('pointerdown', close);
          this.closeDevice();
        };
        el.device.addEventListener('pointerdown', close);
        this._deviceTapClose = close;
      }, 400);
    });
  }

  closeDevice() {
    if (!this.deviceOpen) return;
    this.deviceOpen = false;
    this.el.device.classList.add('hidden');
    if (this._deviceTapClose) this.el.device.removeEventListener('pointerdown', this._deviceTapClose);
    const r = this.deviceResolve;
    this.deviceResolve = null;
    r?.();
  }

  // ---------- fade / velký text ----------
  fade(to, duration) {
    const f = this.el.fade;
    f.style.transition = `opacity ${duration}s linear`;
    // reflow, aby se transition spustila
    void f.offsetWidth;
    f.style.opacity = String(to);
    return wait(duration);
  }

  async bigText(text, duration) {
    const b = this.el.bigtext;
    b.textContent = text;
    b.style.opacity = '0';
    b.style.transition = 'opacity 1s';
    b.classList.remove('hidden');
    void b.offsetWidth;
    b.style.opacity = '1';
    if (duration > 0) {
      await wait(duration);
      b.style.opacity = '0';
      await wait(1);
      b.classList.add('hidden');
    }
  }

  resetOverlays() {
    this.el.fade.style.transition = 'none';
    this.el.fade.style.opacity = '0';
    this.el.bigtext.classList.add('hidden');
    this.closeDevice();
    this.setSubtitle('');
    this.setPrompt(null);
  }
}
