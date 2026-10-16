# Noční směna

Krátké hororové demo z pohledu první osoby pro prohlížeč (PC i mobil), ve stylu indie
found-footage hororů: low-poly modely, tma, teplé světlo lampy, měkké stíny a jemné zrno
kamery. Volitelně jde v pauze zapnout retro PS1 vzhled (nízké rozlišení, pixely, třes vrcholů).
Je to vlastní hra s vlastním příběhem. Nábytek jsou CC0 modely od Kenney, povrchy
CC0 textury z Poly Haven a zvuky vznikají syntézou v kódu (viz [CREDITS.md](CREDITS.md)).

**▶ Hrát: https://meinricek.github.io/test-game1/**

> Repozitář je teď **soukromý**. GitHub Pages ze soukromého repa jdou jen s placeným
> plánem (Pro/Team). Odkaz začne fungovat, až repo přepneš na veřejné (nebo budeš mít Pro)
> a v **Settings → Pages → Build and deployment → Source** zvolíš **GitHub Actions**.
> Pak stačí workflow *Deploy to GitHub Pages* spustit znovu (záložka Actions → Re-run).

Jde o demo jedné místnosti. Je noc, rodiče mají noční směnu a ty jsi doma sám.
Telefon zavibruje a z neznámého čísla přijde zpráva…

## Screenshoty

Vznikly automaticky v headless Chromiu (`npm run test:e2e`), viz [`/screenshots`](screenshots).

| | PC (1280×720) | Mobil (844×390, dotyk) |
|---|---|---|
| Úvodní obrazovka | ![](screenshots/pc-01-uvod.png) | ![](screenshots/mobil-01-uvod.png) |
| Pokoj s rozsvícenou lampou | ![](screenshots/pc-02-pokoj-lampa.png) | ![](screenshots/mobil-02-pokoj-lampa.png) |
| Po zhasnutí, s baterkou | ![](screenshots/pc-03-baterka.png) | ![](screenshots/mobil-03-baterka.png) |
| Pohled z okna | ![](screenshots/pc-04-okno.png) | ![](screenshots/mobil-04-okno.png) |
| Telefon v ruce | ![](screenshots/pc-05-telefon.png) | ![](screenshots/mobil-05-telefon.png) |
| Konec dema | ![](screenshots/pc-06-konec.png) | ![](screenshots/mobil-06-konec.png) |
| Monitor | ![](screenshots/pc-07-monitor.png) | ![](screenshots/mobil-07-monitor.png) |
| Silueta za oknem | ![](screenshots/pc-08-silueta.png) | ![](screenshots/mobil-08-silueta.png) |
| Dveře se otevírají | ![](screenshots/pc-09-dvere.png) | ![](screenshots/mobil-09-dvere.png) |

## Ovládání

| Akce | PC | Mobil |
|---|---|---|
| Chůze | WASD / šipky | virtuální joystick (levá část obrazovky) |
| Rozhlížení | myš (pointer lock po kliknutí) | tažení prstem v pravé části obrazovky |
| Rychlejší chůze | Shift | joystick vytlačený na doraz |
| Přikrčení | Ctrl (nebo C) | tlačítko „Přikrčit“ (přepínač) |
| Interakce | E | tlačítko „Použít“ (aktivní při zaměření objektu) |
| Baterka | F | tlačítko „Baterka“ |
| Pauza | Esc | tlačítko „II“ |
| Ukazatel FPS | P | v pauze („Ukazatel FPS“) |

Dotykové zařízení se pozná automaticky (`pointer: coarse` / touch events).
Úvodní obrazovka „Klepni pro start“ zároveň odemkne zvuk, protože mobilní prohlížeče
vyžadují gesto uživatele. Pauza obsahuje citlivost, hlasitost, retro PS1 vzhled a FPS.
Nastavení se ukládají do `localStorage`.

> Ctrl+W zavře v prohlížeči záložku a hra to nemůže zablokovat, proto lze přikrčení
> ovládat i klávesou **C**.

## Spuštění

```bash
npm install
npm run dev        # vývojový server (http://localhost:5173, dostupný i z mobilu v síti)
npm run build      # produkční build do dist/
npm run preview    # náhled buildu
npm run test:e2e   # build musí existovat; projde celé demo v PC i mobilu a udělá screenshoty
```

Ke konzoli je při hraní připojený ladicí objekt `window.__game` / `window.__debug`
(např. `__debug.teleport(x, z, yaw, pitch)`, `__debug.state()`).

## Architektura

```
index.html                 – canvas + HTML overlay (HUD, pauza, telefon, titulky)
src/
  config.js                – NÁZEV HRY, rozlišení, post-process, rychlosti, výchozí nastavení
  main.js                  – vstupní bod + ladicí API
  core/
    Game.js                – hlavní smyčka, stavy (title/playing/paused/ended), načítání scén
    Renderer.js            – render do nízkého rozlišení → post-process shader → upscale bez vyhlazení
    PS1.js                 – vertex snapping + affine texturování (patch materiálů Three.js)
    Input.js               – klávesnice, myš/pointer lock, dotykový joystick a tlačítka
    Player.js              – FPS ovladač, kolize (kruh vs. AABB), přikrčení, head bob, baterka,
                             skriptované pohledy (lookAt, focus kamery)
    Scheduler.js           – časovače a tweeny v herním čase (během pauzy stojí)
    Assets.js              – načítání CC0 modelů (.glb) a textur (.jpg) z public/
    Textures.js            – procedurální textury (plakáty, monitor, obloha…) + přepínání filtrů
    Settings.js, EventBus.js
  systems/
    EventSystem.js         – datově řízené triggery (spouštěč + podmínka + seznam akcí)
    Actions.js             – knihovna akcí (zvuk, monolog, světlo, animace, fade, kamera…)
    Conditions.js          – vyhodnocení podmínek z dat
    InteractionSystem.js   – raycast ze středu obrazovky, výzvy „[E] …“
    DialogueSystem.js      – titulky/vnitřní monolog s psacím efektem
    ObjectiveSystem.js     – úkoly vlevo nahoře, postupné odemykání a odškrtávání
    AudioSystem.js         – Web Audio: ambient, kroky, klepání, cvaknutí, vrzání… (vše syntéza)
  scenes/
    BaseScene.js           – helpery pro stavbu místnosti (box, plane, model, texMat, kolize…)
    BedroomScene.js        – geometrie a světla pokoje
    index.js               – registr scén
  data/
    story.json             – startovní scéna a seznam scén
    dialogues.json         – všechny monology/titulky
    scenes/bedroom.json    – úkoly, interakce, telefon/monitor, příznaky a triggery pokoje
  ui/                      – UI.js + style.css
public/models, textures    – CC0 assety (Kenney Furniture Kit, Poly Haven)
scripts/playtest.mjs       – automatický průchod demem (Playwright) + screenshoty
```

### Jak to do sebe zapadá

1. **Kód scény** (`BedroomScene.js`) postaví jen geometrii, světla a kolize a
   pojmenuje objekty, na které se odkazují data (`phone`, `lamp`, `door`, `lampLight`…).
2. **Data scény** (`bedroom.json`) říkají, co se s nimi děje:
   - `interactables`: co jde zaměřit a jaký text se ukáže (i podle podmínky),
   - `objectives`: úkoly a kdy jsou splněné (`doneWhen`),
   - `devices`: obsah telefonu a monitoru,
   - `triggers`: **spouštěč → podmínka → akce**.
3. **EventSystem** poslouchá na `EventBus` a spouští sekvence akcí (s čekáním).

Spouštěče (`on.type`): `start`, `interact`, `timer`, `lookAt` (pohled na objekt
po dobu X s), `flag`, `objectiveStart`, `objectiveComplete`, `allObjectivesComplete`, `custom`.

Akce (`type`): `wait`, `sound`, `ambient`, `monologue`, `objective`, `flag`, `light`,
`emissive`, `animate`, `visible`, `fade`, `text`, `lookAt`, `focusCamera`, `lockPlayer`,
`unlockPlayer`, `flashlight`, `device`, `shake`, `flash`, `interactable`, `collider`,
`emit`, `end`, `scene`. Každou lze podmínit vlastním `"if"` a `"wait": false` ji pustí
paralelně. Popis parametrů je v komentářích v `src/systems/Actions.js`.

Podmínky: `{ "flag": "lampOn", "eq": false }`, `{ "objectiveActive": "window" }`,
`{ "objectiveDone": "phone" }`, `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`, pole = AND.

Příklad, zhasnutí lampy:

```json
{
  "on": { "type": "interact", "target": "lamp" },
  "if": { "flag": "lampOn" },
  "actions": [
    { "type": "sound", "name": "click", "at": "lamp" },
    { "type": "light", "target": "lampLight", "on": false },
    { "type": "flag", "name": "lampOn", "value": false }
  ]
}
```

### Vzhled

Výchozí je **moderní režim**:
- render v (skoro) nativním rozlišení (DPR max 1,5, výška max 1080 px, mobil 70 %),
  MSAA vyhlazení hran, PCF stíny 1024 px,
- na PC fyzikální materiály `MeshStandardMaterial` (lesky od baterky), na mobilu Lambert,
- procedurální textury v 4× vyšším rozlišení s jemným šumem povrchu, lineární filtrování
  s mipmapami,
- post-process (`Renderer.js`): expozice + filmová křivka (ACES), lehké odsycení, studený
  tón, vinětace, jemné zrno kamery a jen náznak chromatické aberace.

**Retro PS1 režim** (přepínač v pauze, hodnoty v `CONFIG.postRetro`):
- render do ~480×270 a upscale bez vyhlazení (`image-rendering: pixelated`),
- textury přepnuté na `NearestFilter`, 15bit barvy s Bayer ditheringem, silnější zrno,
- PS1 efekty (`PS1.js`): vrcholy se přichytávají na hrubou mřížku v clip space a UV se
  interpolují afinně (trik `uv*w / w`). Vše se přepíná za běhu bez rekompilace shaderů.

Všechny parametry (rozlišení, zrno, vinětace, sytost, tón, expozice) jsou v `src/config.js`.
- Světla: lampa (bodové, stíny), monitor, měsíc skrz okno (spot se stíny, kreslí kříž okna
  na podlahu), baterka (spot se stíny), pouliční lampa venku. Mlha `FogExp2`.
- Světla se vypínají přes `intensity = 0`, ne `visible`. Změna počtu světel by znamenala
  rekompilaci shaderů a záškub.

### Výkon

- Na dotykových zařízeních je „low quality“: 70 % rozlišení, Lambert materiály,
  lampa bez stínů, menší stínové mapy, 2× MSAA.
- Cca stovka draw callů, instancovaný plot, shadery se kompilují před startem.
- Když slabé zařízení nestíhá, retro režim (~480×270) je nejrychlejší varianta.
- Výkon na skutečném hardwaru zatím změřený není. Testy běží v headless Chromiu se
  softwarovým WebGL (SwiftShader, bez GPU). Tam má plné rozlišení na PC jednotky FPS,
  proto `scripts/playtest.mjs` hraje ve sníženém rozlišení a jen screenshoty dělá v plném.

## Jak přidat novou scénu

1. **Geometrie:** vytvoř `src/scenes/HallwayScene.js`:
   ```js
   import { BaseScene } from './BaseScene.js';
   export class HallwayScene extends BaseScene {
     build() {
       const wall = this.mat({ color: 0x777777 });
       this.plane(4, 6, this.mat({ color: 0x443322 }), { rx: -90 });          // podlaha
       this.box(0.9, 2, 0.05, wall, { name: 'bathDoor', x: 1, z: -3, collider: true });
       // světla, kolize: this.addCollider(minX, maxX, minZ, maxZ)
     }
   }
   ```
   Objekty, na které se odkazují data, pojmenuj přes `name` / `this.register()`.
2. **Data:** vytvoř `src/data/scenes/hallway.json` se stejnou strukturou jako
   `bedroom.json` (`spawn`, `flags`, `objectives`, `interactables`, `devices`, `triggers`).
   Monology přidej do `src/data/dialogues.json`.
3. **Registrace:** přidej scénu do `src/scenes/index.js` (`hallway: { Scene: HallwayScene, data: hallway }`)
   a do `src/data/story.json`.
4. **Přechod:** v libovolném triggeru použij akci `{ "type": "scene", "id": "hallway" }`
   (např. místo `end` na konci pokoje).

Nový zvuk = nová funkce v `SOUNDS` v `AudioSystem.js`. Nová akce = nová položka v `ACTIONS`.

## Převod do Unity (poznámky)

Struktura odpovídá běžnému Unity projektu:
- `BaseScene`/`BedroomScene` → Unity scéna / prefab místnosti (low-poly modely lze
  vyexportovat ze scény Three.js přes `GLTFExporter`).
- `data/*.json` → ScriptableObjecty (nebo přímo JSON přes `JsonUtility`), stejné
  triggery/akce/podmínky.
- `EventSystem` + `Actions` → `MonoBehaviour` s coroutinami (`wait` = `yield return new WaitForSeconds`).
- `PS1.js` + post-process → URP shader (vertex snapping, affine UV) + Render Texture 480×270 s point filtrem.
- `Player.js` → `CharacterController` (kolize zajistí fyzika).

### Modely a textury

Assety, které scéna potřebuje, uvádí statická vlastnost `assets` třídy scény a před
`build()` se načtou (titulní obrazovka zatím ukazuje „Načítám… %“):

```js
static assets = {
  models: ['bedSingle', 'desk'],                // public/models/<jméno>.glb
  textures: { wall: 'decrepit_wallpaper' },     // public/textures/<id>_diff.jpg
  normals: ['decrepit_wallpaper'],              // + <id>_nor_gl.jpg
};
```

Ve `build()` pak:

```js
const wall = this.texMat('decrepit_wallpaper', { normal: 0.7 });
const bed = this.model('bedSingle', {
  fit: { d: 2.05 },             // délka v metrech (nebo w / h, nebo scale)
  x: 1.45, z: 0.9, ry: 0,       // střed půdorysu, otočení (Kenney modely mají předek na +Z)
  materials: this.kenney(),     // náhrada plochých barev Kenney za textury
  collider: true,
});
const y = this.surfaceY(bed, 1.2, 0.5); // výška povrchu – pro pokládání věcí na nábytek
```

UV souřadnice modelů se přepočítávají projekcí z boxu, takže textury mají všude stejnou
hustotu.

## Licence a zdroje

Viz [CREDITS.md](CREDITS.md). Všechny cizí assety jsou CC0.
