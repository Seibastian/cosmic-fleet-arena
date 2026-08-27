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

export type CrateType = "shield" | "damage" | "speed" | "vacuum" | "xp" | "antimatter";
export const CRATE_LABELS: Record<CrateType, string> = {
  shield: "Kalkan Bataryası",
  damage: "Hasar Yükseltici",
  speed: "Hız Atılımı",
  vacuum: "Vakum Çekirdeği",
  xp: "Veri Matrisi",
  antimatter: "Antimadde Çekirdeği",
};
export const CRATE_COLORS: Record<CrateType, string> = {
  shield: "#7ec8ff",
  damage: "#ff6b5a",
  speed: "#ffd65a",
  vacuum: "#9e7aff",
  xp: "#7affb0",
  antimatter: "#e0b0ff",
};

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
  comboMul: number;
  plates: number;
  plateT: number;
  burstT: number;
  burstCd: number;
  nearWater: boolean;
  starTouched: boolean;
  mining: boolean;
  beamTargets: Resource[];
  cloakT: number;
  overchargeT: number;
  overheatT: number;
  damageBuffT: number;
  speedBuffT: number;
  vacuumT: number;
  xpBuffT: number;
  warpCd: number;
  hitStop: number;
  squashT: number;
  cloakStrike: boolean;
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

interface SupplyCrate {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: CrateType;
  life: number;
  phase: number;
  radius: number;
}

interface WarpGate {
  id: number;
  x: number;
  y: number;
  pairId: number;
  angle: number;
  radius: number;
  rot: number;
}

interface Boss {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  angle: number;
  fireCd: number;
  alive: boolean;
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
  comboN: number;
  comboMul: number;
  crates: { x: number; y: number; type: CrateType }[];
  boss: { x: number; y: number; hp: number; maxHp: number; alive: boolean } | null;
  bossWarning: number;
  gates: { x: number; y: number; pairId: number }[];
  warpCd: number;
  cloakT: number;
  overchargeT: number;
  overheatT: number;
  damageBuffT: number;
  speedBuffT: number;
  vacuumT: number;
  xpBuffT: number;
  hitStop: number;
  roundElapsed: number;
}

// deterministik RNG — Math.random kaldırıldı

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
  crates: SupplyCrate[] = [];
  gates: WarpGate[] = [];
  boss: Boss | null = null;
  bossWarning = 0;
  nextCrateT = 8;
  nextBossT = 60;
  hitStop = 0;
  orbitalStrikes: {
    x: number;
    y: number;
    r: number;
    delay: number;
    life: number;
    dmg: number;
    raceId: number;
    ownerId: number;
  }[] = [];
  gravityWells: {
    x: number;
    y: number;
    r: number;
    targetR: number;
    life: number;
    raceId: number;
    ownerId: number;
  }[] = [];
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

    // Warp kapıları: 2 çift
    this.gates = [
      { id: 0, x: WORLD * 0.32, y: WORLD * 0.48, pairId: 1, angle: 0, radius: 88, rot: 0 },
      { id: 1, x: WORLD * 0.68, y: WORLD * 0.52, pairId: 0, angle: Math.PI, radius: 88, rot: 0 },
      {
        id: 2,
        x: WORLD * 0.48,
        y: WORLD * 0.32,
        pairId: 3,
        angle: Math.PI * 0.5,
        radius: 88,
        rot: 0,
      },
      {
        id: 3,
        x: WORLD * 0.52,
        y: WORLD * 0.68,
        pairId: 2,
        angle: -Math.PI * 0.5,
        radius: 88,
        rot: 0,
      },
    ];

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
      vx: this.rng.next() * 8 - 4,
      vy: this.rng.next() * 8 - 4,
      raceId: -1,
      amount: 1,
      radius: 12,
      phase: this.rng.next() * TAU,
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
      comboMul: 1,
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
        emp: { lv: 0, cd: 0 },
        nanite: { lv: 0, cd: 0 },
        cloak: { lv: 0, cd: 0 },
        gravity: { lv: 0, cd: 0 },
        orbital: { lv: 0, cd: 0 },
        overcharge: { lv: 0, cd: 0 },
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
      cloakT: 0,
      overchargeT: 0,
      overheatT: 0,
      damageBuffT: 0,
      speedBuffT: 0,
      vacuumT: 0,
      xpBuffT: 0,
      warpCd: 0,
      hitStop: 0,
      squashT: 0,
      cloakStrike: false,
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
    if (this.hitStop > 0) this.hitStop -= dt;
    this.time += dt;
    this.session.t -= dt;
    if (this.session.t <= 0 && this.session.phase === "live") {
      const alive = this.bases.filter((b) => b.alive);
      if (alive.length > 0) {
        const byScore = [...alive].sort((a, b) => {
          const sa = this.ships
            .filter((s) => s.raceId === a.raceId)
            .reduce((acc, s) => acc + s.score, 0);
          const sb = this.ships
            .filter((s) => s.raceId === b.raceId)
            .reduce((acc, s) => acc + s.score, 0);
          return sb - sa;
        });
        this.session.winner = byScore[0]!.raceId;
        this.endSession("time");
      } else {
        this.endSession("time");
      }
      return;
    }

    if (this.player.pendingBranch) {
      this.player.pendingBranch.t -= dt;
      if (this.player.pendingBranch.t <= 0) this.chooseBranch(0);
    }

    for (const base of this.bases) base.rot += dt * 0.15;
    for (const h of this.holes) h.rot -= dt * 0.6;
    for (const st of this.stars) st.rot += dt * 0.05;
    for (const g of this.gates) g.rot += dt * 0.9;

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
      if (cmd.fire && s.cloakT <= 0) {
        // cloak breaks on fire but grants strike bonus
        const wasCloaked = s.cloakT > 0;
        this.fire(s);
        if (wasCloaked) s.cloakStrike = true;
      } else if (s.cloakT > 0 && cmd.fire) {
        // still allow fire but break cloak
        s.cloakT = 0;
        s.cloakStrike = true;
        this.fire(s);
      } else if (cmd.fire) this.fire(s);
      if (s.hitFlash > 0) s.hitFlash -= dt * 4;
      if (s.invulnT > 0) s.invulnT -= dt;
      if (s.comboT > 0) {
        s.comboT -= dt;
        if (s.comboT <= 0) {
          s.comboN = 0;
          s.comboMul = 1;
        } else {
          // combo multiplier: 5→1.3, 10→1.6, 20→2.0 lerp
          if (s.comboN >= 20) s.comboMul = 2.0;
          else if (s.comboN >= 10) s.comboMul = 1.6 + (s.comboN - 10) * 0.04;
          else if (s.comboN >= 5) s.comboMul = 1.3 + (s.comboN - 5) * 0.06;
          else s.comboMul = 1 + s.comboN * 0.06;
        }
      } else {
        s.comboMul = 1;
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
      const prevOC = s.overchargeT;
      if (s.cloakT > 0) s.cloakT -= dt;
      if (s.overchargeT > 0) s.overchargeT -= dt;
      if (prevOC > 0 && s.overchargeT <= 0) s.overheatT = 3.0;
      if (s.overheatT > 0) s.overheatT -= dt;
      if (s.damageBuffT > 0) s.damageBuffT -= dt;
      if (s.speedBuffT > 0) s.speedBuffT -= dt;
      if (s.vacuumT > 0) s.vacuumT -= dt;
      if (s.xpBuffT > 0) s.xpBuffT -= dt;
      if (s.warpCd > 0) s.warpCd -= dt;
      if (s.hitStop > 0) s.hitStop -= dt;
      if (s.squashT > 0) s.squashT -= dt;
      if (s.cloakStrike && s.fireCd <= 0) {
        // cloak strike bonus expires after next shot window or 1.5s
        // handled via damage calc, clear after 2s
      }
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
    this.updateCrates(dt);
    this.updateGates(dt);
    this.updateBoss(dt);
    this.updateGravityWells(dt);
    this.updateOrbital(dt);
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

    // İkmal kasası zamanlayıcı
    this.nextCrateT -= dt;
    if (this.nextCrateT <= 0 && this.crates.length < 6) {
      this.nextCrateT = 18 + this.rng.range(-3, 5);
      this.spawnCrate();
    }
    // Boss zamanlayıcı
    this.nextBossT -= dt;
    if (this.bossWarning > 0) this.bossWarning -= dt;
    if (this.nextBossT <= 0 && !this.boss) {
      if (this.bossWarning <= 0) {
        this.bossWarning = 10;
        this.toast = "⚠ LEVIATHAN YAKLAŞIYOR — MERKEZDE BELİRECEK!";
        this.toastT = 4;
        this.ev({ type: "alarm", raceId: -1 });
        this.nextBossT = 10;
      } else {
        this.spawnBoss();
        this.nextBossT = 90 + this.rng.range(-10, 20);
        this.bossWarning = 0;
      }
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
    if (lowBase && this.rng.next() < dt * 0.2)
      this.ev({ type: "alarm", raceId: this.player.raceId });
    if (
      this.player.alive &&
      this.player.hp / this.player.maxHp < 0.25 &&
      this.rng.next() < dt * 0.5
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
    const cloakK = s.cloakT > 0 ? 1.42 : 1;
    const speedBuffK = s.speedBuffT > 0 ? 1.45 : 1;
    const overchargeK = s.overchargeT > 0 ? 1.18 : 1;
    const maxSpd =
      s.tier.speed *
      this.mul(s, "speed") *
      tm.spd *
      slowK *
      mineK *
      cloakK *
      speedBuffK *
      overchargeK *
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
    if (s.fireCd > 0 || s.overheatT > 0) return;
    const w = s.tier.weapon;
    const overchargeFire = s.overchargeT > 0 ? 0.58 : 1;
    s.fireCd = (s.tier.fireRate / this.mul(s, "firerate")) * overchargeFire;
    const bm = this.baseMul(s);
    const comboBonus = s.comboMul || 1;
    let dmg = s.tier.damage * w.dmgMul * this.mul(s, "damage") * bm.dmg * comboBonus;
    if (s.damageBuffT > 0) dmg *= 1.85;
    if (s.overchargeT > 0) dmg *= 1.28;
    if (s.cloakStrike) {
      dmg *= 1.45;
      s.cloakStrike = false;
    }
    for (let i = 0; i < w.shots; i++) {
      const off = w.shots === 1 ? 0 : (i / (w.shots - 1) - 0.5) * 2;
      const ang = s.angle + off * w.spread + (this.rng.next() - 0.5) * 0.03;
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

  /* ---------------- ikmal kasaları ---------------- */
  spawnCrate() {
    const types: CrateType[] = ["shield", "damage", "speed", "vacuum", "xp", "antimatter"];
    const t = this.rng.pick(types);
    const x = this.rng.range(WORLD * 0.2, WORLD * 0.8);
    const y = this.rng.range(WORLD * 0.2, WORLD * 0.8);
    this.crates.push({
      x,
      y,
      vx: this.rng.range(-18, 18),
      vy: this.rng.range(-18, 18),
      type: t,
      life: 28,
      phase: this.rng.angle(),
      radius: 22,
    });
    this.ev({ type: "crate", x, y, text: CRATE_LABELS[t] });
  }

  updateCrates(dt: number) {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i]!;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.985;
      c.vy *= 0.985;
      c.phase += dt * 2;
      c.life -= dt;
      // bounce off edges
      if (c.x < 40 || c.x > WORLD - 40) c.vx *= -1;
      if (c.y < 40 || c.y > WORLD - 40) c.vy *= -1;
      c.x = clamp(c.x, 40, WORLD - 40);
      c.y = clamp(c.y, 40, WORLD - 40);
      if (c.life <= 0) {
        this.crates.splice(i, 1);
        continue;
      }
      // vacuum bonus pulls crates
      // check collection by any ship
      const near = this.shipGrid.query(c.x, c.y, c.radius + 90, this.qShip);
      for (const s of near) {
        if (!s.alive) continue;
        const d = Math.hypot(s.x - c.x, s.y - c.y);
        const pull = s.vacuumT > 0 ? 520 / Math.max(30, d) : 0;
        if (pull > 0 && d < 520) {
          c.vx += ((s.x - c.x) / d) * pull * dt * 2;
          c.vy += ((s.y - c.y) / d) * pull * dt * 2;
        }
        if (d < s.radius + c.radius) {
          this.collectCrate(s, c);
          this.crates.splice(i, 1);
          break;
        }
      }
    }
  }

  collectCrate(s: Ship, c: SupplyCrate) {
    const t = c.type;
    switch (t) {
      case "shield":
        s.shield = this.effShieldMax(s);
        s.shieldDelay = 0;
        this.ev({ type: "deliver", x: s.x, y: s.y, raceId: s.raceId });
        break;
      case "damage":
        s.damageBuffT = 8;
        this.ev({ type: "overcharge", x: s.x, y: s.y, raceId: s.raceId });
        break;
      case "speed":
        s.speedBuffT = 6;
        s.boost = 100;
        this.ev({ type: "overcharge", x: s.x, y: s.y, raceId: s.raceId });
        break;
      case "vacuum":
        s.vacuumT = 10;
        this.ev({ type: "void", x: s.x, y: s.y, raceId: s.raceId, pitch: 1 });
        break;
      case "xp":
        s.xpBuffT = 14;
        this.ev({ type: "levelup", x: s.x, y: s.y, raceId: s.raceId });
        break;
      case "antimatter":
        s.anti += 2;
        s.bank += 12;
        this.ev({ type: "antiget", x: s.x, y: s.y, raceId: s.raceId });
        break;
    }
    if (s.isPlayer) {
      this.toast = `${CRATE_LABELS[t]} alındı!`;
      this.toastT = 2;
      this.ev({ type: "collect", x: c.x, y: c.y, text: `⬢ ${CRATE_LABELS[t]}`, raceId: s.raceId });
    }
    this.grantXp(s, 25 * (s.xpBuffT > 0 ? 2 : 1));
    s.score += 15;
  }

  /* ---------------- warp kapıları ---------------- */
  updateGates(dt: number) {
    for (const g of this.gates) {
      const near = this.shipGrid.query(g.x, g.y, g.radius + 40, this.qShip);
      for (const s of near) {
        if (!s.alive || s.warpCd > 0 || s.stunT > 0) continue;
        const d = Math.hypot(s.x - g.x, s.y - g.y);
        if (d < g.radius) {
          const pair = this.gates.find((o) => o.id === g.pairId);
          if (!pair) continue;
          const ang = Math.atan2(pair.y - g.y, pair.x - g.x) || g.angle;
          s.x = pair.x + Math.cos(ang) * (pair.radius + s.radius + 10);
          s.y = pair.y + Math.sin(ang) * (pair.radius + s.radius + 10);
          // preserve momentum + add exit impulse
          const spd = Math.hypot(s.vx, s.vy) || 120;
          s.vx = Math.cos(ang) * Math.max(spd, 220);
          s.vy = Math.sin(ang) * Math.max(spd, 220);
          s.warpCd = 2.5;
          s.invulnT = Math.max(s.invulnT, 0.9);
          this.ev({ type: "warphop", x: g.x, y: g.y, raceId: s.raceId });
          this.ev({ type: "teleport", x: pair.x, y: pair.y, raceId: s.raceId, pitch: 1.4 });
          break;
        }
      }
    }
  }

  /* ---------------- boss ---------------- */
  spawnBoss() {
    const cx = WORLD * 0.5 + this.rng.range(-600, 600);
    const cy = WORLD * 0.5 + this.rng.range(-600, 600);
    this.boss = {
      x: cx,
      y: cy,
      vx: this.rng.range(-30, 30),
      vy: this.rng.range(-30, 30),
      hp: 1400,
      maxHp: 1400,
      radius: 64,
      angle: this.rng.angle(),
      fireCd: 1,
      alive: true,
    };
    this.toast = "☠ LEVIATHAN BELİRDİ!";
    this.toastT = 3.5;
    this.ev({ type: "explode", x: cx, y: cy, raceId: -1, size: 120 });
  }

  updateBoss(dt: number) {
    const b = this.boss;
    if (!b || !b.alive) return;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += dt * 0.6;
    if (b.x < b.radius + 80 || b.x > WORLD - b.radius - 80) b.vx *= -1;
    if (b.y < b.radius + 80 || b.y > WORLD - b.radius - 80) b.vy *= -1;
    b.fireCd -= dt;
    if (b.fireCd <= 0) {
      b.fireCd = 1.1;
      // find nearest player or bot
      let nearest: Ship | null = null;
      let bd = 900;
      const near = this.shipGrid.query(b.x, b.y, bd, this.qShip);
      for (const s of near) {
        if (!s.alive) continue;
        const d = Math.hypot(s.x - b.x, s.y - b.y);
        if (d < bd) {
          bd = d;
          nearest = s;
        }
      }
      if (nearest) {
        const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x);
        for (let k = -1; k <= 1; k++) {
          const aa = ang + k * 0.28;
          this.bullets.push({
            x: b.x + Math.cos(aa) * b.radius,
            y: b.y + Math.sin(aa) * b.radius,
            vx: Math.cos(aa) * 460,
            vy: Math.sin(aa) * 460,
            dmg: 26,
            life: 1.6,
            raceId: -1,
            ownerId: -2,
            radius: 4,
            homing: 0,
            pierce: 0,
            burn: 4,
            kind: "flak",
            splash: 30,
            trail: [],
            shieldPierce: false,
          });
        }
        this.ev({ type: "fire", x: b.x, y: b.y, raceId: -1 });
      }
    }
    // bullet vs boss
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bl = this.bullets[i]!;
      if (bl.raceId === -1) continue;
      if (Math.hypot(bl.x - b.x, bl.y - b.y) < b.radius + bl.radius) {
        b.hp -= bl.dmg;
        this.ev({ type: "bosshit", x: bl.x, y: bl.y });
        if (bl.pierce > 0) bl.pierce--;
        else this.bullets.splice(i, 1);
        if (b.hp <= 0) {
          b.alive = false;
          this.ev({ type: "bosskill", x: b.x, y: b.y, size: 180 });
          this.ev({ type: "explode", x: b.x, y: b.y, raceId: -1, size: 180 });
          // drop rewards
          const owner = this.ships.find((s) => s.id === bl.ownerId) ?? this.player;
          for (let k = 0; k < 10; k++) {
            this.resources.push({
              x: b.x + this.rng.range(-80, 80),
              y: b.y + this.rng.range(-80, 80),
              vx: this.rng.range(-60, 60),
              vy: this.rng.range(-60, 60),
              raceId: -1,
              amount: 2,
              radius: 12,
              phase: this.rng.angle(),
              anti: true,
              resType: "dark",
            });
          }
          for (let k = 0; k < 16; k++) {
            this.resources.push({
              x: b.x + this.rng.range(-90, 90),
              y: b.y + this.rng.range(-90, 90),
              vx: this.rng.range(-50, 50),
              vy: this.rng.range(-50, 50),
              raceId: Math.floor(this.rng.next() * 4),
              amount: 3,
              radius: 10,
              phase: this.rng.angle(),
              anti: false,
              resType: "stellar",
            });
          }
          if (owner) {
            this.grantXp(owner, 220);
            owner.score += 260;
            owner.bank += 40;
          }
          this.boss = null;
          break;
        }
      }
    }
    // ship vs boss collision
    const near = this.shipGrid.query(b.x, b.y, b.radius + 80, this.qShip);
    for (const s of near) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - b.x, s.y - b.y);
      if (d < s.radius + b.radius) {
        // push
        const nx = (s.x - b.x) / (d || 1);
        const ny = (s.y - b.y) / (d || 1);
        s.x += nx * 6;
        s.y += ny * 6;
        this.damage(s, 18 * dt, null, true);
      }
    }
  }

  updateGravityWells(dt: number) {
    for (let i = this.gravityWells.length - 1; i >= 0; i--) {
      const g = this.gravityWells[i]!;
      g.life -= dt;
      if (g.r < g.targetR) g.r = Math.min(g.targetR, g.r + 90 * dt);
      if (g.life <= 0) {
        this.gravityWells.splice(i, 1);
        continue;
      }
      const near = this.shipGrid.query(g.x, g.y, g.r + 60, this.qShip);
      for (const s of near) {
        if (!s.alive || s.raceId === g.raceId) continue;
        const d = Math.hypot(s.x - g.x, s.y - g.y);
        if (d < g.r && d > 5) {
          const pull = 140 * (1 - d / g.r) + 30;
          s.vx += ((g.x - s.x) / d) * pull * dt;
          s.vy += ((g.y - s.y) / d) * pull * dt;
          s.slowT = Math.max(s.slowT, 0.5);
        }
      }
    }
  }

  updateOrbital(dt: number) {
    for (let i = this.orbitalStrikes.length - 1; i >= 0; i--) {
      const o = this.orbitalStrikes[i]!;
      if (o.delay > 0) {
        o.delay -= dt;
        if (o.delay <= 0) {
          // strike!
          const near = this.shipGrid.query(o.x, o.y, o.r + 60, this.qShip);
          const owner = this.ships.find((s) => s.id === o.ownerId) ?? null;
          for (const s of near) {
            if (!s.alive || s.raceId === o.raceId || s.invulnT > 0) continue;
            const d = Math.hypot(s.x - o.x, s.y - o.y);
            if (d < o.r) {
              const falloff = 1 - d / o.r;
              this.damage(s, o.dmg * falloff, owner, false);
              s.burn += (3 + (owner ? owner.sys.orbital.lv : 0)) * falloff;
              s.squashT = 0.2;
            }
          }
          // damage bases
          for (const b of this.bases) {
            if (!b.alive || b.raceId === o.raceId) continue;
            if (Math.hypot(b.x - o.x, b.y - o.y) < o.r + b.radius) {
              this.hitBase(b, o.dmg * 0.7, o.raceId);
            }
          }
          this.ev({ type: "explode", x: o.x, y: o.y, raceId: o.raceId, size: o.r });
          this.shakeReq = Math.max(this.shakeReq, 14);
          this.hitStop = Math.max(this.hitStop, 0.07);
          o.life = 0.35;
        }
      } else {
        o.life -= dt;
        if (o.life <= 0) this.orbitalStrikes.splice(i, 1);
      }
    }
  }

  /* ---------------- hasar / ölüm ---------------- */
  damage(s: Ship, amount: number, from: Ship | null, silent: boolean, shieldPierce = false) {
    if (!s.alive || amount <= 0 || s.invulnT > 0) return;
    // cloak reduces incoming damage
    if (s.cloakT > 0) amount *= 0.45;
    s.shieldDelay = 1.6;
    s.hitFlash = 1;
    s.squashT = 0.14;
    // juice: small hitStop on heavy hit
    if (amount > 22 && !silent) this.hitStop = Math.min(0.08, this.hitStop + 0.04);

    if (s.raceId === 3 && from) {
      s.comboN = Math.min(20, s.comboN + 1);
      s.comboT = 3.5;
    }
    if (s.raceId === 2) {
      s.plates = Math.min(10, s.plates + 1);
      s.plateT = 4;
    }

    const effMax = this.effShieldMax(s);
    let shieldBroke = false;
    if (s.shield > 0 && !shieldPierce) {
      const abs = Math.min(s.shield, amount);
      s.shield -= abs;
      amount -= abs;
      if (s.shield <= 0 && abs > 0) shieldBroke = true;
      if (s.shield <= 0 && s.raceId === 0 && s.burstCd <= 0) {
        s.burstT = 2.5;
        s.burstCd = 12;
        this.ev({ type: "teleport", x: s.x, y: s.y, raceId: 0, pitch: 1.4 });
      }
    }
    if (shieldBroke) {
      this.ev({ type: "shieldbreak", x: s.x, y: s.y, raceId: s.raceId });
      this.hitStop = Math.max(this.hitStop, 0.06);
      if (s.isPlayer) this.shakeReq = Math.max(this.shakeReq, 7);
    }
    if (amount > 0 && s.raceId === 2 && s.plates > 0) amount *= 1 - s.plates * 0.02;
    s.hp -= amount;
    if (!silent && s.isPlayer) this.shakeReq = Math.min(16, this.shakeReq + amount * 0.22);
    else if (!silent && amount > 30) this.shakeReq = Math.min(10, this.shakeReq + amount * 0.08);
    if (s.channelT > 0 && this.rng.next() < 0.3) {
      s.channelT = 0;
      this.damage(s, 22, null, true);
    }
    if (s.hp <= 0) this.kill(s, from);
  }

  kill(s: Ship, killer: Ship | null) {
    s.alive = false;
    s.respawnT = s.isPlayer ? 999 : 4;
    s.deadT = 0;
    this.hitStop = Math.max(this.hitStop, 0.09);
    this.ev({ type: "explode", x: s.x, y: s.y, raceId: s.raceId, size: s.radius * 2.2 });
    for (let i = 0; i < Math.min(8, 3 + s.level / 3); i++) {
      this.resources.push({
        x: s.x + this.rng.range(-30, 30),
        y: s.y + this.rng.range(-30, 30),
        vx: this.rng.range(-90, 90),
        vy: this.rng.range(-90, 90),
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
      // combo stacking
      killer.comboN = Math.min(20, killer.comboN + 2);
      killer.comboT = 3.5;
      this.ev({
        type: "combo",
        x: killer.x,
        y: killer.y,
        raceId: killer.raceId,
        text: `KOMBO ${killer.comboN}`,
      });
    }
    this.onKill?.(killer?.raceId ?? -1, s.raceId, killer?.level ?? 0, s.level);
    const colorMap = ["#5fd4ff", "#3f7fff", "#7ad13a", "#ff5a3c"];
    const text = killer ? `${killer.name} ⟶ ${s.name}` : `${s.name} yok edildi`;
    this.killfeed.unshift({
      id: this.rng.next(),
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
    s.x = b.x + this.rng.next() * 240 - 120;
    s.y = b.y + this.rng.next() * 240 - 120;
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
    if (s.xpBuffT > 0) amount *= 2;
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
          if (r.resType === "solar" && this.rng.next() < dt * 4)
            this.ev({ type: "solarmine", x: r.x, y: r.y });
          else if (r.resType === "dark" && this.rng.next() < dt * 4)
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
          if (this.rng.next() < dt * 5) this.ev({ type: "void", x: r.x, y: r.y, pitch: 2.2 });
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
      if (this.rng.next() < dt * 8)
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
          if (this.rng.next() < 0.12) {
            this.spawnAnti(a.x + this.rng.next() * 40 - 20, a.y + this.rng.next() * 40 - 20, true);
          } else {
            this.resources.push({
              x: a.x + this.rng.next() * 40 - 20,
              y: a.y + this.rng.next() * 40 - 20,
              vx: this.rng.next() * 80 - 40,
              vy: this.rng.next() * 80 - 40,
              raceId: Math.floor(this.rng.next() * 4),
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
            if (this.rng.next() < 0.2)
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
          if (this.rng.next() < dt * 3) this.ev({ type: "void", x: s.x, y: s.y, pitch: 0.5 });
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
      case "overcharge": {
        st.cd = 15 - st.lv * 0.8;
        s.overchargeT = 5 + st.lv * 0.4;
        s.overheatT = 0;
        this.ev({ type: "overcharge", x: s.x, y: s.y, raceId: s.raceId });
        break;
      }
      case "cloak": {
        st.cd = 13 - st.lv * 0.7;
        s.cloakT = 2.5 + st.lv * 0.35;
        s.cloakStrike = false;
        s.invulnT = Math.max(s.invulnT, 0.15);
        this.ev({ type: "cloak", x: s.x, y: s.y, raceId: s.raceId });
        break;
      }
      case "emp": {
        st.cd = 14 - st.lv * 0.8;
        const rad = 280 + st.lv * 28;
        const near = this.shipGrid.query(s.x, s.y, rad, this.qShip);
        for (const o of near) {
          if (!o.alive || o.raceId === s.raceId || o.invulnT > 0) continue;
          const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (d < rad) {
            const drain = o.maxShield * (0.45 + st.lv * 0.06);
            o.shield = Math.max(0, o.shield - drain);
            o.shieldDelay = 2.2;
            o.stunT = Math.max(o.stunT, 0.7 + st.lv * 0.18);
            o.slowT = Math.max(o.slowT, 1.6);
            o.hitFlash = 1;
            o.squashT = 0.18;
          }
        }
        // also drain structures
        for (const stt of this.structures) {
          if (stt.raceId === s.raceId) continue;
          if (Math.hypot(stt.x - s.x, stt.y - s.y) < rad) {
            stt.shield = Math.max(0, stt.shield - stt.maxShield * 0.6);
            stt.hp -= 26;
          }
        }
        this.ev({ type: "emp", x: s.x, y: s.y, raceId: s.raceId, size: rad });
        this.hitStop = Math.max(this.hitStop, 0.06);
        this.shakeReq = Math.max(this.shakeReq, 9);
        break;
      }
      case "nanite": {
        st.cd = 16 - st.lv * 0.8;
        const heal = s.maxHp * (0.28 + st.lv * 0.05);
        s.hp = Math.min(s.maxHp, s.hp + heal);
        s.shield = Math.min(this.effShieldMax(s), s.shield + s.maxShield * 0.2);
        // dostları onar
        const rad = 340 + st.lv * 24;
        const near = this.shipGrid.query(s.x, s.y, rad, this.qShip);
        for (const o of near) {
          if (!o.alive || o.raceId !== s.raceId || o === s) continue;
          const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (d < rad) {
            o.hp = Math.min(o.maxHp, o.hp + heal * 0.5);
            o.shield = Math.min(this.effShieldMax(o), o.shield + o.maxShield * 0.12);
          }
        }
        this.ev({ type: "nanite", x: s.x, y: s.y, raceId: s.raceId });
        break;
      }
      case "gravity": {
        st.cd = 18 - st.lv * 0.9;
        const rad = 180 + st.lv * 18;
        const tr = 110 + st.lv * 18;
        this.gravityWells.push({
          x: s.x + Math.cos(s.angle) * 90,
          y: s.y + Math.sin(s.angle) * 90,
          r: 30,
          targetR: tr,
          life: 5 + st.lv * 0.6,
          raceId: s.raceId,
          ownerId: s.id,
        });
        // anlık çekim de uygula
        const near = this.shipGrid.query(s.x, s.y, rad + 260, this.qShip);
        for (const o of near) {
          if (!o.alive || o.raceId === s.raceId) continue;
          const d = Math.hypot(o.x - s.x, o.y - s.y);
          if (d < rad + 200 && d > 10) {
            const dx = s.x - o.x,
              dy = s.y - o.y;
            const pull = 420 / Math.max(40, d);
            o.vx += (dx / d) * pull * 0.12;
            o.vy += (dy / d) * pull * 0.12;
            o.slowT = Math.max(o.slowT, 1.2);
          }
        }
        this.ev({ type: "gravity", x: s.x, y: s.y, raceId: s.raceId });
        break;
      }
      case "orbital": {
        st.cd = 22 - st.lv * 1.0;
        const tx = cmd.ax;
        const ty = cmd.ay;
        // clamp to within 900 of caster to prevent map-wide
        const dx = tx - s.x,
          dy = ty - s.y;
        const d = Math.hypot(dx, dy);
        const mx = d > 900 ? s.x + (dx / d) * 900 : tx;
        const my = d > 900 ? s.y + (dy / d) * 900 : ty;
        this.orbitalStrikes.push({
          x: mx,
          y: my,
          r: 150 + st.lv * 12,
          delay: 1.8,
          life: 1.0,
          dmg: 160 + st.lv * 32,
          raceId: s.raceId,
          ownerId: s.id,
        });
        this.ev({ type: "orbital", x: mx, y: my, raceId: s.raceId, size: 150 + st.lv * 12 });
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
      if (s.sys.blink.lv > 0 && s.sys.blink.cd <= 0 && this.rng.next() < 0.02) {
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
      if (s.sys.gas.lv > 0 && s.sys.gas.cd <= 0 && d < 380 && this.rng.next() < 0.015)
        c.use = "gas";
      if (s.sys.blink.lv > 0 && s.sys.blink.cd <= 0 && d > 640 && this.rng.next() < 0.012) {
        c.ax = enemy.x;
        c.ay = enemy.y;
        c.use = "blink";
      }
      if (s.sys.emp.lv > 0 && s.sys.emp.cd <= 0 && d < 340 && this.rng.next() < 0.018)
        c.use = "emp";
      if (
        s.sys.cloak.lv > 0 &&
        s.sys.cloak.cd <= 0 &&
        s.hp < s.maxHp * 0.45 &&
        this.rng.next() < 0.012
      )
        c.use = "cloak";
      if (s.sys.overcharge.lv > 0 && s.sys.overcharge.cd <= 0 && this.rng.next() < 0.01)
        c.use = "overcharge";
      if (
        s.sys.nanite.lv > 0 &&
        s.sys.nanite.cd <= 0 &&
        s.hp < s.maxHp * 0.42 &&
        this.rng.next() < 0.016
      )
        c.use = "nanite";
      if (s.sys.gravity.lv > 0 && s.sys.gravity.cd <= 0 && d < 420 && this.rng.next() < 0.01)
        c.use = "gravity";
      if (s.sys.orbital.lv > 0 && s.sys.orbital.cd <= 0 && d < 700 && this.rng.next() < 0.008) {
        c.ax = enemy.x;
        c.ay = enemy.y;
        c.use = "orbital";
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
      const cdMap: Record<string, number> = {
        shield: 18,
        blink: 7,
        trap: 11,
        gas: 17,
        overcharge: 15,
        cloak: 13,
        emp: 14,
        nanite: 16,
        gravity: 18,
        orbital: 22,
        mine: 0,
        turbo: 0,
      };
      sysHud[k] = {
        lv: st.lv,
        cd: Math.max(0, st.cd),
        cdMax: cdMap[def.key] ?? 1,
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
      roundLeft: Math.max(0, Math.ceil(this.session.t)),
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
      comboN: p.comboN,
      comboMul: p.comboMul,
      crates: this.crates.map((c) => ({ x: c.x, y: c.y, type: c.type })),
      boss: this.boss
        ? {
            x: this.boss.x,
            y: this.boss.y,
            hp: this.boss.hp,
            maxHp: this.boss.maxHp,
            alive: this.boss.alive,
          }
        : null,
      bossWarning: this.bossWarning,
      gates: this.gates.map((g) => ({ x: g.x, y: g.y, pairId: g.pairId })),
      warpCd: p.warpCd,
      cloakT: p.cloakT,
      overchargeT: p.overchargeT,
      overheatT: p.overheatT,
      damageBuffT: p.damageBuffT,
      speedBuffT: p.speedBuffT,
      vacuumT: p.vacuumT,
      xpBuffT: p.xpBuffT,
      hitStop: this.hitStop,
      roundElapsed: Math.floor(this.time),
    };
  }
}
