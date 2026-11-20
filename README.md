[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) [![rank](https://make.fun/badge/gta6-01/davlermid/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) [![reward](https://make.fun/badge/gta6-01/davlermid/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# MONSOON ISLES

An open-world crime game set in a rainy tropical smuggler archipelago. Three islands connected by bridges, surrounded by open water. You play as a smuggler-for-hire who can walk, drive cars, sail boats between islands, take missions, steal vehicles, fight, and outrun the harbor patrol.

## Features

- **Procedural Archipelago**: Three unique islands with terrain variation, beaches, and rocky coasts — all deterministically generated from a seed
- **Day/Night Cycle**: Dynamic lighting with sun/moon, star field, and lighthouse beam at night
- **Weather System**: Rain with particle effects, wet road surfaces, and storm conditions
- **Vehicles**: 4 car types (sedan, pickup, sports, van) with arcade physics, working headlights/brake lights, and steering wheels; 3 boat types (speedboat, fishing, cargo) with sailing physics and wake effects
- **Traffic AI**: Cars drive the road network, stop at intersections, honk; boats patrol the waters
- **Pedestrians**: Citizens walk sidewalks, wander, and flee from speeding vehicles and danger
- **Full Third-Person Character**: Articulated low-poly figure with walk/run animations, head tracking, and capsule collision
- **Harbor District**: Shipping containers, cranes, warehouses on the south island
- **Lighthouse**: Rotating beam with volumetric light at night
- **Minimap**: Real-time radar showing islands, roads, player, vehicles, and boats
- **Wanted System**: 5-star harbor patrol heat that decays over time

## Controls

| Key | Action |
|-----|--------|
| WASD | Move / Drive |
| Shift | Sprint / Boost |
| Space | Jump / Handbrake |
| Mouse | Look around (pointer lock) |
| E | Enter/Exit vehicle |
| Esc | Pause / Title screen |
| F11 | Fullscreen |

## Running Locally

```bash
node serve.ts
```

Then open http://localhost:8080 in Chrome (desktop). The game runs entirely offline — no network requests, no build step, just static files.

### URL Parameters

- `?seed=N` — Set world seed (default: 1). Same seed = same world.
- `?shot=title|drive|boat|wanted&seed=N` — Screenshot modes for the 4 required captures.

## Technical Stack

- **three.js r160** (vendored under `game/vendor/`)
- ES modules via importmap
- Mulberry32 PRNG for deterministic generation
- No build tools, no bundlers, no external dependencies at runtime

## Project Structure

```
game/
├── index.html          # Entry point, HUD, menus, importmap
├── src/
│   ├── prng.js         # Seeded random + noise helpers
│   ├── world.js        # Archipelago, water, roads, buildings, weather, lighting
│   ├── player.js       # Character, movement, camera, collision
│   ├── vehicles.js     # Cars, boats, traffic AI
│   ├── people.js       # Pedestrians with wander/flee AI
│   └── main.js         # Boot, game loop, state machine
└── vendor/
   └── three.module.min.js
```

## Screenshots

The four required screenshots (captured via `?shot=` parameter):

1. **Title screen** — `?shot=title&seed=1`
2. **Driving** — `?shot=drive&seed=1`
3. **Boating** — `?shot=boat&seed=1`
4. **Wanted** — `?shot=wanted&seed=1`

All original art, code, and design. No Rockstar Games assets, names, or IP.