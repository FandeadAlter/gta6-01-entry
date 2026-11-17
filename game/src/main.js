// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between three screens: title, play and
// paused. Step 3: core systems — stealable vehicles, traffic, pedestrians,
// police with a five-star wanted level, and effects — wired into the loop.
//
// ?seed=N fixes the city layout. ?shot=drive|street|city|chase (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { CAMERA, CLOCK, MISSIONS, PLAYER, POLICE, SAVE_KEY, SPAWN, STEP, VEHICLES } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_JUMP, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { VehicleFleet, createVehicle, isSmoking, stepVehicle } from './vehicles.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { OUTCOME_BUSTED, OUTCOME_WASTED, PoliceManager } from './police.js';
import { EffectsManager } from './effects.js';

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
  wanted: 0,
  objective: MISSIONS[0].objective,
  titleOrbit: 0,
  outcome: '',
};
let recklessTimer = 0;
let smokeTimer = 0;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      player: { x: player.x, z: player.z, heading: player.heading },
      car: { x: car.x, z: car.z, heading: car.heading, specKey: car.specKey, damage: car.damage },
      inCar: state.inCar,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  if (!save) return;
  state.money = save.money || 0;
  if (save.player) {
    player.x = save.player.x;
    player.z = save.player.z;
    player.heading = save.player.heading;
  }
  if (save.car) {
    car.x = save.car.x;
    car.z = save.car.z;
    car.heading = save.car.heading;
    car.damage = save.car.damage || 0;
    if (save.car.specKey && VEHICLES[save.car.specKey] && save.car.specKey !== car.specKey) {
      car.specKey = save.car.specKey;
      car.spec = VEHICLES[save.car.specKey];
      renderer.swapPlayerCar(car.spec);
    }
  }
  state.inCar = Boolean(save.inCar);
  cameraView.yaw = player.heading;
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
    } else if (nearCar()) {
      state.inCar = true;
      player.x = car.x;
      player.z = car.z;
      cameraView.distance = CAMERA.carDistance;
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
        announce(`Stole the ${car.spec.name}. The SBPD noticed.`);
      }
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

  // Core systems advance on the same fixed step.
  traffic.update(dt, { playerCar: car, inCar: state.inCar, playerOnFoot: state.inCar ? null : player });
  pedestrians.update(dt, {
    player,
    playerCar: car,
    inCar: state.inCar,
    wanted: police.wanted,
    gunfire: false,
  });
  police.update(dt, { player, playerCar: car, inCar: state.inCar, health: state.health });
  effects.update(dt);
  state.wanted = police.wanted;

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
    police.clearWanted();
    state.wanted = 0;
    state.inCar = false;
    car.speed = 0;
    player.x = SPAWN.player.x;
    player.z = SPAWN.player.z;
    player.heading = SPAWN.player.heading;
    cameraView.yaw = player.heading;
    announce(busted ? 'Busted! The SBPD took $100. Back at the garage.' : 'Wasted! The SBPD took $100. Back at the garage.');
  }
}

// --- HUD ----------------------------------------------------------------------

const hud = {
  stars: document.getElementById('stars'),
  money: document.getElementById('money'),
  healthFill: document.getElementById('health-fill'),
  objective: document.getElementById('objective'),
  speed: document.getElementById('speed-value'),
  speedUnit: document.getElementById('speed-unit'),
  clock: document.getElementById('clock'),
  fps: document.getElementById('fps'),
  prompt: document.getElementById('prompt'),
  district: document.getElementById('district-label'),
  minimap: document.getElementById('minimap'),
};
const minimapContext = hud.minimap.getContext('2d');
const lastHud = { money: -1, health: -1, wanted: -1, objective: '', speed: -1, prompt: null, district: '' };

function drawMinimap() {
  const size = hud.minimap.width;
  const scale = size / 580;
  const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
  const ctx = minimapContext;
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#9aa07e';
  ctx.fillRect(...toMap(-258, -258), 516 * scale, 516 * scale);
  const island = city.island;
  ctx.fillRect(...toMap(island.minX, island.minZ), (island.maxX - island.minX) * scale, (island.maxZ - island.minZ) * scale);
  ctx.fillStyle = '#e0c188';
  ctx.fillRect(...toMap(-258, 258), 516 * scale, 42 * scale);
  ctx.fillStyle = '#8a8578';
  ctx.fillRect(...toMap(252, -7), 54 * scale, 14 * scale);
  ctx.strokeStyle = '#3a3a40';
  ctx.lineWidth = 2;
  for (const road of city.roads) {
    ctx.beginPath();
    let [x1, y1] = toMap(-258, road);
    let [x2, y2] = toMap(258, road);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    [x1, y1] = toMap(road, -258);
    [x2, y2] = toMap(road, 258);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Traffic cars as small grey dots, parked stealable cars as gold dots.
  ctx.fillStyle = '#c8c8c8';
  for (const pos of traffic.positions()) {
    const [tx, ty] = toMap(pos.x, pos.z);
    ctx.fillRect(tx - 1, ty - 1, 2, 2);
  }
  ctx.fillStyle = '#f2c94c';
  for (const parked of fleet.parked) {
    if (parked.stolen) continue;
    const [tx, ty] = toMap(parked.x, parked.z);
    ctx.fillRect(tx - 1, ty - 1, 3, 3);
  }
  // Police blips: cruisers red, officers blue, helicopter yellow.
  const blips = police.blips();
  ctx.fillStyle = '#d92a2a';
  for (const cruiser of blips.cruisers) {
    const [bx, by] = toMap(cruiser.x, cruiser.z);
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a6aff';
  for (const officer of blips.officers) {
    const [bx, by] = toMap(officer.x, officer.z);
    ctx.fillRect(bx - 2, by - 2, 4, 4);
  }
  if (blips.helicopter) {
    ctx.fillStyle = '#ffe14f';
    const [hx, hy] = toMap(blips.helicopter.x, blips.helicopter.z);
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player's car, then the player arrow on top.
  const [carX, carY] = toMap(car.x, car.z);
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(carX, carY, 4, 0, Math.PI * 2);
  ctx.fill();
  const [px, py] = toMap(player.x, player.z);
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(px, py);
  // Map: +x is right, +z is down; the arrow is drawn pointing up, so rotate
  // by PI - heading to point it along (sin h, cos h).
  ctx.rotate(Math.PI - player.heading);
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateHud() {
  const speedKmh = Math.round(Math.abs(car.speed) * 3.6);
  if (state.money !== lastHud.money) {
    lastHud.money = state.money;
    hud.money.textContent = `$${state.money.toLocaleString('en-US')}`;
  }
  if (state.health !== lastHud.health) {
    lastHud.health = state.health;
    hud.healthFill.style.width = `${state.health}%`;
  }
  if (state.wanted !== lastHud.wanted) {
    lastHud.wanted = state.wanted;
    hud.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  }
  if (state.objective !== lastHud.objective) {
    lastHud.objective = state.objective;
    hud.objective.textContent = state.objective;
  }
  if (speedKmh !== lastHud.speed) {
    lastHud.speed = speedKmh;
    hud.speed.textContent = state.inCar ? String(speedKmh) : '';
    hud.speedUnit.style.visibility = state.inCar ? 'visible' : 'hidden';
  }
  let prompt = '';
  if (!state.inCar) {
    if (nearCar()) prompt = `E — Get in the ${car.spec.name}`;
    else {
      const parked = fleet.nearestParked(player.x, player.z);
      if (parked) prompt = `E — Steal the ${parked.spec.name}`;
    }
  }
  if (prompt !== lastHud.prompt) {
    lastHud.prompt = prompt;
    hud.prompt.textContent = prompt;
    hud.prompt.style.visibility = prompt ? 'visible' : 'hidden';
  }
  const districtKey = city.districtAt(player.x, player.z);
  const districtName = {
    palmRow: 'Palm Row',
    oldHarbor: 'Old Harbor',
    neonMile: 'Neon Mile',
    coralHeights: 'Coral Heights',
    theYard: 'The Yard',
    midtown: 'Midtown',
  }[districtKey];
  if (districtName !== lastHud.district) {
    lastHud.district = districtName;
    hud.district.textContent = districtName;
  }
  hud.clock.textContent = CLOCK;
  hud.fps.textContent = `${renderer.getFps()} fps`;
  drawMinimap();
}

// --- Screens ------------------------------------------------------------------

const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const howPanel = document.getElementById('how-panel');

function showScreen(screen) {
  state.screen = screen;
  titleScreen.style.display = screen === SCREEN_TITLE ? 'flex' : 'none';
  pauseScreen.style.display = screen === SCREEN_PAUSED ? 'flex' : 'none';
  document.getElementById('hud').style.visibility = screen === SCREEN_PLAY ? 'visible' : 'hidden';
  if (screen === SCREEN_TITLE) announce('Solmar Bay. Press Enter or click New Game to start.');
  if (screen === SCREEN_PAUSED) announce('Paused.');
}

function announce(message) {
  status.textContent = message;
}

function startGame(fromSave) {
  if (fromSave) applySave(readSave());
  showScreen(SCREEN_PLAY);
  announce('Playing. Explore Solmar Bay.');
}

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-how').addEventListener('click', () => {
  howPanel.style.display = howPanel.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('btn-resume').addEventListener('click', () => {
  showScreen(SCREEN_PLAY);
  announce('Playing.');
});
document.getElementById('btn-quit').addEventListener('click', () => {
  writeSave();
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
  stageChase() {
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
};

function runShot(name) {
  stageShot(name, gameApi);
  showScreen(SCREEN_PLAY);
  let painted = 0;
  function paint() {
    // Keep painting after the shot is ready, so the fps counter stays live.
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

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && state.screen === SCREEN_TITLE) startGame(false);
    else if (actions & ACTION_PAUSE && state.screen === SCREEN_PLAY) {
      writeSave();
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
    if (state.screen === SCREEN_PLAY) updateHud();
    window.__fps = renderer.getFps();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      writeSave();
      showScreen(SCREEN_PAUSED);
    }
  });
  window.addEventListener('beforeunload', writeSave);

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
window.__gameReady = true;
