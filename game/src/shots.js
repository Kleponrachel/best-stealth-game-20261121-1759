// The screenshot scenes behind ?shot=start|play|caught|win. Each one plays the real
// rules forward from a fresh world, steered by an autopilot that pathfinds around
// the guards' cones (Dijkstra over the tile grid, a tile inside a cone costs far
// more than a safe one), sneaks when a guard is near and hides in a bush when it
// is chased — so the frame is what a short game really looks like, and the same
// seed always gives the same frame.
import { FIELD_X, FIELD_Y, STEP, TILE } from './config.js';
import { stepWorld, EVENT_CAUGHT, EVENT_LEVEL, EVENT_WIN } from './world.js';
import { findPath } from './pathfind.js';
import { guardSees, tileCenter, tileOf } from './vision.js';
import { MOOD_CHASE } from './guards.js';
import { SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 20;
const WIN_LIMIT_SECONDS = 240;
const CAUGHT_LIMIT_SECONDS = 90;
const SAMPLE = STEP;

function bushTiles(world) {
  const tiles = [];
  for (let row = 0; row < world.grid.length; row += 1) {
    for (let col = 0; col < world.grid[row].length; col += 1) {
      if (world.grid[row][col] === 'B') tiles.push({ col, row });
    }
  }
  return tiles;
}

function dangerAt(world, col, row) {
  const pos = tileCenter(col, row);
  let worst = 0;
  for (let i = 0; i < world.guards.length; i += 1) {
    const guard = world.guards[i];
    worst = Math.max(worst, guardSees(world.grid, guard, pos.x, pos.y, false, world.doorOpen));
    // A guard's body is dangerous too: walking into one from behind, outside
    // its cone, still ends the run. Keep the path well clear of every guard.
    const d = Math.hypot(pos.x - guard.x, pos.y - guard.y);
    if (d < 150) worst = Math.max(worst, 1);
    else if (d < 220) worst = Math.max(worst, 0.4);
  }
  return worst;
}

// Cone-only danger: how strongly any guard's eyes cover a tile right now.
function coneDangerAt(world, col, row) {
  const pos = tileCenter(col, row);
  let worst = 0;
  for (let i = 0; i < world.guards.length; i += 1) {
    worst = Math.max(worst, guardSees(world.grid, world.guards[i], pos.x, pos.y, false, world.doorOpen));
  }
  return worst;
}

function nearestTile(world, candidates, from) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < candidates.length; i += 1) {
    const pos = tileCenter(candidates[i].col, candidates[i].row);
    const d = Math.hypot(pos.x - from.x, pos.y - from.y);
    if (d < bestDist) {
      bestDist = d;
      best = candidates[i];
    }
  }
  return best;
}

function createAutopilot(world) {
  return {
    path: null,
    pathKey: '',
    replanIn: 0,
    target: null,
    hideTile: null,
    shelter: null,
    peekIn: 0,
    waitTime: 0,
  };
}

// The bush to run for: the one reached by the cheapest safe path, danger priced in.
function safestBush(world, from) {
  const bushes = bushTiles(world);
  let best = null;
  let bestScore = Infinity;
  const start = tileOf(from.x, from.y);
  for (let i = 0; i < bushes.length; i += 1) {
    const path = findPath(world.grid, start, bushes[i], world.doorOpen, (c, r) => 1 + dangerAt(world, c, r) * 80);
    if (!path) continue;
    let score = 0;
    for (let j = 0; j < path.length; j += 1) {
      const tile = tileOf(path[j].x, path[j].y);
      score += 1 + dangerAt(world, tile.col, tile.row) * 80;
    }
    if (score < bestScore) {
      bestScore = score;
      best = bushes[i];
    }
  }
  return best;
}

// The autopilot's current goal: the nearest gem first (a natural sweep of the
// floor), then the keycard, then the door, then the exit. Grabbing the keycard
// first would march the player across the map and back through the same guards.
function mainTarget(world) {
  const player = world.player;
  const remaining = world.gems.filter((g) => !g.taken);
  if (remaining.length > 0) return nearestTile(world, remaining, player);
  if (world.doorTile && !world.doorOpen && !world.hasKeycard && world.keycardTile) {
    return world.keycardTile;
  }
  if (world.doorTile && !world.doorOpen) return world.doorTile;
  return {
    col: Math.floor((world.exit.x - FIELD_X) / TILE),
    row: Math.floor((world.exit.y - FIELD_Y) / TILE),
  };
}

// Steer the player. `mode` is 'safe' (collect and reach the exit, never walk into
// a cone it can see) or 'reckless' (walk straight at the nearest guard).
// Returns { dx, dy, sneak } for this step.
function autopilot(pilot, world, dt, mode) {
  const player = world.player;
  if (mode === 'reckless') {
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < world.guards.length; i += 1) {
      const guard = world.guards[i];
      const d = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = guard;
      }
    }
    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len, sneak: false };
  }

  // Chased — or a guard is close enough to bump into: run for the safest bush
  // and sit in it until the heat dies down. Leaving the bush while a guard is
  // still hot just starts the chase again, so stay put until every guard's
  // suspicion has cooled below the line.
  const heat = world.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
  const chased = world.guards.some((g) => g.mood === MOOD_CHASE);
  const tooClose = world.guards.some(
    (g) => Math.hypot(g.x - player.x, g.y - player.y) < 110,
  );
  // A guard walking into the player's waiting spot: step away from it first.
  // Standing still while a patrol closes in is how a careful player gets bumped.
  let nearestGuard = null;
  let nearestGuardDist = Infinity;
  for (let i = 0; i < world.guards.length; i += 1) {
    const guard = world.guards[i];
    const d = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (d < nearestGuardDist) {
      nearestGuardDist = d;
      nearestGuard = guard;
    }
  }
  if (!chased && !player.hidden && nearestGuardDist < 140) {
    const ax = player.x - nearestGuard.x;
    const ay = player.y - nearestGuard.y;
    const al = Math.hypot(ax, ay) || 1;
    return { dx: ax / al, dy: ay / al, sneak: false };
  }
  if (chased || tooClose || (pilot.hideTile && heat > 25)) {
    if (!pilot.hideTile || player.hidden) {
      pilot.hideTile = safestBush(world, player);
      pilot.path = null;
    }
    if (player.hidden) return { dx: 0, dy: 0, sneak: true };
    return follow(pilot, world, dt, pilot.hideTile, true);
  }
  pilot.hideTile = null;

  // Sheltering: the road ahead was blocked, so wait in a bush until the cone
  // sweeps past instead of standing in the open where a patrol can walk into you.
  if (pilot.shelter) {
    if (!player.hidden) return follow(pilot, world, dt, pilot.shelter, true);
    pilot.peekIn -= dt;
    if (pilot.peekIn <= 0) {
      pilot.peekIn = 0.5;
      const target = mainTarget(world);
      const from = tileOf(player.x, player.y);
      const peek = findPath(world.grid, from, target, world.doorOpen, (c, r) => 1 + dangerAt(world, c, r) * 80);
      // The road ahead is clear only when the first few steps are all out of
      // every cone: one safe tile is not enough when a guard is rounding the
      // corner behind it.
      let clear = !!peek;
      for (let n = 1; clear && n < Math.min(peek.length, 4); n += 1) {
        const step = tileOf(peek[n].x, peek[n].y);
        if (coneDangerAt(world, step.col, step.row) > 0.5) clear = false;
      }
      if (clear && heat < 25) {
        pilot.shelter = null;
        pilot.path = null;
      }
    }
    return { dx: 0, dy: 0, sneak: true };
  }

  const target = mainTarget(world);
  if (!target) return { dx: 0, dy: 0, sneak: false };
  const input = follow(pilot, world, dt, target, false);
  // Waiting in the open is how a patrol walks into you: duck into a nearby bush
  // instead. Only a bush close by is worth the detour; a far one just burns the
  // clock, and a cone that sweeps past in a second is waited out in place.
  if (input.waiting && !player.hidden) {
    const near = nearestTile(world, bushTiles(world), player);
    if (near) {
      const nearPos = tileCenter(near.col, near.row);
      if (Math.hypot(nearPos.x - player.x, nearPos.y - player.y) < 380) {
        pilot.shelter = safestBush(world, player) ?? near;
        pilot.path = null;
        return follow(pilot, world, dt, pilot.shelter, true);
      }
    }
  }
  return input;
}

function follow(pilot, world, dt, target, hiding) {
  const player = world.player;
  const key = `${target.col},${target.row}`;
  pilot.replanIn -= dt;
  if (!pilot.path || pilot.pathKey !== key || pilot.replanIn <= 0) {
    const from = tileOf(player.x, player.y);
    const cost = (col, row) => 1 + dangerAt(world, col, row) * 80;
    pilot.path = findPath(world.grid, from, target, world.doorOpen, cost);
    pilot.pathKey = key;
    pilot.replanIn = 0.35;
  }
  if (!pilot.path || pilot.path.length === 0) return { dx: 0, dy: 0, sneak: true };
  const node = pilot.path[0];
  const dx = node.x - player.x;
  const dy = node.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 7) {
    pilot.path.shift();
    return { dx: 0, dy: 0, sneak: true };
  }
  // Wait for a cone to sweep past instead of walking into it — unless already seen.
  // Only a solid look stops the autopilot: the far edge of a cone fills suspicion
  // slowly, and a cone that never moves on gets walked through after a second.
  // A guard's body on the next tile is different: never push through that, just
  // wait — the guard is on patrol and will move on.
  const nodeTile = tileOf(node.x, node.y);
  const seenNow = world.guards.some(
    (g) => guardSees(world.grid, g, player.x, player.y, player.hidden, world.doorOpen) > 0,
  );
  const nodeGuardDist = world.guards.reduce(
    (m, g) => Math.min(m, Math.hypot(node.x - g.x, node.y - g.y)),
    Infinity,
  );
  // A guard's body on the next tile is different: never push through that, just
  // wait — the guard is on patrol and will move on. This check is skipped while
  // fleeing, since a player running from one guard cannot also stop for another.
  if (!hiding && !seenNow && nodeGuardDist < 130) {
    return { dx: 0, dy: 0, sneak: true, waiting: true };
  }
  if (!hiding && !seenNow && coneDangerAt(world, nodeTile.col, nodeTile.row) > 0.5) {
    pilot.waitTime += dt;
    // Hidden in a bush, the player is safe: wait as long as it takes for the cone
    // to sweep past. Exposed in the open, push through after a second instead of
    // waiting forever at a chokepoint.
    if (pilot.waitTime < 1.0 || player.hidden) return { dx: 0, dy: 0, sneak: true, waiting: true };
  }
  pilot.waitTime = 0;
  const nearGuard = world.guards.some((g) => Math.hypot(g.x - player.x, g.y - player.y) < 340);
  // Fleeing to a bush is a sprint, not a sneak: the guard already knows where
  // you are, and its chase is faster than a crouch. Sneak only on approach.
  return { dx: dx / dist, dy: dy / dist, sneak: nearGuard && !hiding };
}

// Run the world forward with the autopilot until `stop` says enough.
export function simulate(world, seconds, mode, stop) {
  const pilot = createAutopilot(world);
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const input = autopilot(pilot, world, SAMPLE, mode);
    const events = stepWorld(world, { dx: input.dx, dy: input.dy, sneak: input.sneak, click: null }, SAMPLE);
    if (stop && stop(events, i)) break;
  }
}

export { createAutopilot, autopilot };

// Set `world` to the named scene (start, play, caught or win; any other name is
// start) and return the screen to draw over it and the best score to show.
export function stageShot(name, world) {
  if (name === 'play') {
    simulate(world, PLAY_SECONDS, 'safe', null);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'caught') {
    simulate(world, CAUGHT_LIMIT_SECONDS, 'reckless', (events) => !!(events & EVENT_CAUGHT));
    return { screen: world.status === 'caught' ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    simulate(world, WIN_LIMIT_SECONDS, 'safe', (events) => !!(events & (EVENT_LEVEL | EVENT_WIN | EVENT_CAUGHT)));
    return { screen: world.status === 'levelComplete' ? SCREEN_LEVEL : world.status === 'caught' ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
  }
  // start: guards patrol for a few seconds behind the title panel.
  for (let i = 0; i < START_SECONDS / SAMPLE; i += 1) {
    stepWorld(world, { dx: 0, dy: 0, sneak: false, click: null }, SAMPLE);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
