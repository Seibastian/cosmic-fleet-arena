/* CosmoWar Arena — Canvas2D render katmanı: kamera, dünya çizimi, bloom-lite, VFX */
import { TAU, clamp, type GameEvent } from "./core";
import {
  WORLD,
  RACES,
  drawShipShape,
  baseStageOf,
  BASE_STAGES,
  racePalette,
  type CBMode,
} from "./data";
import type { Sim } from "./sim";

export interface RenderSettings {
  shake: boolean;
  bloom: boolean;
  particles: "low" | "med" | "high";
}

const PARTICLE_BUDGET = { low: 500, med: 1000, high: 1600 };

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
  grav?: number;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pal = racePalette("none");
  camera = { x: 0, y: 0, zoom: 1, shake: 0 };
  time = 0;
  private particles: Particle[] = [];
  private bloomCv: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D | null;
  settings: RenderSettings = { shake: true, bloom: true, particles: "high" };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2D context yok");
    this.ctx = c;
    this.bloomCv = document.createElement("canvas");
    this.bloomCtx = this.bloomCv.getContext("2d");
  }

  setPalette(mode: CBMode) {
    this.pal = racePalette(mode);
  }

  handleEvent(e: GameEvent, pal = this.pal) {
    const color = e.raceId !== undefined && e.raceId >= 0 ? pal[e.raceId]!.glow : "#d9b98c";
    switch (e.type) {
      case "explode":
        this.explosion(e.x!, e.y!, e.size ?? 40, color);
        break;
      case "hit":
        this.sparks(e.x!, e.y!, 5, e.pitch === 1 ? "#fff3c4" : e.pitch === 1.6 ? "#c9a882" : color);
        break;
      case "teleport":
        this.ring(e.x!, e.y!, 46, pal[e.raceId ?? 0]!.color);
        this.sparks(e.x!, e.y!, 14, pal[e.raceId ?? 0]!.glow);
        break;
      case "levelup":
        this.ring(e.x!, e.y!, e.size ?? 60, "#ffcf4d");
        break;
      case "evolve":
        this.ring(e.x!, e.y!, 90, "#ffcf4d");
        this.ring(e.x!, e.y!, 140, pal[e.raceId ?? 0]!.glow);
        this.explosion(e.x!, e.y!, 50, pal[e.raceId ?? 0]!.glow);
        break;
      case "spawn":
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * TAU;
          const d = 90 + Math.random() * 70;
          this.particles.push({
            x: e.x! + Math.cos(a) * d,
            y: e.y! + Math.sin(a) * d,
            vx: -Math.cos(a) * d * 1.6,
            vy: -Math.sin(a) * d * 1.6,
            life: 0.7,
            maxLife: 0.7,
            r: 2.4,
            color: pal[e.raceId ?? 0]!.glow,
            kind: "spark",
          });
        }
        break;
      case "trap":
        this.ring(e.x!, e.y!, 34, pal[e.raceId ?? 0]!.color);
        break;
      case "gas":
        for (let i = 0; i < 10; i++) {
          this.puff(e.x! + rand(-40, 40), e.y! + rand(-40, 40), pal[e.raceId ?? 0]!.color);
        }
        break;
      case "deliver":
        this.ring(e.x!, e.y!, 150, pal[e.raceId ?? 0]!.glow);
        break;
      case "baseup":
        for (let i = 0; i < 3; i++) this.ring(e.x!, e.y!, 120 + i * 70, "#ffcf4d");
        this.explosion(e.x!, e.y!, 80, "#ffcf4d");
        break;
      case "antiget":
        this.explosion(e.x!, e.y!, 30, "#e0c3ff");
        break;
      case "basehit":
        this.sparks(e.x!, e.y!, 4, "#ffd07a");
        break;
      default:
        break;
    }
  }

  /* ---------------- efekt havuzu ---------------- */
  private cap() {
    return PARTICLE_BUDGET[this.settings.particles];
  }
  sparks(x: number, y: number, n: number, color: string) {
    n = Math.ceil((n * this.cap()) / PARTICLE_BUDGET.high);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU,
        sp = 60 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.15 + Math.random() * 0.25,
        maxLife: 0.4,
        r: 1 + Math.random() * 1.6,
        color,
        kind: "spark",
      });
    }
  }
  puff(x: number, y: number, color: string) {
    this.particles.push({
      x,
      y,
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      life: 0.4,
      maxLife: 0.4,
      r: 4 + Math.random() * 6,
      color,
      kind: "smoke",
    });
  }
  ring(x: number, y: number, r: number, color: string) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.55, maxLife: 0.55, r, color, kind: "ring" });
  }
  explosion(x: number, y: number, size: number, color: string) {
    this.ring(x, y, size * 2.2, color);
    this.sparks(x, y, 26, color);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU,
        sp = 20 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.6,
        maxLife: 1.1,
        r: size * (0.2 + Math.random() * 0.3),
        color: i % 3 === 0 ? "#ffd07a" : color,
        kind: "smoke",
      });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * TAU,
        sp = 60 + Math.random() * 200;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.7,
        maxLife: 1.3,
        r: 2 + Math.random() * size * 0.16,
        color,
        kind: "debris",
        rot: Math.random() * TAU,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.rot !== undefined) p.rot += dt * 4;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    const cap = this.cap();
    if (this.particles.length > cap) this.particles.splice(0, this.particles.length - cap);
  }

  /* ---------------- ana render ---------------- */
  render(sim: Sim, dt: number) {
    this.time += dt;
    const ctx = this.ctx;
    const W = this.canvas.clientWidth,
      H = this.canvas.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const p = sim.player;
    const targetX = p.alive ? p.x + p.vx * 0.22 : this.camera.x;
    const targetY = p.alive ? p.y + p.vy * 0.22 : this.camera.y;
    this.camera.x += (targetX - this.camera.x) * Math.min(1, dt * 6);
    this.camera.y += (targetY - this.camera.y) * Math.min(1, dt * 6);
    const zoomTarget = clamp(1.15 - (p.radius - 11) / 90, 0.62, 1.15);
    this.camera.zoom += (zoomTarget - this.camera.zoom) * Math.min(1, dt * 2);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 26);

    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#0a1020");
    bg.addColorStop(1, "#03050b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const shakeAmp = this.settings.shake ? this.camera.shake : 0;
    const ox = rand(-shakeAmp, shakeAmp),
      oy = rand(-shakeAmp, shakeAmp);
    const z = this.camera.zoom;
    const camX = this.camera.x + ox,
      camY = this.camera.y + oy;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const n of sim.nebulas) {
      const sx = W / 2 + (n.x - camX) * z * 0.35;
      const sy = H / 2 + (n.y - camY) * z * 0.35;
      const rr = n.r * z;
      if (sx < -rr || sx > W + rr || sy < -rr || sy > H + rr) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, n.c + "26");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, rr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    for (const s of sim.starsBg) {
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
    this.drawZones(ctx, sim);
    this.drawHoles(ctx, sim);
    this.drawStars(ctx, sim);
    this.drawBases(ctx, sim);
    this.drawAsteroids(ctx, sim);
    this.drawResources(ctx, sim);
    this.drawGases(ctx, sim);
    this.drawTraps(ctx, sim);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.drawParticles(ctx);
    this.drawBullets(ctx, sim);
    this.drawBeams(ctx, sim);
    ctx.restore();

    this.drawShips(ctx, sim, dt);
    ctx.restore();

    if (this.settings.bloom && this.bloomCtx) this.applyBloom(ctx, W, H, dpr);
    this.drawEdgeMarkers(ctx, W, H, sim);

    this.updateParticles(dt);
  }

  addShake(v: number) {
    this.camera.shake = Math.min(20, this.camera.shake + (this.settings.shake ? v : 0));
  }

  private applyBloom(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number) {
    const bw = Math.max(64, Math.floor(W / 4)),
      bh = Math.max(64, Math.floor(H / 4));
    if (this.bloomCv.width !== bw || this.bloomCv.height !== bh) {
      this.bloomCv.width = bw;
      this.bloomCv.height = bh;
    }
    const bc = this.bloomCtx!;
    bc.save();
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, bw, bh);
    bc.filter = "blur(4px) brightness(1.35) saturate(1.3)";
    bc.drawImage(this.canvas, 0, 0, bw, bh);
    bc.restore();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.42;
    ctx.drawImage(this.bloomCv, 0, 0, W, H);
    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, vw: number, vh: number) {
    const step = 500;
    const x0 = Math.floor((cx - vw / 2) / step) * step;
    const x1 = cx + vw / 2;
    const y0 = Math.floor((cy - vh / 2) / step) * step;
    const y1 = cy + vh / 2;
    ctx.strokeStyle = "rgba(120,170,255,.055)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y += step) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,90,60,.25)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD, WORLD);
  }

  private drawZones(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const zn of sim.zones()) {
      const g = ctx.createRadialGradient(zn.x, zn.y, zn.r * 0.2, zn.x, zn.y, zn.r);
      g.addColorStop(0, "rgba(255,255,255,.035)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(zn.x, zn.y, zn.r, 0, TAU);
      ctx.fill();
      ctx.setLineDash([18, 22]);
      ctx.strokeStyle = "rgba(180,210,255,.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zn.x, zn.y, zn.r, this.time * 0.05, this.time * 0.05 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawHoles(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const h of sim.holes) {
      if (!this.inView(h.x, h.y, h.pullR)) continue;
      ctx.save();
      ctx.translate(h.x, h.y);
      const danger = ctx.createRadialGradient(0, 0, h.r * 0.5, 0, 0, h.pullR);
      danger.addColorStop(0, "rgba(120,60,200,.10)");
      danger.addColorStop(0.4, "rgba(90,40,170,.05)");
      danger.addColorStop(1, "transparent");
      ctx.fillStyle = danger;
      ctx.beginPath();
      ctx.arc(0, 0, h.pullR, 0, TAU);
      ctx.fill();

      ctx.rotate(h.rot);
      for (let arm = 0; arm < 3; arm++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        for (let t = 0; t <= 24; t++) {
          const f = t / 24;
          const a = f * 4.2;
          const rr = h.r * 0.7 + f * h.r * 2.1;
          const px = Math.cos(a) * rr,
            py = Math.sin(a) * rr;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(190,130,255,.32)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.rotate(-h.rot);
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.55, 0, TAU);
      ctx.strokeStyle = "rgba(255,80,80,.28)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, h.r);
      core.addColorStop(0, "#000");
      core.addColorStop(0.72, "#0a0514");
      core.addColorStop(1, "rgba(60,20,110,.9)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, h.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const st of sim.stars) {
      if (!this.inView(st.x, st.y, st.r * 3)) continue;
      ctx.save();
      ctx.translate(st.x, st.y);
      const corona = ctx.createRadialGradient(0, 0, st.r * 0.3, 0, 0, st.r * 2.4);
      corona.addColorStop(0, "rgba(255,220,140,.5)");
      corona.addColorStop(0.45, "rgba(255,150,60,.16)");
      corona.addColorStop(1, "transparent");
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.arc(0, 0, st.r * 2.4, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.rotate(st.rot);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#ffe9b0";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(TAU / 4);
        ctx.beginPath();
        ctx.moveTo(st.r * 0.8, 0);
        ctx.lineTo(st.r * 1.9, 0);
        ctx.stroke();
      }
      ctx.restore();

      const pulse = 1 + Math.sin(this.time * 1.4) * 0.03;
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, st.r * pulse);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.55, "#ffdf9a");
      core.addColorStop(1, "#ff8a3c");
      ctx.shadowColor = "#ffb95e";
      ctx.shadowBlur = st.r * 0.5;
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, st.r * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBases(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const b of sim.bases) {
      if (!this.inView(b.x, b.y, b.radius * 2.4)) continue;
      const rc = this.pal[b.raceId]!;
      const stage = baseStageOf(b.level);
      ctx.save();
      ctx.translate(b.x, b.y);
      const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, b.radius * (1.6 + stage * 0.14));
      aura.addColorStop(0, rc.color + "3a");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * (1.6 + stage * 0.14), 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.rotate(b.rot);
      ctx.strokeStyle = rc.color;
      ctx.shadowColor = rc.color;
      ctx.shadowBlur = 24;
      for (let ring = 0; ring <= stage; ring++) {
        const rr = b.radius * (0.45 + ring * 0.24);
        ctx.lineWidth = 2 + stage * 0.5;
        ctx.beginPath();
        const sides = 6 + ring * 2;
        for (let i = 0; i <= sides; i++) {
          const a = (i / sides) * TAU + ring * 0.3;
          const px = Math.cos(a) * rr,
            py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.3 + ring * 0.14;
        ctx.stroke();
      }
      const turrets = 2 + stage * 3;
      ctx.fillStyle = rc.glow;
      for (let i = 0; i < turrets; i++) {
        const a = (i / turrets) * TAU - b.rot * 2;
        const px = Math.cos(a) * b.radius * 0.92,
          py = Math.sin(a) * b.radius * 0.92;
        ctx.beginPath();
        ctx.arc(px, py, 5 + stage, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      const coreR = b.radius * (0.2 + stage * 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, TAU);
      ctx.fillStyle = rc.glow;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(
        0,
        0,
        b.radius + 14,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * clamp(b.energy / b.energyMax, 0, 1),
      );
      ctx.strokeStyle = "#ffcf4d";
      ctx.lineWidth = 6;
      ctx.stroke();

      let zapTarget = null as null | { x: number; y: number };
      for (const s of sim.ships) {
        if (!s.alive || s.raceId === b.raceId) continue;
        const d = Math.hypot(s.x - b.x, s.y - b.y);
        if (d < b.radius + 220 && b.energy > 5) {
          zapTarget = s;
          break;
        }
      }
      if (zapTarget) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = rc.glow;
        ctx.globalAlpha = 0.5 + Math.random() * 0.4;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        const segs = 6;
        ctx.moveTo(
          Math.cos(Math.atan2(zapTarget.y - b.y, zapTarget.x - b.x)) * b.radius * 0.9,
          Math.sin(Math.atan2(zapTarget.y - b.y, zapTarget.x - b.x)) * b.radius * 0.9,
        );
        for (let i = 1; i <= segs; i++) {
          const f = i / segs;
          const jx = b.x + (zapTarget.x - b.x) * f + rand(-14, 14);
          const jy = b.y + (zapTarget.y - b.y) * f + rand(-14, 14);
          ctx.lineTo(jx, jy);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = rc.color;
      ctx.font = "bold 20px Orbitron, sans-serif";
      ctx.textAlign = "center";
      const label = `${RACES[b.raceId]!.name.toUpperCase()} ${BASE_STAGES[stage]!.toUpperCase()} · LV ${b.level}`;
      if (stage >= 3) {
        ctx.fillText(label.slice(0, 24), 0, -b.radius - 34);
        ctx.fillText(label.slice(24), 0, -b.radius - 12);
      } else {
        ctx.fillText(label, 0, -b.radius - 34);
      }
      ctx.restore();
    }
  }

  private drawAsteroids(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const a of sim.asteroids) {
      if (!this.inView(a.x, a.y, a.radius + 60)) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      for (let i = 0; i < a.shape.length; i++) {
        const ang = (i / a.shape.length) * TAU;
        const rr = a.radius * a.shape[i]!;
        const px = Math.cos(ang) * rr,
          py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
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
        ctx.arc(
          Math.cos(i * 2.1) * a.radius * 0.4,
          Math.sin(i * 3.3) * a.radius * 0.4,
          a.radius * 0.16,
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawResources(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const r of sim.resources) {
      if (!this.inView(r.x, r.y, 40)) continue;
      ctx.save();
      ctx.translate(r.x, r.y);
      const pulse = 1 + Math.sin(this.time * 3 + r.phase) * 0.16;
      const rr = r.radius * pulse;
      if (r.anti) {
        ctx.rotate(this.time * 1.4);
        ctx.shadowColor = "#c9a6ff";
        ctx.shadowBlur = 22;
        ctx.strokeStyle = "#e0c3ff";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, rr + 4, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = this.time * 3 + (i / 3) * TAU;
          ctx.fillStyle = "#f2eaff";
          ctx.beginPath();
          ctx.arc(Math.cos(a) * (rr + 9), Math.sin(a) * (rr + 9), 2, 0, TAU);
          ctx.fill();
        }
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.6, "#caa8ff");
        g.addColorStop(1, "#7a4dd6");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.fill();
      } else {
        const race = this.pal[r.raceId]!;
        ctx.rotate(r.phase * 0.4 + this.time * 0.6);
        ctx.shadowColor = race.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
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
      }
      ctx.restore();
    }
  }

  private drawTraps(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const t of sim.traps) {
      if (!this.inView(t.x, t.y, t.r + 40)) continue;
      const rc = this.pal[t.raceId]!;
      ctx.save();
      ctx.translate(t.x, t.y);
      const arming = t.armT > 0;
      const blink = arming
        ? Math.sin(this.time * 18) > 0
          ? 1
          : 0
        : 0.5 + Math.sin(this.time * 3) * 0.3;
      ctx.globalAlpha = arming ? (blink ? 0.85 : 0.15) : 0.55 + blink * 0.3;
      ctx.setLineDash([5, 9]);
      ctx.strokeStyle = rc.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, t.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(this.time * (arming ? 3 : 1));
      ctx.shadowColor = rc.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = rc.glow;
      const s = 7;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.lineTo(0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawGases(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const g of sim.gases) {
      if (!this.inView(g.x, g.y, g.r + 60)) continue;
      const rc = this.pal[g.raceId]!;
      const fade = clamp(g.life / 1.2, 0, 1);
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = rc.color;
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.13 * fade;
      ctx.fillStyle = rc.dark;
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.66, 0, TAU);
      ctx.fill();
      ctx.rotate(this.time * 0.7);
      ctx.globalAlpha = 0.22 * fade;
      ctx.strokeStyle = rc.glow;
      ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        ctx.arc(0, 0, g.r * 0.8, 0, 1.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawBeams(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const s of sim.ships) {
      if (!s.alive || s.beamTargets.length === 0) continue;
      const rc = this.pal[s.raceId]!;
      for (const t of s.beamTargets) {
        const g = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
        g.addColorStop(0, rc.glow);
        g.addColorStop(1, "transparent");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.6;
        ctx.globalAlpha = 0.75 + Math.random() * 0.25;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = rc.glow;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3 + Math.random() * 3, 0, TAU);
        ctx.fill();
      }
      if (sim.player.channelTarget && sim.player.channelT > 0 && s.isPlayer) {
        const tgt = sim.player.channelTarget;
        const f = clamp(sim.player.channelT / 1.2, 0, 1);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "#e0c3ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tgt.x, tgt.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * f);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (2 - k), 0, TAU);
        ctx.fill();
      } else if (p.kind === "debris") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBullets(ctx: CanvasRenderingContext2D, sim: Sim) {
    for (const b of sim.bullets) {
      if (!this.inView(b.x, b.y, 60)) continue;
      const col = this.pal[b.raceId]?.glow ?? "#ffffff";
      ctx.strokeStyle = col;
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
      ctx.fillStyle = col + "55";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawShips(ctx: CanvasRenderingContext2D, sim: Sim, _dt: number) {
    for (const s of sim.ships) {
      if (!s.alive || !this.inView(s.x, s.y, s.radius * 4 + 60)) continue;
      const rc = this.pal[s.raceId]!;
      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.invulnT > 0) {
        const k = clamp(s.invulnT / 1.2, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.4;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * (1.4 + (1 - k) * 1.2), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      if (s.shield > 0.5) {
        const k =
          s.shield /
          Math.max(1, s.overT > 0 ? s.maxShield * (1.3 + s.sys.shield.lv * 0.1) : s.maxShield);
        ctx.save();
        ctx.globalAlpha = 0.14 + k * 0.22 + (s.hitFlash > 0 ? 0.3 : 0);
        if (s.overT > 0) ctx.globalAlpha += 0.15;
        ctx.strokeStyle = rc.glow;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = rc.glow;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * (s.overT > 0 ? 1.75 : 1.55), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      if (s.nearWater) {
        ctx.save();
        ctx.globalAlpha = 0.12 + Math.sin(this.time * 4) * 0.04;
        ctx.fillStyle = this.pal[1]!.glow;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * 2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (s.burstT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = "#dff4ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = this.time * 6 + (i / 3) * TAU;
          ctx.moveTo(Math.cos(a) * s.radius * 1.2, Math.sin(a) * s.radius * 1.2);
          ctx.lineTo(Math.cos(a) * s.radius * 1.9, Math.sin(a) * s.radius * 1.9);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(s.angle);
      if (s.thrusting > 0) {
        const len = s.radius * (s.boosting ? 2.6 : 1.5) * (0.8 + Math.random() * 0.45);
        const g = ctx.createLinearGradient(-s.radius, 0, -s.radius - len, 0);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.35, rc.glow);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.6, s.radius * 0.34);
        ctx.lineTo(-s.radius - len, 0);
        ctx.lineTo(-s.radius * 0.6, -s.radius * 0.34);
        ctx.closePath();
        ctx.fill();
      }
      drawShipShape(
        ctx,
        s.tier.sizeClass,
        s.radius,
        rc.color,
        rc.dark,
        rc.glow,
        this.time + s.id,
        s.tier.variant,
        s.tier.accent,
      );
      if (s.hitFlash > 0) {
        ctx.globalAlpha = s.hitFlash * 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * 1.2, 0, TAU);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      const hpFrac = clamp(s.hp / s.maxHp, 0, 1);
      if (hpFrac < 0.75 && Math.random() < 0.3) {
        const bx = s.x + rand(-s.radius, s.radius),
          by = s.y + rand(-s.radius, s.radius);
        if (hpFrac < 0.25) {
          this.puff(bx, by, "#ff8a3c");
          if (Math.random() < 0.4) this.sparks(bx, by, 2, "#ffd07a");
        } else if (hpFrac < 0.5) {
          this.puff(bx, by, "#8a8f9c");
          if (Math.random() < 0.3) this.sparks(bx, by, 2, rc.glow);
        } else if (Math.random() < 0.4) {
          this.puff(bx, by, "#6b7280");
        }
      }

      ctx.save();
      ctx.translate(s.x, s.y - s.radius * 1.9 - 16);
      const w = Math.max(44, s.radius * 3);
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(-w / 2, 0, w, 5);
      ctx.fillStyle = hpFrac > 0.35 ? "#5dff9c" : "#ff5a5a";
      ctx.fillRect(-w / 2, 0, w * hpFrac, 5);
      if (s.maxShield > 0) {
        ctx.fillStyle = rc.glow;
        ctx.fillRect(-w / 2, -6, w * clamp(s.shield / Math.max(1, s.maxShield), 0, 1), 3);
      }
      ctx.font = "600 13px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = s.isPlayer ? "#ffffff" : rc.color;
      ctx.fillText(
        `${s.name} · ${s.level}${s.role === "mine" ? " ⛏" : s.role === "guard" ? " 🛡" : ""}`,
        0,
        -12,
      );
      ctx.restore();
    }
  }

  private drawEdgeMarkers(ctx: CanvasRenderingContext2D, W: number, H: number, sim: Sim) {
    const p = sim.player;
    if (!p.alive) return;
    for (const b of sim.bases) {
      const dx = b.x - this.camera.x,
        dy = b.y - this.camera.y;
      const sx = W / 2 + dx * this.camera.zoom;
      const sy = H / 2 + dy * this.camera.zoom;
      if (sx > 40 && sx < W - 40 && sy > 40 && sy < H - 40) continue;
      const a = Math.atan2(dy, dx);
      const rx = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 46);
      const ry = H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 46);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(a);
      ctx.fillStyle = this.pal[b.raceId]!.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, 6);
      ctx.lineTo(-7, -6);
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

  screenToWorld(mx: number, my: number) {
    return {
      x: this.camera.x + (mx - this.canvas.clientWidth / 2) / this.camera.zoom,
      y: this.camera.y + (my - this.canvas.clientHeight / 2) / this.camera.zoom,
    };
  }

  renderMinimap(mm: HTMLCanvasElement, sim: Sim) {
    const c = mm.getContext("2d");
    if (!c) return;
    const size = mm.width;
    const k = size / WORLD;
    c.clearRect(0, 0, size, size);
    c.fillStyle = "rgba(8,12,22,.78)";
    c.fillRect(0, 0, size, size);
    for (const zn of sim.zones()) {
      c.strokeStyle = "rgba(255,255,255,.08)";
      c.beginPath();
      c.arc(zn.x * k, zn.y * k, zn.r * k, 0, TAU);
      c.stroke();
    }
    for (const st of sim.stars) {
      c.fillStyle = "#ffcf4d";
      c.beginPath();
      c.arc(st.x * k, st.y * k, 3, 0, TAU);
      c.fill();
    }
    for (const h of sim.holes) {
      c.fillStyle = "#20124d";
      c.beginPath();
      c.arc(h.x * k, h.y * k, 3.4, 0, TAU);
      c.fill();
      c.strokeStyle = "rgba(190,130,255,.5)";
      c.stroke();
    }
    for (const b of sim.bases) {
      const rc = this.pal[b.raceId]!;
      c.fillStyle = rc.color;
      c.globalAlpha = 0.25;
      c.beginPath();
      c.arc(b.x * k, b.y * k, b.radius * k * 2.2, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      c.fillRect(b.x * k - 3, b.y * k - 3, 6, 6);
      c.fillStyle = "#fff";
      c.font = "7px Rajdhani";
      c.fillText(String(b.level), b.x * k + 4, b.y * k - 4);
    }
    c.globalAlpha = 0.55;
    for (const r of sim.resources) {
      c.fillStyle = r.anti ? "#e0c3ff" : (this.pal[r.raceId]?.color ?? "#fff");
      c.fillRect(r.x * k, r.y * k, 1.4, 1.4);
    }
    c.globalAlpha = 1;
    for (const s of sim.ships) {
      if (!s.alive) continue;
      c.fillStyle = s.isPlayer ? "#ffffff" : this.pal[s.raceId]!.color;
      c.beginPath();
      c.arc(s.x * k, s.y * k, s.isPlayer ? 3.2 : 1.7, 0, TAU);
      c.fill();
    }
    const vw = (this.canvas.clientWidth / this.camera.zoom) * k;
    const vh = (this.canvas.clientHeight / this.camera.zoom) * k;
    c.strokeStyle = "rgba(255,255,255,.45)";
    c.lineWidth = 1;
    c.strokeRect(this.camera.x * k - vw / 2, this.camera.y * k - vh / 2, vw, vh);
  }
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
