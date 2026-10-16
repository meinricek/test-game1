import { CONFIG } from '../config.js';

// Nastavení hráče, ukládané do localStorage (pokud je dostupné).
export class Settings {
  constructor() {
    this.values = { ...CONFIG.defaults };
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch {
      // Soukromý režim / zablokované úložiště – jedeme s výchozími hodnotami.
    }
    this.listeners = new Set();
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    this.values[key] = value;
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.values));
    } catch {
      // ignorujeme
    }
    for (const fn of this.listeners) fn(key, value);
  }

  onChange(fn) {
    this.listeners.add(fn);
  }
}
