/* CosmoWar Arena — ırk, gemi kademesi ve prosedürel gemi çizim verileri */

export const WORLD = 9000;
export const MAX_LEVEL = 25;

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
  base: { x: number; y: number };
  prefixes: string[];
  suffixes: string[];
  weapon: WeaponKind;
  tiers: Tier[];
}

const P = WORLD * 0.14;
const Q = WORLD * 0.86;

const RAW: Omit<RaceDef, "tiers">[] = [
  {
    id: 0,
    name: "Hava",
    title: "Zefir Sürüsü",
    color: "#5fd4ff",
    glow: "#a8ecff",
    dark: "#0d2b38",
    resource: "Hava Kristali",
    perk: "Aşırı çevik · hızlı darbe topları · en yüksek ateş hızı",
    base: { x: P, y: P },
    weapon: "pulse",
    prefixes: ["Esinti", "Rüzgâr", "Fırtına", "Kasırga", "Bora", "Hortum", "Zefir", "Semum", "Muson", "Tayfun"],
    suffixes: ["Böceği", "Avcısı", "Yıldızı", "Kanadı", "Kruvazörü", "Fırkateyni", "Muhribi", "Savaşçısı", "Anaforu", "Titanı"],
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
    base: { x: Q, y: P },
    weapon: "torpedo",
    prefixes: ["Dalga", "Girdap", "Med", "Cezir", "Akıntı", "Damla", "Okyanus", "Derin", "Meltem", "Buz"],
    suffixes: ["Balığı", "Avcısı", "Prizması", "Kabuğu", "Kruvazörü", "Fırkateyni", "Muhribi", "Kaşifi", "Devi", "Efendisi"],
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
    base: { x: P, y: Q },
    weapon: "slug",
    prefixes: ["Kaya", "Toprak", "Dağ", "Kütle", "Çekirdek", "Granit", "Zırh", "Kök", "Heybet", "Demir"],
    suffixes: ["Böceği", "Kaplanı", "Zırhlısı", "Bastionu", "Kruvazörü", "Fırkateyni", "Muhribi", "Kalesi", "Devi", "Anıtı"],
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
    base: { x: Q, y: Q },
    weapon: "flak",
    prefixes: ["Alev", "Kor", "Kıvılcım", "Volkan", "Magma", "Cehennem", "Kül", "Şimşek", "Nova", "Güneş"],
    suffixes: ["Böceği", "Avcısı", "Yıldızı", "Kanadı", "Kruvazörü", "Fırkateyni", "Muhribi", "Savaşçısı", "Anaforu", "Titanı"],
  },
];

function weaponFor(kind: WeaponKind, lvl: number, t: number): Weapon {
  switch (kind) {
    case "pulse":
      return {
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
      };
    case "torpedo":
      return {
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
      };
    case "slug":
      return {
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
      };
    default:
      return {
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
      };
  }
}

function buildTiers(race: Omit<RaceDef, "tiers">): Tier[] {
  const tiers: Tier[] = [];
  const tanky = race.weapon === "slug" ? 1.22 : race.weapon === "pulse" ? 0.84 : 1;
  const agile = race.weapon === "pulse" ? 1.18 : race.weapon === "slug" ? 0.85 : 1;
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
    const t = (lvl - 1) / (MAX_LEVEL - 1);
    const sizeClass: SizeClass =
      lvl <= 5 ? "scout" : lvl <= 10 ? "fighter" : lvl <= 15 ? "gunship" : lvl <= 20 ? "cruiser" : "dread";
    const w = weaponFor(race.weapon, lvl, t);
    tiers.push({
      level: lvl,
      name: `${race.prefixes[lvl % 10]} ${race.suffixes[Math.floor(lvl / 2.6) % 10]}`,
      sizeClass,
      radius: (11 + t * 26) * (race.weapon === "slug" ? 1.08 : 1),
      maxHp: Math.round((40 + lvl * 22 + t * 90) * tanky),
      maxShield: Math.round((20 + lvl * 12) * (race.weapon === "torpedo" ? 1.35 : 1)),
      shieldRegen: (3 + lvl * 0.7) * (race.weapon === "torpedo" ? 1.8 : 1),
      speed: (190 + lvl * 6) * agile,
      accel: (300 + lvl * 8) * agile,
      turnRate: (4.4 - t * 1.5) * agile,
      damage: 5 + lvl * 2.1,
      fireRate: Math.max(0.075, 0.32 - t * 0.17) * w.rateMul,
      cargoCap: 2 + Math.floor(lvl / 2.2) + (race.weapon === "slug" ? 2 : 0),
      xpToNext: Math.round(70 * Math.pow(lvl, 1.32)),
      mass: 1 + t * 6 + (race.weapon === "slug" ? 1.5 : 0),
      weapon: w,
    });
  }
  return tiers;
}

export const RACES: RaceDef[] = RAW.map((r) => ({ ...r, tiers: buildTiers(r) }));

/* ---------- prosedürel gemi gövdesi ---------- */

type Pt = [number, number];

function hullPath(sizeClass: SizeClass, r: number): Pt[] {
  switch (sizeClass) {
    case "scout":
      return [
        [r * 1.35, 0],
        [r * 0.1, r * 0.42],
        [-r * 0.85, r * 0.78],
        [-r * 0.45, 0],
        [-r * 0.85, -r * 0.78],
        [r * 0.1, -r * 0.42],
      ];
    case "fighter":
      return [
        [r * 1.45, 0],
        [r * 0.55, r * 0.3],
        [r * 0.05, r * 0.55],
        [-r * 0.55, r * 1.05],
        [-r * 0.95, r * 0.75],
        [-r * 0.6, r * 0.18],
        [-r * 0.6, -r * 0.18],
        [-r * 0.95, -r * 0.75],
        [-r * 0.55, -r * 1.05],
        [r * 0.05, -r * 0.55],
        [r * 0.55, -r * 0.3],
      ];
    case "gunship":
      return [
        [r * 1.4, 0],
        [r * 0.7, r * 0.34],
        [r * 0.2, r * 0.5],
        [-r * 0.2, r * 0.55],
        [-r * 0.75, r * 1.15],
        [-r * 1.15, r * 0.85],
        [-r * 0.9, r * 0.25],
        [-r * 1.05, 0],
        [-r * 0.9, -r * 0.25],
        [-r * 1.15, -r * 0.85],
        [-r * 0.75, -r * 1.15],
        [-r * 0.2, -r * 0.55],
        [r * 0.2, -r * 0.5],
        [r * 0.7, -r * 0.34],
      ];
    case "cruiser":
      return [
        [r * 1.55, 0],
        [r * 0.95, r * 0.28],
        [r * 0.4, r * 0.6],
        [-r * 0.1, r * 0.68],
        [-r * 0.5, r * 1.3],
        [-r * 1.05, r * 1.2],
        [-r * 1.25, r * 0.5],
        [-r * 1.55, r * 0.22],
        [-r * 1.55, -r * 0.22],
        [-r * 1.25, -r * 0.5],
        [-r * 1.05, -r * 1.2],
        [-r * 0.5, -r * 1.3],
        [-r * 0.1, -r * 0.68],
        [r * 0.4, -r * 0.6],
        [r * 0.95, -r * 0.28],
      ];
    default:
      return [
        [r * 1.75, 0],
        [r * 1.05, r * 0.3],
        [r * 0.5, r * 0.55],
        [r * 0.05, r * 0.72],
        [-r * 0.35, r * 0.8],
        [-r * 0.7, r * 1.5],
        [-r * 1.2, r * 1.45],
        [-r * 1.35, r * 0.62],
        [-r * 1.8, r * 0.3],
        [-r * 1.35, 0],
        [-r * 1.8, -r * 0.3],
        [-r * 1.35, -r * 0.62],
        [-r * 1.2, -r * 1.45],
        [-r * 0.7, -r * 1.5],
        [-r * 0.35, -r * 0.8],
        [r * 0.05, -r * 0.72],
        [r * 0.5, -r * 0.55],
        [r * 1.05, -r * 0.3],
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
  sizeClass: SizeClass,
  r: number,
  color: string,
  dark: string,
  glow: string,
  time: number,
) {
  const pts = hullPath(sizeClass, r);

  // dış hale
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

  // panel çizgileri
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

  // gövde kenarı
  tracePath(ctx, pts);
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.stroke();

  // omurga
  ctx.beginPath();
  ctx.moveTo(r * 1.1, 0);
  ctx.lineTo(-r * 1.0, 0);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = Math.max(0.8, r * 0.05);
  ctx.stroke();

  // kokpit
  const pulse = 0.75 + Math.sin(time * 3) * 0.25;
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.8 * pulse;
  ctx.beginPath();
  ctx.ellipse(r * 0.35, 0, r * 0.3, r * 0.19, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fill();
  ctx.restore();

  // silah namluları
  const guns = sizeClass === "scout" ? 1 : sizeClass === "fighter" ? 2 : sizeClass === "gunship" ? 3 : 4;
  ctx.fillStyle = "rgba(10,14,24,.9)";
  for (let i = 0; i < guns; i++) {
    const off = guns === 1 ? 0 : (i / (guns - 1) - 0.5) * r * 1.15;
    ctx.fillRect(r * 0.55, off - r * 0.06, r * 0.7, r * 0.12);
  }
}
