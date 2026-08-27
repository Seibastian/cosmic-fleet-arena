/* CosmoWar Arena — çekirdek yardımcılar: seed'li RNG, spatial hash, sayısal araçlar */

export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  angle(): number {
    return this.next() * Math.PI * 2;
  }
}

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
export const dist2 = (ax: number, ay: number, bx: number, by: number) =>
  (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

export interface Hashable {
  x: number;
  y: number;
}

/** Broad-phase spatial hash grid — mermi/gemi/kaynak sorguları için. */
export class SpatialHash<T extends Hashable> {
  private cells = new Map<number, T[]>();
  constructor(public cellSize: number) {}
  private key(cx: number, cy: number): number {
    return (cx * 73856093) ^ (cy * 19349663);
  }
  clear() {
    this.cells.clear();
  }
  insert(item: T) {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const k = this.key(cx, cy);
    const arr = this.cells.get(k);
    if (arr) arr.push(item);
    else this.cells.set(k, [item]);
  }
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs),
      x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs),
      y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]!);
      }
    }
    return out;
  }
}

export interface GameEvent {
  type:
    | "fire"
    | "hit"
    | "explode"
    | "levelup"
    | "evolve"
    | "teleport"
    | "trap"
    | "gas"
    | "deliver"
    | "baseup"
    | "basehit"
    | "alarm"
    | "lowhp"
    | "shieldbreak"
    | "win"
    | "spawn"
    | "antiget"
    | "void"
    | "domination"
    | "defensehit"
    | "solarmine"
    | "darkmine"
    | "collect"
    | "emp"
    | "nanite"
    | "cloak"
    | "gravity"
    | "orbital"
    | "overcharge"
    | "crate"
    | "bosshit"
    | "bosskill"
    | "warphop"
    | "combo";
  x?: number;
  y?: number;
  raceId?: number;
  size?: number;
  pitch?: number;
  text?: string;
}
