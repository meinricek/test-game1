import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { checkCondition } from './Conditions.js';

const CENTER = new THREE.Vector2(0, 0);

// Míření na objekty paprskem ze středu obrazovky. Interaktivní objekty definuje scéna
// v JSONu ("interactables"), 3D objekt k nim přiřadí kód scény přes jméno.
export class InteractionSystem {
  constructor(bus, camera) {
    this.bus = bus;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CONFIG.player.interactDistance;
    this.items = [];
    this.meshes = [];
    this.occluders = [];
    this.target = null;
    this.enabled = true;
  }

  load(defs, scene, ctx) {
    this.ctx = ctx;
    this.items = [];
    this.meshes = [];
    for (const def of defs) {
      const obj = scene.getObject(def.object || def.id);
      if (!obj) {
        console.warn(`[interaction] objekt "${def.object || def.id}" ve scéně chybí`);
        continue;
      }
      const item = { def, obj };
      obj.traverse((m) => {
        if (m.isMesh) {
          m.userData.interactable = item;
          this.meshes.push(m);
        }
      });
      this.items.push(item);
    }
    // stěny a nábytek blokují míření skrz
    this.occluders = scene.occluders || [];
  }

  /** Text výzvy pro položku podle aktuálního stavu (může mít varianty s podmínkou). */
  promptFor(item) {
    const d = item.def;
    if (this.ctx.state.flags[`__disabled_${d.id}`]) return null;
    if (d.if && !checkCondition(d.if, this.ctx)) return null;
    if (d.prompts) {
      for (const p of d.prompts) {
        if (!p.if || checkCondition(p.if, this.ctx)) return p.text;
      }
      return null;
    }
    return d.prompt || null;
  }

  update() {
    this.target = null;
    if (!this.enabled) return null;
    this.raycaster.setFromCamera(CENTER, this.camera);
    const hits = this.raycaster.intersectObjects([...this.meshes, ...this.occluders], false);
    for (const h of hits) {
      if (!h.object.visible) continue;
      const item = h.object.userData.interactable;
      if (!item) break; // první zásah je stěna/nábytek
      const text = this.promptFor(item);
      if (text) this.target = { item, text };
      break;
    }
    return this.target;
  }

  interact() {
    if (!this.enabled || !this.target) return false;
    this.bus.emit('interact', { id: this.target.item.def.id });
    return true;
  }
}
