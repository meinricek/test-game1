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
  build() {
    const s = this.root;
    s.background = new THREE.Color(0x020306);
    s.fog = new THREE.FogExp2(0x05070b, 0.032);

    this.m = {
      wall: this.mat({ map: Textures.wallpaper() }),
      floor: this.mat({ map: Textures.floor() }),
      ceiling: this.mat({ map: Textures.ceiling() }),
      wood: this.mat({ map: Textures.wood(1) }),
      woodDark: this.mat({ map: Textures.wood(0.6) }),
      woodLight: this.mat({ map: Textures.wood(1.35) }),
      white: this.mat({ color: 0xc8c6bc }),
      trim: this.mat({ color: 0xb9b5a8 }),
      black: this.mat({ color: 0x151517 }),
      plastic: this.mat({ color: 0xbdb7a4 }),
      metal: this.mat({ map: Textures.metal() }),
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
    this.plane(W, D, floor, { rx: -90, uv: 1, segX: 8, segY: 10, castShadow: false });
    this.plane(W, D, ceiling, { rx: 90, y: H, uv: 1 });
    const wallOpt = (o) => ({ uv: 1, ...o });

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
    const curtain = this.mat({ map: Textures.fabric('#4b2326', 3) });
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

    // květináč na parapetu
    const pot = this.mat({ color: 0x8a4a2e });
    this.cyl(0.06, 0.045, 0.1, pot, { x: 0.18, y: WIN.y0, z: -D / 2 + 0.07, occlude: false });
    const leaf = this.mat({ color: 0x2f4a26 });
    this.sphere(0.08, leaf, { x: 0.18, y: WIN.y0 + 0.17, z: -D / 2 + 0.07, scale: [1, 1.3, 1], sides: 5, rings: 4, occlude: false });
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
    const hallMat = this.mat({ map: Textures.wallpaper(), side: THREE.BackSide, color: 0x9a8f80 });
    const hall = this.box(4, H, 4, hallMat, { x: 0.3, z: zS + 2.05, uv: 1 });
    hall.castShadow = false;
    // obraz na konci chodby
    const frame = this.mat({ color: 0x2a1d14 });
    this.box(0.5, 0.65, 0.03, frame, { x: 0.3, y: 1.25, z: zS + 4.02 });
    const pic = this.basic({ color: 0x1a1414 });
    this.plane(0.4, 0.55, pic, { x: 0.3, y: 1.575, z: zS + 4.0, ry: 180, segX: 1, segY: 1 });
  }

  // ---------------------------------------------------------------- postel + noční stolek
  buildBed() {
    const { wood, woodDark } = this.m;
    const g = this.group({ name: 'bed' });
    const x = 1.45;
    const z0 = -0.1;
    const z1 = 1.95;
    const len = z1 - z0;
    const zc = (z0 + z1) / 2;
    const o = { parent: g };
    this.box(1.0, 0.3, len, wood, { ...o, x, z: zc, uv: 2 });
    const sheet = this.mat({ map: Textures.fabric('#b7b4aa', 5) });
    this.box(0.94, 0.2, len - 0.06, sheet, { ...o, x, y: 0.3, z: zc, uv: 3 });
    const blanket = this.mat({ map: Textures.fabric('#33415c', 7) });
    this.box(1.0, 0.06, 1.4, blanket, { ...o, x, y: 0.48, z: z1 - 0.75, uv: 3, ry: 1.5 });
    this.box(0.04, 0.32, 1.4, blanket, { ...o, x: x - 0.51, y: 0.22, z: z1 - 0.75, uv: 3 });
    const pillow = this.mat({ map: Textures.fabric('#cfcabd', 9) });
    this.box(0.62, 0.11, 0.34, pillow, { ...o, x: x + 0.03, y: 0.5, z: 0.15, ry: -4, uv: 3 });
    this.box(0.98, 0.9, 0.06, woodDark, { ...o, x, z: z0 - 0.03, uv: 2 });
    this.box(0.98, 0.55, 0.05, woodDark, { ...o, x, z: z1 + 0.02, uv: 2 });
    this.addCollider(x - 0.5, x + 0.55, z0 - 0.06, z1 + 0.05, 'bed');

    // telefon na posteli (svítící displej)
    const phone = this.group({ name: 'phone', x: 1.18, y: 0.5, z: 0.48, ry: 25 });
    this.box(0.075, 0.012, 0.15, this.m.black, { parent: phone, occlude: false });
    this.phoneScreenMat = new THREE.MeshBasicMaterial({ map: Textures.phoneScreen(), color: 0x666666 });
    this.plane(0.065, 0.135, this.phoneScreenMat, { parent: phone, y: 0.0131, rx: -90, segX: 1, segY: 1, castShadow: false, occlude: false });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    phone.add(hit);

    // noční stolek
    const ns = { x: 1.72, z: -0.42 };
    this.box(0.45, 0.55, 0.45, wood, { x: ns.x, z: ns.z, uv: 2, collider: 0.0, name: 'nightstand' });
    this.box(0.36, 0.14, 0.01, woodDark, { x: ns.x, y: 0.33, z: ns.z + 0.226, rx: 0, ry: 0, occlude: false });
    this.box(0.36, 0.14, 0.01, woodDark, { x: ns.x - 0.226, y: 0.33, z: ns.z, ry: 90, occlude: false });

    // lampa
    const lamp = this.group({ name: 'lamp', x: ns.x, y: 0.55, z: ns.z });
    const brass = this.mat({ color: 0x8c7a4c });
    this.cyl(0.075, 0.085, 0.03, brass, { parent: lamp, occlude: false });
    this.cyl(0.012, 0.012, 0.3, brass, { parent: lamp, y: 0.03, occlude: false });
    this.lampShadeMat = this.mat({ color: 0xd9c49a, emissive: 0xffb060, emissiveIntensity: 0.55, side: THREE.DoubleSide });
    const shade = this.cyl(0.08, 0.14, 0.17, this.lampShadeMat, { parent: lamp, y: 0.22, open: true, sides: 8, occlude: false });
    shade.castShadow = false;
    this.lampBulbMat = this.basic({ color: 0xfff1cf });
    const bulb = this.sphere(0.035, this.lampBulbMat, { parent: lamp, y: 0.3, occlude: false });
    bulb.castShadow = false;
    const lampHit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
    lampHit.position.y = 0.2;
    lamp.add(lampHit);

    // budík
    this.box(0.12, 0.07, 0.05, this.m.black, { x: ns.x + 0.09, y: 0.55, z: ns.z + 0.12, ry: -20, occlude: false });
    const digits = this.basic({ color: 0xff3020 });
    this.plane(0.09, 0.03, digits, { x: ns.x + 0.08, y: 0.588, z: ns.z + 0.147, ry: -20, segX: 1, segY: 1, castShadow: false, occlude: false });
  }

  // ---------------------------------------------------------------- stůl, PC, židle
  buildDesk() {
    const { woodLight, plastic, black, metal } = this.m;
    const x0 = -1.95;
    const x1 = -1.35;
    const z0 = -1.9;
    const z1 = -0.5;
    const xc = (x0 + x1) / 2;
    const zc = (z0 + z1) / 2;
    this.box(x1 - x0, 0.035, z1 - z0, woodLight, { x: xc, y: 0.72, z: zc, uv: 2 });
    for (const [lx, lz] of [
      [x0 + 0.03, z1 - 0.03],
      [x1 - 0.03, z1 - 0.03],
    ]) {
      this.box(0.04, 0.72, 0.04, metal, { x: lx, z: lz, occlude: false });
    }
    // kontejner se šuplíky
    this.box(0.55, 0.68, 0.42, woodLight, { x: xc, z: z0 + 0.22, uv: 2 });
    for (let i = 0; i < 3; i++) {
      this.box(0.01, 0.18, 0.36, this.m.wood, { x: x1 - 0.025, y: 0.06 + i * 0.21, z: z0 + 0.22, occlude: false });
    }
    this.addCollider(x0, x1, z0, z1, 'desk');

    // CRT monitor
    const mon = this.group({ name: 'monitor', x: -1.72, y: 0.755, z: -1.2 });
    this.box(0.36, 0.33, 0.4, plastic, { parent: mon, y: 0.02 });
    this.box(0.24, 0.26, 0.3, plastic, { parent: mon, x: -0.18, y: 0.05 });
    this.box(0.22, 0.02, 0.22, plastic, { parent: mon });
    this.monitorMat = new THREE.MeshBasicMaterial({ map: Textures.monitor() });
    this.plane(0.3, 0.24, this.monitorMat, { parent: mon, x: 0.1805, y: 0.185, ry: 90, segX: 1, segY: 1, castShadow: false });

    // klávesnice, myš, hrnek, papíry, repro
    this.box(0.16, 0.025, 0.44, plastic, { x: -1.47, y: 0.755, z: -1.2, ry: 4, occlude: false });
    this.box(0.07, 0.025, 0.045, plastic, { x: -1.47, y: 0.755, z: -0.82, occlude: false });
    const mug = this.mat({ color: 0x7a2f2a });
    this.cyl(0.042, 0.038, 0.1, mug, { x: -1.55, y: 0.755, z: -0.68, sides: 7, occlude: false, name: 'mug' });
    this.box(0.012, 0.05, 0.03, mug, { x: -1.505, y: 0.78, z: -0.68, occlude: false });
    const paper = this.mat({ color: 0xd8d4c4 });
    this.box(0.22, 0.004, 0.3, paper, { x: -1.6, y: 0.756, z: -1.68, ry: 12, occlude: false });
    this.box(0.22, 0.004, 0.3, paper, { x: -1.58, y: 0.76, z: -1.62, ry: -7, occlude: false });
    this.box(0.09, 0.16, 0.09, black, { x: -1.8, y: 0.755, z: -0.86, occlude: false });
    this.box(0.09, 0.16, 0.09, black, { x: -1.8, y: 0.755, z: -1.56, occlude: false });

    // židle
    const chair = this.group({ name: 'chair', x: -1.0, z: -1.15, ry: -8 });
    const seat = this.mat({ map: Textures.fabric('#2a2c30', 11) });
    this.box(0.46, 0.07, 0.46, seat, { parent: chair, y: 0.44 });
    this.box(0.07, 0.55, 0.44, seat, { parent: chair, x: 0.22, y: 0.55, rz: -6 });
    this.cyl(0.03, 0.03, 0.4, metal, { parent: chair, y: 0.05, occlude: false });
    this.box(0.55, 0.04, 0.06, metal, { parent: chair, y: 0.03, occlude: false });
    this.box(0.06, 0.04, 0.55, metal, { parent: chair, y: 0.03, occlude: false });
    this.addCollider(-1.27, -0.75, -1.4, -0.9, 'chair');

    // polička s knihami nad stolem
    this.box(0.24, 0.03, 1.1, woodLight, { x: -1.88, y: 1.45, z: -1.2 });
    this.box(0.18, 0.22, 1.0, this.mat({ map: Textures.books() }), { x: -1.89, y: 1.48, z: -1.25 });

    // plakát s hvězdami
    this.plane(0.55, 0.55, this.mat({ map: Textures.stars() }), { x: -W / 2 + 0.01, y: 1.55, z: 0.45, ry: 90, segX: 1, segY: 1, castShadow: false });
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
    const o = { parent: g, uv: 2 };
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
    this.box(dw, h - 0.04, 0.025, wood, { parent: doorL, x: dw / 2, y: 0.02, uv: 2 });
    this.box(0.02, 0.18, 0.03, this.m.metal, { parent: doorL, x: dw - 0.05, y: 1.0, z: -0.025, occlude: false });
    const doorR = this.group({ parent: g, name: 'wardrobeDoorR', x: x1, z: z0 });
    this.box(dw, h - 0.04, 0.025, wood, { parent: doorR, x: -dw / 2, y: 0.02, uv: 2 });
    this.box(0.02, 0.18, 0.03, this.m.metal, { parent: doorR, x: -dw + 0.05, y: 1.0, z: -0.025, occlude: false });
    this.addCollider(x0, x1, z0 - 0.02, z1, 'wardrobe');
  }

  // ---------------------------------------------------------------- drobnosti
  buildClutter() {
    // koberec
    this.plane(1.6, 2.2, this.mat({ map: Textures.carpet() }), { x: -0.05, y: 0.006, z: 0.45, rx: -90, castShadow: false, segX: 3, segY: 4 });

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
    lamp.position.set(1.72, 0.86, -0.42);
    lamp.castShadow = !this.lowQuality;
    lamp.shadow.mapSize.set(256, 256);
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
    moon.shadow.mapSize.set(this.lowQuality ? 256 : 512, this.lowQuality ? 256 : 512);
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
