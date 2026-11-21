// Night Vault — paint. Draws the gallery top-down on a canvas: checkerboard
// floor, walls, crates, bushes, gems, the keycard, the vault door, the exit,
// each guard's yellow vision cone, and the HUD with the alarm meter, the
// noise bar, the gem count, the score, the floor and the clock. Overlays
// cover the title, caught, floor-clear and win screens.
import { TUNE, PALETTE } from './tune.js';

const TILE = TUNE.tilePx;
const OX = 120;
const OY = 80;

function tileToPx(x, y) {
  return { x: OX + x * TILE, y: OY + y * TILE };
}

function drawCone(ctx, guard) {
  const half = (TUNE.sightHalfAngleDeg * Math.PI) / 180;
  const range = TUNE.sightRangeTiles * TILE;
  ctx.beginPath();
  ctx.moveTo(OX + guard.x * TILE, OY + guard.y * TILE);
  ctx.arc(OX + guard.x * TILE, OY + guard.y * TILE, range, guard.facing - half, guard.facing + half);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cone;
  ctx.fill();
  ctx.strokeStyle = PALETTE.coneEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGuard(ctx, guard) {
  drawCone(ctx, guard);
  const cx = OX + guard.x * TILE;
  const cy = OY + guard.y * TILE;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.guard;
  ctx.fill();
  ctx.strokeStyle = '#7d1f1f';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Eyes: a short tick showing which way the guard faces.
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(guard.facing) * 17, cy + Math.sin(guard.facing) * 17);
  ctx.strokeStyle = '#ffd6d6';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawPlayer(ctx, player) {
  const cx = OX + player.x * TILE;
  const cy = OY + player.y * TILE;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.player;
  ctx.fill();
  ctx.strokeStyle = PALETTE.playerRing;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(player.facing) * 16, cy + Math.sin(player.facing) * 16);
  ctx.strokeStyle = PALETTE.playerRing;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawGem(ctx, x, y, t) {
  const c = tileToPx(x, y);
  const cx = c.x + TILE / 2;
  const cy = c.y + TILE / 2 + Math.sin(t * 3 + x) * 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.gem;
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = '#0b3f3c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.restore();
}

function overlay(ctx, title, lines, color) {
  ctx.fillStyle = 'rgba(8, 11, 15, 0.72)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(title, 640, 330);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '22px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 640, 390 + i * 34));
}

export function render(ctx, game, t) {
  const floor = game.floor;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, 1280, 800);

  // Floor tiles.
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const c = tileToPx(x, y);
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(c.x, c.y, TILE, TILE);
    }
  }
  // Walls, crates and bushes.
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const c = tileToPx(x, y);
      if (floor.solid[y][x]) {
        const isCrate = floor.crate[y][x];
        ctx.fillStyle = isCrate ? PALETTE.crate : PALETTE.wall;
        ctx.fillRect(c.x + 1, c.y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = isCrate ? PALETTE.crateEdge : PALETTE.wallTop;
        ctx.fillRect(c.x + 1, c.y + 1, TILE - 2, 5);
      } else if (floor.bush[y][x]) {
        ctx.fillStyle = PALETTE.bush;
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2, c.y + TILE / 2, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.bushLeaf;
        ctx.beginPath();
        ctx.arc(c.x + 14, c.y + 16, 7, 0, Math.PI * 2);
        ctx.arc(c.x + 26, c.y + 24, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Vault door.
  if (floor.door) {
    const c = tileToPx(floor.door.x, floor.door.y);
    ctx.fillStyle = game.doorOpen ? PALETTE.doorOpen : PALETTE.doorClosed;
    ctx.fillRect(c.x + 3, c.y + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = '#20262e';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 8, c.y + 8, TILE - 16, TILE - 16);
    if (!game.doorOpen) {
      ctx.fillStyle = '#20262e';
      ctx.beginPath();
      ctx.arc(c.x + TILE / 2, c.y + TILE / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Exit pad.
  if (floor.exit) {
    const c = tileToPx(floor.exit.x, floor.exit.y);
    ctx.fillStyle = 'rgba(46, 230, 107, 0.25)';
    ctx.fillRect(c.x + 2, c.y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(c.x + 4, c.y + 4, TILE - 8, TILE - 8);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', c.x + TILE / 2, c.y + TILE / 2 + 4);
  }
  // Keycard.
  if (floor.keycard && !game.hasKeycard) {
    const c = tileToPx(floor.keycard.x, floor.keycard.y);
    ctx.fillStyle = PALETTE.keycard;
    ctx.fillRect(c.x + 12, c.y + 8, 16, 24);
    ctx.fillStyle = '#dbeeff';
    ctx.fillRect(c.x + 15, c.y + 12, 10, 4);
  }
  for (const gem of floor.gems) {
    if (!gem.taken) drawGem(ctx, gem.x, gem.y, t);
  }
  for (const guard of game.guards) drawGuard(ctx, guard);
  drawPlayer(ctx, game.player);

  drawHud(ctx, game);
  if (game.status === 'title') {
    overlay(ctx, 'NIGHT VAULT', [
      'Meridian Gallery — three floors, thirteen gems, one way out.',
      'WASD or arrows to move — hold Shift to sneak — click the floor to walk there.',
      'Stay out of the yellow cones. Bushes hide you. Silence is survival.',
      'Press Enter or click to begin.',
    ], '#ffd640');
  } else if (game.status === 'caught') {
    overlay(ctx, 'CAUGHT', [
      `The guards closed in on floor ${game.floor.floorNo}.`,
      `Score: ${game.score} — press R to try this floor again.`,
    ], PALETTE.alert);
  } else if (game.status === 'clear') {
    overlay(ctx, 'FLOOR CLEAR', [
      `${floor.name} cleared — score ${game.score}.`,
      'Next floor loading…',
    ], PALETTE.calm);
  } else if (game.status === 'won') {
    const ghost = game.seenEver ? '' : '  GHOST bonus +400 — never spotted.';
    overlay(ctx, 'THE VAULT IS YOURS', [
      `All three floors cleared. Final score: ${game.score}.${ghost}`,
      'Press R to play again.',
    ], '#ffd640');
  }
}

function drawHud(ctx, game) {
  const floor = game.floor;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, 1280, 70);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`NIGHT VAULT — Floor ${floor.floorNo}: ${floor.name}`, 24, 30);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`Gems ${game.gemsGot}/13   Score ${game.score}   Time ${Math.floor(game.time)}s`, 24, 56);

  // Alarm meter.
  const mx = 700;
  ctx.fillStyle = '#2a323c';
  ctx.fillRect(mx, 18, 220, 16);
  const heat = game.detection / 100;
  ctx.fillStyle = heat < 0.5 ? '#e8b93b' : PALETTE.alert;
  ctx.fillRect(mx, 18, 220 * heat, 16);
  ctx.strokeStyle = '#55606c';
  ctx.strokeRect(mx, 18, 220, 16);
  ctx.fillStyle = game.detection >= 50 ? PALETTE.alert : PALETTE.hudText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(game.detection >= 100 ? 'ALERT — RUN' : game.detection >= 50 ? 'SUSPICIOUS' : 'UNSEEN', mx + 232, 31);

  // Noise bar.
  const nx = 700;
  ctx.fillStyle = '#2a323c';
  ctx.fillRect(nx, 44, 220, 10);
  ctx.fillStyle = '#7fb2ff';
  ctx.fillRect(nx, 44, 220 * game.noise, 10);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('NOISE', nx + 232, 53);
  if (game.hasKeycard) {
    ctx.fillStyle = PALETTE.keycard;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('KEYCARD ✓', 1080, 31);
  }
  if (game.doorOpen) {
    ctx.fillStyle = PALETTE.doorOpen;
    ctx.fillText('VAULT OPEN', 1080, 53);
  }
}
