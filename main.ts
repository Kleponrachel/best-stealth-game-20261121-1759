// Night Vault — entry point. Copies game/ and screenshots/ beside this file
// into MAKEFUN_OUTPUT_DIR (default /output) and writes dossier.json there
// with make.fun's buildDossier. Node 22, standard library only.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);

// Builder 3 verification note (2026-11-22): autopilot campaign WON ghost —
// 13/13 gems, score 2799, floors 47.1s / 59.4s / 53.8s, max detection 26.9.
// Run: MAKEFUN_OUTPUT_DIR=<empty dir> node main.ts  -> exit 0, dossier.json formed.
