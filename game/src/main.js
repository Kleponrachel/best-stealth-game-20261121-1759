// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, level clear, caught and won.
//
// ?seed=N fixes the world (kept for repeatable screenshots). ?shot=start|play|caught|win
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, loadLevel, resetCampaign, stepWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_DOOR, EVENT_GEM, EVENT_KEY, EVENT_LEVEL, EVENT_SPOTTED, EVENT_STEP, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

// The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed.
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();
const bootTime = performance.now();

function nowSeconds() {
  return (performance.now() - bootTime) / 1000;
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, nowSeconds(), null, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let clickTarget = null;
  let scoreBeforeLevel = 0;
  let gemsBeforeLevel = 0;
  let guardStepBucket = world.guards.map(() => 0);

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function showBanner(title, sub, seconds) {
    const now = nowSeconds();
    banner = { title, sub, from: now, until: now + seconds };
  }

  function startLevel(index) {
    scoreBeforeLevel = world.score;
    gemsBeforeLevel = world.totalGemsTaken;
    loadLevel(world, index);
    guardStepBucket = world.guards.map(() => 0);
    clickTarget = null;
    showBanner(world.level.name, world.level.sub, 3);
    screen = SCREEN_PLAY;
    announce(`Floor ${index + 1}: ${world.level.name}. ${world.level.sub}`);
  }

  function startCampaign() {
    resetCampaign(world);
    startLevel(0);
  }

  function handleEvents(events) {
    if (events & EVENT_GEM) audio.gem();
    if (events & EVENT_KEY) {
      audio.key();
      announce('Keycard found. The vault door is open to you now.');
    }
    if (events & EVENT_DOOR) {
      audio.door();
      announce('Vault door unlocked.');
    }
    if (events & EVENT_STEP) audio.step(world.player.sneaking);
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('A guard is suspicious — hide!');
    }
    if (events & EVENT_ALERT) {
      audio.alert();
      announce('Spotted! Run and break line of sight!');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      screen = SCREEN_CAUGHT;
      announce(`Caught. ${world.catchReason}`);
    } else if (events & EVENT_LEVEL) {
      audio.level();
      screen = SCREEN_LEVEL;
      announce(`Floor clear. Score ${world.score}.`);
    } else if (events & EVENT_WIN) {
      audio.win();
      screen = SCREEN_WON;
      if (world.score > best) {
        best = world.score;
        saveBest(best);
      }
      announce(`You cleared the vault. Score ${world.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startCampaign();
      else if (screen === SCREEN_LEVEL) startLevel(world.levelIndex + 1);
      else if (screen === SCREEN_CAUGHT) {
        world.score = scoreBeforeLevel;
        world.totalGemsTaken = gemsBeforeLevel;
        startLevel(world.levelIndex);
      } else if (screen === SCREEN_WON) startCampaign();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    const click = input.takeClick();
    if (click && screen === SCREEN_PLAY) clickTarget = click;
  }

  function guardFootsteps() {
    for (let i = 0; i < world.guards.length; i += 1) {
      const guard = world.guards[i];
      const bucket = Math.floor(guard.stepPhase / 30);
      if (bucket !== guardStepBucket[i]) {
        guardStepBucket[i] = bucket;
        audio.guardStep(Math.hypot(guard.x - world.player.x, guard.y - world.player.y));
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the guards patrol behind the title panel.
      stepWorld(world, { dx: 0, dy: 0, sneak: false, click: null }, STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    const move = { dx: dir.dx, dy: dir.dy, sneak: input.sneaking(), click: clickTarget };
    const events = stepWorld(world, move, STEP);
    if (move.click === null) clickTarget = null;
    if (clickTarget && Math.hypot(clickTarget.x - world.player.x, clickTarget.y - world.player.y) < 8) {
      clickTarget = null;
    }
    guardFootsteps();
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world, screen, best, nowSeconds(), banner, clickTarget);
  }

  // Leaving the tab pauses a running game rather than letting guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Night Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
