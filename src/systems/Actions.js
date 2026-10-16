import * as THREE from 'three';
import { EASE } from '../core/Scheduler.js';

const deg = THREE.MathUtils.degToRad;

function getObj(game, name) {
  const o = game.scene.getObject(name);
  if (!o) console.warn(`[actions] objekt "${name}" neexistuje`);
  return o;
}

function worldPos(obj) {
  const v = new THREE.Vector3();
  if (!obj) return v;
  const box = new THREE.Box3().setFromObject(obj);
  return box.isEmpty() ? obj.getWorldPosition(v) : box.getCenter(v);
}

/**
 * Knihovna akcí pro datově řízené události. Každá akce dostane (game, data) a může
 * vrátit Promise – sekvence na ni počká (pokud v datech není "wait": false).
 * Přidání nové akce = nová položka v tomto objektu.
 */
export const ACTIONS = {
  /** { "type": "wait", "seconds": 1.5 } */
  wait: (g, a) => g.scheduler.wait(a.seconds ?? 1),

  /** { "type": "sound", "name": "knock", "at": "door", "volume": 1 } */
  sound: (g, a) => {
    const at = a.at ? worldPos(getObj(g, a.at)) : null;
    g.audio.play(a.name, { volume: a.volume ?? 1, at });
  },

  /** { "type": "ambient", "state": "on" | "low" | "off", "fade": 2 } */
  ambient: (g, a) => {
    g.audio.ambient(a.state, a.fade ?? 2);
    if (a.fade && a.waitFade) return g.scheduler.wait(a.fade);
    return null;
  },

  /**
   * { "type": "monologue", "dialogue": "id" }  nebo  { "type": "monologue", "text": "..." }
   * "queue": true = počká, až doběhne aktuální monolog (jinak ho přeruší)
   */
  monologue: (g, a) =>
    g.dialogue.say(a.dialogue ?? [{ text: a.text, speaker: a.speaker, hold: a.hold }], { queue: !!a.queue }),

  /** { "type": "objective", "complete": "id" }  /  { "type": "objective", "next": true } */
  objective: (g, a) => {
    if (a.complete) g.objectives.complete(a.complete);
    if (a.next) g.objectives.next();
  },

  /** { "type": "flag", "name": "lampOn", "value": false }  nebo  "toggle": true */
  flag: (g, a) => {
    const v = a.toggle ? !g.state.flags[a.name] : (a.value ?? true);
    g.state.setFlag(a.name, v);
  },

  /** { "type": "light", "target": "lampLight", "on": false, "duration": 0.1, "flicker": 0.6 } */
  light: async (g, a) => {
    const light = getObj(g, a.target);
    if (!light) return;
    const base = light.userData.baseIntensity ?? light.intensity;
    light.userData.baseIntensity = base;
    let to = a.intensity ?? (a.on === false ? 0 : base);
    if (a.toggle) to = light.intensity > 0.001 ? 0 : base;
    if (a.flicker) {
      const end = g.scheduler.time + a.flicker;
      while (g.scheduler.time < end) {
        light.intensity = Math.random() < 0.5 ? 0 : base * (0.4 + Math.random() * 0.6);
        await g.scheduler.wait(0.04 + Math.random() * 0.08);
      }
    }
    // světlo nikdy nevypínáme přes "visible" – změna počtu světel = rekompilace shaderů
    const from = light.intensity;
    if (a.duration) await g.scheduler.tween(a.duration, (k) => (light.intensity = from + (to - from) * k));
    else light.intensity = to;
    g.scene.onLightChanged?.(a.target, to > 0.001);
  },

  /** { "type": "emissive", "target": "lampShade", "on": false } – svítící materiál (stínítko, displej) */
  emissive: (g, a) => {
    const obj = getObj(g, a.target);
    obj?.traverse((m) => {
      if (!m.material || !('emissiveIntensity' in m.material)) return;
      m.userData.baseEmissive ??= m.material.emissiveIntensity;
      m.material.emissiveIntensity = a.on === false ? 0 : m.userData.baseEmissive;
    });
  },

  /**
   * { "type": "animate", "target": "door", "position": [x,y,z], "rotation": [x,y,z] (stupně),
   *   "relative": false, "duration": 2, "ease": "inOut" }
   */
  animate: (g, a) => {
    const obj = getObj(g, a.target);
    if (!obj) return null;
    const p0 = obj.position.clone();
    const r0 = obj.rotation.clone();
    const p1 = a.position ? new THREE.Vector3(...a.position) : p0.clone();
    const r1 = a.rotation ? new THREE.Euler(deg(a.rotation[0]), deg(a.rotation[1]), deg(a.rotation[2])) : r0.clone();
    if (a.relative) {
      if (a.position) p1.add(p0);
      if (a.rotation) r1.set(r0.x + r1.x, r0.y + r1.y, r0.z + r1.z);
    }
    return g.scheduler.tween(
      a.duration ?? 1,
      (k) => {
        obj.position.lerpVectors(p0, p1, k);
        obj.rotation.set(r0.x + (r1.x - r0.x) * k, r0.y + (r1.y - r0.y) * k, r0.z + (r1.z - r0.z) * k);
        g.scene.onObjectMoved?.(a.target);
      },
      EASE[a.ease || 'inOut'],
    );
  },

  /** { "type": "visible", "target": "silhouette", "value": true } */
  visible: (g, a) => {
    const obj = getObj(g, a.target);
    if (obj) obj.visible = a.value ?? true;
  },

  /** { "type": "fade", "to": 1, "duration": 2 } – 1 = černá */
  fade: (g, a) => g.ui.fade(a.to ?? 1, a.duration ?? 1),

  /** { "type": "text", "text": "...", "duration": 3 } – velký text uprostřed */
  text: (g, a) => g.ui.bigText(a.text, a.duration ?? 3),

  /** { "type": "lookAt", "target": "window", "duration": 1.2 } – otočí pohled hráče */
  lookAt: (g, a) => g.player.lookAt(worldPos(getObj(g, a.target)), a.duration ?? 1),

  /**
   * { "type": "focusCamera", "anchor": "windowView", "look": "windowLook",
   *   "duration": 1.2, "hold": 3, "fov": 55, "during": [ ...akce během držení... ] }
   */
  focusCamera: (g, a) => {
    const anchor = getObj(g, a.anchor);
    const look = getObj(g, a.look);
    if (!anchor || !look) return null;
    g.interaction.enabled = false;
    return g.player
      .focus(anchor.getWorldPosition(new THREE.Vector3()), look.getWorldPosition(new THREE.Vector3()), {
        duration: a.duration ?? 1,
        hold: a.hold ?? 2,
        fov: a.fov,
        onHold: a.during ? () => g.events.runActions(a.during, g.scheduler.generation) : null,
      })
      .then(() => {
        g.interaction.enabled = true;
      });
  },

  /** { "type": "lockPlayer" } / { "type": "unlockPlayer" } – vypne/zapne pohyb a interakce */
  lockPlayer: (g) => {
    g.player.controlsEnabled = false;
    g.interaction.enabled = false;
  },
  unlockPlayer: (g) => {
    g.player.controlsEnabled = true;
    g.interaction.enabled = true;
  },

  /** { "type": "flashlight", "on": true } */
  flashlight: (g, a) => g.player.setFlashlight(a.on ?? true, a.silent ?? false),

  /** { "type": "device", "id": "phone" } – otevře telefon/monitor z "devices" ve scéně, čeká na zavření */
  device: async (g, a) => {
    const def = g.scene.data.devices?.[a.id];
    if (!def) {
      console.warn(`[actions] zařízení "${a.id}" neexistuje`);
      return;
    }
    g.player.controlsEnabled = false;
    g.interaction.enabled = false;
    await g.ui.openDevice(def);
    g.player.controlsEnabled = true;
    g.interaction.enabled = true;
  },

  /** { "type": "shake", "intensity": 0.02, "duration": 0.5 } */
  shake: (g, a) =>
    g.scheduler.tween(a.duration ?? 0.5, (k) => (g.player.shake = (a.intensity ?? 0.02) * (1 - k)), EASE.linear),

  /** { "type": "flash", "intensity": 0.4, "duration": 0.3 } – krátké zablesknutí obrazu */
  flash: (g, a) =>
    g.scheduler.tween(a.duration ?? 0.3, (k) => (g.renderer.postMaterial.uniforms.uFlash.value = (a.intensity ?? 0.3) * (1 - k))),

  /** { "type": "interactable", "id": "door", "enabled": false } */
  interactable: (g, a) => g.state.setFlag(`__disabled_${a.id}`, a.enabled === false),

  /** { "type": "emit", "name": "mujEvent" } – spustí triggery s on.type = "custom" */
  emit: (g, a) => g.bus.emit('custom', { name: a.name }),

  /** { "type": "collider", "target": "door", "enabled": false } */
  collider: (g, a) => g.scene.setColliderEnabled(a.target, a.enabled !== false),

  /** { "type": "end", "text": "Konec dema", "sub": "..." } */
  end: (g, a) => g.endDemo(a.text, a.sub),

  /** { "type": "scene", "id": "hallway" } – přechod do jiné scény */
  scene: async (g, a) => {
    await g.loadScene(a.id);
    g.startScene();
  },
};
