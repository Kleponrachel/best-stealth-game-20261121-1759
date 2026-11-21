// Night Vault — the world. Owns the floor, the thief, the guards, the alarm
// meter, the noise, the score and the win/lose flow. One tick advances the
// whole simulation; it returns a list of event names so the shell can play
// sounds without the simulation knowing about audio at all.
import { TUNE } from './tune.js';
import { FLOORS, parseFloor, tileIsBush } from './floors.js';
import { guardSees, spotRate } from './sight.js';
import { makeGuard, guardUpdate, guardInvestigate, guardChase, guardReturn } from './foe.js';
import { makePlayer, playerUpdate } from './hero.js';

export function makeGame() {
  const game = {
    status: 'title',
    floorIndex: 0,
    floor: null,
    player: null,
    guards: [],
    doorOpen: false,
    hasKeycard: false,
    detection: 0,
    seenEver: false,
    noise: 0,
    noisePos: null,
    score: 0,
    gemsGot: 0,
    time: 0,
    floorTime: 0,
    clearTimer: 0,
    holdClear: false,
    lastSeen: null,
    message: '',
    spottedOn: false,
    alarmOn: false,
    pilot: { waitTime: 0, boldUntil: 0 },
  };
  loadFloor(game, 0);
  return game;
}

export function loadFloor(game, index) {
  const def = FLOORS[index];
  const floor = parseFloor(def);
  game.floorIndex = index;
  game.floor = floor;
  game.player = makePlayer(floor.spawn);
  game.guards = floor.guardDefs.map((d) => makeGuard(d, floor.fastPatrol));
  game.doorOpen = false;
  game.hasKeycard = false;
  game.detection = 0;
  game.noise = 0;
  game.noisePos = null;
  game.floorTime = 0;
  game.clearTimer = 0;
  game.lastSeen = null;
  game.status = 'play';
  game.message = `Floor ${floor.floorNo} — ${floor.name}`;
}

export function gemsLeft(game) {
  return game.floor.gems.filter((g) => !g.taken).length;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function tick(game, dt, keys) {
  const events = [];
  if (game.status === 'title') {
    // The gallery idles behind the title card: guards walk their loops.
    for (const g of game.guards) guardUpdate(g, game.floor, dt, game.doorOpen, null);
    return events;
  }
  if (game.status === 'clear') {
    game.clearTimer += dt;
    if (!game.holdClear && game.clearTimer > 1.4) {
      if (game.floorIndex + 1 < FLOORS.length) loadFloor(game, game.floorIndex + 1);
      else game.status = 'won';
    }
    return events;
  }
  if (game.status !== 'play') return events;

  game.time += dt;
  game.floorTime += dt;
  const floor = game.floor;
  const player = game.player;

  const stepped = playerUpdate(player, floor, dt, keys, game.doorOpen);
  if (stepped) {
    game.noise = 1;
    game.noisePos = { x: player.x, y: player.y };
    events.push('step');
    for (const g of game.guards) {
      if ((g.mode === 'patrol' || g.mode === 'return') && dist(g, player) <= TUNE.noiseHearTiles) {
        guardInvestigate(g, floor, player.x, player.y, game.doorOpen);
      }
    }
  }
  game.noise = Math.max(0, game.noise - dt * 1.6);

  // Eyes on you: the alarm meter climbs, and the guards escalate.
  let watched = false;
  let fastest = 0;
  for (const g of game.guards) {
    const res = guardSees(floor, g, player.x, player.y, player.sneaking);
    if (res.seen) {
      watched = true;
      fastest = Math.max(fastest, spotRate(res.dist, player.sneaking));
      game.lastSeen = { x: player.x, y: player.y };
    }
  }
  if (watched) {
    game.detection = Math.min(100, game.detection + fastest * dt);
    if (!game.spottedOn && game.detection >= TUNE.suspectAt) {
      game.spottedOn = true;
      game.seenEver = true;
      events.push('spotted');
      for (const g of game.guards) {
        if (g.mode === 'patrol' || g.mode === 'return') {
          guardInvestigate(g, floor, game.lastSeen.x, game.lastSeen.y, game.doorOpen);
        }
      }
    }
    if (!game.alarmOn && game.detection >= TUNE.chaseAt) {
      game.alarmOn = true;
      events.push('alarm');
      for (const g of game.guards) guardChase(g, floor, player.x, player.y, game.doorOpen);
    }
  } else {
    game.detection = Math.max(0, game.detection - TUNE.detectFallPerSec * dt);
    if (game.detection < 30) game.spottedOn = false;
    if (game.detection < 50) game.alarmOn = false;
    if (game.detection < 30) {
      for (const g of game.guards) {
        if (g.mode === 'chase' && game.lastSeen) {
          guardInvestigate(g, floor, game.lastSeen.x, game.lastSeen.y, game.doorOpen);
        }
      }
    }
  }

  for (const g of game.guards) {
    guardUpdate(g, floor, dt, game.doorOpen, { x: player.x, y: player.y });
  }

  // Caught: a guard close enough to grab you — unless a bush hides you.
  const hidden = tileIsBush(floor, Math.floor(player.x), Math.floor(player.y));
  if (!hidden) {
    for (const g of game.guards) {
      if (dist(g, player) < TUNE.catchDistanceTiles) {
        game.status = 'caught';
        events.push('caught');
        return events;
      }
    }
  }

  // Pickups.
  for (const gem of floor.gems) {
    if (!gem.taken && Math.hypot(gem.x + 0.5 - player.x, gem.y + 0.5 - player.y) < TUNE.pickupDistanceTiles) {
      gem.taken = true;
      game.gemsGot++;
      game.score += TUNE.gemPoints;
      events.push('gem');
    }
  }
  if (floor.keycard && !game.hasKeycard &&
      Math.hypot(floor.keycard.x + 0.5 - player.x, floor.keycard.y + 0.5 - player.y) < TUNE.pickupDistanceTiles) {
    game.hasKeycard = true;
    game.doorOpen = true;
    game.score += 50;
    events.push('keycard');
  }

  // The way out only counts once every gem is pocketed.
  if (floor.exit && gemsLeft(game) === 0 &&
      Math.hypot(floor.exit.x + 0.5 - player.x, floor.exit.y + 0.5 - player.y) < 0.6) {
    const timeBonus = Math.max(0, Math.round((TUNE.timeBonusWindowSec - game.floorTime) * TUNE.timeBonusPerSec));
    game.score += TUNE.floorClearPoints + timeBonus;
    if (game.floorIndex + 1 >= FLOORS.length) {
      if (!game.seenEver) game.score += TUNE.ghostBonusPoints;
      game.status = 'won';
      events.push('win');
    } else {
      game.status = 'clear';
      game.clearTimer = 0;
      events.push('clear');
    }
  }
  return events;
}
