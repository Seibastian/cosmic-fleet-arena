/* CosmoWar Arena — ırk verisi, dallanan gemi ağacı üreteci, prosedürel gövde çizimi */
import { clamp } from "./core";

export const WORLD = 9000;
export const MAX_LEVEL = 25;
export const BRANCH_LEVELS = [6, 11, 16, 21] as const;

export type WeaponKind = "pulse" | "torpedo" | "slug" | "flak";
export type SizeClass = "scout" | "fighter" | "gunship" | "cruiser" | "dread";

export interface Weapon {
  kind: WeaponKind;
  shots: number;
  spread: number;
  speed: number;
  life: number;
  dmgMul: number;
  rateMul: number;
  homing: number;
  pierce: number;
  burn: number;
  radius: number;
  splash: number;
}

export interface Tier {
  level: number;
  name: string;
  sizeClass: SizeClass;
  radius: number;
  maxHp: number;
  maxShield: number;
  shieldRegen: number;
  speed: number;
  accel: number;
  turnRate: number;
  damage: number;
  fireRate: number;
  cargoCap: number;
  xpToNext: number;
  mass: number;
  weapon: Weapon;
  variant: number;
  accent: string | null;
}

export interface RaceDef {
  id: number;
  name: string;
  title: string;
  color: string;
  glow: string;
  dark: string;
  resource: string;
  perk: string;
  passive: string;
  base: { x: number; y: number };
  prefixes: string[];
  suffixes: string[];
  elites: string[];
  weapon: WeaponKind;
}

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

export type ResType = "mineral" | "solar" | "stellar" | "dark";
export type DefenseType = "wall" | "shield" | "fortress";
export const DEFENSE_COSTS: Record<
  DefenseType,
  { resources: number; hp: number; shield: number; desc: string }
> = {
  wall: {
    resources: 12,
    hp: 280,
    shield: 0,
    desc: "Yüksek HP duvarı — mermi ve gemi çarpmalarını emer",
  },
  shield: {
    resources: 18,
    hp: 140,
    shield: 220,
    desc: "Yenilenen kalkan bariyeri — geçişleri yavaşlatır",
  },
  fortress: {
    resources: 26,
    hp: 200,
    shield: 0,
    desc: "Otomatik taret — menzildeki düşmanlara ateş eder",
  },
};
export const DEFENSE_LABELS: Record<DefenseType, string> = {
  wall: "Uzay Duvarı",
  shield: "Kalkan Bariyeri",
  fortress: "Savaş Kalesi",
};

export const BASE_STAGES = ["Karakol", "İstasyon", "Kale", "Sitadel", "Anavatan Çekirdeği"];
export const baseStageOf = (lv: number) => Math.min(5, Math.ceil(lv / 5)) - 1;
export const baseUpgradeCost = (lv: number) => Math.round(220 * Math.pow(1.32, lv - 1));

const P = WORLD * 0.14;
const Q = WORLD * 0.86;

const RAW: RaceDef[] = [
  {
    id: 0,
    name: "Hava",
    title: "Zefir Sürüsü",
    color: "#5fd4ff",
    glow: "#a8ecff",
    dark: "#0d2b38",
    resource: "Hava Kristali",
    perk: "Aşırı çevik · hızlı darbe topları · en yüksek ateş hızı",
    passive: "Rüzgâr Patlaması: kalkan sıfırlandığında kısa süreli hız patlaması",
    base: { x: P, y: P },
    weapon: "pulse",
    prefixes: [
      "Esinti",
      "Rüzgâr",
      "Fırtına",
      "Kasırga",
      "Bora",
      "Hortum",
      "Zefir",
      "Semum",
      "Muson",
      "Tayfun",
    ],
    suffixes: [
      "Böceği",
      "Avcısı",
      "Yıldızı",
      "Kanadı",
      "Kruvazörü",
      "Fırkateyni",
      "Muhribi",
      "Savaşçısı",
      "Anaforu",
      "Titanı",
    ],
    elites: [
      "Fırtına Kılıcı",
      "Sessiz Kasırga",
      "Gökyüzü Jiletleri",
      "Bora Yankısı",
      "Tayfun Muharibi",
      "Şimşek Avı",
      "Semum Hayaleti",
      "Muson Egemeni",
      "Rüzgâr Tahtı",
      "Esinti Ustası",
      "Anafor Tacı",
      "Hortum Kıran",
      "Zefir İmparatoru",
      "Ceyran Anası",
      "Kanatlı Yargı",
      "Göktepe Efendisi",
    ],
  },
  {
    id: 1,
    name: "Su",
    title: "Derin Ahit",
    color: "#3f7fff",
    glow: "#9fc0ff",
    dark: "#101f45",
    resource: "Su Özü",
    perk: "Güdümlü torpidolar · güçlü kalkan yenilenmesi",
    passive: "Yaşam Sızması: yakındaki müttefiklerin kalkanını ve gövdesini onarır",
    base: { x: Q, y: P },
    weapon: "torpedo",
    prefixes: [
      "Dalga",
      "Girdap",
      "Med",
      "Cezir",
      "Akıntı",
      "Damla",
      "Okyanus",
      "Derin",
      "Meltem",
      "Buz",
    ],
    suffixes: [
      "Balığı",
      "Avcısı",
      "Prizması",
      "Kabuğu",
      "Kruvazörü",
      "Fırkateyni",
      "Muhribi",
      "Kaşifi",
      "Devi",
      "Efendisi",
    ],
    elites: [
      "Gelgit Kıran",
      "Uçurum Bekçisi",
      "Abis Efendisi",
      "Dipsiz Yargı",
      "Prizma Kraliçesi",
      "Akıntı Fatih'i",
      "Buz Kalbi",
      "Cezir Anası",
      "Okyanus Tacı",
      "Dalga Kesici",
      "Girdap Tahtı",
      "Derin Susturan",
      "Meltem Rahibesi",
      "Kabuk Yıkıcısı",
      "Su Anası",
      "Mavi Egemen",
    ],
  },
  {
    id: 2,
    name: "Toprak",
    title: "Granit Hanedan",
    color: "#7ad13a",
    glow: "#cdf39a",
    dark: "#1d3312",
    resource: "Toprak Cevheri",
    perk: "Delici ağır gülleler · en kalın zırh ve kargo",
    passive: "Adaptif Zırh: her aldığı hasar geçici zırh yığını biriktirir",
    base: { x: P, y: Q },
    weapon: "slug",
    prefixes: [
      "Kaya",
      "Toprak",
      "Dağ",
      "Kütle",
      "Çekirdek",
      "Granit",
      "Zırh",
      "Kök",
      "Heybet",
      "Demir",
    ],
    suffixes: [
      "Böceği",
      "Kaplanı",
      "Zırhlısı",
      "Bastionu",
      "Kruvazörü",
      "Fırkateyni",
      "Muhribi",
      "Kalesi",
      "Devi",
      "Anıtı",
    ],
    elites: [
      "Bastion Anahtarı",
      "Deprem Kalıbı",
      "Granit Yürek",
      "Kaya Egemeni",
      "Kök Sarsan",
      "Anıt Kıran",
      "Demir Ferman",
      "Kütle Yargıcı",
      "Dağ Tahtı",
      "Çekirdek Muhafızı",
      "Zırh Fatih'i",
      "Heybet Kulesi",
      "Toprak Anası",
      "Kaplan Kalibi",
      "Kale Efendisi",
      "Taş Devrin Sonu",
    ],
  },
  {
    id: 3,
    name: "Ateş",
    title: "Nova Kartelı",
    color: "#ff5a3c",
    glow: "#ffb59a",
    dark: "#3a1408",
    resource: "Ateş Küresi",
    perk: "Saçma flak salvosu · yakma hasarı",
    passive: "Kor Zinciri: art arda vuruşlar hasar yığını biriktirir",
    base: { x: Q, y: Q },
    weapon: "flak",
    prefixes: [
      "Alev",
      "Kor",
      "Kıvılcım",
      "Volkan",
      "Magma",
      "Cehennem",
      "Kül",
      "Şimşek",
      "Nova",
      "Güneş",
    ],
    suffixes: [
      "Böceği",
      "Avcısı",
      "Yıldızı",
      "Kanadı",
      "Kruvazörü",
      "Fırkateyni",
      "Muhribi",
      "Savaşçısı",
      "Anaforu",
      "Titanı",
    ],
    elites: [
      "Nova Kıran",
      "Kor Biçeri",
      "Güneş Mızrağı",
      "Kül Yutan",
      "Magma Egemeni",
      "Cehennem Nefesi",
      "Alev Tacı",
      "Volkan Yargıcı",
      "Kıvılcım Avcısı",
      "Şimşek Ocağı",
      "Yanan Ferman",
      "Kızıl Hasat",
      "Titan Ocakları",
      "Son Kor",
      "Ateş Anası",
      "Kavruk Egemen",
    ],
  },
];

/* ---------- dallanan ağaç tanımları ---------- */

interface StatBag {
  hpMul: number;
  shMul: number;
  regenMul: number;
  dmgMul: number;
  spdMul: number;
  accMul: number;
  turnMul: number;
  rateMul: number;
  bspdMul: number;
  blifeMul: number;
  pierceAdd: number;
  shotsAdd: number;
  splashSet: number;
  cargoAdd: number;
  massMul: number;
  radMul: number;
}
type LayerDef = {
  id: string;
  short: string;
  name: string;
  desc: string;
  sharp: number;
  apply: (b: StatBag) => void;
};

const ATK: LayerDef = {
  id: "atk",
  short: "Hücum",
  name: "Saldırı Hattı",
  desc: "+%20 hasar, +%5 hız — kırılgan gövde",
  sharp: 0.45,
  apply: (b) => {
    b.dmgMul *= 1.2;
    b.hpMul *= 0.9;
    b.spdMul *= 1.05;
    b.turnMul *= 1.05;
  },
};
const DEF: LayerDef = {
  id: "def",
  short: "Savunma",
  name: "Savunma Hattı",
  desc: "+%22 can, +%18 kalkan — ağır gövde",
  sharp: -0.4,
  apply: (b) => {
    b.hpMul *= 1.22;
    b.shMul *= 1.18;
    b.regenMul *= 1.3;
    b.rateMul *= 0.95;
    b.spdMul *= 0.96;
    b.radMul *= 1.06;
    b.massMul *= 1.15;
  },
};
const RNG_: LayerDef = {
  id: "rng",
  short: "Menzil",
  name: "Menzil Uzmanı",
  desc: "+%22 mermi hızı, +%30 menzil",
  sharp: 0.25,
  apply: (b) => {
    b.bspdMul *= 1.22;
    b.blifeMul *= 1.3;
    b.dmgMul *= 1.08;
    b.rateMul *= 1.05;
  },
};
const CSE: LayerDef = {
  id: "cse",
  short: "Yakın",
  name: "Yakın Muharebe Uzmanı",
  desc: "+%28 ateş hızı, +%8 hız",
  sharp: 0.55,
  apply: (b) => {
    b.rateMul *= 0.78;
    b.dmgMul *= 1.06;
    b.spdMul *= 1.08;
    b.turnMul *= 1.1;
  },
};
const BLW: LayerDef = {
  id: "blw",
  short: "Burç",
  name: "Burç Uzmanı",
  desc: "+%35 kalkan kapasitesi, +%45 rejenerasyon",
  sharp: -0.55,
  apply: (b) => {
    b.shMul *= 1.35;
    b.regenMul *= 1.45;
    b.hpMul *= 1.05;
    b.spdMul *= 0.95;
  },
};
const RCV: LayerDef = {
  id: "rcv",
  short: "Tepki",
  name: "Reaktif Zırh",
  desc: "+%12 can, +%15 dönüş — çevik tank",
  sharp: -0.2,
  apply: (b) => {
    b.hpMul *= 1.12;
    b.turnMul *= 1.15;
    b.dmgMul *= 1.05;
    b.rateMul *= 0.95;
  },
};
const SNG: LayerDef = {
  id: "sng",
  short: "Tekil",
  name: "Tekil Hedef",
  desc: "+%28 hasar, +1 delme — üs/boss kırıcı",
  sharp: 0.3,
  apply: (b) => {
    b.dmgMul *= 1.28;
    b.pierceAdd += 1;
    b.bspdMul *= 1.1;
  },
};
const AOE: LayerDef = {
  id: "aoe",
  short: "Alan",
  name: "Alan Etkisi",
  desc: "+1 mermi, patlama alanı — sürü kırıcı",
  sharp: 0.1,
  apply: (b) => {
    b.shotsAdd += 1;
    b.splashSet = 46;
    b.dmgMul *= 0.88;
    b.rateMul *= 1.05;
  },
};
const ELX: LayerDef = {
  id: "ax",
  short: "Elit",
  name: "Elit: Yıldırım",
  desc: "Final uzmanlaşma — saldırı ağırlıklı elit gövde",
  sharp: 0.35,
  apply: (b) => {
    b.dmgMul *= 1.1;
    b.spdMul *= 1.06;
  },
};
const ELY: LayerDef = {
  id: "bx",
  short: "Elit",
  name: "Elit: Kalyon",
  desc: "Final uzmanlaşma — dayanıklılık ağırlıklı elit gövde",
  sharp: -0.35,
  apply: (b) => {
    b.shMul *= 1.12;
    b.hpMul *= 1.1;
  },
};

const ROOT_CHILDREN: [LayerDef, LayerDef] = [ATK, DEF];
const CHILDREN: Record<string, [LayerDef, LayerDef]> = {
  atk: [RNG_, CSE],
  def: [BLW, RCV],
  rng: [SNG, AOE],
  cse: [SNG, AOE],
  blw: [SNG, AOE],
  rcv: [SNG, AOE],
  sng: [ELX, ELY],
  aoe: [ELX, ELY],
};
const ALL_DEFS: Record<string, LayerDef> = {
  atk: ATK,
  def: DEF,
  rng: RNG_,
  cse: CSE,
  blw: BLW,
  rcv: RCV,
  sng: SNG,
  aoe: AOE,
  ax: ELX,
  bx: ELY,
};

export function branchOptions(pathKey: string): [LayerDef, LayerDef] {
  if (!pathKey) return ROOT_CHILDREN;
  const last = pathKey.split(".").pop()!;
  return CHILDREN[last] ?? ROOT_CHILDREN;
}

export function leafIndexOf(pathKey: string): number {
  let idx = 0;
  for (const seg of pathKey.split(".")) {
    if (seg === "ax" || seg === "bx") idx = idx * 2 + (seg === "bx" ? 1 : 0);
  }
  return Math.min(15, idx);
}

function freshBag(): StatBag {
  return {
    hpMul: 1,
    shMul: 1,
    regenMul: 1,
    dmgMul: 1,
    spdMul: 1,
    accMul: 1,
    turnMul: 1,
    rateMul: 1,
    bspdMul: 1,
    blifeMul: 1,
    pierceAdd: 0,
    shotsAdd: 0,
    splashSet: 0,
    cargoAdd: 0,
    massMul: 1,
    radMul: 1,
  };
}

function weaponFor(kind: WeaponKind, lvl: number, t: number, b: StatBag): Weapon {
  let w: Weapon;
  switch (kind) {
    case "pulse":
      w = {
        kind,
        shots: lvl < 8 ? 1 : lvl < 16 ? 2 : 3,
        spread: 0.05,
        speed: 700 + lvl * 12,
        life: 1.0,
        dmgMul: 0.75,
        rateMul: 0.62,
        homing: 0,
        pierce: 0,
        burn: 0,
        radius: 2.4 + t * 1.4,
        splash: 0,
      };
      break;
    case "torpedo":
      w = {
        kind,
        shots: lvl < 12 ? 1 : 2,
        spread: 0.16,
        speed: 400 + lvl * 7,
        life: 2.4,
        dmgMul: 1.35,
        rateMul: 1.35,
        homing: 1.6 + t * 1.4,
        pierce: 0,
        burn: 0,
        radius: 3.6 + t * 2,
        splash: 0,
      };
      break;
    case "slug":
      w = {
        kind,
        shots: 1,
        spread: 0.02,
        speed: 620 + lvl * 9,
        life: 1.5,
        dmgMul: 2.1,
        rateMul: 1.75,
        homing: 0,
        pierce: lvl < 10 ? 0 : lvl < 20 ? 1 : 2,
        burn: 0,
        radius: 4 + t * 3,
        splash: 0,
      };
      break;
    default:
      w = {
        kind: "flak",
        shots: lvl < 6 ? 3 : lvl < 14 ? 4 : lvl < 22 ? 5 : 6,
        spread: 0.3,
        speed: 560 + lvl * 8,
        life: 0.7,
        dmgMul: 0.5,
        rateMul: 1.15,
        homing: 0,
        pierce: 0,
        burn: 2 + t * 6,
        radius: 2.8 + t * 1.4,
        splash: 0,
      };
  }
  w.speed *= b.bspdMul;
  w.life *= b.blifeMul;
  w.rateMul *= b.rateMul;
  w.pierce += b.pierceAdd;
  w.shots += b.shotsAdd;
  w.splash = b.splashSet;
  return w;
}

const ACCENTS = [
  "#ffcf4d",
  "#ff9de2",
  "#8fffac",
  "#ffe08a",
  "#c9b6ff",
  "#9df3ff",
  "#ffc38a",
  "#e2ff8a",
];

const tierCache = new Map<string, Tier>();

export function getTier(raceId: number, pathKey: string, level: number): Tier {
  const key = `${raceId}|${pathKey}|${level}`;
  const hit = tierCache.get(key);
  if (hit) return hit;
  const race = RAW[raceId]!;
  const segs = pathKey ? pathKey.split(".") : [];
  const b = freshBag();
  let sharp = 0;
  let lastName = "";
  for (let i = 0; i < segs.length; i++) {
    const def = ALL_DEFS[segs[i]!]!;
    if (level >= BRANCH_LEVELS[i]!) {
      def.apply(b);
      sharp += def.sharp;
      lastName = def.short;
    }
  }
  const t = (level - 1) / (MAX_LEVEL - 1);
  const tanky = race.weapon === "slug" ? 1.22 : race.weapon === "pulse" ? 0.84 : 1;
  const agile = race.weapon === "pulse" ? 1.18 : race.weapon === "slug" ? 0.85 : 1;
  const sizeClass: SizeClass =
    level <= 5
      ? "scout"
      : level <= 10
        ? "fighter"
        : level <= 15
          ? "gunship"
          : level <= 20
            ? "cruiser"
            : "dread";
  const trunkName = `${race.prefixes[level % 10]} ${race.suffixes[Math.floor(level / 2.6) % 10]}`;
  let name: string;
  let accent: string | null = null;
  if (level >= BRANCH_LEVELS[3]) {
    name = race.elites[leafIndexOf(pathKey)]!;
    accent = ACCENTS[leafIndexOf(pathKey) % ACCENTS.length]!;
  } else if (lastName) {
    name = `${trunkName} · ${lastName}`;
  } else {
    name = trunkName;
  }
  const tier: Tier = {
    level,
    name,
    sizeClass,
    radius: (11 + t * 26) * (race.weapon === "slug" ? 1.08 : 1) * b.radMul,
    maxHp: Math.round((40 + level * 22 + t * 90) * tanky * b.hpMul),
    maxShield: Math.round((20 + level * 12) * (race.weapon === "torpedo" ? 1.35 : 1) * b.shMul),
    shieldRegen: (3 + level * 0.7) * (race.weapon === "torpedo" ? 1.8 : 1) * b.regenMul,
    speed: (190 + level * 6) * agile * b.spdMul,
    accel: (300 + level * 8) * agile * b.accMul,
    turnRate: (4.4 - t * 1.5) * agile * b.turnMul,
    damage: (5 + level * 2.1) * b.dmgMul,
    fireRate: Math.max(0.075, 0.32 - t * 0.17) * weaponFor(race.weapon, level, t, b).rateMul,
    cargoCap: 6 + Math.floor(level * 1.4) + (race.weapon === "slug" ? 4 : 0) + b.cargoAdd,
    xpToNext: Math.round(70 * Math.pow(level, 1.32)),
    mass: (1 + t * 6 + (race.weapon === "slug" ? 1.5 : 0)) * b.massMul,
    weapon: weaponFor(race.weapon, level, t, b),
    variant: clamp(sharp, -1, 1),
    accent,
  };
  tierCache.set(key, tier);
  return tier;
}

/* ---------- renk körlüğü paletleri ---------- */

export type CBMode = "none" | "deutan" | "protan" | "tritan";
export interface RaceColors {
  color: string;
  glow: string;
  dark: string;
}

const CB_TABLE: Record<Exclude<CBMode, "none">, RaceColors[]> = {
  deutan: [
    { color: "#62b6ff", glow: "#bfe4ff", dark: "#0d2338" },
    { color: "#4763ff", glow: "#aab8ff", dark: "#131a45" },
    { color: "#3fc9b2", glow: "#a5f2e2", dark: "#0e332d" },
    { color: "#ff8a3c", glow: "#ffd0a8", dark: "#3a2408" },
  ],
  protan: [
    { color: "#79d4ff", glow: "#c9eeff", dark: "#0d2b38" },
    { color: "#3f7fff", glow: "#9fc0ff", dark: "#101f45" },
    { color: "#49c9dc", glow: "#aef0f7", dark: "#0d3038" },
    { color: "#ff6a55", glow: "#ffc0b0", dark: "#3a1408" },
  ],
  tritan: [
    { color: "#59e0e6", glow: "#b8f6f2", dark: "#0a3336" },
    { color: "#7a5cff", glow: "#c3b3ff", dark: "#201245" },
    { color: "#7ad13a", glow: "#cdf39a", dark: "#1d3312" },
    { color: "#ff5a3c", glow: "#ffb59a", dark: "#3a1408" },
  ],
};

export function racePalette(mode: CBMode): RaceColors[] {
  if (mode === "none") return RAW.map((r) => ({ color: r.color, glow: r.glow, dark: r.dark }));
  return CB_TABLE[mode].map((c) => ({ ...c }));
}

export const RACES: RaceDef[] = RAW;

export const BOT_NAMES = [
  "Vex",
  "Kaan",
  "Orion",
  "Nyx",
  "Draco",
  "Sera",
  "Torv",
  "Ilex",
  "Bora",
  "Kyra",
  "Rho",
  "Zephy",
  "Mira",
  "Onyx",
  "Talas",
  "Ferra",
  "Nova",
  "Ekin",
  "Vasa",
  "Ryn",
];

/* ---------- prosedürel gemi gövdesi ---------- */

type Pt = [number, number];

/** Her ırkın tamamen farklı siluet ailesi: Hava=ok, Su=damla, Toprak=kama, Ateş=çatal. */
function racePath(raceId: number, r: number, variant: number): Pt[] {
  const nose = 1 + variant * 0.22;
  const wing = 1 - variant * 0.18;
  switch (raceId % 4) {
    case 0 /* Hava — iğne burunlu ok, jilet kanatlar */:
      return [
        [r * 2.3 * nose, 0],
        [r * 0.35, r * 0.16 * wing],
        [-r * 0.25, r * 0.55 * wing],
        [-r * 1.05, r * 0.95 * wing],
        [-r * 0.62, r * 0.28 * wing],
        [-r * 0.78, 0],
        [-r * 0.62, -r * 0.28 * wing],
        [-r * 1.05, -r * 0.95 * wing],
        [-r * 0.25, -r * 0.55 * wing],
        [r * 0.35, -r * 0.16 * wing],
      ];
    case 1 /* Su — organik damla, geniş yarasa yüzgeçleri */:
      return [
        [r * 1.45 * nose, 0],
        [r * 0.95, r * 0.42 * wing],
        [r * 0.3, r * 0.72 * wing],
        [-r * 0.35, r * 1.18 * wing],
        [-r * 0.95, r * 0.82 * wing],
        [-r * 1.15, r * 0.34 * wing],
        [-r * 0.95, 0],
        [-r * 1.15, -r * 0.34 * wing],
        [-r * 0.95, -r * 0.82 * wing],
        [-r * 0.35, -r * 1.18 * wing],
        [r * 0.3, -r * 0.72 * wing],
        [r * 0.95, -r * 0.42 * wing],
      ];
    case 2 /* Toprak — köşeli kama, geniş zırh plakaları */:
      return [
        [r * 1.2 * nose, 0],
        [r * 1.05, r * 0.52 * wing],
        [r * 0.45, r * 0.68 * wing],
        [r * 0.45, r * 1.12 * wing],
        [-r * 0.4, r * 1.12 * wing],
        [-r * 0.72, r * 0.6 * wing],
        [-r * 1.25, r * 0.6 * wing],
        [-r * 1.25, -r * 0.6 * wing],
        [-r * 0.72, -r * 0.6 * wing],
        [-r * 0.4, -r * 1.12 * wing],
        [r * 0.45, -r * 1.12 * wing],
        [r * 0.45, -r * 0.68 * wing],
        [r * 1.05, -r * 0.52 * wing],
      ];
    default: /* Ateş — öne üç çatal, arkada dikenler */
      return [
        [r * 1.9 * nose, 0],
        [r * 0.85, r * 0.14 * wing],
        [r * 1.25, r * 0.5 * wing],
        [r * 0.4, r * 0.58 * wing],
        [-r * 0.1, r * 0.95 * wing],
        [-r * 0.7, r * 1.32 * wing],
        [-r * 0.55, r * 0.62 * wing],
        [-r * 1.3, r * 0.48 * wing],
        [-r * 0.85, 0],
        [-r * 1.3, -r * 0.48 * wing],
        [-r * 0.55, -r * 0.62 * wing],
        [-r * 0.7, -r * 1.32 * wing],
        [-r * 0.1, -r * 0.95 * wing],
        [r * 0.4, -r * 0.58 * wing],
        [r * 1.25, -r * 0.5 * wing],
        [r * 0.85, -r * 0.14 * wing],
      ];
  }
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
}

/** Gemiyi (0,0) merkezli, +x ileri yönlü çizer. */
export function drawShipShape(
  ctx: CanvasRenderingContext2D,
  raceId: number,
  r: number,
  color: string,
  dark: string,
  glow: string,
  time: number,
  variant = 0,
  accent: string | null = null,
) {
  const pts = racePath(raceId, r, variant);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.9;
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, dark);
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, glow);
  tracePath(ctx, pts);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  tracePath(ctx, pts);
  ctx.clip();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(0.8, r * 0.06);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 2, i * r * 0.34);
    ctx.lineTo(r * 2, i * r * 0.34);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.fillRect(-r * 2, r * 0.12, r * 4, r * 2);
  ctx.restore();

  tracePath(ctx, pts);
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(r * 1.1, 0);
  ctx.lineTo(-r * 1.0, 0);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = Math.max(0.8, r * 0.05);
  ctx.stroke();

  if (accent) {
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = r * 0.5;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, 0);
    ctx.lineTo(r * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }

  const pulse = 0.75 + Math.sin(time * 3) * 0.25;
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.8 * pulse;
  ctx.beginPath();
  ctx.ellipse(r * 0.35, 0, r * 0.3, r * 0.19, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fill();
  ctx.restore();

  const guns = Math.min(4, 1 + Math.floor(r / 9));
  ctx.fillStyle = "rgba(10,14,24,.9)";
  for (let i = 0; i < guns; i++) {
    const off = guns === 1 ? 0 : (i / (guns - 1) - 0.5) * r * 1.15;
    ctx.fillRect(r * 0.55, off - r * 0.06, r * 0.7, r * 0.12);
  }
}
