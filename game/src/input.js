// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (start, restart, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. A mouse
// click on the floor sets a walk target; a click on a menu confirms it.
import { FIELD_X, FIELD_Y, VIEW_H, VIEW_W } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { left: false, right: false, up: false, down: false, sneak: false };
  let actions = 0;
  let click = null;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const offsetX = (rect.width - VIEW_W * scale) / 2;
    const offsetY = (rect.height - VIEW_H * scale) / 2;
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (SNEAK.has(event.code)) keys.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (SNEAK.has(event.code)) keys.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.up = keys.down = keys.sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toLogical(event);
    if (point.y >= FIELD_Y) click = point;
    actions |= ACTION_CONFIRM;
  });

  return {
    // Unit steering vector from the held movement keys, or 0,0.
    direction() {
      const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      return { dx, dy };
    },
    sneaking() {
      return keys.sneak;
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // The last floor click, or null; taking it clears it.
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
    hasClick() {
      return click !== null;
    },
  };
}
