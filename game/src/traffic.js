// Traffic: lane-following cars that brake for trouble ahead, stop at red
// lights, honk when stuck, and swerve around the player. Cars drive along one
// road line in one direction and wrap around at the city edge.
import * as THREE from 'three';
import { TRAFFIC, VEHICLES, WORLD } from './config.js';
import { makeVehicleMesh } from './vehicles.js';
import { pick, range, rangeInt } from './random.js';

const TRAFFIC_KEYS = ['alba', 'vela', 'toro', 'mule', 'taxi'];
const LIGHT_SPOTS = [
  { x: 0, z: 0 },
  { x: -36, z: 36 },
  { x: 36, z: -36 },
  { x: 108, z: 108 },
];

/** One traffic car: which road it follows, which lane, how fast it wants to go. */
function createTrafficCar(random, index) {
  const axis = random() < 0.5 ? 'x' : 'z';
  const road = pick(random, WORLD.roads);
  const direction = random() < 0.5 ? 1 : -1;
  const lane = direction > 0 ? 3 : -3;
  const along = range(random, -240, 240);
  const specKey = TRAFFIC_KEYS[index % TRAFFIC_KEYS.length];
  return {
    specKey,
    spec: VEHICLES[specKey],
    axis,
    road,
    direction,
    lane,
    along,
    speed: range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    cruise: range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
    honkTimer: range(random, 0, 4),
    honking: false,
    swerve: 0,
    mesh: null,
  };
}

function carPosition(car) {
  if (car.axis === 'x') return { x: car.along, z: car.road + car.lane + car.swerve };
  return { x: car.road + car.lane + car.swerve, z: car.along };
}

function carHeading(car) {
  if (car.axis === 'x') return car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  return car.direction > 0 ? 0 : Math.PI;
}

export class TrafficManager {
  constructor(scene, random) {
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    scene.add(this.group);
    this.cars = [];
    for (let index = 0; index < TRAFFIC.count; index += 1) {
      const car = createTrafficCar(random, index);
      car.mesh = makeVehicleMesh(car.spec);
      this.group.add(car.mesh);
      this.cars.push(car);
    }
    // Traffic lights at four busy intersections, cycling green / red.
    this.lights = LIGHT_SPOTS.map((spot) => {
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 5, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
      );
      pole.position.set(spot.x + 7, 2.5, spot.z + 7);
      pole.castShadow = true;
      this.group.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.6, 0.7),
        new THREE.MeshBasicMaterial({ color: 0x2ac96a }),
      );
      lamp.position.set(spot.x + 7, 5.4, spot.z + 7);
      this.group.add(lamp);
      return { ...spot, lamp, phase: range(random, 0, TRAFFIC.lightCycle * 2) };
    });
    this.time = 0;
    this.syncMeshes();
  }

  /** True while this intersection's light is red for traffic on `axis`. */
  lightIsRed(light, axis) {
    const cycle = (this.time + light.phase) % (TRAFFIC.lightCycle * 2);
    const nsGreen = cycle < TRAFFIC.lightCycle;
    return axis === 'x' ? !nsGreen : nsGreen;
  }

  /** Distance to the nearest thing ahead in the same lane, or Infinity. */
  aheadDistance(car, playerCar, inCar) {
    let best = Infinity;
    for (const other of this.cars) {
      if (other === car || other.axis !== car.axis || other.road !== car.road) continue;
      const gap = (other.along - car.along) * car.direction;
      if (gap > 0 && gap < best) best = gap;
    }
    if (inCar && playerCar) {
      const pos = carPosition(car);
      const dx = playerCar.x - pos.x;
      const dz = playerCar.z - pos.z;
      const alongGap = car.axis === 'x' ? dx * car.direction : dz * car.direction;
      const lateral = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (alongGap > 0 && alongGap < best && lateral < 4) best = alongGap;
    }
    return best;
  }

  update(dt, context) {
    this.time += dt;
    const { playerCar, inCar, playerOnFoot } = context;
    for (const light of this.lights) {
      const cycle = (this.time + light.phase) % (TRAFFIC.lightCycle * 2);
      light.lamp.material.color.setHex(cycle < TRAFFIC.lightCycle ? 0x2ac96a : 0xd92a2a);
    }
    for (const car of this.cars) {
      let targetSpeed = car.cruise;
      const ahead = this.aheadDistance(car, playerCar, inCar);
      if (ahead < TRAFFIC.brakeDistance) targetSpeed = 0;
      else if (ahead < TRAFFIC.brakeDistance * 2) targetSpeed = car.cruise * 0.4;
      // Stop at a red light just before the intersection.
      for (const light of this.lights) {
        if (car.axis === 'x' && Math.abs(car.road - light.z) > 1) continue;
        if (car.axis === 'z' && Math.abs(car.road - light.x) > 1) continue;
        const gap = (car.axis === 'x' ? light.x - car.along : light.z - car.along) * car.direction;
        if (gap > 0 && gap < 10 && this.lightIsRed(light, car.axis)) targetSpeed = 0;
      }
      // Swerve around a player on foot standing in the lane.
      car.swerve = 0;
      if (playerOnFoot) {
        const pos = carPosition(car);
        const dx = playerOnFoot.x - pos.x;
        const dz = playerOnFoot.z - pos.z;
        const alongGap = car.axis === 'x' ? dx * car.direction : dz * car.direction;
        const lateral = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (alongGap > 0 && alongGap < 14 && lateral < 5) {
          car.swerve = lateral < 2.5 ? 3.5 : 0;
          if (alongGap < 8) targetSpeed = 0;
        }
      }
      // Honk when stuck behind something for a while.
      car.honking = false;
      if (targetSpeed === 0 && ahead < TRAFFIC.honkDistance) {
        car.honkTimer -= dt;
        if (car.honkTimer <= 0) {
          car.honking = true;
          car.honkTimer = 3;
        }
      } else {
        car.honkTimer = Math.max(car.honkTimer, 0.5);
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 3);
      car.along += car.speed * car.direction * dt;
      if (car.along > 252) car.along = -252;
      if (car.along < -252) car.along = 252;
    }
    this.syncMeshes();
  }

  syncMeshes() {
    for (const car of this.cars) {
      const pos = carPosition(car);
      car.mesh.position.set(pos.x, 0, pos.z);
      car.mesh.rotation.y = carHeading(car);
      const spin = car.speed * (1 / 60) * 2.8;
      for (const wheel of car.mesh.userData.wheels || []) wheel.rotation.x += spin;
    }
  }

  /** Stage a fixed traffic scene (used by ?shot=chase): cars placed by hand. */
  placeForShot(placements) {
    placements.forEach((place, index) => {
      const car = this.cars[index % this.cars.length];
      car.axis = place.axis;
      car.road = place.road;
      car.along = place.along;
      car.direction = place.direction;
      car.lane = place.direction > 0 ? 3 : -3;
      car.speed = 0;
      car.cruise = 0;
      car.swerve = 0;
    });
    this.syncMeshes();
  }

  /** Positions of every traffic car, for the minimap. */
  positions() {
    return this.cars.map((car) => carPosition(car));
  }
}
