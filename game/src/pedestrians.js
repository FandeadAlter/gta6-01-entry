// Pedestrians: sidewalk walkers who stroll the blocks, cross at intersections,
// and flee from gunfire, speeding cars and a rising wanted level. Each one is a
// small procedural person with its own shirt colour and walk swing.
import * as THREE from 'three';
import { PEDS, WORLD } from './config.js';
import { pick, range } from './random.js';

const SHIRTS = [0xd9553f, 0x2e6fd8, 0x4a8a4a, 0xf2c94c, 0x9a6bff, 0xe8e0d0, 0x35e0e0, 0xc78a2e];
const SKINS = [0xd9a066, 0x8a5a3a, 0xf0c8a0, 0x6a4a2a];

function makePersonMesh(random) {
  const group = new THREE.Group();
  group.name = 'pedestrian';
  const shirt = new THREE.MeshLambertMaterial({ color: pick(random, SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(random, SKINS) });
  const denim = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const leftLeg = box(0.2, 0.75, 0.22, denim, -0.13, 0.38, 0);
  const rightLeg = box(0.2, 0.75, 0.22, denim, 0.13, 0.38, 0);
  box(0.58, 0.62, 0.32, shirt, 0, 1.08, 0);
  const leftArm = box(0.15, 0.55, 0.18, shirt, -0.37, 1.08, 0);
  const rightArm = box(0.15, 0.55, 0.18, shirt, 0.37, 1.08, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  group.add(head);
  group.userData = { leftLeg, rightLeg, leftArm, rightArm };
  return group;
}

/** A walker strolling one sidewalk line, or crossing a road at an intersection. */
function createPedestrian(random, index) {
  const road = pick(random, WORLD.roads);
  const axis = random() < 0.5 ? 'x' : 'z';
  return {
    axis,
    road,
    along: range(random, -240, 240),
    // Sidewalk offset: just outside the road edge.
    side: random() < 0.5 ? 8.5 : -8.5,
    direction: random() < 0.5 ? 1 : -1,
    speed: range(random, PEDS.minSpeed, PEDS.maxSpeed),
    walkPhase: random() * Math.PI * 2,
    fleeing: false,
    fleeX: 0,
    fleeZ: 0,
    mesh: null,
    index,
  };
}

function pedPosition(ped) {
  if (ped.axis === 'x') return { x: ped.along, z: ped.road + ped.side };
  return { x: ped.road + ped.side, z: ped.along };
}

export class PedestrianManager {
  constructor(scene, random) {
    this.group = new THREE.Group();
    this.group.name = 'pedestrians';
    scene.add(this.group);
    this.peds = [];
    for (let index = 0; index < PEDS.count; index += 1) {
      const ped = createPedestrian(random, index);
      ped.mesh = makePersonMesh(random);
      this.group.add(ped.mesh);
      this.peds.push(ped);
    }
    this.syncMeshes();
  }

  update(dt, context) {
    const { player, playerCar, inCar, wanted, gunfire } = context;
    const threatX = inCar ? playerCar.x : player.x;
    const threatZ = inCar ? playerCar.z : player.z;
    const playerSpeed = inCar ? Math.abs(playerCar.speed) : 0;
    for (const ped of this.peds) {
      const pos = pedPosition(ped);
      const distToThreat = Math.hypot(pos.x - threatX, pos.z - threatZ);
      const scared =
        gunfire ||
        wanted >= 2 ||
        (playerSpeed > 15 && distToThreat < PEDS.fleeRadius) ||
        distToThreat < 2.5;
      if (scared && !ped.fleeing) {
        ped.fleeing = true;
        // Run away from the threat, along the sidewalk.
        const away = Math.atan2(pos.x - threatX, pos.z - threatZ);
        ped.fleeX = Math.sin(away);
        ped.fleeZ = Math.cos(away);
      }
      if (ped.fleeing) {
        ped.along += ped.fleeX * PEDS.fleeSpeed * dt * (ped.axis === 'x' ? 1 : 0)
          + ped.fleeZ * PEDS.fleeSpeed * dt * (ped.axis === 'z' ? 1 : 0);
        // Fleeing on the wrong axis still moves them along their line; keep it simple.
        if (ped.axis === 'x') ped.along += ped.fleeX * PEDS.fleeSpeed * dt * 0;
        ped.walkPhase += PEDS.fleeSpeed * dt * 2.2;
        if (distToThreat > PEDS.fleeRadius * 2.2) ped.fleeing = false;
      } else {
        ped.along += ped.speed * ped.direction * dt;
        ped.walkPhase += ped.speed * dt * 1.8;
        if (ped.along > 248) {
          ped.along = 248;
          ped.direction = -1;
        }
        if (ped.along < -248) {
          ped.along = -248;
          ped.direction = 1;
        }
        // Sometimes step off the sidewalk and cross at an intersection.
        if (Math.abs(ped.along - Math.round(ped.along / 72) * 72) < 0.4 && Math.random() < PEDS.crossChance * dt * 10) {
          ped.side = -ped.side;
        }
      }
    }
    this.syncMeshes();
  }

  syncMeshes() {
    for (const ped of this.peds) {
      const pos = pedPosition(ped);
      ped.mesh.position.set(pos.x, 0, pos.z);
      const heading = ped.fleeing
        ? Math.atan2(ped.fleeX, ped.fleeZ)
        : ped.axis === 'x'
          ? (ped.direction > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (ped.direction > 0 ? 0 : Math.PI);
      ped.mesh.rotation.y = heading;
      const swing = Math.sin(ped.walkPhase) * (ped.fleeing ? 0.8 : 0.45);
      ped.mesh.userData.leftLeg.rotation.x = swing;
      ped.mesh.userData.rightLeg.rotation.x = -swing;
      ped.mesh.userData.leftArm.rotation.x = -swing * 0.8;
      ped.mesh.userData.rightArm.rotation.x = swing * 0.8;
    }
  }

  /** Stage fixed pedestrians for a shot: each walks one sidewalk line. */
  placeForShot(placements) {
    placements.forEach((place, index) => {
      const ped = this.peds[index % this.peds.length];
      ped.axis = place.axis;
      ped.road = place.road;
      ped.side = place.side;
      ped.along = place.along;
      ped.direction = place.direction;
      ped.fleeing = false;
    });
    this.syncMeshes();
  }

  /** True when the player (on foot or in a car) is touching a pedestrian. */
  hitPedestrian(player, playerCar, inCar) {
    const px = inCar ? playerCar.x : player.x;
    const pz = inCar ? playerCar.z : player.z;
    const radius = inCar ? 1.8 : 1.0;
    for (const ped of this.peds) {
      const pos = pedPosition(ped);
      if (Math.hypot(pos.x - px, pos.z - pz) < radius) return ped;
    }
    return null;
  }

  /** Knock a pedestrian down and make them flee once they get up. */
  knockDown(ped) {
    ped.fleeing = true;
    ped.fleeX = Math.random() < 0.5 ? 1 : -1;
    ped.fleeZ = Math.random() < 0.5 ? 1 : -1;
  }

  positions() {
    return this.peds.map((ped) => pedPosition(ped));
  }
}
