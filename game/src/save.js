// Save: the whole save/load job for Solmar Bay, in one place. One
// localStorage key holds mission progress, money, health, armor, the weapon,
// Lena's position, the current car (model, position, damage) and whether she
// is driving it. Version 3 adds the Step 5 fields (sun postcards, garage
// cars, best race time, side-activity earnings); a version 1 or 2 save still
// loads, with the new fields at their defaults.
import { SAVE_KEY, VEHICLES } from './config.js';

export const SAVE_VERSION = 3;

/** One line about a save for the title screen: money and missions done. */
export function saveSummary(save) {
  if (!save) return '';
  const missions = save.missionsCompleted ?? 0;
  return `$${(save.money ?? 0).toLocaleString('en-US')} · ${missions} mission${missions === 1 ? '' : 's'} done`;
}

/** The shape a save has on disk. Defaults are a fresh game at the garage. */
export function defaultSave() {
  return {
    version: SAVE_VERSION,
    money: 0,
    health: 100,
    armor: 0,
    missionIndex: 0,
    missionsCompleted: 0,
    weapon: 'fists',
    ammoInMag: 0,
    ammoReserve: 0,
    player: { x: -176, z: -136, heading: Math.PI },
    car: { x: -180, z: -124, heading: Math.PI, specKey: 'alba', damage: 0 },
    inCar: false,
    postcards: [],
    garageOwned: [],
    bestRaceSeconds: 0,
    taxiEarned: 0,
    courierEarned: 0,
    racesWon: 0,
  };
}

/** Read the save from localStorage, or null when there is none / it is unreadable. */
export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save !== 'object') return null;
    // Version 1 saves predate mission/weapon/armor fields: fill the defaults.
    const base = defaultSave();
    return { ...base, ...save, player: { ...base.player, ...(save.player || {}) }, car: { ...base.car, ...(save.car || {}) } };
  } catch {
    return null;
  }
}

/** Write a save object (see defaultSave) to localStorage. Returns true on success. */
export function writeSaveData(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
    return true;
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
    return false;
  }
}

/** Build a save object from the live game state. */
export function buildSave(state) {
  return {
    version: SAVE_VERSION,
    money: state.money,
    health: state.health,
    armor: state.armor,
    missionIndex: state.missionIndex,
    missionsCompleted: state.missionsCompleted,
    weapon: state.weapon,
    ammoInMag: state.ammoInMag,
    ammoReserve: state.ammoReserve,
    player: { x: state.player.x, z: state.player.z, heading: state.player.heading },
    car: {
      x: state.car.x,
      z: state.car.z,
      heading: state.car.heading,
      specKey: state.car.specKey,
      damage: state.car.damage,
    },
    inCar: state.inCar,
    postcards: state.postcards || [],
    garageOwned: state.garageOwned || [],
    bestRaceSeconds: state.bestRaceSeconds || 0,
    taxiEarned: state.taxiEarned || 0,
    courierEarned: state.courierEarned || 0,
    racesWon: state.racesWon || 0,
  };
}

/**
 * Apply a loaded save to the live game objects. `game` carries the player
 * object, the car state, a `swapPlayerCar(spec)` renderer hook, and a
 * `setState(patch)` hook for the plain fields; it returns the patch the
 * caller should apply to its own state (money, health, armor, mission...).
 */
export function applySaveData(save, game) {
  if (!save) return null;
  const specKey = save.car && VEHICLES[save.car.specKey] ? save.car.specKey : 'alba';
  if (save.player) {
    game.player.x = save.player.x;
    game.player.z = save.player.z;
    game.player.heading = save.player.heading;
  }
  if (save.car) {
    game.car.x = save.car.x;
    game.car.z = save.car.z;
    game.car.heading = save.car.heading;
    game.car.damage = save.car.damage || 0;
    if (specKey !== game.car.specKey) {
      game.car.specKey = specKey;
      game.car.spec = VEHICLES[specKey];
      if (game.swapPlayerCar) game.swapPlayerCar(game.car.spec);
    }
  }
  return {
    money: save.money || 0,
    health: save.health || 100,
    armor: save.armor || 0,
    missionIndex: save.missionIndex || 0,
    missionsCompleted: save.missionsCompleted || 0,
    weapon: save.weapon || 'fists',
    ammoInMag: save.ammoInMag || 0,
    ammoReserve: save.ammoReserve || 0,
    inCar: Boolean(save.inCar),
    postcards: Array.isArray(save.postcards) ? save.postcards : [],
    garageOwned: Array.isArray(save.garageOwned) ? save.garageOwned : [],
    bestRaceSeconds: save.bestRaceSeconds || 0,
    taxiEarned: save.taxiEarned || 0,
    courierEarned: save.courierEarned || 0,
    racesWon: save.racesWon || 0,
  };
}
