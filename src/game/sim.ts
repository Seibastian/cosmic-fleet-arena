/* CosmoWar Arena — simülasyon çekirdeği: deterministik, headless çalışabilir.
   Render/ses/DOM buraya sızmaz; dış dünya ile sadece Cmd girişi ve GameEvent çıkışı üzerinden konuşur. */
import { RNG, SpatialHash, TAU, clamp, angDiff, type GameEvent } from "./core";
import {
  WORLD,
  MAX_LEVEL,
  RACES,
  BOT_NAMES,
  BASE_STAGES,
  BRANCH_LEVELS,
  baseStageOf,
  baseUpgradeCost,
  branchOptions,
  getTier,
  DEFENSE_COSTS,
  type RaceDef,
  type Tier,
  type UpKey,
  type CBMode,
  type ResType,
  type DefenseType,
} from "./data";
import { SYSTEMS, SYSTEM_ORDER, type SysKey } from "./systems";

export const SESSION_TIME = 720;
const BRANCH_TIMEOUT = 12;

export interface Cmd {
  ax: number;
  ay: number;
  thrust: boolean;
  brake: boolean;
  boost: boolean;
  fire: boolean;
  mineHold: boolean;
  use: SysKey | null;
}

export function emptyCmd(): Cmd {
  return {
    ax: 0,
    ay: 0,
    thrust: false,
    brake: false,
    boost: false,
    fire: false,
    mineHold: false,
    use: null,
  };
}

interface SysState {
  lv: number;
  cd: number;
}

interface Ship {
  id: number;
  race: RaceDef;
  raceId: number;
  isPlayer: boolean;
  name: string;
  role: "hunt" | "mine" | "guard";
  pathKey: string;
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
  anti: number;
  channelT: number;
  channelTarget: Resource | null;
  fireCd: number;
  boost: number;
  thrusting: number;
  boosting: boolean;
  burn: number;
  slowT: number;
  stunT: number;
  blindT: number;
  overT: number;
  invulnT: number;
  comboN: number;
  comboT: number;
  plates: number;
  plateT: number;
  burstT: number;
  burstCd: number;
  nearWater: boolean;
  starTouched: boolean;
  mining: boolean;
  beamTargets: Resource[];
  upPoints: number;
  up: Record<UpKey, number>;
  sys: Record<SysKey, SysState>;
  pendingBranch: { opts: { id: string; name: string; desc: string }[]; t: number } | null;
  alive: boolean;
  respawnT: number;
  kills: number;
  score: number;
  tier: Tier;
  radius: number;
  aiTargetX: number;
  aiTargetY: number;
  aiRepath: number;
  aiState: string;
  wander: number;
  hitFlash: number;
  deadT: number;
  shieldPierce: boolean;
  bank: number;
  pierceOwned: boolean;
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
  splash: number;
  trail: number[];
  shieldPierce: boolean;
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
  anti: boolean;
  resType: ResType;
}

interface Trap {
  x: number;
  y: number;
  raceId: number;
  ownerId: number;
  life: number;
  armT: number;
  dmg: number;
  r: number;
}
interface GasCloud {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  targetR: number;
  raceId: number;
  life: number;
  maxLife: number;
  dps: number;
}
interface Star {
  x: number;
  y: number;
  r: number;
  rot: number;
}
interface Hole {
  x: number;
  y: number;
  r: number;
  pullR: number;
  rot: number;
}

interface Base {
  raceId: number;
  x: number;
  y: number;
  radius: number;
  energy: number;
  energyMax: number;
  rot: number;
  level: number;
  pool: number;
  lastHitBy: number;
  alive: boolean;
}

interface DefenseStructure {
  id: number;
  raceId: number;
  x: number;
  y: number;
  type: DefenseType;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  angle: number;
  fireCd: number;
  radius: number;
}

export interface Standing {
  raceId: number;
  name: string;
  color: string;
  score: number;
  baseLv: number;
  alive: boolean;
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
  baseLv: number;
  baseStage: string;
  basePool: number;
  baseCost: number;
  resource: string;
  kills: number;
  score: number;
  anti: number;
  roundLeft: number;
  sys: Record<SysKey, { lv: number; cd: number; cdMax: number; locked: boolean }>;
  dead: boolean;
  deathInfo: string;
  killfeed: { id: number; text: string; color: string }[];
  leaderboard: Standing[];
  toast: string | null;
  lowHp: number;
  pendingBranch: { opts: { id: string; name: string; desc: string }[]; t: number } | null;
  ended: { winner: number; reason: string; standings: Standing[] } | null;
  shieldPierce: boolean;
  pierceOwned: boolean;
  bank: number;
  defenses: { type: DefenseType; hp: number; maxHp: number; shield: number; maxShield: number }[];
  canBuild: boolean;
  buildCost: number;
  aliveTeams: { name: string; color: string; alive: boolean }[];
}

const rand01 = Math.random;

export class Sim {
  seed: number;
  rng: RNG;
  ships: Ship[] = [];
  bullets: Bullet[] = [];
  asteroids: Asteroid[] = [];
  resources: Resource[] = [];
  traps: Trap[] = [];
  gases: GasCloud[] = [];
  stars: Star[] = [];
  holes: Hole[] = [];
  bases: Base[] = [];
  structures: DefenseStructure[] = [];
  starsBg: { x: number; y: number; r: number; d: number; tw: number }[] = [];
  nebulas: { x: number; y: number; r: number; c: string }[] = [];
  player!: Ship;
  time = 0;
  nextId = 1;
  toast: string | null = null;
  toastT = 0;
  killfeed: { id: number; text: string; color: string; t: number }[] = [];
  deathInfo = "";
  session = { t: SESSION_TIME, phase: "live" as "live" | "ended", winner: -1, reason: "time" };
  onKill:
    ((killerRace: number, victimRace: number, killerLv: number, victimLv: number) => void) | null =
    null;
  private events: GameEvent[] = [];
  private shipGrid = new SpatialHash<Ship>(240);
  private resGrid = new SpatialHash<Resource>(240);
  private astGrid = new SpatialHash<Asteroid>(320);
  private qShip: Ship[] = [];
  private qShipB: Ship[] = [];
  private qRes: Resource[] = [];
  private qAst: Asteroid[] = [];

  constructor(seed: number, playerRaceId: number, cbMode: CBMode = "none") {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.buildWorld(cbMode);
    const race = RACES[playerRaceId]!;
    this.player = this.makeShip(race, true, "SEN");
    this.ships.push(this.player);
  }

  /* ---------------- olay kuyruğu ---------------- */
  private ev(e: GameEvent) {
    if (this.events.length < 400) this.events.push(e);
  }
  takeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /* ---------------- dünya ---------------- */
  buildWorld(_cb: CBMode) {
    const rng = this.rng;
    this.bases = RACES.map((r) => ({
      raceId: r.id,
      x: r.base.x,
      y: r.base.y,
      radius: 190,
      energy: 420,
      energyMax: 1270,
      rot: 0,
      level: 1,
      pool: 0,
      lastHitBy: -1,
      alive: true,
    }));

    for (let i = 0; i < 900; i++) {
      this.starsBg.push({
        x: rng.next() * WORLD,
        y: rng.next() * WORLD,
        r: rng.range(0.3, 2),
        d: rng.range(0.25, 0.8),
        tw: rng.angle(),
      });
    }
    for (let i = 0; i < 14; i++) {
      const race = RACES[rng.int(0, 3)]!;
      this.nebulas.push({
        x: rng.next() * WORLD,
        y: rng.next() * WORLD,
        r: rng.range(700, 1900),
        c: race.color,
      });
    }

    this.stars = [
      { x: WORLD * 0.5, y: WORLD * 0.06, r: 340, rot: 0 },
      { x: WORLD * 0.06, y: WORLD * 0.52, r: 300, rot: 1 },
      { x: WORLD * 0.94, y: WORLD * 0.48, r: 320, rot: 2 },
    ];
    this.holes = [
      { x: WORLD * 0.35, y: WORLD * 0.32, r: 60, pullR: 520, rot: 0 },
      { x: WORLD * 0.66, y: WORLD * 0.68, r: 70, pullR: 560, rot: 1 },
      { x: WORLD * 0.5, y: WORLD * 0.5, r: 85, pullR: 680, rot: 2 },
    ];

    for (let i = 0; i < 70; i++)
      this.spawnAsteroid(rng.range(200, WORLD - 200), rng.range(200, WORLD - 200));
    for (let i = 0; i < 130; i++)
      this.spawnAnti(rng.range(300, WORLD - 300), rng.range(300, WORLD - 300), false);
    for (const z of this.zones()) {
      for (let i = 0; i < 26; i++)
        for (const rid of z.races) this.spawnResource(z.x, z.y, z.r, rid, "stellar");
    }
    for (const st of this.stars) {
      for (let i = 0; i < 18; i++) {
        const a = rng.angle();
        const d = rng.range(st.r * 1.2, st.r * 3.2);
        this.resources.push({
          x: st.x + Math.cos(a) * d,
          y: st.y + Math.sin(a) * d,
          vx: rng.range(-4, 4),
          vy: rng.range(-4, 4),
          raceId: -1,
          amount: 2 + Math.floor(rng.next() * 3),
          radius: 11,
          phase: rng.angle(),
          anti: false,
          resType: "solar",
        });
      }
    }
    for (const h of this.holes) {
      for (let i = 0; i < 12; i++) {
        const a = rng.angle();
        const d = rng.range(h.r * 2, h.r * 6);
        this.resources.push({
          x: h.x + Math.cos(a) * d,
          y: h.y + Math.sin(a) * d,
          vx: rng.range(-3, 3),
          vy: rng.range(-3, 3),
          raceId: -1,
          amount: 2 + Math.floor(rng.next() * 3),
          radius: 13,
          phase: rng.angle(),
          anti: false,
          resType: "dark",
        });
      }
    }

    for (const race of RACES) {
      for (let i = 0; i < 7; i++) {
        const s = this.makeShip(race, false, BOT_NAMES[(race.id * 5 + i) % BOT_NAMES.length]!);
        s.level = 1 + Math.floor(rng.next() * 8);
        this.applyTier(s);
        this.autoBranch(s);
        s.hp = s.maxHp;
        s.shield = s.maxShield;
        this.ships.push(s);
      }
    }
  }

  zones() {
    const h = WORLD / 2;
    return [
      { x: h, y: WORLD * 0.22, r: 620, races: [0, 1] },
      { x: h, y: WORLD * 0.78, r: 620, races: [2, 3] },
      { x: WORLD * 0.22, y: h, r: 620, races: [0, 2] },
      { x: WORLD * 0.78, y: h, r: 620, races: [1, 3] },
      { x: h, y: h, r: 900, races: [0, 1, 2, 3] },
    ];
  }

  spawnResource(
    x: number,
    y: number,
    spreadR: number,
    raceId: number,
    resType: ResType = "mineral",
  ) {
    const a = this.rng.angle();
    const d = this.rng.next() * spreadR;
    this.resources.push({
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d,
      vx: this.rng.range(-6, 6),
      vy: this.rng.range(-6, 6),
      raceId,
      amount: 2 + Math.floor(this.rng.next() * 4),
      radius: 10,
      phase: this.rng.angle(),
      anti: false,
      resType,
    });
  }

  spawnAnti(x: number, y: number, _burst: boolean) {
    this.resources.push({
      x,
      y,
      vx: rand01() * 8 - 4,
      vy: rand01() * 8 - 4,
      raceId: -1,
      amount: 1,
      radius: 12,
      phase: rand01() * TAU,
      anti: true,
      resType: "dark",
    });
  }

  spawnAsteroid(x: number, y: number) {
    const radius = this.rng.range(26, 82);
    const shape: number[] = [];
    for (let i = 0; i < 11; i++) shape.push(this.rng.range(0.72, 1.25));
    this.asteroids.push({
      x,
      y,
      vx: this.rng.range(-14, 14),
      vy: this.rng.range(-14, 14),
      radius,
      rot: this.rng.angle(),
      spin: this.rng.range(-0.35, 0.35),
      hp: radius * 3,
      shape,
    });
  }

  /* ---------------- gemiler ---------------- */
  makeShip(race: RaceDef, isPlayer: boolean, name: string): Ship {
    const b = race.base;
    const a = this.rng.angle();
    const d = this.rng.next() * 150;
    const roll = this.rng.next();
    const role = isPlayer ? "hunt" : roll < 0.55 ? "hunt" : roll < 0.85 ? "mine" : "guard";
    const s: Ship = {
      id: this.nextId++,
      race,
      raceId: race.id,
      isPlayer,
      name,
      role,
      pathKey: "",
      level: 1,
      xp: 0,
      x: b.x + Math.cos(a) * d,
      y: b.y + Math.sin(a) * d,
      vx: 0,
      vy: 0,
      angle: a,
      hp: 1,
      maxHp: 1,
      shield: 0,
      maxShield: 0,
      shieldDelay: 0,
      cargo: 0,
      anti: 0,
      channelT: 0,
      channelTarget: null,
      fireCd: 0,
      boost: 100,
      thrusting: 0,
      boosting: false,
      burn: 0,
      slowT: 0,
      stunT: 0,
      blindT: 0,
      overT: 0,
      invulnT: 1.2,
      comboN: 0,
      comboT: 0,
      plates: 0,
      plateT: 0,
      burstT: 0,
      burstCd: 0,
      nearWater: false,
      starTouched: false,
      mining: false,
      beamTargets: [],
      upPoints: 0,
      up: { speed: 0, damage: 0, hp: 0, firerate: 0, regen: 0, cargo: 0 },
      sys: {
        mine: { lv: 0, cd: 0 },
        shield: { lv: 0, cd: 0 },
        turbo: { lv: 0, cd: 0 },
        blink: { lv: 0, cd: 0 },
        trap: { lv: 0, cd: 0 },
        gas: { lv: 0, cd: 0 },
      },
      pendingBranch: null,
      alive: true,
      respawnT: 0,
      kills: 0,
      score: 0,
      tier: undefined as unknown as Tier,
      radius: 12,
      aiTargetX: b.x,
      aiTargetY: b.y,
      aiRepath: 0,
      aiState: "maden",
      wander: this.rng.angle(),
      hitFlash: 0,
      deadT: 0,
      shieldPierce: false,
      bank: 0,
      pierceOwned: false,
    };
    this.syncSystems(s);
    this.applyTier(s);
    s.hp = s.maxHp;
    s.shield = s.maxShield;
    return s;
  }

  syncSystems(s: Ship) {
    for (const k of SYSTEM_ORDER) {
      const def = SYSTEMS[k];
      const st = s.sys[k];
      st.lv = s.level >= def.unlockLv ? Math.max(1, st.lv) : 0;
    }
  }

  mul(s: Ship, k: UpKey) {
    return 1 + s.up[k] * 0.06;
  }
  baseMul(s: Ship) {
    const lv = this.bases[s.raceId]!.level;
    return { hp: 1 + (lv - 1) * 0.02, dmg: 1 + (lv - 1) * 0.015, sh: 1 + (lv - 1) * 0.012 };
  }
  turboMul(s: Ship) {
    const lv = s.sys.turbo.lv;
    return { spd: 1 + lv * 0.06, acc: 1 + lv * 0.08 };
  }
  effShieldMax(s: Ship) {
    return s.overT > 0 ? s.maxShield * (1.3 + s.sys.shield.lv * 0.1) : s.maxShield;
  }

  applyTier(s: Ship) {
    const tier = getTier(s.raceId, s.pathKey, s.level);
    s.tier = tier;
    const bm = this.baseMul(s);
    s.maxHp = Math.round(tier.maxHp * bm.hp * this.mul(s, "hp"));
    s.maxShield = Math.round(tier.maxShield * bm.sh * this.mul(s, "regen"));
    s.radius = tier.radius;
    s.hp = Math.min(s.hp, s.maxHp);
  }

  cargoCap(s: Ship) {
    return Math.round(s.tier.cargoCap * this.mul(s, "cargo"));
  }

  /* ---------------- dal seçimi ---------------- */
  private offerBranch(s: Ship) {
    const [a, b] = branchOptions(s.pathKey);
    if (s.isPlayer) {
      s.pendingBranch = {
        opts: [
          { id: a.id, name: a.name, desc: a.desc },
          { id: b.id, name: b.name, desc: b.desc },
        ],
        t: BRANCH_TIMEOUT,
      };
    } else {
      const pick = s.role === "hunt" ? a : s.role === "mine" ? b : this.rng.pick([a, b]);
      this.doChoose(s, pick.id);
    }
  }

  private doChoose(s: Ship, id: string) {
    s.pathKey = s.pathKey ? `${s.pathKey}.${id}` : id;
    s.pendingBranch = null;
    this.applyTier(s);
    s.hp = s.maxHp;
    s.shield = this.effShieldMax(s);
    if (s.isPlayer) {
      this.toast = `${s.tier.name} · Seviye ${s.level}`;
      this.toastT = 2.6;
      this.ev({ type: "evolve", x: s.x, y: s.y, raceId: s.raceId, size: s.radius });
    }
  }

  chooseBranch(idx: number): boolean {
    const p = this.player;
    if (!p.pendingBranch) return false;
    const opt = p.pendingBranch.opts[idx];
    if (!opt) return false;
    this.doChoose(p, opt.id);
    return true;
  }

  private autoBranch(s: Ship) {
    const depth = (pk: string) => (pk ? pk.split(".").length : 0);
    while (depth(s.pathKey) < 4 && s.level >= BRANCH_LEVELS[depth(s.pathKey)]!) {
      const [a, b] = branchOptions(s.pathKey);
      const pick = s.role === "hunt" ? a : s.role === "mine" ? b : this.rng.pick([a, b]);
      this.doChoose(s, pick.id);
      if (!s.alive) break;
    }
  }

  /* ---------------- girdi ---------------- */
  private playerCmd: Cmd = emptyCmd();
  setPlayerCmd(c: Cmd) {
    this.playerCmd = c;
  }

  /* ---------------- ana güncelleme ---------------- */
  update(dt: number) {
    if (this.session.phase === "ended") {
      this.time += dt;
      return;
    }
    this.time += dt;

    if (this.player.pendingBranch) {
      this.player.pendingBranch.t -= dt;
      if (this.player.pendingBranch.t <= 0) this.chooseBranch(0);
    }

    for (const base of this.bases) base.rot += dt * 0.15;
    for (const h of this.holes) h.rot -= dt * 0.6;
    for (const st of this.stars) st.rot += dt * 0.05;

    this.shipGrid.clear();
    for (const s of this.ships) if (s.alive) this.shipGrid.insert(s);
    this.resGrid.clear();
    for (const r of this.resources) this.resGrid.insert(r);
    this.astGrid.clear();
    for (const a of this.asteroids) this.astGrid.insert(a);

    for (const s of this.ships) {
      if (!s.alive) {
        s.respawnT -= dt;
        if (s.respawnT <= 0 && !s.isPlayer && this.bases[s.raceId]!.alive) this.respawn(s);
        continue;
      }
      const cmd = s.isPlayer ? this.playerCmd : this.aiCmd(s, dt);
      this.control(s, cmd, dt);
      this.physics(s, dt);
      this.mineStep(s, cmd.mineHold, dt);
      this.deliver(s);
      this.systemTick(s, cmd, dt);
      this.statusTick(s, dt);

      if (s.fireCd > 0) s.fireCd -= dt;
      if (cmd.fire) this.fire(s);
      if (s.hitFlash > 0) s.hitFlash -= dt * 4;
      if (s.invulnT > 0) s.invulnT -= dt;
      if (s.comboT > 0) {
        s.comboT -= dt;
        if (s.comboT <= 0) s.comboN = 0;
      }
      if (s.plateT > 0) {
        s.plateT -= dt;
        if (s.plateT <= 0) s.plates = 0;
      }
      if (s.burstT > 0) s.burstT -= dt;
      if (s.burstCd > 0) s.burstCd -= dt;
      if (s.slowT > 0) s.slowT -= dt;
      if (s.stunT > 0) s.stunT -= dt;
      if (s.blindT > 0) s.blindT -= dt;
      if (s.overT > 0) s.overT -= dt;
    }

    this.waterAuras(dt);
    this.updateBullets(dt);
    this.updateTraps(dt);
    this.updateGases(dt);
    this.updateField(dt);
    this.updateAsteroids(dt);
    this.updateResources(dt);
    this.updateBases(dt);
    this.updateStructures(dt);
    this.shipCollisions();
    this.checkDomination();

    if (this.resources.length < 560 && this.rng.next() < 0.04) {
      const zs = this.zones();
      const z = zs[Math.floor(this.rng.next() * zs.length)]!;
      const rid = z.races[Math.floor(this.rng.next() * z.races.length)]!;
      this.spawnResource(z.x, z.y, z.r, rid, "stellar");
    }
    if (this.rng.next() < 0.008) {
      const st = this.stars[Math.floor(this.rng.next() * this.stars.length)]!;
      const a = this.rng.angle();
      const d = this.rng.range(st.r * 1.2, st.r * 3.2);
      this.resources.push({
        x: st.x + Math.cos(a) * d,
        y: st.y + Math.sin(a) * d,
        vx: this.rng.range(-3, 3),
        vy: this.rng.range(-3, 3),
        raceId: -1,
        amount: 2 + Math.floor(this.rng.next() * 2),
        radius: 11,
        phase: this.rng.angle(),
        anti: false,
        resType: "solar",
      });
    }
    if (this.rng.next() < 0.006) {
      const h = this.holes[Math.floor(this.rng.next() * this.holes.length)]!;
      const a = this.rng.angle();
      const d = this.rng.range(h.r * 2, h.r * 6);
      this.resources.push({
        x: h.x + Math.cos(a) * d,
        y: h.y + Math.sin(a) * d,
        vx: this.rng.range(-2, 2),
        vy: this.rng.range(-2, 2),
        raceId: -1,
        amount: 2 + Math.floor(this.rng.next() * 2),
        radius: 13,
        phase: this.rng.angle(),
        anti: false,
        resType: "dark",
      });
    }
    if (this.asteroids.length < 110 && this.rng.next() < 0.008) {
      this.spawnAsteroid(this.rng.range(100, WORLD - 100), this.rng.range(100, WORLD - 100));
    }

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toast = null;
    }
    for (let i = this.killfeed.length - 1; i >= 0; i--) {
      const kf = this.killfeed[i]!;
      kf.t -= dt;
      if (kf.t <= 0) this.killfeed.splice(i, 1);
    }

    const lowBase =
      this.bases[this.player.raceId]!.energy / this.bases[this.player.raceId]!.energyMax < 0.2;
    if (lowBase && Math.random() < dt * 0.2) this.ev({ type: "alarm", raceId: this.player.raceId });
    if (
      this.player.alive &&
      this.player.hp / this.player.maxHp < 0.25 &&
      Math.random() < dt * 0.5
    ) {
      this.ev({ type: "lowhp", raceId: this.player.raceId });
    }
  }

  endSession(reason: string) {
    if (this.session.phase === "ended") return;
    this.session.phase = "ended";
    this.session.reason = reason;
    if (reason === "domination") {
      const alive = this.bases.filter((b) => b.alive);
      if (alive.length === 1) this.session.winner = alive[0]!.raceId;
    }
    this.ev({ type: "domination", text: reason });
  }
  private control(s: Ship, cmd: Cmd, dt: number) {
    if (s.stunT > 0) {
      s.thrusting = 0;
      s.boosting = false;
      return;
    }
    const desired = Math.atan2(cmd.ay - s.y, cmd.ax - s.x);
    const diff = angDiff(desired, s.angle);
    const turnMul = 1;
    const max = s.tier.turnRate * (s.burstT > 0 ? 1.45 : 1) * turnMul * dt;
    s.angle += clamp(diff, -max, max);

    s.thrusting = cmd.thrust ? 1 : 0;
    s.boosting = cmd.boost && cmd.thrust && s.boost > 1;
    if (cmd.brake) {
      s.vx *= 1 - 1.4 * dt;
      s.vy *= 1 - 1.4 * dt;
    }
  }

  private statusTick(s: Ship, dt: number) {
    s.shieldDelay -= dt;
    const effMax = this.effShieldMax(s);
    if (s.shieldDelay <= 0 && s.shield < effMax) {
      let regen = s.tier.shieldRegen * this.mul(s, "regen");
      if (s.nearWater) regen *= 1.25;
      if (s.starTouched) regen *= 2.2;
      s.shield = Math.min(effMax, s.shield + regen * dt);
    }
    if (s.overT <= 0 && s.shield > s.maxShield) s.shield = s.maxShield;
    s.nearWater = false;
    s.starTouched = false;

    if (s.boosting) s.boost = Math.max(0, s.boost - (34 - s.sys.turbo.lv * 2) * dt);
    else s.boost = Math.min(100, s.boost + 13 * dt);
    if (s.boost <= 0) s.boosting = false;

    if (s.burn > 0) {
      const d = Math.min(s.burn, 14 * dt);
      s.burn -= d;
      this.damage(s, d, null, true);
    }
  }

  physics(s: Ship, dt: number) {
    const tm = this.turboMul(s);
    if (s.thrusting > 0) {
      const boostMul = s.boosting ? 2.1 : 1;
      const a = s.tier.accel * this.mul(s, "speed") * tm.acc * boostMul;
      s.vx += Math.cos(s.angle) * a * dt;
      s.vy += Math.sin(s.angle) * a * dt;
    }
    const slowK = s.slowT > 0 ? 0.55 : 1;
    const mineK = s.mining ? 0.7 : 1;
    const maxSpd =
      s.tier.speed *
      this.mul(s, "speed") *
      tm.spd *
      slowK *
      mineK *
      (s.burstT > 0 ? 1.45 : 1) *
      (s.boosting ? 1.75 : 1);
    s.mining = false;
    const spd = Math.hypot(s.vx, s.vy);
    if (spd > maxSpd) {
      const k = maxSpd / spd;
      s.vx *= k;
      s.vy *= k;
    }
    const drag = Math.pow(0.55, dt);
    s.vx *= drag + (1 - drag) * 0.985;
    s.vy *= drag + (1 - drag) * 0.985;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    const m = s.radius + 10;
    if (s.x < m) {
      s.x = m;
      s.vx = Math.abs(s.vx) * 0.5;
    }
    if (s.x > WORLD - m) {
      s.x = WORLD - m;
      s.vx = -Math.abs(s.vx) * 0.5;
    }
    if (s.y < m) {
      s.y = m;
      s.vy = Math.abs(s.vy) * 0.5;
    }
    if (s.y > WORLD - m) {
      s.y = WORLD - m;
      s.vy = -Math.abs(s.vy) * 0.5;
    }

    const near = this.astGrid.query(s.x, s.y, s.radius + 100, this.qAst);
    for (const a of near) {
      const dx = s.x - a.x,
        dy = s.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = s.radius + a.radius;
      if (d < min && d > 0) {
        const nx = dx / d,
          ny = dy / d;
        const push = min - d;
        s.x += nx * push;
        s.y += ny * push;
        const vn = s.vx * nx + s.vy * ny;
        if (vn < 0) {
          if (!(s.boosting && s.sys.turbo.lv >= 3)) {
            s.vx -= 1.6 * vn * nx;
            s.vy -= 1.6 * vn * ny;
            const impact = Math.abs(vn);
            if (impact > 120) this.damage(s, impact * 0.05, null, true);
          }
          this.ev({ type: "hit", x: s.x - nx * s.radius, y: s.y - ny * s.radius, pitch: 2 });
        }
      }
    }
  }

  shipCollisions() {
    for (const a of this.ships) {
      if (!a.alive) continue;
      const near = this.shipGrid.query(a.x, a.y, a.radius + 140, this.qShip);
      for (const b of near) {
        if (b.id <= a.id || !b.alive) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d < min && d > 0.001) {
          const nx = dx / d,
            ny = dy / d;
          const ma = a.tier.mass,
            mb = b.tier.mass,
            tot = ma + mb;
          const push = min - d;
          a.x -= nx * push * (mb / tot);
          a.y -= ny * push * (mb / tot);
          b.x += nx * push * (ma / tot);
          b.y += ny * push * (ma / tot);
          const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rvn < 0) {
            const imp = (-1.4 * rvn) / (1 / ma + 1 / mb);
            const ramA = a.boosting && a.sys.turbo.lv >= 5;
            const ramB = b.boosting && b.sys.turbo.lv >= 5;
            a.vx -= (imp * nx) / ma;
            a.vy -= (imp * ny) / ma;
            b.vx += (imp * nx) / mb;
            b.vy += (imp * ny) / mb;
            if (a.raceId !== b.raceId) {
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              const dmg = Math.abs(rvn) * 0.05;
              if (!ramA) this.damage(a, dmg * (mb / ma), b, false);
              if (!ramB) this.damage(b, dmg * (ma / mb), a, false);
              if (ramA) this.damage(b, 26 + a.sys.turbo.lv * 6, a, false);
              if (ramB) this.damage(a, 26 + b.sys.turbo.lv * 6, b, false);
              this.ev({ type: "hit", x: mid.x, y: mid.y, pitch: 1 });
            }
          }
        }
      }
    }
  }

  /* ---------------- silahlar ---------------- */
  fire(s: Ship) {
    if (s.fireCd > 0) return;
    const w = s.tier.weapon;
    s.fireCd = s.tier.fireRate / this.mul(s, "firerate");
    const bm = this.baseMul(s);
    const comboBonus =
      s.race.weapon === "flak" ? 1 + s.comboN * 0.03 : s.comboN > 0 ? 1 + s.comboN * 0.015 : 1;
    const dmg = s.tier.damage * w.dmgMul * this.mul(s, "damage") * bm.dmg * comboBonus;
    for (let i = 0; i < w.shots; i++) {
      const off = w.shots === 1 ? 0 : (i / (w.shots - 1) - 0.5) * 2;
      const ang = s.angle + off * w.spread + (rand01() - 0.5) * 0.03;
      const px =
        s.x + Math.cos(s.angle) * s.radius * 0.9 - Math.sin(s.angle) * off * s.radius * 0.5;
      const py =
        s.y + Math.sin(s.angle) * s.radius * 0.9 + Math.cos(s.angle) * off * s.radius * 0.5;
      this.bullets.push({
        x: px,
        y: py,
        vx: Math.cos(ang) * w.speed + s.vx * 0.35,
        vy: Math.sin(ang) * w.speed + s.vy * 0.35,
        dmg,
        life: w.life,
        raceId: s.raceId,
        ownerId: s.id,
        radius: w.radius,
        homing: w.homing,
        pierce: w.pierce,
        burn: w.burn * this.mul(s, "damage"),
        kind: w.kind,
        splash: w.splash,
        trail: [],
        shieldPierce: s.shieldPierce,
      });
    }
    s.vx -= Math.cos(s.angle) * 12 * (w.dmgMul / s.tier.mass);
    s.vy -= Math.sin(s.angle) * 12 * (w.dmgMul / s.tier.mass);
    this.ev({
      type: "fire",
      x: s.x,
      y: s.y,
      raceId: s.raceId,
      size: s.radius,
      pitch: w.kind === "slug" ? 0.7 : w.kind === "torpedo" ? 0.85 : 1,
    });
    if (s.isPlayer && w.dmgMul > 1) this.shakeReq = Math.min(9, this.shakeReq + w.dmgMul * 0.9);
  }
  shakeReq = 0;

  updateBullets(dt: number) {
    const B = this.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]!;
      if (b.homing > 0) {
        let best: Ship | null = null,
          bd = 700;
        const near = this.shipGrid.query(b.x, b.y, bd, this.qShip);
        for (const s of near) {
          if (!s.alive || s.raceId === b.raceId || s.invulnT > 0) continue;
          const d = Math.hypot(s.x - b.x, s.y - b.y);
          if (d < bd) {
            bd = d;
            best = s;
          }
        }
        if (best) {
          const want = Math.atan2(best.y - b.y, best.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const diff = angDiff(want, cur);
          const na = cur + clamp(diff, -b.homing * dt, b.homing * dt);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
      b.trail.push(b.x, b.y);
      if (b.trail.length > 10) b.trail.splice(0, 2);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD;
      if (!dead) {
        const near = this.shipGrid.query(b.x, b.y, 160, this.qShip);
        for (const s of near) {
          if (!s.alive || s.raceId === b.raceId || s.id === b.ownerId || s.invulnT > 0) continue;
          if (Math.hypot(s.x - b.x, s.y - b.y) < s.radius + b.radius) {
            const owner = this.ships.find((o) => o.id === b.ownerId) ?? null;
            this.damage(s, b.dmg, owner, false, b.shieldPierce);
            s.burn += b.burn;
            if (owner) {
              owner.comboN = Math.min(8, owner.comboN + 1);
              owner.comboT = 2.5;
            }
            if (b.splash > 0) {
              const area = this.shipGrid.query(b.x, b.y, b.splash, this.qShipB);
              for (const o of area) {
                if (o === s || !o.alive || o.raceId === b.raceId || o.invulnT > 0) continue;
                const dd = Math.hypot(o.x - b.x, o.y - b.y);
                if (dd < b.splash) this.damage(o, b.dmg * 0.55 * (1 - dd / b.splash), owner, false);
              }
            }
            this.ev({ type: "hit", x: b.x, y: b.y, raceId: b.raceId });
            if (b.pierce > 0) b.pierce--;
            else dead = true;
            break;
          }
        }
      }
      if (!dead) {
        const base = this.baseAt(b.x, b.y, b.raceId);
        if (base) {
          this.hitBase(base, b.dmg * 0.5, b.raceId);
          this.ev({ type: "basehit", x: b.x, y: b.y, raceId: b.raceId });
          dead = true;
        }
      }
      if (!dead) {
        const nearAst = this.astGrid.query(b.x, b.y, 120, this.qAst);
        for (const a of nearAst) {
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius) {
            a.hp -= b.dmg;
            this.ev({ type: "hit", x: b.x, y: b.y, raceId: b.raceId, pitch: 1.6 });
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        B[i] = B[B.length - 1]!;
        B.pop();
      }
    }
    if (B.length > 900) B.splice(0, B.length - 900);
  }

  baseAt(x: number, y: number, attackerRace: number): Base | null {
    for (const base of this.bases) {
      if (!base.alive || base.raceId === attackerRace) continue;
      if (Math.hypot(base.x - x, base.y - y) < base.radius) return base;
    }
    return null;
  }

  hitBase(base: Base, dmg: number, byRace: number) {
    if (!base.alive) return;
    base.energy -= dmg;
    base.lastHitBy = byRace;
    if (base.energy <= 0 && this.session.phase === "live") {
      base.alive = false;
      base.energy = 0;
      this.ev({ type: "explode", x: base.x, y: base.y, raceId: base.raceId, size: 300 });
      for (const s of this.ships) {
        if (s.alive && s.raceId === base.raceId) {
          this.kill(s, null);
        }
      }
      if (base.raceId === this.player.raceId) {
        this.session.winner = byRace >= 0 ? byRace : -1;
        this.endSession("eliminated");
      }
    }
  }

  /* ---------------- hakimiyet ---------------- */
  checkDomination() {
    if (this.session.phase !== "live") return;
    const aliveBases = this.bases.filter((b) => b.alive);
    if (aliveBases.length <= 1) {
      this.endSession("domination");
    }
  }

  /* ---------------- savunma yapıları ---------------- */
  buildDefense(type: DefenseType): string | null {
    const p = this.player;
    const base = this.bases[p.raceId]!;
    if (!base.alive) return "Üs yok edildi";
    const d = Math.hypot(p.x - base.x, p.y - base.y);
    if (d > base.radius + 300) return "Üse çok uzak";
    const cost = DEFENSE_COSTS[type];
    if (p.bank < cost.resources) return `Hammadde yetersiz (${cost.resources} gerekli)`;
    const angle = Math.atan2(p.y - base.y, p.x - base.x);
    const buildDist = base.radius + 120;
    const sx = base.x + Math.cos(angle) * buildDist;
    const sy = base.y + Math.sin(angle) * buildDist;
    for (const st of this.structures) {
      if (st.raceId === p.raceId && Math.hypot(st.x - sx, st.y - sy) < 60) return "Çok yakın";
    }
    p.bank -= cost.resources;
    this.structures.push({
      id: this.nextId++,
      raceId: p.raceId,
      x: sx,
      y: sy,
      type,
      hp: cost.hp,
      maxHp: cost.hp,
      shield: cost.shield,
      maxShield: cost.shield,
      angle,
      fireCd: 0,
      radius: type === "fortress" ? 32 : type === "shield" ? 28 : 22,
    });
    this.ev({ type: "baseup", x: sx, y: sy, raceId: p.raceId });
    return null;
  }

  updateStructures(dt: number) {
    for (let i = this.structures.length - 1; i >= 0; i--) {
      const st = this.structures[i]!;
      if (st.type === "shield" && st.shield < st.maxShield) {
        st.shield = Math.min(st.maxShield, st.shield + 4 * dt);
      }
      if (st.type === "fortress") {
        st.fireCd -= dt;
        if (st.fireCd <= 0) {
          let nearest: Ship | null = null;
          let nearDist = 380;
          const near = this.shipGrid.query(st.x, st.y, nearDist, this.qShip);
          for (const s of near) {
            if (!s.alive || s.raceId === st.raceId || s.invulnT > 0) continue;
            const dd = Math.hypot(s.x - st.x, s.y - st.y);
            if (dd < nearDist) {
              nearDist = dd;
              nearest = s;
            }
          }
          if (nearest) {
            const ang = Math.atan2(nearest.y - st.y, nearest.x - st.x);
            st.angle = ang;
            st.fireCd = 1.2;
            this.bullets.push({
              x: st.x + Math.cos(ang) * st.radius,
              y: st.y + Math.sin(ang) * st.radius,
              vx: Math.cos(ang) * 520,
              vy: Math.sin(ang) * 520,
              dmg: 22,
              life: 1.4,
              raceId: st.raceId,
              ownerId: -1,
              radius: 3,
              homing: 0,
              pierce: 0,
              burn: 0,
              kind: "pulse",
              splash: 0,
              trail: [],
              shieldPierce: false,
            });
            this.ev({ type: "fire", x: st.x, y: st.y, raceId: st.raceId });
          }
        }
      }
      let dead = false;
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi]!;
        if (b.raceId === st.raceId) continue;
        if (Math.hypot(b.x - st.x, b.y - st.y) < st.radius + b.radius) {
          let hitDmg = b.dmg;
          if (st.shield > 0 && !b.shieldPierce) {
            const abs = Math.min(st.shield, hitDmg);
            st.shield -= abs;
            hitDmg -= abs;
          }
          st.hp -= hitDmg;
          this.ev({ type: "defensehit", x: b.x, y: b.y, raceId: st.raceId });
          if (b.pierce > 0) b.pierce--;
          else {
            this.bullets.splice(bi, 1);
          }
          if (st.hp <= 0) {
            this.ev({ type: "explode", x: st.x, y: st.y, raceId: st.raceId, size: st.radius * 2 });
            dead = true;
            break;
          }
        }
      }
      if (dead) this.structures.splice(i, 1);
    }
    for (const st of this.structures) {
      const near = this.shipGrid.query(st.x, st.y, st.radius + 80, this.qShip);
      for (const s of near) {
        if (!s.alive || s.raceId === st.raceId) continue;
        if (Math.hypot(s.x - st.x, s.y - st.y) < st.radius + s.radius) {
          const dx = s.x - st.x,
            dy = s.y - st.y;
          const dd = Math.hypot(dx, dy) || 1;
          s.x += (dx / dd) * 4;
          s.y += (dy / dd) * 4;
          if (st.type === "shield") {
            s.vx *= 0.6;
            s.vy *= 0.6;
            s.slowT = Math.max(s.slowT, 0.3);
          }
        }
      }
    }
  }

  /* ---------------- hasar / ölüm ---------------- */
  damage(s: Ship, amount: number, from: Ship | null, silent: boolean, shieldPierce = false) {
    if (!s.alive || amount <= 0 || s.invulnT > 0) return;
    s.shieldDelay = 1.6;
    s.hitFlash = 1;

    if (s.raceId === 3 && from) {
      s.comboN = Math.min(8, s.comboN + 1);
    }
    if (s.raceId === 2) {
      s.plates = Math.min(10, s.plates + 1);
      s.plateT = 4;
    }

    const effMax = this.effShieldMax(s);
    if (s.shield > 0 && !shieldPierce) {
      const abs = Math.min(s.shield, amount);
      s.shield -= abs;
      amount -= abs;
      if (s.shield <= 0 && s.raceId === 0 && s.burstCd <= 0) {
        s.burstT = 2.5;
        s.burstCd = 12;
        this.ev({ type: "teleport", x: s.x, y: s.y, raceId: 0, pitch: 1.4 });
      }
    }
    if (amount > 0 && s.raceId === 2 && s.plates > 0) amount *= 1 - s.plates * 0.02;
    s.hp -= amount;
    if (!silent && s.isPlayer) this.shakeReq = Math.min(16, this.shakeReq + amount * 0.25);
    if (s.channelT > 0 && Math.random() < 0.3) {
      s.channelT = 0;
      this.damage(s, 22, null, true);
    }
    if (s.hp <= 0) this.kill(s, from);
  }

  kill(s: Ship, killer: Ship | null) {
    s.alive = false;
    s.respawnT = s.isPlayer ? 999 : 4;
    s.deadT = 0;
    this.ev({ type: "explode", x: s.x, y: s.y, raceId: s.raceId, size: s.radius * 2.2 });
    for (let i = 0; i < Math.min(8, 3 + s.level / 3); i++) {
      this.resources.push({
        x: s.x + rand01() * 60 - 30,
        y: s.y + rand01() * 60 - 30,
        vx: rand01() * 180 - 90,
        vy: rand01() * 180 - 90,
        raceId: s.raceId,
        amount: 2,
        radius: 10,
        phase: 0,
        anti: false,
        resType: "mineral",
      });
    }
    if (killer && killer.alive) {
      killer.kills++;
      killer.score += 40 + s.level * 18;
      this.grantXp(killer, 45 + s.level * 22);
    }
    this.onKill?.(killer?.raceId ?? -1, s.raceId, killer?.level ?? 0, s.level);
    const colorMap = ["#5fd4ff", "#3f7fff", "#7ad13a", "#ff5a3c"];
    const text = killer ? `${killer.name} ⟶ ${s.name}` : `${s.name} yok edildi`;
    this.killfeed.unshift({
      id: Math.random(),
      text,
      color: killer ? colorMap[killer.raceId]! : "#8ea0bd",
      t: 6,
    });
    if (this.killfeed.length > 6) this.killfeed.pop();
    if (s.isPlayer) {
      this.deathInfo = killer
        ? `${killer.name} (${killer.race.name}) seni yok etti. Seviye ${s.level} · ${s.kills} kill`
        : `Çevresel hasar seni yok etti. Seviye ${s.level} · ${s.kills} kill`;
      this.shakeReq = 24;
    }
  }

  respawn(s: Ship) {
    const b = s.race.base;
    s.alive = true;
    s.x = b.x + rand01() * 240 - 120;
    s.y = b.y + rand01() * 240 - 120;
    s.vx = 0;
    s.vy = 0;
    s.cargo = 0;
    s.burn = 0;
    s.boost = 100;
    s.slowT = 0;
    s.stunT = 0;
    s.blindT = 0;
    s.level = Math.max(1, s.level - 2);
    s.xp = 0;
    s.channelT = 0;
    s.channelTarget = null;
    this.autoBranch(s);
    this.applyTier(s);
    s.hp = s.maxHp;
    s.shield = s.maxShield;
    s.invulnT = 1.2;
    this.ev({ type: "spawn", x: s.x, y: s.y, raceId: s.raceId, size: s.radius });
  }

  playerRespawn() {
    this.respawn(this.player);
    this.deathInfo = "";
  }

  grantXp(s: Ship, amount: number) {
    s.score += Math.round(amount * 0.4);
    if (s.level >= MAX_LEVEL) return;
    s.xp += amount;
    while (s.xp >= s.tier.xpToNext && s.level < MAX_LEVEL) {
      s.xp -= s.tier.xpToNext;
      s.level++;
      const crossedBranch = (BRANCH_LEVELS as readonly number[]).includes(s.level);
      this.applyTier(s);
      s.hp = s.maxHp;
      s.shield = this.effShieldMax(s);
      s.upPoints += 3;
      this.syncSystems(s);
      if (crossedBranch) {
        this.offerBranch(s);
        if (s.isPlayer) {
          this.ev({ type: "levelup", x: s.x, y: s.y, raceId: s.raceId, size: s.radius * 2.4 });
          break;
        }
        this.autoBranch(s);
      } else if (s.isPlayer) {
        this.toast = `${s.tier.name} · Seviye ${s.level}`;
        this.toastT = 2.4;
        this.ev({ type: "levelup", x: s.x, y: s.y, raceId: s.raceId, size: s.radius * 2.4 });
      } else {
        this.autoBranch(s);
      }
    }
  }

  spendUpgrade(k: UpKey): string | null {
    const p = this.player;
    if (p.up[k] >= 12) return "Maksimum";
    if (p.upPoints <= 0) {
      const cost = 14;
      if (p.bank < cost) return "Puan/hammadde yok";
      p.bank -= cost;
    } else {
      p.upPoints--;
    }
    p.up[k]++;
    this.applyTier(p);
    return null;
  }

  static readonly PIERCE_COST = 35;
  buyPiercingAmmo(): string | null {
    const p = this.player;
    if (p.pierceOwned) {
      p.shieldPierce = !p.shieldPierce;
      this.toast = p.shieldPierce ? "Kalkan Delici AÇIK" : "Kalkan Delici KAPALI";
      this.toastT = 2;
      return null;
    }
    if (p.bank < Sim.PIERCE_COST) return `Hammadde ${Sim.PIERCE_COST} gerekli`;
    p.bank -= Sim.PIERCE_COST;
    p.pierceOwned = true;
    p.shieldPierce = true;
    this.toast = "Kalkan Delici Mühimmat satın alındı";
    this.toastT = 2.6;
    return null;
  }

  spendSystem(k: SysKey): string | null {
    const p = this.player;
    const def = SYSTEMS[k];
    const st = p.sys[k];
    if (p.level < def.unlockLv) return "Kilitli";
    if (st.lv === 0) {
      st.lv = 1;
      return null;
    }
    if (st.lv >= def.maxLv) return "Maksimum";
    if (p.upPoints < 1) return "Puan yok";
    if (p.anti < st.lv) return `Antimadde ${st.lv} gerekli`;
    p.upPoints--;
    p.anti -= st.lv;
    st.lv++;
    return null;
  }

  upgradeBase(): boolean {
    const base = this.bases[this.player.raceId]!;
    const cost = baseUpgradeCost(base.level);
    if (base.level >= MAX_LEVEL || base.pool < cost) return false;
    base.pool -= cost;
    base.level++;
    base.energyMax = 1100 + base.level * 170;
    base.energy = Math.min(base.energyMax, base.energy + 150);
    base.radius = 170 + base.level * 5;
    this.ev({ type: "baseup", x: base.x, y: base.y, raceId: base.raceId });
    for (const s of this.ships) if (s.alive && s.raceId === base.raceId) this.applyTier(s);
    return true;
  }

  /* ---------------- madencilik ---------------- */
  mineStep(s: Ship, mineHold: boolean, dt: number) {
    const cap = this.cargoCap(s);
    s.beamTargets.length = 0;
    if (s.cargo >= cap) return;
    const lv = s.sys.mine.lv;
    const beamRange = 180 + lv * 40;
    const maxTargets = lv >= 5 ? 3 : lv >= 4 ? 2 : 1;
    let beaming = false;
    const beamingSet = new Set<Resource>();

    if (mineHold && lv > 0 && s.stunT <= 0) {
      const near = this.resGrid.query(s.x, s.y, beamRange, this.qRes);
      const candidates = near
        .filter((r) => !r.anti)
        .sort(
          (a, b) => (a.x - s.x) ** 2 + (a.y - s.y) ** 2 - ((b.x - s.x) ** 2 + (b.y - s.y) ** 2),
        );
      for (const r of candidates.slice(0, maxTargets)) {
        beaming = true;
        beamingSet.add(r);
        s.beamTargets.push(r);
        const d = Math.hypot(r.x - s.x, r.y - s.y) || 1;
        const pull = (60 + lv * 30) / Math.max(30, d);
        r.vx += ((s.x - r.x) / d) * pull * dt * 60;
        r.vy += ((s.y - r.y) / d) * pull * dt * 60;
        const grabR = s.radius + r.radius + 14;
        if (d < grabR) {
          if (r.resType === "solar" && Math.random() < dt * 4)
            this.ev({ type: "solarmine", x: r.x, y: r.y });
          else if (r.resType === "dark" && Math.random() < dt * 4)
            this.ev({ type: "darkmine", x: r.x, y: r.y });
          this.collect(s, r, 1 + lv * 0.5);
        }
      }
    }

    const magnetR = s.radius + 90;
    const nearAll = this.resGrid.query(s.x, s.y, magnetR + 60, this.qRes);
    for (const r of nearAll) {
      const d = Math.hypot(r.x - s.x, r.y - s.y);
      if (d < magnetR && (r.raceId === s.raceId || r.raceId === -1)) {
        const pull = 260 / Math.max(40, d);
        r.vx += ((s.x - r.x) / d) * pull * dt * 26;
        r.vy += ((s.y - r.y) / d) * pull * dt * 26;
      }
      if (r.anti) {
        const spd = Math.hypot(s.vx, s.vy);
        const inZone = d < s.radius + r.radius + 46 && spd < 45;
        if (inZone) {
          if (s.channelTarget !== r) {
            s.channelTarget = r;
            s.channelT = 0;
          }
          s.channelT += dt;
          if (Math.random() < dt * 5) this.ev({ type: "void", x: r.x, y: r.y, pitch: 2.2 });
          if (s.channelT >= 1.2) {
            s.channelT = 0;
            s.channelTarget = null;
            s.anti++;
            this.grantXp(s, 60);
            this.removeResource(r);
            this.ev({ type: "antiget", x: s.x, y: s.y, raceId: s.raceId });
          }
        } else if (s.channelTarget === r) {
          s.channelT = 0;
          s.channelTarget = null;
        }
      } else if (d < s.radius + r.radius && !beamingSet.has(r)) {
        this.collect(s, r, 1);
      }
    }
    if (beaming) {
      s.mining = true;
      if (Math.random() < dt * 8)
        this.ev({ type: "void", x: s.beamTargets[0]!.x, y: s.beamTargets[0]!.y, pitch: 1.8 });
    }
  }

  private collect(s: Ship, r: Resource, mult: number) {
    const cap = this.cargoCap(s);
    const take = Math.min(r.amount, cap - s.cargo);
    if (take <= 0) return;
    s.cargo += take;
    r.amount -= take;
    this.grantXp(s, take * 5 * mult);
    this.ev({ type: "hit", x: r.x, y: r.y, raceId: s.raceId, pitch: 2.4 });
    if (s.isPlayer) {
      const label =
        r.resType === "solar" ? "☀" : r.resType === "dark" ? "◉" : r.raceId >= 0 ? "◆" : "◆";
      this.ev({ type: "collect", x: r.x, y: r.y, text: `${label}+${take}`, raceId: s.raceId });
      if (s.cargo >= cap) {
        this.toast = "KARGO DOLU — üsse dön!";
        this.toastT = 2;
      }
    }
    if (r.amount <= 0) this.removeResource(r);
  }

  private removeResource(r: Resource) {
    const idx = this.resources.indexOf(r);
    if (idx >= 0) this.resources.splice(idx, 1);
  }

  deliver(s: Ship) {
    if (s.cargo <= 0 && s.anti <= 0) return;
    const base = this.bases[s.raceId]!;
    if (base.alive && Math.hypot(s.x - base.x, s.y - base.y) < base.radius) {
      if (s.cargo > 0) {
        base.pool += s.cargo;
        base.energy = Math.min(base.energyMax, base.energy + s.cargo * 24);
        const toBank = Math.ceil(s.cargo * 0.6);
        s.bank += toBank;
        this.grantXp(s, s.cargo * 16);
        s.score += s.cargo * 6;
        s.cargo = 0;
        this.ev({ type: "deliver", x: base.x, y: base.y, raceId: base.raceId });
      }
      if (s.anti > 0) {
        s.upPoints += s.anti;
        base.pool += s.anti * 120;
        s.bank += s.anti * 8;
        s.anti = 0;
        this.ev({ type: "deliver", x: base.x, y: base.y, raceId: base.raceId, pitch: 1.5 });
      }
    }
  }

  updateResources(dt: number) {
    for (const r of this.resources) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vx *= 0.99;
      r.vy *= 0.99;
      r.phase += dt * 2;
      r.x = clamp(r.x, 20, WORLD - 20);
      r.y = clamp(r.y, 20, WORLD - 20);
    }
  }

  updateAsteroids(dt: number) {
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i]!;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      if (a.x < a.radius || a.x > WORLD - a.radius) a.vx *= -1;
      if (a.y < a.radius || a.y > WORLD - a.radius) a.vy *= -1;
      if (a.hp <= 0) {
        this.ev({ type: "explode", x: a.x, y: a.y, raceId: -1, size: a.radius * 0.9 });
        for (let k = 0; k < 3; k++) {
          if (Math.random() < 0.12) {
            this.spawnAnti(a.x + rand01() * 40 - 20, a.y + rand01() * 40 - 20, true);
          } else {
            this.resources.push({
              x: a.x + rand01() * 40 - 20,
              y: a.y + rand01() * 40 - 20,
              vx: rand01() * 80 - 40,
              vy: rand01() * 80 - 40,
              raceId: Math.floor(Math.random() * 4),
              amount: 2,
              radius: 10,
              phase: 0,
              anti: false,
              resType: "mineral",
            });
          }
        }
        this.asteroids.splice(i, 1);
      }
    }
  }

  /* ---------------- üsler ---------------- */
  updateBases(dt: number) {
    for (const base of this.bases) {
      if (!base.alive) continue;
      const near = this.shipGrid.query(base.x, base.y, base.radius + 260, this.qShip);
      for (const s of near) {
        if (!s.alive || s.invulnT > 0) continue;
        const d = Math.hypot(s.x - base.x, s.y - base.y);
        if (s.raceId !== base.raceId) {
          if (d < base.radius + 220 && base.energy > 5) {
            base.energy -= 12 * dt;
            this.damage(s, (34 + base.level * 3) * dt, null, true);
            if (Math.random() < 0.2)
              this.ev({ type: "basehit", x: base.x, y: base.y, raceId: base.raceId });
          }
        } else if (d < base.radius) {
          s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.12 * dt);
          s.boost = Math.min(100, s.boost + 26 * dt);
        }
      }
      if (base.energy > base.energyMax) base.energy = base.energyMax;
    }
  }

  /* ---------------- saha: yıldız, karadelik, tuzak, gaz ---------------- */
  updateField(dt: number) {
    for (const st of this.stars) {
      const near = this.shipGrid.query(st.x, st.y, st.r * 2.6, this.qShip);
      for (const s of near) {
        if (!s.alive) continue;
        const d = Math.hypot(s.x - st.x, s.y - st.y);
        if (d < st.r * 2.4) {
          s.starTouched = true;
          s.boost = Math.min(100, s.boost + 20 * dt);
          for (const k of SYSTEM_ORDER)
            if (s.sys[k].cd > 0) s.sys[k].cd = Math.max(0, s.sys[k].cd - dt * 0.5);
        }
        if (d < st.r * 0.95) s.burn += 10 * dt;
      }
    }
    for (const h of this.holes) {
      const near = this.shipGrid.query(h.x, h.y, h.pullR + 100, this.qShip);
      for (const s of near) {
        if (!s.alive) continue;
        const dx = h.x - s.x,
          dy = h.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < h.pullR) {
          const g = 90 * (1 - d / h.pullR) + 20;
          s.vx += (dx / d) * g * dt;
          s.vy += (dy / d) * g * dt;
        }
        if (d < h.r * 0.55) {
          this.damage(s, 30 * dt, null, true);
          s.vx += (dx / d) * 260 * dt;
          s.vy += (dy / d) * 260 * dt;
        } else if (d < h.r * 2.6 && this.playerCmd.mineHold && s.isPlayer) {
          s.boost = Math.min(100, s.boost + 42 * dt);
          this.grantXp(s, 8 * dt);
          if (Math.random() < dt * 3) this.ev({ type: "void", x: s.x, y: s.y, pitch: 0.5 });
        }
      }
    }
  }

  systemTick(s: Ship, cmd: Cmd, dt: number) {
    for (const k of SYSTEM_ORDER) {
      const st = s.sys[k];
      if (st.cd > 0) st.cd -= dt;
    }
    if (cmd.use && s.alive) this.useSystem(s, cmd.use, cmd);
  }

  useSystem(s: Ship, key: SysKey, cmd: Cmd) {
    const st = s.sys[key];
    if (st.lv <= 0 || st.cd > 0) return;
    switch (key) {
      case "shield": {
        st.cd = 18 - st.lv * 1.2;
        s.overT = 4 + st.lv * 0.5;
        s.shield = Math.max(s.shield, this.effShieldMax(s) * (0.4 + st.lv * 0.08));
        this.ev({ type: "teleport", x: s.x, y: s.y, raceId: s.raceId, pitch: 1.2 });
        break;
      }
      case "blink": {
        st.cd = 7 - st.lv * 0.8;
        const range = 260 + st.lv * 70;
        const dx = cmd.ax - s.x,
          dy = cmd.ay - s.y;
        const d = Math.hypot(dx, dy) || 1;
        const step = Math.min(range, d);
        this.ev({ type: "teleport", x: s.x, y: s.y, raceId: s.raceId });
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        s.vx = (dx / d) * step * 0.5;
        s.vy = (dy / d) * step * 0.5;
        s.invulnT = Math.max(s.invulnT, 0.25);
        this.ev({ type: "teleport", x: s.x, y: s.y, raceId: s.raceId, pitch: 1.3 });
        break;
      }
      case "trap": {
        st.cd = 11 - st.lv * 0.8;
        this.traps.push({
          x: s.x - Math.cos(s.angle) * (s.radius + 26),
          y: s.y - Math.sin(s.angle) * (s.radius + 26),
          raceId: s.raceId,
          ownerId: s.id,
          life: 18 + st.lv * 4,
          armT: 1.2,
          dmg: 60 + st.lv * 30,
          r: 70 + st.lv * 14,
        });
        this.ev({ type: "trap", x: s.x, y: s.y, raceId: s.raceId });
        break;
      }
      case "gas": {
        st.cd = 17 - st.lv * 1.2;
        const dirx = Math.cos(s.angle),
          diry = Math.sin(s.angle);
        this.gases.push({
          x: s.x + dirx * 130,
          y: s.y + diry * 130,
          vx: dirx * 90 + s.vx * 0.4,
          vy: diry * 90 + s.vy * 0.4,
          r: 30,
          targetR: 110 + st.lv * 26,
          raceId: s.raceId,
          life: 5 + st.lv,
          maxLife: 5 + st.lv,
          dps: 14 + st.lv * 6,
        });
        this.ev({ type: "gas", x: s.x, y: s.y, raceId: s.raceId });
        break;
      }
      default:
        break;
    }
  }

  updateTraps(dt: number) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i]!;
      t.life -= dt;
      if (t.armT > 0) t.armT -= dt;
      let boom = false;
      if (t.armT <= 0) {
        const near = this.shipGrid.query(t.x, t.y, t.r, this.qShip);
        for (const s of near) {
          if (!s.alive || s.raceId === t.raceId || s.invulnT > 0) continue;
          if (Math.hypot(s.x - t.x, s.y - t.y) < t.r) {
            boom = true;
            break;
          }
        }
      }
      if (boom) {
        const near = this.shipGrid.query(t.x, t.y, t.r * 1.2, this.qShip);
        for (const s of near) {
          if (!s.alive || s.raceId === t.raceId) continue;
          const d = Math.hypot(s.x - t.x, s.y - t.y);
          if (d < t.r) {
            this.damage(
              s,
              t.dmg * (1 - (d / t.r) * 0.5),
              this.ships.find((o) => o.id === t.ownerId) ?? null,
              false,
            );
            if (t.raceId === 1) s.slowT = 2.2;
            if (t.raceId === 0) {
              s.vx += (s.x - t.x) * 2.4;
              s.vy += (s.y - t.y) * 2.4;
            }
            if (t.raceId === 2) s.stunT = Math.max(s.stunT, 1.2);
            if (t.raceId === 3) s.burn += 20;
          }
        }
        this.ev({ type: "explode", x: t.x, y: t.y, raceId: t.raceId, size: t.r * 0.8 });
        this.traps.splice(i, 1);
      } else if (t.life <= 0) {
        this.traps.splice(i, 1);
      }
    }
  }

  updateGases(dt: number) {
    for (let i = this.gases.length - 1; i >= 0; i--) {
      const g = this.gases[i]!;
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= 0.985;
      g.vy *= 0.985;
      if (g.r < g.targetR) g.r = Math.min(g.targetR, g.r + 140 * dt);
      const near = this.shipGrid.query(g.x, g.y, g.r + 60, this.qShip);
      for (const s of near) {
        if (!s.alive || s.raceId === g.raceId) continue;
        if (Math.hypot(s.x - g.x, s.y - g.y) < g.r) {
          this.damage(s, g.dps * dt, null, true);
          s.slowT = Math.max(s.slowT, 0.4);
          s.blindT = Math.max(s.blindT, 0.6);
        }
      }
      if (g.life <= 0) this.gases.splice(i, 1);
    }
  }

  private waterAuras(dt: number) {
    for (const w of this.ships) {
      if (!w.alive || w.raceId !== 1) continue;
      const near = this.shipGrid.query(w.x, w.y, 280, this.qShipB);
      for (const a of near) {
        if (!a.alive) continue;
        if (Math.hypot(a.x - w.x, a.y - w.y) < 260) {
          a.nearWater = true;
          a.hp = Math.min(a.maxHp, a.hp + 4 * dt);
        }
      }
    }
  }

  /* ---------------- yapay zeka ---------------- */
  private aiTmp: Cmd = emptyCmd();

  aiCmd(s: Ship, dt: number): Cmd {
    const c = this.aiTmp;
    c.ax = s.aiTargetX;
    c.ay = s.aiTargetY;
    c.thrust = true;
    c.brake = false;
    c.boost = false;
    c.fire = false;
    c.mineHold = false;
    c.use = null;

    s.aiRepath -= dt;
    const detect = s.blindT > 0 ? 240 : s.level > 8 ? 1100 : 750;
    let enemy: Ship | null = null;
    const cand = this.shipGrid.query(s.x, s.y, detect, this.qShip);
    let bd = detect;
    for (const o of cand) {
      if (!o.alive || o.raceId === s.raceId || o.invulnT > 0) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < bd) {
        bd = d;
        enemy = o;
      }
    }
    const cap = this.cargoCap(s);
    const lowHp = s.hp < s.maxHp * 0.28;
    const base = this.bases[s.raceId]!;

    if (lowHp) {
      s.aiState = "kaç";
      c.ax = base.x;
      c.ay = base.y;
      c.boost = s.boost > 20;
      if (s.sys.trap.lv > 0 && s.sys.trap.cd <= 0) c.use = "trap";
      if (s.sys.blink.lv > 0 && s.sys.blink.cd <= 0 && Math.random() < 0.02) {
        c.ax = base.x;
        c.ay = base.y;
        c.use = "blink";
      }
      return c;
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
        c.ax = px;
        c.ay = py;
        c.thrust = false;
      } else {
        c.ax = px + Math.cos(s.wander + this.time) * 60;
        c.ay = py + Math.sin(s.wander + this.time) * 60;
        c.thrust = true;
      }
      c.boost = d > 700 && s.boost > 35;
      const want = Math.atan2(py - s.y, px - s.x);
      const diff = Math.abs(angDiff(want, s.angle));
      if (diff < 0.22 && d < w.speed * w.life * 0.9) c.fire = true;
      if (s.sys.shield.lv > 0 && s.sys.shield.cd <= 0 && s.hp < s.maxHp * 0.55) c.use = "shield";
      if (s.sys.gas.lv > 0 && s.sys.gas.cd <= 0 && d < 380 && Math.random() < 0.015) c.use = "gas";
      if (s.sys.blink.lv > 0 && s.sys.blink.cd <= 0 && d > 640 && Math.random() < 0.012) {
        c.ax = enemy.x;
        c.ay = enemy.y;
        c.use = "blink";
      }
      return c;
    }
    if (s.cargo >= cap) {
      s.aiState = "teslim";
      c.ax = base.x;
      c.ay = base.y;
      c.boost = s.boost > 60;
      return c;
    }
    if (s.role === "guard") {
      const intruder = cand.find(
        (o) =>
          o.alive &&
          o.raceId !== s.raceId &&
          Math.hypot(o.x - base.x, o.y - base.y) < base.radius + 500,
      );
      if (!intruder) {
        s.aiState = "nöbet";
        const orb = this.time * 0.25 + s.id;
        c.ax = base.x + Math.cos(orb) * (base.radius + 180);
        c.ay = base.y + Math.sin(orb) * (base.radius + 180);
        return c;
      }
    }
    if (s.aiRepath <= 0 || Math.hypot(s.aiTargetX - s.x, s.aiTargetY - s.y) < 60) {
      let best: { x: number; y: number } | null = null,
        bdist = Infinity;
      const nearR = this.resGrid.query(s.x, s.y, 900, this.qRes);
      for (const r of nearR) {
        if (r.anti) continue;
        const d = Math.hypot(r.x - s.x, r.y - s.y);
        if (d < bdist) {
          bdist = d;
          best = r;
        }
      }
      if (best) {
        s.aiTargetX = best.x;
        s.aiTargetY = best.y;
      } else {
        s.aiTargetX = this.rng.range(0, WORLD);
        s.aiTargetY = this.rng.range(0, WORLD);
      }
      s.aiRepath = 1.6;
    }
    s.aiState = "maden";
    c.mineHold = s.sys.mine.lv > 0;
    return c;
  }

  /* ---------------- HUD ---------------- */
  hud(): HudState {
    const p = this.player;
    const board: Standing[] = RACES.map((r) => {
      const fleet = this.ships.filter((s) => s.raceId === r.id);
      return {
        raceId: r.id,
        name: r.name,
        color: r.color,
        score: fleet.reduce((acc, s) => acc + s.score, 0),
        baseLv: this.bases[r.id]!.level,
        alive: this.bases[r.id]!.alive,
      };
    }).sort((a, b) => b.score - a.score);
    const sysHud: HudState["sys"] = {} as HudState["sys"];
    for (const k of SYSTEM_ORDER) {
      const def = SYSTEMS[k];
      const st = p.sys[k];
      sysHud[k] = {
        lv: st.lv,
        cd: Math.max(0, st.cd),
        cdMax:
          def.key === "shield"
            ? 18
            : def.key === "blink"
              ? 7
              : def.key === "trap"
                ? 11
                : def.key === "gas"
                  ? 17
                  : 1,
        locked: p.level < def.unlockLv,
      };
    }
    const base = this.bases[p.raceId]!;
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
      baseEnergy: base.energy / base.energyMax,
      baseLv: base.level,
      baseStage: BASE_STAGES[baseStageOf(base.level)]!,
      basePool: Math.round(base.pool),
      baseCost: baseUpgradeCost(base.level),
      resource: p.race.resource,
      kills: p.kills,
      score: p.score,
      anti: p.anti,
      roundLeft: Math.round(this.time),
      sys: sysHud,
      dead: !p.alive,
      deathInfo: this.deathInfo,
      killfeed: this.killfeed.map((k) => ({ id: k.id, text: k.text, color: k.color })),
      leaderboard: board,
      toast: this.toast,
      lowHp: p.alive ? clamp(1 - p.hp / (p.maxHp * 0.35), 0, 1) : 0,
      pendingBranch: p.pendingBranch
        ? { ...p.pendingBranch, opts: [...p.pendingBranch.opts] }
        : null,
      ended:
        this.session.phase === "ended"
          ? { winner: this.session.winner, reason: this.session.reason, standings: board }
          : null,
      shieldPierce: p.shieldPierce,
      bank: Math.floor(p.bank),
      pierceOwned: p.pierceOwned,
      defenses: this.structures
        .filter((st) => st.raceId === p.raceId)
        .map((st) => ({
          type: st.type,
          hp: st.hp,
          maxHp: st.maxHp,
          shield: st.shield,
          maxShield: st.maxShield,
        })),
      canBuild: base.alive && Math.hypot(p.x - base.x, p.y - base.y) < base.radius + 300,
      buildCost: 0,
      aliveTeams: board.map((b) => ({ name: b.name, color: b.color, alive: b.alive })),
    };
  }
}
