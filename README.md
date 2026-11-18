# Solmar Bay — gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/FandeadAlter/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/FandeadAlter/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a complete open-world crime game that runs in the browser: a sun-soaked fictional coastal city you explore on foot and by car, with traffic and pedestrians, cars you can steal, a five-star wanted system with police cruisers, roadblocks and a helicopter, and an eight-mission story to play through. Around the story there are side activities, collectibles to hunt, a garage for the cars you keep, and a save that survives between visits. The HUD shows the SBPD response list, four weapon slots, the mission stage and timer, the car radio's now-playing song, and a respect bar. Three.js renders a low-poly procedural city in fixed golden-hour light, and every name, character, vehicle, sound and piece of art is original.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no install, no network requests — `game/` is plain static files.

## How the game is put together

- `game/index.html` — the page that loads the game.
- `game/src/` — the game's own source, one file per system: city, vehicles, traffic, pedestrians, police, missions, combat, HUD, audio, save, and more.
- `game/vendor/` — three.js, vendored so the game loads fully offline.
- `screenshots/` — four renders of the game itself (chase, street, drive, mission); the first by name is the cover.
- `main.ts` — the entrypoint: it copies `game/` and `screenshots/` to the output folder and writes `dossier.json` there with the vendored make.fun library.
- `DESIGN.md` — the design the game was built from.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/game/`, `out/screenshots/` and `out/dossier.json`. Inside the grader's container the output goes to `/output` instead.

---

<sub>Entered on [make.fun](https://make.fun/?ref=me6ajgxn&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
