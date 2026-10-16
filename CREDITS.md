# Credits a licence

## Kód a knihovny

| Co | Licence | Zdroj |
|---|---|---|
| [three.js](https://threejs.org/) | MIT | npm `three` |
| [Vite](https://vitejs.dev/) (jen build) | MIT | npm `vite` |
| [Playwright](https://playwright.dev/) (jen automatické testy) | Apache-2.0 | npm `playwright` |
| Hash funkce pro zrno (`hash12`, Dave Hoskins, „Hash without Sine“) | MIT | https://www.shadertoy.com/view/4djSRW |

## Assety třetích stran (všechny CC0 – public domain)

### 3D modely – `public/models/`

Kenney – **Furniture Kit 2.0** (https://kenney.nl/assets/furniture-kit), licence
**CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/). Původní ploché barvy
modelů nahrazuje hra vlastními texturovanými materiály.

| Soubor | Použití |
|---|---|
| `bedSingle.glb` | postel |
| `cabinetBedDrawerTable.glb` | noční stolek |
| `lampRoundTable.glb` | lampa |
| `desk.glb` | psací stůl |
| `chairDesk.glb` | kancelářská židle |
| `computerScreen.glb`, `computerKeyboard.glb`, `computerMouse.glb` | počítač |
| `speakerSmall.glb` | reproduktory |
| `books.glb` | knihy na poličce |
| `pottedPlant.glb`, `plantSmall1.glb` | kytky |
| `trashcan.glb` | koš |
| `cardboardBoxOpen.glb` | krabice |

### Textury – `public/textures/`

Poly Haven (https://polyhaven.com), licence **CC0 1.0**. Zmenšeno na 512×512 px (JPEG).

| Soubor | Asset | Použití |
|---|---|---|
| `decrepit_wallpaper_diff/nor_gl.jpg` | [Decrepit Wallpaper](https://polyhaven.com/a/decrepit_wallpaper) | stěny pokoje a chodby |
| `laminate_floor_02_diff/nor_gl.jpg` | [Laminate Floor 02](https://polyhaven.com/a/laminate_floor_02) | podlaha |
| `beige_wall_001_diff.jpg` | [Beige Wall 001](https://polyhaven.com/a/beige_wall_001) | strop |
| `dark_wood_diff/nor_gl.jpg` | [Dark Wood](https://polyhaven.com/a/dark_wood) | nábytek, skříň, lišty |
| `fabric_pattern_07_diff.jpg` | [Fabric Pattern 07](https://polyhaven.com/a/fabric_pattern_07) | deka |
| `cotton_jersey_diff.jpg` | [Cotton Jersey](https://polyhaven.com/a/cotton_jersey) | prostěradlo, polštář |
| `dirty_carpet_diff/nor_gl.jpg` | [Dirty Carpet](https://polyhaven.com/a/dirty_carpet) | koberec |
| `velour_velvet_diff.jpg` | [Velour Velvet](https://polyhaven.com/a/velour_velvet) | závěsy |

## Vlastní tvorba (procedurálně v kódu)

| Typ | Kde | Licence |
|---|---|---|
| Dveře, okno, skříň, kytara, telefon, oblečení, postava za oknem, venkovní scéna | `src/scenes/BedroomScene.js` | stejná jako projekt |
| Textury plakátů, monitoru, dveří, oblohy, domů, displeje telefonu | `src/core/Textures.js` | stejná jako projekt |
| Všechny zvuky (ambient, vítr, kroky, klepání, cvaknutí, vrzání, vibrace, heartbeat…) | `src/systems/AudioSystem.js` (Web Audio syntéza) | stejná jako projekt |
| Texty, příběh, jména (Noční směna, kapela „Sivý les“, host_0…) | `src/data/*.json` | stejná jako projekt |
| Písmo | systémový neproporcionální font (Courier New / monospace) | součást OS |
