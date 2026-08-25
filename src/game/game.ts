/* CosmoWar Arena — istemci denetleyicisi: sabit zaman adımı döngüsü, girdi soyutlaması,
   sim ↔ render ↔ ses olay dağıtımı. Sim katmanı buraya bağımlı değildir. */
import { emptyCmd, SESSION_TIME, Sim, type Cmd, type HudState } from "./sim";
import { Renderer } from "./renderer";
import { AudioEngine } from "./audio";
import { SYSTEM_ORDER, type SysKey } from "./systems";
import type { UpKey } from "./data";
import { pushTelemetry, type Settings, type TelemetryRow } from "./persist";

const STEP = 1 / 60;
const KEY_UPGRADES: Record<string, UpKey> = {
  "1": "speed",
  "2": "damage",
  "3": "hp",
  "4": "firerate",
  "5": "regen",
  "6": "cargo",
};
const killLog: TelemetryRow[] = [];

export interface GameCallbacks {
  onHud: (h: HudState) => void;
  onEnded: (stats: {
    score: number;
    kills: number;
    won: boolean;
    raceId: number;
    timeSurvived: number;
  }) => void;
  onPauseChange: (paused: boolean) => void;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private mm: HTMLCanvasElement | null = null;
  sim: Sim;
  renderer: Renderer;
  audio = new AudioEngine();
  private cb: GameCallbacks;
  private raf = 0;
  private running = false;
  private last = 0;
  private acc = 0;
  private hudT = 0;
  paused = false;

  private mouse = { x: 0, y: 0, left: false, right: false };
  private keys = new Set<string>();
  private sysQueue: SysKey[] = [];
  private cmd: Cmd = emptyCmd();
  private ended = false;
  private startTime = performance.now();

  constructor(
    canvas: HTMLCanvasElement,
    raceId: number,
    seed: number,
    settings: Settings,
    cb: GameCallbacks,
  ) {
    this.canvas = canvas;
    this.cb = cb;
    this.sim = new Sim(seed, raceId, settings.colorblind);
    this.renderer = new Renderer(canvas);
    this.renderer.setPalette(settings.colorblind);
    this.renderer.camera.x = this.sim.player.x;
    this.renderer.camera.y = this.sim.player.y;
    this.audio.setSettings({ volume: settings.volume, muted: settings.muted });
    this.renderer.settings = {
      shake: settings.shake,
      bloom: settings.bloom,
      particles: settings.particles,
    };
    this.bindInput();
  }

  attachMinimap(mm: HTMLCanvasElement) {
    this.mm = mm;
  }

  applySettings(s: Settings) {
    this.audio.setSettings({ volume: s.volume, muted: s.muted });
    this.renderer.setPalette(s.colorblind);
    this.renderer.settings = { shake: s.shake, bloom: s.bloom, particles: s.particles };
  }

  /* ---------------- girdi ---------------- */
  private bindInput() {
    const c = this.canvas;
    c.addEventListener("mousemove", this.onMove);
    c.addEventListener("mousedown", this.onDown);
    addEventListener("mouseup", this.onUp);
    c.addEventListener("contextmenu", this.onCtx);
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    c.addEventListener("blur", this.onBlur);
    this.sim.onKill = (kr, vr, kl, vl) => {
      if (kr >= 0 && vr >= 0)
        killLog.push({ t: Date.now(), killerRace: kr, victimRace: vr, killerLv: kl, victimLv: vl });
      if (killLog.length > 60) {
        pushTelemetry(killLog.splice(0, killLog.length));
      }
    };
  }

  private onMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
  };
  private onDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = true;
    if (e.button === 2) this.mouse.right = true;
    this.audio.resume();
  };
  private onUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = false;
    if (e.button === 2) this.mouse.right = false;
  };
  private onCtx = (e: Event) => e.preventDefault();
  private onBlur = () => {
    this.keys.clear();
    this.mouse.left = false;
    this.mouse.right = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === " ") e.preventDefault();
    const sysKeys: Record<string, SysKey> = { q: "shield", f: "blink", c: "trap", x: "gas" };
    if (this.sim.player.pendingBranch) {
      if (k === "1") {
        this.chooseBranch(0);
        return;
      }
      if (k === "2") {
        this.chooseBranch(1);
        return;
      }
    } else if (KEY_UPGRADES[k]) {
      this.spendUpgrade(KEY_UPGRADES[k]!);
    }
    if (sysKeys[k]) this.sysQueue.push(sysKeys[k]!);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    c.removeEventListener("mousemove", this.onMove);
    c.removeEventListener("mousedown", this.onDown);
    removeEventListener("mouseup", this.onUp);
    c.removeEventListener("contextmenu", this.onCtx);
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    c.removeEventListener("blur", this.onBlur);
    this.audio.destroy();
  }

  /* ---------------- oturum eylemleri ---------------- */
  spendUpgrade(k: UpKey) {
    this.sim.spendUpgrade(k);
  }
  spendSystem(k: SysKey): string | null {
    return this.sim.spendSystem(k);
  }
  chooseBranch(i: number) {
    this.sim.chooseBranch(i);
  }
  upgradeBase() {
    return this.sim.upgradeBase();
  }
  playerRespawn() {
    this.sim.playerRespawn();
  }
  setPaused(p: boolean) {
    this.paused = p;
    this.cb.onPauseChange(p);
  }
  togglePaused() {
    this.setPaused(!this.paused);
  }

  /* ---------------- döngü ---------------- */
  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const frameDt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) {
        this.buildCmd();
        const scale = this.sim.player.pendingBranch ? 0.22 : 1;
        this.acc += frameDt * scale;
        let steps = 0;
        while (this.acc >= STEP && steps < 6) {
          this.sim.update(STEP);
          this.acc -= STEP;
          steps++;
        }
        this.drainEvents();
      }
      this.renderer.render(this.sim, this.paused ? 0 : frameDt);
      if (this.mm) this.renderer.renderMinimap(this.mm, this.sim);
      this.hudT -= frameDt;
      if (this.hudT <= 0) {
        this.hudT = 0.08;
        this.cb.onHud(this.sim.hud());
        this.checkEnded();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private buildCmd() {
    const world = this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
    this.cmd.ax = world.x;
    this.cmd.ay = world.y;
    const k = this.keys;
    this.cmd.thrust = this.mouse.right || k.has("w") || k.has("arrowup");
    this.cmd.brake = k.has("s") || k.has("arrowdown");
    this.cmd.boost = (k.has("shift") || k.has(" ")) && this.cmd.thrust;
    this.cmd.fire = this.mouse.left;
    this.cmd.mineHold = k.has("e");
    const nextUse = this.sysQueue.shift();
    this.cmd.use = nextUse ?? null;
    if (!nextUse) this.cmd.use = null;
    this.sim.setPlayerCmd({ ...this.cmd });
  }

  private drainEvents() {
    const evs = this.sim.takeEvents();
    if (evs.length === 0) return;
    const p = this.sim.player;
    for (const e of evs) {
      this.renderer.handleEvent(e, this.renderer.pal);
      const ex = e.x ?? p.x,
        ey = e.y ?? p.y;
      const d = Math.min(1, Math.hypot(ex - p.x, ey - p.y) / 900);
      this.audio.play(e.type, 1 - d, e.raceId ?? p.raceId);
    }
    this.renderer.addShake(this.sim.shakeReq);
    this.sim.shakeReq = 0;
    this.audio.setMining(this.sim.player.alive && this.sim.player.beamTargets.length > 0);
  }

  private checkEnded() {
    if (this.ended) return;
    const h = this.sim.hud();
    if (h.ended) {
      this.ended = true;
      if (killLog.length > 0) pushTelemetry(killLog.splice(0, killLog.length));
      this.audio.play("win", 0, this.sim.player.raceId);
      this.cb.onEnded({
        score: h.score,
        kills: h.kills,
        won: h.ended.winner === this.sim.player.raceId,
        raceId: this.sim.player.raceId,
        timeSurvived: Math.max(0, SESSION_TIME - h.roundLeft),
      });
    }
  }

  get roundTime() {
    return SESSION_TIME;
  }
  get systemOrder() {
    return SYSTEM_ORDER;
  }
}
