import * as THREE from 'three';
import { Game } from './core/Game.js';

const canvas = document.getElementById('view');
const game = new Game(canvas);

// Ladicí přístup z konzole a pro automatické testy (scripts/playtest.mjs).
window.__game = game;
window.__debug = {
  /** Přesune hráče (x, z) a nastaví pohled (stupně). */
  teleport(x, z, yaw = 0, pitch = 0) {
    game.player.position.set(x, 0, z);
    game.player.yaw = THREE.MathUtils.degToRad(yaw);
    game.player.pitch = THREE.MathUtils.degToRad(pitch);
  },
  /** Natočí pohled přímo na střed pojmenovaného objektu. */
  aim(name) {
    const obj = game.scene.getObject(name);
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    const p = game.player;
    const eye = new THREE.Vector3(p.position.x, p.height, p.position.z);
    const d = c.sub(eye).normalize();
    p.yaw = Math.atan2(-d.x, -d.z);
    p.pitch = Math.asin(d.y);
  },
  state() {
    return {
      mode: game.mode,
      flags: { ...game.state.flags },
      objectives: game.objectives.list.map((o) => ({ id: o.id, visible: o.visible, done: o.done })),
      prompt: game.interaction.target?.text || null,
      deviceOpen: !!game.ui.deviceOpen,
      deviceReady: !!game.ui.deviceReady,
      override: !!game.player.override,
      fps: game.fps.value,
    };
  },
};
