import * as THREE from 'three';

// Procedurální low-res textury kreslené do <canvas>. Žádné externí soubory.
// Všechny používají NearestFilter a nemají mipmapy (PS1 vzhled).

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function make(w, h, draw, { repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.userData.canvas = c;
  return tex;
}

function speckle(ctx, w, h, r, amount, alpha = 0.12) {
  for (let i = 0; i < amount; i++) {
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
  }
}

function drawHouse(ctx, w, h, glowOnly) {
  const r = rng(41);
  ctx.fillStyle = glowOnly ? '#000' : '#4a4c52';
  ctx.fillRect(0, 0, w, h);
  if (!glowOnly) speckle(ctx, w, h, rng(42), 300, 0.2);
  for (let y = 4; y < h - 6; y += 12) {
    for (let x = 4; x < w - 6; x += 12) {
      const lit = r() > 0.72;
      if (glowOnly && !lit) continue;
      ctx.fillStyle = lit ? '#c99a52' : '#15171c';
      ctx.fillRect(x, y, 6, 7);
    }
  }
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export const Textures = {
  floor: () =>
    cached('floor', () =>
      make(64, 64, (ctx, w, h) => {
        const r = rng(3);
        const plank = 8;
        for (let y = 0; y < h; y += plank) {
          const off = Math.floor(r() * w);
          const base = 70 + r() * 25;
          ctx.fillStyle = `rgb(${base + 22},${base * 0.72},${base * 0.5})`;
          ctx.fillRect(0, y, w, plank);
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(40,25,15,${0.15 + r() * 0.2})`;
            ctx.fillRect(Math.floor(r() * w), y + 1 + Math.floor(r() * (plank - 2)), 3 + Math.floor(r() * 9), 1);
          }
          ctx.fillStyle = 'rgba(20,12,6,0.8)';
          ctx.fillRect(0, y, w, 1);
          ctx.fillRect(off, y, 1, plank);
        }
      }),
    ),

  wallpaper: () =>
    cached('wallpaper', () =>
      make(32, 32, (ctx, w, h) => {
        const r = rng(7);
        ctx.fillStyle = '#7d8478';
        ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = '#717a6d';
          ctx.fillRect(x, 0, 3, h);
          ctx.fillStyle = '#868d80';
          ctx.fillRect(x + 5, 0, 1, h);
        }
        for (let y = 2; y < h; y += 8) {
          for (let x = 1; x < w; x += 8) {
            ctx.fillStyle = '#6a6f62';
            ctx.fillRect(x + 4, y, 2, 2);
          }
        }
        speckle(ctx, w, h, r, 250, 0.1);
      }),
    ),

  ceiling: () =>
    cached('ceiling', () =>
      make(32, 32, (ctx, w, h) => {
        const r = rng(11);
        ctx.fillStyle = '#9a9a92';
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, r, 400, 0.15);
      }),
    ),

  carpet: () =>
    cached('carpet', () =>
      make(32, 32, (ctx, w, h) => {
        const r = rng(5);
        ctx.fillStyle = '#5a2a2c';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#a58a5a';
        ctx.lineWidth = 1;
        ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
        ctx.strokeStyle = '#2b3550';
        ctx.strokeRect(5.5, 5.5, w - 11, h - 11);
        ctx.fillStyle = '#a58a5a';
        ctx.fillRect(w / 2 - 3, h / 2 - 3, 6, 6);
        ctx.fillStyle = '#2b3550';
        ctx.fillRect(w / 2 - 1, h / 2 - 7, 2, 14);
        ctx.fillRect(w / 2 - 7, h / 2 - 1, 14, 2);
        speckle(ctx, w, h, r, 300, 0.2);
      }),
    ),

  wood: (tone = 1) =>
    cached(`wood${tone}`, () =>
      make(32, 32, (ctx, w, h) => {
        const r = rng(13 + Math.round(tone * 10));
        ctx.fillStyle = `rgb(${110 * tone},${76 * tone},${50 * tone})`;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 26; i++) {
          ctx.fillStyle = `rgba(50,30,15,${0.15 + r() * 0.25})`;
          const y = Math.floor(r() * h);
          ctx.fillRect(0, y, w, 1);
        }
        speckle(ctx, w, h, r, 120, 0.12);
      }),
    ),

  fabric: (color = '#3b4a63', seed = 1) =>
    cached(`fabric${color}${seed}`, () =>
      make(32, 32, (ctx, w, h) => {
        const r = rng(17 + seed);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 4) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(0, y, w, 1);
        }
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(x, 0, 1, h);
        }
        speckle(ctx, w, h, r, 200, 0.16);
      }),
    ),

  // Plakát fiktivní kapely "SIVÝ LES" – vlastní motiv.
  poster: () =>
    cached('poster', () =>
      make(32, 48, (ctx, w, h) => {
        const r = rng(23);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#1d2a3a');
        g.addColorStop(1, '#5a2420');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // měsíc
        ctx.fillStyle = '#e8dcb0';
        ctx.beginPath();
        ctx.arc(22, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        // les
        ctx.fillStyle = '#0c0f0e';
        for (let x = -2; x < w; x += 4) {
          const th = 10 + r() * 12;
          ctx.beginPath();
          ctx.moveTo(x, h - 12);
          ctx.lineTo(x + 2.5, h - 12 - th);
          ctx.lineTo(x + 5, h - 12);
          ctx.fill();
        }
        ctx.fillRect(0, h - 12, w, 12);
        ctx.fillStyle = '#d9d1b8';
        ctx.font = 'bold 6px monospace';
        ctx.fillText('SIVÝ', 3, h - 5);
        ctx.fillText('LES', 18, h - 5);
        speckle(ctx, w, h, r, 150, 0.2);
      }),
    ),

  // Druhý plakát – mapa noční oblohy
  stars: () =>
    cached('stars', () =>
      make(32, 32, (ctx, w, h) => {
        const r = rng(29);
        ctx.fillStyle = '#0e1426';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = r() > 0.8 ? '#ffe9a8' : '#c8d4ff';
          ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
        }
        ctx.strokeStyle = 'rgba(200,210,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(5, 8);
        ctx.lineTo(12, 12);
        ctx.lineTo(18, 9);
        ctx.lineTo(25, 15);
        ctx.stroke();
      }),
    ),

  // Obrazovka monitoru – plocha s otevřeným chatem
  monitor: () =>
    cached('monitor', () =>
      make(64, 48, (ctx, w, h) => {
        ctx.fillStyle = '#123a5c';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1d5482';
        for (let i = 0; i < 4; i++) ctx.fillRect(3, 4 + i * 9, 6, 6);
        // okno chatu
        ctx.fillStyle = '#d4d0c8';
        ctx.fillRect(16, 6, 44, 34);
        ctx.fillStyle = '#0a246a';
        ctx.fillRect(16, 6, 44, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(18, 12, 40, 22);
        ctx.fillStyle = '#334';
        for (let i = 0; i < 6; i++) ctx.fillRect(20, 14 + i * 3, 8 + ((i * 13) % 26), 1);
        ctx.fillStyle = '#a00';
        ctx.fillRect(20, 31, 14, 1);
        // hlavní lišta
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(0, h - 4, w, 4);
        ctx.fillStyle = '#2a7a2a';
        ctx.fillRect(1, h - 3, 6, 2);
      }),
    ),

  phoneScreen: () =>
    cached('phone', () =>
      make(8, 16, (ctx, w, h) => {
        ctx.fillStyle = '#0b0f18';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#4a6fa5';
        ctx.fillRect(1, 2, 6, 2);
        ctx.fillStyle = '#7a2a2a';
        ctx.fillRect(1, 6, 5, 2);
      }),
    ),

  books: () =>
    cached('books', () =>
      make(32, 16, (ctx, w, h) => {
        const r = rng(31);
        const cols = ['#6b2a2a', '#2a4a6b', '#3d5a2a', '#7a6a3a', '#4a2a5a', '#222', '#8a7a6a'];
        let x = 0;
        while (x < w) {
          const bw = 2 + Math.floor(r() * 3);
          ctx.fillStyle = cols[Math.floor(r() * cols.length)];
          const bh = h - Math.floor(r() * 4);
          ctx.fillRect(x, h - bh, bw, bh);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x, h - bh + 3, bw, 1);
          x += bw;
        }
      }),
    ),

  sky: () =>
    cached('sky', () =>
      make(64, 32, (ctx, w, h) => {
        const r = rng(37);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#02040a');
        g.addColorStop(1, '#0d1626');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = `rgba(220,230,255,${0.3 + r() * 0.7})`;
          ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h * 0.8), 1, 1);
        }
      }),
    ),

  houseWall: () => cached('house', () => make(32, 32, (ctx, w, h) => drawHouse(ctx, w, h, false))),
  // jen rozsvícená okna – použito jako emissiveMap, aby svítila i ve tmě
  houseGlow: () => cached('houseGlow', () => make(32, 32, (ctx, w, h) => drawHouse(ctx, w, h, true))),

  grass: () =>
    cached('grass', () =>
      make(16, 16, (ctx, w, h) => {
        const r = rng(43);
        ctx.fillStyle = '#1f2a1c';
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, r, 120, 0.3);
      }),
    ),

  metal: () =>
    cached('metal', () =>
      make(16, 16, (ctx, w, h) => {
        const r = rng(47);
        ctx.fillStyle = '#5c6066';
        ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, r, 80, 0.2);
      }),
    ),

  door: () =>
    cached('door', () =>
      make(32, 64, (ctx, w, h) => {
        const r = rng(53);
        ctx.fillStyle = '#c9c2b0';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#a39c8a';
        ctx.strokeRect(4.5, 5.5, w - 9, 24);
        ctx.strokeRect(4.5, 35.5, w - 9, 24);
        speckle(ctx, w, h, r, 200, 0.12);
      }),
    ),
};
