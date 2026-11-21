// The rules and the state, with no drawing and no browser in it: the thief,
// the guards, the gems, the keycard and the vault door, the clock and the
// score. stepWorld() moves everything one fixed step and reports what happened
// as bit flags, so the caller can react (sound, screens) without the world
// knowing about either.
import { FIELD_X, FIELD_Y, GUARD, SCORE, STEP, TILE } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { createPlayer, movePlayer } from './player.js';
import { createGuard, updateGuard } from './guards.js';
import { tileCenter } from './vision.js';

export const EVENT_GEM = 1;
export const EVENT_KEY = 2;
export const EVENT_DOOR = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_ALERT = 16;
export const EVENT_CAUGHT = 32;
export const EVENT_LEVEL = 64;
export const EVENT_WIN = 128;
export const EVENT_STEP = 256;

function countGems(floor) {
  return floor.rows.reduce(
    (total, line) => total + [...line].filter((mark) => mark === '*').length,
    0,
  );
}

function gap(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createWorld() {
  const world = {
    levelIndex: 0,
    level: null,
    grid: null,
    player: null,
    guards: [],
    exit: null,
    door: null,
    keycard: null,
    gems: [],
    doorOpen: false,
    hasKeycard: false,
    score: 0,
    levelScore: 0,
    time: 0,
    levelTime: 0,
    gemsTaken: 0,
    gemsTotal: 0,
    totalGemsTaken: 0,
    totalGems: LEVELS.reduce((sum, floor) => sum + countGems(floor), 0),
    status: 'playing',
    catchReason: '',
    maxSuspicion: 0,
    everSpotted: false,
    alarmLevel: 0,
    lastLevelBonus: 0,
    ghostBonus: 0,
    stepTick: 0,
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  const floor = LEVELS[index];
  const parsed = parseLevel(floor);
  world.levelIndex = index;
  world.level = floor;
  world.grid = parsed.grid;
  world.player = createPlayer(parsed.start);
  world.guards = parsed.spawns.map((spawn, i) =>
    createGuard(spawn, floor.routes[i], floor.pace),
  );
  world.exit = tileCenter(parsed.exit.col, parsed.exit.row);
  world.door = parsed.door ? tileCenter(parsed.door.col, parsed.door.row) : null;
  world.doorTile = parsed.door;
  world.keycard = parsed.keycard ? tileCenter(parsed.keycard.col, parsed.keycard.row) : null;
  world.keycardTile = parsed.keycard;
  world.gems = parsed.gems.map((gem) => ({ ...gem, pos: tileCenter(gem.col, gem.row) }));
  world.doorOpen = false;
  world.hasKeycard = false;
  world.levelScore = 0;
  world.levelTime = 0;
  world.gemsTaken = 0;
  world.gemsTotal = world.gems.length;
  world.status = 'playing';
  world.catchReason = '';
  world.maxSuspicion = 0;
  world.everSpotted = false;
  world.alarmLevel = 0;
}

// Start the whole campaign again from the first floor.
export function resetCampaign(world) {
  world.score = 0;
  world.time = 0;
  world.totalGemsTaken = 0;
  loadLevel(world, 0);
}

// Move the world one fixed step. `input` is { dx, dy, sneak, click }: dx/dy a
// unit direction (or 0) and click a point to walk toward, or null.
export function stepWorld(world, input, dt) {
  if (world.status !== 'playing') return 0;
  let events = 0;
  world.time += dt;
  world.levelTime += dt;

  // Steering: held keys win over a click target; arriving clears the target.
  let dx = input.dx;
  let dy = input.dy;
  if (dx === 0 && dy === 0 && input.click) {
    const toX = input.click.x - world.player.x;
    const toY = input.click.y - world.player.y;
    const len = Math.hypot(toX, toY);
    if (len < 6) {
      input.click = null;
    } else {
      dx = toX / len;
      dy = toY / len;
    }
  }
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  world.player.sneaking = !!input.sneak;
  movePlayer(world.player, world.grid, world.doorOpen, FIELD_X, FIELD_Y, dx, dy, dt);
  if (world.player.moving && !world.player.sneaking) {
    world.stepTick += 1;
    if (world.stepTick % 14 === 0) events |= EVENT_STEP;
  }

  // Pickups: gems first, then the keycard, then the door beside it.
  for (const gem of world.gems) {
    if (!gem.taken && gap(world.player, gem.pos) < TILE * 0.7) {
      gem.taken = true;
      world.gemsTaken += 1;
      world.totalGemsTaken += 1;
      world.score += SCORE.gem;
      world.levelScore += SCORE.gem;
      events |= EVENT_GEM;
    }
  }
  if (world.keycard && !world.hasKeycard && gap(world.player, world.keycard) < TILE * 0.7) {
    world.hasKeycard = true;
    world.keycard = null;
    world.score += SCORE.keycard;
    world.levelScore += SCORE.keycard;
    events |= EVENT_KEY;
  }
  if (world.doorTile && !world.doorOpen && world.hasKeycard && gap(world.player, world.door) < TILE * 0.9) {
    world.doorOpen = true;
    world.grid[world.doorTile.row][world.doorTile.col] = '.';
    events |= EVENT_DOOR;
  }

  // Guards: suspicion, moods, the catch.
  for (const guard of world.guards) {
    const outcome = updateGuard(guard, dt, world);
    world.maxSuspicion = Math.max(world.maxSuspicion, guard.suspicion);
    if (outcome === 'spotted') {
      world.everSpotted = true;
      events |= EVENT_SPOTTED;
    } else if (outcome === 'alerted') {
      world.everSpotted = true;
      events |= EVENT_ALERT;
    } else if (outcome === 'caught') {
      world.status = 'caught';
      world.catchReason = guard.suspicion >= GUARD.alertAt
        ? 'A guard ran you down.'
        : 'You walked straight into a guard.';
      return events | EVENT_CAUGHT;
    }
  }
  world.alarmLevel = world.guards.reduce((hot, guard) => Math.max(hot, guard.suspicion), 0);

  // The exit: open when there is no vault door, or once it stands open.
  if (world.status === 'playing' && gap(world.player, world.exit) < TILE * 0.7) {
    if (world.doorTile && !world.doorOpen) {
      // The vault door is still shut: the exit stays out of reach behind it.
    } else {
      const bonus = Math.max(
        0,
        Math.round((world.level.par - world.levelTime) * SCORE.levelTimeBonus),
      );
      world.score += bonus;
      world.levelScore += bonus;
      world.lastLevelBonus = bonus;
      if (world.levelIndex + 1 >= LEVELS.length) {
        if (!world.everSpotted) {
          world.score += SCORE.ghostBonus;
          world.ghostBonus = SCORE.ghostBonus;
        }
        world.status = 'won';
        return events | EVENT_WIN;
      }
      world.status = 'levelComplete';
      return events | EVENT_LEVEL;
    }
  }
  return events;
}

export { STEP };
