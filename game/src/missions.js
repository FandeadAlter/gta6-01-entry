// Missions: the six story missions of "High Tide", in order. Each mission is a
// short list of steps — reach a waypoint, deliver parcels, steal a car without
// raising heat, clear a shootout, tail a courier, escape at four stars — with
// a timer or a fail condition where the story needs one. The manager owns the
// glowing world beacon that marks the current waypoint, so a mission is always
// visible in the world and on the minimap. Events (spawn enemies, give the
// pistol, raise wanted) go out as plain strings the loop in main.js acts on.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

/** Full definition of each mission: steps, reward, and what can fail it. */
export const MISSION_DEFS = [
  {
    name: 'Homecoming',
    reward: 250,
    steps: [
      { kind: 'reach', x: -180, z: -180, radius: 8, label: 'Drive Rosa\u2019s Alba to the Old Harbor docks' },
    ],
  },
  {
    name: 'Courier Run',
    reward: 400,
    timeLimit: 240,
    steps: [
      { kind: 'reach', x: 36, z: 252, radius: 7, label: 'Deliver parcel 1 of 3 — Palm Row boulevard' },
      { kind: 'reach', x: 180, z: 252, radius: 7, label: 'Deliver parcel 2 of 3 — Palm Row hotels' },
      { kind: 'reach', x: 252, z: 108, radius: 7, label: 'Deliver parcel 3 of 3 — The Yard gate' },
    ],
  },
  {
    name: 'The Tow Job',
    reward: 600,
    maxWanted: 1,
    steps: [
      { kind: 'reach', x: 36, z: 200, radius: 6, label: 'Reach the Vela GT in Coral Heights' },
      { kind: 'steal', x: 36, z: 200, radius: 6, label: 'Steal the Vela GT (E to get in)' },
      { kind: 'reach', x: -180, z: -124, radius: 8, label: 'Bring the Vela GT back to Rosa\u2019s garage' },
    ],
  },
  {
    name: 'Harbor Lights',
    reward: 800,
    steps: [
      { kind: 'reach', x: -180, z: -180, radius: 10, label: 'Reach the dock at Old Harbor' },
      { kind: 'clear', x: -180, z: -180, radius: 14, count: 3, label: 'Clear the dock — take down Kaine\u2019s men (3 left)' },
    ],
  },
  {
    name: 'Neon Mile',
    reward: 900,
    steps: [
      { kind: 'reach', x: 36, z: 36, radius: 8, label: 'Reach Neon Mile — find Kaine\u2019s courier' },
      { kind: 'tail', x: -108, z: 36, radius: 25, label: 'Tail the courier — stay close, don\u2019t be seen' },
      { kind: 'escape', x: -180, z: -124, radius: 8, label: 'Lose the cops — reach Rosa\u2019s garage' },
    ],
  },
  {
    name: 'High Tide',
    reward: 1500,
    steps: [
      { kind: 'reach', x: 370, z: 0, radius: 10, label: 'Reach the boat yard on Isla Verde' },
      { kind: 'escape', x: -180, z: -124, radius: 8, label: 'Escape across the causeway at 4 stars' },
    ],
  },
];

export const MISSION_COMPLETE = 'complete';
export const MISSION_FAILED = 'failed';

function makeBeaconMesh() {
  const group = new THREE.Group();
  group.name = 'mission-beacon';
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  group.add(beam);
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 2.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
  );
  marker.position.y = 4.2;
  marker.rotation.x = Math.PI;
  group.add(marker);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  group.userData = { beam, marker, ring };
  return group;
}

/** Where Kaine's men stand in the Harbor Lights shootout: on the open
 * road intersection at the dock, in the camera's line of sight, never
 * inside a building. */
export const HARBOR_ENEMY_SPOTS = [
  { x: -184, z: -176 },
  { x: -176, z: -172 },
  { x: -186, z: -168 },
];

export class MissionManager {
  constructor(scene) {
    this.beacon = makeBeaconMesh();
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.index = 0;
    this.stepIndex = 0;
    this.status = 'idle';
    this.timer = 0;
    this.tailTime = 0;
    this.tailSeen = 0;
    this.events = [];
    this.delay = 0;
    this.enemiesLeft = 0;
    this.time = 0;
  }

  get def() {
    return MISSION_DEFS[this.index];
  }

  get step() {
    return this.def ? this.def.steps[this.stepIndex] : null;
  }

  get missionName() {
    return this.def ? this.def.name : '';
  }

  /** The objective line the HUD shows for the current step. */
  get objective() {
    if (this.status === 'done') return 'All missions complete — Solmar Bay is yours';
    if (this.status === 'failed') return 'Mission failed — try again';
    const step = this.step;
    if (!step) return MISSIONS[0].objective;
    if (step.kind === 'clear') {
      return `Clear the dock — take down Kaine\u2019s men (${this.enemiesLeft} left)`;
    }
    return step.label;
  }

  /** The waypoint the minimap and beacon show: { x, z } or null. */
  waypoint() {
    const step = this.step;
    if (!step || this.status !== 'active') return null;
    if (step.kind === 'tail') {
      // The courier drives east along Neon Mile's central road.
      const t = Math.min(1, this.tailTime / 30);
      return { x: -108 + t * 216, z: 36 };
    }
    return { x: step.x, z: step.z };
  }

  /** Events queued since the last call (spawn enemies, give pistol, ...). */
  takeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  start(index) {
    this.index = Math.max(0, Math.min(MISSION_DEFS.length - 1, index));
    this.stepIndex = 0;
    this.status = 'active';
    this.timer = this.def.timeLimit || 0;
    this.tailTime = 0;
    this.tailSeen = 0;
    this.enemiesLeft = 0;
    this.delay = 0;
    this.events.push('mission-start');
    this.enterStep();
  }

  enterStep() {
    const step = this.step;
    if (!step) return;
    if (step.kind === 'clear') {
      this.enemiesLeft = step.count;
      this.events.push('spawn-harbor-enemies');
      this.events.push('give-pistol');
    }
    if (step.kind === 'tail') {
      this.tailTime = 0;
      this.tailSeen = 0;
    }
    if (step.kind === 'escape') {
      this.events.push(this.index === 5 ? 'set-wanted-4' : 'set-wanted-3');
    }
    this.beacon.visible = true;
  }

  completeStep() {
    this.stepIndex += 1;
    if (this.stepIndex >= this.def.steps.length) {
      this.completeMission();
      return;
    }
    this.events.push('objective-done');
    this.enterStep();
  }

  completeMission() {
    this.status = 'done';
    this.beacon.visible = false;
    this.events.push('mission-complete');
    this.delay = 2.0;
  }

  fail(reason) {
    if (this.status !== 'active') return;
    this.status = 'failed';
    this.beacon.visible = false;
    this.events.push(`mission-failed:${reason}`);
    this.delay = 2.5;
  }

  /** Called by combat when an enemy goes down during a clear step. */
  onEnemyDown() {
    if (this.step && this.step.kind === 'clear') {
      this.enemiesLeft = Math.max(0, this.enemiesLeft - 1);
      if (this.enemiesLeft === 0) this.completeStep();
    }
  }

  update(dt, context) {
    this.time += dt;
    // Pulse the beacon so it reads as a live marker, not a static prop.
    if (this.beacon.visible) {
      const pulse = 1 + Math.sin(this.time * 3) * 0.12;
      this.beacon.scale.set(pulse, 1, pulse);
      this.beacon.userData.marker.position.y = 4.2 + Math.sin(this.time * 2.4) * 0.5;
      this.beacon.userData.marker.rotation.y += dt * 1.5;
    }
    if (this.status === 'done' || this.status === 'failed') {
      this.delay -= dt;
      if (this.delay <= 0) {
        if (this.status === 'done') {
          if (this.index + 1 < MISSION_DEFS.length) this.start(this.index + 1);
          else this.status = 'all-done';
        } else {
          this.start(this.index);
        }
      }
      return;
    }
    if (this.status !== 'active') return;
    const step = this.step;
    if (!step) return;
    const { player, car, inCar, wanted } = context;
    const px = inCar ? car.x : player.x;
    const pz = inCar ? car.z : player.z;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.fail('time');
        return;
      }
    }
    if (this.def.maxWanted !== undefined && wanted > this.def.maxWanted) {
      this.fail('heat');
      return;
    }
    const dist = Math.hypot(px - step.x, pz - step.z);
    if (step.kind === 'reach' || step.kind === 'escape') {
      if (dist < step.radius) this.completeStep();
    } else if (step.kind === 'steal') {
      if (inCar && car.specKey === 'vela') this.completeStep();
    } else if (step.kind === 'clear') {
      if (dist > 60) {
        // Walked away from the fight: the dock stays uncleared, no fail.
      }
    } else if (step.kind === 'tail') {
      const point = this.waypoint();
      const courierDist = Math.hypot(px - point.x, pz - point.z);
      this.tailTime += dt;
      if (courierDist < 6) {
        this.tailSeen += dt;
        if (this.tailSeen > 2) {
          this.fail('seen');
          return;
        }
      } else {
        this.tailSeen = Math.max(0, this.tailSeen - dt);
      }
      if (courierDist < 25 && courierDist >= 6) {
        // Staying in the tail window banks progress; 20 s of it completes the tail.
        this._tailProgress = (this._tailProgress || 0) + dt;
        if (this._tailProgress >= 20) {
          this._tailProgress = 0;
          this.events.push('tail-complete');
          this.completeStep();
        }
      }
      if (this.tailTime > 45) {
        // The courier reaches the end of Neon Mile: the tail ends either way.
        this._tailProgress = 0;
        this.completeStep();
      }
    }
    const point = this.waypoint();
    if (point) {
      this.beacon.position.set(point.x, 0, point.z);
      this.beacon.visible = true;
    }
  }
}
