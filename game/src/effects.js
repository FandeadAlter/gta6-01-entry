// Effects: skid marks, damage smoke, impact particles and screen shake. All
// pools are fixed size and reused, so effects never allocate during play.
import * as THREE from 'three';
import { EFFECTS } from './config.js';

export class EffectsManager {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'effects';
    scene.add(this.group);
    this.trauma = 0;
    this.time = 0;
    // Impact particles: small bright boxes that fly out and fall.
    this.particles = [];
    const particleGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    for (let i = 0; i < EFFECTS.particles; i += 1) {
      const mesh = new THREE.Mesh(
        particleGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }),
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
    }
    // Damage smoke: grey puffs that rise and swell, then fade.
    this.smoke = [];
    const smokeGeometry = new THREE.SphereGeometry(0.7, 8, 6);
    for (let i = 0; i < EFFECTS.smokePuffs; i += 1) {
      const mesh = new THREE.Mesh(
        smokeGeometry,
        new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.smoke.push({ mesh, life: 0, maxLife: 1.4, x: 0, y: 0, z: 0 });
    }
    // Skid marks: dark strips laid on the road, fading over a few seconds.
    this.skids = [];
    const skidGeometry = new THREE.PlaneGeometry(0.35, 1.4);
    for (let i = 0; i < EFFECTS.skidMarks; i += 1) {
      const mesh = new THREE.Mesh(
        skidGeometry,
        new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.skids.push({ mesh, life: 0, maxLife: 6 });
    }
    this.particleIndex = 0;
    this.smokeIndex = 0;
    this.skidIndex = 0;
    this.lastSkidX = null;
    this.lastSkidZ = null;
  }

  /** A burst of sparks / dust at (x, y, z). */
  burst(x, y, z, count = 8, color = 0xffd9a0) {
    for (let i = 0; i < count; i += 1) {
      const p = this.particles[this.particleIndex];
      this.particleIndex = (this.particleIndex + 1) % this.particles.length;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      p.vx = Math.sin(angle) * speed;
      p.vz = Math.cos(angle) * speed;
      p.vy = 2 + Math.random() * 4;
      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.5;
    }
  }

  /** One smoke puff at (x, y, z), usually from a damaged engine. */
  puff(x, y, z) {
    const s = this.smoke[this.smokeIndex];
    this.smokeIndex = (this.smokeIndex + 1) % this.smoke.length;
    s.mesh.visible = true;
    s.x = x;
    s.y = y;
    s.z = z;
    s.life = 0;
    s.mesh.position.set(x, y, z);
    s.mesh.scale.set(1, 1, 1);
    s.mesh.material.opacity = 0.55;
  }

  /** Lay a skid mark under a wheel while the car slides. */
  skid(x, z, heading) {
    if (this.lastSkidX !== null && Math.hypot(x - this.lastSkidX, z - this.lastSkidZ) < 0.9) return;
    this.lastSkidX = x;
    this.lastSkidZ = z;
    const s = this.skids[this.skidIndex];
    this.skidIndex = (this.skidIndex + 1) % this.skids.length;
    s.mesh.visible = true;
    s.mesh.position.set(x, 0.08, z);
    s.mesh.rotation.z = -heading;
    s.life = 0;
    s.mesh.material.opacity = 0.7;
  }

  /** Add screen shake; larger impacts shake harder. */
  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** The current camera offset from shake, decaying back to zero. */
  shakeOffset() {
    const strength = this.trauma * this.trauma * 0.5;
    return {
      x: (Math.random() * 2 - 1) * strength,
      y: (Math.random() * 2 - 1) * strength,
    };
  }

  update(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (const p of this.particles) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) p.mesh.position.y = 0.05;
      p.mesh.material.opacity = 1 - p.life / p.maxLife;
    }
    for (const s of this.smoke) {
      if (!s.mesh.visible) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.mesh.visible = false;
        continue;
      }
      const t = s.life / s.maxLife;
      s.mesh.position.set(s.x, s.y + t * 3, s.z);
      const scale = 1 + t * 2.2;
      s.mesh.scale.set(scale, scale, scale);
      s.mesh.material.opacity = 0.55 * (1 - t);
    }
    for (const s of this.skids) {
      if (!s.mesh.visible) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.mesh.visible = false;
        continue;
      }
      s.mesh.material.opacity = 0.7 * (1 - s.life / s.maxLife);
    }
  }
}
