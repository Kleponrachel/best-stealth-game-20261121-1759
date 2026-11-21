// Night Vault — routes. Breadth-first search over the tile grid, used by
// guards chasing or investigating and by the autopilot picking its way
// between gems. Returns a list of tile centres to walk through, or null.
import { tileWalkable } from './floors.js';

export function findPath(floor, sx, sy, gx, gy, doorOpen) {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  gx = Math.floor(gx);
  gy = Math.floor(gy);
  if (!tileWalkable(floor, gx, gy, doorOpen)) return null;
  if (sx === gx && sy === gy) return [{ x: gx + 0.5, y: gy + 0.5 }];
  const key = (x, y) => y * floor.width + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!tileWalkable(floor, nx, ny, doorOpen)) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [cx, cy]);
      if (nx === gx && ny === gy) {
        const path = [];
        let cur = [gx, gy];
        while (cur) {
          path.push({ x: cur[0] + 0.5, y: cur[1] + 0.5 });
          cur = prev.get(key(cur[0], cur[1]));
        }
        path.reverse();
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

// Shortest walkable distance in tiles between two tiles, Infinity if cut off.
export function pathLength(floor, sx, sy, gx, gy, doorOpen) {
  const path = findPath(floor, sx, sy, gx, gy, doorOpen);
  return path ? path.length - 1 : Infinity;
}
