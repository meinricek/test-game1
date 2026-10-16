import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { EventBus } from './EventBus.js';
import { Input, isTouchDevice } from './Input.js';
import { Renderer } from './Renderer.js';
import { Player } from './Player.js';
import { Scheduler } from './Scheduler.js';
import { Settings } from './Settings.js';
import { setPS1Enabled } from './PS1.js';
import { UI } from '../ui/UI.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { EventSystem } from '../systems/EventSystem.js';
import { SCENES } from '../scenes/index.js';
import story from '../data/story.json';
import dialogues from '../data/dialogues.json';

/** Stav hry – příznaky (flags), které čtou podmínky a mění akce. */
class GameState {
  constructor(bus) {
    this.bus = bus;
    this.flags = {};
  }

  reset(initial = {}) {
    this.flags = { ...initial };
  }

  setFlag(name, value) {
    if (this.flags[name] === value) return;
    this.flags[name] = value;
    this.bus.emit('flag', { name, value });
  }
}

// Hlavní třída: drží systémy pohromadě, řídí smyčku, pauzu a načítání scén.
export class Game {
  constructor(canvas) {
    this.touch = isTouchDevice();
    this.lowQuality = this.touch;
    this.bus = new EventBus();
    this.settings = new Settings();
    this.scheduler = new Scheduler();
    this.state = new GameState(this.bus);

    this.renderer = new Renderer(canvas, { lowQuality: this.lowQuality });
    this.camera = new THREE.PerspectiveCamera(CONFIG.render.fov, 16 / 9, 0.05, 120);
    this.input = new Input(canvas, { touch: this.touch });
    this.ui = new UI(this.settings, { touch: this.touch });
    this.audio = new AudioSystem(this.bus);
    this.player = new Player(this.camera, this.input, this.bus, { lowQuality: this.lowQuality });
    this.dialogue = new DialogueSystem(this.ui, dialogues, { touch: this.touch });
    this.objectives = new ObjectiveSystem(this.bus, this.ui, this.scheduler);
    this.interaction = new InteractionSystem(this.bus, this.camera);
    this.events = new EventSystem(this);
    this.conditionContext = { state: this.state, objectives: this.objectives };
    this.ui.onDeviceSound = (name) => this.audio.play(name, { volume: 0.7 });

    this.mode = 'title'; // title | playing | paused | ended
    this.timer = new THREE.Timer();
    this.timer.connect?.(document);
    this.time = 0;
    this.playTime = 0;
    this.fps = { frames: 0, acc: 0, value: 0 };

    this._applySettings();
    this.settings.onChange(() => this._applySettings());
    this._bindInput();

    window.addEventListener('resize', () => this.renderer.resize(this.camera));
    this.renderer.resize(this.camera);

    this.loadScene(story.startScene);
    this.ui.onStart(() => this.start());
    this.ui.onResume(() => this.resume());
    this.ui.onRestart(() => this.restart());

    this.renderer.gl.setAnimationLoop(() => this.frame());
  }

  _applySettings() {
    const s = this.settings;
    this.player.sensitivity = s.get('sensitivity');
    this.audio.setVolume(s.get('volume'));
    setPS1Enabled(s.get('ps1'));
    this.renderer.setPS1(s.get('ps1'));
  }

  _bindInput() {
    const inp = this.input;
    inp.on('interact', () => {
      if (this.mode !== 'playing') return;
      if (this.ui.deviceOpen) {
        if (this.ui.deviceReady) this.ui.closeDevice();
        return;
      }
      this.interaction.interact();
    });
    inp.on('click', () => {
      if (this.mode === 'playing' && this.ui.deviceOpen && this.ui.deviceReady) this.ui.closeDevice();
    });
    inp.on('flashlight', () => {
      if (this.mode === 'playing' && this.player.controlsEnabled) this.player.toggleFlashlight();
    });
    inp.on('pause', () => {
      if (this.mode === 'playing') {
        if (this.ui.deviceOpen) {
          if (this.ui.deviceReady) this.ui.closeDevice();
          return;
        }
        this.pause();
      } else if (this.mode === 'paused') this.resume();
    });
    inp.on('lockLost', () => {
      if (this.mode === 'playing') this.pause();
    });
    inp.on('fps', () => this.settings.set('showFps', !this.settings.get('showFps')));
  }

  // ---------- scény ----------
  loadScene(id) {
    const entry = SCENES[id];
    if (!entry) throw new Error(`Scéna "${id}" neexistuje`);
    if (this.scene) {
      this.scene.dispose();
      this.scene.root.remove(this.camera);
    }
    this.scheduler.clear();
    this.dialogue.clear();
    this.events.unload();

    const data = entry.data;
    this.state.reset(data.flags || {});
    this.scene = new entry.Scene(this, data);
    this.scene.build();
    this.scene.root.add(this.camera); // kvůli baterce (je dítětem kamery)
    this.player.setColliders(this.scene.colliders);
    this.player.spawn(data.spawn);
    this.player.controlsEnabled = true;
    this.interaction.enabled = true;
    this.objectives.load(data.objectives || [], this.conditionContext);
    this.interaction.load(data.interactables || [], this.scene, this.conditionContext);
    this.events.load(data.triggers || []);
    this.sceneStarted = false;
    // první render = kompilace shaderů ještě před startem
    this.renderer.gl.compile(this.scene.root, this.camera);
  }

  start() {
    this.audio.unlock();
    this.audio.setVolume(this.settings.get('volume'));
    this.ui.showGame();
    this.mode = 'playing';
    this.input.enabled = true;
    this.input.requestLock();
    if (!this.sceneStarted) {
      this.sceneStarted = true;
      this.events.start();
    }
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input.enabled = false;
    this.input.reset();
    this.input.releaseLock();
    this.audio.suspend(true);
    this.ui.showPause(true);
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.ui.showPause(false);
    this.mode = 'playing';
    this.input.enabled = true;
    this.audio.suspend(false);
    this.input.requestLock();
  }

  restart() {
    this.ui.showPause(false);
    this.ui.resetOverlays();
    this.audio.suspend(false);
    this.audio.ambient('off', 0.1);
    this.loadScene(this.scene.data.id);
    this.playTime = 0;
    this.mode = 'title';
    this.start();
  }

  endDemo(text, sub) {
    this.mode = 'ended';
    this.input.enabled = false;
    this.input.releaseLock();
    this.player.setFlashlight(false, true);
    this.ui.showEnd(text, sub);
    this.bus.emit('game:end', {});
  }

  // ---------- smyčka ----------
  frame() {
    this.timer.update();
    let dt = this.timer.getDelta();
    if (dt > 0.1) dt = 0.1;
    this.time += dt;

    this.fps.frames++;
    this.fps.acc += dt;
    if (this.fps.acc >= 0.5) {
      this.fps.value = Math.round(this.fps.frames / this.fps.acc);
      this.fps.frames = 0;
      this.fps.acc = 0;
      this.ui.setFps(this.fps.value);
    }

    if (this.mode === 'playing') {
      this.playTime += dt;
      this.scheduler.update(dt);
      this.player.update(dt, this.time);
      this.dialogue.update(dt);
      this.events.update(dt);
      this.scene.update(dt, this.time);
      const t = this.interaction.update();
      this.ui.setPrompt(this.ui.deviceOpen ? null : t?.text);
      this.ui.setRecTime(this.playTime);
    } else if (this.mode === 'title') {
      // pomalé "dýchání" kamery na titulní obrazovce
      this.player.update(0, this.time);
      this.scene.update(dt, this.time);
    }
    this.camera.updateMatrixWorld();
    this.audio.updateListener(this.camera);
    if (this.mode !== 'paused') this.renderer.render(this.scene.root, this.camera, this.time);
  }
}
