// The procedural city of Solmar Bay: a road-grid mainland in six districts, the
// beach and sea along the south shore, Isla Verde across a causeway to the east.
// buildCity adds the meshes to the scene and returns the data the game needs:
// building colliders, land tests for movement, and minimap geometry. Nothing here
// knows about the player, the camera or the HUD.
import * as THREE from 'three';
import { DISTRICTS, PALETTE, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const materials = new Map();

function materialFor(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return materials.get(color);
}

function basicMaterialFor(color) {
  const key = `basic:${color}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshBasicMaterial({ color }));
  }
  return materials.get(key);
}

/** Block centres sit between consecutive road lines. */
function blockCentres() {
  const centres = [];
  for (let index = 0; index < WORLD.roads.length - 1; index += 1) {
    centres.push((WORLD.roads[index] + WORLD.roads[index + 1]) / 2);
  }
  return centres;
}

/** Which district a point in the city belongs to. */
export function districtAt(x, z) {
  if (z >= 180) return 'palmRow';
  if (x <= -144 && z < 0) return 'oldHarbor';
  if (Math.abs(x) <= 72 && Math.abs(z) <= 72) return 'neonMile';
  if (x >= 144 && z <= -108) return 'coralHeights';
  if (x >= 144 && z >= 108) return 'theYard';
  return 'midtown';
}

export function buildCity(scene, random) {
  const colliders = [];
  const palmSpots = [];
  const containerSpots = [];
  const cityGroup = new THREE.Group();
  cityGroup.name = 'solmar-bay';
  scene.add(cityGroup);

  function addBox(x, y, z, w, h, d, color, options = {}) {
    const mesh = new THREE.Mesh(UNIT_BOX, options.basic ? basicMaterialFor(color) : materialFor(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    if (options.ry) mesh.rotation.y = options.ry;
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = true;
    cityGroup.add(mesh);
    return mesh;
  }

  function addFlat(x, z, y, w, d, color) {
    const mesh = new THREE.Mesh(UNIT_PLANE, materialFor(color));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.set(w, d, 1);
    mesh.receiveShadow = true;
    cityGroup.add(mesh);
    return mesh;
  }

  // --- Ground, sea and beach -------------------------------------------------
  addFlat(0, 0, -0.5, 2400, 2400, PALETTE.sea);
  addFlat(0, 0, 0, 520, 520, PALETTE.ground);
  addFlat(0, 279, 0.02, 520, 42, PALETTE.sand);
  addFlat(WORLD.island.centreX, WORLD.island.centreZ, 0, 150, 150, PALETTE.ground);
  addFlat(WORLD.island.centreX, 84, 0.02, 150, 28, PALETTE.sand);

  // --- Roads -----------------------------------------------------------------
  for (const road of WORLD.roads) {
    addFlat(0, road, 0.03, 520, WORLD.roadWidth, PALETTE.road);
    addFlat(road, 0, 0.03, WORLD.roadWidth, 520, PALETTE.road);
  }

  // Centre dashes along every road, skipping intersections.
  const dashGeometry = new THREE.BoxGeometry(3, 0.05, 0.3);
  const dashMaterial = materialFor(PALETTE.roadLine);
  const dashCount = WORLD.roads.length * 2 * 52;
  const dashes = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashCount);
  const dummy = new THREE.Object3D();
  let dashIndex = 0;
  for (const road of WORLD.roads) {
    for (let along = -248; along <= 248; along += 10) {
      const nearCrossing = WORLD.roads.some((other) => Math.abs(along - other) < 9);
      if (nearCrossing) continue;
      dummy.position.set(along, 0.06, road);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(dashIndex, dummy.matrix);
      dashIndex += 1;
      dummy.position.set(road, 0.06, along);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(dashIndex, dummy.matrix);
      dashIndex += 1;
    }
  }
  dashes.count = dashIndex;
  dashes.receiveShadow = true;
  cityGroup.add(dashes);

  // --- Causeway to Isla Verde ------------------------------------------------
  addBox(279, 0.4, 0, 54, 1.6, 14, 0x8a8578);
  addFlat(279, 0, 1.25, 54, 11, PALETTE.road);
  addBox(279, 1.6, -6.6, 54, 0.8, 0.4, 0xb9b3a4);
  addBox(279, 1.6, 6.6, 54, 0.8, 0.4, 0xb9b3a4);

  // --- Blocks: sidewalks, buildings, parks -----------------------------------
  const centres = blockCentres();
  for (const bx of centres) {
    for (const bz of centres) {
      const key = districtAt(bx, bz);
      const district = DISTRICTS[key];
      const isPark = key !== 'neonMile' && key !== 'palmRow' && random() < 0.12;
      addFlat(bx, bz, 0.015, 60, 60, isPark ? 0x6a8a4a : PALETTE.sidewalk);
      if (isPark) {
        for (let palm = 0; palm < 4; palm += 1) {
          palmSpots.push({ x: bx + range(random, -22, 22), z: bz + range(random, -22, 22) });
        }
        continue;
      }
      const wide = key === 'oldHarbor' || key === 'theYard';
      if (wide) {
        const w = range(random, 34, 42);
        const d = range(random, 20, 26);
        const h = range(random, district.buildings.min, district.buildings.max);
        const x = bx + range(random, -4, 4);
        const z = bz + range(random, -4, 4);
        addBuilding(x, z, w, h, d, pick(random, district.buildings.palette));
        for (let c = 0; c < rangeInt(random, 3, 6); c += 1) {
          containerSpots.push({
            x: bx + range(random, -24, 24),
            z: bz + range(random, -24, 24),
            stack: rangeInt(random, 1, 2),
            color: pick(random, PALETTE.container),
          });
        }
        continue;
      }
      const spots = [[-15, -15], [15, -15], [-15, 15], [15, 15]];
      const count = district.buildings.count;
      for (let index = 0; index < count; index += 1) {
        const spot = spots[(index + rangeInt(random, 0, 3)) % spots.length];
        const w = range(random, 13, 22);
        const d = range(random, 13, 22);
        const h = range(random, district.buildings.min, district.buildings.max);
        const x = bx + spot[0] + range(random, -3, 3);
        const z = bz + spot[1] + range(random, -3, 3);
        const mesh = addBuilding(x, z, w, h, d, pick(random, district.buildings.palette));
        if (key === 'neonMile' && h > 34 && random() < 0.5) {
          const signColor = pick(random, PALETTE.neon);
          const sign = new THREE.Mesh(UNIT_BOX, basicMaterialFor(signColor));
          sign.position.set(x, h * 0.62, z + d / 2 + 0.25);
          sign.scale.set(w * 0.55, 3, 0.3);
          cityGroup.add(sign);
          void mesh;
        }
      }
    }
  }

  function addBuilding(x, z, w, h, d, color) {
    const mesh = addBox(x, h / 2, z, w, h, d, color);
    const roofColor = new THREE.Color(color).multiplyScalar(0.62).getHex();
    addBox(x, h + 0.4, z, w * 0.9, 0.8, d * 0.9, roofColor);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  // --- Palm Row boulevard palms ----------------------------------------------
  for (let x = -240; x <= 240; x += 16) {
    if (random() < 0.15) continue;
    palmSpots.push({ x: x + range(random, -3, 3), z: 244 });
    palmSpots.push({ x: x + range(random, -3, 3), z: 262 });
  }
  for (let index = 0; index < 10; index += 1) {
    palmSpots.push({ x: range(random, -240, 240), z: range(random, -240, 240) });
  }
  for (let index = 0; index < 8; index += 1) {
    palmSpots.push({
      x: WORLD.island.centreX + range(random, -60, 60),
      z: WORLD.island.centreZ + range(random, -55, 55),
    });
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.14, 0.24, 5, 6);
  const trunks = new THREE.InstancedMesh(trunkGeometry, materialFor(PALETTE.palmTrunk), palmSpots.length);
  const canopyGeometry = new THREE.IcosahedronGeometry(2.1, 0);
  const canopies = new THREE.InstancedMesh(canopyGeometry, materialFor(PALETTE.palmLeaf), palmSpots.length);
  palmSpots.forEach((spot, index) => {
    dummy.position.set(spot.x, 2.5, spot.z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    dummy.position.set(spot.x, 5.7, spot.z);
    dummy.scale.set(1, 0.55, 1);
    dummy.updateMatrix();
    canopies.setMatrixAt(index, dummy.matrix);
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  cityGroup.add(trunks);
  cityGroup.add(canopies);

  // --- Shipping containers (Old Harbor + The Yard) ---------------------------
  const containerGeometry = new THREE.BoxGeometry(6, 2.6, 2.6);
  const containerMesh = new THREE.InstancedMesh(containerGeometry, materialFor(0xffffff), containerSpots.length * 2);
  let containerIndex = 0;
  const containerColor = new THREE.Color();
  for (const spot of containerSpots) {
    for (let level = 0; level < spot.stack; level += 1) {
      dummy.position.set(spot.x, 1.3 + level * 2.6, spot.z);
      dummy.rotation.set(0, (level % 2) * Math.PI / 2, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      containerMesh.setMatrixAt(containerIndex, dummy.matrix);
      containerMesh.setColorAt(containerIndex, containerColor.setHex(spot.color));
      containerIndex += 1;
    }
  }
  containerMesh.count = containerIndex;
  containerMesh.castShadow = true;
  containerMesh.receiveShadow = true;
  cityGroup.add(containerMesh);

  // --- Harbor cranes -----------------------------------------------------------
  for (const craneZ of [-200, -60]) {
    addBox(-246, 10, craneZ, 3, 20, 3, 0xc0a03a);
    addBox(-236, 19, craneZ, 24, 1.6, 1.6, 0xc0a03a);
    addBox(-252, 18, craneZ, 5, 3, 3, 0x8a7a3a);
    addBox(-228, 15, craneZ, 0.2, 8, 0.2, 0x3a3a3a);
  }

  // --- Lighthouse and marina boats on Isla Verde -------------------------------
  addBox(420, 9, -40, 6, 18, 6, 0xf5f0e0);
  addBox(420, 12, -40, 6.4, 3, 6.4, 0xd9553f);
  addBox(420, 19, -40, 3, 2.5, 3, 0x3a3a3a);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), basicMaterialFor(0xffe9a0));
  lamp.position.set(420, 21, -40);
  cityGroup.add(lamp);
  addBox(412, 2, -30, 8, 4, 6, 0xe8dcc0);
  for (let boat = 0; boat < 4; boat += 1) {
    const bx = 330 + boat * 24;
    addBox(bx, 0.1, 86, 9, 1.4, 3.2, 0xf5f0e0, { castShadow: false });
    addBox(bx - 1, 1.4, 86, 3, 1.6, 2.4, 0x3a6ab0, { castShadow: false });
    addBox(bx + 2, 2.5, 86, 0.25, 6, 0.25, 0x8a6a4a, { castShadow: false });
  }

  // --- Streetlights along the boulevard and the central avenue -----------------
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.13, 6, 6);
  const lampGeometry = new THREE.SphereGeometry(0.35, 8, 6);
  const lampSpots = [];
  for (let x = -240; x <= 240; x += 36) lampSpots.push({ x, z: 246 });
  for (let z = -240; z <= 240; z += 36) lampSpots.push({ x: 30, z });
  const poles = new THREE.InstancedMesh(poleGeometry, materialFor(0x4a4a4a), lampSpots.length);
  const lampHeads = new THREE.InstancedMesh(lampGeometry, basicMaterialFor(0xffd9a0), lampSpots.length);
  lampSpots.forEach((spot, index) => {
    dummy.position.set(spot.x, 3, spot.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(index, dummy.matrix);
    dummy.position.set(spot.x, 6.1, spot.z);
    dummy.updateMatrix();
    lampHeads.setMatrixAt(index, dummy.matrix);
  });
  cityGroup.add(poles);
  cityGroup.add(lampHeads);

  // --- Movement helpers --------------------------------------------------------
  function onLand(x, z) {
    if (Math.abs(x) <= WORLD.half && Math.abs(z) <= WORLD.half) return true;
    const island = WORLD.island;
    if (x >= island.minX && x <= island.maxX && z >= island.minZ && z <= island.maxZ) return true;
    const causeway = WORLD.causeway;
    if (x >= causeway.minX && x <= causeway.maxX && z >= causeway.minZ && z <= causeway.maxZ) return true;
    return false;
  }

  /** Push a circle (x, z, radius) out of every building it overlaps. */
  function collideCircle(pos, radius) {
    for (const box of colliders) {
      if (pos.x < box.minX - radius || pos.x > box.maxX + radius) continue;
      if (pos.z < box.minZ - radius || pos.z > box.maxZ + radius) continue;
      const pushLeft = pos.x - (box.minX - radius);
      const pushRight = box.maxX + radius - pos.x;
      const pushBack = pos.z - (box.minZ - radius);
      const pushFront = box.maxZ + radius - pos.z;
      const smallest = Math.min(pushLeft, pushRight, pushBack, pushFront);
      if (smallest === pushLeft) pos.x = box.minX - radius;
      else if (smallest === pushRight) pos.x = box.maxX + radius;
      else if (smallest === pushBack) pos.z = box.minZ - radius;
      else pos.z = box.maxZ + radius;
    }
  }

  return {
    colliders,
    roads: WORLD.roads,
    half: WORLD.half,
    island: WORLD.island,
    causeway: WORLD.causeway,
    districtAt,
    onLand,
    collideCircle,
  };
}
