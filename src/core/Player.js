import * as THREE from 'three';
import { CONFIG } from '../config.js';

const tmpV = new THREE.Vector3();
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Hráč z pohledu první osoby: pohyb, kolize (kruh vs. AABB v rovině XZ), přikrčení,
// head bob, baterka a "kamerové jízdy" pro skriptované momenty.
export class Player {
  constructor(camera, input, bus, { lowQuality }) {
    this.camera = camera;
    this.input = input;
    this.bus = bus;
    this.cfg = CONFIG.player;
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.height = this.cfg.height;
    this.sensitivity = 1;
    this.controlsEnabled = true;
    this.colliders = [];
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.shake = 0;
    this.override = null; // aktivní kamerová jízda

    camera.rotation.order = 'YXZ';

    // Baterka – kužel světla připevněný ke kameře.
    this.flashlight = new THREE.SpotLight(0xdfe8ff, 0, 9, 0.42, 0.55, 1.6);
    this.flashlight.position.set(0.12, -0.12, 0.05);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(lowQuality ? 256 : 512, lowQuality ? 256 : 512);
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 9;
    this.flashlight.shadow.bias = -0.002;
    this.flashlight.target.position.set(0.05, -0.05, -1);
    camera.add(this.flashlight);
    camera.add(this.flashlight.target);
    this.flashlightOn = false;
    this.flashlightPower = 18;
  }

  setColliders(list) {
    this.colliders = list;
  }

  spawn({ position, yaw = 0, pitch = 0 }) {
    this.position.set(position[0], 0, position[2]);
    this.yaw = THREE.MathUtils.degToRad(yaw);
    this.pitch = THREE.MathUtils.degToRad(pitch);
    this.height = this.cfg.height;
    this.override = null;
    this.setFlashlight(false, true);
    this._applyCamera(0);
  }

  setFlashlight(on, silent = false) {
    this.flashlightOn = on;
    this.flashlight.intensity = on ? this.flashlightPower : 0;
    if (!silent) this.bus.emit('sound', { name: 'flashlight' });
  }

  toggleFlashlight() {
    this.setFlashlight(!this.flashlightOn);
  }

  update(dt, time) {
    if (this.override) {
      this._updateOverride(dt);
      return;
    }
    const input = this.input;
    if (this.controlsEnabled) {
      const look = input.consumeLook();
      const k = 0.0022 * this.sensitivity;
      this.yaw -= look.x * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * k, -1.45, 1.45);
    } else {
      input.consumeLook();
    }

    const crouch = this.controlsEnabled && input.crouching;
    const targetH = crouch ? this.cfg.crouchHeight : this.cfg.height;
    this.height += (targetH - this.height) * Math.min(1, dt * 10);

    let moving = false;
    if (this.controlsEnabled) {
      const m = input.move;
      const amount = Math.hypot(m.x, m.z);
      if (amount > 0.05) {
        let speed = this.cfg.walkSpeed;
        if (crouch) speed *= this.cfg.crouchMultiplier;
        else if (input.running) speed *= this.cfg.runMultiplier;
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        // dopředu = -Z v lokálních souřadnicích kamery
        const dx = (m.x * cos - m.z * sin) * speed * dt;
        const dz = (-m.x * sin - m.z * cos) * speed * dt;
        this._moveAndCollide(dx, dz);
        moving = true;
        const prev = this.bobPhase;
        this.bobPhase += dt * this.cfg.bobSpeed * (speed / this.cfg.walkSpeed) * 0.75 * Math.min(1, amount + 0.3);
        // krok při každém "dopadu" hlavy
        if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) {
          this.bus.emit('sound', { name: 'step', volume: crouch ? 0.35 : input.running ? 1 : 0.65 });
        }
      }
    }
    this.bobAmp += ((moving ? 1 : 0) - this.bobAmp) * Math.min(1, dt * 6);
    this._applyCamera(time);
  }

  _applyCamera(time) {
    const bob = this.cfg.bobAmount * this.bobAmp;
    const breathe = Math.sin(time * 1.3) * 0.004;
    this.camera.position.set(
      this.position.x + Math.cos(this.yaw) * Math.sin(this.bobPhase) * bob * 0.6,
      this.height + Math.abs(Math.cos(this.bobPhase)) * bob - bob * 0.5 + breathe,
      this.position.z - Math.sin(this.yaw) * Math.sin(this.bobPhase) * bob * 0.6,
    );
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
    }
    this.camera.rotation.set(
      this.pitch + sy + Math.sin(time * 0.7) * 0.003,
      this.yaw + sx,
      Math.sin(this.bobPhase) * 0.006 * this.bobAmp,
    );
  }

  _moveAndCollide(dx, dz) {
    const r = this.cfg.radius;
    this.position.x += dx;
    this._resolve(r);
    this.position.z += dz;
    this._resolve(r);
  }

  _resolve(r) {
    const p = this.position;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.colliders) {
        if (b.disabled) continue;
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.z += (dz / d) * (r - d);
        } else {
          // střed uvnitř boxu – vytlačíme nejkratší cestou
          const pushes = [
            [b.minX - r - p.x, 0],
            [b.maxX + r - p.x, 0],
            [0, b.minZ - r - p.z],
            [0, b.maxZ + r - p.z],
          ];
          pushes.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
          p.x += pushes[0][0];
          p.z += pushes[0][1];
        }
      }
    }
  }

  // ---------- skriptované pohledy ----------

  /** Plynule otočí pohled hráče na bod ve světě. */
  lookAt(point, duration = 1) {
    const from = { yaw: this.yaw, pitch: this.pitch };
    const eye = tmpV.set(this.position.x, this.height, this.position.z);
    const dir = new THREE.Vector3().subVectors(point, eye).normalize();
    let yaw = Math.atan2(-dir.x, -dir.z);
    // nejkratší otočení
    while (yaw - from.yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - from.yaw < -Math.PI) yaw += Math.PI * 2;
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    return new Promise((resolve) => {
      this.override = { kind: 'turn', from, to: { yaw, pitch }, t: 0, duration: Math.max(0.01, duration), resolve };
    });
  }

  /** Přesune kameru na kotvu (např. k oknu), podrží a vrátí zpět. */
  focus(position, lookTarget, { duration = 1, hold = 2, fov = null, onHold = null } = {}) {
    const startPos = this.camera.position.clone();
    const startQuat = this.camera.quaternion.clone();
    const startFov = this.camera.fov;
    const m = new THREE.Matrix4().lookAt(position, lookTarget, new THREE.Vector3(0, 1, 0));
    const endQuat = new THREE.Quaternion().setFromRotationMatrix(m);
    return new Promise((resolve) => {
      this.override = {
        kind: 'focus',
        phase: 0,
        t: 0,
        duration: Math.max(0.01, duration),
        hold,
        startPos,
        startQuat,
        startFov,
        endPos: position.clone(),
        endQuat,
        endFov: fov ?? startFov,
        onHold,
        resolve,
      };
    });
  }

  _updateOverride(dt) {
    const o = this.override;
    this.input.consumeLook();
    o.t += dt;
    if (o.kind === 'turn') {
      const k = ease(Math.min(1, o.t / o.duration));
      this.yaw = o.from.yaw + (o.to.yaw - o.from.yaw) * k;
      this.pitch = o.from.pitch + (o.to.pitch - o.from.pitch) * k;
      this._applyCamera(0);
      if (o.t >= o.duration) {
        this.override = null;
        o.resolve();
      }
      return;
    }
    // focus: 0 = tam, 1 = držení, 2 = zpět
    const cam = this.camera;
    // baterka těsně u skla by jen oslepila – ztlumíme ji
    if (this.flashlightOn) this.flashlight.intensity = this.flashlightPower * 0.08;
    if (o.phase === 0 || o.phase === 2) {
      let k = ease(Math.min(1, o.t / o.duration));
      if (o.phase === 2) k = 1 - k;
      cam.position.lerpVectors(o.startPos, o.endPos, k);
      cam.quaternion.slerpQuaternions(o.startQuat, o.endQuat, k);
      cam.fov = o.startFov + (o.endFov - o.startFov) * k;
      cam.updateProjectionMatrix();
      if (o.t >= o.duration) {
        o.t = 0;
        if (o.phase === 0) {
          o.phase = 1;
          o.holdPromise = Promise.resolve(o.onHold ? o.onHold() : null);
        } else {
          cam.fov = o.startFov;
          cam.updateProjectionMatrix();
          this.override = null;
          cam.rotation.order = 'YXZ';
          if (this.flashlightOn) this.flashlight.intensity = this.flashlightPower;
          o.resolve();
        }
      }
    } else if (o.phase === 1) {
      // jemné "dýchání" kamery při držení
      cam.position.y = o.endPos.y + Math.sin(o.t * 1.4) * 0.004;
      if (o.t >= o.hold && !o.waiting) {
        o.waiting = true;
        o.holdPromise.then(() => {
          o.phase = 2;
          o.t = 0;
        });
      }
    }
  }
}
