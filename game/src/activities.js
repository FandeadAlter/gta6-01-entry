// Side activities: taxi fares, courier runs and street races. One activity
// runs at a time; each starts by driving (or walking) into its start spot,
// pays out in cash, and reports what happened as plain events the loop in
// main.js acts on ('taxi-paid:65', 'courier-drop:30', 'race-won:300', ...).
// Markers are the same language as the mission beacon — a glowing ring and a
// floating diamond — in a different colour per activity, so a fare, a parcel
// and a race checkpoint each read at a glance in the world and on the minimap.
import * as THREE from 'three';
import { ACTIVITIES } from './config.js';
import { makeVehicleMesh } from './vehicles.js';

export const ACTIVITY_IDLE = 'idle';
export const ACTIVITY_TAXI = 'taxi';
export const ACTIVITY_COURIER = 'courier';
export const ACTIVITY_RACE = 'race';

/** Human names for the three side activities, for the HUD and the briefing. */
export const ACTIVITY_NAMES = {
  [ACTIVITY_TAXI]: 'Taxi fares',
  [ACTIVITY_COURIER]: 'Courier runs',
  [ACTIVITY_RACE]: 'Street races',
};

const MARKER_COLORS = {
  taxi: 0xf2c94c,
  courier: 0x35e0e0,
  race: 0xff4fa0,
};

function makeMarkerMesh(color) {
  const group = new THREE.Group();
  group.name = 'activity-marker';
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 4),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 4.4;
  diamond.rotation.x = Math.PI;
  group.add(diamond);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 11;
  group.add(beam);
  group.userData = { ring, diamond, beam };
  return group;
}

/** A waiting taxi passenger: a small figure in a sun-yellow shirt. */
function makePassengerMesh() {
  const group = new THREE.Group();
  group.name = 'taxi-passenger';
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf2c94c });
  const denim = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  box(0.22, 0.8, 0.24, denim, -0.14, 0.4, 0);
  box(0.22, 0.8, 0.24, denim, 0.14, 0.4, 0);
  box(0.62, 0.65, 0.34, shirt, 0, 1.12, 0);
  box(0.16, 0.6, 0.2, shirt, -0.4, 1.12, 0);
  box(0.16, 0.6, 0.2, shirt, 0.4, 1.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.set(0, 1.66, 0);
  head.castShadow = true;
  group.add(head);
  return group;
}

/** Route the race follows: start, then each checkpoint in order. */
function raceRoute() {
  return [ACTIVITIES.raceStart, ...ACTIVITIES.raceCheckpoints];
}

export class ActivityManager {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'activities';
    scene.add(this.group);
    this.marker = makeMarkerMesh(MARKER_COLORS.taxi);
    this.marker.visible = false;
    this.group.add(this.marker);
    this.passenger = makePassengerMesh();
    this.passenger.position.set(ACTIVITIES.taxiPassenger.x, 0, ACTIVITIES.taxiPassenger.z);
    this.group.add(this.passenger);
    // Race checkpoint rings: one per checkpoint, shown only during a race.
    this.rings = ACTIVITIES.raceCheckpoints.map((point) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.2, 4.2, 24),
        new THREE.MeshBasicMaterial({ color: MARKER_COLORS.race, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, 0.12, point.z);
      ring.visible = false;
      this.group.add(ring);
      return ring;
    });
    // Two rival cars for the street race: they drive the route at a fixed
    // pace, so beating them is a real contest, not a timer alone.
    this.rivals = ['toro', 'vela'].map((specKey, index) => {
      const mesh = makeVehicleMesh({ ...{ name: specKey }, ...(specKey === 'toro'
        ? { color: 0xc78a2e, length: 4.8, kind: 'pickup' }
        : { color: 0x2e6fd8, length: 4.2, kind: 'coupe' }) });
      mesh.visible = false;
      this.group.add(mesh);
      return { specKey, mesh, progress: 0, offset: index === 0 ? -3 : 3, finished: false, finishTime: 0 };
    });
    this.mode = ACTIVITY_IDLE;
    this.phase = '';
    this.timer = 0;
    this.time = 0;
    this.events = [];
    this.destinationIndex = 0;
    this.destination = null;
    this.dropsDone = 0;
    this.checkpointIndex = 0;
    this.raceTime = 0;
    this.raceTimeout = 0;
    this.bestRaceSeconds = 0;
    this.taxiEarned = 0;
    this.courierEarned = 0;
    this.racesWon = 0;
  }

  /** Events queued since the last call (started, paid, failed, ...). */
  takeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** The current target point for the minimap and the marker: { x, z } or null. */
  waypoint() {
    if (this.mode === ACTIVITY_TAXI) {
      if (this.phase === 'pickup') return { ...ACTIVITIES.taxiPassenger };
      if (this.destination) return { ...this.destination };
    }
    if (this.mode === ACTIVITY_COURIER) {
      const drop = ACTIVITIES.courierDrops[this.dropsDone];
      if (drop) return { x: drop.x, z: drop.z };
      return { ...ACTIVITIES.courierStart };
    }
    if (this.mode === ACTIVITY_RACE) {
      const point = ACTIVITIES.raceCheckpoints[this.checkpointIndex];
      if (point) return { ...point };
    }
    return null;
  }

  /** The one-line status the HUD shows under the mission objective. */
  statusLine() {
    if (this.mode === ACTIVITY_TAXI && this.phase === 'pickup') return 'TAXI — Pick up the passenger on Palm Row';
    if (this.mode === ACTIVITY_TAXI && this.destination) {
      return `TAXI — Drop off at ${this.destination.name} · $${ACTIVITIES.taxiBaseFare}+tip · ${Math.max(0, Math.ceil(this.timer))}s`;
    }
    if (this.mode === ACTIVITY_COURIER) {
      return `COURIER — Deliver parcel ${this.dropsDone + 1} of 3 · ${Math.max(0, Math.ceil(this.timer))}s left`;
    }
    if (this.mode === ACTIVITY_RACE) {
      const best = this.bestRaceSeconds > 0 ? ` · best ${this.bestRaceSeconds.toFixed(1)}s` : '';
      return `STREET RACE — Checkpoint ${this.checkpointIndex + 1} of ${ACTIVITIES.raceCheckpoints.length} · ${this.raceTime.toFixed(1)}s${best}`;
    }
    return '';
  }

  /** True while any activity is running. */
  get active() {
    return this.mode !== ACTIVITY_IDLE;
  }

  showMarker(point, color) {
    this.marker.visible = true;
    this.marker.position.set(point.x, 0, point.z);
    this.marker.userData.ring.material.color.setHex(color);
    this.marker.userData.diamond.material.color.setHex(color);
    this.marker.userData.beam.material.color.setHex(color);
  }

  hideMarker() {
    this.marker.visible = false;
  }

  startTaxiPickup() {
    this.mode = ACTIVITY_TAXI;
    this.phase = 'pickup';
    this.destination = null;
    this.timer = 0;
    this.showMarker(ACTIVITIES.taxiPassenger, MARKER_COLORS.taxi);
    this.events.push('activity-started:taxi');
  }

  startTaxiDropoff() {
    this.phase = 'dropoff';
    this.destination = ACTIVITIES.taxiDestinations[this.destinationIndex % ACTIVITIES.taxiDestinations.length];
    this.destinationIndex += 1;
    this.timer = ACTIVITIES.taxiTimeLimit;
    this.passenger.visible = false;
    this.showMarker(this.destination, MARKER_COLORS.taxi);
    this.events.push('activity-started:taxi-dropoff');
  }

  startCourier() {
    this.mode = ACTIVITY_COURIER;
    this.phase = 'delivering';
    this.dropsDone = 0;
    this.timer = ACTIVITIES.courierTimeLimit;
    this.showMarker(ACTIVITIES.courierDrops[0], MARKER_COLORS.courier);
    this.events.push('activity-started:courier');
  }

  startRace() {
    this.mode = ACTIVITY_RACE;
    this.phase = 'racing';
    this.checkpointIndex = 0;
    this.raceTime = 0;
    this.raceTimeout = ACTIVITIES.raceTimeLimit;
    this.timer = 0;
    const route = raceRoute();
    for (const rival of this.rivals) {
      rival.progress = 0;
      rival.finished = false;
      rival.finishTime = 0;
      rival.mesh.visible = true;
      rival.mesh.position.set(route[0].x, 0, route[0].z + rival.offset);
    }
    for (const ring of this.rings) ring.visible = true;
    this.showMarker(ACTIVITIES.raceCheckpoints[0], MARKER_COLORS.race);
    this.events.push('activity-started:race');
  }

  endActivity() {
    this.mode = ACTIVITY_IDLE;
    this.phase = '';
    this.timer = 0;
    this.hideMarker();
    this.passenger.visible = true;
    for (const ring of this.rings) ring.visible = false;
    for (const rival of this.rivals) rival.mesh.visible = false;
  }

  /** Move one rival along the race route at its fixed pace. */
  stepRival(rival, dt) {
    const route = raceRoute();
    const speed = rival.specKey === 'vela' ? 27 : 24;
    let remaining = speed * dt;
    while (remaining > 0 && rival.progress < route.length - 1) {
      const from = route[Math.floor(rival.progress)];
      const to = route[Math.floor(rival.progress) + 1];
      const segLen = Math.hypot(to.x - from.x, to.z - from.z);
      const segLeft = (1 - (rival.progress % 1)) * segLen;
      if (remaining < segLeft) {
        rival.progress += remaining / segLen;
        remaining = 0;
      } else {
        remaining -= segLeft;
        rival.progress = Math.floor(rival.progress) + 1;
      }
    }
    if (rival.progress >= route.length - 1 && !rival.finished) {
      rival.finished = true;
      rival.finishTime = this.raceTime;
    }
    const index = Math.min(route.length - 2, Math.floor(rival.progress));
    const from = route[index];
    const to = route[index + 1];
    const t = rival.progress - index;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const heading = Math.atan2(to.x - from.x, to.z - from.z);
    // Rivals hold their lane offset beside the route, like traffic does.
    const ox = Math.cos(heading) * rival.offset;
    const oz = -Math.sin(heading) * rival.offset;
    rival.mesh.position.set(x + ox, 0, z + oz);
    rival.mesh.rotation.y = heading;
  }

  /**
   * Stage a taxi fare mid-drop-off for the ?shot=activities screenshot: Lena
   * in the Harbor Taxi with a passenger aboard, the gold beacon ahead on
   * Palm Row, a race ring and a postcard in the same frame is the
   * collectibles manager's job — this only stages the fare itself.
   */
  stageTaxiScene() {
    this.startTaxiPickup();
    this.startTaxiDropoff();
    this.timer = 42;
  }

  update(dt, context) {
    this.time += dt;
    if (this.marker.visible) {
      const pulse = 1 + Math.sin(this.time * 3) * 0.1;
      this.marker.scale.set(pulse, 1, pulse);
      this.marker.userData.diamond.position.y = 4.4 + Math.sin(this.time * 2.4) * 0.5;
      this.marker.userData.diamond.rotation.y += dt * 1.5;
    }
    const { player, car, inCar } = context;
    const px = inCar ? car.x : player.x;
    const pz = inCar ? car.z : player.z;

    if (this.mode === ACTIVITY_IDLE) {
      // Taxi: drive the Harbor Taxi up to the waiting passenger.
      if (inCar && car.specKey === 'taxi' && Math.hypot(px - ACTIVITIES.taxiPassenger.x, pz - ACTIVITIES.taxiPassenger.z) < 8) {
        this.startTaxiPickup();
        this.startTaxiDropoff();
        return;
      }
      // Courier: walk up to Rosa's parcels at the garage door, on foot.
      if (!inCar && Math.hypot(px - ACTIVITIES.courierStart.x, pz - ACTIVITIES.courierStart.z) < 6) {
        this.startCourier();
        return;
      }
      // Street race: drive through the start arch on the Palm Row boulevard.
      if (inCar && Math.hypot(px - ACTIVITIES.raceStart.x, pz - ACTIVITIES.raceStart.z) < 7) {
        this.startRace();
      }
      return;
    }

    if (this.mode === ACTIVITY_TAXI) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.events.push('activity-failed:taxi-late');
        this.endActivity();
        return;
      }
      if (this.phase === 'dropoff' && this.destination) {
        if (Math.hypot(px - this.destination.x, pz - this.destination.z) < 7) {
          const tip = Math.round((this.timer / ACTIVITIES.taxiTimeLimit) * ACTIVITIES.taxiMaxTip);
          const pay = ACTIVITIES.taxiBaseFare + tip;
          this.taxiEarned += pay;
          this.events.push(`taxi-paid:${pay}`);
          this.endActivity();
        }
      }
      return;
    }

    if (this.mode === ACTIVITY_COURIER) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.events.push('activity-failed:courier-late');
        this.endActivity();
        return;
      }
      const drop = ACTIVITIES.courierDrops[this.dropsDone];
      if (drop && Math.hypot(px - drop.x, pz - drop.z) < 7) {
        this.dropsDone += 1;
        this.courierEarned += ACTIVITIES.courierPayPerDrop;
        this.events.push(`courier-drop:${ACTIVITIES.courierPayPerDrop}`);
        if (this.dropsDone >= ACTIVITIES.courierDrops.length) {
          this.courierEarned += ACTIVITIES.courierBonus;
          this.events.push(`courier-bonus:${ACTIVITIES.courierBonus}`);
          this.endActivity();
        } else {
          this.showMarker(ACTIVITIES.courierDrops[this.dropsDone], MARKER_COLORS.courier);
        }
      }
      return;
    }

    if (this.mode === ACTIVITY_RACE) {
      this.raceTime += dt;
      this.raceTimeout -= dt;
      if (this.raceTimeout <= 0) {
        this.events.push('activity-failed:race-time');
        this.endActivity();
        return;
      }
      for (const rival of this.rivals) this.stepRival(rival, dt);
      const point = ACTIVITIES.raceCheckpoints[this.checkpointIndex];
      if (point && Math.hypot(px - point.x, pz - point.z) < 7) {
        this.rings[this.checkpointIndex].visible = false;
        this.checkpointIndex += 1;
        this.events.push(`race-checkpoint:${this.checkpointIndex}`);
        if (this.checkpointIndex >= ACTIVITIES.raceCheckpoints.length) {
          const rivalsBeaten = this.rivals.filter((rival) => !rival.finished || rival.finishTime > this.raceTime).length;
          let pay = this.raceTime <= ACTIVITIES.raceParSeconds ? ACTIVITIES.raceWinPay : ACTIVITIES.raceFinishPay;
          if (rivalsBeaten === this.rivals.length) pay += ACTIVITIES.raceRivalBonus;
          if (this.bestRaceSeconds === 0 || this.raceTime < this.bestRaceSeconds) this.bestRaceSeconds = this.raceTime;
          if (rivalsBeaten === this.rivals.length) this.racesWon += 1;
          this.events.push(`race-won:${pay}`);
          this.endActivity();
        } else {
          this.showMarker(ACTIVITIES.raceCheckpoints[this.checkpointIndex], MARKER_COLORS.race);
        }
      }
    }
  }
}
