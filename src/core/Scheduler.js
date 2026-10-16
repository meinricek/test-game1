export const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// Časovače v herním čase – během pauzy stojí (na rozdíl od setTimeout).
export class Scheduler {
  constructor() {
    this.time = 0;
    this.tasks = [];
    this.tweens = [];
    this.generation = 0;
  }

  update(dt) {
    this.time += dt;
    if (this.tweens.length) {
      for (const tw of [...this.tweens]) {
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.duration);
        tw.fn(tw.ease(k));
        if (k >= 1) {
          this.tweens.splice(this.tweens.indexOf(tw), 1);
          tw.resolve();
        }
      }
    }
    if (!this.tasks.length) return;
    const due = this.tasks.filter((t) => t.at <= this.time);
    if (!due.length) return;
    this.tasks = this.tasks.filter((t) => t.at > this.time);
    for (const t of due) t.fn();
  }

  after(seconds, fn) {
    const task = { at: this.time + seconds, fn };
    this.tasks.push(task);
    return task;
  }

  wait(seconds) {
    return new Promise((resolve) => this.after(seconds, resolve));
  }

  /** Plynulá změna: fn(k) dostává k = 0..1 (s easingem). */
  tween(duration, fn, ease = EASE.inOut) {
    return new Promise((resolve) => {
      this.tweens.push({ t: 0, duration: Math.max(0.0001, duration), fn, ease, resolve });
    });
  }

  /** Zruší všechny čekající časovače (restart scény). Čekající sekvence se už neprobudí. */
  clear() {
    this.tasks = [];
    this.tweens = [];
    this.generation++;
  }
}
