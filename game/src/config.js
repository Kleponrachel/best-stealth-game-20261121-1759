// Night Vault — every tuning number and colour in one place.
// The playfield is a fixed 1280x800 logical canvas; the renderer scales it to
// fit the window, so no rule below depends on the screen size.
export const STEP = 1 / 60;
export const TILE = 40;
export const COLS = 30;
export const ROWS = 17;
export const HUD_H = 76;
export const FIELD_W = COLS * TILE;
export const FIELD_H = ROWS * TILE;
export const FIELD_X = (1280 - FIELD_W) / 2;
export const FIELD_Y = HUD_H + 8;
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  sneakSpeed: 100,
  // Walking is heard this far away; sneaking makes no sound.
  noiseRadius: 85,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  chaseSpeed: 124,
  searchSpeed: 88,
  // How far a guard can see, in pixels.
  viewRange: 255,
  // Half of the vision cone's angle, in radians.
  viewHalfAngle: 0.61,
  // Suspicion gained per second: point blank vs at the edge of the cone.
  spotRateNear: 85,
  spotRateFar: 26,
  // Suspicion lost per second while the player is unseen.
  decayRate: 16,
  // Suspicion that makes a guard walk over and look.
  suspiciousAt: 45,
  // Suspicion that makes a guard give chase.
  alertAt: 100,
  // Seconds a chasing guard keeps hunting after losing sight.
  chaseMemory: 4,
  // Seconds a suspicious guard stares at the last seen spot.
  searchTime: 2.6,
  // Catch distance: closer than this and the player is caught.
  catchDistance: 30,
};

export const SCORE = {
  gem: 100,
  keycard: 50,
  levelTimeBonus: 5,
  ghostBonus: 400,
};

export const PALETTE = {
  backdrop: '#070a12',
  hud: '#0d1220',
  hudLine: '#232c44',
  floorA: '#222b3f',
  floorB: '#1d2536',
  floorLine: '#202838',
  wall: '#3a4663',
  wallTop: '#4d5c82',
  wallEdge: '#232c44',
  crate: '#6b4a2a',
  crateEdge: '#8a6238',
  bush: '#1e4d2b',
  bushLeaf: '#2c6b3c',
  door: '#7a5c1e',
  exit: '#1fae5f',
  exitGlow: '#37e08a',
  gem: '#ffd94a',
  keycard: '#4fc3f7',
  player: '#e8ecf4',
  playerHood: '#2b3550',
  guard: '#e5534b',
  guardDark: '#8f2f2a',
  coneCalm: 'rgba(255, 214, 90, 0.16)',
  coneCalmEdge: 'rgba(255, 214, 90, 0.35)',
  coneSuspicious: 'rgba(255, 150, 50, 0.22)',
  coneAlert: 'rgba(255, 70, 60, 0.26)',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#ff5a4e',
  warn: '#ffb347',
  ok: '#37e08a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Where the best score is kept between visits (this browser only).
export const BEST_KEY = 'night-vault.best';
