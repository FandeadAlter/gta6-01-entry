// Combat: fists, then the pistol. Lena aims with the mouse and fires with a
// click (or F); enemies are Kaine's men — they shoot back, strafe, and take
// simple cover by breaking line of sight behind the nearest dock container
// line. Health and armor live on the player state in main.js; this file owns
// the weapon, the ammo, the enemies and the hit math, and reports damage and
// kills as plain numbers and events.
import * as THREE from 'three';

export const WEAPON_FISTS = 'fists';
export const WEAPON_PISTOL = 'pistol';
export const WEAPON_SMG = 'smg';
export const WEAPON_SHOTGUN = 'shotgun';

/** The four weapon slots the HUD shows, in key order. The SMG and the
 * shotgun are earned later in the story, so they show as LOCKED until then;
 * the pistol slot shows its live ammo once Lena has it. */
export function weaponSlotList(combat) {
  const pistolAmmo = combat.hasPistol ? `${combat.ammoInMag} / ${combat.ammoReserve}` : '';
  return [
    { key: '1', id: WEAPON_FISTS, name: 'Fists', owned: true, ammo: '' },
    { key: '2', id: WEAPON_PISTOL, name: 'Pistol', owned: combat.hasPistol, ammo: pistolAmmo },
    { key: '3', id: WEAPON_SMG, name: 'Wasp SMG', owned: false, ammo: '' },
    { key: '4', id: WEAPON_SHOTGUN, name: 'Harbor 12', owned: false, ammo: '' },
  ];
}

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 42,
  pistolMag: 12,
  pistolReserve: 48,
  reloadTime: 1.2,
  fireInterval: 0.22,
  fistDamage: 12,
  fistRange: 2.2,
  enemyHealth: 100,
  enemyRange: 26,
  enemyFireInterval: 1.1,
  enemyDamage: 8,
  enemySpeed: 3.4,
  maxEnemies: 6,
};

function makeEnemyMesh() {
  const group = new THREE.Group();
  group.name = 'kaine-gunman';
  const shirt = new THREE.MeshLambertMaterial({ color: 0x5a1a1a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const denim = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const leftLeg = box(0.2, 0.8, 0.22, denim, -0.13, 0.4, 0);
  const rightLeg = box(0.2, 0.8, 0.22, denim, 0.13, 0.4, 0);
  box(0.6, 0.65, 0.34, shirt, 0, 1.12, 0);
  const leftArm = box(0.16, 0.6, 0.2, shirt, -0.4, 1.12, 0);
  const rightArm = box(0.16, 0.6, 0.2, shirt, 0.4, 1.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.set(0, 1.66, 0);
  head.castShadow = true;
  group.add(head);
  // A dark cap, so a gunman reads as hostile at a glance, not a pedestrian.
  box(0.44, 0.12, 0.44, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }), 0, 1.82, 0);
  group.userData = { leftLeg, rightLeg, leftArm, rightArm };
  return group;
}

/** One enemy: position, health, and the timers that drive its shooting. */
export function createEnemy(x, z) {
  return {
    x,
    z,
    heading: 0,
    health: COMBAT.enemyHealth,
    alive: true,
    fireTimer: 0.6 + Math.random() * 0.8,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0,
    coverX: x,
    coverZ: z,
    walkPhase: Math.random() * Math.PI * 2,
    mesh: null,
  };
}

export class CombatManager {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'combat';
    scene.add(this.group);
    this.weapon = WEAPON_FISTS;
    this.ammoInMag = 0;
    this.ammoReserve = 0;
    this.fireTimer = 0;
    this.reloadTimer = 0;
    this.enemies = [];
    this.muzzleTimer = 0;
    this.lastShot = null;
    this.events = [];
  }

  get hasPistol() {
    return this.weapon === WEAPON_PISTOL;
  }

  /** Hand Lena the pistol (Harbor Lights, or a pickup): full mag, 48 in reserve. */
  givePistol() {
    this.weapon = WEAPON_PISTOL;
    this.ammoInMag = COMBAT.pistolMag;
    this.ammoReserve = COMBAT.pistolReserve;
    this.reloadTimer = 0;
    this.events.push('pistol');
  }

  spawnEnemies(spots) {
    this.clearEnemies();
    for (const spot of spots.slice(0, COMBAT.maxEnemies)) {
      const enemy = createEnemy(spot.x, spot.z);
      enemy.mesh = makeEnemyMesh();
      enemy.mesh.position.set(spot.x, 0, spot.z);
      this.group.add(enemy.mesh);
      this.enemies.push(enemy);
    }
  }

  clearEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.mesh) this.group.remove(enemy.mesh);
    }
    this.enemies = [];
  }

  get aliveCount() {
    return this.enemies.filter((enemy) => enemy.alive).length;
  }

  takeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Start a reload if the mag is not full and reserve ammo remains. */
  startReload() {
    if (this.weapon !== WEAPON_PISTOL) return;
    if (this.ammoInMag >= COMBAT.pistolMag || this.ammoReserve <= 0) return;
    if (this.reloadTimer > 0) return;
    this.reloadTimer = COMBAT.reloadTime;
    this.events.push('reload');
  }

  /**
   * Fire one shot along `aimHeading` from the player's position. Returns the
   * enemy hit, or null. Ammo, spread and the muzzle flash are handled here.
   */
  shoot(playerX, playerZ, aimHeading, effects) {
    if (this.weapon !== WEAPON_PISTOL) return null;
    if (this.reloadTimer > 0 || this.fireTimer > 0) return null;
    if (this.ammoInMag <= 0) {
      this.startReload();
      this.events.push('dry-fire');
      return null;
    }
    this.ammoInMag -= 1;
    this.fireTimer = COMBAT.fireInterval;
    this.muzzleTimer = 0.07;
    const muzzleX = playerX + Math.sin(aimHeading) * 1.1;
    const muzzleZ = playerZ + Math.cos(aimHeading) * 1.1;
    this.lastShot = { x: muzzleX, z: muzzleZ, heading: aimHeading };
    if (effects) {
      effects.burst(muzzleX, 1.4, muzzleZ, 6, 0xffe14f);
    }
    this.events.push('shot');
    // Hit test: the nearest living enemy within range and within a narrow
    // cone of the aim heading, with a little spread so shots can miss.
    const spread = (Math.random() - 0.5) * 0.12;
    const aim = aimHeading + spread;
    const aimX = Math.sin(aim);
    const aimZ = Math.cos(aim);
    let best = null;
    let bestDist = COMBAT.pistolRange;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - playerX;
      const dz = enemy.z - playerZ;
      const dist = Math.hypot(dx, dz);
      if (dist > COMBAT.pistolRange || dist < 0.5) continue;
      const dot = (dx * aimX + dz * aimZ) / dist;
      if (dot < 0.94) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    if (best) {
      best.health -= COMBAT.pistolDamage;
      if (effects) effects.burst(best.x, 1.2, best.z, 8, 0xd92a2a);
      if (best.health <= 0) {
        best.alive = false;
        if (best.mesh) best.mesh.visible = false;
        this.events.push('enemy-down');
      } else {
        this.events.push('enemy-hit');
      }
    }
    return best;
  }

  /** Fists: a short-range swing that hurts the nearest enemy in front. */
  punch(playerX, playerZ, aimHeading) {
    if (this.fireTimer > 0) return null;
    this.fireTimer = 0.35;
    this.events.push('punch');
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - playerX, enemy.z - playerZ);
      if (dist > COMBAT.fistRange) continue;
      enemy.health -= COMBAT.fistDamage;
      if (enemy.health <= 0) {
        enemy.alive = false;
        if (enemy.mesh) enemy.mesh.visible = false;
        this.events.push('enemy-down');
      }
      return enemy;
    }
    return null;
  }

  /**
   * Advance enemies and the weapon timers. `context` carries the player, the
   * camera yaw, whether the player is firing, and the effects manager.
   * Returns the damage dealt to the player this step (0 when nobody hit).
   */
  update(dt, context) {
    const { player, cameraYaw, firing, effects, inCar } = context;
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = COMBAT.pistolMag - this.ammoInMag;
        const taken = Math.min(needed, this.ammoReserve);
        this.ammoInMag += taken;
        this.ammoReserve -= taken;
        this.events.push('reloaded');
      }
    }
    if (firing && !inCar) {
      if (this.weapon === WEAPON_PISTOL) this.shoot(player.x, player.z, cameraYaw, effects);
      else this.punch(player.x, player.z, cameraYaw);
    }
    let damageToPlayer = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const dist = Math.hypot(dx, dz) || 1;
      enemy.heading = Math.atan2(dx, dz);
      // Close to shooting range, then strafe: a gunman that stands still is a target.
      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafeTimer = 1.2 + Math.random() * 1.4;
        enemy.strafeDir = Math.random() < 0.5 ? 1 : -1;
      }
      if (dist > COMBAT.enemyRange) {
        enemy.x += (dx / dist) * COMBAT.enemySpeed * dt;
        enemy.z += (dz / dist) * COMBAT.enemySpeed * dt;
      } else if (dist < 9) {
        enemy.x -= (dx / dist) * COMBAT.enemySpeed * 0.6 * dt;
        enemy.z -= (dz / dist) * COMBAT.enemySpeed * 0.6 * dt;
      } else {
        // Strafe sideways across the player's line of fire.
        enemy.x += Math.cos(enemy.heading) * enemy.strafeDir * COMBAT.enemySpeed * 0.5 * dt;
        enemy.z -= Math.sin(enemy.heading) * enemy.strafeDir * COMBAT.enemySpeed * 0.5 * dt;
      }
      // Simple cover: when hurt, step back toward where the enemy spawned.
      if (enemy.health < COMBAT.enemyHealth * 0.5) {
        const cx = enemy.coverX - enemy.x;
        const cz = enemy.coverZ - enemy.z;
        const cd = Math.hypot(cx, cz);
        if (cd > 1) {
          enemy.x += (cx / cd) * COMBAT.enemySpeed * 0.4 * dt;
          enemy.z += (cz / cd) * COMBAT.enemySpeed * 0.4 * dt;
        }
      }
      enemy.walkPhase += COMBAT.enemySpeed * dt * 1.6;
      if (enemy.mesh) {
        enemy.mesh.position.set(enemy.x, 0, enemy.z);
        enemy.mesh.rotation.y = enemy.heading;
        const swing = Math.sin(enemy.walkPhase) * 0.45;
        enemy.mesh.userData.leftLeg.rotation.x = swing;
        enemy.mesh.userData.rightLeg.rotation.x = -swing;
        enemy.mesh.userData.leftArm.rotation.x = -swing * 0.8;
        enemy.mesh.userData.rightArm.rotation.x = swing * 0.8;
      }
      // Shoot back: inaccurate at range, steadier up close, never while the
      // player is driving away in a car.
      enemy.fireTimer -= dt;
      if (!inCar && dist < COMBAT.enemyRange && enemy.fireTimer <= 0) {
        enemy.fireTimer = COMBAT.enemyFireInterval * (0.8 + Math.random() * 0.5);
        const hitChance = Math.max(0.18, 0.55 - dist * 0.015);
        if (Math.random() < hitChance) {
          damageToPlayer += COMBAT.enemyDamage;
          this.events.push('player-hit');
          if (effects) effects.burst(player.x, 1.2, player.z, 5, 0xff6a6a);
        } else if (effects) {
          effects.burst(enemy.x + Math.sin(enemy.heading), 1.4, enemy.z + Math.cos(enemy.heading), 4, 0xffe14f);
        }
        this.events.push('enemy-shot');
      }
    }
    return damageToPlayer;
  }
}
