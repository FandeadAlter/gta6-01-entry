// Solmar Bay — entrypoint for make.fun gta6-01.
//
// What this program does, in one sentence: it takes the finished game that
// lives next to this file (game/ plus screenshots/) and lays it out in the
// grader's output folder, together with a dossier.json that describes it.
//
// The game itself is plain static files: game/index.html and the modules it
// loads, with three.js vendored under game/, so a desktop browser can open
// it offline with no build step and no network request. This file does not
// contain any of the game logic; it only assembles the submission.
//
// Run it outside the grader like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader's container MAKEFUN_OUTPUT_DIR is unset, so the
// output goes to /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file sits on disk: the repository root, beside game/.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader reads from /output unless the caller points elsewhere.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps below come from the competition's own gate: the text budget
// shapes the dossier, the rest are limits the scorer would enforce anyway,
// so this program refuses an entry here instead of letting the scorer
// refuse it later (at most 4 screenshots, each at most 256 KiB; game/
// at most 993 entries and 48 MiB in total, no path under game/ longer
// than 1000 bytes).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(sourceDir: string, destDir: string): void {
  cpSync(sourceDir, destDir, { recursive: true });
}

function stageGameFiles(): void {
  mkdirSync(outputDir, { recursive: true });
  copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoRoot, 'screenshots');
  if (existsSync(shotsDir)) {
    copyTree(shotsDir, join(outputDir, 'screenshots'));
  }
}

function writeDossierFile(): void {
  const dossier = buildDossier(outputDir, dossierCaps);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

stageGameFiles();
writeDossierFile();
