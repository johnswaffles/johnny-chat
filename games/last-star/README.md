# Crownforge: Last Star

A standalone, single-player side-scrolling chapter starring the Starveil Arcanist. Original painted artwork, layered scenery, moving mist, star-lit combat, three checkpoint seals, optional lore memories, and a final guardian encounter.

## Play

From this directory, run `npm start`, then open http://127.0.0.1:4197/ in a desktop browser. No build, package download, API key or external service is needed. All artwork is included. Sound begins after pressing Begin; headphones suit the quiet original soundscape.

| Input | Action |
| --- | --- |
| A / D or arrows | Move |
| Space / W / Up | Jump; press again for a second jump |
| J or left mouse | Hold to cast Starshard; keyboard gently targets enemies ahead, mouse aims freely |
| Shift / K | Eventide Passage toward movement/facing direction |
| Q or right mouse | Falling Constellation |
| R | Summon Vaelthryx after awakening the second seal |
| E | Restore/rest at a starseal, read a memory, return the ember |
| Escape | Pause, controls, sound and atmosphere settings |

The task is to restore three starseals, free the Hollow Astronomer, and return the ember to the Observatory. The constellation can strike several enemies. Teleporting opens Lone Star Reckoning, which strengthens successive hits against the same target. Astral Mantle automatically protects a low-health crossing hit. Starlight regenerates; defeated shades replenish a little health and starlight. Resting at a clear seal fully restores both.

Progress saves at seals, memories, defeat, and returning to the title. Continue resumes at the latest seal, with later encounters reset. Browser storage is local to the device. A new run replaces the checkpoint once new progress is saved. This is an intentionally small complete first chapter, not an entire RPG or a commercial-scale campaign. Desktop keyboard/mouse and standard-mapped controllers are supported; touch controls are not implemented.

## Controller and custom buttons

Connect an Xbox-style controller by USB or Bluetooth, open the game, and press a button so the browser can discover it. Default controls: left stick/D-pad move, right stick aims, A jumps, RT casts, B blinks, X calls Falling Constellation, Y summons Heavenrend, RB interacts, and Menu pauses. Without right-stick input, casting uses the existing forward target assist.

Open **Controls & settings → Customize keyboard & controller** from the title, or **Escape / Menu → Customize keyboard & controller** during play. Select an action's keyboard or controller cell and press the replacement key/button. Occupied bindings swap actions instead of causing conflicts. Settings persist on this device. Escape and Menu remain fixed; Restore defaults resets the bindings and dead zone. Menus use D-pad/left stick to navigate, A to select, B to return; left/right D-pad adjust dropdowns and the dead-zone slider.

The browser Gamepad API is polled once per rendered frame, with buffered button edges consumed by the fixed-step game simulation. Analog triggers, stick dead zones, reconnects, sparse controller indexes and disconnect-to-pause are handled. Button names follow the browser's standard Xbox-style mapping; nonstandard devices show button numbers. Browser API reference: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API

## Living background

The v2 panorama has sharper painted foliage, rock and architectural detail. It retains the original image dimensions (2172 × 724); it is a detailed repaint, not an upscaled-resolution claim. Reduced middle-distance haze and up to 2× device-pixel rendering preserve more detail. Thirteen waterfall ribbons follow the panorama's transform, with moving water highlights, downward foam and small pool spray. Water animation freezes with pause and runs in both atmosphere modes.

## Checks

`npm test` runs combat, save, traversal and full input-driven playthrough tests. The full playthrough uses normal actions to traverse all terrain, defeat all thirteen enemies, restore every seal, and complete the ending; it does not teleport state, grant invulnerability or force enemy deaths.

`http://127.0.0.1:4197/?qa=1` exposes a development-only input replay, visible status panel, and explicit virtual-controller fixture. The fixture exercises the same polling/remapping/menu/input path as a physical device; it is labelled as simulated and never loads on the normal route. Its saves use a separate key, leaving the normal route's progress untouched. This mode is for integration checks, not the default player experience.

## Project boundaries

This folder is independent of Crownforge RTS, Oathbound and Johnny Chat. Neither existing game's code nor approved assets were modified. It is a local preview; no public deployment has been created.

- `src/game.js`: game rules, physics, collision, abilities, encounters, persistence schema.
- `src/render.js`: parallax scenery, painted sprites, illumination, fog and spell presentation.
- `src/main.js`: controls, game loop, menus and browser saves.
- `src/audio.js`: original generative ambient audio and spell sounds.
- `assets/`: original generated paintings/atlases, including the preserved v1 panorama and sharper v2 revision.
- `src/controls.js` / `controls-ui.js`: controller polling, remapping, persistence and control settings.
- `src/waterfalls.js`: image-aligned animated waterfalls and pool spray.
- `docs/DESIGN.md`: canon, new story material and deliberate RTS-to-action adaptations.
- `docs/ART_PROVENANCE.json`: exact prompts for the built-in image-generation tool.
- `docs/DETAIL_V2_PROMPT.json`: exact v2 repaint prompt, source and output path.

The game uses native Canvas 2D and Web Audio. There are no runtime CDN, font or analytics requests. Transparent atlas sprites are drawn using source rectangles at runtime; the source images were not repainted or destructively processed.
