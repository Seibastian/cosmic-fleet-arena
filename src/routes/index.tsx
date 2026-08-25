import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RACES } from "@/game/data";
import { Game, UP_KEYS, UP_LABELS, type HudState, type UpKey } from "@/game/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CosmoWar Arena — Dört Irk, Tek Galaksi" },
      {
        name: "description",
        content:
          "CosmoWar Arena: 25 gemi kademesi, dört ırk, gerçek atalet fiziği ve yoğun uzay savaşları. Maden topla, üssünü güçlendir, filoları yok et.",
      },
      { property: "og:title", content: "CosmoWar Arena — Dört Irk, Tek Galaksi" },
      {
        property: "og:description",
        content: "Atalet fizikli tarayıcı uzay arenası: 4 ırk, 100 gemi kademesi, sonsuz çatışma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const RACE_CLASS: Record<number, string> = {
  0: "text-air",
  1: "text-water",
  2: "text-earth",
  3: "text-fire",
};

function Bar({ value, className }: { value: number; className: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full border border-border/70 bg-secondary/60">
      <div
        className={`h-full rounded-full transition-[width] duration-150 ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function ShipIcon({ raceId, className }: { raceId: number; className?: string }) {
  const race = RACES[raceId]!;
  const shapes = [
    "M22,0 L-4,12 L-8,0 L-4,-12 Z",
    "M22,0 L4,8 L-12,16 L-8,0 L-12,-16 L4,-8 Z",
    "M20,0 L6,7 L-14,14 L-16,0 L-14,-14 L6,-7 Z",
    "M24,0 L8,7 L-6,10 L-16,18 L-20,0 L-16,-18 L-6,-10 L8,-7 Z",
  ];
  return (
    <svg viewBox="-26 -22 52 44" className={className}>
      <defs>
        <linearGradient id={`g${raceId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={race.dark} />
          <stop offset="60%" stopColor={race.color} />
          <stop offset="100%" stopColor={race.glow} />
        </linearGradient>
      </defs>
      <path d={shapes[raceId % 4]!} fill={`url(#g${raceId})`} stroke="rgba(255,255,255,.65)" strokeWidth="1.2" />
      <circle cx="6" cy="0" r="3" fill="#fff" opacity=".9" />
    </svg>
  );
}

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mmRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [raceId, setRaceId] = useState<number | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [hovered, setHovered] = useState<number>(0);

  useEffect(() => {
    if (!started || raceId === null || !canvasRef.current) return;
    const game = new Game(canvasRef.current, raceId);
    gameRef.current = game;
    game.onHud = (h) => {
      setHud(h);
      if (mmRef.current) game.renderMinimap(mmRef.current);
    };
    game.start();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, [started, raceId]);

  const upgrade = useCallback((k: UpKey) => gameRef.current?.spendUpgrade(k), []);

  if (!started) {
    const race = RACES[hovered]!;
    return (
      <main className="relative h-screen w-full overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 600px at 20% 20%, oklch(0.83 0.12 220 / .16), transparent), radial-gradient(900px 700px at 80% 70%, oklch(0.68 0.2 33 / .16), transparent)",
            }}
          />
        </div>
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
          <h1 className="bg-gradient-to-r from-air via-gold to-fire bg-clip-text text-5xl font-black text-transparent sm:text-7xl">
            COSMOWAR ARENA
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.4em] text-muted-foreground">
            Dört Irk · 25 Gemi Kademesi · Sonsuz Çatışma
          </p>

          <div className="mt-12 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RACES.map((r) => (
              <button
                key={r.id}
                onMouseEnter={() => setHovered(r.id)}
                onClick={() => {
                  setRaceId(r.id);
                  setStarted(true);
                }}
                className="hud-panel group relative overflow-hidden p-5 text-left transition-transform duration-200 hover:-translate-y-2"
                style={{ boxShadow: `0 0 0 1px ${r.color}22` }}
              >
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ background: `radial-gradient(300px 160px at 50% 0%, ${r.color}22, transparent)` }}
                />
                <ShipIcon raceId={r.id} className="relative h-16 w-full" />
                <h3 className={`relative mt-3 text-lg font-bold ${RACE_CLASS[r.id]}`}>{r.name}</h3>
                <p className="relative text-xs uppercase tracking-widest text-muted-foreground">{r.title}</p>
                <p className="relative mt-3 text-sm leading-relaxed text-foreground/80">{r.perk}</p>
                <p className="relative mt-3 text-xs text-muted-foreground">Kaynak: {r.resource}</p>
              </button>
            ))}
          </div>

          <div className="mt-10 grid max-w-3xl gap-2 text-center text-xs text-muted-foreground sm:grid-cols-3">
            <p>
              <b className="text-foreground">Fare</b> ile nişan al · <b className="text-foreground">Sol tık</b> ateş
            </p>
            <p>
              <b className="text-foreground">Sağ tık / W</b> itki · <b className="text-foreground">Shift</b> art yakıcı
            </p>
            <p>
              <b className="text-foreground">S</b> fren · madeni üsse teslim et, seviye atla
            </p>
          </div>
          <p className="mt-6 max-w-xl text-center text-xs text-muted-foreground/70">
            Seçtiğin ırk {race.name}: {race.perk.toLowerCase()}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

      {hud && (
        <>
          {/* sol üst: gemi durumu */}
          <div className="hud-panel absolute left-4 top-4 w-[288px] p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-sm font-bold">{hud.shipName}</span>
              <span className="text-xs text-gold">Lv {hud.level}/25</span>
            </div>
            <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {hud.raceName} · {hud.sizeClass}
            </div>

            <div className="space-y-1.5">
              <Bar value={hud.hp / hud.maxHp} className="bg-gradient-to-r from-fire to-gold" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Gövde</span>
                <span>
                  {Math.round(hud.hp)} / {hud.maxHp}
                </span>
              </div>
              <Bar value={hud.maxShield ? hud.shield / hud.maxShield : 0} className="bg-gradient-to-r from-water to-air" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Kalkan</span>
                <span>
                  {Math.round(hud.shield)} / {hud.maxShield}
                </span>
              </div>
              <Bar value={hud.level >= 25 ? 1 : hud.xp / hud.xpNeed} className="bg-gradient-to-r from-gold to-earth" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Deneyim</span>
                <span>{hud.level >= 25 ? "MAKS" : `${Math.round(hud.xp)} / ${hud.xpNeed}`}</span>
              </div>
              <Bar value={hud.cargo / hud.cargoCap} className="bg-gradient-to-r from-air to-earth" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{hud.resource}</span>
                <span>
                  {hud.cargo} / {hud.cargoCap}
                </span>
              </div>
              <Bar value={hud.boost / 100} className="bg-gradient-to-r from-water to-gold" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Art yakıcı (Shift)</span>
                <span>{Math.round(hud.boost)}%</span>
              </div>
            </div>
          </div>

          {/* üst orta: üs enerjisi */}
          <div className="hud-panel absolute left-1/2 top-4 w-[320px] -translate-x-1/2 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Ana Üs Enerjisi</div>
            <div className="mt-2">
              <Bar value={hud.baseEnergy} className="bg-gradient-to-r from-gold to-fire" />
            </div>
            <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted-foreground">
              <span>
                Kill <b className="text-foreground">{hud.kills}</b>
              </span>
              <span>
                Puan <b className="text-foreground">{hud.score}</b>
              </span>
            </div>
          </div>

          {/* sağ üst: skor tablosu + killfeed */}
          <div className="absolute right-4 top-4 w-[220px] space-y-2">
            <div className="hud-panel p-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Irk Sıralaması</div>
              {hud.leaderboard.map((l) => (
                <div key={l.name} className="mb-1.5">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: l.color }}>{l.name}</span>
                    <span className="text-muted-foreground">{l.score}</span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded bg-secondary/70">
                    <div className="h-full rounded" style={{ width: `${l.energy * 100}%`, background: l.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-right text-xs">
              {hud.killfeed.map((k) => (
                <div key={k.id} style={{ color: k.color }} className="drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]">
                  {k.text}
                </div>
              ))}
            </div>
          </div>

          {/* sol alt: geliştirmeler */}
          <div className="hud-panel absolute bottom-4 left-4 w-[288px] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-gold">Gemi Geliştirme</h3>
              <span className="text-[11px] text-muted-foreground">{hud.upPoints} puan</span>
            </div>
            {UP_KEYS.map((k) => (
              <div key={k} className="mb-1.5 flex items-center gap-2">
                <span className="w-[68px] text-xs">{UP_LABELS[k]}</span>
                <div className="flex flex-1 gap-[3px]">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 flex-1 rounded-sm ${i < hud.up[k] ? "bg-gold" : "bg-secondary"}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => upgrade(k)}
                  disabled={hud.upPoints <= 0 || hud.up[k] >= 12}
                  className="h-6 w-6 rounded border border-border bg-secondary text-sm leading-none text-foreground transition-colors hover:border-gold hover:text-gold disabled:opacity-35"
                >
                  +
                </button>
              </div>
            ))}
          </div>

          {/* minimap */}
          <canvas
            ref={mmRef}
            width={200}
            height={200}
            className="hud-panel absolute bottom-4 right-4 h-[200px] w-[200px]"
          />

          {/* seviye bildirimi */}
          {hud.toast && (
            <div className="pointer-events-none absolute left-1/2 top-[32%] -translate-x-1/2 text-center">
              <div className="font-display text-3xl font-black text-gold drop-shadow-[0_0_24px_rgba(255,207,77,.6)]">
                SEVİYE ATLADI
              </div>
              <div className="mt-1 text-sm text-foreground">{hud.toast}</div>
            </div>
          )}

          {/* ölüm ekranı */}
          {hud.dead && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm">
              <h2 className="text-3xl font-black text-fire">GEMİN YOK EDİLDİ</h2>
              <p className="mt-2 text-sm text-muted-foreground">{hud.deathInfo}</p>
              <button
                onClick={() => gameRef.current?.playerRespawn()}
                className="mt-6 rounded-md border border-gold px-7 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-background"
              >
                Yeniden Doğ
              </button>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-[11px] text-muted-foreground">
            <b className="text-foreground">Sol tık</b> ateş · <b className="text-foreground">Sağ tık / W</b> itki ·{" "}
            <b className="text-foreground">Shift</b> art yakıcı · <b className="text-foreground">S</b> fren
          </div>
        </>
      )}
    </main>
  );
}
