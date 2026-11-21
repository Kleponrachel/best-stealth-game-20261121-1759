// The three floors of the Meridian Gallery, drawn as text maps. One character a tile:
//   # wall (blocks feet and eyes)   . floor   C crate (cover: blocks feet and eyes)
//   B bush (walkable, hides you, blocks eyes)   P player start   E exit
//   D locked door (needs the keycard)   K keycard   * aurora gem   G guard spawn
// Guard patrols are waypoint lists in tile coordinates; guards walk them with a
// pathfinder, so a route may bend around crates.
import { COLS, ROWS } from './config.js';

export const LEVELS = [
  {
    name: 'The Gallery',
    sub: 'Slip past two guards. Reach the green exit.',
    parSeconds: 90,
    guardSpeed: 1,
    map: [
      '##############################',
      '#P....#........C......#......#',
      '#.....#.......G.......#..*...#',
      '#..C..#....B.....B....#......#',
      '#.....#...............#..C...#',
      '#......###.###########.......#',
      '#............................#',
      '#.B.....C......#.....C.......#',
      '#........C....#.....C....*...#',
      '#....####.....#......####....#',
      '#....#........G.....#........#',
      '#....#...............#....E..#',
      '#....#....C....C....#........#',
      '#....#...............#....*..#',
      '#..*....B.......B............#',
      '#............................#',
      '##############################',
    ],
    patrols: [
      [[14, 2], [21, 2], [21, 4], [14, 4]],
      [[14, 10], [7, 10], [7, 13], [19, 13], [19, 10]],
    ],
  },
  {
    name: 'The Vault Wing',
    sub: 'Find the blue keycard, unlock the vault door, reach the exit.',
    parSeconds: 120,
    guardSpeed: 1.08,
    map: [
      '##############################',
      '#P....#......C.......#.......#',
      '#..B..#..............#...*..*#',
      '#.....#..C....GB.....#.......#',
      '#..C..#..............#.C.....#',
      '#......##.###########...#....#',
      '#..B.....................#...#',
      '#.B......C......#....C.G.#...#',
      '#........C......#.....C......#',
      '#....#####......#.....####..K#',
      '#....#........G.....#....B...#',
      '#....#...............#....D..#',
      '#....#....C....C....#....E...#',
      '#....#...............#########',
      '#..*....B.......B........*...#',
      '#............................#',
      '##############################',
    ],
    patrols: [
      [[14, 2], [20, 2], [20, 1], [8, 1]],
      [[14, 10], [7, 10], [7, 13], [19, 13], [19, 10]],
      [[24, 7], [23, 7], [23, 8], [27, 8], [27, 7]],
    ],
  },
  {
    name: "The Director's Floor",
    sub: 'Four guards, faster patrols. Ghost it: never raise the alarm.',
    parSeconds: 150,
    guardSpeed: 1.12,
    map: [
      '##############################',
      '#P...#.......CG.......#..*...#',
      '#....#..B..........B..#..*..*#',
      '#.C..#.......C........#.C....#',
      '#....#...............#.......#',
      '#.....##.#############...#...#',
      '#..B.....................#...#',
      '#.B.....C.......#....C.G.#...#',
      '#.......C.......#....C.......#',
      '#....####.......#.....####..K#',
      '#....#...G............#...B..#',
      '#....#...............#....D..#',
      '#....#....C....C......#....E.#',
      '#....#...............#########',
      '#..*....B.......B........*...#',
      '#..........G.................#',
      '##############################',
    ],
    patrols: [
      [[9, 10], [20, 10], [20, 12], [6, 12]],
      [[11, 15], [22, 15], [22, 14], [11, 14]],
      [[14, 1], [21, 1], [21, 3], [7, 3]],
      [[24, 7], [23, 7], [23, 8], [27, 8], [27, 7]],
    ],
  },
];

// A tile is solid when feet cannot cross it. Bushes are walkable; doors open with a keycard.
export function isSolidTile(tile, doorOpen) {
  return tile === '#' || tile === 'C' || (tile === 'D' && !doorOpen);
}

// A tile blocks a guard's line of sight. Bushes hide what is behind them.
export function blocksSightTile(tile, doorOpen) {
  return tile === '#' || tile === 'C' || tile === 'B' || (tile === 'D' && !doorOpen);
}

// Parse a level map into a grid plus the things standing on it: player start,
// exit, gems, keycard, door and guard spawns. Throws when the map is malformed,
// so a broken level fails loudly at boot instead of silently in front of the player.
export function parseLevel(def) {
  if (def.map.length !== ROWS) throw new Error(`${def.name}: map has ${def.map.length} rows, needs ${ROWS}`);
  const grid = [];
  let player = null;
  let exit = null;
  let door = null;
  let keycard = null;
  const gems = [];
  const guardSpawns = [];
  for (let row = 0; row < ROWS; row += 1) {
    const line = def.map[row];
    if (line.length !== COLS) throw new Error(`${def.name}: row ${row} has ${line.length} tiles, needs ${COLS}`);
    const gridRow = [];
    for (let col = 0; col < COLS; col += 1) {
      const ch = line[col];
      let tile = ch;
      if (ch === 'P') { player = { col, row }; tile = '.'; }
      else if (ch === 'E') { exit = { col, row }; tile = '.'; }
      else if (ch === 'D') { door = { col, row }; tile = 'D'; }
      else if (ch === 'K') { keycard = { col, row }; tile = '.'; }
      else if (ch === '*') { gems.push({ col, row, taken: false }); tile = '.'; }
      else if (ch === 'G') { guardSpawns.push({ col, row }); tile = '.'; }
      else if ('#.CB'.indexOf(ch) === -1) throw new Error(`${def.name}: unknown tile '${ch}' at ${col},${row}`);
      gridRow.push(tile);
    }
    grid.push(gridRow);
  }
  if (!player) throw new Error(`${def.name}: no player start`);
  if (!exit) throw new Error(`${def.name}: no exit`);
  if (guardSpawns.length !== def.patrols.length) {
    throw new Error(`${def.name}: ${guardSpawns.length} guard spawns but ${def.patrols.length} patrols`);
  }
  return { def, grid, player, exit, door, keycard, gems, guardSpawns };
}
