// A guard: a route to walk, a direction to face, a suspicion gauge and a mood.
// Moods:
//   patrol      — walk the route, linger and look around at each waypoint
//   investigate — walk to the last thing that drew attention, then look around
//   chase       — run the thief down; being caught ends the run
// Suspicion climbs while the thief stands in the cone and drains while hidden,
// so a near miss costs time rather than the run — unless the gauge fills up.
import { GUARD, PLAYER, TILE } from './config.js';
import { guardSees, tileCenter, tileOf } from './vision.js';
import { findPath } from './pathfind.js';

export const MOOD_PATROL = 'patrol';
export const MOOD_INVESTIGATE = 'investigate';
export const MOOD_CHASE = 'chase';

export function createGuard(spawn, route, pace) {
  const at = tileCenter(spawn.col, spawn.row);
  return {
    x: at.x,
    y: at.y,
    facing: 0,
    pace,
    route: route.map(([col, row]) => tileCenter(col, row)),
    leg: 0,
    mood: MOOD_PATROL,
    suspicion: 0,
    lastSeen: null,
    memoryLeft: 0,
    stepPhase: 0,
    path: null,
    pathGoal: null,
    repathIn: 0,
    dwell: 0,
    sweep: 0,
  };
}

// Walk toward `goal` along a tile route, re-planning when the goal has moved.
// Returns true once the guard stands on the goal.
function travel(guard, grid, doorOpen, goal, speed, dt) {
  const tile = tileOf(goal.x, goal.y);
  const goalKey = `${tile.col},${tile.row}`;
  guard.repathIn -= dt;
  if (!guard.path || guard.pathGoal !== goalKey || guard.repathIn <= 0) {
    const from = tileOf(guard.x, guard.y);
    // Guards step around bushes: a bush is the thief's hiding place, and a
    // guard marching through one would trip over whoever crouches inside.
    guard.path = findPath(grid, from, tile, doorOpen, (col, row) =>
      (grid[row][col] === 'B' ? Infinity : 1),
    );
    guard.pathGoal = goalKey;
    guard.repathIn = 0.6;
  }
  if (!guard.path || guard.path.length === 0) return true;
  const node = guard.path[0];
  const dx = node.x - guard.x;
  const dy = node.y - guard.y;
  const gap = Math.hypot(dx, dy);
  if (gap < 4) {
    guard.path.shift();
    return guard.path.length === 0;
  }
  const stride = Math.min(gap, speed * dt);
  guard.x += (dx / gap) * stride;
  guard.y += (dy / gap) * stride;
  guard.facing = Math.atan2(dy, dx);
  guard.stepPhase += stride;
  return false;
}

// Stand and sweep the gaze in a slow arc.
function scan(guard, dt) {
  guard.sweep += dt * 1.4;
  guard.facing = guard.sweep;
}

// Move one guard a single step. Returns 'caught' when this guard grabs the
// thief, 'spotted' the first step suspicion crosses the investigate line,
// 'alerted' the first step it crosses the chase line, otherwise null.
export function updateGuard(guard, dt, world) {
  const thief = world.player;
  const visible = guardSees(world.grid, guard, thief.x, thief.y, thief.hidden, world.doorOpen);
  let outcome = null;
  const before = guard.suspicion;
  if (visible > 0) {
    const rate = GUARD.spotRateFar + (GUARD.spotRateNear - GUARD.spotRateFar) * visible;
    guard.suspicion += rate * dt * (thief.sneaking ? 0.55 : 1);
    guard.lastSeen = { x: thief.x, y: thief.y };
    guard.memoryLeft = GUARD.chaseMemory;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.decayRate * dt);
    guard.memoryLeft = Math.max(0, guard.memoryLeft - dt);
  }
  if (before < GUARD.suspiciousAt && guard.suspicion >= GUARD.suspiciousAt) outcome = 'spotted';
  if (before < GUARD.alertAt && guard.suspicion >= GUARD.alertAt) outcome = 'alerted';

  // Walking is loud: a guard close enough hears the footsteps and comes over
  // to have a look, even when the thief is out of sight.
  if (!thief.sneaking && thief.moving) {
    const heard = Math.hypot(thief.x - guard.x, thief.y - guard.y);
    if (heard < PLAYER.noiseRadius && guard.mood === MOOD_PATROL) {
      guard.mood = MOOD_INVESTIGATE;
      guard.lastSeen = { x: thief.x, y: thief.y };
      guard.memoryLeft = GUARD.chaseMemory;
      guard.suspicion = Math.max(guard.suspicion, GUARD.suspiciousAt);
      guard.path = null;
    }
  }

  if (guard.suspicion >= GUARD.alertAt) {
    guard.mood = MOOD_CHASE;
  } else if (guard.mood === MOOD_CHASE && guard.memoryLeft <= 0) {
    guard.mood = MOOD_INVESTIGATE;
    guard.path = null;
  }

  if (guard.mood === MOOD_CHASE && guard.lastSeen) {
    const arrived = travel(guard, world.grid, world.doorOpen, thief, GUARD.chaseSpeed * guard.pace, dt);
    if (arrived) guard.facing = Math.atan2(thief.y - guard.y, thief.x - guard.x);
  } else if (guard.mood === MOOD_INVESTIGATE && guard.lastSeen) {
    const arrived = travel(guard, world.grid, world.doorOpen, guard.lastSeen, GUARD.searchSpeed * guard.pace, dt);
    if (arrived) {
      guard.dwell -= dt;
      scan(guard, dt);
      if (guard.dwell <= 0) {
        guard.mood = MOOD_PATROL;
        guard.path = null;
        guard.dwell = 0;
      }
    } else {
      guard.dwell = GUARD.searchTime;
    }
  } else if (guard.dwell > 0) {
    guard.dwell -= dt;
    scan(guard, dt);
  } else {
    const next = guard.route[guard.leg];
    const arrived = travel(guard, world.grid, world.doorOpen, next, GUARD.patrolSpeed * guard.pace, dt);
    if (arrived) {
      guard.leg = (guard.leg + 1) % guard.route.length;
      guard.dwell = 1.1;
      guard.sweep = guard.facing;
      guard.path = null;
    }
  }

  // Caught: a guard close enough to lay hands on the thief. Crouched in a bush
  // the thief is low and hard to find, so a guard must nearly step on them;
  // out in the open, an arm's length is enough.
  const reach = Math.hypot(thief.x - guard.x, thief.y - guard.y);
  const grabRange = thief.hidden ? 16 : GUARD.catchDistance;
  if (reach < grabRange) return 'caught';
  return outcome;
}
