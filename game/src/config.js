// Every tuning number, palette and table in one place. Solmar Bay is measured in
// metres, y-up, ground at y = 0. The city grid is a road lattice on a mainland slab,
// with Isla Verde across a causeway to the east and the sea along the south shore.
// All times are golden hour: the clock never leaves 17:42.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';

/** The clock the HUD shows. Golden hour never moves, so screenshots stay consistent. */
export const CLOCK = '17:42';

export const WORLD = {
  /** Mainland slab half-extent: roads run from -252 to +252. */
  half: 258,
  /** Road centre lines, both axes. Blocks sit between consecutive lines. */
  roads: [-252, -180, -108, -36, 36, 108, 180, 252],
  roadWidth: 12,
  /** Beach strip along the south edge, then open sea. */
  beachZ: 258,
  seaLevel: -0.5,
  /** Isla Verde rect and the causeway that joins it to the mainland. */
  island: { minX: 300, maxX: 440, minZ: -70, maxZ: 70, centreX: 370, centreZ: 0 },
  causeway: { minX: 252, maxX: 306, minZ: -7, maxZ: 7 },
};

export const PLAYER = {
  walkSpeed: 4.2,
  sprintSpeed: 7.0,
  accel: 42,
  jumpSpeed: 8.0,
  gravity: 22,
  radius: 0.5,
  height: 1.8,
};

export const CAMERA = {
  footDistance: 6.5,
  footHeight: 2.4,
  carDistance: 9.5,
  carHeight: 3.2,
  minPitch: -0.15,
  maxPitch: 0.85,
  followSharpness: 7,
};

/** Rosa's Alba, the starter sedan, and the other original vehicles of Solmar Bay. */
export const VEHICLES = {
  alba: {
    name: 'Alba',
    kind: 'sedan',
    color: 0xd9553f,
    accel: 14,
    brake: 32,
    maxSpeed: 38,
    maxReverse: 10,
    steerMax: 0.55,
    radius: 1.6,
    length: 4.4,
  },
  vela: {
    name: 'Vela GT',
    kind: 'coupe',
    color: 0x2e6fd8,
    accel: 19,
    brake: 34,
    maxSpeed: 48,
    maxReverse: 10,
    steerMax: 0.5,
    radius: 1.6,
    length: 4.2,
  },
  toro: {
    name: 'Toro',
    kind: 'pickup',
    color: 0xc78a2e,
    accel: 12,
    brake: 30,
    maxSpeed: 34,
    maxReverse: 9,
    steerMax: 0.5,
    radius: 1.7,
    length: 4.8,
  },
};

export const SPAWN = {
  /** Lena starts on foot by Rosa's garage in Old Harbor. */
  player: { x: -176, z: -136, heading: Math.PI },
  /** The Alba waits parked on the road beside the garage, facing north. */
  car: { x: -180, z: -124, heading: Math.PI },
};

/** Six districts, each with its own building shape and palette. */
export const DISTRICTS = {
  palmRow: {
    name: 'Palm Row',
    buildings: { min: 15, max: 30, count: 2, palette: [0xf2e3c8, 0xe8cfa8, 0xffffff, 0xf5d9b0] },
  },
  oldHarbor: {
    name: 'Old Harbor',
    buildings: { min: 6, max: 12, count: 1, palette: [0x9a8a76, 0x7d7468, 0xb09a80, 0x8a7a5e] },
  },
  neonMile: {
    name: 'Neon Mile',
    buildings: { min: 25, max: 62, count: 2, palette: [0x3a4a5e, 0x2e3a4a, 0x51627a, 0x6a7a8e] },
  },
  coralHeights: {
    name: 'Coral Heights',
    buildings: { min: 8, max: 18, count: 3, palette: [0xf7ead2, 0xeec9a0, 0xffffff, 0xd9b48a] },
  },
  theYard: {
    name: 'The Yard',
    buildings: { min: 8, max: 14, count: 1, palette: [0x8a8578, 0x6e6a60, 0x9a9484, 0x7a756a] },
  },
  midtown: {
    name: 'Midtown',
    buildings: { min: 10, max: 24, count: 3, palette: [0xe8dcc0, 0xd8c8a8, 0xc8b898, 0xf0e6d0] },
  },
};

export const PALETTE = {
  skyTop: 0x7fb2e0,
  skyHorizon: 0xffc98a,
  fog: 0xf2a56b,
  sun: 0xffb36b,
  sunDisc: 0xfff2cc,
  ground: 0x9aa07e,
  sidewalk: 0xb9b3a4,
  road: 0x3a3a40,
  roadLine: 0xe8e0c8,
  sand: 0xe0c188,
  sea: 0x2e7fa8,
  seaDeep: 0x1e5a7e,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3a7a3a,
  container: [0xb0503a, 0x3a6ab0, 0x4a8a4a, 0xc0a03a],
  neon: [0xff4fa0, 0x35e0e0, 0xffe14f, 0x9a6bff],
  text: '#f5efe4',
  muted: '#c8bca8',
  gold: '#f2c94c',
};

/** The story's six missions, in order. Step 2 shows only the first objective line. */
export const MISSIONS = [
  { name: 'Homecoming', objective: 'Drive Rosa\u2019s Alba to Old Harbor' },
  { name: 'Courier Run', objective: 'Deliver three parcels across Palm Row' },
  { name: 'The Tow Job', objective: 'Take the Vela GT without raising heat' },
  { name: 'Harbor Lights', objective: 'Clear the dock' },
  { name: 'Neon Mile', objective: 'Tail Kaine\u2019s courier through downtown' },
  { name: 'High Tide', objective: 'Escape across the causeway at 4 stars' },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
