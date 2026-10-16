import * as THREE from 'three';
import { applyPS1 } from '../core/PS1.js';

/**
 * Základ každé místnosti. Potomek přepíše build() a pomocí helperů poskládá geometrii.
 * Objekty, na které odkazují data (interakce, akce, triggery), se registrují jménem.
 */
export class BaseScene {
  constructor(game, data) {
    this.game = game;
    this.data = data;
    this.lowQuality = game.lowQuality;
    this.root = new THREE.Scene();
    this.objects = new Map();
    this.colliders = [];
    this.occluders = [];
  }

  /** Přepiš v potomkovi. */
  build() {}

  /** Volá se každý snímek. */
  update() {}

  getObject(name) {
    return this.objects.get(name) || null;
  }

  register(name, obj) {
    obj.name = name;
    this.objects.set(name, obj);
    return obj;
  }

  // ---------- materiály ----------
  /**
   * Základní materiál povrchů. Na PC fyzikální MeshStandardMaterial (lesky od baterky,
   * realističtější světlo), na mobilu levnější MeshLambertMaterial.
   */
  mat(opts = {}) {
    const { roughness = 0.82, metalness = 0, ...rest } = opts;
    if (this.lowQuality) return applyPS1(new THREE.MeshLambertMaterial(rest));
    return applyPS1(new THREE.MeshStandardMaterial({ roughness, metalness, ...rest }));
  }

  basic(opts = {}) {
    return applyPS1(new THREE.MeshBasicMaterial(opts));
  }

  // ---------- geometrie ----------
  /**
   * Kvádr postavený "na zem": y je spodní hrana. uv = počet opakování textury na metr.
   * Volby: x,y,z, rx,ry,rz (stupně), parent, name, collider (bool|padding), occlude, shadow.
   */
  box(w, h, d, material, o = {}) {
    // větší plochy rozdělíme, aby affine warp textur nebyl přehnaný
    const seg = (v) => o.seg || Math.min(6, Math.max(1, Math.ceil(v / 0.5)));
    const geo = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
    if (o.uv) scaleBoxUV(geo, w, h, d, o.uv);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(o.x || 0, (o.y || 0) + h / 2, o.z || 0);
    mesh.rotation.set(deg(o.rx), deg(o.ry), deg(o.rz));
    return this._finish(mesh, o);
  }

  cyl(rTop, rBottom, h, material, o = {}) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, o.sides || 8, 1, o.open || false);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(o.x || 0, (o.y || 0) + h / 2, o.z || 0);
    mesh.rotation.set(deg(o.rx), deg(o.ry), deg(o.rz));
    return this._finish(mesh, o);
  }

  sphere(r, material, o = {}) {
    const geo = new THREE.SphereGeometry(r, o.sides || 8, o.rings || 6);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
    mesh.scale.set(...(o.scale || [1, 1, 1]));
    return this._finish(mesh, o);
  }

  /** Rovina (stěna/podlaha) rozdělená na segmenty kvůli affine warpu. */
  plane(w, h, material, o = {}) {
    const sx = o.segX ?? Math.max(1, Math.round(w * 2));
    const sy = o.segY ?? Math.max(1, Math.round(h * 2));
    const geo = new THREE.PlaneGeometry(w, h, sx, sy);
    if (o.uv) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * w * o.uv + (o.uvOffset?.[0] || 0), uv.getY(i) * h * o.uv + (o.uvOffset?.[1] || 0));
      }
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(o.x || 0, o.y || 0, o.z || 0);
    mesh.rotation.set(deg(o.rx), deg(o.ry), deg(o.rz));
    return this._finish(mesh, { occlude: true, castShadow: true, ...o });
  }

  group(o = {}) {
    const g = new THREE.Group();
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    g.rotation.set(deg(o.rx), deg(o.ry), deg(o.rz));
    (o.parent || this.root).add(g);
    if (o.name) this.register(o.name, g);
    return g;
  }

  _finish(mesh, o) {
    mesh.castShadow = o.castShadow ?? true;
    mesh.receiveShadow = o.receiveShadow ?? true;
    (o.parent || this.root).add(mesh);
    if (o.name) this.register(o.name, mesh);
    if (o.occlude !== false) this.occluders.push(mesh);
    if (o.collider) {
      mesh.updateWorldMatrix(true, false);
      this.colliderFromObject(mesh, typeof o.collider === 'number' ? o.collider : 0, o.name);
    }
    return mesh;
  }

  // ---------- kolize ----------
  addCollider(minX, maxX, minZ, maxZ, name = null) {
    const c = { minX, maxX, minZ, maxZ, name, disabled: false };
    this.colliders.push(c);
    return c;
  }

  colliderFromObject(obj, pad = 0, name = null) {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    return this.addCollider(b.min.x - pad, b.max.x + pad, b.min.z - pad, b.max.z + pad, name);
  }

  setColliderEnabled(name, on) {
    for (const c of this.colliders) if (c.name === name) c.disabled = !on;
  }

  dispose() {
    this.root.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}

function deg(v) {
  return THREE.MathUtils.degToRad(v || 0);
}

// Přepočítá UV kvádru tak, aby textura měla stálou hustotu (opakování na metr).
function scaleBoxUV(geo, w, h, d, density) {
  const uv = geo.attributes.uv;
  const faces = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  const perFace = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < perFace; i++) {
      const idx = f * perFace + i;
      uv.setXY(idx, uv.getX(idx) * faces[f][0] * density, uv.getY(idx) * faces[f][1] * density);
    }
  }
}
