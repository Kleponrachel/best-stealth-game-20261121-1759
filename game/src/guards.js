// A guard: a patrol route, a facing, a suspicion meter and a mood. Moods:
//   patrol — walk the waypoints, pause and look around at each one
//   investigate — walk to the last thing that caught attention, then look around
//   chase — run at the player; catching them ends the run
// Suspicion rises while the player is in the cone and falls while hidden, so a
// near miss costs the player time, not the run — unless the meter fills.
import { GUARD, PLAYER, TILE } from './config.js';
import { guardSees, tileCenter, tileOf } from './vision.js';
import { findPath } from './pathfind.js';

export const MOOD_PATROL = 'patrol';
export const MOOD_INVESTIGATE = 'investigate';
export const MOOD_CHASE = 'chase';

export function createGuard(spawn, waypoints, speedMul) {
  const start = tileCenter(spawn.col, spawn.row);
  return {
    x: start.x,
    y: start.y,
    facing: 0,
    speedMul,
    waypoints: waypoints.map(([col, row]) => tileCenter(col, row)),
    waypointIndex: 0,
    mood: MOOD_PATROL,
    suspicion: 0,
    lastSeen: null,
    lastSeenAt: -Infinity,
    pauseLeft: 0,
    scanAngle: 0,
    path: null,
    pathTarget: null,
    replanIn: 0,
    stepPhase: 0,
  };
}

// Walk toward `target` along a tile path, replanning when the target moves.
function followPath(guard, grid, doorOpen, target, speed, dt) {
  const tile = tileOf(target.x, target.y);
  const targetKey = `${tile.col},${tile.row}`;
  guard.replanIn -= dt;
  if (!guard.path || guard.pathTarget !== targetKey || guard.replanIn <= 0) {
    const from = tileOf(guard.x, guard.y);
    // Guards walk around the bushes: a bush is the player's hiding place, and a
    // guard marching through one would bump into whoever is crouched inside.
    guard.path = findPath(grid, from, tile, doorOpen, (col, row) =>
      grid[row][col] === 'B' ? Infinity : 1,
    );
    guard.pathTarget = targetKey;
    guard.replanIn = 0.6;
  }
  if (!guard.path || guard.path.length === 0) return true;
  const node = guard.path[0];
  const dx = node.x - guard.x;
  const dy = node.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    guard.path.shift();
    return guard.path.length === 0;
  }
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.facing = Math.atan2(dy, dx);
  guard.stepPhase += step;
  return false;
}

function lookAround(guard, dt) {
  guard.scanAngle += dt * 1.4;
  guard.facing = guard.scanAngle;
}

// Advance one guard. Returns 'caught' when this guard catches the player,
// 'spotted' the first step suspicion crosses the investigate line, 'alerted' the
// first step it crosses the chase line, else null.
export function updateGuard(guard, dt, world, now) {
  const { player } = world;
  const seen = guardSees(world.grid, guard, player.x, player.y, player.hidden, world.doorOpen);
  let event = null;
  const before = guard.suspicion;
  if (seen > 0) {
    const rate = GUARD.spotRateFar + (GUARD.spotRateNear - GUARD.spotRateFar) * seen;
    guard.suspicion += rate * dt * (player.sneaking ? 0.55 : 1);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lastSeenAt = now;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.decayRate * dt);
  }
  if (before < GUARD.suspiciousAt && guard.suspicion >= GUARD.suspiciousAt) event = 'spotted';
  if (before < GUARD.alertAt && guard.suspicion >= GUARD.alertAt) event = 'alerted';

  // Walking is loud: a guard close enough hears it and comes to look.
  if (!player.sneaking && player.moving) {
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (dist < PLAYER.noiseRadius && guard.mood === MOOD_PATROL) {
      guard.mood = MOOD_INVESTIGATE;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.lastSeenAt = now;
      guard.suspicion = Math.max(guard.suspicion, GUARD.suspiciousAt);
      guard.path = null;
    }
  }

  if (guard.suspicion >= GUARD.alertAt) guard.mood = MOOD_CHASE;
  else if (guard.mood === MOOD_CHASE && now - guard.lastSeenAt > GUARD.chaseMemory) {
    guard.mood = MOOD_INVESTIGATE;
    guard.path = null;
  }

  if (guard.mood === MOOD_CHASE && guard.lastSeen) {
    const arrived = followPath(guard, world.grid, world.doorOpen, player, GUARD.chaseSpeed * guard.speedMul, dt);
    if (arrived) guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
  } else if (guard.mood === MOOD_INVESTIGATE && guard.lastSeen) {
    const arrived = followPath(guard, world.grid, world.doorOpen, guard.lastSeen, GUARD.searchSpeed * guard.speedMul, dt);
    if (arrived) {
      guard.pauseLeft -= dt;
      lookAround(guard, dt);
      if (guard.pauseLeft <= 0) {
        guard.mood = MOOD_PATROL;
        guard.path = null;
        guard.pauseLeft = 0;
      }
    } else {
      guard.pauseLeft = GUARD.searchTime;
    }
  } else {
    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      lookAround(guard, dt);
    } else {
      const target = guard.waypoints[guard.waypointIndex];
      const arrived = followPath(guard, world.grid, world.doorOpen, target, GUARD.patrolSpeed * guard.speedMul, dt);
      if (arrived) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseLeft = 1.1;
        guard.scanAngle = guard.facing;
        guard.path = null;
      }
    }
  }

  // Caught: a guard close enough to grab the player. Inside a bush the player is
  // crouched low and hard to find, so a guard must nearly step on them; in the
  // open, an arm's length is enough.
  const catchDist = Math.hypot(player.x - guard.x, player.y - guard.y);
  const catchRange = player.hidden ? 16 : GUARD.catchDistance;
  if (catchDist < catchRange) return 'caught';
  return event;
}
