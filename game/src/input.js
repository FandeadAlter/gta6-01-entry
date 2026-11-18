// Keyboard and pointer input. Held keys give movement and sprint; one-shot presses
// (confirm, pause, jump, enter/exit a car) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// Mouse drag orbits the camera; clicking the canvas also takes pointer lock so the
// mouse can steer the camera without dragging.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_JUMP = 4;
export const ACTION_ENTER = 8;
export const ACTION_FIRE = 16;
export const ACTION_RELOAD = 32;
/** Weapon-slot keys 1-4, as bit flags above the movement actions. */
export const ACTION_WEAPON_1 = 64;
export const ACTION_WEAPON_2 = 128;
export const ACTION_WEAPON_3 = 256;
export const ACTION_WEAPON_4 = 512;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const JUMP_KEY = new Set(['Space']);
const FIRE_KEY = new Set(['KeyF']);
const RELOAD_KEY = new Set(['KeyR']);
const WEAPON_KEYS = new Map([
  ['Digit1', ACTION_WEAPON_1],
  ['Digit2', ACTION_WEAPON_2],
  ['Digit3', ACTION_WEAPON_3],
  ['Digit4', ACTION_WEAPON_4],
]);

/** Keys the game uses, so the page never scrolls under them. */
const GAME_KEYS = new Set([
  ...FORWARD, ...BACK, ...LEFT, ...RIGHT, ...SPRINT, ...CONFIRM, ...PAUSE, ...ENTER,
  ...FIRE_KEY, ...RELOAD_KEY, ...WEAPON_KEYS.keys(),
]);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let mouseHeld = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat) {
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      if (ENTER.has(event.code)) actions |= ACTION_ENTER;
      if (JUMP_KEY.has(event.code)) actions |= ACTION_JUMP;
      if (RELOAD_KEY.has(event.code)) actions |= ACTION_RELOAD;
      const weaponAction = WEAPON_KEYS.get(event.code);
      if (weaponAction) actions |= weaponAction;
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  target.addEventListener('pointerdown', (event) => {
    dragging = true;
    if (event.button === 0) {
      mouseHeld = true;
      actions |= ACTION_FIRE;
    }
    lastX = event.clientX;
    lastY = event.clientY;
    // Pointer lock on click gives free mouse-look; a failed request is harmless.
    if (document.pointerLockElement !== target) {
      try {
        target.requestPointerLock();
      } catch {
        // Pointer lock can be refused (headless, iframe): drag still works.
      }
    }
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    mouseHeld = false;
  });
  window.addEventListener('pointermove', (event) => {
    if (document.pointerLockElement === target) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
      return;
    }
    if (!dragging) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  return {
    /** Forward/back strafe as -1, 0 or 1 each: { forward, strafe }. */
    moveAxes() {
      const forward = (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
      const strafe = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      return { forward, strafe };
    },
    /** True while either Shift is held. */
    sprinting() {
      return hasAny(SPRINT);
    },
    /** True while the mouse button or F is held: hold to keep firing. */
    firing() {
      return mouseHeld || hasAny(FIRE_KEY);
    },
    /** W/S for the car: 1 accelerate, -1 brake/reverse, 0 neither. */
    drivePedal() {
      return (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
    },
    /** A/D for the car: 1 right, -1 left, 0 straight. */
    driveSteer() {
      return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
    },
    /** Mouse orbit since the last call, in pixels. */
    takeMouseDelta() {
      const delta = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return delta;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
