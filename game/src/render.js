// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x800 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Order: floor and cover, night darkness with a pool of
// light around the player, the guards' vision cones glowing in the dark, then the
// people, then the HUD and the screen panels.
import {
  COLS, FIELD_H, FIELD_W, FIELD_X, FIELD_Y, FONT, PALETTE, ROWS, TILE, VIEW_H, VIEW_W,
} from './config.js';
import { conePolygon, tileCenter } from './vision.js';
import { LEVELS } from './levels.js';
import { MOOD_CHASE, MOOD_INVESTIGATE } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WON = 'won';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = VIEW_W;
  dark.height = VIEW_H;
  const darkCtx = dark.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.width = Math.round(VIEW_W * scale);
    canvas.height = Math.round(VIEW_H * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }
  fit();
  window.addEventListener('resize', fit);

  function shade(col, row) {
    const h = (col * 73 + row * 149) % 5;
    return h === 0 ? PALETTE.floorB : PALETTE.floorA;
  }

  function drawFloor(world) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = FIELD_X + col * TILE;
        const y = FIELD_Y + row * TILE;
        ctx.fillStyle = shade(col, row);
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
      }
    }
  }

  function drawTileObject(world, col, row, tile) {
    const x = FIELD_X + col * TILE;
    const y = FIELD_Y + row * TILE;
    if (tile === '#') {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(x, y, TILE, 6);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    } else if (tile === 'C') {
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + TILE - 3, y + TILE - 3);
      ctx.moveTo(x + TILE - 3, y + 3);
      ctx.lineTo(x + 3, y + TILE - 3);
      ctx.stroke();
    } else if (tile === 'B') {
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bushLeaf;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + col;
        ctx.beginPath();
        ctx.arc(x + TILE / 2 + Math.cos(a) * 9, y + TILE / 2 + Math.sin(a) * 9, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tile === 'D') {
      ctx.fillStyle = PALETTE.door;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#d9a83c';
      ctx.fillRect(x + TILE / 2 - 2, y + 6, 4, TILE - 12);
      ctx.fillStyle = '#fff3c4';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LOCK', x + TILE / 2, y + TILE - 8);
    }
  }

  function drawExit(world, now) {
    const { x, y } = world.exit;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3);
    ctx.save();
    ctx.shadowColor = PALETTE.exitGlow;
    ctx.shadowBlur = 18 + pulse * 10;
    ctx.fillStyle = PALETTE.exit;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#062b16';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', x, y + 4);
  }

  function drawGem(gem, now) {
    if (gem.taken) return;
    const { x, y } = gem.pos;
    const bob = Math.sin(now * 2.5 + gem.col) * 2;
    ctx.save();
    ctx.shadowColor = PALETTE.gem;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.gem;
    ctx.beginPath();
    ctx.moveTo(x, y - 10 + bob);
    ctx.lineTo(x + 8, y + bob);
    ctx.lineTo(x, y + 10 + bob);
    ctx.lineTo(x - 8, y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.moveTo(x, y - 5 + bob);
    ctx.lineTo(x + 3, y + bob);
    ctx.lineTo(x, y + 5 + bob);
    ctx.lineTo(x - 3, y + bob);
    ctx.closePath();
    ctx.fill();
  }

  function drawKeycard(world, now) {
    if (!world.keycard) return;
    const { x, y } = world.keycard;
    const bob = Math.sin(now * 3) * 2;
    ctx.save();
    ctx.shadowColor = PALETTE.keycard;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.keycard;
    ctx.fillRect(x - 11, y - 7 + bob, 22, 14);
    ctx.restore();
    ctx.fillStyle = '#06283a';
    ctx.fillRect(x - 7, y - 3 + bob, 8, 3);
    ctx.fillRect(x - 7, y + 2 + bob, 12, 2);
  }

  function drawDarkness(world) {
    darkCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    darkCtx.globalCompositeOperation = 'source-over';
    darkCtx.fillStyle = 'rgba(3, 5, 12, 0.48)';
    darkCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    darkCtx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => {
      const g = darkCtx.createRadialGradient(x, y, r * 0.25, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      darkCtx.fillStyle = g;
      darkCtx.beginPath();
      darkCtx.arc(x, y, r, 0, Math.PI * 2);
      darkCtx.fill();
    };
    hole(world.player.x, world.player.y, 280);
    hole(world.exit.x, world.exit.y, 110);
    ctx.drawImage(dark, 0, 0);
  }

  function drawCone(world, guard) {
    const points = conePolygon(world.grid, guard, world.doorOpen);
    const color = guard.mood === MOOD_CHASE
      ? PALETTE.coneAlert
      : guard.mood === MOOD_INVESTIGATE
        ? PALETTE.coneSuspicious
        : PALETTE.coneCalm;
    const edge = guard.mood === MOOD_CHASE
      ? 'rgba(255, 70, 60, 0.5)'
      : guard.mood === MOOD_INVESTIGATE
        ? 'rgba(255, 150, 50, 0.45)'
        : PALETTE.coneCalmEdge;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawGuard(guard, now) {
    ctx.save();
    ctx.shadowColor = 'rgba(229, 83, 75, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 8, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick: where the guard looks.
    ctx.strokeStyle = '#ffd6d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.facing) * 10, guard.y + Math.sin(guard.facing) * 10);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 20, guard.y + Math.sin(guard.facing) * 20);
    ctx.stroke();
    // Suspicion ring above the head.
    if (guard.suspicion > 2) {
      const frac = guard.suspicion / 100;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 24, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = frac > 0.7 ? PALETTE.danger : PALETTE.warn;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 24, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
    const mark = guard.mood === MOOD_CHASE ? '!' : guard.mood === MOOD_INVESTIGATE ? '?' : null;
    if (mark) {
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = mark === '!' ? PALETTE.danger : PALETTE.warn;
      ctx.fillText(mark, guard.x, guard.y - 34);
    }
  }

  function drawPlayer(player, now) {
    const r = player.sneaking ? 11 : 13;
    ctx.save();
    ctx.shadowColor = 'rgba(232, 236, 244, 0.7)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.playerHood;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.facing) * (r - 4), player.y + Math.sin(player.facing) * (r - 4));
    ctx.lineTo(player.x + Math.cos(player.facing) * (r + 4), player.y + Math.sin(player.facing) * (r + 4));
    ctx.stroke();
    if (player.hidden) {
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.ok;
      ctx.fillText('HIDDEN', player.x, player.y - r - 8);
    } else if (player.sneaking) {
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('SNEAK', player.x, player.y - r - 8);
    }
  }

  function drawNoiseRing(player, now) {
    if (!player.moving || player.sneaking) return;
    const phase = (now % 0.9) / 0.9;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * (1 - phase)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20 + phase * 90, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawClickTarget(click, now) {
    if (!click) return;
    const pulse = 0.5 + 0.5 * Math.sin(now * 6);
    ctx.strokeStyle = `rgba(238, 241, 245, ${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(click.x, click.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(click.x - 12, click.y);
    ctx.lineTo(click.x + 12, click.y);
    ctx.moveTo(click.x, click.y - 12);
    ctx.lineTo(click.x, click.y + 12);
    ctx.stroke();
  }

  function drawHud(world, best) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, VIEW_W, FIELD_Y - 8);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, FIELD_Y - 8, VIEW_W, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`NIGHT VAULT — ${world.level.name}`, 24, 30);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(world.level.sub, 24, 52);

    // Detection meter, centre: the hottest guard's suspicion.
    const meterX = 470;
    const meterW = 340;
    const level = world.alarmLevel;
    const label = level >= 100 ? 'HUNTED' : level >= 45 ? 'SUSPICIOUS' : 'UNDETECTED';
    const labelColor = level >= 100 ? PALETTE.danger : level >= 45 ? PALETTE.warn : PALETTE.ok;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('DETECTION', meterX, 24);
    ctx.fillStyle = '#141a2a';
    ctx.fillRect(meterX, 32, meterW, 16);
    ctx.fillStyle = labelColor;
    ctx.fillRect(meterX, 32, meterW * Math.min(1, level / 100), 16);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.strokeRect(meterX + 0.5, 32.5, meterW, 16);
    ctx.fillStyle = labelColor;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(label, meterX + meterW + 12, 45);

    // Right side: gems, keycard, score, time.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 18px ${FONT}`;
    const mm = Math.floor(world.time / 60);
    const ss = String(Math.floor(world.time % 60)).padStart(2, '0');
    ctx.fillText(`◆ ${world.gemsTaken}/${world.gemsTotal}`, 1060, 30);
    ctx.fillText(`${mm}:${ss}`, 1060, 54);
    ctx.fillStyle = world.hasKeycard ? PALETTE.keycard : PALETTE.muted;
    ctx.fillText(world.hasKeycard ? '▣ KEYCARD' : '▢ KEYCARD', 1180, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${world.score}`, 1180, 54);
    ctx.textAlign = 'left';
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(7, 10, 18, 0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  function drawTitle(world, best) {
    ctx.fillStyle = 'rgba(3, 5, 12, 0.55)';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    panel(VIEW_W / 2 - 330, 190, 660, 400);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('NIGHT VAULT', VIEW_W / 2, 260);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('A stealth game in three floors of the Meridian Gallery', VIEW_W / 2, 292);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    const lines = [
      'Steal the aurora gems and reach the green EXIT — unseen.',
      'WASD / arrows to move · hold SHIFT to sneak · click the floor to walk there',
      'Yellow cones are a guard’s eyes. Walls, crates and bushes block them.',
      'Bushes hide you. Walking is loud — guards hear footsteps nearby.',
      'Floors 2 and 3 lock the exit behind a vault door: find the blue keycard.',
      'Fill the detection meter and the guards run you down. Never get spotted',
      'on the last floor for a GHOST bonus.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 330 + i * 24));
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = PALETTE.ok;
    ctx.fillText(best > 0 ? `Best score ${best} — click or press SPACE to play` : 'Click or press SPACE to play', VIEW_W / 2, 540);
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(3, 5, 12, 0.6)';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    panel(VIEW_W / 2 - 200, 320, 400, 130);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText('PAUSED', VIEW_W / 2, 372);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P or ESC to resume · M to mute', VIEW_W / 2, 404);
    ctx.textAlign = 'left';
  }

  function drawLevelDone(world) {
    panel(VIEW_W / 2 - 260, 260, 520, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('FLOOR CLEAR', VIEW_W / 2, 316);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(`${world.level.name} — gems ${world.gemsTaken}/${world.gemsTotal}`, VIEW_W / 2, 352);
    ctx.fillText(`Time bonus +${world.lastLevelBonus} · Score ${world.score}`, VIEW_W / 2, 380);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    const nextName = LEVELS[world.levelIndex + 1] ? LEVELS[world.levelIndex + 1].name : '';
    ctx.fillText(`Next: ${nextName}`, VIEW_W / 2, 414);
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('Press SPACE for the next floor', VIEW_W / 2, 452);
    ctx.textAlign = 'left';
  }

  function drawCaught(world) {
    panel(VIEW_W / 2 - 260, 260, 520, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('CAUGHT', VIEW_W / 2, 316);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(world.catchReason, VIEW_W / 2, 352);
    ctx.fillText(`${world.level.name} · Score ${world.score}`, VIEW_W / 2, 380);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('Stay out of the yellow cones. Sneak with SHIFT, hide in bushes.', VIEW_W / 2, 414);
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('Press SPACE to try again', VIEW_W / 2, 452);
    ctx.textAlign = 'left';
  }

  function drawWon(world, best) {
    panel(VIEW_W / 2 - 300, 220, 600, 320);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText('THE VAULT IS YOURS', VIEW_W / 2, 282);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    const mm = Math.floor(world.time / 60);
    const ss = String(Math.floor(world.time % 60)).padStart(2, '0');
    ctx.fillText(`All three floors cleared in ${mm}:${ss}`, VIEW_W / 2, 322);
    ctx.fillText(`Gems ${world.totalGemsTaken}/${world.totalGems} · Score ${world.score}`, VIEW_W / 2, 350);
    if (world.ghostBonus > 0) {
      ctx.fillStyle = PALETTE.gem;
      ctx.fillText(`GHOST bonus +${world.ghostBonus} — never spotted on the last floor`, VIEW_W / 2, 378);
    }
    ctx.fillStyle = best >= world.score ? PALETTE.muted : PALETTE.gem;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(best >= world.score ? `Best score ${best}` : 'NEW BEST SCORE', VIEW_W / 2, 414);
    ctx.fillStyle = PALETTE.ok;
    ctx.fillText('Press SPACE to play again', VIEW_W / 2, 452);
    ctx.textAlign = 'left';
  }

  function drawBanner(banner, now) {
    if (!banner || now > banner.until) return;
    const alpha = Math.min(1, (banner.until - now) / 0.5, (now - banner.from) / 0.3 + 1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(banner.title, VIEW_W / 2, 200);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(banner.sub, VIEW_W / 2, 228);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  return {
    draw(world, screen, best, now, banner, clickTarget) {
      const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawFloor(world);
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          drawTileObject(world, col, row, world.grid[row][col]);
        }
      }
      drawExit(world, now);
      for (let i = 0; i < world.gems.length; i += 1) drawGem(world.gems[i], now);
      drawKeycard(world, now);
      drawDarkness(world);
      for (let i = 0; i < world.guards.length; i += 1) drawCone(world, world.guards[i]);
      for (let i = 0; i < world.guards.length; i += 1) drawGuard(world.guards[i], now);
      drawPlayer(world.player, now);
      drawNoiseRing(world.player, now);
      drawClickTarget(clickTarget, now);
      drawHud(world, best);
      if (screen === SCREEN_TITLE) drawTitle(world, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_LEVEL) drawLevelDone(world);
      else if (screen === SCREEN_CAUGHT) drawCaught(world);
      else if (screen === SCREEN_WON) drawWon(world, best);
      if (screen === SCREEN_PLAY) drawBanner(banner, now);
    },
  };
}
