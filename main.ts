// Solmar Bay — the entrypoint make.fun runs for gta6-01.
//
// The finished game lives beside this file as plain static files: game/
// (the playable game, three.js vendored under game/vendor so it loads
// offline with no build step and no network request) and screenshots/
// (four renders of the game itself, the first by name the cover). This
// program only assembles the submission: it lays game/ and screenshots/
// out in the grader's output folder and writes dossier.json there with
// the vendored make.fun library. It holds no game logic of its own.
//
// Run it outside the grader like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset, so the output goes to /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: the folder this file sits in, beside game/.
const rootDir = fileURLToPath(new URL('.', import.meta.url));

// The grader reads from /output unless the caller points elsewhere.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The competition's own gate caps, checked here first so a bad entry is
// refused by this program instead of by the scorer later: the dossier
// text budget, at most 4 screenshots of at most 256 KiB each, game/ at
// most 993 entries and 48 MiB in total, no path under game/ longer than
// 1000 bytes.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countEntries(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += 1;
    if (statSync(path).isDirectory()) total += countEntries(path);
  }
  return total;
}

function checkShots(): void {
  const shotsDir = join(rootDir, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > caps.screenshots.max) {
    throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > caps.screenshots.max_bytes) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  }
}

function checkGame(): void {
  const gameDir = join(rootDir, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
  const entries = countEntries(gameDir);
  if (entries > caps.game_max_files) throw new Error(`game/ holds ${entries} entries, over the 993 cap`);
}

function assemble(): void {
  checkGame();
  checkShots();
  mkdirSync(outDir, { recursive: true });
  cpSync(join(rootDir, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(rootDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

assemble();
