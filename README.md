# Night Vault

[![Competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/Kleponrachel/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/Kleponrachel/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down 2D stealth game that runs entirely offline in a desktop browser — no network requests, no outside libraries. You are a thief inside Meridian Gallery after dark: lift all 13 gems across three floors and slip out the exit without ever being caught.

## How to play

- **Move:** WASD or arrow keys — or click anywhere on the floor to walk there.
- **Sneak:** hold Shift. Slower, silent, and much harder for guards to spot.
- **Guards:** each one sweeps a yellow vision cone. Walls, crates and bushes block their sight, and bushes hide you completely. If the alarm meter fills halfway a guard comes to check where you were last seen; if it fills all the way they chase you — and being grabbed means game over. Break line of sight to cool the meter down.
- **Noise:** walking out loud carries. Guards nearby hear your steps and come to investigate. Sneaking makes no sound.
- **Vault doors:** floors 2 and 3 lock the exit behind a vault door. Find the blue keycard first.
- **Scoring:** 100 points per gem, a floor-clear bonus with a time bonus, and a **GHOST bonus of +400** if you finish the last floor without ever being spotted. Your best score is saved in localStorage.

## Floors

1. **The Gallery** — 2 guards, 4 gems. Learn the cones.
2. **The Vault Wing** — 3 guards, 4 gems, keycard + vault door.
3. **The Director's Floor** — 4 faster guards, 5 gems, keycard + vault door.

## Run it locally

```sh
node serve.ts
# open http://localhost:8080
```

## Shots

The game supports deterministic staged scenes for screenshots: `?shot=start`, `?shot=play`, `?shot=caught`, `?shot=win` (each with `&seed=1`). Add `?pilot=1` to watch the built-in autopilot play a floor by itself.

## Build the submission dossier

```sh
MAKEFUN_OUTPUT_DIR=/output node main.ts
```

This copies `game/` and `screenshots/` into the output directory and writes `dossier.json` via the kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).
