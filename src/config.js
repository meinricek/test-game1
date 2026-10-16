// Globální konfigurace hry. Název a základní parametry se mění tady.
export const CONFIG = {
  title: 'Noční směna',
  subtitle: 'demo',
  startText: 'Klepni pro start',
  storageKey: 'nocni-smena.settings.v2',

  render: {
    // Výchozí (moderní) režim: skoro nativní rozlišení, vyhlazování, měkké stíny.
    // Násobek rozlišení obrazovky (PC / mobil) a strop pro výšku obrazu v px.
    scale: 1,
    mobileScale: 0.7,
    maxPixelRatio: 1.5,
    maxHeight: 1080,
    // Retro (PS1) režim: vnitřní výška obrazu, šířka se dopočítá podle poměru stran.
    retroHeight: 270,
    // Mřížka pro PS1 vertex snapping (menší číslo = větší "třes").
    snapResolution: [240, 135],
    fov: 70,
  },

  // Post-process pro moderní režim: čistý obraz, jen jemné zrno kamery a vinětace.
  post: {
    grain: 0.035,
    vignette: 0.45,
    chromaticAberration: 0.0012,
    saturation: 0.78,
    // Studený tón (násobí výslednou barvu).
    tint: [0.92, 0.97, 1.04],
    contrast: 1.05,
    exposure: 1.25,
    colorLevels: 32,
  },

  // Přepisy post-processu pro retro (PS1) režim.
  postRetro: {
    grain: 0.075,
    vignette: 0.55,
    chromaticAberration: 0.006,
    saturation: 0.55,
    tint: [0.86, 0.95, 1.08],
    contrast: 1.12,
    exposure: 1.0,
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
    ps1: false,
    showFps: false,
  },
};
