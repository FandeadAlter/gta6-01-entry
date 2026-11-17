// Police: the five-star wanted system. Heat rises with theft, reckless driving
// and hitting pedestrians, and decays when the player is out of sight. The
// response scales with the stars — foot officers, cruisers in pursuit,
// roadblocks, spike strips and a helicopter — and ends in Busted or Wasted.
import * as THREE from 'three';
import { POLICE, VEHICLES } from './config.js';
import { makeVehicleMesh } from './vehicles.js';

export const OUTCOME_NONE = 'none';
export const OUTCOME_BUSTED = 'busted';
export const OUTCOME_WASTED = 'wasted';

function makeOfficerMesh() {
  const group = new THREE.Group();
  group.name = 'sbpd-officer';
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const leftLeg = box(0.2, 0.8, 0.22, navy, -0.13, 0.4, 0);
  const rightLeg = box(0.2, 0.8, 0.22, navy, 0.13, 0.4, 0);
  box(0.6, 0.65, 0.34, navy, 0, 1.12, 0);
  box(0.62, 0.12, 0.36, new THREE.MeshLambertMaterial({ color: 0xf2c94c }), 0, 1.32, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.set(0, 1.66, 0);
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), navy);
  cap.position.set(0, 1.82, 0);
  group.add(cap);
  group.userData = { leftLeg, rightLeg };
  return group;
}

function makeHelicopterMesh() {
  const group = new THREE.Group();
  group.name = 'sbpd-helicopter';
  const body = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3.2), body);
  cabin.castShadow = true;
  group.add(cabin);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), body);
  tail.position.set(0, 0.3, -3.6);
  group.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  rotor.position.set(0, 0.9, 0);
  group.add(rotor);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(6, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.set(0, -15, 0);
  cone.rotation.x = Math.PI;
  group.add(cone);
  group.userData = { rotor };
  return group;
}

function makeRoadblockMesh() {
  const group = new THREE.Group();
  group.name = 'roadblock';
  const stripe = new THREE.MeshLambertMaterial({ color: 0xd92a2a });
  const white = new THREE.MeshLambertMaterial({ color: 0xf5f0e0 });
  for (let i = 0; i < 3; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.5), i % 2 ? white : stripe);
    bar.position.set(0, 0.6, -2 + i * 2);
    bar.castShadow = true;
    group.add(bar);
    for (const sx of [-1.7, 1.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3), stripe);
      leg.position.set(sx, 0.55, -2 + i * 2);
      group.add(leg);
    }
  }
  return group;
}

export class PoliceManager {
  constructor(scene, random) {
    this.group = new THREE.Group();
    this.group.name = 'police';
    scene.add(this.group);
    this.heat = 0;
    this.wanted = 0;
    this.outcome = OUTCOME_NONE;
    this.bustedTimer = 0;
    this.sirenPhase = 0;
    this.cruisers = [];
    this.officers = [];
    this.roadblocks = [];
    this.spikeStrips = [];
    this.helicopter = null;
    this.helicopterMesh = null;
    this.time = 0;
    void random;
  }

  get stars() {
    return this.wanted;
  }

  addHeat(amount) {
    if (this.outcome !== OUTCOME_NONE) return;
    this.heat = Math.min(POLICE.heatPerStar * 5, this.heat + amount);
    this.wanted = Math.min(5, Math.floor(this.heat / POLICE.heatPerStar) + (this.heat > 0 ? 0 : 0));
    // Heat 1..40 is 1 star: any heat at all means at least one star.
    if (this.heat > 0 && this.wanted === 0) this.wanted = 1;
    this.syncResponse();
  }

  onCarTheft() {
    this.addHeat(POLICE.heatTheft);
  }

  onReckless() {
    this.addHeat(POLICE.heatReckless);
  }

  onHitPedestrian() {
    this.addHeat(POLICE.heatHitPed);
  }

  setWanted(stars) {
    this.heat = stars * POLICE.heatPerStar + 5;
    this.wanted = stars;
    this.syncResponse();
  }

  clearWanted() {
    this.heat = 0;
    this.wanted = 0;
    this.outcome = OUTCOME_NONE;
    this.bustedTimer = 0;
    this.syncResponse();
  }

  /** Spawn or remove cruisers, officers, roadblocks and the helicopter to match the stars. */
  syncResponse() {
    const wantCruisers = POLICE.maxCruisers[this.wanted];
    while (this.cruisers.length < wantCruisers) {
      const mesh = makeVehicleMesh(VEHICLES.interceptor);
      this.group.add(mesh);
      this.cruisers.push({
        x: 0, z: 0, heading: 0, speed: 0, mesh, stuckTimer: 0,
      });
    }
    while (this.cruisers.length > wantCruisers) {
      const cruiser = this.cruisers.pop();
      this.group.remove(cruiser.mesh);
    }
    const wantOfficers = POLICE.maxOfficers[this.wanted];
    while (this.officers.length < wantOfficers) {
      const mesh = makeOfficerMesh();
      this.group.add(mesh);
      this.officers.push({ x: 0, z: 0, heading: 0, walkPhase: 0, mesh });
    }
    while (this.officers.length > wantOfficers) {
      const officer = this.officers.pop();
      this.group.remove(officer.mesh);
    }
    const wantBlocks = this.wanted >= POLICE.roadblockAt ? 2 : 0;
    while (this.roadblocks.length < wantBlocks) {
      const mesh = makeRoadblockMesh();
      this.group.add(mesh);
      this.roadblocks.push({ x: 0, z: 0, heading: 0, mesh });
    }
    while (this.roadblocks.length > wantBlocks) {
      const block = this.roadblocks.pop();
      this.group.remove(block.mesh);
    }
    const wantSpikes = this.wanted >= POLICE.spikeAt ? 1 : 0;
    while (this.spikeStrips.length < wantSpikes) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.15, 1),
        new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
      );
      mesh.castShadow = true;
      this.group.add(mesh);
      this.spikeStrips.push({ x: 0, z: 0, heading: 0, mesh });
    }
    while (this.spikeStrips.length > wantSpikes) {
      const strip = this.spikeStrips.pop();
      this.group.remove(strip.mesh);
    }
    if (this.wanted >= POLICE.helicopterAt && !this.helicopter) {
      this.helicopterMesh = makeHelicopterMesh();
      this.group.add(this.helicopterMesh);
      this.helicopter = { x: 0, z: 0, angle: 0 };
    }
    if (this.wanted < POLICE.helicopterAt && this.helicopter) {
      this.group.remove(this.helicopterMesh);
      this.helicopter = null;
      this.helicopterMesh = null;
    }
  }

  /** Place the response around the player for a staged shot (no stepping). */
  stageChase(playerX, playerZ, playerHeading) {
    this.setWanted(3);
    this.cruisers.forEach((cruiser, index) => {
      // One cruiser overtakes close ahead on the left (visible in the chase frame),
      // the rest close in behind on either side.
      const ahead = index === 0 ? 12 : -(9 + (index - 1) * 8);
      const side = index === 0 ? -4.5 : (index % 2 === 0 ? 4.5 : -4.5);
      cruiser.x = playerX + Math.sin(playerHeading) * ahead + Math.cos(playerHeading) * side;
      cruiser.z = playerZ + Math.cos(playerHeading) * ahead - Math.sin(playerHeading) * side;
      cruiser.heading = playerHeading;
      cruiser.speed = 20;
      cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
      cruiser.mesh.rotation.y = cruiser.heading;
    });
    this.officers.forEach((officer, index) => {
      officer.x = playerX + 8 + index * 3;
      officer.z = playerZ + 10;
      officer.mesh.position.set(officer.x, 0, officer.z);
    });
    this.roadblocks.forEach((block, index) => {
      const ahead = 28 + index * 8;
      block.x = playerX + Math.sin(playerHeading) * ahead;
      block.z = playerZ + Math.cos(playerHeading) * ahead;
      block.heading = playerHeading + Math.PI / 2;
      block.mesh.position.set(block.x, 0, block.z);
      block.mesh.rotation.y = block.heading;
    });
    this.syncMeshes();
  }

  update(dt, context) {
    this.time += dt;
    this.sirenPhase += dt * 6;
    if (this.outcome !== OUTCOME_NONE) return;
    const { player, playerCar, inCar, health } = context;
    const px = inCar ? playerCar.x : player.x;
    const pz = inCar ? playerCar.z : player.z;
    // Heat decays only when the player is far from every police unit.
    let nearestPolice = Infinity;
    for (const cruiser of this.cruisers) nearestPolice = Math.min(nearestPolice, Math.hypot(cruiser.x - px, cruiser.z - pz));
    for (const officer of this.officers) nearestPolice = Math.min(nearestPolice, Math.hypot(officer.x - px, officer.z - pz));
    if (this.wanted > 0 && nearestPolice > POLICE.searchRadius) {
      this.heat = Math.max(0, this.heat - POLICE.decayPerSecond * dt);
      const next = this.heat <= 0 ? 0 : Math.max(1, Math.ceil(this.heat / POLICE.heatPerStar));
      if (next !== this.wanted) {
        this.wanted = next;
        this.syncResponse();
      }
    }
    if (health <= 0) {
      this.outcome = OUTCOME_WASTED;
      return;
    }
    // Cruisers pursue: steer toward the player, ram when close. A cruiser
    // that is still far from its spawn point closes in near the player first,
    // so a fresh wanted level always brings the chase to the player.
    for (const cruiser of this.cruisers) {
      const dx0 = px - cruiser.x;
      const dz0 = pz - cruiser.z;
      if (Math.hypot(dx0, dz0) > 120) {
        cruiser.x = px - Math.sin(playerCar.heading || 0) * 45;
        cruiser.z = pz - Math.cos(playerCar.heading || 0) * 45;
        cruiser.heading = playerCar.heading || 0;
        cruiser.speed = 25;
      }
      const dx = px - cruiser.x;
      const dz = pz - cruiser.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let delta = targetHeading - cruiser.heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      cruiser.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, delta));
      const targetSpeed = dist > 6 ? 34 + this.wanted * 2 : 12;
      cruiser.speed += (targetSpeed - cruiser.speed) * Math.min(1, dt * 1.2);
      cruiser.x += Math.sin(cruiser.heading) * cruiser.speed * dt;
      cruiser.z += Math.cos(cruiser.heading) * cruiser.speed * dt;
      if (dist < 3.2 && inCar) {
        // A ram shoves the player's car and adds a little damage (handled by main).
        cruiser.speed *= 0.7;
      }
      if (cruiser.mesh.userData.lightBar) {
        cruiser.mesh.userData.lightBar.material.color.setHex(
          Math.sin(this.sirenPhase) > 0 ? 0x2a6aff : 0xd92a2a,
        );
      }
    }
    // Officers chase on foot when the player is on foot and close.
    for (const officer of this.officers) {
      const dx = px - officer.x;
      const dz = pz - officer.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > 80) {
        // A fresh officer arrives near the player instead of walking from the centre.
        officer.x = px + 18 + Math.random() * 8;
        officer.z = pz + 12;
      }
      if (!inCar && dist < 40) {
        officer.heading = Math.atan2(dx, dz);
        const speed = 5.2;
        officer.x += Math.sin(officer.heading) * speed * dt;
        officer.z += Math.cos(officer.heading) * speed * dt;
        officer.walkPhase += speed * dt * 2;
      } else if (inCar) {
        // Officers stand their ground near where they spawned when the player drives.
        officer.walkPhase += dt;
      }
      if (!inCar && dist < POLICE.bustedDistance) {
        this.bustedTimer += dt;
        if (this.bustedTimer >= POLICE.bustedTime) this.outcome = OUTCOME_BUSTED;
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      }
    }
    // Roadblocks sit ahead of the player on the road they are driving, and only
    // move once the player has driven well past them.
    this.roadblocks.forEach((block, index) => {
      const ahead = 60 + index * 25;
      const heading = inCar ? playerCar.heading : player.heading;
      const dist = Math.hypot(block.x - px, block.z - pz);
      if (dist > 70 || (block.x === 0 && block.z === 0)) {
        block.x = px + Math.sin(heading) * ahead;
        block.z = pz + Math.cos(heading) * ahead;
        block.heading = heading + Math.PI / 2;
        block.mesh.position.set(block.x, 0, block.z);
        block.mesh.rotation.y = block.heading;
      }
    });
    this.spikeStrips.forEach((strip) => {
      const heading = inCar ? playerCar.heading : player.heading;
      const dist = Math.hypot(strip.x - px, strip.z - pz);
      if (dist > 45 || (strip.x === 0 && strip.z === 0)) {
        strip.x = px + Math.sin(heading) * 35;
        strip.z = pz + Math.cos(heading) * 35;
        strip.heading = heading + Math.PI / 2;
        strip.mesh.position.set(strip.x, 0, strip.z);
        strip.mesh.rotation.y = strip.heading;
      }
    });
    if (this.helicopter && this.helicopterMesh) {
      this.helicopter.angle += dt * 0.25;
      this.helicopter.x = px + Math.sin(this.helicopter.angle) * 18;
      this.helicopter.z = pz + Math.cos(this.helicopter.angle) * 18;
      this.helicopterMesh.position.set(this.helicopter.x, 34, this.helicopter.z);
      this.helicopterMesh.rotation.y = Math.atan2(px - this.helicopter.x, pz - this.helicopter.z);
      this.helicopterMesh.userData.rotor.rotation.y += dt * 18;
    }
    this.syncMeshes();
  }

  syncMeshes() {
    for (const cruiser of this.cruisers) {
      cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
      cruiser.mesh.rotation.y = cruiser.heading;
      const spin = cruiser.speed * (1 / 60) * 2.8;
      for (const wheel of cruiser.mesh.userData.wheels || []) wheel.rotation.x += spin;
    }
    for (const officer of this.officers) {
      officer.mesh.position.set(officer.x, 0, officer.z);
      officer.mesh.rotation.y = officer.heading;
      const swing = Math.sin(officer.walkPhase) * 0.5;
      officer.mesh.userData.leftLeg.rotation.x = swing;
      officer.mesh.userData.rightLeg.rotation.x = -swing;
    }
  }

  /** Police positions for the minimap: cruisers red, officers blue. */
  blips() {
    return {
      cruisers: this.cruisers.map((c) => ({ x: c.x, z: c.z })),
      officers: this.officers.map((o) => ({ x: o.x, z: o.z })),
      helicopter: this.helicopter ? { x: this.helicopter.x, z: this.helicopter.z } : null,
    };
  }
}
