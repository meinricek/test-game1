// Titulky / vnitřní monolog s psacím efektem. Řádky se řadí do fronty.
// Data: src/data/dialogues.json  ->  { "id": [ { "text": "...", "speaker": "...", "hold": 2 } ] }
export class DialogueSystem {
  constructor(ui, dialogues, { touch = false } = {}) {
    this.ui = ui;
    this.touch = touch;
    this.dialogues = dialogues;
    this.queue = [];
    this.current = null;
    this.cps = 34; // znaků za sekundu
  }

  /**
   * Spustí dialog podle id nebo pole řádků. Vrací Promise po dočtení všech řádků.
   * Výchozí chování: nový monolog přeruší rozpracovaný (titulky reagují hned).
   * S { queue: true } se řádky zařadí za aktuální.
   */
  say(idOrLines, { queue = false } = {}) {
    let lines = idOrLines;
    if (typeof idOrLines === 'string') {
      lines = this.dialogues[idOrLines];
      if (!lines) {
        console.warn(`[dialogue] neznámý dialog "${idOrLines}"`);
        return Promise.resolve();
      }
    }
    if (!Array.isArray(lines)) lines = [lines];
    if (!queue) this.clear();
    return new Promise((resolve) => {
      lines.forEach((l, i) => {
        const line = typeof l === 'string' ? { text: l } : { ...l };
        // varianta textu pro dotyková zařízení (např. jiný popis ovládání)
        if (this.touch && line.textTouch) line.text = line.textTouch;
        this.queue.push({ ...line, resolve: i === lines.length - 1 ? resolve : null });
      });
    });
  }

  clear() {
    for (const q of this.queue) q.resolve?.();
    this.current?.resolve?.();
    this.queue = [];
    this.current = null;
    this.ui.setSubtitle('');
  }

  update(dt) {
    if (!this.current) {
      if (!this.queue.length) return;
      const line = this.queue.shift();
      this.current = {
        ...line,
        shown: 0,
        hold: line.hold ?? 1.4 + line.text.length * 0.035,
        t: 0,
      };
    }
    const c = this.current;
    const total = c.text.length;
    if (c.shown < total) {
      c.shown = Math.min(total, c.shown + dt * this.cps);
      this._render(c);
    } else {
      c.t += dt;
      if (c.t >= c.hold) {
        this.current = null;
        this.ui.setSubtitle('');
        c.resolve?.();
      }
    }
  }

  _render(c) {
    const text = escapeHtml(c.text.slice(0, Math.floor(c.shown)));
    const speaker = c.speaker ? `<span class="speaker">${escapeHtml(c.speaker)}:</span> ` : '';
    this.ui.setSubtitle(`${speaker}<i>${text}</i>`);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}
