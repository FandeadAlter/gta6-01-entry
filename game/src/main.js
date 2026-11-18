// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between three screens: title, play and
// paused. Step 4: eight story missions with dialogue, pistol combat against
// Kaine's men, a full HUD with minimap, a versioned save, and procedural audio
// — wired into the same loop.
//
// ?seed=N fixes the city layout. ?shot=drive|street|city|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { ACTIVITIES, CAMERA, MISSIONS, PLAYER, SPAWN, STEP, VEHICLES } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_JUMP, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { VehicleFleet, createVehicle, isSmoking, stepVehicle, vehicleCondition } from './vehicles.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { OUTCOME_BUSTED, OUTCOME_WASTED, PoliceManager } from './police.js';
import { EffectsManager } from './effects.js';
import { MissionManager, MISSION_DEFS, HARBOR_ENEMY_SPOTS } from './missions.js';
import { StoryManager, MISSION_DIALOGUE, BARKS } from './story.js';
import { CombatManager, WEAPON_FISTS, weaponSlotList } from './combat.js';
import { ActivityManager } from './activities.js';
import { CollectiblesManager } from './collectibles.js';
import { GarageManager } from './garage.js';
import { HudManager } from './hud.js';
import { AudioManager } from './audio.js';
import { applySaveData, buildSave, readSave, writeSaveData } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas, createRandom(seed));
const city = renderer.city;
const fleet = new VehicleFleet(renderer.scene, createRandom(seed + 1));
const traffic = new TrafficManager(renderer.scene, createRandom(seed + 2));
const pedestrians = new PedestrianManager(renderer.scene, createRandom(seed + 3));
const police = new PoliceManager(renderer.scene, createRandom(seed + 4));
const effects = new EffectsManager(renderer.scene);
const missions = new MissionManager(renderer.scene);
const story = new StoryManager();
const combat = new CombatManager(renderer.scene);
const activities = new ActivityManager(renderer.scene);
const collectibles = new CollectiblesManager(renderer.scene);
const garage = new GarageManager(renderer.scene);
const hud = new HudManager(document, city);
const audio = new AudioManager();

const player = {
  x: SPAWN.player.x,
  y: 0,
  z: SPAWN.player.z,
  vx: 0,
  vz: 0,
  vy: 0,
  heading: SPAWN.player.heading,
  walkPhase: 0,
  moving: false,
  onGround: true,
};
// The player's current car: a full vehicle state, drawn by render.js.
const car = createVehicle('alba', SPAWN.car.x, SPAWN.car.z, SPAWN.car.heading);
car.parked = false;
const cameraView = { mode: 'follow', yaw: SPAWN.player.heading, pitch: 0.22, distance: CAMERA.footDistance };
const state = {
  screen: SCREEN_TITLE,
  inCar: false,
  money: 0,
  health: 100,
  armor: 0,
  wanted: 0,
  objective: MISSIONS[0].objective,
  missionIndex: 0,
  missionsCompleted: 0,
  titleOrbit: 0,
  outcome: '',
};
let recklessTimer = 0;
let smokeTimer = 0;
let missionLabel = '';
let missionStageOverride = '';
let missionTimerOverride = 0;
let shotSpeedKmh = null;
let radioNowOverride = '';
let respectOverride = null;
let radioLabel = '';
let radioUntil = 0;
let gunfireTimer = 0;
let lowHealthWarned = false;
let audioStarted = false;

function saveGame() {
  writeSaveData(buildSave({
    money: state.money,
    health: state.health,
    armor: state.armor,
    missionIndex: missions.index,
    missionsCompleted: state.missionsCompleted,
    weapon: combat.weapon,
    ammoInMag: combat.ammoInMag,
    ammoReserve: combat.ammoReserve,
    player,
    car,
    inCar: state.inCar,
    postcards: collectibles.foundIds(),
    garageOwned: garage.owned,
    bestRaceSeconds: activities.bestRaceSeconds,
    taxiEarned: activities.taxiEarned,
    courierEarned: activities.courierEarned,
    racesWon: activities.racesWon,
  }));
}

function loadGame() {
  const save = readSave();
  if (!save) return;
  const patch = applySaveData(save, {
    player,
    car,
    swapPlayerCar: (spec) => renderer.swapPlayerCar(spec),
  });
  if (!patch) return;
  state.money = patch.money;
  state.health = patch.health;
  state.armor = patch.armor;
  state.missionIndex = patch.missionIndex;
  state.missionsCompleted = patch.missionsCompleted;
  state.inCar = patch.inCar;
  if (patch.weapon === 'pistol') {
    combat.givePistol();
    combat.ammoInMag = patch.ammoInMag;
    combat.ammoReserve = patch.ammoReserve;
  }
  collectibles.setFound(patch.postcards);
  garage.setOwned(patch.garageOwned);
  garage.syncOwned(car.specKey);
  activities.bestRaceSeconds = patch.bestRaceSeconds;
  activities.taxiEarned = patch.taxiEarned;
  activities.courierEarned = patch.courierEarned;
  activities.racesWon = patch.racesWon;
  cameraView.yaw = player.heading;
  missions.start(state.missionIndex);
  story.say(MISSION_DIALOGUE[state.missionIndex].intro);
}

function newGame() {
  state.money = 0;
  state.health = 100;
  state.armor = 0;
  state.missionsCompleted = 0;
  state.inCar = false;
  state.wanted = 0;
  police.clearWanted();
  combat.clearEnemies();
  activities.endActivity();
  collectibles.setFound([]);
  garage.setOwned([]);
  garage.syncOwned('alba');
  activities.bestRaceSeconds = 0;
  activities.taxiEarned = 0;
  activities.courierEarned = 0;
  activities.racesWon = 0;
  combat.weapon = WEAPON_FISTS;
  combat.ammoInMag = 0;
  combat.ammoReserve = 0;
  player.x = SPAWN.player.x;
  player.z = SPAWN.player.z;
  player.y = 0;
  player.heading = SPAWN.player.heading;
  car.x = SPAWN.car.x;
  car.z = SPAWN.car.z;
  car.heading = SPAWN.car.heading;
  car.speed = 0;
  car.damage = 0;
  if (car.specKey !== 'alba') {
    car.specKey = 'alba';
    car.spec = VEHICLES.alba;
    renderer.swapPlayerCar(car.spec);
  }
  cameraView.yaw = player.heading;
  missions.start(0);
  story.say(MISSION_DIALOGUE[0].intro);
}

/** Armor absorbs damage first; what is left hits health. */
function damagePlayer(amount) {
  if (amount <= 0) return;
  const absorbed = Math.min(state.armor, amount);
  state.armor -= absorbed;
  state.health = Math.max(0, state.health - (amount - absorbed));
  if (state.health <= 25 && !lowHealthWarned) {
    lowHealthWarned = true;
    story.say(BARKS.lowHealth);
  }
  if (state.health > 25) lowHealthWarned = false;
}

/** Shortest-arc lerp between two headings. */
function lerpAngle(from, to, sharp) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * Math.min(1, sharp);
}

function stepOnFoot(dt, input, actions) {
  const axes = input.moveAxes();
  const forward = { x: Math.sin(cameraView.yaw), z: Math.cos(cameraView.yaw) };
  const right = { x: -Math.cos(cameraView.yaw), z: Math.sin(cameraView.yaw) };
  let moveX = forward.x * axes.forward + right.x * axes.strafe;
  let moveZ = forward.z * axes.forward + right.z * axes.strafe;
  const length = Math.hypot(moveX, moveZ);
  player.moving = length > 0;
  if (player.moving) {
    moveX /= length;
    moveZ /= length;
    const targetHeading = Math.atan2(moveX, moveZ);
    player.heading = lerpAngle(player.heading, targetHeading, 0.25);
  }
  const speed = input.sprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const targetVx = moveX * speed;
  const targetVz = moveZ * speed;
  const sharp = 1 - Math.exp(-PLAYER.accel * dt / speed);
  player.vx += (targetVx - player.vx) * sharp;
  player.vz += (targetVz - player.vz) * sharp;

  const prevX = player.x;
  const prevZ = player.z;
  player.x += player.vx * dt;
  player.z += player.vz * dt;
  city.collideCircle(player, PLAYER.radius);
  if (!city.onLand(player.x, player.z)) {
    player.x = prevX;
    player.z = prevZ;
    player.vx = 0;
    player.vz = 0;
  }
  player.walkPhase += Math.hypot(player.vx, player.vz) * dt * 1.6;

  if (player.onGround && (actions & ACTION_JUMP)) {
    player.vy = PLAYER.jumpSpeed;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.vy -= PLAYER.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

function stepCar(dt, input) {
  const pedal = input.drivePedal();
  const steerInput = input.driveSteer();
  const hitWall = stepVehicle(car, pedal, steerInput, dt, city);
  if (hitWall) {
    effects.burst(car.x, 1, car.z, 10, 0xffd9a0);
    effects.shake(0.35);
    audio.impact();
  }
  // Skid marks when braking hard or steering hard at speed.
  if (Math.abs(car.speed) > 15 && (pedal < 0 || Math.abs(car.steer) > 0.4)) {
    const rearX = car.x - Math.sin(car.heading) * car.spec.length * 0.4;
    const rearZ = car.z - Math.cos(car.heading) * car.spec.length * 0.4;
    effects.skid(rearX, rearZ, car.heading);
  }
  // A damaged engine smokes.
  if (isSmoking(car)) {
    smokeTimer -= dt;
    if (smokeTimer <= 0) {
      smokeTimer = 0.35;
      const frontX = car.x + Math.sin(car.heading) * car.spec.length * 0.4;
      const frontZ = car.z + Math.cos(car.heading) * car.spec.length * 0.4;
      effects.puff(frontX, 1.2, frontZ);
    }
  }
  // Reckless driving (flat out through the city) raises heat, throttled.
  recklessTimer -= dt;
  if (Math.abs(car.speed) > 30 && recklessTimer <= 0) {
    recklessTimer = 3;
    police.onReckless();
  }
  // Bumping a traffic car: slow down, spark, shake.
  for (const pos of traffic.positions()) {
    if (Math.hypot(pos.x - car.x, pos.z - car.z) < 3.2 && Math.abs(car.speed) > 3) {
      car.speed *= 0.5;
      car.damage = Math.min(1, car.damage + 0.06);
      effects.burst(car.x, 1, car.z, 8, 0xffe14f);
      effects.shake(0.3);
      audio.impact();
      break;
    }
  }

  // The chase camera settles behind the car; the mouse can look around freely.
  cameraView.yaw = lerpAngle(cameraView.yaw, car.heading, dt * 2.2);
  cameraView.distance = CAMERA.carDistance;
}

function nearCar() {
  return Math.hypot(player.x - car.x, player.z - car.z) < 4;
}

/** Act on the events the side-activity and collectible managers queued. */
function handleActivityEvents() {
  for (const event of activities.takeEvents()) {
    if (event === 'activity-started:taxi') {
      story.sayOne('lena', 'A fare! Palm Row, coming right up.');
    } else if (event === 'activity-started:taxi-dropoff') {
      announce('Taxi fare — drive to the gold marker.');
    } else if (event === 'activity-started:courier') {
      story.sayOne('rosa', 'Three parcels, Lena — the clock is running.');
      announce('Courier run — three parcels, on the clock.');
    } else if (event === 'activity-started:race') {
      story.sayOne('lena', 'Race on! Beat them to the last checkpoint.');
      announce('Street race — hit every pink ring.');
    } else if (event.startsWith('taxi-paid:')) {
      const pay = Number(event.split(':')[1]);
      state.money += pay;
      audio.pickup();
      announce(`Fare paid — $${pay}.`);
    } else if (event.startsWith('courier-drop:')) {
      const pay = Number(event.split(':')[1]);
      state.money += pay;
      audio.pickup();
      announce(`Parcel delivered — $${pay}.`);
    } else if (event.startsWith('courier-bonus:')) {
      const pay = Number(event.split(':')[1]);
      state.money += pay;
      audio.missionComplete();
      announce(`All parcels on time — $${pay} bonus.`);
    } else if (event.startsWith('race-checkpoint:')) {
      audio.uiClick();
    } else if (event.startsWith('race-won:')) {
      const pay = Number(event.split(':')[1]);
      state.money += pay;
      audio.missionComplete();
      announce(`Race finished — $${pay}.`);
    } else if (event.startsWith('activity-failed:')) {
      audio.missionFailed();
      announce(event.endsWith('taxi-late') ? 'Too slow — the passenger got out.'
        : event.endsWith('race-time') ? 'The race moved on without you.'
        : 'Too slow — the parcels went back to Rosa.');
    }
  }
  for (const event of collectibles.takeEvents()) {
    if (event.startsWith('postcard:')) {
      const count = Number(event.split(':')[1]);
      audio.pickup();
      announce(`Sun postcard ${count} of 20.`);
    } else if (event.startsWith('postcards-complete:')) {
      const pay = Number(event.split(':')[1]);
      state.money += pay;
      audio.missionComplete();
      story.sayOne('rosa', 'All twenty postcards! Solmar Bay suits you, Lena.');
      announce(`All 20 sun postcards — $${pay}.`);
      saveGame();
    }
  }
}

/** Act on the events the mission and combat managers queued this step. */
function handleEvents() {
  for (const event of missions.takeEvents()) {
    if (event === 'mission-start') {
      const def = MISSION_DEFS[missions.index];
      state.missionIndex = missions.index;
      state.objective = missions.objective;
      story.say(MISSION_DIALOGUE[missions.index].intro);
      announce(`Mission ${missions.index + 1}: ${def.name}`);
    } else if (event === 'mission-complete') {
      const def = MISSION_DEFS[missions.index];
      state.money += def.reward;
      state.missionsCompleted += 1;
      story.say(MISSION_DIALOGUE[missions.index].outro);
      audio.missionComplete();
      announce(`Mission complete — $${def.reward}.`);
      saveGame();
    } else if (event.startsWith('mission-failed:')) {
      const reason = event.split(':')[1];
      audio.missionFailed();
      announce(reason === 'time' ? 'Mission failed — out of time.' : reason === 'heat' ? 'Mission failed — the SBPD saw too much.' : 'Mission failed — the courier spotted you.');
    } else if (event === 'spawn-harbor-enemies') {
      combat.spawnEnemies(HARBOR_ENEMY_SPOTS);
    } else if (event === 'give-pistol') {
      combat.givePistol();
      story.say(BARKS.pistol);
    } else if (event === 'set-wanted-3') {
      police.setWanted(3);
      state.wanted = police.wanted;
    } else if (event === 'set-wanted-4') {
      police.setWanted(4);
      state.wanted = police.wanted;
    } else if (event === 'objective-done') {
      audio.pickup();
      state.money += 50;
    } else if (event === 'tail-complete') {
      announce('You tailed the courier without being seen.');
    }
  }
  for (const event of combat.takeEvents()) {
    if (event === 'enemy-down') {
      missions.onEnemyDown();
      state.money += 25;
    } else if (event === 'shot') {
      audio.shot();
      gunfireTimer = 1.5;
      police.addHeat(3);
      state.wanted = police.wanted;
    } else if (event === 'enemy-shot') {
      audio.enemyShot();
    } else if (event === 'punch') {
      audio.punch();
    } else if (event === 'reload' || event === 'reloaded') {
      audio.uiClick();
    }
  }
}

function stepWorld(dt, input, actions) {
  if (actions & ACTION_ENTER) {
    if (state.inCar) {
      state.inCar = false;
      car.speed = 0;
      player.x = car.x - Math.cos(car.heading) * 2.2;
      player.z = car.z + Math.sin(car.heading) * 2.2;
      player.heading = car.heading;
      cameraView.distance = CAMERA.footDistance;
      renderer.snapCamera(
        player.x - Math.sin(cameraView.yaw) * CAMERA.footDistance,
        3,
        player.z - Math.cos(cameraView.yaw) * CAMERA.footDistance,
      );
      // Getting out inside the green garage ring keeps the car and saves.
      if (garage.isInGarage(car.x, car.z)) {
        const kept = garage.parkCar(car.specKey);
        garage.syncOwned(car.specKey);
        saveGame();
        announce(kept
          ? `Saved at Rosa's garage — the ${car.spec.name} is kept.`
          : 'Saved at Rosa\'s garage.');
      }
    } else if (nearCar()) {
      state.inCar = true;
      player.x = car.x;
      player.z = car.z;
      cameraView.distance = CAMERA.carDistance;
    } else {
      // Take a kept car out of the garage: it becomes the car Lena drives.
      const stored = garage.nearestStored(player.x, player.z);
      if (stored) {
        garage.takeStored(stored.specKey);
        car.specKey = stored.specKey;
        car.spec = VEHICLES[stored.specKey];
        car.x = stored.x;
        car.z = stored.z;
        car.heading = stored.heading;
        car.speed = 0;
        car.steer = 0;
        car.damage = 0;
        renderer.swapPlayerCar(car.spec);
        state.inCar = true;
        player.x = car.x;
        player.z = car.z;
        player.heading = car.heading;
        cameraView.distance = CAMERA.carDistance;
        announce(`Took the ${car.spec.name} out of the garage.`);
      } else {
      // Steal a parked car: it becomes the car Lena drives, and the police notice.
      const parked = fleet.nearestParked(player.x, player.z);
      if (parked) {
        fleet.steal(parked);
        car.specKey = parked.specKey;
        car.spec = parked.spec;
        car.x = parked.x;
        car.z = parked.z;
        car.heading = parked.heading;
        car.speed = 0;
        car.steer = 0;
        car.damage = parked.damage;
        renderer.swapPlayerCar(car.spec);
        state.inCar = true;
        player.x = car.x;
        player.z = car.z;
        player.heading = car.heading;
        cameraView.distance = CAMERA.carDistance;
        police.onCarTheft();
        story.say(BARKS.stolen);
        announce(`Stole the ${car.spec.name}. The SBPD noticed.`);
      }
      }
    }
  }
  // R reloads on foot — but in a car it cycles the radio instead.
  if (actions & ACTION_RELOAD) {
    if (state.inCar) {
      radioLabel = `♪ ${audio.cycleStation()}`;
      radioUntil = performance.now() + 4000;
      audio.uiClick();
    } else {
      combat.startReload();
    }
  }

  const mouse = input.takeMouseDelta();
  if (state.inCar) {
    cameraView.yaw -= mouse.dx * 0.004;
  } else {
    cameraView.yaw -= mouse.dx * 0.005;
  }
  cameraView.pitch = Math.max(
    CAMERA.minPitch,
    Math.min(CAMERA.maxPitch, cameraView.pitch + mouse.dy * 0.004),
  );

  if (state.inCar) stepCar(dt, input);
  else stepOnFoot(dt, input, actions);

  if (state.inCar) {
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
  }

  // Missions, story and combat advance on the same fixed step.
  missions.update(dt, { player, car, inCar: state.inCar, wanted: police.wanted });
  story.update(dt);
  state.objective = missions.objective;
  const damage = combat.update(dt, {
    player,
    cameraYaw: cameraView.yaw,
    firing: input.firing(),
    effects,
    inCar: state.inCar,
  });
  damagePlayer(damage);
  gunfireTimer = Math.max(0, gunfireTimer - dt);

  // Core systems advance on the same fixed step.
  traffic.update(dt, { playerCar: car, inCar: state.inCar, playerOnFoot: state.inCar ? null : player });
  pedestrians.update(dt, {
    player,
    playerCar: car,
    inCar: state.inCar,
    wanted: police.wanted,
    gunfire: gunfireTimer > 0,
  });
  police.update(dt, { player, playerCar: car, inCar: state.inCar, health: state.health });
  effects.update(dt);
  state.wanted = police.wanted;
  handleEvents();

  // Side activities, postcards and the garage advance on the same fixed step.
  activities.update(dt, { player, car, inCar: state.inCar });
  collectibles.update(dt, { player, car, inCar: state.inCar });
  garage.update(dt);
  handleActivityEvents();

  // Hitting a pedestrian: they go down, the police notice, the screen shakes.
  const hitPed = pedestrians.hitPedestrian(player, car, state.inCar);
  if (hitPed) {
    pedestrians.knockDown(hitPed);
    police.onHitPedestrian();
    effects.burst(hitPed.mesh.position.x, 1, hitPed.mesh.position.z, 8, 0xd92a2a);
    effects.shake(0.4);
    state.wanted = police.wanted;
  }

  // Busted / Wasted: lose some money, lose the heat, wake up at the garage.
  if (police.outcome === OUTCOME_BUSTED || police.outcome === OUTCOME_WASTED) {
    const busted = police.outcome === OUTCOME_BUSTED;
    state.outcome = busted ? 'Busted' : 'Wasted';
    state.money = Math.max(0, state.money - 100);
    state.health = 100;
    state.armor = 0;
    police.clearWanted();
    state.wanted = 0;
    state.inCar = false;
    car.speed = 0;
    player.x = SPAWN.player.x;
    player.z = SPAWN.player.z;
    player.heading = SPAWN.player.heading;
    cameraView.yaw = player.heading;
    combat.clearEnemies();
    activities.endActivity();
    story.say(busted ? BARKS.busted : BARKS.wasted);
    announce(busted ? 'Busted! The SBPD took $100. Back at the garage.' : 'Wasted! The SBPD took $100. Back at the garage.');
  }
}

// --- HUD (hud.js owns the elements; main.js only feeds it the state) ----------

function updateHud() {
  const line = story.current();
  const speaker = story.currentSpeaker();
  hud.update({
    money: state.money,
    health: Math.round(state.health),
    armor: Math.round(state.armor),
    wanted: state.wanted,
    objective: state.objective,
    activityLine: activities.statusLine() || `☀ Sun postcards ${collectibles.foundCount}/20`,
    missionName: missionLabel || (missions.status === 'all-done' ? 'High Tide — complete' : missions.missionName),
    missionStage: missionStageOverride || missions.stageLabel,
    timer: missionTimerOverride > 0 ? missionTimerOverride : missions.timer,
    speedKmh: shotSpeedKmh !== null ? shotSpeedKmh : Math.round(Math.abs(car.speed) * 3.6),
    inCar: state.inCar,
    prompt: hudPrompt(),
    weapon: combat.weapon,
    ammo: combat.hasPistol ? `${combat.ammoInMag} / ${combat.ammoReserve}` : '',
    weaponSlots: weaponSlotList(combat),
    policeUnits: police.responseList(state.inCar ? car.x : player.x, state.inCar ? car.z : player.z),
    respect: respectOverride !== null ? respectOverride : Math.max(missions.respect, Math.min(4, Math.floor(state.missionsCompleted / 2))),
    carName: car.spec.name,
    carCondition: vehicleCondition(car),
    dialogue: line && speaker ? { speakerName: speaker.name, speakerColor: speaker.color, text: line.text } : null,
    radio: radioUntil > performance.now() ? radioLabel : '',
    radioNow: radioNowOverride || (state.inCar ? audio.nowPlayingLabel() : ''),
  }, { player, car, traffic, fleet, police, missions, combat, activities, collectibles, garage });
}

function hudPrompt() {
  if (state.inCar) {
    if (garage.isInGarage(car.x, car.z)) return 'Get out here to keep this car & save';
    if (car.specKey === 'taxi' && !activities.active) return 'Taxi — pick up the passenger on Palm Row';
    return 'R — radio';
  }
  if (nearCar()) return `E — Get in the ${car.spec.name}`;
  const stored = garage.nearestStored(player.x, player.z);
  if (stored) return `E — Take the ${VEHICLES[stored.specKey].name} out of the garage`;
  const parked = fleet.nearestParked(player.x, player.z);
  if (parked) return `E — Steal the ${parked.spec.name}`;
  if (Math.hypot(player.x - ACTIVITIES.courierStart.x, player.z - ACTIVITIES.courierStart.z) < 10 && !activities.active) return 'Courier parcels here — walk to them to start a run';
  if (combat.hasPistol) return 'Click — fire   R — reload';
  return '';
}

// --- Screens ------------------------------------------------------------------

const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const howPanel = document.getElementById('how-panel');

function showScreen(screen) {
  state.screen = screen;
  titleScreen.style.display = screen === SCREEN_TITLE ? 'flex' : 'none';
  pauseScreen.style.display = screen === SCREEN_PAUSED ? 'flex' : 'none';
  hud.show(screen === SCREEN_PLAY);
  if (screen === SCREEN_TITLE) announce('Solmar Bay. Press Enter or click New Game to start.');
  if (screen === SCREEN_PAUSED) announce('Paused.');
}

function announce(message) {
  status.textContent = message;
}

function startGame(fromSave) {
  audio.init();
  audioStarted = true;
  if (fromSave) loadGame();
  else newGame();
  showScreen(SCREEN_PLAY);
  announce('Playing. Explore Solmar Bay.');
}

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-how').addEventListener('click', () => {
  howPanel.style.display = howPanel.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('btn-resume').addEventListener('click', () => {
  audio.uiClick();
  showScreen(SCREEN_PLAY);
  announce('Playing.');
});
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  audio.uiClick();
  combat.clearEnemies();
  missions.start(missions.index);
  showScreen(SCREEN_PLAY);
  announce(`Mission restarted: ${missions.missionName}.`);
});
document.getElementById('btn-quit').addEventListener('click', () => {
  saveGame();
  showScreen(SCREEN_TITLE);
});
document.getElementById('btn-continue').style.display = readSave() ? 'block' : 'none';

// --- Shot staging ---------------------------------------------------------------

const gameApi = {
  placePlayer(x, z, heading) {
    player.x = x;
    player.z = z;
    player.y = 0;
    player.heading = heading;
    player.vx = 0;
    player.vz = 0;
  },
  placeCar(x, z, heading, specKey) {
    if (specKey && VEHICLES[specKey] && specKey !== car.specKey) {
      car.specKey = specKey;
      car.spec = VEHICLES[specKey];
      renderer.swapPlayerCar(car.spec);
    }
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = 0;
    car.steer = 0;
  },
  setInCar(value) {
    state.inCar = value;
    if (value) {
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
    }
  },
  /** Place traffic cars for a staged shot (chase, activities). */
  placeTraffic(placements) {
    traffic.placeForShot(placements);
  },
  /** Place pedestrians for a staged shot (street). */
  placePedestrians(placements) {
    pedestrians.placeForShot(placements);
  },
  setCamera(view) {
    Object.assign(cameraView, view);
    if (view.mode === 'follow') {
      renderer.snapCamera(
        player.x - Math.sin(view.yaw) * view.distance,
        3,
        player.z - Math.cos(view.yaw) * view.distance,
      );
    }
  },
  setObjective(text) {
    state.objective = text;
  },
  setWanted(stars) {
    police.setWanted(stars);
    state.wanted = police.wanted;
  },
  setHealth(value) {
    state.health = value;
  },
  setArmor(value) {
    state.armor = value;
  },
  setMoney(value) {
    state.money = value;
  },
  stageChase() {
    missionLabel = 'Police Chase';
    traffic.placeForShot([
      { axis: 'x', road: 252, along: 10, direction: 1 },
      { axis: 'x', road: 252, along: 55, direction: 1 },
      { axis: 'x', road: 252, along: -70, direction: -1 },
      { axis: 'x', road: 252, along: 90, direction: 1 },
    ]);
    police.stageChase(car.x, car.z, car.heading);
    // A little smoke from the chase and skid marks under the Vela GT.
    effects.puff(car.x, 1.2, car.z);
    effects.skid(car.x - Math.sin(car.heading) * 2, car.z - Math.cos(car.heading) * 2, car.heading);
  },
  /** The HUD mission label for a staged shot (chase shows no mission name). */
  setMissionName(name) {
    missionLabel = name;
  },
  /** The HUD mission stage line for a staged shot ("CH 5 · STAGE 2/3"). */
  setMissionStage(stage) {
    missionStageOverride = stage;
  },
  /** The HUD mission timer for a staged shot, in seconds (0 hides it). */
  setMissionTimer(seconds) {
    missionTimerOverride = seconds;
  },
  /** The speed the HUD speedometer shows in a staged shot. Shot mode never
   * steps the world, so the car's real speed is 0 — the staged speed is the
   * speed the scene depicts, a chase at 148 km/h, a cruise at 96. */
  setShotSpeed(kmh) {
    shotSpeedKmh = kmh;
  },
  /** The radio now-playing line for a staged shot ("Bay FM 87.9 · song — artist"). */
  setRadioNow(label) {
    radioNowOverride = label;
  },
  /** The respect level (0-4) a staged shot shows: the chase is late-story,
   * so it reads 3, the street 2, the opening drive 1. */
  setRespect(value) {
    respectOverride = value;
  },
  /** Stage the Harbor Lights shootout for ?shot=mission (no stepping). */  stageMissionScene() {
    missions.start(3);
    // Jump straight to the shootout step: the reach step is already "done".
    missions.stepIndex = 1;
    missions.enterStep();
    // Shot mode never steps the world, so mission events never fire: hand
    // Lena the pistol directly instead of waiting for the 'give-pistol' event.
    combat.givePistol();
    // Shot mode never steps the world, so spawn the gunmen directly too.
    combat.spawnEnemies(HARBOR_ENEMY_SPOTS);
    // Place the beacon once (update() normally does this every step).
    missions.update(0, { player, car, inCar: false, wanted: 0 });
    state.health = 82;
    state.armor = 50;
    state.money = 1250;
    state.objective = missions.objective;
    // A muzzle flash beside the nearest gunman, so the shootout reads at once.
    effects.burst(-184, 1.4, -176, 6, 0xffe14f);
    story.sayOne('rosa', 'Kaine\u2019s men are on the dock. Clear them out, Lena.');
  },
  /** Stage a taxi fare mid-drop-off for ?shot=activities (no stepping). */
  stageActivities() {
    missionLabel = 'Side Activities';
    activities.stageTaxiScene();
    state.health = 100;
    state.armor = 0;
    state.money = 1250;
    state.objective = 'Taxi fare — drop off at Palm Row';
    story.sayOne('lena', 'A fare! Palm Row, coming right up.');
  },
};

function runShot(name) {
  stageShot(name, gameApi);
  showScreen(SCREEN_PLAY);
  let painted = 0;
  function paint() {
    // Keep painting after the shot is ready, so the scene stays live.
    requestAnimationFrame(paint);
    renderer.draw({ player, car, inCar: state.inCar, camera: cameraView, shake: effects.shakeOffset() }, STEP);
    updateHud();
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      window.__fps = renderer.getFps();
    }
    window.__fps = renderer.getFps();
  }
  requestAnimationFrame(paint);
}

// --- The loop -------------------------------------------------------------------

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  showScreen(SCREEN_TITLE);
  // Audio needs a user gesture: the first click or keypress unlocks it.
  const unlockAudio = () => {
    if (!audioStarted) {
      audio.init();
      audioStarted = true;
    }
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && state.screen === SCREEN_TITLE) startGame(false);
    else if (actions & ACTION_PAUSE && state.screen === SCREEN_PLAY) {
      saveGame();
      showScreen(SCREEN_PAUSED);
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && state.screen === SCREEN_PAUSED) {
      showScreen(SCREEN_PLAY);
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (state.screen === SCREEN_TITLE) {
      // A slow orbit over Old Harbor behind the title panel.
      state.titleOrbit += 0.02 * STEP;
      const radius = 46;
      const cx = SPAWN.player.x + Math.sin(state.titleOrbit) * radius;
      const cz = SPAWN.player.z + Math.cos(state.titleOrbit) * radius;
      cameraView.mode = 'fixed';
      cameraView.fixed = { x: cx, y: 17, z: cz };
      cameraView.target = { x: SPAWN.player.x, y: 2, z: SPAWN.player.z };
    } else if (state.screen === SCREEN_PLAY) {
      cameraView.mode = 'follow';
      // One-shot actions apply to the first sub-step only, never twice.
      let firstStep = true;
      while (accumulator >= STEP) {
        stepWorld(STEP, input, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw({ player, car, inCar: state.inCar, camera: cameraView, shake: effects.shakeOffset() }, STEP);
    if (state.screen === SCREEN_PLAY) {
      audio.setEngine(car.speed, state.inCar);
      audio.setSiren(state.wanted, now / 1000);
      updateHud();
    }
    window.__fps = renderer.getFps();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      saveGame();
      showScreen(SCREEN_PAUSED);
    }
  });
  window.addEventListener('beforeunload', saveGame);

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
window.__gameReady = true;
