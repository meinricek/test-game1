# Credits a licence

## Kód a knihovny

| Co | Licence | Zdroj |
|---|---|---|
| [three.js](https://threejs.org/) | MIT | npm `three` |
| [Vite](https://vitejs.dev/) (jen build) | MIT | npm `vite` |
| [Playwright](https://playwright.dev/) (jen automatické testy) | Apache-2.0 | npm `playwright` |
| Hash funkce pro zrno (`hash12`, Dave Hoskins, „Hash without Sine“) | MIT | https://www.shadertoy.com/view/4djSRW |

## Assety

Hra **nepoužívá žádné externí soubory**. Nejsou v ní modely, textury, zvuky ani fonty
třetích stran.

| Typ | Jak vzniká | Licence |
|---|---|---|
| 3D modely (pokoj, nábytek, okolí, postava) | skládané z primitiv Three.js v `src/scenes/BedroomScene.js` | vlastní tvorba (stejná jako projekt) |
| Textury (podlaha, tapeta, koberec, dřevo, látky, plakáty, monitor, obloha, domy…) | kreslené do `<canvas>` v `src/core/Textures.js` | vlastní tvorba |
| Zvuky (ambient, vítr, kroky, klepání, cvaknutí, vrzání dveří, vibrace telefonu, heartbeat…) | syntéza přes Web Audio API v `src/systems/AudioSystem.js` | vlastní tvorba |
| Písmo | systémový neproporcionální font (Courier New / monospace) | součást OS |
| Texty, příběh, jména (Noční směna, kapela „Sivý les“, host_0…) | `src/data/*.json` | vlastní tvorba |

Pokud později přidáš CC0 assety (např. Kenney, Quaternius, Poly Haven, freesound.org),
zapiš je sem ve formátu: *soubor – autor – licence – URL*.
