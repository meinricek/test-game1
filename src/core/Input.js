import { EventBus } from './EventBus.js';

export function isTouchDevice() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Sjednocený vstup: klávesnice + myš (pointer lock) a dotyk (joystick + rozhlížení).
// Ven posílá události: interact, flashlight, pause, fps, crouchToggle.
export class Input extends EventBus {
  constructor(canvas, { touch }) {
    super();
    this.canvas = canvas;
    this.touch = touch;
    this.keys = new Set();
    this.look = { x: 0, y: 0 };
    this.joy = { x: 0, y: 0 };
    this.crouchToggled = false;
    this.enabled = false; // pohyb/rozhlížení povoleno (hraje se)
    this.locked = false;
    this.lockWanted = false;
    this.dragging = null;

    this._bindKeyboard();
    this._bindMouse();
    if (touch) this._bindTouch();
  }

  // ---------- veřejné API ----------
  get move() {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.joy.x;
    z += this.joy.y;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  get running() {
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) return true;
    return Math.hypot(this.joy.x, this.joy.y) > 0.92;
  }

  get crouching() {
    return (
      this.crouchToggled ||
      this.keys.has('ControlLeft') ||
      this.keys.has('ControlRight') ||
      this.keys.has('KeyC')
    );
  }

  consumeLook() {
    const l = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return l;
  }

  requestLock() {
    if (this.touch) return;
    this.lockWanted = true;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // headless prohlížeč / nepodporováno – funguje i tažení myší
    }
  }

  releaseLock() {
    this.lockWanted = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  reset() {
    this.keys.clear();
    this.joy.x = this.joy.y = 0;
    this.look.x = this.look.y = 0;
  }

  // ---------- klávesnice ----------
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      switch (e.code) {
        case 'KeyE':
        case 'Enter':
          this.emit('interact');
          break;
        case 'KeyF':
          this.emit('flashlight');
          break;
        case 'KeyP':
          this.emit('fps');
          break;
        case 'Escape':
          // Při aktivním pointer locku Esc zachytí prohlížeč (viz pointerlockchange).
          if (!document.pointerLockElement) this.emit('pause');
          break;
        default:
          break;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ---------- myš ----------
  _bindMouse() {
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked && this.lockWanted) this.emit('lockLost');
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || this.touch) return;
      if (this.locked) {
        this.look.x += e.movementX;
        this.look.y += e.movementY;
      } else if (this.dragging) {
        this.look.x += e.clientX - this.dragging.x;
        this.look.y += e.clientY - this.dragging.y;
        this.dragging = { x: e.clientX, y: e.clientY };
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (!this.locked) {
        this.dragging = { x: e.clientX, y: e.clientY };
        if (this.enabled) this.requestLock();
      } else if (e.button === 0) {
        this.emit('click');
      }
    });
    window.addEventListener('mouseup', () => (this.dragging = null));
  }

  // ---------- dotyk ----------
  _bindTouch() {
    const joyZone = document.getElementById('joy-zone');
    const lookZone = document.getElementById('look-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const R = 52;
    let joyId = null;
    let joyOrigin = null;
    let lookId = null;
    let lookLast = null;

    joyZone.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId;
      joyOrigin = { x: e.clientX, y: e.clientY };
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      base.classList.remove('hidden');
      knob.style.transform = 'translate(0px, 0px)';
      joyZone.setPointerCapture?.(e.pointerId);
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - joyOrigin.x;
      let dy = e.clientY - joyOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R;
      this.joy.y = -dy / R;
    });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      this.joy.x = this.joy.y = 0;
      base.classList.add('hidden');
    };
    joyZone.addEventListener('pointerup', endJoy);
    joyZone.addEventListener('pointercancel', endJoy);

    lookZone.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId;
      lookLast = { x: e.clientX, y: e.clientY };
      lookZone.setPointerCapture?.(e.pointerId);
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId || !this.enabled) return;
      // dotyk potřebuje vyšší zesílení než myš
      this.look.x += (e.clientX - lookLast.x) * 2.2;
      this.look.y += (e.clientY - lookLast.y) * 2.2;
      lookLast = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e) => {
      if (e.pointerId === lookId) lookId = null;
    };
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    const button = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn(el);
      });
    };
    button('btn-use', () => this.emit('interact'));
    button('btn-light', () => this.emit('flashlight'));
    button('btn-pause', () => this.emit('pause'));
    button('btn-crouch', (el) => {
      this.crouchToggled = !this.crouchToggled;
      el.classList.toggle('on', this.crouchToggled);
    });
  }
}
