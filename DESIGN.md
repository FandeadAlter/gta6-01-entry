# DESIGN.md — gta6-01: "Make GTA 6"

## 1. Project overview (design-brief §1)

**Working title:** *Solmar Bay* — an original open-world crime game in the spirit of
GTA 6, built as static files under `game/` that play offline in desktop Chrome.

**Summary:** One sun-soaked modern coastal city, explorable on foot and by car, with
traffic, pedestrians, stealable cars, a 5-star wanted system with responding police,
a 6-mission story, combat, side activities, a HUD with a live minimap, a start screen
and a localStorage save. Three.js (vendored, minified) renders a low-poly procedural
city; all art, sound and music are original and procedural — nothing from Rockstar's
GTA series or any other commercial game.

**Stakeholder:** the make.fun gta6-01 bounty. Prize $1,666 over 100 places (1st $500).
Deadline **2026-11-24T15:00:00Z (Nov 24, 22:00 WIB)**. Judge: an AI comparing entries
pairwise on **screenshots + source outline** — screenshots matter most, so every system
is designed to be *visible* in a screenshot.

**Repo:** https://github.com/FandeadAlter/gta6-01-entry (recreated after the competition
opened; root commit `cf779e0f` — starter kit, MIT).

## 2. Problem statement (design-brief §2)

**What:** Build the most complete, highest-quality open-world crime game possible as
static files, with no build step and no network request.

**Who it is for:** the judge (pairwise, screenshots first) and a player opening
`game/index.html` in desktop Chrome with keyboard + mouse.

**Evidence:** the RULES judge criteria, in order — (1) a complete open world shown in
screenshots (city on foot and by car, traffic, pedestrians, wanted + police, missions);
(2) depth and fun (missions and story, vehicles to steal and drive, activities,
combat, progression); (3) feel and polish (controls, camera, HUD + minimap, effects,
menus); (4) look and originality (coherent sun-soaked modern city of its own, own
names/characters/story — a copy loses); (5) structure (own source split into files
with one clear job each, named for what they do).

**Consequences of getting it wrong:** a menu-only or empty-city screenshot loses on
criterion 1 before anything else is read; a copied name/map loses on criterion 4;
a gate failure (network load, oversize screenshot, dossier mismatch) scores 0 and
takes no reward at all.

## 3. Target audience (design-brief §3)

- **Primary — the judge:** sees one contact sheet (cover large on top, three small
  beneath) plus a short source outline (file paths + first declarations). It must be
  able to read, at a glance when shrunk: wanted level, minimap, mission objective,
  traffic, pedestrians, city.
- **Secondary — the player:** desktop Chrome, keyboard + mouse, wants to drive, steal
  a car, outrun the police and finish a mission within minutes of the start screen,
  with no install and no account.

## 4. Game concept — the city, the story, the people

**The city: Solmar Bay.** A fictional sun-soaked coastal city on a warm gulf coast,
fixed in late-afternoon golden light (one consistent look for every screenshot).
Six districts on a road grid around a bay, joined by a causeway:

| District | Character |
|---|---|
| Palm Row | Beachfront boulevard, hotels, palms, tourists |
| Old Harbor | Docks, warehouses, cranes, containers |
| Neon Mile | Downtown nightlife, clubs, bright signs |
| Coral Heights | Hillside mansions, winding roads, viewpoints |
| The Yard | Industrial blocks, container port, truck traffic |
| Isla Verde | Island across the causeway, marina, lighthouse |

**The story — "High Tide".** Lena Marín, 28, ex-courier driver, comes home to Solmar
Bay after her younger brother **Nico Marín** vanishes owing money to **Victor Kaine**,
owner of Club Eclipse on Neon Mile and the man who quietly runs the city's night
economy. Lena drives, steals, fights and races to buy Nico back — and finds out who
really set him up. Ally: **Rosa Delgado**, mechanic at Old Harbor, who gives Lena her
first car, her safehouse garage, and the jobs that pay. Law: the Solmar Bay Police
Department (SBPD), led by **Chief Ada Okafor** — the police are a system, not a villain.

**Vehicles (all original names):** Alba (city sedan, starter car), Vela GT (sports
coupe), Toro (pickup), Mule (box van), Wasp 250 (motorcycle), SBPD Interceptor
(police cruiser), Harbor Taxi (taxi). No real-world or GTA model names.

**Tone:** warm, bright, a little scrappy — sun, sea, neon after dark, not grim. The
player is a driver trying to fix a family debt, not a crime lord.

## 5. Goals and success criteria (design-brief §4)

- **Gate-valid, first try:** `game/` ≤993 entries and ≤48 MiB, `index.html` ≤1 MiB,
  no `http:`/`https:` load anywhere reachable, 3–4 screenshots each ≤256 KiB with
  long side ≤1280 and short side ≥480, dossier byte-identical on two runs.
- **Playable end to end:** start screen → on foot → steal a car → drive → mission
  → wanted level → lose the cops → save → reload, with no console errors, at a
  steady 60 fps on desktop Chrome.
- **Screenshot-readable:** the cover shows wanted level + minimap + mission objective
  at once; the other three show the city on foot, driving/traffic, and a mission or
  combat moment. Each shot readable when shrunk to a contact-sheet cell.
- **Depth:** 6 story missions, 3 side activities, 5-star wanted, 2 weapon tiers,
  money + progression, collectibles.
- **Originality:** zero names, characters, maps, art or music from any commercial game.

## 6. Full systems list (everything from RULES, all built and shown)

1. **Explore on foot** — third-person character, run/sprint, jump, enter/exit vehicles.
2. **Drive** — arcade car handling (accelerate, brake/reverse, handbrake, steering
   with speed-sensitive feel), collisions, skid marks, damage smoke, camera that
   follows and settles behind the car; on-foot camera over the shoulder.
3. **Traffic** — cars following road lanes with lights, braking, honking, swerving;
   density varies by district and time.
4. **Pedestrians** — walking crowds on sidewalks, crossing streets, fleeing from
   gunfire and speeding cars, reacting to the player's wanted level.
5. **Steal cars** — approach a parked or stopped car, pull the driver out (or just
   take an empty one); parked cars need a short break-in moment; stealing in view
   of police or witnesses raises wanted.
6. **Wanted level (1–5 stars)** — rises with crimes (theft, assault, speeding into
   peds, police kills), decays when unseen and out of the search radius. Police
   respond by level: foot officers (1★), cruisers in pursuit (2★), roadblocks and
   more cruisers (3★), spike strips / helicopter searchlight at night (4★), heavy
   response and roadblocks everywhere (5★). "Busted" when caught on foot, "Wasted"
   when health hits zero; both cost money and time, never the save.
7. **Missions and story** — 6 story missions (below) with objectives, waypoints,
   dialogue banners, timers and fail states, unlocked in order; mission markers on
   the minimap and in the world (a glowing beacon + floating marker).
8. **Combat** — fists, then a pistol (bought/found), aim with mouse, muzzle flash,
   hit reactions, health + armor pickups, enemy AI that takes cover and flanks
   simply; shooting near police raises wanted fast.
9. **HUD with minimap** — health, armor, money, wanted stars, current weapon +
   ammo, mission objective line, speedometer in a car, clock; live canvas minimap
   (north-up, roads, player arrow, mission blip, police blips, car blips).
10. **Start screen** — title, "Continue / New Game / How to play", controls list,
    save summary; pause menu (resume, restart mission, controls, quit to title).
11. **Save** — localStorage: mission progress, money, owned cars in the garage,
    collectibles, best stats; auto-save on mission complete, manual save at the
    garage; Continue restores it.
12. **Side activities** — taxi fares (pick up, drive to the marker, tip for speed),
    courier runs (timed deliveries), street races (checkpoint rings), 20 hidden
    "sun postcards" to collect, stunt jumps.
13. **Progression** — money buys cars, weapons and garage slots; completed missions
    unlock districts' jobs and new vehicles; a simple respect/reputation stat gates
    the later missions.
14. **Polish** — golden-hour sun + long shadows, sea and sky, palm trees, neon signs
    on Neon Mile, particle effects (dust, sparks, smoke, muzzle flash), screen shake
    on impacts, procedural WebAudio sound (engine hum, sirens, gunshots, footsteps,
    UI clicks) and a light procedural music loop, day tint that never leaves golden
    hour so screenshots stay consistent.

### Story missions

1. **Homecoming** — drive Rosa's Alba from the garage to Old Harbor (driving tutorial).
2. **Courier Run** — three timed deliveries across Palm Row; learn the minimap.
3. **The Tow Job** — steal a Vela GT from Coral Heights without raising wanted above 1★.
4. **Harbor Lights** — a shootout at the docks; first combat mission, pistol introduced.
5. **Neon Mile** — tail Kaine's courier through downtown, then a car chase; lose a 3★ wanted.
6. **High Tide** — finale: boat-yard heist at Isla Verde, escape by causeway at 4★, confront Kaine.

## 7. Scope and constraints (design-brief §5)

**In scope:** everything in §6, as static files, three.js only as a vendored minified
library, procedural art/audio only, keyboard + mouse.

**Out of scope (explicitly not built):** multiplayer, online features, real-world map
data, licensed music, voice acting, a second city, a level editor, mobile/touch
controls, mod support.

**Technical constraints (from the gate):**

- Static files under `game/` only, no build step; `game/index.html` opens in desktop
  Chrome and plays with **no network request** — every load is a `data:` URI or a file
  inside `game/`.
- `game/`: at most **993 files + directories**, **48 MiB** total; `game/index.html`
  at most **1 MiB**; every path ≤1,000 UTF-8 bytes; plain files only, no symlinks.
- Screenshots: **3–4** PNG/JPEG, each **≤256 KiB**, long side **≤1280**, short side **≥480**.
- Three.js must be vendored as a minified `*.min.js` under `game/vendor/` (dossier lists
  it as vendored, never as source; its lines don't count against authored share).
- Own source split into files with **one clear job each**, named for what they do — the
  judge's source outline shows mostly file and function names.
- Dossier: `main.ts` output must be byte-identical on two runs (deterministic build).
- Performance: low-poly procedural geometry, instanced/merged meshes for buildings,
  palms and traffic; capped counts (≤24 traffic cars, ≤40 pedestrians); fixed 1/60 s
  step; target 60 fps on a normal desktop.

## 8. Context and inputs (design-brief §6)

- `~/workspace/makefun/gta6-01-kit/RULES.txt` (read in full): the task, the gate, the
  dossier/judge view, the judge's five criteria, heats, rewards, transcript rules.
- The starter kit in this repo: a complete 2D "Block Dodger" placeholder to be replaced
  entirely. **Keep its plumbing patterns:** fixed 1/60 s step loop (`STEP`, accumulator,
  `MAX_FRAME` catch-up cap), `?shot=` staging + `window.__shotReady` for screenshots
  (painted twice, then ready), `?seed=` deterministic world, localStorage save, one
  module per job under `game/src/`, `main.js` as the boot/loop.
- `game/index.html` stays the entry point; `serve.ts` stays the local dev server.
- Design-brief skill applied (this document's §1–§7, §10 structure).
- Prior make.fun entries by this builder (forecast + 3D game builds) showed: screenshots
  decide the ranking, so budget the most time to a chase shot that shows several
  systems at once; verify submission-time checks before the first submit (a refused
  first submit can burn a daily quota).

## 9. Screenshot plan (4 shots; first by name is the cover)

All taken by playing the game's own code in the box's Chrome — real renders, never
edited, composited or borrowed. Each ≤256 KiB, long side ≤1280, short side ≥480.
Staged deterministically with `?shot=<name>&seed=<n>` + `window.__shotReady`, following
the starter's `shots.js` pattern (autopilot plays the real rules forward from a fresh
world; same seed → same frame).

| File | Shot (`?shot=`) | What it shows (systems visible at a glance) |
|---|---|---|
| `1-chase.jpg` | `?shot=chase` | **Cover.** Police chase at 3★: player in the Vela GT, two SBPD Interceptors behind, roadblock ahead; HUD shows 3 wanted stars, minimap with police + mission blips, objective line "Lose the cops — reach the garage". Wanted + minimap + objective at once. |
| `2-street.jpg` | `?shot=street` | On foot on Neon Mile at golden hour: Lena among pedestrians, traffic passing, neon signs, mission beacon ahead. Shows on-foot play, peds, traffic, city art. |
| `3-drive.jpg` | `?shot=drive` | Driving the Vela GT down Palm Row boulevard: sea on one side, palms and hotels on the other, traffic ahead, speedometer + minimap visible. Shows driving, traffic, HUD, city. |
| `4-mission.jpg` | `?shot=mission` | Mission 4 "Harbor Lights": shootout at Old Harbor — Lena behind a container, muzzle flash, two enemies, health/armor + ammo + objective "Clear the dock" on the HUD. Shows combat + mission. |

`shots.json` is updated to these four names/queries. The title screen is shown in
`2-street.jpg`'s world only if it fits — no shot is spent on a menu alone (a menu
shows less of the game than a chase).

## 10. Build plan — file layout under `game/`

```
game/
  index.html            # entry point; import map "three" -> ./vendor/three.min.js;
                        # <canvas>, HUD DOM, <script type="module" src="./src/main.js">
  vendor/
    three.min.js        # three.js, vendored minified (dossier: vendored, not source)
  src/
    main.js             # boot, fixed 1/60 s loop, screen state machine (title/play/pause/over)
    config.js           # every tuning number, palette, district/vehicle/mission tables
    input.js            # keyboard + mouse, held keys + one-shot action flags
    random.js           # seeded RNG (mulberry32) for deterministic worlds/shots
    city.js             # procedural city: road grid, districts, buildings, palms, props, sea
    vehicles.js         # car models (procedural), handling, damage, enter/exit, garage
    traffic.js          # traffic AI: lane following, lights, braking, honking
    pedestrians.js      # pedestrian AI: sidewalks, crossings, flee reactions
    police.js           # wanted level, police AI, pursuit, roadblocks, busted/wasted
    combat.js           # weapons, aiming, shooting, enemy AI, health/armor
    missions.js         # mission definitions, objectives, waypoints, timers, fail/complete
    story.js            # dialogue banners, mission intros/outros, character lines
    hud.js              # HUD DOM + canvas minimap (player/mission/police/car blips)
    audio.js            # procedural WebAudio: engine, sirens, shots, UI, music loop
    effects.js          # particles, skid marks, smoke, muzzle flash, screen shake
    render.js           # three.js scene, golden-hour lighting, cameras (foot/car), sky/sea
    save.js             # localStorage save/load (progress, money, garage, collectibles)
    shots.js            # ?shot= staging: autopilot plays real rules forward, sets __shotReady
  style.css             # HUD + menus styling (loaded from index.html, inside game/)
```

Keep `game/index.html` small (HUD shell + import map + module script) so it stays far
under 1 MiB. No file outside `game/` is loaded at runtime; no `fetch`, no `Worker`,
no dynamic `import()` of anything outside `game/`.

**Dossier order note:** `index.html` first, then modules in load order (main.js, then
its static imports depth-first) — so `main.js` imports in the order the systems should
be read, and every file/function name reads as what it does.

## 11. `main.ts` edits

**None needed.** The starter's `main.ts` already copies `game/` + `screenshots/` to
`/output` and writes `dossier.json` via the kit's `vendor/makefun-game.ts` (unchanged),
with the gate's caps (`text_max_bytes: 163840`, 4 screenshots ≤256 KiB, `game/` ≤993
entries / 48 MiB). That plumbing is exactly what this entry needs and it stays as-is.
The only permitted change would be a comment update if the game outgrows a cap — it
won't; the layout in §10 is ~20 files, well under the limits.

## 12. Milestones to the Nov 24, 22:00 WIB deadline (design-brief §7)

| When (WIB) | Step | Done when |
|---|---|---|
| Nov 17, 22:24 | **Step 1 — Design** (this file) | `DESIGN.md` committed; concept, systems, shots, layout agreed. |
| Nov 18 | **Step 2 — Engine + city** | three.js vendored; `render.js` + `city.js` + `config.js` + `input.js` + `main.js` loop; a drivable empty city opens in Chrome, 60 fps. |
| Nov 19 | **Step 3 — Core systems** | Foot + car movement, traffic, pedestrians, steal cars, wanted + police (`vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `effects.js`). |
| Nov 20 | **Step 4 — Missions, combat, HUD** | 6 missions, combat, HUD + minimap, story dialogue, save/load, audio (`missions.js`, `combat.js`, `hud.js`, `story.js`, `save.js`, `audio.js`). |
| Nov 21 | **Step 5 — Side activities + polish** | Taxi, courier, races, postcards, garage; camera/controls tuning; bug pass. |
| Nov 22 | **Step 6 — Screenshots** | All 4 shots staged via `?shot=`, taken in the box's Chrome, checked (size, dimensions, readability shrunk); `shots.json` updated. |
| Nov 23 | **Step 7 — Validation** | Gate checks: no network loads, `game/` limits, dossier builds byte-identical on two runs, full playthrough with no console errors, save/continue works. |
| Nov 24, ~12:00 | **Step 8 — Submit** | First submit (after validation only), then monitor the dev grade; buffer ~10 h before the 22:00 deadline for a fix + resubmit if the grade flags anything. Max 5 submissions/day, 10 total — do not burn them on unvalidated builds. |

**Safety rule:** no submit before Step 7 validation passes. If a step slips, cut a side
activity first, then a mission's polish — never the cover chase shot, the minimap, or
the wanted system.

## 13. Deliverables (design-brief §7)

1. `DESIGN.md` (this file) — committed on its own.
2. `game/` — the full game per §10, static files only.
3. `screenshots/` — 4 shots per §9, replacing the starter's three.
4. `shots.json` — the four shot names/queries.
5. `main.ts` — unchanged from the starter (see §11).
6. A validated `MAKEFUN_OUTPUT_DIR=out node main.ts` run (dossier byte-identical twice)
   and a submitted entry before Nov 24, 22:00 WIB.
