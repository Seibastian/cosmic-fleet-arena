/* CosmoWar Arena — oyun motoru: fizik, yapay zeka, çarpışma, render */
import { RACES, WORLD, MAX_LEVEL, drawShipShape, type RaceDef, type Tier } from "./data";

export type UpKey = "speed" | "damage" | "hp" | "firerate" | "regen" | "cargo";
export const UP_KEYS: UpKey[] = ["speed", "damage", "hp", "firerate", "regen", "cargo"];
export const UP_LABELS: Record<UpKey, string> = {
  speed: "Motor",
  damage: "Hasar",
  hp: "Zırh",
  firerate: "Ateş Hızı",
  regen: "Kalkan",
  cargo: "Kargo",
};

interface Ship {
  id: number;
  race: RaceDef;
  isPlayer: boolean;
  name: string;
  level: number;
  xp: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldDelay: number;
  cargo: number;
  fireCooldown: number;
  boost: number;
  thrusting: number;
  boosting: boolean;
  burn: number;
  upPoints: number;
  up: Record<UpKey, number>;
  alive: boolean;
  respawnT: number;
  kills: number;
  score: number;
  tier: Tier;
  radius: number;
  aiTarget: { x: number; y: number } | null;
  aiRepath: number;
  aiState: string;
  wander: number;
  hitFlash: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  raceId: number;
  ownerId: number;
  radius: number;
  homing: number;
  pierce: number;
  burn: number;
  kind: string;
  color: string;
  trail: number[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
  kind: "spark" | "smoke" | "ring" | "debris";
  rot?: number;
}

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rot: number;
  spin: number;
  hp: number;
  shape: number[];
}

interface Resource {
  x: number;
  y: number;
  vx: number;
  vy: number;
  raceId: number;
  amount: number;
  radius: number;
  phase: number;
}

interface Base {
  race: RaceDef;
  x: number;
  y: number;
  radius: number;
  energy: number;
  energyMax: number;
  rot: number;
}

export interface HudState {
  shipName: string;
  raceName: string;
  raceColor: string;
  sizeClass: string;
  level: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  xp: number;
  xpNeed: number;
  cargo: number;
  cargoCap: number;
  boost: number;
  upPoints: number;
  up: Record<UpKey, number>;
  baseEnergy: number;
  resource: string;
  kills: number;
  score: number;
  dead: boolean;
  deathInfo: string;
  killfeed: { id: number; text: string; color: string }[];
  leaderboard: { name: string; color: string; score: number; energy: number }[];
  toast: string | null;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

const BOT_NAMES = [
  "Vex", "Kaan", "Orion", "Nyx", "Draco", "Sera", "Torv", "Ilex", "Bora", "Kyra",
  "Rho", "Zephy", "Mira", "Onyx", "Talas", "Ferra", "Nova", "Ekin", "Vasa", "Ryn",
];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ships: Ship[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  asteroids: Asteroid[] = [];
  resources: Resource[] = [];
  bases: Base[] = [];
  stars: { x: number; y: number; r: number; d: number; tw: number }[] = [];
  nebulas: { x: number; y: number; r: number; c: string }[] = [];
  player!: Ship;
  camera = { x: 0, y: 0, zoom: 1, shake: 0 };
  mouse = { x: 0, y: 0, left: false, right: false };
  keys = new Set<string>();
  running = false;
  time = 0;
  raf = 0;
  last = 0;
  nextId = 1;
  toast: string | null = null;
  toastT = 0;
  killfeed: { id: number; text: string; color: string; t: number }[] = [];
  deathInfo = "";
  onHud: (h: HudState) => void = () => {};
  private hudT = 0;

  constructor(canvas: HTMLCanvasElement, raceId: number) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2D context yok");
    this.ctx = c;
    this.buildWorld();
    const race = RACES[raceId]!;
    this.player = this.makeShip(race, true, "SEN");
    this.ships.push(this.player);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.bindInput();
  }

  /* ---------------- dünya ---------------- */
  buildWorld() {
    this.bases = RACES.map((r) => ({
      race: r,
      x: r.base.x,
      y: r.base.y,
      radius: 190,
      energy: 120,
      energyMax: 1500,
      rot: 0,
    }));

    for (let i = 0; i < 900; i++) {
      this.stars.push({
        x: Math.random() * WORLD,
        y: Math.random() * WORLD,
        r: Math.random() * 1.7 + 0.3,
        d: 0.25 + Math.random() * 0.55,
        tw: Math.random() * TAU,
      });
    }
    for (let i = 0; i < 14; i++) {
      const race = RACES[Math.floor(Math.random() * 4)]!;
      this.nebulas.push({
        x: Math.random() * WORLD,
        y: Math.random() * WORLD,
        r: rand(700, 1900),
        c: race.color,
      });
    }

    for (const z of this.zones()) {
      for (let i = 0; i < 26; i++) for (const rid of z.races) this.spawnResource(z, rid);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU;
        const d = Math.random() * z.r;
        this.spawnAsteroid(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d);
      }
    }
    for (let i = 0; i < 60; i++) this.spawnAsteroid(Math.random() * WORLD, Math.random() * WORLD);

    for (const race of RACES) {
      for (let i = 0; i < 7; i++) {
        const s = this.makeShip(race, false, BOT_NAMES[(race.id * 5 + i) % BOT_NAMES.length]!);
        s.level = 1 + Math.floor(Math.random() * 8);
        this.applyTier(s);
        s.hp = s.maxHp;
        s.shield = s.maxShield;
        this.ships.push(s);
      }
    }
  }

  zones() {
    const h = WORLD / 2;
    return [
      { x: h, y: WORLD * 0.16, r: 620, races: [0, 1] },
      { x: h, y: WORLD * 0.84, r: 620, races: [2, 3] },
      { x: WORLD * 0.16, y: h, r: 620, races: [0, 2] },
      { x: WORLD * 0.84, y: h, r: 620, races: [1, 3] },
      { x: h, y: h, r: 900, races: [0, 1, 2, 3] },
    ];
  }

  spawnResource(z: { x: number; y: number; r: number }, raceId: number) {
    const a = Math.random() * TAU;
    const d = Math.random() * z.r;
    this.resources.push({
      x: z.x + Math.cos(a) * d,
      y: z.y + Math.sin(a) * d,
      vx: rand(-6, 6),
      vy: rand(-6, 6),
      raceId,
      amount: 2 + Math.floor(Math.random() * 4),
      radius: 10,
      phase: Math.random() * TAU,
    });
  }

  spawnAsteroid(x: number, y: number) {
    const radius = rand(26, 82);
    const shape: number[] = [];
    for (let i = 0; i < 11; i++) shape.push(rand(0.72, 1.25));
    this.asteroids.push({
      x, y,
      vx: rand(-14, 14),
      vy: rand(-14, 14),
      radius,
      rot: Math.random() * TAU,
      spin: rand(-0.35, 0.35),
      hp: radius * 3,
      shape,
    });
  }

  /* ---------------- gemiler ---------------- */
  makeShip(race: RaceDef, isPlayer: boolean, name: string): Ship {
    const b = race.base;
    const a = Math.random() * TAU;
    const d = Math.random() * 150;
    const s: Ship = {
      id: this.nextId++,
      race,
      isPlayer,
      name,
      level: 1,
      xp: 0,
      x: b.x + Math.cos(a) * d,
      y: b.y + Math.sin(a) * d,
      vx: 0, vy: 0,
      angle: Math.random() * TAU,
      hp: 1, maxHp: 1, shield: 0, maxShield: 0, shieldDelay: 0,
      cargo: 0, fireCooldown: 0, boost: 100, thrusting: 0, boosting: false, burn: 0,
      upPoints: 0,
      up: { speed: 0, damage: 0, hp: 0, firerate: 0, regen: 0, cargo: 0 },
      alive: true, respawnT: 0, kills: 0, score: 0,
      tier: race.tiers[0]!, radius: 12,
      aiTarget: null, aiRepath: 0, aiState: "mine", wander: Math.random() * TAU, hitFlash: 0,
    };
    this.applyTier(s);
    s.hp = s.maxHp;
    s.shield = s.maxShield;
    return s;
  }

  mul(s: Ship, k: UpKey) { return 1 + s.up[k] * 0.06; }

  applyTier(s: Ship) {
    const tier = s.race.tiers[s.level - 1]!;
    s.tier = tier;
    s.maxHp = Math.round(tier.maxHp * this.mul(s, "hp"));
    s.maxShield = Math.round(tier.maxShield * this.mul(s, "regen"));
    s.radius = tier.radius;
    s.hp = Math.min(s.hp, s.maxHp);
  }

  cargoCap(s: Ship) { return Math.round(s.tier.cargoCap * this.mul(s, "cargo")); }

  /* ---------------- giriş ---------------- */
  bindInput() {
    const c = this.canvas;
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    c.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
  }
  onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
    if (e.key === " ") e.preventDefault();
  };
  onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.045, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.update(dt);
      this.render();
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.08; this.onHud(this.hud()); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* ---------------- güncelleme ---------------- */
  update(dt: number) {
    const p = this.player;
    if (p.alive) {
      const wx = this.camera.x + (this.mouse.x - this.canvas.clientWidth / 2) / this.camera.zoom;
      const wy = this.camera.y + (this.mouse.y - this.canvas.clientHeight / 2) / this.camera.zoom;
      this.steer(p, wx, wy, dt);
      const k = this.keys;
      const wantThrust = this.mouse.right || k.has("w") || k.has("arrowup");
      p.boosting = (k.has("shift") || k.has(" ")) && p.boost > 1 && wantThrust;
      p.thrusting = wantThrust ? 1 : 0;
      if (k.has("s") || k.has("arrowdown")) { p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.4 * dt; }
      if (this.mouse.left) this.fire(p);
    }

    for (const s of this.ships) {
      if (!s.alive) { s.respawnT -= dt; if (s.respawnT <= 0 && !s.isPlayer) this.respawn(s); continue; }
      if (!s.isPlayer) this.ai(s, dt);
      this.physics(s, dt);
      this.mine(s);
      this.deliver(s);
      if (s.fireCooldown > 0) s.fireCooldown -= dt;
      if (s.hitFlash > 0) s.hitFlash -= dt * 4;
      // kalkan yenilenmesi
      s.shieldDelay -= dt;
      if (s.shieldDelay <= 0 && s.shield < s.maxShield) {
        s.shield = Math.min(s.maxShield, s.shield + s.tier.shieldRegen * this.mul(s, "regen") * dt);
      }
      // boost yakıtı
      if (s.boosting) s.boost = Math.max(0, s.boost - 34 * dt);
      else s.boost = Math.min(100, s.boost + 13 * dt);
      if (s.boost <= 0) s.boosting = false;
      // yanma hasarı
      if (s.burn > 0) {
        const d = Math.min(s.burn, 14 * dt);
        s.burn -= d;
        this.damage(s, d, null, true);
        if (Math.random() < 0.5) this.puff(s.x + rand(-s.radius, s.radius), s.y + rand(-s.radius, s.radius), "#ff8a3c");
      }
      // motor izi
      if (s.thrusting > 0 && Math.random() < 0.9) {
        const bx = s.x - Math.cos(s.angle) * s.radius * 1.1;
        const by = s.y - Math.sin(s.angle) * s.radius * 1.1;
        this.particles.push({
          x: bx, y: by,
          vx: -Math.cos(s.angle) * rand(40, 130) + s.vx * 0.3,
          vy: -Math.sin(s.angle) * rand(40, 130) + s.vy * 0.3,
          life: 0.45, maxLife: 0.45, r: s.radius * (s.boosting ? 0.55 : 0.36),
          color: s.boosting ? "#ffffff" : s.race.glow, kind: "smoke",
        });
      }
    }

    this.updateBullets(dt);
    this.updateAsteroids(dt);
    this.updateResources(dt);
    this.updateBases(dt);
    this.updateParticles(dt);
    this.shipCollisions();

    if (Math.random() < 0.9 * dt * 60 * 0.02) {
      const zs = this.zones();
      const z = zs[Math.floor(Math.random() * zs.length)]!;
      const rid = z.races[Math.floor(Math.random() * z.races.length)]!;
      if (this.resources.length < 460) this.spawnResource(z, rid);
    }
    if (this.asteroids.length < 110 && Math.random() < 0.01) {
      this.spawnAsteroid(Math.random() * WORLD, Math.random() * WORLD);
    }

    // kamera
    const target = p.alive ? p : { x: this.camera.x, y: this.camera.y };
    const lead = p.alive ? 0.22 : 0;
    const tx = target.x + p.vx * lead;
    const ty = target.y + p.vy * lead;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 6);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 6);
    const zoomTarget = clamp(1.15 - (p.radius - 11) / 90, 0.62, 1.15);
    this.camera.zoom += (zoomTarget - this.camera.zoom) * Math.min(1, dt * 2);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 26);

    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast = null; }
    for (let i = this.killfeed.length - 1; i >= 0; i--) {
      const kf = this.killfeed[i]!;
      kf.t -= dt;
      if (kf.t <= 0) this.killfeed.splice(i, 1);
    }
  }

  steer(s: Ship, tx: number, ty: number, dt: number) {
    const desired = Math.atan2(ty - s.y, tx - s.x);
    let diff = desired - s.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const max = s.tier.turnRate * dt;
    s.angle += clamp(diff, -max, max);
  }

  physics(s: Ship, dt: number) {
    if (s.thrusting > 0) {
      const boostMul = s.boosting ? 2.1 : 1;
      const a = s.tier.accel * this.mul(s, "speed") * boostMul;
      s.vx += Math.cos(s.angle) * a * dt;
      s.vy += Math.sin(s.angle) * a * dt;
    }
    const maxSpd = s.tier.speed * this.mul(s, "speed") * (s.boosting ? 1.75 : 1);
    const spd = Math.hypot(s.vx, s.vy);
    if (spd > maxSpd) { const k = maxSpd / spd; s.vx *= k; s.vy *= k; }
    const drag = Math.pow(0.55, dt);
    s.vx *= drag + (1 - drag) * 0.985;
    s.vy *= drag + (1 - drag) * 0.985;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // dünya sınırı: yumuşak sekme
    const m = s.radius + 10;
    if (s.x < m) { s.x = m; s.vx = Math.abs(s.vx) * 0.5; }
    if (s.x > WORLD - m) { s.x = WORLD - m; s.vx = -Math.abs(s.vx) * 0.5; }
    if (s.y < m) { s.y = m; s.vy = Math.abs(s.vy) * 0.5; }
    if (s.y > WORLD - m) { s.y = WORLD - m; s.vy = -Math.abs(s.vy) * 0.5; }

    // asteroit çarpışması
    for (const a of this.asteroids) {
      const dx = s.x - a.x, dy = s.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = s.radius + a.radius;
      if (d < min && d > 0) {
        const nx = dx / d, ny = dy / d;
        const push = (min - d);
        s.x += nx * push; s.y += ny * push;
        const vn = s.vx * nx + s.vy * ny;
        if (vn < 0) {
          s.vx -= 1.6 * vn * nx; s.vy -= 1.6 * vn * ny;
          const impact = Math.abs(vn);
          if (impact > 120) this.damage(s, impact * 0.05, null, true);
          this.sparks(s.x - nx * s.radius, s.y - ny * s.radius, 5, "#ffd9a0");
        }
      }
    }
  }

  shipCollisions() {
    for (let i = 0; i < this.ships.length; i++) {
      const a = this.ships[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < this.ships.length; j++) {
        const b = this.ships[j]!;
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d < min && d > 0.001) {
          const nx = dx / d, ny = dy / d;
          const ma = a.tier.mass, mb = b.tier.mass, tot = ma + mb;
          const push = min - d;
          a.x -= nx * push * (mb / tot); a.y -= ny * push * (mb / tot);
          b.x += nx * push * (ma / tot); b.y += ny * push * (ma / tot);
          const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rvn < 0) {
            const imp = (-1.4 * rvn) / (1 / ma + 1 / mb);
            a.vx -= (imp * nx) / ma; a.vy -= (imp * ny) / ma;
            b.vx += (imp * nx) / mb; b.vy += (imp * ny) / mb;
            if (a.race.id !== b.race.id) {
              const dmg = Math.abs(rvn) * 0.05;
              this.damage(a, dmg * (mb / ma), b, false);
              this.damage(b, dmg * (ma / mb), a, false);
              this.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 8, "#fff3c4");
            }
          }
        }
      }
    }
  }

  fire(s: Ship) {
    if (s.fireCooldown > 0) return;
    const w = s.tier.weapon;
    s.fireCooldown = s.tier.fireRate / this.mul(s, "firerate");
    const dmg = s.tier.damage * w.dmgMul * this.mul(s, "damage");
    for (let i = 0; i < w.shots; i++) {
      const off = w.shots === 1 ? 0 : (i / (w.shots - 1) - 0.5) * 2;
      const ang = s.angle + off * w.spread + rand(-0.015, 0.015);
      const px = s.x + Math.cos(s.angle) * s.radius * 0.9 - Math.sin(s.angle) * off * s.radius * 0.5;
      const py = s.y + Math.sin(s.angle) * s.radius * 0.9 + Math.cos(s.angle) * off * s.radius * 0.5;
      this.bullets.push({
        x: px, y: py,
        vx: Math.cos(ang) * w.speed + s.vx * 0.35,
        vy: Math.sin(ang) * w.speed + s.vy * 0.35,
        dmg, life: w.life, raceId: s.race.id, ownerId: s.id,
        radius: w.radius, homing: w.homing, pierce: w.pierce,
        burn: w.burn * this.mul(s, "damage"), kind: w.kind,
        color: s.race.glow, trail: [],
      });
    }
    // geri tepme
    s.vx -= Math.cos(s.angle) * 12 * (w.dmgMul / s.tier.mass);
    s.vy -= Math.sin(s.angle) * 12 * (w.dmgMul / s.tier.mass);
    this.particles.push({
      x: s.x + Math.cos(s.angle) * s.radius, y: s.y + Math.sin(s.angle) * s.radius,
      vx: 0, vy: 0, life: 0.09, maxLife: 0.09, r: s.radius * 0.55, color: s.race.glow, kind: "ring",
    });
    if (s.isPlayer) this.camera.shake = Math.min(9, this.camera.shake + w.dmgMul * 0.9);
  }

  updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      if (b.homing > 0) {
        let best: Ship | null = null, bd = 700;
        for (const s of this.ships) {
          if (!s.alive || s.race.id === b.raceId) continue;
          const d = Math.hypot(s.x - b.x, s.y - b.y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best) {
          const want = Math.atan2(best.y - b.y, best.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const na = cur + clamp(diff, -b.homing * dt, b.homing * dt);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
      b.trail.push(b.x, b.y);
      if (b.trail.length > 10) b.trail.splice(0, 2);
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

      let dead = b.life <= 0;
      if (!dead) {
        for (const s of this.ships) {
          if (!s.alive || s.race.id === b.raceId || s.id === b.ownerId) continue;
          if (Math.hypot(s.x - b.x, s.y - b.y) < s.radius + b.radius) {
            const owner = this.ships.find((o) => o.id === b.ownerId) ?? null;
            this.damage(s, b.dmg, owner, false);
            s.burn += b.burn;
            this.sparks(b.x, b.y, 7, b.color);
            if (b.pierce > 0) b.pierce--;
            else dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const a of this.asteroids) {
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius) {
            a.hp -= b.dmg;
            this.sparks(b.x, b.y, 5, "#c9a882");
            dead = true;
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  updateAsteroids(dt: number) {
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i]!;
      a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.spin * dt;
      if (a.x < a.radius || a.x > WORLD - a.radius) a.vx *= -1;
      if (a.y < a.radius || a.y > WORLD - a.radius) a.vy *= -1;
      if (a.hp <= 0) {
        this.explosion(a.x, a.y, a.radius * 0.9, "#d9b98c");
        for (let k = 0; k < 3; k++) {
          const rid = Math.floor(Math.random() * 4);
          this.resources.push({
            x: a.x + rand(-20, 20), y: a.y + rand(-20, 20),
            vx: rand(-40, 40), vy: rand(-40, 40),
            raceId: rid, amount: 2, radius: 10, phase: Math.random() * TAU,
          });
        }
        this.asteroids.splice(i, 1);
      }
    }
  }

  updateResources(dt: number) {
    for (const r of this.resources) {
      r.x += r.vx * dt; r.y += r.vy * dt;
      r.vx *= 0.99; r.vy *= 0.99;
      r.phase += dt * 2;
      r.x = clamp(r.x, 20, WORLD - 20);
      r.y = clamp(r.y, 20, WORLD - 20);
    }
  }

  updateBases(dt: number) {
    for (const base of this.bases) {
      base.rot += dt * 0.15;
      base.energy = Math.max(0, base.energy - 2 * dt);
      for (const s of this.ships) {
        if (!s.alive || s.race.id === base.race.id) continue;
        const d = Math.hypot(s.x - base.x, s.y - base.y);
        if (d < base.radius + 220 && base.energy > 5) {
          base.energy -= 12 * dt;
          this.damage(s, 42 * dt, null, true);
          if (Math.random() < 0.25) {
            this.particles.push({
              x: base.x, y: base.y, vx: (s.x - base.x) * 2, vy: (s.y - base.y) * 2,
              life: 0.16, maxLife: 0.16, r: 3, color: base.race.glow, kind: "spark",
            });
          }
        }
        // dost gemilere kalkan/onarım
      }
      for (const s of this.ships) {
        if (!s.alive || s.race.id !== base.race.id) continue;
        if (Math.hypot(s.x - base.x, s.y - base.y) < base.radius) {
          s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.12 * dt);
          s.boost = Math.min(100, s.boost + 26 * dt);
        }
      }
    }
  }

  updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      if (p.rot !== undefined) p.rot += dt * 4;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.particles.length > 1400) this.particles.splice(0, this.particles.length - 1400);
  }

  /* ---------------- hasar / ölüm ---------------- */
  damage(s: Ship, amount: number, from: Ship | null, silent: boolean) {
    if (!s.alive || amount <= 0) return;
    s.shieldDelay = 1.6;
    s.hitFlash = 1;
    if (s.shield > 0) {
      const abs = Math.min(s.shield, amount);
      s.shield -= abs;
      amount -= abs;
    }
    s.hp -= amount;
    if (!silent && s.isPlayer) this.camera.shake = Math.min(16, this.camera.shake + amount * 0.25);
    if (s.hp <= 0) this.kill(s, from);
  }

  kill(s: Ship, killer: Ship | null) {
    s.alive = false;
    s.respawnT = s.isPlayer ? 999 : 4;
    this.explosion(s.x, s.y, s.radius * 2.2, s.race.glow);
    for (let i = 0; i < Math.min(8, 3 + s.level / 3); i++) {
      this.resources.push({
        x: s.x + rand(-30, 30), y: s.y + rand(-30, 30),
        vx: rand(-90, 90), vy: rand(-90, 90),
        raceId: s.race.id, amount: 2, radius: 10, phase: 0,
      });
    }
    if (killer && killer.alive) {
      killer.kills++;
      killer.score += 40 + s.level * 18;
      this.grantXp(killer, 45 + s.level * 22);
    }
    const text = killer ? `${killer.name} ⟶ ${s.name}` : `${s.name} yok edildi`;
    this.killfeed.unshift({
      id: Math.random(), text,
      color: killer ? killer.race.color : "#8ea0bd", t: 6,
    });
    if (this.killfeed.length > 6) this.killfeed.pop();
    if (s.isPlayer) {
      this.deathInfo = killer
        ? `${killer.name} (${killer.race.name}) seni yok etti. Seviye ${s.level} · ${s.kills} kill`
        : `Çevresel hasar seni yok etti. Seviye ${s.level} · ${s.kills} kill`;
      this.camera.shake = 24;
    }
  }

  respawn(s: Ship) {
    const b = s.race.base;
    s.alive = true;
    s.x = b.x + rand(-120, 120);
    s.y = b.y + rand(-120, 120);
    s.vx = 0; s.vy = 0; s.cargo = 0; s.burn = 0; s.boost = 100;
    s.level = Math.max(1, s.level - 2);
    s.xp = 0;
    this.applyTier(s);
    s.hp = s.maxHp;
    s.shield = s.maxShield;
  }

  playerRespawn() { this.respawn(this.player); this.deathInfo = ""; }

  grantXp(s: Ship, amount: number) {
    s.score += Math.round(amount * 0.4);
    if (s.level >= MAX_LEVEL) return;
    s.xp += amount;
    while (s.xp >= s.tier.xpToNext && s.level < MAX_LEVEL) {
      s.xp -= s.tier.xpToNext;
      s.level++;
      this.applyTier(s);
      s.hp = s.maxHp;
      s.shield = s.maxShield;
      s.upPoints += 3;
      if (s.isPlayer) {
        this.toast = `${s.tier.name} · Seviye ${s.level}`;
        this.toastT = 2.4;
        this.explosion(s.x, s.y, s.radius * 2.4, s.race.glow);
      }
    }
  }

  spendUpgrade(k: UpKey) {
    const p = this.player;
    if (p.upPoints <= 0 || p.up[k] >= 12) return;
    p.upPoints--;
    p.up[k]++;
    this.applyTier(p);
  }

  /* ---------------- madencilik ---------------- */
  mine(s: Ship) {
    const cap = this.cargoCap(s);
    if (s.cargo >= cap) return;
    for (let i = this.resources.length - 1; i >= 0; i--) {
      const r = this.resources[i]!;
      if (r.raceId !== s.race.id) continue;
      const d = Math.hypot(r.x - s.x, r.y - s.y);
      if (d < s.radius + 130) {
        // çekim ışını
        const pull = 260 / Math.max(40, d);
        r.vx += ((s.x - r.x) / d) * pull * 26 * 0.016;
        r.vy += ((s.y - r.y) / d) * pull * 26 * 0.016;
      }
      if (d < s.radius + r.radius) {
        const take = Math.min(r.amount, cap - s.cargo);
        s.cargo += take;
        r.amount -= take;
        this.grantXp(s, take * 5);
        this.sparks(r.x, r.y, 8, s.race.glow);
        if (r.amount <= 0) this.resources.splice(i, 1);
        if (s.cargo >= cap) return;
      }
    }
  }

  deliver(s: Ship) {
    if (s.cargo <= 0) return;
    const b = this.bases[s.race.id]!;
    if (Math.hypot(s.x - b.x, s.y - b.y) < b.radius) {
      b.energy = Math.min(b.energyMax, b.energy + s.cargo * 30);
      this.grantXp(s, s.cargo * 16);
      s.score += s.cargo * 6;
      this.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, r: b.radius, color: b.race.glow, kind: "ring" });
      s.cargo = 0;
    }
  }

  /* ---------------- yapay zeka ---------------- */
  ai(s: Ship, dt: number) {
    s.aiRepath -= dt;
    const enemy = this.nearestEnemy(s, s.level > 8 ? 1100 : 700);
    const cap = this.cargoCap(s);
    const lowHp = s.hp < s.maxHp * 0.28;

    if (lowHp) {
      s.aiState = "kaç";
      const b = this.bases[s.race.id]!;
      this.steer(s, b.x, b.y, dt);
      s.thrusting = 1;
      s.boosting = s.boost > 20;
      return;
    }
    if (enemy) {
      s.aiState = "savaş";
      const d = Math.hypot(enemy.x - s.x, enemy.y - s.y);
      const w = s.tier.weapon;
      const lead = d / w.speed;
      const px = enemy.x + enemy.vx * lead;
      const py = enemy.y + enemy.vy * lead;
      const ideal = s.race.weapon === "flak" ? 220 : s.race.weapon === "slug" ? 620 : 420;
      if (d < ideal * 0.6) {
        // geri çekilerek dönüş yap
        this.steer(s, px, py, dt);
        s.thrusting = 0;
      } else {
        this.steer(s, px + Math.cos(s.wander + this.time) * 60, py + Math.sin(s.wander + this.time) * 60, dt);
        s.thrusting = 1;
      }
      s.boosting = d > 700 && s.boost > 35;
      const want = Math.atan2(py - s.y, px - s.x);
      let diff = Math.abs(want - s.angle);
      if (diff > Math.PI) diff = TAU - diff;
      if (diff < 0.22 && d < w.speed * w.life * 0.9) this.fire(s);
      return;
    }
    if (s.cargo >= cap) {
      s.aiState = "teslim";
      const b = this.bases[s.race.id]!;
      this.steer(s, b.x, b.y, dt);
      s.thrusting = 1;
      s.boosting = s.boost > 60;
      return;
    }
    if (!s.aiTarget || s.aiRepath <= 0) {
      const r = this.nearestResource(s);
      s.aiTarget = r ? { x: r.x, y: r.y } : { x: rand(0, WORLD), y: rand(0, WORLD) };
      s.aiRepath = 1.6;
    }
    s.aiState = "maden";
    this.steer(s, s.aiTarget.x, s.aiTarget.y, dt);
    s.thrusting = 1;
    s.boosting = false;
  }

  nearestEnemy(s: Ship, range: number): Ship | null {
    let best: Ship | null = null, bd = range;
    for (const o of this.ships) {
      if (!o.alive || o.race.id === s.race.id) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  nearestResource(s: Ship): Resource | null {
    let best: Resource | null = null, bd = Infinity;
    for (const r of this.resources) {
      if (r.raceId !== s.race.id) continue;
      const d = Math.hypot(r.x - s.x, r.y - s.y);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  /* ---------------- efektler ---------------- */
  sparks(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rand(60, 320);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.15, 0.4), maxLife: 0.4, r: rand(1, 2.6), color, kind: "spark",
      });
    }
  }
  puff(x: number, y: number, color: string) {
    this.particles.push({ x, y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.4, maxLife: 0.4, r: rand(4, 10), color, kind: "smoke" });
  }
  explosion(x: number, y: number, size: number, color: string) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.55, maxLife: 0.55, r: size * 2.2, color, kind: "ring" });
    this.sparks(x, y, 26, color);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU, sp = rand(20, 150);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.5, 1.1), maxLife: 1.1, r: rand(size * 0.2, size * 0.5),
        color: i % 3 === 0 ? "#ffd07a" : color, kind: "smoke",
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU, sp = rand(60, 260);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.6, 1.3), maxLife: 1.3, r: rand(2, size * 0.16), color, kind: "debris", rot: Math.random() * TAU,
      });
    }
    if (Math.hypot(x - this.player.x, y - this.player.y) < 900) {
      this.camera.shake = Math.min(20, this.camera.shake + size * 0.14);
    }
  }

  /* ---------------- render ---------------- */
  render() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#0a1020");
    bg.addColorStop(1, "#03050b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const shake = this.camera.shake;
    const ox = rand(-shake, shake), oy = rand(-shake, shake);
    const z = this.camera.zoom;
    const camX = this.camera.x + ox, camY = this.camera.y + oy;

    // nebulalar (paralaks)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const n of this.nebulas) {
      const sx = W / 2 + (n.x - camX) * z * 0.35;
      const sy = H / 2 + (n.y - camY) * z * 0.35;
      const rr = n.r * z;
      if (sx < -rr || sx > W + rr || sy < -rr || sy > H + rr) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, n.c + "26");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // yıldızlar
    ctx.save();
    for (const s of this.stars) {
      const sx = W / 2 + (s.x - camX) * z * s.d;
      const sy = H / 2 + (s.y - camY) * z * s.d;
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(this.time * 0.8 + s.tw)) * 0.6 * s.d;
      ctx.fillStyle = "#dfe9ff";
      ctx.fillRect(sx, sy, s.r, s.r);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-camX, -camY);

    this.drawGrid(ctx, camX, camY, W / z, H / z);
    this.drawZones(ctx);
    this.drawBases(ctx);
    this.drawAsteroids(ctx);
    this.drawResources(ctx);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawParticles(ctx);
    this.drawBullets(ctx);
    ctx.restore();

    this.drawShips(ctx);
    ctx.restore();

    this.drawEdgeMarkers(ctx, W, H);
  }

  drawGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, vw: number, vh: number) {
    const step = 500;
    const x0 = Math.floor((cx - vw / 2) / step) * step;
    const x1 = cx + vw / 2;
    const y0 = Math.floor((cy - vh / 2) / step) * step;
    const y1 = cy + vh / 2;
    ctx.strokeStyle = "rgba(120,170,255,.055)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,90,60,.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD, WORLD);
  }

  drawZones(ctx: CanvasRenderingContext2D) {
    for (const z of this.zones()) {
      const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
      g.addColorStop(0, "rgba(255,255,255,.035)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.setLineDash([18, 22]);
      ctx.strokeStyle = "rgba(180,210,255,.14)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, this.time * 0.05, this.time * 0.05 + TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawBases(ctx: CanvasRenderingContext2D) {
    for (const b of this.bases) {
      ctx.save();
      ctx.translate(b.x, b.y);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.radius * 1.6);
      g.addColorStop(0, b.race.color + "3a");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, b.radius * 1.6, 0, TAU); ctx.fill();

      ctx.rotate(b.rot);
      ctx.strokeStyle = b.race.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = b.race.color;
      ctx.shadowBlur = 24;
      for (let ring = 0; ring < 3; ring++) {
        const rr = b.radius * (0.45 + ring * 0.28);
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * TAU + ring * 0.3;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.35 + ring * 0.2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.rotate(-b.rot);
      // çekirdek
      ctx.beginPath(); ctx.arc(0, 0, b.radius * 0.22, 0, TAU);
      ctx.fillStyle = b.race.glow; ctx.fill();
      ctx.shadowBlur = 0;

      // enerji halkası
      ctx.beginPath();
      ctx.arc(0, 0, b.radius + 14, -Math.PI / 2, -Math.PI / 2 + TAU * (b.energy / b.energyMax));
      ctx.strokeStyle = "#ffcf4d";
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = b.race.color;
      ctx.font = "bold 20px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.race.name.toUpperCase() + " ÜSSÜ", 0, -b.radius - 34);
      ctx.restore();
    }
  }

  drawAsteroids(ctx: CanvasRenderingContext2D) {
    for (const a of this.asteroids) {
      if (!this.inView(a.x, a.y, a.radius + 60)) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      for (let i = 0; i < a.shape.length; i++) {
        const ang = (i / a.shape.length) * TAU;
        const rr = a.radius * a.shape[i]!;
        const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(-a.radius, -a.radius, a.radius, a.radius);
      g.addColorStop(0, "#4a4038");
      g.addColorStop(0.5, "#6b5c4c");
      g.addColorStop(1, "#2a241f");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(190,170,140,.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#1a1512";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(Math.cos(i * 2.1) * a.radius * 0.4, Math.sin(i * 3.3) * a.radius * 0.4, a.radius * 0.16, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawResources(ctx: CanvasRenderingContext2D) {
    for (const r of this.resources) {
      if (!this.inView(r.x, r.y, 40)) continue;
      const race = RACES[r.raceId]!;
      const pulse = 1 + Math.sin(this.time * 3 + r.phase) * 0.16;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.phase * 0.4 + this.time * 0.6);
      ctx.shadowColor = race.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      const rr = r.radius * pulse;
      ctx.moveTo(0, -rr * 1.4);
      ctx.lineTo(rr, 0);
      ctx.lineTo(0, rr * 1.4);
      ctx.lineTo(-rr, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(-rr, -rr, rr, rr);
      g.addColorStop(0, race.glow);
      g.addColorStop(1, race.color);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.bullets) {
      if (!this.inView(b.x, b.y, 60)) continue;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.radius * 1.5;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      if (b.trail.length >= 4) {
        ctx.moveTo(b.trail[0]!, b.trail[1]!);
        for (let i = 2; i < b.trail.length; i += 2) ctx.lineTo(b.trail[i]!, b.trail[i + 1]!);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.2, 0, TAU);
      ctx.fillStyle = b.color + "55";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (!this.inView(p.x, p.y, p.r + 60)) continue;
      const k = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = k;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * k + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.2 - k), 0, TAU);
        ctx.stroke();
      } else if (p.kind === "smoke") {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (2 - k));
        g.addColorStop(0, p.color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.globalAlpha = k * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - k), 0, TAU); ctx.fill();
      } else if (p.kind === "debris") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawShips(ctx: CanvasRenderingContext2D) {
    for (const s of this.ships) {
      if (!s.alive || !this.inView(s.x, s.y, s.radius * 4 + 60)) continue;
      ctx.save();
      ctx.translate(s.x, s.y);

      // kalkan kabuğu
      if (s.shield > 0.5) {
        const k = s.shield / s.maxShield;
        ctx.save();
        ctx.globalAlpha = 0.14 + k * 0.22 + (s.hitFlash > 0 ? 0.3 : 0);
        ctx.strokeStyle = s.race.glow;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = s.race.glow;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * 1.55, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(s.angle);
      // itki alevi
      if (s.thrusting > 0) {
        const len = s.radius * (s.boosting ? 2.6 : 1.5) * (0.8 + Math.random() * 0.45);
        const g = ctx.createLinearGradient(-s.radius, 0, -s.radius - len, 0);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.35, s.race.glow);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.6, s.radius * 0.34);
        ctx.lineTo(-s.radius - len, 0);
        ctx.lineTo(-s.radius * 0.6, -s.radius * 0.34);
        ctx.closePath();
        ctx.fill();
      }
      drawShipShape(ctx, s.tier.sizeClass, s.radius, s.race.color, s.race.dark, s.race.glow, this.time + s.id);
      if (s.hitFlash > 0) {
        ctx.globalAlpha = s.hitFlash * 0.6;
        ctx.beginPath(); ctx.arc(0, 0, s.radius * 1.2, 0, TAU);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // etiket + can barı
      ctx.save();
      ctx.translate(s.x, s.y - s.radius * 1.9 - 16);
      const w = Math.max(44, s.radius * 3);
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(-w / 2, 0, w, 5);
      ctx.fillStyle = s.hp / s.maxHp > 0.35 ? "#5dff9c" : "#ff5a5a";
      ctx.fillRect(-w / 2, 0, w * clamp(s.hp / s.maxHp, 0, 1), 5);
      if (s.maxShield > 0) {
        ctx.fillStyle = s.race.glow;
        ctx.fillRect(-w / 2, -6, w * clamp(s.shield / s.maxShield, 0, 1), 3);
      }
      ctx.font = "600 13px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = s.isPlayer ? "#ffffff" : s.race.color;
      ctx.fillText(`${s.name} · ${s.level}`, 0, -12);
      ctx.restore();
    }
  }

  drawEdgeMarkers(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const p = this.player;
    if (!p.alive) return;
    for (const b of this.bases) {
      const dx = b.x - this.camera.x, dy = b.y - this.camera.y;
      const sx = W / 2 + dx * this.camera.zoom;
      const sy = H / 2 + dy * this.camera.zoom;
      if (sx > 40 && sx < W - 40 && sy > 40 && sy < H - 40) continue;
      const a = Math.atan2(dy, dx);
      const rx = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 46);
      const ry = H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 46);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(a);
      ctx.fillStyle = b.race.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-7, 6); ctx.lineTo(-7, -6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  inView(x: number, y: number, pad: number) {
    const z = this.camera.zoom;
    const halfW = this.canvas.clientWidth / 2 / z + pad;
    const halfH = this.canvas.clientHeight / 2 / z + pad;
    return Math.abs(x - this.camera.x) < halfW && Math.abs(y - this.camera.y) < halfH;
  }

  renderMinimap(mm: HTMLCanvasElement) {
    const c = mm.getContext("2d");
    if (!c) return;
    const size = mm.width;
    const k = size / WORLD;
    c.clearRect(0, 0, size, size);
    c.fillStyle = "rgba(8,12,22,.75)";
    c.fillRect(0, 0, size, size);
    for (const z of this.zones()) {
      c.strokeStyle = "rgba(255,255,255,.08)";
      c.beginPath(); c.arc(z.x * k, z.y * k, z.r * k, 0, TAU); c.stroke();
    }
    for (const b of this.bases) {
      c.fillStyle = b.race.color;
      c.globalAlpha = 0.25;
      c.beginPath(); c.arc(b.x * k, b.y * k, b.radius * k * 2.2, 0, TAU); c.fill();
      c.globalAlpha = 1;
      c.fillRect(b.x * k - 3, b.y * k - 3, 6, 6);
    }
    c.globalAlpha = 0.6;
    for (const r of this.resources) {
      c.fillStyle = RACES[r.raceId]!.color;
      c.fillRect(r.x * k, r.y * k, 1.4, 1.4);
    }
    c.globalAlpha = 1;
    for (const s of this.ships) {
      if (!s.alive) continue;
      c.fillStyle = s.isPlayer ? "#ffffff" : s.race.color;
      c.beginPath(); c.arc(s.x * k, s.y * k, s.isPlayer ? 3.2 : 1.7, 0, TAU); c.fill();
    }
    const vw = (this.canvas.clientWidth / this.camera.zoom) * k;
    const vh = (this.canvas.clientHeight / this.camera.zoom) * k;
    c.strokeStyle = "rgba(255,255,255,.45)";
    c.lineWidth = 1;
    c.strokeRect(this.camera.x * k - vw / 2, this.camera.y * k - vh / 2, vw, vh);
  }

  hud(): HudState {
    const p = this.player;
    const board = RACES.map((r) => {
      const fleet = this.ships.filter((s) => s.race.id === r.id);
      return {
        name: r.name,
        color: r.color,
        score: fleet.reduce((a, s) => a + s.score, 0),
        energy: this.bases[r.id]!.energy / this.bases[r.id]!.energyMax,
      };
    }).sort((a, b) => b.score - a.score);
    return {
      shipName: p.tier.name,
      raceName: p.race.name,
      raceColor: p.race.color,
      sizeClass: p.tier.sizeClass,
      level: p.level,
      hp: Math.max(0, p.hp),
      maxHp: p.maxHp,
      shield: Math.max(0, p.shield),
      maxShield: p.maxShield,
      xp: p.xp,
      xpNeed: p.tier.xpToNext,
      cargo: p.cargo,
      cargoCap: this.cargoCap(p),
      boost: p.boost,
      upPoints: p.upPoints,
      up: { ...p.up },
      baseEnergy: this.bases[p.race.id]!.energy / this.bases[p.race.id]!.energyMax,
      resource: p.race.resource,
      kills: p.kills,
      score: p.score,
      dead: !p.alive,
      deathInfo: this.deathInfo,
      killfeed: this.killfeed.map((k) => ({ id: k.id, text: k.text, color: k.color })),
      leaderboard: board,
      toast: this.toast,
    };
  }
}
