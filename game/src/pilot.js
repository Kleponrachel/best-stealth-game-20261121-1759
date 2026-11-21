// Night Vault — autopilot. Plays the game by itself, the patient way. Before
// it takes a single step toward a gem, a keycard or the exit, it rehearses
// the whole walk in its head: it clones the guards and marches them forward
// along their patrols while it walks the route at sneak speed, and only
// sets off when no cone touches it at any moment of the trip. While no
// safe window is open it waits in the nearest bush, where no cone can
// reach it. If it is spotted it slips away quietly to a bush; only a real
// chase makes it sprint. Used by the demo and by the headless checks that
// prove every floor can be finished.
import { findPath, pathLength } from './route.js';
import { tileWatched, tileWatchedSoon, guardSees, spotRate } from './sight.js';
import { tileWalkable, tileIsBush } from './floors.js';
import { guardUpdate } from './foe.js';
import { gemsLeft } from './realm.js';
import { TUNE } from './tune.js';

const IDLE = { up: false, down: false, left: false, right: false, sneak: true };

function keysToward(from, to, sneak = true) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    up: dy < -0.06,
    down: dy > 0.06,
    left: dx < -0.06,
    right: dx > 0.06,
    sneak,
  };
}

// A tile is safe to step on right now when no cone covers it, no cone is
// about to sweep onto it, and no guard stands close enough to turn onto it.
function stepIsSafe(game, tx, ty) {
  for (const g of game.guards) {
    if (tileWatched(game.floor, g, tx, ty)) return false;
    if (tileWatchedSoon(game.floor, g, tx, ty)) return false;
    if (Math.hypot(g.x - (tx + 0.5), g.y - (ty + 0.5)) < 2.2) return false;
  }
  return true;
}

// Is the tile underfoot dangerous THIS instant — a cone on it right now, or
// a guard close enough to grab? The lookahead is for planning the next
// step, not for this test, and a guard a couple of tiles away with its back
// turned is no reason to abandon a climb.
function tileDangerNow(game, tx, ty) {
  for (const g of game.guards) {
    if (tileWatched(game.floor, g, tx, ty)) return true;
    if (Math.hypot(g.x - (tx + 0.5), g.y - (ty + 0.5)) < 1.2) return true;
  }
  return false;
}

// Nearest bush tile reachable from here that no cone is watching right now.
// Only the cone matters: a bush hides you completely, so how close a guard
// stands to it is irrelevant — what counts is that no cone covers the tile.
function nearestSafeBush(game) {
  const floor = game.floor;
  const px = Math.floor(game.player.x);
  const py = Math.floor(game.player.y);
  let best = null;
  let bestLen = Infinity;
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!tileIsBush(floor, x, y)) continue;
      let watched = false;
      for (const g of game.guards) {
        if (tileWatched(game.floor, g, x, y)) {
          watched = true;
          break;
        }
      }
      if (watched) continue;
      const len = pathLength(floor, px, py, x, y, game.doorOpen);
      if (len < bestLen) {
        bestLen = len;
        best = { x, y };
      }
    }
  }
  return best;
}

// BFS to a tile that steers clear of every guard: tiles within 1.6 of a
// guard count as blocked, so a fleeing run never charges straight at one.
function escapePath(game, tx, ty) {
  const floor = game.floor;
  const sx = Math.floor(game.player.x);
  const sy = Math.floor(game.player.y);
  const nearGuard = (x, y) => {
    for (const g of game.guards) {
      if (Math.hypot(g.x - (x + 0.5), g.y - (y + 0.5)) < 1.6) return true;
    }
    return false;
  };
  if (!tileWalkable(floor, tx, ty, game.doorOpen)) return null;
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
      if (!tileWalkable(floor, nx, ny, game.doorOpen)) continue;
      if ((nx !== tx || ny !== ty) && nearGuard(nx, ny)) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, [cx, cy]);
      if (nx === tx && ny === ty) {
        const path = [];
        let cur = [tx, ty];
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

// The bush to run for when seen: the closest unwatched one that also keeps
// a healthy distance from every guard, so the run itself stays out of reach.
function fleeBush(game) {
  const floor = game.floor;
  const px = Math.floor(game.player.x);
  const py = Math.floor(game.player.y);
  const candidates = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!tileIsBush(floor, x, y)) continue;
      let watched = false;
      let nearest = Infinity;
      for (const g of game.guards) {
        if (tileWatched(game.floor, g, x, y)) watched = true;
        nearest = Math.min(nearest, Math.hypot(g.x - (x + 0.5), g.y - (y + 0.5)));
      }
      if (watched) continue;
      const len = pathLength(floor, px, py, x, y, game.doorOpen);
      if (len === Infinity) continue;
      candidates.push({ x, y, len, nearest });
    }
  }
  if (candidates.length === 0) return null;
  const far = candidates.filter((c) => c.nearest >= 3);
  const pool = far.length > 0 ? far : candidates;
  pool.sort((a, b) => a.len - b.len);
  return { x: pool[0].x, y: pool[0].y };
}

// Run from the nearest guard: the adjacent walkable tile that is furthest
// from where every guard is ABOUT to be, not just where they stand —
// stepping straight ahead of a guard walking your way only lets it run
// you down. A bush still counts double.
function fleeStep(game) {
  const floor = game.floor;
  const px = Math.floor(game.player.x);
  const py = Math.floor(game.player.y);
  const ahead = game.guards.map((g) => {
    const speed = g.mode === 'chase'
      ? TUNE.guardChaseTilesPerSec
      : g.fast ? TUNE.guardPatrolFastTilesPerSec : TUNE.guardPatrolTilesPerSec;
    return {
      x: g.x + Math.cos(g.facing) * speed * 1.2,
      y: g.y + Math.sin(g.facing) * speed * 1.2,
    };
  });
  let best = null;
  let bestScore = -Infinity;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = px + dx;
    const ny = py + dy;
    if (!tileWalkable(floor, nx, ny, game.doorOpen)) continue;
    let nearest = Infinity;
    for (const a of ahead) nearest = Math.min(nearest, Math.hypot(a.x - (nx + 0.5), a.y - (ny + 0.5)));
    let score = nearest * 2;
    if (stepIsSafe(game, nx, ny)) score += 5;
    if (tileIsBush(floor, nx, ny)) score += 8;
    if (score > bestScore) {
      bestScore = score;
      best = { x: nx + 0.5, y: ny + 0.5 };
    }
  }
  return best;
}

// Walk a path's next step when that step is safe; otherwise null.
function stepAlong(game, path) {
  if (!path || path.length < 2) return null;
  const next = path[1];
  if (!stepIsSafe(game, Math.floor(next.x), Math.floor(next.y))) return null;
  return keysToward(game.player, next);
}

// Wait where you stand — unless a guard is closing in, in which case step
// aside fast. Standing still on a patrol route gets you walked into, and
// a sneak is slower than a fast patrol.
function waitOrDodge(game) {
  for (const g of game.guards) {
    if (Math.hypot(g.x - game.player.x, g.y - game.player.y) < 2.0) {
      const flee = fleeStep(game);
      if (flee) return keysToward(game.player, flee, false);
      break;
    }
  }
  return { ...IDLE };
}

// One sample of the alarm meter: -1 when a guard is close enough to grab,
// otherwise the meter after this step (rising while watched, falling when not).
// Inside a bush the player is invisible and cannot be grabbed, so a guard
// passing close by is no danger there.
function sampleMeter(floor, guards, px, py, meter, dt) {
  let watched = false;
  let fastest = 0;
  const hidden = tileIsBush(floor, Math.floor(px), Math.floor(py));
  for (const g of guards) {
    if (!hidden && Math.hypot(g.x - px, g.y - py) < 1.3) return -1;
    const res = guardSees(floor, g, px, py, true);
    if (res.seen) {
      watched = true;
      fastest = Math.max(fastest, spotRate(res.dist, true));
    }
  }
  return watched
    ? Math.min(100, meter + fastest * dt)
    : Math.max(0, meter - TUNE.detectFallPerSec * dt);
}

// Would standing still here stay calm for a while? Clones the guards and
// watches the meter for 2.5 seconds of their patrols — long enough to grab
// something and turn around, and to be sure the spot is not about to be swept.
function lingerCalm(floor, guards, px, py, meter, doorOpen) {
  const clones = guards.map((g) => JSON.parse(JSON.stringify(g)));
  let m = meter;
  for (let t = 0; t < 2.5; t += 0.1) {
    for (const g of clones) guardUpdate(g, floor, 0.1, doorOpen, null);
    m = sampleMeter(floor, clones, px, py, m, 0.1);
    if (m < 0 || m >= 30) return false;
  }
  return true;
}

// The rehearsal: walk the whole route at sneak speed while the guards'
// clones march their patrols forward, tracking the alarm meter exactly the
// way the real game does. Returns how far the walk gets before the meter
// would reach the point where a guard comes looking (30, with margin below
// the real 50), which nodes along the way are safe places to wait, and
// whether the far end stays calm once reached. A brief brush with a cone's
// edge is survivable; a long stare is not.
export function rehearse(game, route) {
  const floor = game.floor;
  const doorOpen = game.doorOpen;
  const clones = game.guards.map((g) => JSON.parse(JSON.stringify(g)));
  let px = game.player.x;
  let py = game.player.y;
  let meter = game.detection;
  // A waiting spot only counts when it is a bush: open floor that is calm
  // for 2.5 seconds may be swept by a cone a moment later, but a bush
  // hides you for as long as you sit in it.
  const startBush = tileIsBush(floor, Math.floor(px), Math.floor(py));
  let stage = startBush && lingerCalm(floor, clones, px, py, meter, doorOpen) ? 0 : -1;
  let arrived = 0;
  let nodeIdx = 1;
  const step = 0.1;
  const speed = TUNE.sneakTilesPerSec;
  let t = 0;
  while (nodeIdx < route.length && t < 90) {
    const node = route[nodeIdx];
    const dx = node.x - px;
    const dy = node.y - py;
    const dist = Math.hypot(dx, dy);
    const move = speed * step;
    let reachedNode = false;
    if (dist <= move) {
      px = node.x;
      py = node.y;
      reachedNode = true;
    } else {
      px += (dx / dist) * move;
      py += (dy / dist) * move;
    }
    for (const g of clones) guardUpdate(g, floor, step, doorOpen, null);
    meter = sampleMeter(floor, clones, px, py, meter, step);
    if (meter < 0 || meter >= 30) return { end: arrived, stage, finalCalm: false };
    t += step;
    if (reachedNode) {
      arrived = nodeIdx;
      if (tileIsBush(floor, Math.floor(node.x), Math.floor(node.y)) &&
          lingerCalm(floor, clones, px, py, meter, doorOpen)) {
        stage = nodeIdx;
      }
      nodeIdx++;
    }
  }
  if (arrived < route.length - 1) return { end: arrived, stage, finalCalm: false };
  return { end: arrived, stage, finalCalm: lingerCalm(floor, clones, px, py, meter, doorOpen) };
}

// The bush closest to a goal — the staging post for a dash at it. A long
// walk rarely has one safe window end to end, but a short dash from a
// nearby bush does, once the patrols line up.
function stagingBushFor(game, goal) {
  const floor = game.floor;
  let best = null;
  let bestLen = Infinity;
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      if (!tileIsBush(floor, x, y)) continue;
      const len = pathLength(floor, x, y, goal.x, goal.y, game.doorOpen);
      if (len < bestLen) {
        bestLen = len;
        best = { x, y };
      }
    }
  }
  return best;
}

function pickGoal(game) {
  const floor = game.floor;
  const px = Math.floor(game.player.x);
  const py = Math.floor(game.player.y);
  let goal = null;
  let bestLen = Infinity;
  for (const gem of floor.gems) {
    if (gem.taken) continue;
    const len = pathLength(floor, px, py, gem.x, gem.y, game.doorOpen);
    if (len < bestLen) {
      bestLen = len;
      goal = { x: gem.x, y: gem.y };
    }
  }
  if (!goal && floor.keycard && !game.hasKeycard) {
    goal = { x: floor.keycard.x, y: floor.keycard.y };
  }
  if (!goal && gemsLeft(game) === 0 && floor.exit) {
    goal = { x: floor.exit.x, y: floor.exit.y };
  }
  return goal;
}

export function decide(game, dt, opts = {}) {
  const boldAfter = opts.boldAfter ?? 25;
  if (game.status !== 'play') return null;
  const floor = game.floor;
  const player = game.player;
  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  const pilot = game.pilot;
  if (!pilot.plan) pilot.plan = null;

  const chased = game.guards.some((g) => g.mode === 'chase');
  const hunted = game.guards.some((g) => g.mode === 'investigate');
  const standingWatched = !tileIsBush(floor, px, py) && tileDangerNow(game, px, py);

  // Reflex 1: standing inside a cone (or being chased) — get out now.
  // Slip away silently when only spotted (noise would hand the guard our
  // live position); sprint when actually chased, or when a guard is already
  // close enough to close the gap faster than a sneak can open it.
  if (chased || standingWatched) {
    pilot.plan = null;
    if (tileIsBush(floor, px, py) && !chased) return { ...IDLE };
    let nearestGuard = Infinity;
    for (const g of game.guards) nearestGuard = Math.min(nearestGuard, Math.hypot(g.x - player.x, g.y - player.y));
    const run = chased || nearestGuard < 1.5;
    // The nearest unwatched bush: a bush hides you even with a guard
    // standing next to it, so distance from the guards is no reason to
    // run past it toward a farther one.
    const bush = nearestSafeBush(game);
    if (bush) {
      const path = escapePath(game, bush.x, bush.y) ?? findPath(floor, px, py, bush.x, bush.y, game.doorOpen);
      if (path && path.length > 1) return keysToward(player, path[1], !run);
    }
    const flee = fleeStep(game);
    if (flee) return keysToward(player, flee, !run);
    return waitOrDodge(game);
  }

  // Reflex 2: a guard is coming to look where we were — slip into cover.
  if (hunted || game.detection > 35) {
    pilot.plan = null;
    if (tileIsBush(floor, px, py)) return { ...IDLE };
    const bush = nearestSafeBush(game);
    if (bush) {
      const path = findPath(floor, px, py, bush.x, bush.y, game.doorOpen);
      const step = stepAlong(game, path);
      if (step) return step;
    }
    return waitOrDodge(game);
  }

  // Calm: pick a goal and rehearse the walk. Only set off when the whole
  // route is clear from this moment on; otherwise wait in a bush.
  const goal = pickGoal(game);
  if (!goal) return { ...IDLE };
  const goalKey = `${goal.x},${goal.y}`;

  if (pilot.plan && pilot.plan.goalKey === goalKey) {
    // Follow the rehearsed route, stepping to the next node once close.
    while (pilot.plan.nodeIdx < pilot.plan.nodes.length) {
      const cur = pilot.plan.nodes[pilot.plan.nodeIdx];
      if (Math.hypot(cur.x - player.x, cur.y - player.y) < 0.15) pilot.plan.nodeIdx++;
      else break;
    }
    const node = pilot.plan.nodes[pilot.plan.nodeIdx];
    if (!node) {
      pilot.plan = null;
    } else if (Math.hypot(node.x - player.x, node.y - player.y) > 1.2) {
      pilot.plan = null;
    } else {
      // Re-rehearse the rest of the route from where we actually are, but
      // only to catch real trouble: the walk never follows the plan exactly,
      // so a tight window shifting by a fraction of a second is not a
      // reason to throw the plan away. Abort only when even the next node
      // is no longer safely reachable.
      pilot.recheck = (pilot.recheck ?? 0) - dt;
      if (pilot.recheck <= 0) {
        pilot.recheck = 1.0;
        const rest = pilot.plan.nodes.slice(Math.max(0, pilot.plan.nodeIdx - 1));
        if (rehearse(game, rest).end < 1) pilot.plan = null;
      }
      if (pilot.plan) return keysToward(player, node);
    }
  }

  const route = findPath(floor, px, py, goal.x, goal.y, game.doorOpen);
  if (!route || route.length === 0) return { ...IDLE };
  const rehearsal = rehearse(game, route);
  if (rehearsal.end >= route.length - 1 && rehearsal.finalCalm) {
    pilot.waitTime = 0;
    pilot.plan = { goalKey, nodes: route, nodeIdx: 1 };
    return keysToward(player, route[1] ?? route[0]);
  }
  if (rehearsal.stage >= 2) {
    // Hop forward to the furthest safe waiting spot on the route, then
    // think again from there — a long walk becomes short safe hops.
    pilot.waitTime = 0;
    pilot.plan = { goalKey, nodes: route.slice(0, rehearsal.stage + 1), nodeIdx: 1 };
    return keysToward(player, route[1] ?? route[0]);
  }
  // Stage for the goal: creep to the bush nearest the goal and wait there
  // for the dash window, instead of waiting far away for one window to
  // cover the whole walk.
  const staging = stagingBushFor(game, goal);
  if (staging && (staging.x !== px || staging.y !== py)) {
    const sroute = findPath(floor, px, py, staging.x, staging.y, game.doorOpen);
    if (sroute && sroute.length > 1) {
      const sr = rehearse(game, sroute);
      if (sr.end >= sroute.length - 1 && sr.finalCalm) {
        pilot.waitTime = 0;
        pilot.plan = { goalKey, nodes: sroute, nodeIdx: 1 };
        return keysToward(player, sroute[1]);
      }
      if (sr.stage >= 2) {
        pilot.waitTime = 0;
        pilot.plan = { goalKey, nodes: sroute.slice(0, sr.stage + 1), nodeIdx: 1 };
        return keysToward(player, sroute[1]);
      }
    }
  }

  // No safe window yet: wait it out, preferably inside a bush. If we are
  // already on the guards' radar, retreat along an escape route instead of
  // creeping step by step.
  pilot.waitTime += dt;
  if (pilot.waitTime > boldAfter) {
    // Patience has its limits: take the route anyway, sneaking, for one run.
    pilot.waitTime = 0;
    pilot.plan = { goalKey, nodes: route, nodeIdx: 1 };
    return keysToward(player, route[1] ?? route[0]);
  }
  if (tileIsBush(floor, px, py)) return waitOrDodge(game);
  if (game.detection > 0 || hunted) {
    const bush = nearestSafeBush(game);
    if (bush) {
      const path = escapePath(game, bush.x, bush.y) ?? findPath(floor, px, py, bush.x, bush.y, game.doorOpen);
      if (path && path.length > 1) return keysToward(player, path[1], true);
    }
    return waitOrDodge(game);
  }
  const bush = nearestSafeBush(game);
  if (bush) {
    const path = findPath(floor, px, py, bush.x, bush.y, game.doorOpen);
    const step = stepAlong(game, path);
    if (step) return step;
  }
  return waitOrDodge(game);
}
