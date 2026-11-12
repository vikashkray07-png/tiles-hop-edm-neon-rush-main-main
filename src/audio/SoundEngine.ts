// High-performance procedural Web Audio EDM synthesizer
// Zero external audio files = zero latency, zero 404s, 100% reliable rhythm sync

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isPlayingMusic: boolean = false;
  private currentBpm: number = 128;
  private beatTimer: number | null = null;
  private noteIndex: number = 0;
  private currentScale: number[] = [60, 63, 65, 67, 70, 72, 75, 77]; // Pentatonic minor
  private musicVolume: number = 0.55;
  private sfxVolume: number = 0.85;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Converts MIDI note to frequency
  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // --- SOUND EFFECTS ---

  public playBounce(accuracy: 'perfect' | 'great', combo: number) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // 1. Kick / Impact Thump
    const kickOsc = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(140, t);
    kickOsc.frequency.exponentialRampToValueAtTime(38, t + 0.12);

    kickGain.gain.setValueAtTime(accuracy === 'perfect' ? 0.9 : 0.7, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    kickOsc.connect(kickGain);
    kickGain.connect(this.masterGain);
    kickOsc.start(t);
    kickOsc.stop(t + 0.18);

    // 2. Melodic Bouncy Pluck
    // Pick note from chord progression keyed to combo
    const baseMidi = 60; // C4
    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19];
    const noteOffset = scale[(combo - 1) % scale.length];
    const octaveBonus = Math.min(Math.floor((combo - 1) / scale.length) * 12, 24);
    const freq = this.midiToFreq(baseMidi + noteOffset + octaveBonus);

    const synthOsc = this.ctx.createOscillator();
    const synthFilter = this.ctx.createBiquadFilter();
    const synthGain = this.ctx.createGain();

    synthOsc.type = accuracy === 'perfect' ? 'triangle' : 'sawtooth';
    synthOsc.frequency.setValueAtTime(freq, t);

    synthFilter.type = 'lowpass';
    synthFilter.frequency.setValueAtTime(accuracy === 'perfect' ? 3200 : 2000, t);
    synthFilter.frequency.exponentialRampToValueAtTime(300, t + 0.28);

    synthGain.gain.setValueAtTime(0.5 * this.sfxVolume, t);
    synthGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    synthOsc.connect(synthFilter);
    synthFilter.connect(synthGain);
    synthGain.connect(this.masterGain);

    synthOsc.start(t);
    synthOsc.stop(t + 0.35);

    // 3. Perfect Crystal Chime for high precision hits
    if (accuracy === 'perfect') {
      const chimeOsc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(freq * 2, t);
      chimeOsc.frequency.exponentialRampToValueAtTime(freq * 4, t + 0.18);

      chimeGain.gain.setValueAtTime(0.4 * this.sfxVolume, t);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(this.masterGain);

      chimeOsc.start(t);
      chimeOsc.stop(t + 0.28);
    }
  }

  public playJumpLaunch(power: number) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = 200 + power * 150;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.2, t + 0.18);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4 * this.sfxVolume, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playLand(isPerfect: boolean) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Bass thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    gain.gain.setValueAtTime(isPerfect ? 0.7 : 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // Chime if perfect
    if (isPerfect) {
      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(880, t);
      chime.frequency.exponentialRampToValueAtTime(1760, t + 0.2);

      chimeGain.gain.setValueAtTime(0.35, t);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      chime.connect(chimeGain);
      chimeGain.connect(this.masterGain);
      chime.start(t);
      chime.stop(t + 0.26);
    }
  }

  public playLevelComplete() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + i * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.4 * this.sfxVolume, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playCountdownBeep(isGo: boolean = false) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isGo ? 'triangle' : 'sine';
    const freq = isGo ? 880 : 440; // High A5 for GO!, A4 for 3, 2, 1
    osc.frequency.setValueAtTime(freq, t);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1320, t + 0.25);
    }

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime((isGo ? 0.6 : 0.45) * this.sfxVolume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + (isGo ? 0.38 : 0.2));
  }

  public playGemCollect() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [this.midiToFreq(79), this.midiToFreq(84), this.midiToFreq(91)]; // G5, C6, G6

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);

      gain.gain.setValueAtTime(0.001, t + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.35 * this.sfxVolume, t + idx * 0.04 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.25);
    });
  }

  public playMiss() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Gentle, soft descending musical chord using warm sine waves
    const freqs = [329.63, 261.63, 196.00]; // E4 -> C4 -> G3
    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, t + idx * 0.06 + 0.35);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t);

      gain.gain.setValueAtTime(0.001, t + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.25 * this.sfxVolume, t + idx * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.38);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.4);
    });
  }

  public playUiClick() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);

    gain.gain.setValueAtTime(0.3 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  public playGameStart() {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4 * this.sfxVolume, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  // --- PROCEDURAL EDM BACKGROUND BEAT GENERATOR ---

  public startBackgroundMusic(bpm: number, scale?: number[]) {
    this.init();
    this.stopBackgroundMusic();
    this.currentBpm = bpm;
    if (scale) this.currentScale = scale;
    this.isPlayingMusic = true;
    this.noteIndex = 0;

    const beatIntervalMs = (60 / this.currentBpm) * 1000;
    
    // Kick off immediate first beat
    this.triggerBeat(this.noteIndex++);

    this.beatTimer = window.setInterval(() => {
      if (!this.isPlayingMusic) return;
      this.triggerBeat(this.noteIndex++);
    }, beatIntervalMs);
  }

  // Chill ambient cosmic synthesizer music for Home Screen / Title Screen ONLY
  public startHomeAmbientMusic() {
    this.init();
    this.stopBackgroundMusic();
    if (!this.ctx || !this.musicGain) return;

    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicVolume, t);

    this.currentBpm = 92;
    this.isPlayingMusic = true;
    this.noteIndex = 0;

    const beatIntervalMs = (60 / this.currentBpm) * 1000;
    this.triggerHomeBeat(this.noteIndex++);

    this.beatTimer = window.setInterval(() => {
      if (!this.isPlayingMusic) return;
      this.triggerHomeBeat(this.noteIndex++);
    }, beatIntervalMs);
  }

  public stopBackgroundMusic() {
    this.isPlayingMusic = false;
    if (this.beatTimer !== null) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
    // Instantly silence all ongoing audio tails and scheduled notes
    if (this.ctx && this.musicGain) {
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setValueAtTime(0, t);
    }
  }

  private triggerBeat(step: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const beatInBar = step % 4; // 0, 1, 2, 3

    // 1. Kick Drum on 0 and 2 (or all 4 in high-tempo EDM drop)
    if (beatInBar === 0 || beatInBar === 2) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(120, t);
      kickOsc.frequency.exponentialRampToValueAtTime(32, t + 0.1);

      kickGain.gain.setValueAtTime(0.6 * this.musicVolume, t);
      kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);
      kickOsc.start(t);
      kickOsc.stop(t + 0.18);
    }

    // 2. Snare / Clap on 1 and 3 (Classic EDM 2 & 4 snare)
    if (beatInBar === 1 || beatInBar === 3) {
      this.triggerSnare(t);
    }

    // 3. Hi-Hat ticking for groove
    this.triggerHiHat(t);

    // 4. Synth chord progression pad (every 4 beats)
    if (beatInBar === 0) {
      this.triggerChordPad(t, Math.floor(step / 4) % 4);
    }
  }

  private triggerSnare(t: number) {
    if (!this.ctx || !this.masterGain) return;

    // Noise buffer for snap
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3 * this.musicVolume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.13);
  }

  private triggerHiHat(t: number) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18 * this.musicVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.05);
  }

  private triggerChordPad(t: number, chordIdx: number) {
    if (!this.ctx || !this.masterGain) return;

    // 4-chord EDM progression: vi - IV - I - V (Am - F - C - G in C)
    const chordRoots = [57, 53, 60, 55]; // A3, F3, C4, G3
    const root = chordRoots[chordIdx % chordRoots.length];
    const chordNotes = [root, root + 4, root + 7]; // Triad

    chordNotes.forEach((midi) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(midi), t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(600, t + (60 / this.currentBpm) * 3.8);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12 * this.musicVolume, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (60 / this.currentBpm) * 3.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain || this.masterGain);

      osc.start(t);
      osc.stop(t + (60 / this.currentBpm) * 3.9);
    });
  }

  private triggerHomeBeat(step: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const beatInBar = step % 8;

    // Ambient chords every 8 beats: Dm9 -> Gsus4 -> Cmaj9 -> Am9
    if (beatInBar === 0) {
      const homeChordRoots = [62, 55, 60, 57]; // D4, G3, C4, A3
      const root = homeChordRoots[Math.floor(step / 8) % homeChordRoots.length];
      const chordNotes = [root, root + 3, root + 7, root + 10]; // Mellow 7th/9th chord

      chordNotes.forEach((midi) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.midiToFreq(midi), t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.08 * this.musicVolume, t + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 4.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain || this.masterGain);

        osc.start(t);
        osc.stop(t + 4.8);
      });
    }

    // Gentle melodic twinkle every 2 beats
    if (step % 2 === 0) {
      const melodicNotes = [72, 74, 76, 79, 81, 84];
      const note = melodicNotes[(step / 2) % melodicNotes.length];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.midiToFreq(note), t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.05 * this.musicVolume, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.musicGain || this.masterGain);

      osc.start(t);
      osc.stop(t + 1.0);
    }
  }
}

export const soundEngine = new SoundEngine();
