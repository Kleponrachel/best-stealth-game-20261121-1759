// Night Vault — guard brains. Four moods, in escalating order:
//   patrol      walk the waypoint loop, facing where you walk
//   investigate hurry to a sound or a glimpse, look around, then go back
//   chase       sprint at the last place you were seen, re-pathing often
//   return      walk back to the nearest waypoint and resume the loop
// The world object drives the transitions; this module only moves the guard.
import { TUNE } from './tune.js';
import { findPath } from './route.js';

export function makeGuard(def, fast) {
  const start = def.waypoints[0];
  return {
    x: start[0] + 0.5,
    y: start[1] + 0.5,
    facing: 0,
    mode: 'patrol',
    waypoints: def.waypoints,
    waypointIndex: 1 % def.waypoints.length,
    path: null,
    pathAt: 0,
    lookTimer: 0,
    repathTimer: 0,
    target: null,
    fast,
  };
}

function patrolSpeed(guard) {
  return guard.fast ? TUNE.guardPatrolFastTilesPerSec : TUNE.guardPatrolTilesPerSec;
}

function speedFor(guard) {
  if (guard.mode === 'chase') return TUNE.guardChaseTilesPerSec;
  if (guard.mode === 'investigate') return TUNE.guardInvestigateTilesPerSec;
  return patrolSpeed(guard);
}

function followPath(guard, dt, speed) {
  if (!guard.path || guard.pathAt >= guard.path.length) return true;
  // Skip nodes we already stand on: a fresh re-path restarts at our own
  // tile centre, and without this the guard would pace back and forth
  // between its tile centre and the next node instead of advancing.
  while (guard.pathAt < guard.path.length) {
    const node = guard.path[guard.pathAt];
    if (Math.hypot(node.x - guard.x, node.y - guard.y) < 0.15) guard.pathAt++;
    else break;
  }
  if (guard.pathAt >= guard.path.length) return true;
  const node = guard.path[guard.pathAt];
  const dx = node.x - guard.x;
  const dy = node.y - guard.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.facing = Math.atan2(dy, dx);
  return false;
}

export function guardHeadTo(guard, floor, tx, ty, doorOpen) {
  guard.path = findPath(floor, guard.x, guard.y, tx, ty, doorOpen);
  guard.pathAt = 0;
}

export function guardInvestigate(guard, floor, tx, ty, doorOpen) {
  guard.mode = 'investigate';
  guard.target = { x: tx, y: ty };
  guard.lookTimer = 0;
  guardHeadTo(guard, floor, tx, ty, doorOpen);
}

export function guardChase(guard, floor, tx, ty, doorOpen) {
  guard.mode = 'chase';
  guard.target = { x: tx, y: ty };
  guard.repathTimer = 0;
  guardHeadTo(guard, floor, tx, ty, doorOpen);
}

export function guardReturn(guard, floor, doorOpen) {
  // Nearest waypoint becomes the re-entry point of the loop.
  let best = 0;
  let bestDist = Infinity;
  guard.waypoints.forEach((w, i) => {
    const d = Math.hypot(w[0] + 0.5 - guard.x, w[1] + 0.5 - guard.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  guard.mode = 'return';
  guard.waypointIndex = best;
  guard.target = null;
  guardHeadTo(guard, floor, guard.waypoints[best][0], guard.waypoints[best][1], doorOpen);
}

export function guardUpdate(guard, floor, dt, doorOpen, playerPos) {
  if (guard.mode === 'patrol') {
    if (!guard.path) {
      const w = guard.waypoints[guard.waypointIndex];
      guardHeadTo(guard, floor, w[0], w[1], doorOpen);
    }
    if (followPath(guard, dt, patrolSpeed(guard))) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.path = null;
    }
    return;
  }
  if (guard.mode === 'return') {
    if (followPath(guard, dt, patrolSpeed(guard))) {
      guard.mode = 'patrol';
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.path = null;
    }
    return;
  }
  if (guard.mode === 'investigate') {
    if (guard.path && guard.pathAt < guard.path.length) {
      followPath(guard, dt, TUNE.guardInvestigateTilesPerSec);
      return;
    }
    // Arrived: sweep the room with your eyes, then head home.
    guard.lookTimer += dt;
    guard.facing += dt * 1.8;
    if (guard.lookTimer >= TUNE.guardLookAroundSec) {
      guardReturn(guard, floor, doorOpen);
    }
    return;
  }
  // chase
  guard.repathTimer -= dt;
  if (guard.repathTimer <= 0 && playerPos) {
    guard.repathTimer = 0.4;
    guardHeadTo(guard, floor, playerPos.x, playerPos.y, doorOpen);
  }
  if (guard.path) followPath(guard, dt, TUNE.guardChaseTilesPerSec);
}
