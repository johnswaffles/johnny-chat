# Crownforge: Dawn of Kingdoms

This folder is an isolated browser-first vertical slice for the new Crownforge RTS. It does not reuse the older game routes or their unfinished systems.

## Run locally

From this folder:

```bash
python3 -m http.server 4178
```

Then open <http://127.0.0.1:4178>.

## Controls

- Left-click a unit or building to select it.
- Drag left-click to box-select units. Hold Shift to add to the selection.
- Right-click meadow to move.
- Right-click a tree, berry bush, or stone deposit with villagers selected to gather.
- Right-click the Ashen Raider with the Crown Guard selected to attack.
- Click `HEARTH HOUSE` or press `B`, then click a clear meadow tile to place a building.
- Scroll to zoom; WASD/arrow keys or middle-drag to pan.

The game uses a small data-driven simulation with a grid A* pathfinder, explicit unit commands, resource delivery, construction progress, collision separation, and combat state. Future content should extend the registries in `src/config.js` and simulation commands rather than add one-off entity logic.

## Developer animation inspection

The playable interface does not link the internal animation QA page. With the local server running, open `http://127.0.0.1:4178/dev/animation-inspection.html` to inspect every existing unit state, authored direction, frame, ground pivot, shadow anchor, collision radius, and interaction radius.
