import * as THREE from 'three';
import { checkCondition } from './Conditions.js';
import { ACTIONS } from './Actions.js';

const tmp = new THREE.Vector3();
const tmpBox = new THREE.Box3();

/**
 * Datově řízené události. Každý "trigger" ve scéně má:
 *   on:      spouštěč – { "type": "start" | "interact" | "objectiveComplete" | "allObjectivesComplete"
 *                          | "objectiveStart" | "flag" | "timer" | "lookAt" | "custom", ... }
 *   if:      volitelná podmínka (viz Conditions.js)
 *   once:    spustit jen jednou (výchozí: true, kromě "interact")
 *   actions: seznam akcí, které se provedou postupně (viz Actions.js)
 */
export class EventSystem {
  constructor(game) {
    this.game = game;
    this.triggers = [];
    this.unsubs = [];
  }

  load(defs) {
    this.unload();
    const g = this.game;
    this.triggers = defs.map((d, i) => ({
      id: d.id || `trigger_${i}`,
      def: d,
      once: d.once ?? d.on.type !== 'interact',
      fired: false,
      running: false,
      lookTime: 0,
    }));

    const sub = (type, fn) => this.unsubs.push(g.bus.on(type, fn));
    sub('interact', ({ id }) => this._fire('interact', (on) => on.target === id));
    sub('objective:complete', ({ id }) => this._fire('objectiveComplete', (on) => !on.id || on.id === id));
    sub('objective:start', ({ id }) => this._fire('objectiveStart', (on) => !on.id || on.id === id));
    sub('objectives:allComplete', () => this._fire('allObjectivesComplete', () => true));
    sub('flag', ({ name, value }) =>
      this._fire('flag', (on) => on.flag === name && (!('eq' in on) || on.eq === value)),
    );
    sub('custom', ({ name }) => this._fire('custom', (on) => on.name === name));

    // časovače od startu scény
    for (const t of this.triggers) {
      if (t.def.on.type === 'timer') {
        g.scheduler.after(t.def.on.seconds ?? 0, () => this._fire('timer', (on) => on === t.def.on));
      }
    }
  }

  start() {
    this._fire('start', () => true);
  }

  unload() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.triggers = [];
  }

  /** Najde odpovídající triggery, vyhodnotí podmínky NAJEDNOU a teprve pak spustí akce. */
  _fire(type, match) {
    const ctx = this.game.conditionContext;
    const ready = this.triggers.filter(
      (t) =>
        t.def.on.type === type &&
        !(t.once && t.fired) &&
        !t.running &&
        match(t.def.on) &&
        checkCondition(t.def.if, ctx),
    );
    for (const t of ready) this.run(t);
    return ready.length;
  }

  async run(t) {
    t.fired = true;
    t.running = true;
    const gen = this.game.scheduler.generation;
    try {
      await this.runActions(t.def.actions || [], gen);
    } catch (err) {
      console.error(`[events] chyba v triggeru "${t.id}"`, err);
    }
    t.running = false;
  }

  async runActions(actions, gen) {
    for (const a of actions) {
      if (gen !== this.game.scheduler.generation) return; // scéna byla restartována
      if (a.if && !checkCondition(a.if, this.game.conditionContext)) continue;
      const fn = ACTIONS[a.type];
      if (!fn) {
        console.warn(`[events] neznámá akce "${a.type}"`);
        continue;
      }
      const p = fn(this.game, a);
      if (a.wait !== false && p && typeof p.then === 'function') await p;
    }
  }

  /** Spouštěč "lookAt": hráč se dívá na objekt (v úhlu a vzdálenosti) po danou dobu. */
  update(dt) {
    const g = this.game;
    const cam = g.camera;
    for (const t of this.triggers) {
      const on = t.def.on;
      if (on.type !== 'lookAt' || (t.once && t.fired) || t.running) continue;
      const obj = g.scene.getObject(on.target);
      if (!obj) continue;
      tmpBox.setFromObject(obj).getCenter(tmp);
      const dist = tmp.distanceTo(cam.position);
      tmp.sub(cam.position).normalize();
      const fwd = cam.getWorldDirection(new THREE.Vector3());
      const angle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(fwd.dot(tmp), -1, 1)));
      const looking = angle < (on.angle ?? 12) && dist < (on.distance ?? 6) && !g.player.override;
      t.lookTime = looking ? t.lookTime + dt : 0;
      if (t.lookTime >= (on.seconds ?? 0.8) && checkCondition(t.def.if, g.conditionContext)) {
        t.lookTime = 0;
        this.run(t);
      }
    }
  }
}
