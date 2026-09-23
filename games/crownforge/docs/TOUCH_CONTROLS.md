# Touch and original controls

The top-right control-mode button switches between the original input and touch input. The preference is browser-local, independent of settlement saves. With no saved preference, coarse-pointer devices start in touch mode. `?controls=touch` or `?controls=original` chooses a mode for a review link, then removes that parameter so later switches persist normally.

Touch mode:
- Tap friendly units or class shortcuts to select. Tap open ground/resources/buildings for contextual orders. Hostile taps inspect; Attack explicitly orders attacks. Move forces a ground order.
- Deselect clears the selection and any pending touch command without stopping existing unit orders. Then tap a building to select it and access training.
- Drag to pan. Pinch to zoom around the gesture midpoint. Select Area changes a drag into a selection rectangle.
- Building previews sit 64 screen pixels above the finger. Drag or tap to position, then Place; blocked previews explain the problem. Walls use a starting point and dragged endpoint. Cancel exits without construction. Fixed building artwork has no free rotation.
- Home centers the hall. Follow tracks selected units and ends when the camera is dragged. Pause freezes simulation time while allowing camera movement, selection and orders; switching modes resumes.
- Settlement opens the left panel and unit activity. More reveals secondary utilities and two squad slots. Save 1/2 stores the current units for the session; squad references cannot transfer to different units after a reset/load.
- Combat buff details open on tap and dismiss on an outside tap. Lore keeps its existing pause behavior.

Original canvas input remains in `input.js`; touch handling intercepts pointer events only while enabled. Gameplay commands still use the simulation's normal order and placement methods. No combat stats or save schema changes.

## Verification

`tools/touch-controls-browser.mjs` uses Playwright with a coarse-pointer, touch-enabled browser at 1024×768 and 768×1024. Set `PLAYWRIGHT_MODULE` to an installed module entry if necessary, `CHROME_PATH` for an installed browser, and `CROWNFORGE_URL` for another local server. It checks selection/movement, actual CDP pan/pinch gestures without incidental orders, pause, explicit construction confirmation, attack orders, area selection, cancellation, squads, layout overflow and mode persistence.

Physical iPad/Safari testing is still required before claiming device-level verification.
