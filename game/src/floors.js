// Night Vault — the three floors of Meridian Gallery.
// Each floor is a grid of characters drawn in plain text:
//   # wall   . open floor   B bush (hides you)   C crate (blocks sight and feet)
//   g gem    K keycard      D vault door         E exit   P where you start
// Guards patrol waypoint loops given in tile coordinates; the last floor's
// patrols run faster. Nothing here is copied from any earlier draft: these
// layouts were drawn fresh for this build.
export const FLOORS = [
  {
    name: 'The Gallery',
    floorNo: 1,
    fastPatrol: false,
    map: [
      '##########################',
      '#P......B......#....g....#',
      '#........................#',
      '#.....####...............#',
      '#........................#',
      '#.....g.......#####......#',
      '#................C.......#',
      '#....B...####......g.....#',
      '#........................#',
      '#..#####..........B......#',
      '#........................#',
      '#...C...g.......####.....#',
      '#...............C........#',
      '#...B................BE..#',
      '#........................#',
      '##########################',
    ],
    guards: [
      { waypoints: [[13, 2], [20, 2], [20, 6], [13, 6]] },
      { waypoints: [[5, 12], [11, 12], [11, 8], [5, 8]] },
    ],
  },
  {
    name: 'The Vault Wing',
    floorNo: 2,
    fastPatrol: false,
    map: [
      '##########################',
      '#P.................#.g...#',
      '#..................#...E.#',
      '#..................D.....#',
      '#..................#.....#',
      '#..................#######',
      '#...........C............#',
      '#....####......B.....g...#',
      '#.................B......#',
      '#.....B......#####.......#',
      '#....g..C...........g....#',
      '#........................#',
      '#...####.........B.......#',
      '#..K................B....#',
      '#........................#',
      '##########################',
    ],
    guards: [
      { waypoints: [[10, 2], [16, 2], [16, 4], [10, 4]] },
      { waypoints: [[6, 10], [12, 10], [12, 13], [6, 13]] },
      { waypoints: [[17, 2], [17, 6], [14, 6], [14, 2]] },
    ],
  },
  {
    name: "The Director's Floor",
    floorNo: 3,
    fastPatrol: true,
    map: [
      '##########################',
      '#P..........g.....B......#',
      '#.......####....C........#',
      '#....g...................#',
      '#.....B.......#####......#',
      '#.........C..............#',
      '#..####.............g....#',
      '#............B...........#',
      '#......C.........#.###...#',
      '#...g.............B......#',
      '#...................######',
      '#..................#..g..#',
      '#..................D.....#',
      '#.K................#.E...#',
      '#...................######',
      '##########################',
    ],
    guards: [
      { waypoints: [[6, 2], [12, 2], [12, 5], [6, 5]] },
      { waypoints: [[20, 7], [24, 7], [24, 9], [20, 9]] },
      { waypoints: [[4, 12], [10, 12], [10, 14], [4, 14]] },
      { waypoints: [[14, 10], [12, 10], [12, 13], [18, 13], [18, 10]] },
    ],
  },
];

// Turn one floor's text grid into the structured data the engine works with.
export function parseFloor(def) {
  const rows = def.map;
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const solid = [];
  const bush = [];
  const crate = [];
  for (let y = 0; y < height; y++) {
    solid.push([]);
    bush.push([]);
    crate.push([]);
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x] ?? '#';
      solid[y].push(ch === '#' || ch === 'C');
      bush[y].push(ch === 'B');
      crate[y].push(ch === 'C');
    }
  }
  const findAll = (want) => {
    const out = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((rows[y][x] ?? '') === want) out.push({ x, y });
      }
    }
    return out;
  };
  const first = (want) => findAll(want)[0] ?? null;
  const gems = findAll('g').map((p) => ({ ...p, taken: false }));
  return {
    name: def.name,
    floorNo: def.floorNo,
    fastPatrol: def.fastPatrol,
    width,
    height,
    solid,
    bush,
    crate,
    gems,
    keycard: first('K'),
    door: first('D'),
    exit: first('E'),
    spawn: first('P') ?? { x: 1, y: 1 },
    guardDefs: def.guards,
  };
}

// Is a tile inside the grid and walkable right now (a shut vault door blocks)?
export function tileWalkable(floor, x, y, doorOpen) {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  if (floor.solid[y][x]) return false;
  if (!doorOpen && floor.door && floor.door.x === x && floor.door.y === y) return false;
  return true;
}

export function tileIsBush(floor, x, y) {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return floor.bush[y][x];
}
