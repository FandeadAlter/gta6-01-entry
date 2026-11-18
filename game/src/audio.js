// Audio: every sound in Solmar Bay is procedural WebAudio — no audio files.
// An engine hum that follows the car's speed, a two-tone siren while the
// wanted level is up, noise-burst gunshots, a UI click, a mission-complete
// chime, a light bass-and-pad music loop, and a 3-station car radio (R while
// driving) that swaps the music loop. The context is created lazily
// on the first user gesture (browsers block audio before one), and every
// method is a no-op until then, so headless screenshots stay silent and safe.
/** The car radio's three stations: name, bass line, wave, bar length, volume. */
export const RADIO_STATIONS = [
  { name: 'Bay FM 87.9', bass: [55, 43.65, 65.41, 49], wave: 'triangle', interval: 2000, gain: 0.06 },
  { name: 'Neon 101.5', bass: [110, 87.31, 98, 130.81], wave: 'sawtooth', interval: 1000, gain: 0.03 },
  { name: 'Solmar Classics 94.3', bass: [65.41, 55, 73.42, 49], wave: 'sine', interval: 2600, gain: 0.07 },
];

export class AudioManager {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.stationIndex = 0;
    this.enabled = true;
    this.lastEngineSpeed = 0;
  }

  /** Create the context. Call from a click or keypress; safe to call twice. */
  init() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.context.destination);
      // Engine: a low sawtooth whose pitch follows speed, kept very quiet.
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that alternates between two notes, gated by gain.
      this.sirenOsc = this.context.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.context.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.startMusic();
    } catch {
      this.context = null;
    }
  }

  get ready() {
    return Boolean(this.context && this.context.state === 'running');
  }

  /** Engine hum: speed in m/s, 0 when on foot (silent). Call every frame. */
  setEngine(speed, inCar) {
    if (!this.ready || !this.engineOsc) return;
    const target = inCar ? 0.02 + Math.min(0.09, Math.abs(speed) * 0.002) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.context.currentTime, 0.1);
    const freq = 55 + Math.abs(speed) * 2.2;
    this.engineOsc.frequency.setTargetAtTime(freq, this.context.currentTime, 0.08);
  }

  /** Siren on while wanted > 0; pitch alternates high/low twice a second. */
  setSiren(wanted, time) {
    if (!this.ready || !this.sirenOsc) return;
    const on = wanted > 0;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.context.currentTime, 0.15);
    if (on) {
      const high = Math.floor(time * 2) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, this.context.currentTime, 0.05);
    }
  }

  /** A short filtered noise burst: a gunshot, a punch thud, or a car impact. */
  noiseBurst(duration, filterFreq, gainValue) {
    if (!this.ready) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  shot() {
    this.noiseBurst(0.12, 1800, 0.5);
  }

  enemyShot() {
    this.noiseBurst(0.1, 1200, 0.2);
  }

  punch() {
    this.noiseBurst(0.08, 500, 0.35);
  }

  impact() {
    this.noiseBurst(0.15, 400, 0.4);
  }

  /** One short sine blip at a frequency, for UI clicks and pickups. */
  blip(freq, duration, gainValue) {
    if (!this.ready) return;
    const osc = this.context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(gainValue, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.context.currentTime + duration);
  }

  uiClick() {
    this.blip(660, 0.07, 0.25);
  }

  pickup() {
    this.blip(880, 0.12, 0.3);
    setTimeout(() => this.blip(1320, 0.15, 0.25), 90);
  }

  /** Mission complete: a rising three-note chime. */
  missionComplete() {
    if (!this.ready) return;
    [523, 659, 784].forEach((freq, index) => {
      setTimeout(() => this.blip(freq, 0.22, 0.3), index * 130);
    });
  }

  missionFailed() {
    if (!this.ready) return;
    [392, 330, 262].forEach((freq, index) => {
      setTimeout(() => this.blip(freq, 0.25, 0.28), index * 150);
    });
  }

  /**
   * The music loop: the current radio station's bass line with a soft pad
   * note on top, one bar per interval, scheduled by a timer. Quiet by
   * design — it sits under the engine and the siren.
   */
  startMusic() {
    if (!this.context) return;
    this.stopMusic();
    const station = RADIO_STATIONS[this.stationIndex];
    this.musicStep = 0;
    const barSeconds = station.interval / 1000;
    this.musicTimer = setInterval(() => {
      if (!this.ready) return;
      const root = station.bass[this.musicStep % station.bass.length];
      this.musicStep += 1;
      const osc = this.context.createOscillator();
      osc.type = station.wave;
      osc.frequency.value = root;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(station.gain, this.context.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + barSeconds * 0.95);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.context.currentTime + barSeconds);
    }, station.interval);
  }

  /** The station now playing. */
  get stationName() {
    return RADIO_STATIONS[this.stationIndex].name;
  }

  /** Cycle to the next radio station; returns its name for the HUD. */
  cycleStation() {
    this.stationIndex = (this.stationIndex + 1) % RADIO_STATIONS.length;
    if (this.context) this.startMusic();
    return this.stationName;
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
