// Night Vault — shell. Wires the canvas, the keyboard, the mouse and the
// game loop together, and hands the ?shot= and ?pilot= queries to the
// modules that own them. The simulation itself lives in realm.js; this file
// only feeds it input and draws what comes back.
import { makeGame, tick, loadFloor } from './realm.js';
import { render } from './paint.js';
import { decide } from './pilot.js';
import { applyShot } from './shots.js';
import { playEvent, unlockAudio } from './beep.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = makeGame();
window.__game = game;

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const pilotOn = params.get('pilot') === '1';
if (shot) {
  applyShot(game, shot);
} else if (params.get('seed')) {
  game.status = 'play';
}

const keys = { up: false, down: false, left: false, right: false, sneak: false };

function keyFlag(code) {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'up';
    case 'KeyS':
    case 'ArrowDown':
      return 'down';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'sneak';
    default:
      return null;
  }
}

window.addEventListener('keydown', (e) => {
  const flag = keyFlag(e.code);
  if (flag) {
    keys[flag] = true;
    e.preventDefault();
  }
  unlockAudio();
  if (e.code === 'Enter' && game.status === 'title') {
    game.status = 'play';
  }
  if (e.code === 'KeyR' && (game.status === 'caught' || game.status === 'won')) {
    const fresh = makeGame();
    Object.assign(game, fresh);
    game.status = 'play';
  }
});

window.addEventListener('keyup', (e) => {
  const flag = keyFlag(e.code);
  if (flag) keys[flag] = false;
});

// Click the floor to walk there; clicking the title starts the game.
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (game.status === 'title') {
    game.status = 'play';
    return;
  }
  if (game.status !== 'play') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const tx = Math.floor((px - 120) / 40);
  const ty = Math.floor((py - 80) / 40);
  if (tx >= 0 && ty >= 0 && tx < game.floor.width && ty < game.floor.height) {
    game.player.clickGoal = { x: tx + 0.5, y: ty + 0.5 };
  }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let input = keys;
  if (pilotOn && game.status === 'play') {
    const auto = decide(game, dt, { boldAfter: 18 });
    if (auto) input = auto;
  }
  const events = tick(game, dt, input);
  for (const ev of events) playEvent(ev);
  render(ctx, game, now / 1000);
  requestAnimationFrame(frame);
}
render(ctx, game, 0);
requestAnimationFrame(frame);
