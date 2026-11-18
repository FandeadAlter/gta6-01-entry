// The garage at Rosa's place in Old Harbor: Lena's safehouse. Park a car
// inside the green ring and get out, and the car is kept — its model joins
// the owned list, the game saves on the spot, and the car waits in a slot
// until Lena takes it out again. Owned cars are shown as real parked cars
// in the slots (never the car Lena is driving right now, so no car appears
// twice). The list survives in the save, up to three cars.
import * as THREE from 'three';
import { GARAGE, VEHICLES } from './config.js';
import { makeVehicleMesh } from './vehicles.js';

function makeGarageMarker() {
  const group = new THREE.Group();
  group.name = 'garage-marker';
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(10, 11, 32),
    new THREE.MeshBasicMaterial({ color: 0x5ec96a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0x5ec96a }),
  );
  diamond.position.y = 5;
  diamond.rotation.x = Math.PI;
  group.add(diamond);
  group.userData = { ring, diamond };
  return group;
}

export class GarageManager {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'garage';
    scene.add(this.group);
    this.marker = makeGarageMarker();
    this.marker.position.set(GARAGE.centre.x, 0, GARAGE.centre.z);
    this.group.add(this.marker);
    /** Owned car models, in slot order (specKeys, at most GARAGE.maxSlots). */
    this.owned = [];
    /** Display meshes for owned cars, keyed by specKey. */
    this.stored = new Map();
    this.time = 0;
  }

  /** True when (x, z) is inside the garage yard. */
  isInGarage(x, z) {
    const zone = GARAGE.zone;
    return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
  }

  /** Keep a car model: true when it was newly stored, false when already owned or full. */
  parkCar(specKey) {
    if (this.owned.includes(specKey)) return false;
    if (this.owned.length >= GARAGE.maxSlots) return false;
    this.owned.push(specKey);
    return true;
  }

  /** Load the owned list from a save (display meshes are rebuilt by syncOwned). */
  get ownedCount() {
    return this.owned.length;
  }
  setOwned(specKeys) {
    this.owned = (specKeys || []).filter((key) => VEHICLES[key]).slice(0, GARAGE.maxSlots);
  }

  /**
   * Rebuild the parked display cars: one mesh per owned model, in a slot,
   * except the model Lena is driving right now (its mesh is the player car).
   */
  syncOwned(currentSpecKey) {
    for (const [key, mesh] of this.stored) {
      if (!this.owned.includes(key) || key === currentSpecKey) {
        this.group.remove(mesh);
        this.stored.delete(key);
      }
    }
    this.owned.forEach((specKey, index) => {
      if (specKey === currentSpecKey) return;
      if (this.stored.has(specKey)) return;
      const slot = GARAGE.slots[index % GARAGE.slots.length];
      const mesh = makeVehicleMesh(VEHICLES[specKey]);
      mesh.position.set(slot.x, 0, slot.z);
      mesh.rotation.y = slot.heading;
      this.group.add(mesh);
      this.stored.set(specKey, mesh);
    });
  }

  /** The stored car within 4 m of (x, z), or null: { specKey, x, z, heading }. */
  nearestStored(x, z, maxDist = 4) {
    let best = null;
    let bestDist = maxDist;
    for (const [specKey, mesh] of this.stored) {
      const dist = Math.hypot(mesh.position.x - x, mesh.position.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = { specKey, x: mesh.position.x, z: mesh.position.z, heading: mesh.rotation.y };
      }
    }
    return best;
  }

  /** Take a stored car out of the garage: remove its display mesh and ownership. */
  takeStored(specKey) {
    const mesh = this.stored.get(specKey);
    if (mesh) {
      this.group.remove(mesh);
      this.stored.delete(specKey);
    }
    this.owned = this.owned.filter((key) => key !== specKey);
  }

  update(dt) {
    this.time += dt;
    const pulse = 0.4 + Math.sin(this.time * 2) * 0.12;
    this.marker.userData.ring.material.opacity = pulse;
    this.marker.userData.diamond.position.y = 5 + Math.sin(this.time * 1.8) * 0.4;
    this.marker.userData.diamond.rotation.y += dt;
  }
}
