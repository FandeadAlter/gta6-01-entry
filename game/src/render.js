// Drawing only, in three.js: the scene, the golden-hour light, the sky and sea,
// the foot and car cameras, and the player and car meshes. The game state comes
// in, pixels go out; no rules live here.
import * as THREE from 'three';
import { CAMERA, PALETTE, VEHICLES } from './config.js';
import { buildCity } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The sun sits low in the west, so shadows stretch long to the east. */
const SUN_DIRECTION = new THREE.Vector3(-0.75, 0.42, 0.35).normalize();

function makePlayerMesh() {
  const group = new THREE.Group();
  group.name = 'lena';
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e7f8a });
  const denim = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a1a12 });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const leftLeg = box(0.22, 0.8, 0.24, denim, -0.14, 0.4, 0);
  const rightLeg = box(0.22, 0.8, 0.24, denim, 0.14, 0.4, 0);
  box(0.62, 0.65, 0.34, jacket, 0, 1.12, 0);
  const leftArm = box(0.16, 0.6, 0.2, jacket, -0.4, 1.12, 0);
  const rightArm = box(0.16, 0.6, 0.2, jacket, 0.4, 1.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.set(0, 1.66, 0);
  head.castShadow = true;
  group.add(head);
  box(0.44, 0.14, 0.42, hair, 0, 1.8, 0);
  group.userData = { leftLeg, rightLeg, leftArm, rightArm };
  return group;
}

/** A low-poly procedural car, facing +z. `spec` is one of VEHICLES. */
export function makeCarMesh(spec) {
  const group = new THREE.Group();
  group.name = spec.name.toLowerCase().replace(/\s+/g, '-');
  const paint = new THREE.MeshLambertMaterial({ color: spec.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x223344 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  box(1.9, 0.62, spec.length, paint, 0, 0.62, 0);
  box(1.7, 0.55, spec.length * 0.5, glass, 0, 1.2, -spec.length * 0.06);
  box(1.72, 0.1, spec.length * 0.5, paint, 0, 1.5, -spec.length * 0.06);
  box(0.4, 0.18, 0.08, new THREE.MeshBasicMaterial({ color: 0xfff2cc }), -0.6, 0.66, spec.length / 2);
  box(0.4, 0.18, 0.08, new THREE.MeshBasicMaterial({ color: 0xfff2cc }), 0.6, 0.66, spec.length / 2);
  box(0.5, 0.16, 0.08, new THREE.MeshBasicMaterial({ color: 0xd92a2a }), -0.6, 0.66, -spec.length / 2);
  box(0.5, 0.16, 0.08, new THREE.MeshBasicMaterial({ color: 0xd92a2a }), 0.6, 0.66, -spec.length / 2);
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeometry, tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData = { wheels };
  return group;
}

export function createRenderer(canvas, random) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 900);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

  // Golden-hour sky dome: warm near the horizon, blue overhead.
  const skyGeometry = new THREE.SphereGeometry(1200, 16, 12);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; void main() { float h = clamp(normalize(vPos).y * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, h), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);

  // The sun disc, low in the west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.sunDisc, fog: false }),
  );
  sunDisc.position.copy(SUN_DIRECTION).multiplyScalar(1050);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // A warm fill light from the east, so the shadow side of buildings and
  // cars never goes flat black in a screenshot — the city keeps its colour
  // even when the sun is behind it.
  const fill = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.55);
  scene.add(fill);
  scene.add(sun.target);

  const hemisphere = new THREE.HemisphereLight(0xffd9a8, 0x5a4a3a, 0.9);
  scene.add(hemisphere);

  const city = buildCity(scene, random);
  const playerMesh = makePlayerMesh();
  scene.add(playerMesh);
  let carMesh = makeCarMesh(VEHICLES.alba);
  scene.add(carMesh);
  const parkedMeshes = [];
  for (const [spec, x, z, heading] of [
    [VEHICLES.vela, 36, 200, 0],
    [VEHICLES.toro, -108, 216, Math.PI / 2],
    [VEHICLES.alba, 108, -36, Math.PI],
  ]) {
    const parked = makeCarMesh(spec);
    parked.position.set(x, 0, z);
    parked.rotation.y = heading;
    scene.add(parked);
    parkedMeshes.push(parked);
  }

  let frames = 0;
  let fpsTime = 0;
  let fps = 0;
  let lastFpsNow = performance.now();
  const cameraState = { x: 0, y: 40, z: 60 };
  // Smoothed camera values: the distance and pitch glide toward what the
  // game asks for, so getting in or out of a car (or the mouse looking
  // around) never snaps the frame — the camera settles behind the car.
  let smoothDistance = CAMERA.footDistance;
  let smoothPitch = 0.22;
  const lookTarget = new THREE.Vector3();

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /**
   * Paint one frame. `view` carries the player, the car, whether the player is
   * driving, and the camera: { yaw, pitch, distance, mode, fixed }.
   */
  function draw(view, dt) {
    // Frames per real second, not per simulated step: a slow machine must show it.
    const now = performance.now();
    frames += 1;
    fpsTime += (now - lastFpsNow) / 1000;
    lastFpsNow = now;
    if (fpsTime >= 0.5) {
      fps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
    }

    const player = view.player;
    playerMesh.position.set(player.x, player.y, player.z);
    playerMesh.rotation.y = player.heading;
    playerMesh.visible = !view.inCar;
    const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
    playerMesh.userData.leftLeg.rotation.x = swing;
    playerMesh.userData.rightLeg.rotation.x = -swing;
    playerMesh.userData.leftArm.rotation.x = -swing * 0.8;
    playerMesh.userData.rightArm.rotation.x = swing * 0.8;

    const car = view.car;
    carMesh.position.set(car.x, 0, car.z);
    carMesh.rotation.y = car.heading;
    const wheelSpin = car.speed * dt * 2.8;
    for (const wheel of carMesh.userData.wheels) wheel.rotation.x += wheelSpin;
    const steerAngle = Math.max(-0.4, Math.min(0.4, car.steer * 0.45));
    carMesh.userData.wheels[0].rotation.y = steerAngle;
    carMesh.userData.wheels[1].rotation.y = steerAngle;

    // The shadow box follows the player, so shadows stay sharp wherever they go.
    const focus = view.inCar ? car : player;
    sun.position.set(
      focus.x + SUN_DIRECTION.x * 260,
      SUN_DIRECTION.y * 260,
      focus.z + SUN_DIRECTION.z * 260,
    );
    sun.target.position.set(focus.x, 0, focus.z);
    sun.target.updateMatrixWorld();

    if (view.camera.mode === 'fixed') {
      camera.position.set(view.camera.fixed.x, view.camera.fixed.y, view.camera.fixed.z);
      lookTarget.set(view.camera.target.x, view.camera.target.y, view.camera.target.z);
      camera.lookAt(lookTarget);
      // A fixed shot (title orbit, city vista) resets the smoothing, so the
      // next follow shot does not glide in from the old distance.
      smoothDistance = view.camera.distance || CAMERA.footDistance;
      smoothPitch = view.camera.pitch || 0.22;
    } else {
      // Glide the distance and pitch: entering a car pulls the camera back
      // smoothly, and at speed it eases a little further out.
      const speedPull = view.inCar ? Math.min(Math.abs(view.car.speed) * 0.05, 1.5) : 0;
      const targetDistance = view.camera.distance + speedPull;
      const distSharp = 1 - Math.exp(-4 * dt);
      smoothDistance += (targetDistance - smoothDistance) * distSharp;
      const pitchSharp = 1 - Math.exp(-6 * dt);
      smoothPitch += (view.camera.pitch - smoothPitch) * pitchSharp;
      const distance = smoothDistance;
      const pitch = smoothPitch;
      const yaw = view.camera.yaw;
      const target = view.inCar ? car : player;
      const targetY = view.inCar ? 1.6 : 1.5;
      const desiredX = target.x - Math.sin(yaw) * Math.cos(pitch) * distance;
      const desiredY = targetY + Math.sin(pitch) * distance + (view.inCar ? CAMERA.carHeight : CAMERA.footHeight) * 0.4;
      const desiredZ = target.z - Math.cos(yaw) * Math.cos(pitch) * distance;
      const sharp = 1 - Math.exp(-CAMERA.followSharpness * dt);
      cameraState.x += (desiredX - cameraState.x) * sharp;
      cameraState.y += (desiredY - cameraState.y) * sharp;
      cameraState.z += (desiredZ - cameraState.z) * sharp;
      camera.position.set(cameraState.x, cameraState.y, cameraState.z);
      lookTarget.set(target.x, targetY, target.z);
      camera.lookAt(lookTarget);
    }
    sky.position.set(camera.position.x, 0, camera.position.z);
    sunDisc.position.copy(SUN_DIRECTION).multiplyScalar(1050).add(camera.position);
    sunDisc.lookAt(camera.position);
    if (view.shake) {
      camera.position.x += view.shake.x;
      camera.position.y += view.shake.y;
    }

    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    city,
    scene,
    /** Swap the player car's mesh when Lena steals a different model. */
    swapPlayerCar(spec) {
      scene.remove(carMesh);
      carMesh = makeCarMesh(spec);
      scene.add(carMesh);
    },
    getFps() {
      return fps;
    },
    /** Snap the smoothed camera to the target, for scene changes and shots. */
    snapCamera(x, y, z) {
      cameraState.x = x;
      cameraState.y = y;
      cameraState.z = z;
    },
  };
}
