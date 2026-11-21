// The player: one hooded infiltrator. Movement is axis-separated against the tile
// grid, so sliding along a wall feels right and a corner never swallows the player.
// Sneaking is slower and silent; walking is faster and loud.
import { PLAYER, TILE } from './config.js';
import { tileCenter, tileOf } from './vision.js';
import { isSolidTile } from './levels.js';

export function createPlayer(start) {
  const pos = tileCenter(start.col, start.row);
  return {
    x: pos.x,
    y: pos.y,
    facing: 0,
    moving: false,
    sneaking: false,
    hidden: false,
    stepPhase: 0,
  };
}

// Move the player by a unit direction for `dt` seconds. Walls stop each axis on
// its own, so pressing into a wall while sliding along it still moves the player.
export function movePlayer(player, grid, doorOpen, fieldX, fieldY, dx, dy, dt) {
  const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const radius = PLAYER.radius;
  const blocked = (x, y) => {
    const left = Math.floor((x - radius - fieldX) / TILE);
    const right = Math.floor((x + radius - fieldX) / TILE);
    const top = Math.floor((y - radius - fieldY) / TILE);
    const bottom = Math.floor((y + radius - fieldY) / TILE);
    for (let row = top; row <= bottom; row += 1) {
      for (let col = left; col <= right; col += 1) {
        if (col < 0 || col >= grid[0].length || row < 0 || row >= grid.length) return true;
        if (isSolidTile(grid[row][col], doorOpen)) {
          const tileLeft = fieldX + col * TILE;
          const tileTop = fieldY + row * TILE;
          const nearestX = Math.max(tileLeft, Math.min(x, tileLeft + TILE));
          const nearestY = Math.max(tileTop, Math.min(y, tileTop + TILE));
          if (Math.hypot(x - nearestX, y - nearestY) < radius) return true;
        }
      }
    }
    return false;
  };
  let moved = 0;
  if (dx !== 0) {
    const nx = player.x + dx * speed * dt;
    if (!blocked(nx, player.y)) {
      player.x = nx;
      moved += Math.abs(dx);
    }
  }
  if (dy !== 0) {
    const ny = player.y + dy * speed * dt;
    if (!blocked(player.x, ny)) {
      player.y = ny;
      moved += Math.abs(dy);
    }
  }
  player.moving = moved > 0;
  if (player.moving) {
    player.facing = Math.atan2(dy, dx);
    player.stepPhase += speed * dt;
  }
  const tile = tileOf(player.x, player.y);
  player.hidden =
    tile.col >= 0 && tile.col < grid[0].length && tile.row >= 0 && tile.row < grid.length
      ? grid[tile.row][tile.col] === 'B'
      : false;
  return player.moving;
}
