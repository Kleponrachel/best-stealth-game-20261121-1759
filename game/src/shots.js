// Night Vault — staged scenes for the ?shot= query. Each scene puts the
// simulation into one fixed, deterministic pose so a screenshot always shows
// the same moment: the title card, a mid-game patrol moment, the caught
// panel, or a cleared floor. Nothing random leaks in: guard posts and the
// player's spot are set by hand here.
import { loadFloor } from './realm.js';

function placeGuard(guard, tx, ty, facing) {
  guard.x = tx + 0.5;
  guard.y = ty + 0.5;
  guard.facing = facing;
  guard.mode = 'patrol';
  guard.path = null;
  guard.pathAt = 0;
}

export function applyShot(game, shot) {
  if (shot === 'start') {
    loadFloor(game, 0);
    game.status = 'title';
    placeGuard(game.guards[0], 13, 2, 0.3);
    placeGuard(game.guards[1], 5, 12, -1.2);
    return;
  }
  if (shot === 'play') {
    loadFloor(game, 0);
    game.status = 'play';
    game.player.x = 10.5;
    game.player.y = 10.5;
    game.player.facing = 0.6;
    game.floor.gems[0].taken = true;
    game.gemsGot = 1;
    game.score = 100;
    game.detection = 35;
    game.time = 42;
    placeGuard(game.guards[0], 13, 6, Math.PI / 2);
    placeGuard(game.guards[1], 8, 8, 0);
    game.guards[1].mode = 'investigate';
    game.guards[1].target = { x: 10.5, y: 10.5 };
    game.lastSeen = { x: 10.5, y: 10.5 };
    return;
  }
  if (shot === 'caught') {
    loadFloor(game, 0);
    game.status = 'caught';
    game.player.x = 12.5;
    game.player.y = 6.5;
    game.detection = 100;
    game.score = 200;
    game.time = 58;
    placeGuard(game.guards[0], 13, 6, Math.PI);
    placeGuard(game.guards[1], 5, 8, 0.8);
    return;
  }
  if (shot === 'win') {
    loadFloor(game, 0);
    game.status = 'clear';
    game.holdClear = true;
    for (const gem of game.floor.gems) gem.taken = true;
    game.gemsGot = 4;
    game.score = 640;
    game.time = 95;
    game.floorTime = 95;
    game.player.x = 22.5;
    game.player.y = 13.5;
    game.detection = 0;
    placeGuard(game.guards[0], 13, 2, 0.3);
    placeGuard(game.guards[1], 5, 12, -1.2);
  }
}
