// HUD: everything the player reads while playing — wanted stars, money,
// health and armor bars, weapon and ammo, the mission name and objective,
// a mission timer, the dialogue banner, the crosshair, the speedometer, the
// district label, and the live canvas minimap (roads, player arrow, mission
// blip, police, traffic and parked cars). Text is only rewritten when it
// changes; the minimap is redrawn every frame because the world moves.
import { CLOCK } from './config.js';

const DISTRICT_NAMES = {
  palmRow: 'Palm Row',
  oldHarbor: 'Old Harbor',
  neonMile: 'Neon Mile',
  coralHeights: 'Coral Heights',
  theYard: 'The Yard',
  midtown: 'Midtown',
};

export class HudManager {
  constructor(doc, city) {
    this.city = city;
    this.el = {
      hud: doc.getElementById('hud'),
      stars: doc.getElementById('stars'),
      money: doc.getElementById('money'),
      healthFill: doc.getElementById('health-fill'),
      armorFill: doc.getElementById('armor-fill'),
      armorBar: doc.getElementById('armor-bar'),
      objective: doc.getElementById('objective'),
      missionName: doc.getElementById('mission-name'),
      missionTimer: doc.getElementById('mission-timer'),
      speed: doc.getElementById('speed-value'),
      speedUnit: doc.getElementById('speed-unit'),
      clock: doc.getElementById('clock'),
      fps: doc.getElementById('fps'),
      prompt: doc.getElementById('prompt'),
      district: doc.getElementById('district-label'),
      minimap: doc.getElementById('minimap'),
      weapon: doc.getElementById('weapon'),
      ammo: doc.getElementById('ammo'),
      dialogue: doc.getElementById('dialogue'),
      dialogueSpeaker: doc.getElementById('dialogue-speaker'),
      dialogueText: doc.getElementById('dialogue-text'),
      crosshair: doc.getElementById('crosshair'),
    };
    this.minimapContext = this.el.minimap.getContext('2d');
    this.last = {
      money: -1, health: -1, armor: -1, wanted: -1, objective: '',
      // speed starts at -2 (not -1) so the first update also hides the
      // "km/h" unit when Lena is on foot; -1 is the on-foot speed itself.
      missionName: '', timer: '', speed: -2, prompt: null, district: '',
      weapon: '', ammo: '', dialogue: null,
    };
  }

  show(inPlay) {
    this.el.hud.style.visibility = inPlay ? 'visible' : 'hidden';
  }

  /** Format a mission timer as m:ss. */
  static formatTimer(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  drawMinimap(world) {
    const { player, car, traffic, fleet, police, missions, combat } = world;
    const canvas = this.el.minimap;
    const size = canvas.width;
    const scale = size / 580;
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    const ctx = this.minimapContext;
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#9aa07e';
    ctx.fillRect(...toMap(-258, -258), 516 * scale, 516 * scale);
    const island = this.city.island;
    ctx.fillRect(...toMap(island.minX, island.minZ), (island.maxX - island.minX) * scale, (island.maxZ - island.minZ) * scale);
    ctx.fillStyle = '#e0c188';
    ctx.fillRect(...toMap(-258, 258), 516 * scale, 42 * scale);
    ctx.fillStyle = '#8a8578';
    ctx.fillRect(...toMap(252, -7), 54 * scale, 14 * scale);
    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 2;
    for (const road of this.city.roads) {
      ctx.beginPath();
      let [x1, y1] = toMap(-258, road);
      let [x2, y2] = toMap(258, road);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      [x1, y1] = toMap(road, -258);
      [x2, y2] = toMap(road, 258);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // Traffic cars as small grey dots, parked stealable cars as gold dots.
    ctx.fillStyle = '#c8c8c8';
    for (const pos of traffic.positions()) {
      const [tx, ty] = toMap(pos.x, pos.z);
      ctx.fillRect(tx - 1, ty - 1, 2, 2);
    }
    ctx.fillStyle = '#f2c94c';
    for (const parked of fleet.parked) {
      if (parked.stolen) continue;
      const [tx, ty] = toMap(parked.x, parked.z);
      ctx.fillRect(tx - 1, ty - 1, 3, 3);
    }
    // Enemies as dark-red dots, so a shootout reads on the map.
    if (combat) {
      ctx.fillStyle = '#ff5a5a';
      for (const enemy of combat.enemies) {
        if (!enemy.alive) continue;
        const [ex, ey] = toMap(enemy.x, enemy.z);
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Police blips: cruisers red, officers blue, helicopter yellow.
    const blips = police.blips();
    ctx.fillStyle = '#d92a2a';
    for (const cruiser of blips.cruisers) {
      const [bx, by] = toMap(cruiser.x, cruiser.z);
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2a6aff';
    for (const officer of blips.officers) {
      const [bx, by] = toMap(officer.x, officer.z);
      ctx.fillRect(bx - 2, by - 2, 4, 4);
    }
    if (blips.helicopter) {
      ctx.fillStyle = '#ffe14f';
      const [hx, hy] = toMap(blips.helicopter.x, blips.helicopter.z);
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // The mission waypoint: a gold diamond with a ring, on top of the roads.
    if (missions) {
      const point = missions.waypoint();
      if (point) {
        const [wx, wy] = toMap(point.x, point.z);
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.moveTo(wx, wy - 5);
        ctx.lineTo(wx + 5, wy);
        ctx.lineTo(wx, wy + 5);
        ctx.lineTo(wx - 5, wy);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The player's car, then the player arrow on top.
    const [carX, carY] = toMap(car.x, car.z);
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(carX, carY, 4, 0, Math.PI * 2);
    ctx.fill();
    const [px, py] = toMap(player.x, player.z);
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(px, py);
    // Map: +x is right, +z is down; the arrow is drawn pointing up, so rotate
    // by PI - heading to point it along (sin h, cos h).
    ctx.rotate(Math.PI - player.heading);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Refresh every HUD element from the current game state. `state` carries
   * money, health, armor, wanted, objective, missionName, timer (seconds, 0
   * hides it), speedKmh, inCar, prompt, weapon, ammo text, dialogue (a
   * { speakerName, speakerColor, text } or null), and fps. `world` is what
   * drawMinimap needs.
   */
  update(state, world) {
    const el = this.el;
    if (state.money !== this.last.money) {
      this.last.money = state.money;
      el.money.textContent = `$${state.money.toLocaleString('en-US')}`;
    }
    if (state.health !== this.last.health) {
      this.last.health = state.health;
      el.healthFill.style.width = `${Math.max(0, state.health)}%`;
      el.healthFill.style.background = state.health <= 25 ? '#d92a2a' : '#5ec96a';
    }
    if (state.armor !== this.last.armor) {
      this.last.armor = state.armor;
      el.armorFill.style.width = `${Math.max(0, state.armor)}%`;
      el.armorBar.style.visibility = state.armor > 0 ? 'visible' : 'hidden';
    }
    if (state.wanted !== this.last.wanted) {
      this.last.wanted = state.wanted;
      el.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    }
    if (state.objective !== this.last.objective) {
      this.last.objective = state.objective;
      el.objective.textContent = state.objective;
    }
    if (state.missionName !== this.last.missionName) {
      this.last.missionName = state.missionName;
      el.missionName.textContent = state.missionName;
    }
    const timerText = state.timer > 0 ? HudManager.formatTimer(state.timer) : '';
    if (timerText !== this.last.timer) {
      this.last.timer = timerText;
      el.missionTimer.textContent = timerText;
      el.missionTimer.style.visibility = timerText ? 'visible' : 'hidden';
    }
    const speedKmh = state.inCar ? state.speedKmh : -1;
    if (speedKmh !== this.last.speed) {
      this.last.speed = speedKmh;
      el.speed.textContent = state.inCar ? String(state.speedKmh) : '';
      el.speedUnit.style.visibility = state.inCar ? 'visible' : 'hidden';
    }
    if (state.prompt !== this.last.prompt) {
      this.last.prompt = state.prompt;
      el.prompt.textContent = state.prompt;
      el.prompt.style.visibility = state.prompt ? 'visible' : 'hidden';
    }
    const districtName = DISTRICT_NAMES[this.city.districtAt(world.player.x, world.player.z)] || 'Solmar Bay';
    if (districtName !== this.last.district) {
      this.last.district = districtName;
      el.district.textContent = districtName;
    }
    if (state.weapon !== this.last.weapon) {
      this.last.weapon = state.weapon;
      el.weapon.textContent = state.weapon === 'pistol' ? 'Pistol' : 'Fists';
    }
    if (state.ammo !== this.last.ammo) {
      this.last.ammo = state.ammo;
      el.ammo.textContent = state.ammo;
      el.ammo.style.visibility = state.weapon === 'pistol' ? 'visible' : 'hidden';
    }
    // Dialogue banner: speaker name in their colour, then the line.
    const dialogueKey = state.dialogue ? `${state.dialogue.speakerName}:${state.dialogue.text}` : null;
    if (dialogueKey !== this.last.dialogue) {
      this.last.dialogue = dialogueKey;
      if (state.dialogue) {
        el.dialogueSpeaker.textContent = state.dialogue.speakerName;
        el.dialogueSpeaker.style.color = state.dialogue.speakerColor;
        el.dialogueText.textContent = state.dialogue.text;
        el.dialogue.style.visibility = 'visible';
      } else {
        el.dialogue.style.visibility = 'hidden';
      }
    }
    // Crosshair: only on foot with the pistol out.
    el.crosshair.style.visibility = (!state.inCar && state.weapon === 'pistol') ? 'visible' : 'hidden';
    el.clock.textContent = CLOCK;
    el.fps.textContent = `${state.fps} fps`;
    this.drawMinimap(world);
  }
}
