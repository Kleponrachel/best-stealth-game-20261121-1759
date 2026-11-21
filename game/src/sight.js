// Night Vault — seeing. A guard spots you only with a clear line of sight
// inside a cone in front of them. Walls and crates block the ray; bushes hide
// you outright. Positions are in tile units, tile centres at (x + 0.5, y + 0.5).
import { TUNE } from './tune.js';
import { tileIsBush } from './floors.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Step along the segment in small hops; any solid tile in the way breaks sight.
// Sampling is cheap at these map sizes and never tunnels through a thin wall.
export function lineClear(floor, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 0.12));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(ax + dx * t);
    const y = Math.floor(ay + dy * t);
    if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
    if (floor.solid[y][x]) return false;
  }
  return true;
}

// Full visibility test: range, cone, line of sight, and the bush rule.
export function guardSees(floor, guard, px, py, sneaking) {
  const gx = guard.x;
  const gy = guard.y;
  const dx = px - gx;
  const dy = py - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > TUNE.sightRangeTiles) return { seen: false, dist };
  if (dist > 0.01) {
    const half = (TUNE.sightHalfAngleDeg * Math.PI) / 180;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), guard.facing)) > half) {
      return { seen: false, dist };
    }
  }
  if (tileIsBush(floor, Math.floor(px), Math.floor(py))) return { seen: false, dist };
  if (!lineClear(floor, gx, gy, px, py)) return { seen: false, dist };
  return { seen: true, dist };
}

// How fast the alarm meter climbs while this guard has eyes on you.
export function spotRate(dist, sneaking) {
  const closeness = 1 - dist / TUNE.sightRangeTiles;
  let rate = TUNE.detectRisePerSec * (0.25 + 0.75 * closeness);
  if (sneaking) rate *= TUNE.sneakSpotFactor;
  return rate;
}

// Would this guard, standing where they are and facing where they face,
// notice someone standing on tile (tx, ty) right now?
export function tileWatched(floor, guard, tx, ty) {
  return coneCovers(floor, guard.x, guard.y, guard.facing, tx, ty);
}

// Same test, but against the directions the guard is about to face: the
// heading toward the end of its current path (its next waypoint while on
// patrol), and — for a patrolling guard — the cone it will sweep from that
// waypoint once it turns toward the one after it. A tile a guard is about
// to turn toward is dangerous a second before the cone actually sweeps
// onto it, so the pilot treats it as watched.
export function tileWatchedSoon(floor, guard, tx, ty) {
  let hx = null;
  let hy = null;
  if (guard.path && guard.path.length > 0) {
    const dest = guard.path[guard.path.length - 1];
    hx = dest.x;
    hy = dest.y;
  } else if (guard.waypoints) {
    const w = guard.waypoints[guard.waypointIndex % guard.waypoints.length];
    hx = w[0] + 0.5;
    hy = w[1] + 0.5;
  }
  if (hx !== null) {
    const heading = Math.atan2(hy - guard.y, hx - guard.x);
    if (Math.abs(angleDiff(heading, guard.facing)) >= 0.05) {
      if (coneCovers(floor, guard.x, guard.y, heading, tx, ty)) return true;
    }
  }
  // The turn after the next waypoint: the cone the guard sweeps once it
  // arrives there and faces the following waypoint. Only when the guard is
  // almost there — a turn minutes away is not a threat yet.
  if ((guard.mode === 'patrol' || guard.mode === 'return') && guard.waypoints) {
    const n = guard.waypoints.length;
    const at = guard.waypoints[guard.waypointIndex % n];
    const after = guard.waypoints[(guard.waypointIndex + 1) % n];
    const ox = at[0] + 0.5;
    const oy = at[1] + 0.5;
    if (Math.hypot(ox - guard.x, oy - guard.y) >= 1.5) return false;
    const heading = Math.atan2(after[1] + 0.5 - oy, after[0] + 0.5 - ox);
    if (coneCovers(floor, ox, oy, heading, tx, ty)) return true;
  }
  return false;
}

function coneCovers(floor, gx, gy, heading, tx, ty) {
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const dx = cx - gx;
  const dy = cy - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > TUNE.sightRangeTiles) return false;
  if (dist > 0.01) {
    const half = (TUNE.sightHalfAngleDeg * Math.PI) / 180;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), heading)) > half) return false;
  }
  return lineClear(floor, gx, gy, cx, cy);
}
