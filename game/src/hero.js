// Night Vault — the thief. Keyboard (WASD / arrows, hold Shift to sneak) and
// click-to-walk share one movement core: a desired direction plus a sneak
// flag, resolved against solid tiles axis by axis so you slide along walls.
import { TUNE } from './tune.js';
import { tileWalkable } from './floors.js';

export function makePlayer(spawn) {
  return {
    x: spawn.x + 0.5,
    y: spawn.y + 0.5,
    facing: 0,
    sneaking: false,
    moving: false,
    clickGoal: null,
    stepTimer: 0,
  };
}

const RADIUS = 0.32;

function blockedAt(floor, x, y, doorOpen) {
  // Circle-vs-tile check: any solid tile overlapped by the circle blocks.
  const x0 = Math.floor(x - RADIUS);
  const x1 = Math.floor(x + RADIUS);
  const y0 = Math.floor(y - RADIUS);
  const y1 = Math.floor(y + RADIUS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!tileWalkable(floor, tx, ty, doorOpen)) {
        const cx = Math.max(tx, Math.min(x, tx + 1));
        const cy = Math.max(ty, Math.min(y, ty + 1));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < RADIUS * RADIUS) return true;
      }
    }
  }
  return false;
}

// keys: {up,down,left,right,sneak} booleans. Returns true when a footstep
// sound should play (only while walking out loud, not sneaking).
export function playerUpdate(player, floor, dt, keys, doorOpen) {
  let mx = 0;
  let my = 0;
  if (keys.up) my -= 1;
  if (keys.down) my += 1;
  if (keys.left) mx -= 1;
  if (keys.right) mx += 1;
  if (mx === 0 && my === 0 && player.clickGoal) {
    const dx = player.clickGoal.x - player.x;
    const dy = player.clickGoal.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.12) {
      player.clickGoal = null;
    } else {
      mx = dx / dist;
      my = dy / dist;
    }
  }
  const len = Math.hypot(mx, my);
  player.moving = len > 0;
  player.sneaking = !!keys.sneak;
  if (!player.moving) return false;
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  player.facing = Math.atan2(my, mx);
  const speed = player.sneaking ? TUNE.sneakTilesPerSec : TUNE.walkTilesPerSec;
  const nx = player.x + mx * speed * dt;
  if (!blockedAt(floor, nx, player.y, doorOpen)) player.x = nx;
  const ny = player.y + my * speed * dt;
  if (!blockedAt(floor, player.x, ny, doorOpen)) player.y = ny;
  if (player.sneaking) {
    player.stepTimer = 0;
    return false;
  }
  player.stepTimer += dt;
  if (player.stepTimer >= TUNE.noiseStepEverySec) {
    player.stepTimer = 0;
    return true;
  }
  return false;
}
