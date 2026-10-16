import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { registerTexture } from './Textures.js';

// Načítání externích assetů (CC0 modely a textury z /public). Vše se cachuje,
// takže restart scény už nic znovu nestahuje.
const BASE = import.meta.env.BASE_URL;
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const models = new Map();
const textures = new Map();

/**
 * manifest = {
 *   models: ['bedSingle', ...]                     -> public/models/<name>.glb
 *   textures: { floor: 'laminate_floor_02', ... }  -> public/textures/<id>_diff.jpg (+ _nor_gl.jpg)
 *   normals: ['laminate_floor_02', ...]            -> které textury mají normálovou mapu
 * }
 */
export async function loadAssets(manifest = {}, onProgress = () => {}) {
  const jobs = [];
  for (const name of manifest.models || []) {
    if (models.has(name)) continue;
    jobs.push(
      gltfLoader.loadAsync(`${BASE}models/${name}.glb`).then((g) => {
        g.scene.updateMatrixWorld(true);
        models.set(name, g.scene);
      }),
    );
  }
  const normals = new Set(manifest.normals || []);
  for (const id of new Set(Object.values(manifest.textures || {}))) {
    jobs.push(loadTex(`${id}_diff`, true));
    if (normals.has(id)) jobs.push(loadTex(`${id}_nor_gl`, false));
  }
  let done = 0;
  await Promise.all(
    jobs.map((j) =>
      j.then(() => {
        done++;
        onProgress(done / jobs.length);
      }),
    ),
  );
}

function loadTex(file, color) {
  if (textures.has(file)) return Promise.resolve();
  return texLoader.loadAsync(`${BASE}textures/${file}.jpg`).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    registerTexture(t);
    textures.set(file, t);
  });
}

/** Textura z Poly Haven (barva). Vrací klon kvůli vlastnímu opakování. */
export function getTexture(id, kind = 'diff') {
  const t = textures.get(`${id}_${kind}`);
  return t || null;
}

export function getModel(name) {
  const m = models.get(name);
  if (!m) throw new Error(`Model "${name}" není načtený (chybí v manifestu scény?)`);
  return m;
}
