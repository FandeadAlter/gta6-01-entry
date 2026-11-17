// Story: the "High Tide" dialogue of Solmar Bay. Lena Marín comes home to find
// her brother Nico gone and Victor Kaine holding the debt; Rosa Delgado, the
// Old Harbor mechanic, gives her work and a car; SBPD Chief Ada Okafor is the
// law that answers what the player does. Lines are data only — the HUD shows
// them one banner at a time, each for a few seconds, in mission order.

export const CHARACTERS = {
  lena: { name: 'Lena Marín', color: '#7fd4d4' },
  rosa: { name: 'Rosa Delgado', color: '#f2c94c' },
  nico: { name: 'Nico Marín', color: '#9ab8ff' },
  kaine: { name: 'Victor Kaine', color: '#ff7a7a' },
  okafor: { name: 'Chief Ada Okafor', color: '#8ab8ff' },
  courier: { name: 'Kaine\u2019s Courier', color: '#c8bca8' },
};

/** One spoken line: who says it, and the words the banner shows. */
export function line(speaker, text) {
  return { speaker, text };
}

/** Intro and outro lines for each of the six missions, in order. */
export const MISSION_DIALOGUE = [
  {
    intro: [
      line('rosa', 'Lena! You came home. Your brother\u2019s debt is due — Kaine owns the note.'),
      line('lena', 'Then I drive. Give me a car, Rosa, and I\u2019ll earn it back.'),
      line('rosa', 'Take my Alba. Drive her to the docks — slow and steady, the SBPD watch this street.'),
    ],
    outro: [
      line('rosa', 'Clean driving. You still have it, Lena.'),
      line('lena', 'One job down. What\u2019s next?'),
    ],
  },
  {
    intro: [
      line('rosa', 'Three parcels, Palm Row, before the lunch crowd. The clock is running.'),
      line('lena', 'Palm Row it is. Tell the customers Lena delivers.'),
    ],
    outro: [
      line('rosa', 'Every parcel on time. The harbor talks — people are starting to trust you.'),
    ],
  },
  {
    intro: [
      line('rosa', 'A Vela GT sits in Coral Heights. Kaine\u2019s people parked it there — take it, quietly.'),
      line('lena', 'Quiet is my middle name. Mostly.'),
      line('rosa', 'If the SBPD see you take it, the whole city will. Keep the heat down.'),
    ],
    outro: [
      line('rosa', 'A Vela GT, no sirens. You drive like a ghost, Lena.'),
    ],
  },
  {
    intro: [
      line('rosa', 'Kaine\u2019s men are on the dock tonight. Take the pistol — and clear them out.'),
      line('lena', 'I didn\u2019t come home to hide. Tell Nico I\u2019m coming.'),
      line('kaine', 'Miss Marín. My men shoot first. Do try to keep up.'),
    ],
    outro: [
      line('rosa', 'The dock is yours. Kaine just lost a crew — he\u2019ll notice that.'),
    ],
  },
  {
    intro: [
      line('rosa', 'Kaine\u2019s courier runs the Neon Mile at dusk. Tail him — don\u2019t let him see you.'),
      line('lena', 'Follow the money, find my brother.'),
      line('courier', 'Why is that Alba behind me again? Keep driving. Don\u2019t stop.'),
    ],
    outro: [
      line('lena', 'He led me straight to Kaine\u2019s door. Now I know where Nico is.'),
    ],
  },
  {
    intro: [
      line('rosa', 'The boat yard on Isla Verde. Nico is there — and so is Kaine.'),
      line('kaine', 'Your brother owes me, Lena. The tide is coming in, and so am I.'),
      line('lena', 'Then the tide takes us both. I\u2019m coming, Nico.'),
      line('okafor', 'SBPD to all units: four stars on the causeway. Bring them in — alive.'),
    ],
    outro: [
      line('lena', 'Nico — you\u2019re free. Kaine\u2019s empire ends tonight.'),
      line('rosa', 'High tide, Lena. You did it. Solmar Bay is yours again.'),
    ],
  },
];

/** Free-roam barks: short lines shown when the player does something notable. */
export const BARKS = {
  stolen: [
    line('lena', 'Borrowed. Permanently.'),
    line('lena', 'This one drives better already.'),
  ],
  busted: [line('okafor', 'SBPD. You\u2019re coming with us, Miss Marín.')],
  wasted: [line('rosa', 'Lena! Wake up — the garage, now. You\u2019re not done yet.')],
  lowHealth: [line('lena', 'I\u2019m hurt. I need cover — or a pickup.')],
  pistol: [line('rosa', 'Pistol\u2019s loaded. Aim with the mouse, fire with a click.')],
};

/**
 * The dialogue banner: a queue of lines, one on screen at a time. `update`
 * advances the clock; `current()` is what the HUD shows, or null.
 */
export class StoryManager {
  constructor() {
    this.queue = [];
    this.currentLine = null;
    this.timeLeft = 0;
  }

  /** How long one line stays on screen, in seconds. */
  static get LINE_TIME() {
    return 4.5;
  }

  /** Queue lines (an array from MISSION_DIALOGUE or BARKS). */
  say(lines) {
    for (const item of lines) this.queue.push(item);
    if (!this.currentLine) this.next();
  }

  /** Queue one single line. */
  sayOne(speaker, text) {
    this.say([line(speaker, text)]);
  }

  next() {
    this.currentLine = this.queue.shift() || null;
    this.timeLeft = this.currentLine ? StoryManager.LINE_TIME : 0;
  }

  update(dt) {
    if (!this.currentLine) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.next();
  }

  /** The line the HUD should show now, or null. */
  current() {
    return this.currentLine;
  }

  /** The speaker's display name and colour for the current line. */
  currentSpeaker() {
    if (!this.currentLine) return null;
    return CHARACTERS[this.currentLine.speaker] || { name: this.currentLine.speaker, color: '#f5efe4' };
  }

  clear() {
    this.queue = [];
    this.currentLine = null;
    this.timeLeft = 0;
  }
}
