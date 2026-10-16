import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';
import { Textures } from '../core/Textures.js';

// Teenage pokoj v noci. Rozměry: x -2..2, z -2.5..2.5, výška 2.6 m.
// Sever (z = -2.5) = okno, jih (z = 2.5) = dveře do chodby + skříň, východ = postel, západ = stůl.
const W = 4;
const D = 5;
const H = 2.6;
const WIN = { x0: 0, x1: 1.2, y0: 0.9, y1: 2.0 };
const DOOR = { x0: -0.15, x1: 0.75, h: 2.05 };

export class BedroomScene extends BaseScene {
  // Externí CC0 assety (public/models, public/textures), načtou se před build().
  static assets = {
    models: [
      'bedSingle', 'cabinetBedDrawerTable', 'lampRoundTable', 'desk', 'chairDesk', 'computerKeyboard',
      'computerMouse', 'computerScreen', 'books', 'pottedPlant', 'plantSmall1', 'trashcan',
      'cardboardBoxOpen', 'speakerSmall',
    ],
    textures: {
      wall: 'decrepit_wallpaper',
      floor: 'laminate_floor_02',
      ceiling: 'beige_wall_001',
      wood: 'dark_wood',
      blanket: 'fabric_pattern_07',
      sheet: 'cotton_jersey',
      carpet: 'dirty_carpet',
      curtain: 'velour_velvet',
    },
    normals: ['decrepit_wallpaper', 'laminate_floor_02', 'dark_wood', 'dirty_carpet'],
  };

  build() {
    const s = this.root;
    s.background = new THREE.Color(0x020306);
    s.fog = new THREE.FogExp2(0x05070b, 0.032);

    this.m = {
      wall: this.texMat('decrepit_wallpaper', { normal: 0.7 }),
      floor: this.texMat('laminate_floor_02', { roughness: 0.55, normal: 0.6 }),
      ceiling: this.texMat('beige_wall_001', { roughness: 0.95 }),
      wood: this.texMat('dark_wood', { roughness: 0.6, normal: 0.5 }),
      woodDark: this.texMat('dark_wood', { color: 0x7a6a5c, roughness: 0.6, normal: 0.5 }),
      woodLight: this.texMat('dark_wood', { color: 0xf0dcc4, roughness: 0.6, normal: 0.5 }),
      blanket: this.texMat('fabric_pattern_07', { roughness: 0.95, color: 0xd0c8c8 }),
      sheet: this.texMat('cotton_jersey', { roughness: 0.95, color: 0xe8e4dc }),
      curtain: this.texMat('velour_velvet', { roughness: 0.9, color: 0x9a7070 }),
      carpet: this.texMat('dirty_carpet', { roughness: 1, color: 0xc8a090, normal: 0.7 }),
      darkPlastic: this.mat({ color: 0x1c1d20, roughness: 0.5 }),
      greyMetal: this.mat({ color: 0x6d7276, roughness: 0.45, metalness: 0.5 }),
      plant: this.mat({ color: 0x2f4a2a, roughness: 0.8 }),
      white: this.mat({ color: 0xc8c6bc }),
      trim: this.mat({ color: 0xb9b5a8 }),
      black: this.mat({ color: 0x151517 }),
      plastic: this.mat({ color: 0xbdb7a4 }),
      metal: this.mat({ map: Textures.metal(), metalness: 0.6, roughness: 0.45 }),
    };

    this.buildRoom();
    this.buildWindow();
    this.buildDoorAndHallway();
    this.buildBed();
    this.buildDesk();
    this.buildWardrobe();
    this.buildClutter();
    this.buildOutside();
    this.buildLights();
  }

  // ---------------------------------------------------------------- místnost
  buildRoom() {
    const { wall, floor, ceiling, woodDark } = this.m;
    this.plane(W, D, floor, { rx: -90, uv: 0.6, segX: 8, segY: 10, castShadow: false });
    this.plane(W, D, ceiling, { rx: 90, y: H, uv: 0.5 });
    const wallOpt = (o) => ({ uv: 0.7, ...o });

    // západ + východ
    this.plane(D, H, wall, wallOpt({ x: -W / 2, y: H / 2, ry: 90 }));
    this.plane(D, H, wall, wallOpt({ x: W / 2, y: H / 2, ry: -90 }));

    // sever s otvorem pro okno
    const zN = -D / 2;
    this.plane(WIN.x0 + 2, H, wall, wallOpt({ x: (-2 + WIN.x0) / 2, y: H / 2, z: zN }));
    this.plane(2 - WIN.x1, H, wall, wallOpt({ x: (WIN.x1 + 2) / 2, y: H / 2, z: zN }));
    this.plane(WIN.x1 - WIN.x0, WIN.y0, wall, wallOpt({ x: (WIN.x0 + WIN.x1) / 2, y: WIN.y0 / 2, z: zN }));
    this.plane(WIN.x1 - WIN.x0, H - WIN.y1, wall, wallOpt({ x: (WIN.x0 + WIN.x1) / 2, y: (WIN.y1 + H) / 2, z: zN }));

    // jih s otvorem pro dveře
    const zS = D / 2;
    this.plane(DOOR.x0 + 2, H, wall, wallOpt({ x: (-2 + DOOR.x0) / 2, y: H / 2, z: zS, ry: 180 }));
    this.plane(2 - DOOR.x1, H, wall, wallOpt({ x: (DOOR.x1 + 2) / 2, y: H / 2, z: zS, ry: 180 }));
    this.plane(DOOR.x1 - DOOR.x0, H - DOOR.h, wall, wallOpt({ x: (DOOR.x0 + DOOR.x1) / 2, y: (DOOR.h + H) / 2, z: zS, ry: 180 }));

    // kolize stěn (s rezervou za stěnou)
    this.addCollider(-3, -W / 2, -3, 3);
    this.addCollider(W / 2, 3, -3, 3);
    this.addCollider(-3, 3, -3, -D / 2);
    this.addCollider(-3, DOOR.x0, D / 2, 3);
    this.addCollider(DOOR.x1, 3, D / 2, 3);

    // lišty
    const bb = { castShadow: false, occlude: false };
    this.box(W, 0.08, 0.02, woodDark, { ...bb, z: zN + 0.01 });
    this.box(0.02, 0.08, D, woodDark, { ...bb, x: -W / 2 + 0.01 });
    this.box(0.02, 0.08, D, woodDark, { ...bb, x: W / 2 - 0.01 });
    this.box(DOOR.x0 + 2, 0.08, 0.02, woodDark, { ...bb, x: (-2 + DOOR.x0) / 2, z: zS - 0.01 });
    this.box(2 - DOOR.x1, 0.08, 0.02, woodDark, { ...bb, x: (DOOR.x1 + 2) / 2, z: zS - 0.01 });

    // stropní světlo (vypnuté)
    this.cyl(0.2, 0.16, 0.06, this.m.white, { y: H - 0.06, castShadow: false });
  }

  // ---------------------------------------------------------------- okno
  buildWindow() {
    const { trim } = this.m;
    const g = this.group({ name: 'window' });
    const z = -D / 2 - 0.06;
    const dz = 0.16;
    const o = { parent: g };
    // rám
    this.box(0.07, WIN.y1 - WIN.y0, dz, trim, { ...o, x: WIN.x0 + 0.035, y: WIN.y0, z });
    this.box(0.07, WIN.y1 - WIN.y0, dz, trim, { ...o, x: WIN.x1 - 0.035, y: WIN.y0, z });
    this.box(WIN.x1 - WIN.x0, 0.06, dz, trim, { ...o, x: 0.6, y: WIN.y1 - 0.06, z });
    // parapet vystupuje do pokoje
    this.box(WIN.x1 - WIN.x0 + 0.16, 0.04, 0.3, trim, { ...o, x: 0.6, y: WIN.y0 - 0.04, z: -D / 2 + 0.02 });
    // příčky
    this.box(0.04, WIN.y1 - WIN.y0, 0.04, trim, { ...o, x: 0.6, y: WIN.y0, z: z - 0.02 });
    this.box(WIN.x1 - WIN.x0, 0.04, 0.04, trim, { ...o, x: 0.6, y: 1.58, z: z - 0.02 });
    // sklo
    const glass = this.basic({ color: 0x6f86a8, transparent: true, opacity: 0.08, depthWrite: false });
    this.plane(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, glass, {
      ...o,
      x: 0.6,
      y: (WIN.y0 + WIN.y1) / 2,
      z: z - 0.03,
      segX: 1,
      segY: 1,
      castShadow: false,
      receiveShadow: false,
    });

    // záclony + tyč
    const curtain = this.m.curtain;
    this.box(0.36, 1.6, 0.05, curtain, { x: WIN.x0 - 0.2, y: 0.72, z: -D / 2 + 0.08, uv: 2 });
    this.box(0.36, 1.6, 0.05, curtain, { x: WIN.x1 + 0.2, y: 0.72, z: -D / 2 + 0.08, uv: 2 });
    this.cyl(0.012, 0.012, 1.9, this.m.metal, { x: 0.6, y: 2.36, z: -D / 2 + 0.08, rz: 90, castShadow: false, occlude: false });

    // kotvy pro "pohled z okna"
    const view = new THREE.Object3D();
    view.position.set(0.88, 1.42, -D / 2 + 0.3);
    this.root.add(view);
    this.register('windowView', view);
    const look = new THREE.Object3D();
    look.position.set(2.2, 1.3, -12);
    this.root.add(look);
    this.register('windowLook', look);

    // kytka na parapetu (Kenney)
    this.model('plantSmall1', { fit: { h: 0.24 }, x: 0.2, y: WIN.y0, z: -D / 2 + 0.08, materials: this.kenney(), occlude: false });
  }

  // ---------------------------------------------------------------- dveře + chodba
  buildDoorAndHallway() {
    const { trim } = this.m;
    const zS = D / 2;
    // zárubeň
    this.box(0.06, DOOR.h, 0.18, trim, { x: DOOR.x0 - 0.03, z: zS });
    this.box(0.06, DOOR.h, 0.18, trim, { x: DOOR.x1 + 0.03, z: zS });
    this.box(DOOR.x1 - DOOR.x0 + 0.12, 0.06, 0.18, trim, { x: (DOOR.x0 + DOOR.x1) / 2, y: DOOR.h, z: zS });

    // křídlo dveří na pantu
    const pivot = this.group({ name: 'doorPivot', x: DOOR.x0 + 0.01, z: zS });
    const dw = DOOR.x1 - DOOR.x0 - 0.02;
    const doorMat = this.mat({ map: Textures.door() });
    const door = this.box(dw, DOOR.h - 0.01, 0.04, doorMat, { parent: pivot, x: dw / 2, z: 0 });
    const handle = this.mat({ color: 0x9a9384 });
    this.box(0.11, 0.02, 0.025, handle, { parent: pivot, x: dw - 0.12, y: 1.0, z: -0.04 });
    this.box(0.11, 0.02, 0.025, handle, { parent: pivot, x: dw - 0.12, y: 1.0, z: 0.04 });
    this.register('door', pivot);
    this.doorMesh = door;
    this.addCollider(DOOR.x0, DOOR.x1, zS - 0.05, zS + 0.1, 'door');

    // chodba – box viděný zevnitř
    const hallMat = this.texMat('decrepit_wallpaper', { side: THREE.BackSide, color: 0x9a8f80 });
    const hall = this.box(4, H, 4, hallMat, { x: 0.3, z: zS + 2.05, uv: 1 });
    hall.castShadow = false;
    // obraz na konci chodby
    const frame = this.mat({ color: 0x2a1d14 });
    this.box(0.5, 0.65, 0.03, frame, { x: 0.3, y: 1.25, z: zS + 4.02 });
    const pic = this.basic({ color: 0x1a1414 });
    this.plane(0.4, 0.55, pic, { x: 0.3, y: 1.575, z: zS + 4.0, ry: 180, segX: 1, segY: 1 });
  }

  /** Mapování materiálů Kenney modelů (ploché barvy) na naše texturované materiály. */
  kenney(extra = {}) {
    const m = this.m;
    return {
      wood: m.wood,
      woodDark: m.woodDark,
      metal: m.greyMetal,
      metalMedium: m.greyMetal,
      metalDark: m.darkPlastic,
      carpet: m.blanket,
      carpetDarker: m.blanket,
      carpetWhite: m.sheet,
      plant: m.plant,
      _defaultMat: m.greyMetal,
      ...extra,
    };
  }

  // ---------------------------------------------------------------- postel + noční stolek
  buildBed() {
    // postel (Kenney bedSingle) – čelo je na -Z, tedy u severní stěny
    const bed = this.model('bedSingle', { name: 'bed', fit: { d: 2.05 }, x: 1.45, z: 0.93, materials: this.kenney(), uv: 1.4 });
    this.alignBox(bed, { maxX: W / 2 - 0.02 });
    this.colliderFromObject(bed, 0, 'bed');
    const bedBox = new THREE.Box3().setFromObject(bed);
    const bx = (bedBox.min.x + bedBox.max.x) / 2;

    // telefon na posteli (svítící displej)
    const py = this.surfaceY(bed, bx - 0.2, 0.5, 0.5);
    const phone = this.group({ name: 'phone', x: bx - 0.2, y: py, z: 0.5, ry: 25 });
    this.box(0.075, 0.012, 0.15, this.m.black, { parent: phone, occlude: false });
    this.phoneScreenMat = new THREE.MeshBasicMaterial({ map: Textures.phoneScreen(), color: 0x666666 });
    this.plane(0.065, 0.135, this.phoneScreenMat, { parent: phone, y: 0.0131, rx: -90, segX: 1, segY: 1, castShadow: false, occlude: false });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    phone.add(hit);

    // noční stolek (Kenney) – šuplíkem do pokoje
    const ns = { x: 1.72, z: -0.42 };
    const stand = this.model('cabinetBedDrawerTable', { name: 'nightstand', fit: { w: 0.48 }, ry: -90, x: ns.x, z: ns.z, materials: this.kenney(), uv: 2 });
    this.alignBox(stand, { maxX: W / 2 - 0.02, maxZ: bedBox.min.z - 0.03 });
    this.colliderFromObject(stand, 0, 'nightstand');
    const sb = new THREE.Box3().setFromObject(stand);
    ns.x = (sb.min.x + sb.max.x) / 2;
    ns.z = (sb.min.z + sb.max.z) / 2;
    const top = this.surfaceY(stand, ns.x, ns.z, 0.55);
    this.lampPos = new THREE.Vector3(ns.x + 0.04, top, ns.z - 0.04);

    // lampa (Kenney lampRoundTable) – stínítko svítí
    const lamp = this.group({ name: 'lamp', x: this.lampPos.x, y: top, z: this.lampPos.z });
    this.lampShadeMat = this.mat({ color: 0xd9c49a, emissive: 0xffb060, emissiveIntensity: 0.55, side: THREE.DoubleSide, roughness: 0.9 });
    const brass = this.mat({ color: 0x8c7a4c, roughness: 0.4, metalness: 0.6 });
    const lampModel = this.model('lampRoundTable', {
      parent: lamp,
      fit: { h: 0.46 },
      materials: { lamp: this.lampShadeMat, metal: brass, default: brass },
      castShadow: false,
      occlude: false,
    });
    const lb = new THREE.Box3().setFromObject(lampModel);
    this.lampLightY = lb.min.y + (lb.max.y - lb.min.y) * 0.72;
    this.lampBulbMat = this.basic({ color: 0xfff1cf });
    const bulb = this.sphere(0.03, this.lampBulbMat, { parent: lamp, y: this.lampLightY - top, occlude: false });
    bulb.castShadow = false;
    const lampHit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
    lampHit.position.y = 0.22;
    lamp.add(lampHit);

    // budík
    const cx = ns.x - 0.1;
    const cz = ns.z + 0.12;
    this.box(0.12, 0.07, 0.05, this.m.black, { x: cx, y: top, z: cz, ry: -70, occlude: false });
    const digits = this.basic({ color: 0xff3020 });
    this.plane(0.09, 0.03, digits, { x: cx - 0.026, y: top + 0.038, z: cz - 0.01, ry: -70 - 90 + 180, segX: 1, segY: 1, castShadow: false, occlude: false });
  }

  // ---------------------------------------------------------------- stůl, PC, židle
  buildDesk() {
    const K = this.kenney();
    // stůl (Kenney desk) podél západní stěny, předkem do pokoje (+X)
    const desk = this.model('desk', { name: 'desk', fit: { w: 1.4 }, ry: 90, x: -1.6, z: -1.2, materials: { ...K, wood: this.m.woodLight }, uv: 1.2 });
    this.alignBox(desk, { minX: -W / 2 + 0.02 });
    this.colliderFromObject(desk, 0, 'desk');
    const db = new THREE.Box3().setFromObject(desk);
    const dTop = this.surfaceY(desk, (db.min.x + db.max.x) / 2, -1.2, 0.75);
    const front = db.max.x;

    // monitor (Kenney computerScreen) + displej s chatem
    const mon = this.group({ name: 'monitor', x: -1.78, y: dTop, z: -1.2 });
    const screenModel = this.model('computerScreen', {
      parent: mon,
      fit: { w: 0.56 },
      ry: 90,
      materials: { metal: this.m.darkPlastic, metalDark: this.m.darkPlastic, default: this.m.darkPlastic },
    });
    const mb = new THREE.Box3().setFromObject(screenModel);
    const mh = mb.max.y - mb.min.y;
    const mzc = (mb.min.z + mb.max.z) / 2;
    // přední plocha panelu (podstavec vystupuje dál, proto paprskem, ne z obálky)
    const sy = mb.min.y + mh * 0.62;
    const ray = new THREE.Raycaster(new THREE.Vector3(mb.max.x + 0.5, sy, mzc), new THREE.Vector3(-1, 0, 0));
    const panelX = ray.intersectObject(screenModel, true)[0]?.point.x ?? mb.max.x;
    this.monitorMat = new THREE.MeshBasicMaterial({ map: Textures.monitor() });
    this.plane((mb.max.z - mb.min.z) * 0.9, mh * 0.6, this.monitorMat, {
      parent: mon,
      x: panelX - mon.position.x + 0.02,
      y: sy - dTop,
      z: mzc - mon.position.z,
      ry: 90,
      segX: 1,
      segY: 1,
      castShadow: false,
    });

    // klávesnice, myš, repro (Kenney)
    const keys = { metalDark: this.mat({ color: 0x18191b, roughness: 0.95 }), metalMedium: this.mat({ color: 0x2c2e31, roughness: 0.95 }) };
    this.model('computerKeyboard', { fit: { w: 0.44 }, ry: 90, x: front - 0.2, y: dTop, z: -1.2, materials: keys, occlude: false });
    this.model('computerMouse', { fit: { d: 0.1 }, ry: 90, x: front - 0.2, y: dTop, z: -0.85, materials: K, occlude: false });
    this.model('speakerSmall', { fit: { h: 0.2 }, ry: 90, x: -1.86, y: dTop, z: -0.82, materials: { ...K, wood: this.m.darkPlastic }, occlude: false });
    this.model('speakerSmall', { fit: { h: 0.2 }, ry: 90, x: -1.86, y: dTop, z: -1.6, materials: { ...K, wood: this.m.darkPlastic }, occlude: false });

    const mug = this.mat({ color: 0x7a2f2a, roughness: 0.35 });
    this.cyl(0.042, 0.038, 0.1, mug, { x: front - 0.12, y: dTop, z: -0.66, sides: 10, occlude: false, name: 'mug' });
    this.box(0.012, 0.05, 0.03, mug, { x: front - 0.075, y: dTop + 0.025, z: -0.66, occlude: false });
    const paper = this.mat({ color: 0xd8d4c4 });
    this.box(0.22, 0.004, 0.3, paper, { x: -1.6, y: dTop + 0.001, z: -1.68, ry: 12, occlude: false });
    this.box(0.22, 0.004, 0.3, paper, { x: -1.58, y: dTop + 0.005, z: -1.62, ry: -7, occlude: false });

    // židle (Kenney chairDesk) otočená ke stolu
    const chair = this.model('chairDesk', {
      name: 'chair',
      fit: { h: 1.0 },
      ry: -100,
      x: -0.95,
      z: -1.15,
      materials: { ...K, carpet: this.mat({ color: 0x2a2c30, roughness: 0.9 }) },
    });
    this.addCollider(-1.22, -0.72, -1.4, -0.9, 'chair');
    void chair;

    // polička s knihami nad stolem
    this.bookMats = {
      carpet: this.mat({ color: 0x6a2626, roughness: 0.8 }),
      carpetDarker: this.mat({ color: 0x2a3550, roughness: 0.8 }),
      carpetWhite: this.mat({ color: 0xcfc8b8, roughness: 0.8 }),
      plant: this.mat({ color: 0x2f4a32, roughness: 0.8 }),
      metal: this.mat({ color: 0x8a7a5a, roughness: 0.8 }),
      default: this.mat({ color: 0x555555 }),
    };
    this.box(0.24, 0.03, 1.1, this.m.woodLight, { x: -1.88, y: 1.45, z: -1.2, uv: 1.5 });
    for (const [z, ry] of [[-1.6, 90], [-1.25, 90], [-0.9, 80]]) {
      this.model('books', { fit: { h: 0.22 }, ry, x: -1.89, y: 1.48, z, materials: this.bookMats, occlude: false });
    }

    // plakát s hvězdami
    this.plane(0.55, 0.55, this.mat({ map: Textures.stars() }), { x: -W / 2 + 0.01, y: 1.55, z: 0.45, ry: 90, segX: 1, segY: 1, castShadow: false });

    // koš u stolu
    this.model('trashcan', { fit: { h: 0.36 }, x: -1.78, z: -0.28, materials: K });
    this.addCollider(-1.95, -1.6, -0.45, -0.1);
  }

  // ---------------------------------------------------------------- skříň
  buildWardrobe() {
    const { wood, woodDark } = this.m;
    const x0 = -1.95;
    const x1 = -0.75;
    const z0 = 1.92;
    const z1 = 2.5;
    const h = 2.05;
    const g = this.group({ name: 'wardrobe' });
    const o = { parent: g, uv: 1 };
    const xc = (x0 + x1) / 2;
    const zc = (z0 + z1) / 2;
    this.box(x1 - x0, h, 0.02, woodDark, { ...o, x: xc, z: z1 - 0.01 });
    this.box(0.02, h, z1 - z0, wood, { ...o, x: x0 + 0.01, z: zc });
    this.box(0.02, h, z1 - z0, wood, { ...o, x: x1 - 0.01, z: zc });
    this.box(x1 - x0, 0.02, z1 - z0, wood, { ...o, x: xc, y: h - 0.02, z: zc });
    this.box(x1 - x0, 0.06, z1 - z0, wood, { ...o, x: xc, z: zc });
    // tyč + oblečení uvnitř
    this.cyl(0.01, 0.01, 1.1, this.m.metal, { parent: g, x: xc, y: 1.8, z: zc, rz: 90, occlude: false });
    const cols = ['#2d3a2a', '#5a2d2d', '#2a2f45', '#6b6b6b', '#1f1f1f', '#4a3b2a'];
    cols.forEach((c, i) => {
      const m = this.mat({ map: Textures.fabric(c, 20 + i) });
      this.box(0.06, 0.75 + (i % 3) * 0.12, 0.42, m, {
        parent: g,
        x: x0 + 0.15 + i * 0.17,
        y: 1.78 - (0.75 + (i % 3) * 0.12),
        z: zc,
        occlude: false,
        rz: (i % 2 ? 1 : -1) * 3,
      });
    });
    // dvířka na pantech
    const dw = (x1 - x0) / 2 - 0.005;
    const doorL = this.group({ parent: g, name: 'wardrobeDoorL', x: x0, z: z0 });
    this.box(dw, h - 0.04, 0.025, wood, { parent: doorL, x: dw / 2, y: 0.02, uv: 1 });
    this.box(0.02, 0.18, 0.03, this.m.metal, { parent: doorL, x: dw - 0.05, y: 1.0, z: -0.025, occlude: false });
    const doorR = this.group({ parent: g, name: 'wardrobeDoorR', x: x1, z: z0 });
    this.box(dw, h - 0.04, 0.025, wood, { parent: doorR, x: -dw / 2, y: 0.02, uv: 1 });
    this.box(0.02, 0.18, 0.03, this.m.metal, { parent: doorR, x: -dw + 0.05, y: 1.0, z: -0.025, occlude: false });
    this.addCollider(x0, x1, z0 - 0.02, z1, 'wardrobe');
  }

  // ---------------------------------------------------------------- drobnosti
  buildClutter() {
    // koberec
    this.plane(1.6, 2.2, this.m.carpet, { x: -0.05, y: 0.006, z: 0.45, rx: -90, uv: 0.9, castShadow: false, segX: 3, segY: 4 });

    // plakát kapely nad postelí
    this.plane(0.5, 0.74, this.mat({ map: Textures.poster() }), {
      name: 'poster',
      x: W / 2 - 0.01,
      y: 1.55,
      z: 0.95,
      ry: -90,
      segX: 1,
      segY: 2,
      castShadow: false,
    });

    // batoh
    const bag = this.mat({ map: Textures.fabric('#2f3d2c', 31) });
    this.box(0.32, 0.38, 0.18, bag, { x: -1.15, z: -0.25, ry: 28, rz: -5, uv: 3 });
    this.box(0.24, 0.16, 0.06, bag, { x: -1.11, y: 0.05, z: -0.15, ry: 28, occlude: false });

    // hromádka oblečení u postele
    const shirt = this.mat({ map: Textures.fabric('#6a6a62', 33) });
    const jeans = this.mat({ map: Textures.fabric('#2e3b55', 35) });
    this.box(0.45, 0.05, 0.35, jeans, { x: 0.55, z: 1.45, ry: 20, occlude: false });
    this.box(0.36, 0.05, 0.3, shirt, { x: 0.6, y: 0.05, z: 1.5, ry: -15, occlude: false });
    this.box(0.12, 0.03, 0.3, shirt, { x: 0.28, z: 1.25, ry: 60, occlude: false });

    // tenisky u dveří
    const shoe = this.mat({ color: 0xd9d6cc });
    this.box(0.1, 0.08, 0.27, shoe, { x: -0.45, z: 2.2, ry: 8, occlude: false });
    this.box(0.1, 0.08, 0.27, shoe, { x: -0.6, z: 2.15, ry: -12, occlude: false });

    // plechovka na zemi
    this.cyl(0.033, 0.033, 0.12, this.mat({ color: 0x8a1e1e }), { x: -0.8, y: 0.033, z: -1.75, rz: 90, ry: 30, sides: 7, occlude: false });

    // kytka v rohu a krabice s krámy (Kenney)
    this.model('pottedPlant', { fit: { h: 0.95 }, x: 1.72, z: -2.2, materials: this.kenney({ wood: this.mat({ color: 0x6a3a28, roughness: 0.8 }) }) });
    this.addCollider(1.5, 2, -2.5, -1.95);
    this.model('cardboardBoxOpen', { fit: { h: 0.36 }, ry: 15, x: -1.62, z: 1.5, materials: this.kenney({ wood: this.mat({ color: 0x9a7a52, roughness: 0.95 }), woodDark: this.mat({ color: 0x6a5238, roughness: 0.95 }) }) });
    this.addCollider(-1.95, -1.3, 1.25, 1.75);

    // komínek knih
    const bookCols = [0x5a2a2a, 0x2a3f5a, 0x6b5a2a];
    bookCols.forEach((c, i) => {
      this.box(0.24, 0.05, 0.17, this.mat({ color: c }), { x: -0.55, y: i * 0.05, z: -2.25, ry: i * 9 - 8, occlude: false });
    });

    // kytara opřená o zeď
    const guitar = this.group({ name: 'guitar', x: -0.75, z: -2.38, rx: -12 });
    const gw = this.mat({ map: Textures.wood(1.2) });
    this.sphere(0.17, gw, { parent: guitar, y: 0.2, scale: [1, 1.05, 0.35], occlude: false });
    this.sphere(0.13, gw, { parent: guitar, y: 0.43, scale: [1, 1, 0.35], occlude: false });
    this.box(0.05, 0.6, 0.03, this.m.woodDark, { parent: guitar, y: 0.5, occlude: false });
    this.box(0.07, 0.12, 0.03, this.m.black, { parent: guitar, y: 1.08, occlude: false });
    this.addCollider(-1.0, -0.5, -2.5, -2.2);
    this.addCollider(-0.75, -0.35, -2.5, -2.1);
  }

  // ---------------------------------------------------------------- venku
  buildOutside() {
    const night = (color, map) => this.mat({ color, ...(map ? { map } : {}), emissive: 0x16213a, emissiveIntensity: 1 });
    const gy = -0.3;
    // obloha
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(70, 12, 8),
      new THREE.MeshBasicMaterial({ map: Textures.sky(), side: THREE.BackSide, fog: false }),
    );
    sky.material.map.repeat.set(3, 1);
    this.root.add(sky);

    // měsíc
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.6, 10), new THREE.MeshBasicMaterial({ color: 0xe9e4cc, fog: false }));
    moon.position.set(-8, 12, -50);
    moon.lookAt(0, 1.5, 0);
    this.root.add(moon);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 10),
      new THREE.MeshBasicMaterial({ color: 0x5a6a90, transparent: true, opacity: 0.18, fog: false, depthWrite: false }),
    );
    glow.position.set(-8, 12, -50.5);
    glow.lookAt(0, 1.5, 0);
    this.root.add(glow);

    // zem, chodník, silnice
    const grass = night(0x4a5a46, Textures.grass());
    this.plane(80, 60, grass, { y: gy, z: -32, rx: -90, uv: 0.5, segX: 16, segY: 12, castShadow: false, occlude: false });
    const asphalt = night(0x5a5d64);
    this.plane(80, 4, asphalt, { y: gy + 0.01, z: -13, rx: -90, segX: 16, segY: 2, castShadow: false, occlude: false });
    const curb = night(0x55575a);
    this.plane(80, 1.2, curb, { y: gy + 0.015, z: -10.6, rx: -90, segX: 16, segY: 1, castShadow: false, occlude: false });

    // plot (instancovaný)
    const picketMat = night(0x5a4c3e);
    const picketGeo = new THREE.BoxGeometry(0.08, 1.0, 0.03);
    const count = 34;
    const pickets = new THREE.InstancedMesh(picketGeo, picketMat, count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m4.makeTranslation(-8 + i * 0.5, gy + 0.5, -8.5);
      pickets.setMatrixAt(i, m4);
    }
    pickets.castShadow = true;
    this.root.add(pickets);
    this.box(17, 0.06, 0.04, picketMat, { x: 0.25, y: gy + 0.75, z: -8.48, occlude: false });

    // domy přes ulici
    const houseMat = this.mat({ map: Textures.houseWall(), emissive: 0xffffff, emissiveMap: Textures.houseGlow(), emissiveIntensity: 0.45 });
    const roofMat = night(0x2a1c1c);
    const houses = [
      { x: -9, w: 7, h: 6, d: 6 },
      { x: 1.5, w: 6, h: 7.5, d: 7 },
      { x: 11, w: 7, h: 5.5, d: 6 },
    ];
    for (const hs of houses) {
      const z = -21 - hs.d / 2;
      this.box(hs.w, hs.h, hs.d, houseMat, { x: hs.x, y: gy, z, uv: 0.3, occlude: false, castShadow: false });
      const roof = this.cyl(0.01, hs.w * 0.75, 2.4, roofMat, { x: hs.x, y: gy + hs.h, z, sides: 4, ry: 45, occlude: false, castShadow: false });
      roof.scale.z = hs.d / hs.w;
    }

    // stromy
    const tree = night(0x1c2a1e);
    const trunk = night(0x2a2018);
    for (const [tx, tz, ts] of [
      [-4.5, -6.5, 1.1],
      [6, -7, 1.3],
      [-12, -16, 1.6],
      [16, -17, 1.4],
    ]) {
      this.cyl(0.1, 0.12, 1.2 * ts, trunk, { x: tx, y: gy, z: tz, sides: 5, occlude: false });
      this.cyl(0.01, 1.1 * ts, 3.2 * ts, tree, { x: tx, y: gy + 1.0 * ts, z: tz, sides: 6, occlude: false });
    }

    // pouliční lampa
    const pole = night(0x3a3c40);
    const lx = 3.2;
    const lz = -11.2;
    this.cyl(0.06, 0.08, 4.2, pole, { x: lx, y: gy, z: lz, sides: 6, occlude: false });
    this.box(0.7, 0.06, 0.08, pole, { x: lx - 0.3, y: gy + 4.15, z: lz, occlude: false });
    this.box(0.3, 0.08, 0.18, this.basic({ color: 0xffc27a }), { x: lx - 0.6, y: gy + 4.1, z: lz, occlude: false, castShadow: false });
    const street = new THREE.PointLight(0xff9a40, 60, 18, 1.6);
    street.position.set(lx - 0.6, gy + 3.9, lz);
    this.root.add(street);
    this.register('streetLight', street);

    // postava za oknem (na začátku skrytá)
    const shadowMan = this.group({ name: 'silhouette', x: -4.5, y: gy, z: -3.6 });
    const black = new THREE.MeshBasicMaterial({ color: 0x010102 });
    const sm = { parent: shadowMan, occlude: false, castShadow: true };
    this.box(0.36, 0.95, 0.22, black, { ...sm, y: 0.9 });
    this.box(0.14, 0.9, 0.16, black, { ...sm, x: -0.09 });
    this.box(0.14, 0.9, 0.16, black, { ...sm, x: 0.09 });
    this.box(0.08, 0.95, 0.1, black, { ...sm, x: -0.23, y: 0.85, rz: 4 });
    this.box(0.08, 0.95, 0.1, black, { ...sm, x: 0.23, y: 0.85, rz: -4 });
    this.box(0.1, 0.1, 0.1, black, { ...sm, y: 1.85 });
    this.sphere(0.13, black, { ...sm, y: 2.02, scale: [0.9, 1.15, 0.95] });
    shadowMan.visible = false;
  }

  // ---------------------------------------------------------------- světla
  buildLights() {
    const s = this.root;
    const hemi = new THREE.HemisphereLight(0x2a3550, 0x0a0806, 0.2);
    s.add(hemi);

    // lampa na nočním stolku
    const lamp = new THREE.PointLight(0xffb36b, 5.5, 9, 1.6);
    lamp.position.set(this.lampPos.x, this.lampLightY, this.lampPos.z);
    lamp.castShadow = !this.lowQuality;
    lamp.shadow.mapSize.set(512, 512);
    lamp.shadow.camera.near = 0.05;
    lamp.shadow.camera.far = 8;
    lamp.shadow.bias = -0.004;
    s.add(lamp);
    this.register('lampLight', lamp);

    // monitor
    const mon = new THREE.PointLight(0x7fb0ff, 1.4, 4.5, 1.5);
    mon.position.set(-1.25, 1.0, -1.2);
    s.add(mon);
    this.register('monitorLight', mon);
    this.monitorBase = mon.intensity;

    // měsíční svit skrz okno
    const moon = new THREE.SpotLight(0x8aa4ff, 5, 0, 0.28, 0.35, 0);
    moon.position.set(3.6, 6.5, -10);
    moon.target.position.set(0.1, 0, 0.6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(this.lowQuality ? 512 : 1024, this.lowQuality ? 512 : 1024);
    moon.shadow.camera.near = 6;
    moon.shadow.camera.far = 20;
    moon.shadow.bias = -0.0015;
    s.add(moon, moon.target);
    this.register('moonLight', moon);

    // chodba (na začátku zhasnutá)
    const hall = new THREE.PointLight(0xff6a4a, 0, 6, 1.5);
    hall.position.set(0.6, 2.2, D / 2 + 3.2);
    hall.userData.baseIntensity = 2.2;
    s.add(hall);
    this.register('hallLight', hall);
  }

  // ---------------------------------------------------------------- běh
  onLightChanged(name, on) {
    if (name === 'lampLight') {
      this.lampShadeMat.emissiveIntensity = on ? 0.55 : 0.0;
      this.lampBulbMat.color.setHex(on ? 0xfff1cf : 0x3a3630);
    }
  }

  onObjectMoved() {}

  update(dt, time) {
    // lehké blikání CRT
    const mon = this.getObject('monitorLight');
    mon.intensity = this.monitorBase * (0.92 + Math.sin(time * 31) * 0.03 + (Math.random() < 0.02 ? -0.25 : 0));
    // nepřečtená zpráva – pulzující displej
    const flags = this.game.state.flags;
    const pulse = flags.phoneBuzzed && !flags.phoneChecked;
    const v = pulse ? 0.55 + 0.45 * Math.abs(Math.sin(time * 3)) : flags.phoneBuzzed ? 0.6 : 0.25;
    this.phoneScreenMat.color.setScalar(v);
  }
}
