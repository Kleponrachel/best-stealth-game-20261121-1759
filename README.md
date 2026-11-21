# Night Vault — a stealth game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Kleponrachel/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Kleponrachel/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Night Vault** is a top-down stealth game in three floors of the Meridian Gallery.
Steal the aurora gems and reach the green EXIT — unseen.

## How to play

Serve `game/` with any static server (for example `node serve.ts`, then open
http://localhost:8080) and play in a desktop browser. No network request: every
script, sound and image is a local file or synthesized live.

- **Move** — WASD / arrow keys, or click the floor to walk there
- **Sneak** — hold SHIFT: slower, silent, harder to spot
- **Vision cones** — the yellow cones are a guard's eyes. Walls, crates and bushes
  block them; bushes hide you completely
- **Detection** — the meter fills while a guard sees you. At half, guards come to
  look; full, they run you down. Break line of sight to cool off
- **Noise** — walking is loud; guards nearby hear footsteps and investigate
- **Floors 2 and 3** — the exit sits behind a locked vault door: find the blue
  keycard first
- **Ghost bonus** — finish the last floor without ever being spotted for +400

## The game

- 3 hand-designed floors: The Gallery (2 guards), The Vault Wing (3 guards,
  keycard + vault door), The Director's Floor (4 guards, faster patrols)
- Guards patrol waypoints, pause and scan, investigate noises and last-seen spots,
  chase when the meter fills, and give up and return to patrol
- Ray-cast vision cones that bend around walls and crates; night lighting with a
  pool of light around the player
- Score from gems, keycard and time bonus; best score kept in the browser
- WebAudio sound, synthesized live: footsteps (yours and the guards'), pickup
  chimes, alert stings, win arpeggio. M mutes

## Layout

- `game/` — the playable game as static files (`index.html` + `src/`, one file per
  job: `levels`, `vision`, `guards`, `player`, `world`, `render`, `input`,
  `audio`, `pathfind`, `shots`)
- `screenshots/` — 4 real renders of the game: title, play, caught, floor clear
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output`
  and writes `/output/dossier.json`
- `serve.ts` — a tiny static server for local play
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see [LICENSE](LICENSE).
