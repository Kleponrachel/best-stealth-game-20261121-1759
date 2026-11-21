// A tiny Dijkstra search over the tile grid, shared by guard patrols and the
// screenshot autopilot. A cost function scores each tile: 1 for plain floor, more
// for danger, Infinity for a wall. The grid is 30x17, so a plain array is the
// fastest open list and no allocation escapes the call except the returned path.
import { COLS, ROWS } from './config.js';
import { tileCenter } from './vision.js';
import { isSolidTile } from './levels.js';

// Find a walkable path of tile centres from `from` to `to` (tile coordinates).
// Returns null when no path exists. `cost(col, row)` returns the price of stepping
// on a tile, or Infinity when it cannot be stepped on at all.
export function findPath(grid, from, to, doorOpen, cost) {
  const startKey = from.row * COLS + from.col;
  const goalKey = to.row * COLS + to.col;
  if (startKey === goalKey) return [tileCenter(to.col, to.row)];
  const dist = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const done = new Uint8Array(COLS * ROWS);
  dist[startKey] = 0;
  for (;;) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < dist.length; i += 1) {
      if (!done[i] && dist[i] < bestDist) {
        bestDist = dist[i];
        best = i;
      }
    }
    if (best === -1 || bestDist === Infinity) return null;
    if (best === goalKey) break;
    done[best] = 1;
    const col = best % COLS;
    const row = Math.floor(best / COLS);
    const neighbours = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ];
    for (let n = 0; n < neighbours.length; n += 1) {
      const [nc, nr] = neighbours[n];
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const key = nr * COLS + nc;
      if (done[key]) continue;
      // The goal tile itself is always enterable: a locked door is the destination,
      // and stepping onto it is what opens it. Every other solid tile stays shut.
      if (key !== goalKey && isSolidTile(grid[nr][nc], doorOpen)) continue;
      const stepCost = cost ? cost(nc, nr) : 1;
      if (!Number.isFinite(stepCost)) continue;
      const next = dist[best] + stepCost;
      if (next < dist[key]) {
        dist[key] = next;
        prev[key] = best;
      }
    }
  }
  const tiles = [];
  let key = goalKey;
  while (key !== -1) {
    tiles.push({ col: key % COLS, row: Math.floor(key / COLS) });
    key = prev[key];
  }
  tiles.reverse();
  return tiles.map((tile) => tileCenter(tile.col, tile.row));
}
