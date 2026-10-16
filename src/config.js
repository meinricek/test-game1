// Globální konfigurace hry. Název a základní parametry se mění tady.
export const CONFIG = {
  title: 'Noční směna',
  subtitle: 'demo',
  startText: 'Klepni pro start',
  storageKey: 'nocni-smena.settings.v1',

  render: {
    // Cílová výška vnitřního rozlišení (šířka se dopočítá podle poměru stran).
    // Na výšku orientovaném displeji se 270 použije pro kratší stranu.
    baseHeight: 270,
    // Mřížka pro PS1 vertex snapping (menší číslo = větší "třes").
    snapResolution: [240, 135],
    fov: 70,
  },

  post: {
    grain: 0.075,
    vignette: 0.55,
    chromaticAberration: 0.006,
    saturation: 0.55,
    // Studený tón (násobí výslednou barvu).
    tint: [0.86, 0.95, 1.08],
    contrast: 1.12,
    // Barevná hloubka (jen se zapnutým PS1 efektem) – 32 úrovní = 15bit barvy.
    colorLevels: 32,
  },

  player: {
    height: 1.6,
    crouchHeight: 1.05,
    radius: 0.24,
    walkSpeed: 1.55,
    runMultiplier: 1.7,
    crouchMultiplier: 0.5,
    interactDistance: 2.1,
    bobAmount: 0.028,
    bobSpeed: 9.0,
  },

  defaults: {
    sensitivity: 1.0,
    volume: 0.8,
    ps1: true,
    showFps: false,
  },
};
