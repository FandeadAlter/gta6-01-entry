// Collectibles: twenty hidden sun postcards scattered across Solmar Bay —
// one per spot in POSTCARDS.spots, all on roads, the beach road or open
// island ground, never inside a building. Each is a small gold card that
// spins and bobs over the ground; walk or drive within a few metres to pick
// it up. The count lives on the HUD; finding all twenty pays $500.
import * as THREE from 'three';
import { POSTCARDS } from './config.js';

const PICKUP_RADIUS = 3;

function makePostcardMesh() {
  const group = new THREE.Group();
  group.name = 'sun-postcard';
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.5, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
  );
  card.position.y = 1.4;
  group.add(card);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 16),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
  );
  sun.position.set(0, 1.55, 0.05);
  group.add(sun);
  const sea = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.3, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x2e7fa8 }),
  );
  sea.position.set(0, 0.95, 0.05);
  group.add(sea);
  group.userData = { card, sun, sea };
  return group;
}

export class CollectiblesManager {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'collectibles';
    scene.add(this.group);
    this.cards = POSTCARDS.spots.map((spot, index) => {
      const mesh = makePostcardMesh();
      mesh.position.set(spot.x, 0, spot.z);
      this.group.add(mesh);
      return { id: index, x: spot.x, z: spot.z, found: false, mesh };
    });
    this.events = [];
    this.time = 0;
    this.allFoundPaid = false;
  }

  /** How many postcards Lena has found. */
  get foundCount() {
    return this.cards.filter((card) => card.found).length;
  }

  /** True once every postcard is found. */
  get allFound() {
    return this.foundCount >= POSTCARDS.count;
  }

  /** Events queued since the last call ('postcard:3', 'postcards-complete'). */
  takeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Mark cards by id as already found (loading a save). */
  setFound(ids) {
    const wanted = new Set(ids || []);
    for (const card of this.cards) {
      card.found = wanted.has(card.id);
      card.mesh.visible = !card.found;
    }
    this.allFoundPaid = this.allFound;
  }

  /** The ids of the cards found so far, for the save. */
  foundIds() {
    return this.cards.filter((card) => card.found).map((card) => card.id);
  }

  /** The nearest card still out there, for the minimap: { x, z } or null. */
  nearestUnfound(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const card of this.cards) {
      if (card.found) continue;
      const dist = Math.hypot(card.x - x, card.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = card;
      }
    }
    return best ? { x: best.x, z: best.z } : null;
  }

  update(dt, context) {
    this.time += dt;
    const { player, car, inCar } = context;
    const px = inCar ? car.x : player.x;
    const pz = inCar ? car.z : player.z;
    for (const card of this.cards) {
      if (card.found) continue;
      // Spin and bob so a card catches the eye from down the street.
      card.mesh.rotation.y += dt * 1.8;
      card.mesh.position.y = Math.sin(this.time * 2 + card.id) * 0.25;
      if (Math.hypot(px - card.x, pz - card.z) < PICKUP_RADIUS) {
        card.found = true;
        card.mesh.visible = false;
        this.events.push(`postcard:${this.foundCount}`);
        if (this.allFound && !this.allFoundPaid) {
          this.allFoundPaid = true;
          this.events.push(`postcards-complete:${POSTCARDS.reward}`);
        }
      }
    }
  }
}
