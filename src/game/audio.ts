/* CosmoWar Arena — WebAudio prosedürel ses motoru: sıfır asset, ırk temalı sentez */

export interface AudioSettings {
  volume: number;
  muted: boolean;
}

type OscType = OscillatorType;

function racePitch(raceId: number): number {
  return 1 + (raceId - 1.5) * 0.09;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  settings: AudioSettings = { volume: 0.5, muted: false };
  private mineOsc: { osc: OscillatorNode; gain: GainNode } | null = null;
  private lastPlay = new Map<string, number>();

  resume() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSettings(s: AudioSettings) {
    this.settings = s;
    this.applyVolume();
  }

  private applyVolume() {
    if (this.master) this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
  }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastPlay.get(key) ?? 0;
    if (now - last < ms) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  private tone(type: OscType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    if (!this.ctx || !this.master || this.settings.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, vol: number, q = 1, sweepTo?: number) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.settings.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo !== undefined)
      f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Uzaklık 0-1 arası (1 = oyuncunun üstünde). */
  play(event: string, dist: number, raceId = 0) {
    if (!this.ctx || this.settings.muted) return;
    const vol = Math.max(0, 1 - dist) ** 1.6;
    if (vol <= 0.02) return;
    const rp = racePitch(raceId);
    switch (event) {
      case "fire":
        if (!this.throttle("fire", 45)) return;
        this.tone("square", 720 * rp, 180 * rp, 0.09, 0.12 * vol);
        this.noise(0.06, 3200 * rp, 0.08 * vol);
        break;
      case "hit":
        if (!this.throttle("hit", 40)) return;
        this.noise(0.07, 2400, 0.14 * vol);
        this.tone("triangle", 300, 90, 0.06, 0.08 * vol);
        break;
      case "explode": {
        if (!this.throttle("explode", 70)) return;
        this.noise(0.55, 900, 0.4 * vol, 0.7, 60);
        this.tone("sine", 130 * rp, 34, 0.5, 0.3 * vol);
        break;
      }
      case "levelup":
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone("sine", f, f, 0.16, 0.16 * vol, i * 0.09),
        );
        break;
      case "evolve":
        [392, 523, 659, 784, 1046, 1318].forEach((f, i) =>
          this.tone("sawtooth", f, f * 1.01, 0.2, 0.11 * vol, i * 0.08),
        );
        this.noise(0.6, 4000, 0.1 * vol, 1, 200);
        break;
      case "teleport":
        this.tone("sine", 220 * rp, 1600 * rp, 0.16, 0.14 * vol);
        this.tone("sine", 1600 * rp, 260 * rp, 0.2, 0.1 * vol, 0.1);
        break;
      case "trap":
        this.tone("square", 140, 520, 0.18, 0.12 * vol);
        break;
      case "gas":
        this.noise(0.7, 700, 0.18 * vol, 0.6, 220);
        break;
      case "deliver":
        this.tone("sine", 660, 660, 0.1, 0.13 * vol);
        this.tone("sine", 880, 880, 0.14, 0.13 * vol, 0.09);
        break;
      case "baseup":
        [330, 415, 494, 659].forEach((f, i) =>
          this.tone("triangle", f, f, 0.3, 0.15 * vol, i * 0.13),
        );
        break;
      case "basehit":
        if (!this.throttle("basehit", 150)) return;
        this.tone("sawtooth", 190, 120, 0.12, 0.1 * vol);
        break;
      case "alarm":
        if (!this.throttle("alarm", 2500)) return;
        for (let i = 0; i < 3; i++) this.tone("square", 880, 620, 0.22, 0.09, i * 0.32);
        break;
      case "lowhp":
        if (!this.throttle("lowhp", 1200)) return;
        this.tone("sine", 980, 940, 0.1, 0.07);
        break;
      case "antiget":
        [880, 1174, 1568].forEach((f, i) => this.tone("sine", f, f, 0.14, 0.13 * vol, i * 0.08));
        break;
      case "void":
        if (!this.throttle("void", 130)) return;
        this.tone("sine", 90 + Math.random() * 60, 46, 0.24, 0.05 * vol);
        break;
      case "win":
        [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) =>
          this.tone("triangle", f, f, 0.26, 0.16, i * 0.16),
        );
        break;
      default:
        break;
    }
  }

  setMining(active: boolean) {
    if (!this.ctx || !this.master) return;
    if (active && !this.mineOsc && !this.settings.muted) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 68;
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.12);
      osc.connect(g).connect(this.master);
      osc.start();
      this.mineOsc = { osc, gain: g };
    } else if (!active && this.mineOsc) {
      const { osc, gain } = this.mineOsc;
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
      osc.stop(this.ctx.currentTime + 0.14);
      this.mineOsc = null;
    }
  }

  destroy() {
    this.setMining(false);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
