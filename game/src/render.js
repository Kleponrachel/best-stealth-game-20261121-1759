// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x800 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Paint order: floor and props, night darkness with
// a pool of light around the thief, the guards' vision cones glowing in the
// dark, then the people, then the HUD and the screen panels.
import {
  COLS, FIELD_H, FIELD_W, FIELD_X, FIELD_Y, FONT, PALETTE, ROWS, TILE, VIEW_H, VIEW_W,
} from './config.js';
import { conePolygon } from './vision.js';
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
  const night = document.createElement('canvas');
  night.width = VIEW_W;
  night.height = VIEW_H;
  const nightCtx = night.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.width = Math.round(VIEW_W * scale);
    canvas.height = Math.round(VIEW_H * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }
  fit();
  window.addEventListener('resize', fit);

  // Two floor tones in a loose checker, so the grid reads at a glance.
  function checker(col, row) {
    return ((col * 31 + row * 17) % 2 === 0) ? PALETTE.floorA : PALETTE.floorB;
  }

  function paintFloor() {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = FIELD_X + col * TILE;
        const y = FIELD_Y + row * TILE;
        ctx.fillStyle = checker(col, row);
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
      }
    }
  }

  function paintProp(col, row, tile) {
    const x = FIELD_X + col * TILE;
    const y = FIELD_Y + row * TILE;
    if (tile === '#') {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + TILE - 4, TILE, 4);
      ctx.strokeStyle = PALETTE.wallEdge;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    } else if (tile === 'C') {
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + TILE / 2);
      ctx.lineTo(x + TILE - 4, y + TILE / 2);
      ctx.moveTo(x + TILE / 2, y + 4);
      ctx.lineTo(x + TILE / 2, y + TILE - 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 4, y + TILE - 8, TILE - 8, 4);
    } else if (tile === 'B') {
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bushLeaf;
      const spots = [[-8, -6], [7, -8], [9, 6], [-7, 8], [0, 0]];
      for (const [ox, oy] of spots) {
        ctx.beginPath();
        ctx.arc(x + TILE / 2 + ox, y + TILE / 2 + oy, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tile === 'D') {
      // A round vault dial: a ring, four spokes and the word LOCKED.
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      ctx.fillStyle = PALETTE.door;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = '#d9a83c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 12);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', cx, y + TILE - 5);
    }
  }

  function paintExit(world, now) {
    const { x, y } = world.exit;
    const glow = 0.5 + 0.5 * Math.sin(now * 3);
    ctx.save();
    ctx.shadowColor = PALETTE.exitGlow;
    ctx.shadowBlur = 16 + glow * 12;
    ctx.fillStyle = PALETTE.exit;
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#062b16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#062b16';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', x, y + 4);
  }

  // Aurora gems are little hexagons that bob and glitter.
  function paintGem(gem, now) {
    if (gem.taken) return;
    const { x, y } = gem.pos;
    const bob = Math.sin(now * 2.5 + gem.col * 1.7) * 2;
    ctx.save();
    ctx.shadowColor = PALETTE.gem;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.gem;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * 10;
      const py = y + bob + Math.sin(a) * 10;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.arc(x, y + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintCard(world, now) {
    if (!world.keycard) return;
    const { x, y } = world.keycard;
    const bob = Math.sin(now * 3) * 2;
    ctx.save();
    ctx.shadowColor = PALETTE.keycard;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.keycard;
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 8 + bob, 24, 16, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#06283a';
    ctx.fillRect(x - 8, y - 4 + bob, 9, 3);
    ctx.fillRect(x - 8, y + 1 + bob, 13, 2);
  }

  // Night: a translucent veil over everything, with holes of light punched
  // around the thief and the exit.
  function paintNight(world) {
    nightCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    nightCtx.globalCompositeOperation = 'source-over';
    nightCtx.fillStyle = 'rgba(3, 5, 12, 0.5)';
    nightCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    nightCtx.globalCompositeOperation = 'destination-out';
    const pool = (x, y, r) => {
      const g = nightCtx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      nightCtx.fillStyle = g;
      nightCtx.beginPath();
      nightCtx.arc(x, y, r, 0, Math.PI * 2);
      nightCtx.fill();
    };
    pool(world.player.x, world.player.y, 270);
    pool(world.exit.x, world.exit.y, 120);
    ctx.drawImage(night, 0, 0);
  }

  function paintCone(world, guard) {
    const points = conePolygon(world.grid, guard, world.doorOpen);
    const fill = guard.mood === MOOD_CHASE
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
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function paintGuard(guard) {
    ctx.save();
    ctx.shadowColor = 'rgba(229, 83, 75, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Visor slit showing where the guard looks.
    ctx.strokeStyle = '#ffd6d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.facing) * 6, guard.y + Math.sin(guard.facing) * 6);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 15, guard.y + Math.sin(guard.facing) * 15);
    ctx.stroke();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x - Math.cos(guard.facing) * 3, guard.y - Math.sin(guard.facing) * 3, 6, 0, Math.PI * 2);
    ctx.fill();
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

  function paintThief(player) {
    const r = player.sneaking ? 11 : 13;
    ctx.save();
    ctx.shadowColor = 'rgba(232, 236, 244, 0.7)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hood: a darker cap with a pale face slit toward the facing.
    ctx.fillStyle = PALETTE.playerHood;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.facing) * (r - 5), player.y + Math.sin(player.facing) * (r - 5));
    ctx.lineTo(player.x + Math.cos(player.facing) * (r + 3), player.y + Math.sin(player.facing) * (r + 3));
    ctx.stroke();
    const tag = player.hidden ? 'HIDDEN' : player.sneaking ? 'SNEAK' : null;
    if (tag) {
      ctx.font = `bold ${player.hidden ? 12 : 11}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = player.hidden ? PALETTE.ok : PALETTE.muted;
      ctx.fillText(tag, player.x, player.y - r - 8);
    }
  }

  // Expanding ring while the thief walks loud: footsteps carry.
  function paintRipple(player, now) {
    if (!player.moving || player.sneaking) return;
    const phase = (now % 0.9) / 0.9;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * (1 - phase)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20 + phase * 90, 0, Math.PI * 2);
    ctx.stroke();
  }

  function paintMarker(click, now) {
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

  // The HUD: floor name left, the detection meter and the noise bar in the
  // middle, gems, keycard, score and the clock right. `noise` is 0..1, fed by
  // the loop: it climbs while the thief walks loud and drains while sneaking
  // or standing still.
  function paintHud(world, noise) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, VIEW_W, FIELD_Y - 8);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, FIELD_Y - 8, VIEW_W, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`NIGHT VAULT — ${world.level.title}`, 24, 30);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(world.level.blurb, 24, 52);

    // Detection meter: the hottest guard's suspicion.
    const meterX = 480;
    const meterW = 320;
    const heat = world.alarmLevel;
    const label = heat >= 100 ? 'HUNTED' : heat >= 45 ? 'SUSPICIOUS' : 'UNDETECTED';
    const labelColor = heat >= 100 ? PALETTE.danger : heat >= 45 ? PALETTE.warn : PALETTE.ok;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('DETECTION', meterX, 22);
    ctx.fillStyle = '#141a2a';
    ctx.fillRect(meterX, 28, meterW, 14);
    ctx.fillStyle = labelColor;
    ctx.fillRect(meterX, 28, meterW * Math.min(1, heat / 100), 14);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.strokeRect(meterX + 0.5, 28.5, meterW, 14);
    ctx.fillStyle = labelColor;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(label, meterX + meterW + 10, 41);

    // Alert pips: one dot per guard, coloured by its mood right now.
    let pipX = meterX + meterW + 118;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('ALERT', pipX, 22);
    pipX += 52;
    for (const guard of world.guards) {
      ctx.fillStyle = guard.mood === MOOD_CHASE
        ? PALETTE.danger
        : guard.mood === MOOD_INVESTIGATE
          ? PALETTE.warn
          : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(pipX, 35, 5, 0, Math.PI * 2);
      ctx.fill();
      pipX += 16;
    }

    // Noise bar: how loud the thief's footsteps are right now.
    const loud = (noise ?? 0) > 0.66;
    ctx.fillStyle = loud ? PALETTE.danger : PALETTE.muted;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText(loud ? 'NOISE — LOUD' : 'NOISE', meterX, 58);
    ctx.fillStyle = '#141a2a';
    ctx.fillRect(meterX, 62, meterW, 8);
    ctx.fillStyle = loud ? PALETTE.danger : '#9aa5bb';
    ctx.fillRect(meterX, 62, meterW * Math.min(1, Math.max(0, noise ?? 0)), 8);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.strokeRect(meterX + 0.5, 62.5, meterW, 8);

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

  function paintPanel(x, y, w, h) {
    ctx.fillStyle = 'rgba(7, 10, 18, 0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function paintTitle(world, best) {
    ctx.fillStyle = 'rgba(3, 5, 12, 0.55)';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    paintPanel(VIEW_W / 2 - 330, 190, 660, 400);
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

  function paintPaused() {
    ctx.fillStyle = 'rgba(3, 5, 12, 0.6)';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    paintPanel(VIEW_W / 2 - 200, 320, 400, 130);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText('PAUSED', VIEW_W / 2, 372);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P or ESC to resume · M to mute', VIEW_W / 2, 404);
    ctx.textAlign = 'left';
  }

  function paintCleared(world) {
    paintPanel(VIEW_W / 2 - 260, 260, 520, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('FLOOR CLEAR', VIEW_W / 2, 316);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(`${world.level.title} — gems ${world.gemsTaken}/${world.gemsTotal}`, VIEW_W / 2, 352);
    ctx.fillText(`Time bonus +${world.lastLevelBonus} · Score ${world.score}`, VIEW_W / 2, 380);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    const nextTitle = LEVELS[world.levelIndex + 1] ? LEVELS[world.levelIndex + 1].title : '';
    ctx.fillText(`Next: ${nextTitle}`, VIEW_W / 2, 414);
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('Press SPACE for the next floor', VIEW_W / 2, 452);
    ctx.textAlign = 'left';
  }

  function paintCaught(world) {
    paintPanel(VIEW_W / 2 - 260, 260, 520, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('CAUGHT', VIEW_W / 2, 316);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(world.catchReason, VIEW_W / 2, 352);
    ctx.fillText(`${world.level.title} · Score ${world.score}`, VIEW_W / 2, 380);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('Stay out of the yellow cones. Sneak with SHIFT, hide in bushes.', VIEW_W / 2, 414);
    ctx.fillStyle = PALETTE.ok;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('Press SPACE to try again', VIEW_W / 2, 452);
    ctx.textAlign = 'left';
  }

  function paintWon(world, best) {
    paintPanel(VIEW_W / 2 - 300, 220, 600, 320);
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

  function paintToast(banner, now) {
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
    draw(world, screen, best, now, banner, clickTarget, noise) {
      const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      paintFloor();
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          paintProp(col, row, world.grid[row][col]);
        }
      }
      paintExit(world, now);
      for (const gem of world.gems) paintGem(gem, now);
      paintCard(world, now);
      paintNight(world);
      for (const guard of world.guards) paintCone(world, guard);
      for (const guard of world.guards) paintGuard(guard);
      paintThief(world.player);
      paintRipple(world.player, now);
      paintMarker(clickTarget, now);
      paintHud(world, noise);
      if (screen === SCREEN_TITLE) paintTitle(world, best);
      else if (screen === SCREEN_PAUSED) paintPaused();
      else if (screen === SCREEN_LEVEL) paintCleared(world);
      else if (screen === SCREEN_CAUGHT) paintCaught(world);
      else if (screen === SCREEN_WON) paintWon(world, best);
      if (screen === SCREEN_PLAY) paintToast(banner, now);
    },
  };
}
