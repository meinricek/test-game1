// Automatický průchod demem v headless Chromiu + screenshoty (PC i mobil).
// Použití:  npm run build && node scripts/playtest.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`server nenaběhl (není port ${PORT} obsazený?)`)), 20000);
  server.on('exit', (code) => reject(new Error(`vite preview skončil (kód ${code}) – port ${PORT} je asi obsazený`)));
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  });
});

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

const PROFILES = [
  { name: 'pc', viewport: { width: 1280, height: 720 }, touch: false },
  { name: 'mobil', viewport: { width: 844, height: 390 }, touch: true, isMobile: true, deviceScaleFactor: 2 },
];

let failures = 0;

for (const prof of PROFILES) {
  const context = await browser.newContext({
    viewport: prof.viewport,
    hasTouch: prof.touch,
    isMobile: !!prof.isMobile,
    deviceScaleFactor: prof.deviceScaleFactor || 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const log = (...a) => console.log(`[${prof.name}]`, ...a);
  const state = () => page.evaluate(() => window.__debug.state());
  const shot = async (n) => {
    await page.screenshot({ path: `${OUT}/${prof.name}-${n}.png` });
    log('screenshot', n);
  };
  const waitFor = async (desc, fn, timeout = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await state();
      if (fn(s)) return s;
      await sleep(150);
    }
    throw new Error(`timeout: ${desc} :: ${JSON.stringify(await state())}`);
  };
  const tap = async (sel) => {
    if (prof.touch) await page.tap(sel);
    else await page.click(sel);
  };
  const use = async () => {
    if (prof.touch) await page.tap('#btn-use');
    else await page.keyboard.press('KeyE');
  };
  const flashlight = async () => {
    if (prof.touch) await page.tap('#btn-light');
    else await page.keyboard.press('KeyF');
  };
  const closeDevice = async () => {
    if (prof.touch) await page.tap('#device');
    else await page.keyboard.press('KeyE');
  };
  const aimAndUse = async (x, z, target, expectPrompt) => {
    await page.evaluate(([x, z, t]) => {
      window.__debug.teleport(x, z);
      window.__debug.aim(t);
    }, [x, z, target]);
    await waitFor(`prompt "${expectPrompt}"`, (s) => s.prompt === expectPrompt, 5000);
    await use();
  };

  try {
    await page.goto(URL);
    await page.waitForFunction(() => !!window.__debug);
    await sleep(1500);
    await shot('01-uvod');

    // start
    if (prof.touch) await page.tap('#title');
    else await page.mouse.click(prof.viewport.width / 2, prof.viewport.height / 2);
    await waitFor('hraje se', (s) => s.mode === 'playing', 5000);
    log('start OK');

    // zkusíme pohyb (W) a kolizi se stěnou
    if (!prof.touch) {
      await page.evaluate(() => window.__debug.teleport(0, 0, 0, 0));
      await page.keyboard.down('KeyW');
      await sleep(3500);
      await page.keyboard.up('KeyW');
      const z = await page.evaluate(() => window.__game.player.position.z);
      log('po chůzi ke zdi z =', z.toFixed(3));
      if (z < -2.5 + 0.2) throw new Error('hráč prošel zdí!');
    }

    // zamčené dveře
    await aimAndUse(0.3, 1.6, 'door', 'Otevřít dveře');
    await sleep(500);

    // čekáme na zavibrování telefonu (úkol 1)
    await waitFor('úkol telefon', (s) => s.objectives[0].visible, 15000);
    await sleep(2500);
    // pohled na pokoj s rozsvícenou lampou
    await page.evaluate(() => window.__debug.teleport(-0.9, 1.6, 38, -12));
    await sleep(600);
    await shot('02-pokoj-lampa');

    // 1) telefon
    await aimAndUse(0.6, 0.7, 'phone', 'Zvednout telefon');
    await waitFor('telefon otevřen', (s) => s.deviceOpen && s.deviceReady, 10000);
    await sleep(600);
    await shot('05-telefon');
    await closeDevice();
    await waitFor('telefon hotovo', (s) => s.objectives[0].done && s.objectives[1].visible, 8000);
    log('úkol 1 OK');

    // 2) lampa
    await aimAndUse(1.1, -1.0, 'lamp', 'Zhasnout lampu');
    await waitFor('lampa zhasnuta', (s) => s.flags.lampOn === false && s.objectives[1].done, 5000);
    log('úkol 2 OK');
    await flashlight();
    await page.evaluate(() => window.__debug.teleport(0.6, 0.6, 145, -14));
    await sleep(800);
    await shot('03-baterka');

    // skříň (otevřít) + monitor
    await aimAndUse(-1.0, 0.9, 'wardrobe', 'Otevřít skříň');
    await sleep(1600);
    await aimAndUse(-0.7, -0.6, 'monitor', 'Podívat se na monitor');
    await waitFor('monitor otevřen', (s) => s.deviceOpen && s.deviceReady, 10000);
    await sleep(300);
    await shot('07-monitor');
    await closeDevice();

    // 3) okno
    await waitFor('úkol okno', (s) => s.objectives[2].visible, 6000);
    await aimAndUse(0.6, -1.4, 'window', 'Podívat se z okna');
    await waitFor('pohled z okna', (s) => s.override, 3000);
    await sleep(1600);
    await shot('04-okno');
    await waitFor('okno hotovo', (s) => s.objectives[2].done, 15000);
    log('úkol 3 OK');

    // outro – silueta za oknem
    await page.waitForFunction(() => window.__game.scene.getObject('silhouette').visible, null, { timeout: 30000 });
    await page.waitForFunction(() => window.__game.scene.getObject('silhouette').position.x > 0.25, null, { timeout: 10000 });
    await shot('08-silueta');
    await page.waitForFunction(() => window.__game.scene.getObject('doorPivot').rotation.y > 0.4, null, { timeout: 30000 });
    await shot('09-dvere');
    await waitFor('konec dema', (s) => s.mode === 'ended', 30000);
    await sleep(800);
    await shot('06-konec');
    const fps = await page.evaluate(() => window.__game.fps.value);
    log(`DOHRÁNO ✔  (FPS v headless/SwiftShader: ${fps})`);
  } catch (e) {
    failures++;
    console.error(`[${prof.name}] CHYBA:`, e.message);
    await shot('chyba').catch(() => {});
  }

  const relevant = errors.filter((e) => !/GPU stall|GL_CLOSE_PATH|Automatic fallback to software WebGL/i.test(e));
  if (relevant.length) {
    failures++;
    console.error(`[${prof.name}] chyby/varování v konzoli:\n  ${relevant.join('\n  ')}`);
  } else log('konzole čistá');
  await context.close();
}

await browser.close();
server.kill();
process.exit(failures ? 1 : 0);
