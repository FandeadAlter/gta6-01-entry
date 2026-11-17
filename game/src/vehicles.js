// Vehicles: every drivable model in Solmar Bay, arcade handling, damage and
// smoke, and the stealable parked cars. The player car itself is state only —
// render.js draws it — while parked and stolen cars carry their own meshes so
// entering one visibly swaps the car the player drives.
import * as THREE from 'three';
import { EFFECTS, VEHICLES } from './config.js';

/** One vehicle state: spec, pose, speed, steering and damage (0 = new, 1 = wreck). */
export function createVehicle(specKey, x, z, heading) {
  const spec = VEHICLES[specKey];
  return {
    id: `${specKey}-${Math.round(x)}-${Math.round(z)}`,
    specKey,
    spec,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    damage: 0,
    stolen: false,
    parked: true,
    mesh: null,
  };
}

/**
 * Arcade handling for one fixed step. Returns true when the car hit a building
 * hard enough to take damage. `pedal` is 1 / -1 / 0, `steerInput` -1..1.
 */
export function stepVehicle(vehicle, pedal, steerInput, dt, city) {
  const spec = vehicle.spec;
  const steerMax = spec.steerMax / (1 + Math.abs(vehicle.speed) * 0.12);
  const steerTarget = steerInput * steerMax;
  vehicle.steer += (steerTarget - vehicle.steer) * Math.min(1, dt * 8);
  if (pedal > 0) {
    vehicle.speed += (vehicle.speed < 0 ? spec.brake : spec.accel) * dt;
  } else if (pedal < 0) {
    vehicle.speed -= (vehicle.speed > 0 ? spec.brake : spec.accel * 0.6) * dt;
  } else {
    vehicle.speed -= vehicle.speed * Math.min(1, dt * 1.4);
    if (Math.abs(vehicle.speed) < 0.2) vehicle.speed = 0;
  }
  vehicle.speed = Math.max(-spec.maxReverse, Math.min(spec.maxSpeed, vehicle.speed));
  vehicle.heading += (vehicle.speed / 2.8) * Math.tan(vehicle.steer) * dt;
  const prevX = vehicle.x;
  const prevZ = vehicle.z;
  vehicle.x += Math.sin(vehicle.heading) * vehicle.speed * dt;
  vehicle.z += Math.cos(vehicle.heading) * vehicle.speed * dt;
  const beforeX = vehicle.x;
  const beforeZ = vehicle.z;
  city.collideCircle(vehicle, spec.radius);
  const hitWall = vehicle.x !== beforeX || vehicle.z !== beforeZ;
  if (hitWall) {
    const impact = Math.abs(vehicle.speed);
    vehicle.speed *= 0.55;
    if (impact > 6) vehicle.damage = Math.min(1, vehicle.damage + impact * 0.012);
  }
  if (!city.onLand(vehicle.x, vehicle.z)) {
    vehicle.x = prevX;
    vehicle.z = prevZ;
    vehicle.speed *= 0.3;
  }
  // A wrecked car limps: top speed falls as damage rises.
  if (vehicle.damage > 0.6) {
    const cap = spec.maxSpeed * (1 - (vehicle.damage - 0.6) * 1.4);
    vehicle.speed = Math.max(-spec.maxReverse, Math.min(cap, vehicle.speed));
  }
  return hitWall && Math.abs(vehicle.speed) > 4;
}

/** Damage smoke: true once the car is hurt enough to show it. */
export function isSmoking(vehicle) {
  return vehicle.damage > 0.45;
}

/** A low-poly procedural car mesh, facing +z. Kind changes the silhouette. */
export function makeVehicleMesh(spec) {
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
  const len = spec.length;
  if (spec.kind === 'bike') {
    box(0.5, 0.5, len, paint, 0, 0.7, 0);
    box(0.4, 0.4, 0.7, glass, 0, 1.05, 0.2);
    box(0.3, 0.5, 0.5, tyre, 0, 0.35, len / 2 - 0.3);
    box(0.3, 0.5, 0.5, tyre, 0, 0.35, -len / 2 + 0.3);
    group.userData = { wheels: [] };
    return group;
  }
  if (spec.kind === 'van') {
    box(2.0, 1.9, len, paint, 0, 1.25, 0);
    box(1.8, 0.7, 0.5, glass, 0, 1.9, len / 2 - 0.3);
  } else if (spec.kind === 'pickup') {
    box(1.9, 0.62, len, paint, 0, 0.62, 0);
    box(1.7, 0.55, len * 0.34, glass, 0, 1.2, len * 0.18);
    box(1.8, 0.5, len * 0.4, new THREE.MeshLambertMaterial({ color: 0x5a4a3a }), 0, 0.95, -len * 0.26);
  } else {
    box(1.9, 0.62, len, paint, 0, 0.62, 0);
    box(1.7, 0.55, len * 0.5, glass, 0, 1.2, -len * 0.06);
    box(1.72, 0.1, len * 0.5, paint, 0, 1.5, -len * 0.06);
  }
  if (spec.kind === 'police') {
    box(1.92, 0.12, len * 0.9, new THREE.MeshLambertMaterial({ color: 0xf5f0e0 }), 0, 0.95, 0);
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2a6aff }),
    );
    lightBar.position.set(0, 1.62, 0);
    group.add(lightBar);
    group.userData.lightBar = lightBar;
  }
  if (spec.kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe14f }),
    );
    sign.position.set(0, 1.62, 0);
    group.add(sign);
  }
  box(0.4, 0.18, 0.08, new THREE.MeshBasicMaterial({ color: 0xfff2cc }), -0.6, 0.66, len / 2);
  box(0.4, 0.18, 0.08, new THREE.MeshBasicMaterial({ color: 0xfff2cc }), 0.6, 0.66, len / 2);
  box(0.5, 0.16, 0.08, new THREE.MeshBasicMaterial({ color: 0xd92a2a }), -0.6, 0.66, -len / 2);
  box(0.5, 0.16, 0.08, new THREE.MeshBasicMaterial({ color: 0xd92a2a }), 0.6, 0.66, -len / 2);
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelZ = spec.kind === 'van' ? 1.7 : 1.45;
  for (const [wx, wz] of [[-0.85, wheelZ], [0.85, wheelZ], [-0.85, -wheelZ], [0.85, -wheelZ]]) {
    const wheel = new THREE.Mesh(wheelGeometry, tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData = { ...group.userData, wheels };
  return group;
}

/** Where the stealable cars wait: on roads near the spawn, Palm Row and Neon Mile. */
const PARKED_SPOTS = [
  ['vela', 36, 200, 0],
  ['toro', -108, 216, Math.PI / 2],
  ['mule', 108, -36, Math.PI],
  ['wasp', -36, 180, Math.PI / 2],
  ['taxi', 180, 36, 0],
  ['alba', -36, -180, Math.PI],
];

/**
 * The fleet: the player's current car plus the parked cars that can be stolen.
 * Parked cars get meshes in the scene; the player's car is drawn by render.js.
 */
export class VehicleFleet {
  constructor(scene, random) {
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    scene.add(this.group);
    this.parked = PARKED_SPOTS.map(([key, x, z, heading]) => {
      const vehicle = createVehicle(key, x, z, heading);
      vehicle.mesh = makeVehicleMesh(vehicle.spec);
      vehicle.mesh.position.set(x, 0, z);
      vehicle.mesh.rotation.y = heading;
      this.group.add(vehicle.mesh);
      return vehicle;
    });
    void random;
    void EFFECTS;
  }

  /** The closest parked car within `maxDist` metres of (x, z), or null. */
  nearestParked(x, z, maxDist = 4) {
    let best = null;
    let bestDist = maxDist;
    for (const vehicle of this.parked) {
      if (vehicle.stolen) continue;
      const dist = Math.hypot(vehicle.x - x, vehicle.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = vehicle;
      }
    }
    return best;
  }

  /** Take a parked car: hide its parked mesh, mark it stolen, return its state. */
  steal(vehicle) {
    vehicle.stolen = true;
    vehicle.parked = false;
    if (vehicle.mesh) vehicle.mesh.visible = false;
    return vehicle;
  }

  /** Put a stolen car back on the street (used when the player abandons it). */
  abandon(vehicle) {
    vehicle.parked = true;
    vehicle.stolen = false;
    if (vehicle.mesh) {
      vehicle.mesh.visible = true;
      vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
      vehicle.mesh.rotation.y = vehicle.heading;
    }
  }

  /** Sync a parked car's mesh after it was moved (traffic nudges, shots). */
  syncParked() {
    for (const vehicle of this.parked) {
      if (!vehicle.mesh || vehicle.stolen) continue;
      vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
      vehicle.mesh.rotation.y = vehicle.heading;
    }
  }
}
