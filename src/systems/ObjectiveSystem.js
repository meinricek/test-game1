import { checkCondition } from './Conditions.js';

// Úkoly scény. Odemykají se postupně (vždy aktivní jen jeden), splní se buď akcí
// { "type": "objective", "complete": "id" }, nebo automaticky podmínkou "doneWhen".
export class ObjectiveSystem {
  constructor(bus, ui, scheduler) {
    this.bus = bus;
    this.scheduler = scheduler;
    this.ui = ui;
    this.list = [];
    bus.on('flag', () => this.evaluate());
  }

  load(defs, ctx) {
    this.ctx = ctx;
    this.list = defs.map((d) => ({ ...d, done: false, visible: false, isNew: false }));
    this.render();
  }

  get active() {
    return this.list.find((o) => o.visible && !o.done) || null;
  }

  isActive(id) {
    return this.active?.id === id;
  }

  isDone(id) {
    return !!this.list.find((o) => o.id === id)?.done;
  }

  allDone() {
    return this.list.length > 0 && this.list.every((o) => o.done);
  }

  /** Zobrazí další nesplněný úkol (volá se na startu scény a po splnění). */
  next() {
    if (this.active) return;
    const o = this.list.find((x) => !x.done && !x.visible);
    if (!o) return;
    o.visible = true;
    o.isNew = true;
    this.render();
    o.isNew = false;
    this.bus.emit('objective:start', { id: o.id });
    this.evaluate();
  }

  complete(id) {
    const o = this.list.find((x) => x.id === id);
    if (!o || o.done || !o.visible) return false;
    o.done = true;
    this.render();
    this.bus.emit('objective:complete', { id });
    if (this.allDone()) {
      this.bus.emit('objectives:allComplete', {});
    } else {
      this.scheduler.after(1.2, () => this.next());
    }
    return true;
  }

  evaluate() {
    const a = this.active;
    if (a?.doneWhen && checkCondition(a.doneWhen, this.ctx)) this.complete(a.id);
  }

  render() {
    this.ui.renderObjectives(this.list.filter((o) => o.visible));
  }
}
