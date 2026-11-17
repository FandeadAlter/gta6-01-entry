# DESIGN.md — gta6-01: "Make GTA 6"

*Solmar Bay* — an original open-world crime game, written as this Step 1 design
by the build agent in the recorded session for recording
`01a1ea42-d63e-703e-b1e0-15f624ea6174`. This file replaces an earlier design draft
that was written outside any recording; the concept below is kept, the words
and the plan are this session's own.

## 1. Overview (design-brief: project overview)

**Game:** *Solmar Bay*. One fictional sun-soaked coastal city, playable on foot
and by car, with traffic, pedestrians, stealable cars, a five-star wanted
system with police who answer it, a six-mission story, combat, side work, a
HUD with a live minimap, a start screen, and a save that survives between
visits. Three.js renders a low-poly procedural city in fixed golden-hour
light. Every name, character, vehicle, sound and piece of art is original —
nothing is taken from Rockstar's GTA series or any other commercial game.

**How it is handed in:** static files under `game/`, no build step, no network
request. `game/index.html` opens in desktop Chrome and plays. The repo is
https://github.com/FandeadAlter/gta6-01-entry, root commit `cf779e0f`
(starter kit, MIT).

**Competition:** make.fun gta6-01. Prize $1,666 across 100 places (1st $500).
Deadline **2026-11-24T15:00:00Z — Nov 24, 22:00 WIB**. The judge is an AI
that compares entries pairwise on **screenshots first, then the source
outline** — so this design treats every system as something that must be
*visible* in a screenshot, not just present in the code.

## 2. Problem statement (design-brief: problem)

**What has to be built:** the most complete open-world crime game possible
inside strict limits: static files only, at most 993 files and directories
under `game/`, 48 MiB total, `game/index.html` at most 1 MiB, zero loads over
the network, 3–4 screenshots each at most 256 KiB (long side at most 1280,
short side at least 480), and a dossier that `main.ts` rebuilds byte for
byte on two runs.

**Who it is judged by:** an AI judge that sees one contact sheet — the cover
shot large on top, the other three small beneath it — plus a short outline of
the source (file paths and first declarations). It ranks on five criteria, in
order: (1) a complete open world shown in screenshots of the game itself;
(2) depth and fun — missions, story, cars to steal, activities, combat,
progression; (3) feel and polish — controls, camera, HUD with minimap,
effects, menus; (4) look and originality — a coherent city of its own, its
own names and story (a copy loses); (5) structure — the game's own source
split into files with one clear job each, named for what they do.

**What goes wrong if this is ignored:** a shot that shows only a menu loses
on criterion 1 before anything else is read. A borrowed name or map loses on
criterion 4. A single gate failure — a network load, an oversize screenshot,
a dossier mismatch — scores 0 and takes no reward at all, however good the
game is.

## 3. Target audience (design-brief: audience)

- **Primary, the judge.** It must be able to read, at a glance, in a shrunken
  contact-sheet cell: the wanted stars, the minimap, the mission objective
  line, traffic, pedestrians, and a city that looks like one place. Every
  screenshot in §9 is planned to carry several of those at once.
- **Secondary, the player.** Desktop Chrome, keyboard and mouse. Within a
  couple of minutes of the start screen they should have stolen a car, driven
  it, seen the police react, and started a mission — with no install and no
  account.

## 4. The game: city, story, people, vehicles

### The city — Solmar Bay

A fictional city on a warm gulf coast, held in one unchanging late-afternoon
light so every screenshot shares the same look: long shadows, warm sun, blue
sea. Six districts on a road grid around a bay, joined by a causeway:

- **Palm Row** — beachfront boulevard, hotels, palms, tourists.
- **Old Harbor** — docks, warehouses, cranes, stacked containers.
- **Neon Mile** — downtown nightlife, clubs, bright signs.
- **Coral Heights** — hillside mansions, winding roads, viewpoints.
- **The Yard** — industrial blocks, container port, heavy truck traffic.
- **Isla Verde** — island across the causeway, marina, lighthouse.

### The story — "High Tide"

**Lena Marín**, 28, ex-courier driver, comes home to Solmar Bay after her
younger brother **Nico Marín** vanishes owing money to **Victor Kaine**, who
owns Club Eclipse on Neon Mile and quietly runs the city's night economy.
Lena drives, steals, fights and races to buy Nico back — and discovers who
really set him up. Her ally is **Rosa Delgado**, a mechanic at Old Harbor who
gives Lena her first car, her safehouse garage, and the jobs that pay. The
law is the Solmar Bay Police Department (SBPD), led by **Chief Ada Okafor** —
the police are a system that responds to what the player does, not a villain
with a face.

Tone: warm, bright, a little scrappy. Sun, sea, neon after dark. The player
is a driver trying to clear a family debt, not a crime lord.

### Vehicles (all original names)

Alba (city sedan, the starter car), Vela GT (sports coupe), Toro (pickup),
Mule (box van), Wasp 250 (motorcycle), Harbor Taxi (taxi), SBPD Interceptor
(police cruiser). No real-world or GTA model names anywhere.

## 5. Goals and success criteria (design-brief: goals)

- **Gate-valid on the first try.** `game/` within its file and byte caps,
  no `http:`/`https:` load anywhere reachable, 3–4 screenshots within their
  caps, dossier byte-identical across two runs.
- **Playable end to end.** Start screen → on foot → steal a car → drive →
  mission → wanted level → lose the cops → save → reload, with no console
  errors, at a steady 60 fps on desktop Chrome.
- **Readable at contact-sheet size.** The cover shows wanted level, minimap
  and mission objective at once; the other three show the city on foot,
  driving in traffic, and a mission/combat moment.
- **Depth.** Six story missions, three side activities, a five-star wanted
  scale, two weapon tiers, money and progression, collectibles.
- **Originality.** Zero names, characters, maps, art or music from any
  commercial game.

## 6. Full systems list

Everything the rules ask for, each built and each shown in a screenshot:

1. **Explore on foot.** Third-person character, run and sprint, jump, enter
   and exit vehicles. Camera sits over the shoulder and settles smoothly.
2. **Drive.** Arcade handling — accelerate, brake and reverse, handbrake,
   steering that tightens with speed — plus collisions, skid marks, damage
   smoke, and a camera that follows and settles behind the car.
3. **Traffic.** Cars that follow road lanes, stop at lights, brake for
   trouble ahead, honk and swerve. Density varies by district.
4. **Pedestrians.** Crowds on sidewalks, crossing streets, fleeing gunfire
   and speeding cars, reacting when the player's wanted level rises.
5. **Steal cars.** Walk up to a parked or stopped car and take it; a parked
   car needs a short break-in moment, a stopped one means pulling the driver
   out. Stealing where police or witnesses can see it raises wanted.
6. **Wanted level, 1–5 stars.** Rises with theft, assault, hitting
   pedestrians, killing police. Decays when the player is unseen and out of
   the search radius. The response scales: foot officers at 1★, cruisers in
   pursuit at 2★, roadblocks and more cruisers at 3★, spike strips and a
   helicopter searchlight at 4★, a heavy response with roadblocks everywhere
   at 5★. Caught on foot means "Busted"; health at zero means "Wasted".
   Either costs money and time, never the save.
7. **Missions and story.** Six story missions (§7) with objectives,
   waypoints, dialogue banners, timers and fail states, unlocked in order.
   Mission markers live on the minimap and in the world as a glowing beacon
   with a floating marker.
8. **Combat.** Fists first, then a pistol (bought or found). Aim with the
   mouse, muzzle flash, hit reactions, health and armor pickups. Enemy AI
   takes simple cover and flanks. Shooting near police raises wanted fast.
9. **HUD with minimap.** Health, armor, money, wanted stars, current weapon
   and ammo, the mission objective line, a speedometer while driving, a
   clock. A live canvas minimap, north-up, showing roads, the player arrow,
   the mission blip, police blips and car blips.
10. **Start screen.** Title, Continue / New Game / How to play, a controls
    list, a save summary. Pause menu: resume, restart mission, controls,
    quit to title.
11. **Save.** localStorage: mission progress, money, cars owned in the
    garage, collectibles, best stats. Auto-save on mission complete, manual
    save at the garage. Continue restores it.
12. **Side activities.** Taxi fares (pick up, drive to the marker, a tip for
    speed), courier runs (timed deliveries), street races (checkpoint rings),
    20 hidden "sun postcards" to collect, stunt jumps.
13. **Progression.** Money buys cars, weapons and garage slots. Finished
    missions unlock district jobs and new vehicles. A simple reputation stat
    gates the later missions.
14. **Polish.** Golden-hour sun with long shadows, sea and sky, palm trees,
    neon signs on Neon Mile, particles (dust, sparks, smoke, muzzle flash),
    screen shake on impacts, procedural WebAudio sound (engine hum, sirens,
    gunshots, footsteps, UI clicks) and a light procedural music loop. The
    day tint never leaves golden hour, so screenshots stay consistent.

## 7. Story missions

1. **Homecoming** — drive Rosa's Alba from the garage to Old Harbor; the
   driving tutorial.
2. **Courier Run** — three timed deliveries across Palm Row; teaches the
   minimap.
3. **The Tow Job** — steal a Vela GT from Coral Heights without pushing
   wanted above 1★.
4. **Harbor Lights** — a shootout at the docks; the pistol's introduction,
   first real combat.
5. **Neon Mile** — tail Kaine's courier through downtown, then a car chase;
   lose a 3★ wanted level.
6. **High Tide** — the finale: a boat-yard heist on Isla Verde, escape back
   across the causeway at 4★, and the confrontation with Kaine.

## 8. Scope and constraints (design-brief: scope)

**In scope:** everything in §6, as static files, three.js only as a vendored
minified library, procedural art and audio only, keyboard and mouse.

**Out of scope, explicitly not built:** multiplayer, any online feature,
real-world map data, licensed music, voice acting, a second city, a level
editor, mobile or touch controls, mod support.

**Technical constraints, from the gate:**

- Static files under `game/` only, no build step. `game/index.html` opens in
  desktop Chrome and plays with **no network request** — every load is a
  `data:` URI or a file inside `game/`.
- `game/`: at most **993 files and directories**, **48 MiB** total;
  `game/index.html` at most **1 MiB**; every path at most 1,000 UTF-8 bytes;
  plain files only, no symlinks.
- Screenshots: **3–4** PNG or JPEG, each **≤256 KiB**, long side **≤1280**,
  short side **≥480**.
- Three.js is vendored as a minified `*.min.js` under `game/vendor/` — the
  dossier lists it as vendored, never as source, and its lines do not count
  against authored share.
- The game's own source is split into files with **one clear job each**,
  named for what they do — the judge's source outline shows mostly file and
  function names.
- The dossier from `main.ts` must be byte-identical on two runs.
- Performance: low-poly procedural geometry, instanced or merged meshes for
  buildings, palms and traffic; capped counts (at most 24 traffic cars, at
  most 40 pedestrians); a fixed 1/60 s simulation step; target 60 fps on a
  normal desktop.

## 9. Context and inputs (design-brief: context)

- `~/workspace/makefun/gta6-01-kit/RULES.txt`, read in full: the task, the
  gate, the dossier and judge view, the judge's five criteria, heats,
  rewards, transcript rules.
- The starter kit in this repo: a complete 2D "Block Dodger" placeholder to
  be replaced entirely. **Keep its plumbing patterns:** a fixed 1/60 s step
  loop (`STEP`, an accumulator, a `MAX_FRAME` catch-up cap), `?shot=`
  staging with `window.__shotReady` for screenshots (painted twice, then
  ready), `?seed=` for a deterministic world, a localStorage save, one
  module per job under `game/src/`, `main.js` as the boot and loop.
- `game/index.html` stays the entry point; `serve.ts` stays the local dev
  server.
- The design-brief skill, applied as this document's §1–§8 and §12 structure.
- Lessons from this builder's earlier make.fun entries: screenshots decide
  the ranking, so the most time goes to a chase shot that shows several
  systems at once; and submission-time checks are verified before the first
  submit, because a refused first submit can burn a daily quota (the
  forecast entry lost its one-per-day quota that way).

## 10. Screenshot plan (4 shots; first by name is the cover)

All four are taken by playing the game's own code in the box's Chrome —
real renders, never edited, composited or borrowed. Each ≤256 KiB, long side
≤1280, short side ≥480. Staged deterministically with `?shot=<name>&seed=<n>`
plus `window.__shotReady`, following the starter's `shots.js` pattern: an
autopilot plays the real rules forward from a fresh world, so the same seed
always gives the same frame.

| File | Shot (`?shot=`) | What it shows at a glance |
|---|---|---|
| `1-chase.jpg` | `?shot=chase` | **Cover.** A police chase at 3★: the player in the Vela GT, two SBPD Interceptors behind, a roadblock ahead. The HUD shows 3 wanted stars, the minimap with police and mission blips, and the objective line "Lose the cops — reach the garage". Wanted + minimap + objective at once. |
| `2-street.jpg` | `?shot=street` | On foot on Neon Mile at golden hour: Lena among pedestrians, traffic passing, neon signs, a mission beacon ahead. On-foot play, pedestrians, traffic, city art. |
| `3-drive.jpg` | `?shot=drive` | Driving the Vela GT down the Palm Row boulevard: sea on one side, palms and hotels on the other, traffic ahead, speedometer and minimap visible. Driving, traffic, HUD, city. |
| `4-mission.jpg` | `?shot=mission` | Mission 4, "Harbor Lights": a shootout at Old Harbor — Lena behind a container, muzzle flash, two enemies, health and armor, ammo, and the objective "Clear the dock" on the HUD. Combat + mission. |

`shots.json` is updated to these four names and queries. No shot is spent on
a menu alone — a menu shows less of the game than a chase does. The title
screen is verified separately in playtesting, not in a screenshot.

## 11. Build plan — file layout under `game/`

```
game/
  index.html            # entry point; import map "three" -> ./vendor/three.min.js;
                        # <canvas>, HUD DOM, <script type="module" src="./src/main.js">
  style.css             # HUD + menu styling (loaded from index.html, inside game/)
  vendor/
    three.min.js        # three.js, vendored minified (dossier: vendored, not source)
  src/
    main.js             # boot, fixed 1/60 s loop, screen state machine (title/play/pause/over)
    config.js           # every tuning number, palette, district/vehicle/mission tables
    input.js            # keyboard + mouse: held keys and one-shot action flags
    random.js           # seeded RNG (mulberry32) for deterministic worlds and shots
    city.js             # procedural city: road grid, districts, buildings, palms, props, sea
    vehicles.js         # car models (procedural), handling, damage, enter/exit, garage
    traffic.js          # traffic AI: lane following, lights, braking, honking
    pedestrians.js      # pedestrian AI: sidewalks, crossings, flee reactions
    police.js           # wanted level, police AI, pursuit, roadblocks, busted/wasted
    combat.js           # weapons, aiming, shooting, enemy AI, health/armor
    missions.js         # mission definitions, objectives, waypoints, timers, fail/complete
    story.js            # dialogue banners, mission intros and outros, character lines
    activities.js       # side activities: taxi fares, courier runs, races, postcards, jumps
    hud.js              # HUD DOM + canvas minimap (player/mission/police/car blips)
    audio.js            # procedural WebAudio: engine, sirens, shots, UI, music loop
    effects.js          # particles, skid marks, smoke, muzzle flash, screen shake
    render.js           # three.js scene, golden-hour lighting, foot/car cameras, sky/sea
    save.js             # localStorage save/load (progress, money, garage, collectibles)
    shots.js            # ?shot= staging: autopilot plays real rules forward, sets __shotReady
```

Keep `game/index.html` small (HUD shell + import map + module script) so it
stays far under 1 MiB. No file outside `game/` is loaded at runtime; no
`fetch`, no `Worker`, no dynamic `import()` of anything outside `game/`.

**Dossier order note:** `index.html` first, then modules in load order
(`main.js`, then its static imports depth-first) — so `main.js` imports in
the order the systems should be read, and every file and function name reads
as what it does.

## 12. `main.ts` edits

**None needed.** The starter's `main.ts` already copies `game/` and
`screenshots/` to `/output` and writes `dossier.json` through the kit's
`vendor/makefun-game.ts` (unchanged), with the gate's caps
(`text_max_bytes: 163840`, 4 screenshots at most 256 KiB, `game/` at most
993 entries / 48 MiB). That plumbing is exactly what this entry needs and it
stays as it is. The only permitted change would be a comment update if the
game outgrew a cap — it will not; the layout in §11 is about 20 files, far
under the limits.

## 13. Milestones to the Nov 24, 22:00 WIB deadline (design-brief: deliverables)

| When (WIB) | Step | Done when |
|---|---|---|
| Nov 17, ~23:30 | **Step 1 — Design** (this file) | `DESIGN.md` committed; concept, systems, shots, layout agreed. |
| Nov 18 | **Step 2 — Engine + city** | three.js vendored; `render.js` + `city.js` + `config.js` + `input.js` + `main.js` loop; a drivable empty city opens in Chrome at 60 fps. |
| Nov 19 | **Step 3 — Core systems** | Foot and car movement, traffic, pedestrians, stealing cars, wanted + police (`vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `effects.js`). |
| Nov 20 | **Step 4 — Missions, combat, HUD** | Six missions, combat, HUD + minimap, story dialogue, save/load, audio (`missions.js`, `combat.js`, `hud.js`, `story.js`, `save.js`, `audio.js`). |
| Nov 21 | **Step 5 — Side activities + polish** | Taxi, courier, races, postcards, garage; camera and controls tuning; bug pass. |
| Nov 22 | **Step 6 — Screenshots** | All four shots staged through `?shot=`, taken in the box's Chrome, checked (size, dimensions, readable when shrunk); `shots.json` updated. |
| Nov 23 | **Step 7 — Validation** | Gate checks: no network loads, `game/` limits, dossier byte-identical on two runs, a full playthrough with no console errors, save/continue works. |
| Nov 24, ~12:00 | **Step 8 — Submit** | First submit (after validation only), then watch the dev grade; about 10 h of buffer before the 22:00 deadline for a fix and resubmit if the grade flags anything. At most 5 submissions/day, 10 total — do not burn them on unvalidated builds. |

**Safety rule:** no submit before Step 7 validation passes. If a step
slips, cut a side activity first, then a mission's polish — never the cover
chase shot, the minimap, or the wanted system.

**Note on priorities:** the GTA forecast entry (deadline Nov 19, 08:00 WIB)
stays ahead of this build's heavy phase — this build's Step 2–3 days are
Nov 18–19, and the forecast submit comes first if they collide.

## 14. Deliverables (design-brief: deliverables)

1. `DESIGN.md` (this file) — committed on its own.
2. `game/` — the full game per §11, static files only.
3. `screenshots/` — 4 shots per §10, replacing the starter's three.
4. `shots.json` — the four shot names and queries.
5. `main.ts` — unchanged from the starter (see §12).
6. A validated `MAKEFUN_OUTPUT_DIR=out node main.ts` run (dossier
   byte-identical twice) and a submitted entry before Nov 24, 22:00 WIB.
