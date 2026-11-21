// Seeing: line of sight across the tile grid, and the ray-cast vision cone a guard
// actually projects onto the floor. Nothing here draws or owns state.
import { COLS, FIELD_X, FIELD_Y, GUARD, ROWS, TILE } from './config.js';
import { blocksSightTile } from './levels.js';

export function tileAt(grid, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return grid[row][col];
}

export function tileCenter(col, row) {
  return { x: FIELD_X + col * TILE + TILE / 2, y: FIELD_Y + row * TILE + TILE / 2 };
}

export function tileOf(x, y) {
  return {
    col: Math.floor((x - FIELD_X) / TILE),
    row: Math.floor((y - FIELD_Y) / TILE),
  };
}

// True when the straight segment between two points crosses no sight-blocking tile.
export function hasLineOfSight(grid, x0, y0, x1, y1, doorOpen) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const { col, row } = tileOf(x0 + dx * t, y0 + dy * t);
    if (blocksSightTile(tileAt(grid, col, row), doorOpen)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// How strongly a guard can see a point: 0 when out of range, outside the cone or
// behind cover, otherwise 0..1 by closeness. A hidden point (inside a bush) is 0.
export function guardSees(grid, guard, x, y, hidden, doorOpen) {
  if (hidden) return 0;
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.viewRange) return 0;
  const angle = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(angle, guard.facing)) > GUARD.viewHalfAngle) return 0;
  if (!hasLineOfSight(grid, guard.x, guard.y, x, y, doorOpen)) return 0;
  return 1 - (dist / GUARD.viewRange) * 0.7;
}

// The cone's outline on the floor: cast one ray per slice of the arc and stop each
// at the first sight-blocking tile, so the cone bends around walls and crates.
export function conePolygon(grid, guard, doorOpen) {
  const rays = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / rays;
    let reach = GUARD.viewRange;
    const step = 8;
    for (let d = step; d <= GUARD.viewRange; d += step) {
      const x = guard.x + Math.cos(angle) * d;
      const y = guard.y + Math.sin(angle) * d;
      const { col, row } = tileOf(x, y);
      if (blocksSightTile(tileAt(grid, col, row), doorOpen)) {
        reach = d - step;
        break;
      }
    }
    points.push({
      x: guard.x + Math.cos(angle) * Math.max(0, reach),
      y: guard.y + Math.sin(angle) * Math.max(0, reach),
    });
  }
  return points;
}
