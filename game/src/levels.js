// The Meridian Gallery in three floors, each one a grid of characters.
// One character per tile:
//   #  wall — stops feet and eyes
//   .  bare floor
//   C  crate — solid cover, stops feet and eyes
//   B  bush — walkable, hides whoever stands in it, stops eyes
//   P  where the thief starts
//   E  the exit
//   D  the vault door (locked until the keycard opens it)
//   K  the blue keycard
//   *  an aurora gem
//   G  where a guard starts patrolling
// A guard's route is a list of tile waypoints; the guard walks between them
// with the pathfinder, so a route may bend around crates and bushes.
import { COLS, ROWS } from './config.js';

export const LEVELS = [
  {
    title: 'The Gallery',
    blurb: 'Slip past two guards. Reach the green exit.',
    par: 90,
    pace: 1,
    rows: [
      '##############################',
      '#P....#......C.....#......*..#',
      '#.....#......G.B...#....C....#',
      '#.....#............#.....B...#',
      '#..C..#....B.......#.........#',
      '#......###.##########........#',
      '#............................#',
      '#.B.....C.............C......#',
      '#........C.............B..*..#',
      '#....####......#.......####..#',
      '#....#........G.....#........#',
      '#....#...............#....*..#',
      '#....#....C.....C...#........#',
      '#....#...............#.......#',
      '#..*....B.......B............#',
      '#...........................E#',
      '##############################',
    ],
    routes: [
      [[13, 2], [20, 2], [20, 4], [9, 4]],
      [[14, 10], [19, 10], [19, 12], [8, 12], [8, 10]],
    ],
  },
  {
    title: 'The Vault Wing',
    blurb: 'Find the blue keycard, unlock the vault door, reach the exit.',
    par: 120,
    pace: 1.08,
    rows: [
      '##############################',
      '#P....#.......C......#......*#',
      '#..B..#..............#.G....*#',
      '#.....#..C.....GB.....#..C..K#',
      '#..C..#..............#.C....B#',
      '#......##.###########...#....#',
      '#..B.......B......B..........#',
      '#.B......C......#....C...#...#',
      '#........C......#.....C......#',
      '#....#####......#.....####...#',
      '#....#...............#...B...#',
      '#....#...............#....D..#',
      '#....#....C....C....#.....E..#',
      '#....#...............#########',
      '#..*....B.......B...*BG......#',
      '#............................#',
      '##############################',
    ],
    routes: [
      [[23, 2], [27, 2], [27, 4], [24, 4]],
      [[15, 3], [20, 3], [20, 1], [8, 1]],
      [[22, 14], [27, 14], [27, 15], [22, 15]],
    ],
  },
  {
    title: "The Director's Floor",
    blurb: 'Four guards, faster patrols. Ghost it: never raise the alarm.',
    par: 150,
    pace: 1.12,
    rows: [
      '##############################',
      '#P...#.......CG.......#..*..*#',
      '#....#..B..........B..#G....*#',
      '#.C..#.......C........#.C...K#',
      '#....#...............#......B#',
      '#.....##.#############...#...#',
      '#..B.......B......B..........#',
      '#.B.....C.......#....C...#...#',
      '#.......C.......#....C.......#',
      '#....####.......#.....####...#',
      '#....#G..............#...B...#',
      '#....#...............#....D..#',
      '#....#....C....C......#...E..#',
      '#....#...............#########',
      '#..*....B.......B...*BG......#',
      '#............................#',
      '##############################',
    ],
    routes: [
      [[14, 1], [21, 1], [21, 3], [7, 3]],
      [[23, 2], [27, 2], [27, 4], [23, 4]],
      [[6, 10], [6, 13], [10, 13], [10, 10]],
      [[22, 14], [27, 14], [27, 15], [22, 15]],
    ],
  },
];

// Can feet cross this tile? Bushes are open ground; a shut door is not.
export function isSolidTile(tile, doorOpen) {
  switch (tile) {
    case '#':
    case 'C':
      return true;
    case 'D':
      return !doorOpen;
    default:
      return false;
  }
}

// Can eyes cross this tile? Bushes hide what stands behind them.
export function blocksSightTile(tile, doorOpen) {
  switch (tile) {
    case '#':
    case 'C':
    case 'B':
      return true;
    case 'D':
      return !doorOpen;
    default:
      return false;
  }
}

// Turn one floor's text grid into a walkable grid plus the things on it:
// the start, the exit, gems, the keycard, the vault door and guard spawns.
// A malformed floor throws here, at boot, instead of failing mid-game.
export function parseLevel(floor) {
  if (floor.rows.length !== ROWS) {
    throw new Error(`${floor.title}: ${floor.rows.length} rows, expected ${ROWS}`);
  }
  const grid = [];
  const gems = [];
  const spawns = [];
  let start = null;
  let exit = null;
  let door = null;
  let keycard = null;
  for (let row = 0; row < ROWS; row += 1) {
    const line = floor.rows[row];
    if (line.length !== COLS) {
      throw new Error(`${floor.title}: row ${row} is ${line.length} wide, expected ${COLS}`);
    }
    const out = [];
    for (let col = 0; col < COLS; col += 1) {
      const mark = line[col];
      let tile = mark;
      switch (mark) {
        case 'P':
          start = { col, row };
          tile = '.';
          break;
        case 'E':
          exit = { col, row };
          tile = '.';
          break;
        case 'D':
          door = { col, row };
          break;
        case 'K':
          keycard = { col, row };
          tile = '.';
          break;
        case '*':
          gems.push({ col, row, taken: false });
          tile = '.';
          break;
        case 'G':
          spawns.push({ col, row });
          tile = '.';
          break;
        case '#':
        case '.':
        case 'C':
        case 'B':
          break;
        default:
          throw new Error(`${floor.title}: '${mark}' at ${col},${row} is not a tile`);
      }
      out.push(tile);
    }
    grid.push(out);
  }
  if (!start) throw new Error(`${floor.title}: no player start`);
  if (!exit) throw new Error(`${floor.title}: no exit`);
  if (spawns.length !== floor.routes.length) {
    throw new Error(
      `${floor.title}: ${spawns.length} guard spawns but ${floor.routes.length} routes`,
    );
  }
  return { floor, grid, start, exit, door, keycard, gems, spawns };
}
