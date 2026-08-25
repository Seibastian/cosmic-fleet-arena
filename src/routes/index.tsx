import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RACES, UP_KEYS, UP_LABELS, racePalette, type UpKey } from "@/game/data";
import { SYSTEMS, SYSTEM_ORDER, type SysKey } from "@/game/systems";
import { Game } from "@/game/game";
import type { HudState } from "@/game/sim";
import {
  DEFAULT_SETTINGS,
  commanderLevel,
  commanderXpNeed,
  loadProfile,
  saveProfile,
  type Profile,
  type Settings,
} from "@/game/persist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CosmoWar Arena — Dört Irk, Tek Galaksi" },
      {
        name: "description",
        content:
          "CosmoWar Arena: dallanan gemi ağacı, 12 sistem modülü, yükseltilebilir üsler ve oturum tabanlı uzay savaşları.",
      },
      { property: "og:title", content: "CosmoWar Arena — Dört Irk, Tek Galaksi" },
      {
        property: "og:description",
        content:
          "Atalet fizikli tarayıcı uzay arenası: 4 ırk, dallanan ağaçta 600+ gemi yolu, oturum savaşı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ROMAN = ["I", "II", "III", "IV", "V"];

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
      <path
        d={shapes[raceId % 4]}
        fill={`url(#g${raceId})`}
        stroke="rgba(255,255,255,.65)"
        strokeWidth="1.2"
      />
      <circle cx="6" cy="0" r="3" fill="#fff" opacity=".9" />
    </svg>
  );
}

/* ---------------- ayarlar modalı ---------------- */

function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="hud-panel w-[380px] p-5">
        <h2 className="font-display text-lg font-bold text-gold">Ayarlar</h2>
        <div className="mt-4 space-y-4 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span>Ses</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              onChange={(e) => set({ volume: Number(e.target.value), muted: false })}
            />
          </label>
          <Toggle label="Ses kapalı" value={settings.muted} onChange={(v) => set({ muted: v })} />
          <Toggle
            label="Ekran sarsıntısı"
            value={settings.shake}
            onChange={(v) => set({ shake: v })}
          />
          <Toggle
            label="Bloom (parlama)"
            value={settings.bloom}
            onChange={(v) => set({ bloom: v })}
          />
          <label className="flex items-center justify-between">
            <span>Parçacık yoğunluğu</span>
            <select
              className="rounded border border-border bg-secondary px-2 py-1"
              value={settings.particles}
              onChange={(e) => set({ particles: e.target.value as Settings["particles"] })}
            >
              <option value="low">Düşük</option>
              <option value="med">Orta</option>
              <option value="high">Yüksek</option>
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span>Renk körlüğü modu</span>
            <select
              className="rounded border border-border bg-secondary px-2 py-1"
              value={settings.colorblind}
              onChange={(e) => set({ colorblind: e.target.value as Settings["colorblind"] })}
            >
              <option value="none">Kapalı</option>
              <option value="deutan">Deuteranopi</option>
              <option value="protan">Protanopi</option>
              <option value="tritan">Tritanopi</option>
            </select>
          </label>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md border border-gold py-2 text-sm font-semibold text-gold hover:bg-gold hover:text-background"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between">
      <span>{label}</span>
      <span
        className={`relative h-5 w-10 rounded-full border transition-colors ${
          value ? "border-gold bg-gold/40" : "border-border bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${value ? "left-[22px] bg-gold" : "left-0.5 bg-muted-foreground"}`}
        />
      </span>
    </button>
  );
}

/* ---------------- ana menü ---------------- */

function CommanderCard({ profile }: { profile: Profile }) {
  const lv = commanderLevel(profile.cmdXp);
  const need = commanderXpNeed(lv);
  const prev = commanderXpNeed(lv - 1);
  const frac = Math.min(1, Math.max(0, (profile.cmdXp - prev) / (need - prev)));
  return (
    <div className="hud-panel mt-6 flex w-full max-w-2xl items-center gap-4 p-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold font-display text-xl font-black text-gold">
        {lv}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>Komutan Seviyesi {lv}</span>
          <span>{Math.round(profile.cmdXp)} XP</span>
        </div>
        <div className="mt-1.5">
          <Bar value={frac} className="bg-gradient-to-r from-gold to-fire" />
        </div>
        <div className="mt-1.5 flex gap-4 text-[11px] text-muted-foreground">
          <span>
            Oturum <b className="text-foreground">{profile.sessions}</b>
          </span>
          <span>
            Zafer <b className="text-foreground">{profile.wins}</b>
          </span>
          <span>
            Toplam kill <b className="text-foreground">{profile.totalKills}</b>
          </span>
          <span>
            Toplam puan <b className="text-foreground">{profile.totalScore}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function MenuScreen({
  profile,
  settings,
  onStart,
  onSettings,
}: {
  profile: Profile;
  settings: Settings;
  onStart: (raceId: number) => void;
  onSettings: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const pal = useMemo(() => racePalette(settings.colorblind), [settings.colorblind]);
  const race = RACES[hovered]!;
  return (
    <main className="relative h-screen w-full overflow-auto bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 20% 20%, oklch(0.83 0.12 220 / .16), transparent), radial-gradient(900px 700px at 80% 70%, oklch(0.68 0.2 33 / .16), transparent)",
          }}
        />
      </div>
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-6 py-10">
        <h1 className="bg-gradient-to-r from-air via-gold to-fire bg-clip-text text-5xl font-black text-transparent sm:text-7xl">
          COSMOWAR ARENA
        </h1>
        <p className="mt-3 text-sm uppercase tracking-[0.4em] text-muted-foreground">
          Dört Irk · Dallanan Ağaç · Oturum Savaşı
        </p>

        <CommanderCard profile={profile} />

        <div className="mt-10 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RACES.map((r) => (
            <button
              key={r.id}
              onMouseEnter={() => setHovered(r.id)}
              onFocus={() => setHovered(r.id)}
              onClick={() => onStart(r.id)}
              className="hud-panel group relative overflow-hidden p-5 text-left transition-transform duration-200 hover:-translate-y-2"
              style={{ boxShadow: `0 0 0 1px ${pal[r.id]!.color}22` }}
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(300px 160px at 50% 0%, ${pal[r.id]!.color}22, transparent)`,
                }}
              />
              <ShipIcon raceId={r.id} className="relative h-16 w-full" />
              <h3 className="relative mt-3 text-lg font-bold" style={{ color: pal[r.id]!.color }}>
                {r.name}
              </h3>
              <p className="relative text-xs uppercase tracking-widest text-muted-foreground">
                {r.title}
              </p>
              <p className="relative mt-3 text-sm leading-relaxed text-foreground/80">{r.perk}</p>
              <p className="relative mt-2 text-xs leading-relaxed text-gold/90">{r.passive}</p>
              <p className="relative mt-2 text-xs text-muted-foreground">Kaynak: {r.resource}</p>
            </button>
          ))}
        </div>

        <p className="mt-6 max-w-xl text-center text-xs text-muted-foreground/80">
          Seçtiğin ırk {race.name}: {race.passive.toLowerCase()}.
        </p>

        <div className="mt-8 grid max-w-3xl gap-2 text-center text-xs text-muted-foreground sm:grid-cols-3">
          <p>
            <b className="text-foreground">Fare</b> nişan ·{" "}
            <b className="text-foreground">Sol tık</b> ateş ·{" "}
            <b className="text-foreground">Sağ tık/W</b> itki
          </p>
          <p>
            <b className="text-foreground">Shift</b> turbo · <b className="text-foreground">E</b>{" "}
            maden ışını · <b className="text-foreground">Q/F/C/X</b> sistemler
          </p>
          <p>
            <b className="text-foreground">1-6</b> geliştirme ·{" "}
            <b className="text-foreground">Esc</b> menü · madeni teslim et, seviye atla
          </p>
        </div>

        <button
          onClick={onSettings}
          className="mt-8 rounded-md border border-border px-6 py-2 text-sm text-muted-foreground transition-colors hover:border-gold hover:text-gold"
        >
          Ayarlar
        </button>
      </div>
    </main>
  );
}

/* ---------------- oyun HUD ---------------- */

function UpgradePanel({
  hud,
  onUpgrade,
  onSystem,
  sysMsg,
}: {
  hud: HudState;
  onUpgrade: (k: UpKey) => void;
  onSystem: (k: SysKey) => void;
  sysMsg: string | null;
}) {
  const [tab, setTab] = useState<"ship" | "sys">("ship");
  return (
    <div className="hud-panel absolute bottom-4 left-4 w-[320px] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-2">
          <TabBtn active={tab === "ship"} onClick={() => setTab("ship")}>
            Gemi
          </TabBtn>
          <TabBtn active={tab === "sys"} onClick={() => setTab("sys")}>
            Sistemler
          </TabBtn>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {hud.upPoints} puan{hud.anti > 0 ? ` · ${hud.anti} ⚛` : ""}
        </span>
      </div>
      {sysMsg && (
        <div className="mb-2 rounded border border-fire/50 bg-fire/10 px-2 py-1 text-[11px] text-fire">
          {sysMsg}
        </div>
      )}
      {tab === "ship" &&
        UP_KEYS.map((k, i) => (
          <div key={k} className="mb-1.5 flex items-center gap-2">
            <span className="w-[86px] text-xs">
              <b className="mr-1 text-muted-foreground">{i + 1}</b>
              {UP_LABELS[k]}
            </span>
            <div className="flex flex-1 gap-[3px]">
              {Array.from({ length: 12 }).map((_, j) => (
                <span
                  key={j}
                  className={`h-2 flex-1 rounded-sm ${j < hud.up[k] ? "bg-gold" : "bg-secondary"}`}
                />
              ))}
            </div>
            <button
              onClick={() => onUpgrade(k)}
              disabled={hud.upPoints <= 0 || hud.up[k] >= 12}
              className="h-6 w-6 rounded border border-border bg-secondary text-sm leading-none text-foreground transition-colors hover:border-gold hover:text-gold disabled:opacity-35"
            >
              +
            </button>
          </div>
        ))}
      {tab === "sys" &&
        SYSTEM_ORDER.map((key) => {
          const def = SYSTEMS[key];
          const st = hud.sys[key];
          const maxed = st.lv >= def.maxLv;
          return (
            <div key={key} className="mb-1.5 rounded border border-border/60 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {def.name}
                    <b className="ml-1.5 text-gold">{st.lv > 0 ? ROMAN[st.lv - 1] : ""}</b>
                    <b className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                      [{def.hotkey}]
                    </b>
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {st.locked
                      ? `Kilitli · seviye ${def.unlockLv}`
                      : st.lv > 0
                        ? def.lvlDesc(st.lv)
                        : def.desc}
                  </div>
                </div>
                <button
                  onClick={() => onSystem(key)}
                  disabled={st.locked || maxed || hud.upPoints <= 0}
                  className="h-6 shrink-0 rounded border border-border bg-secondary px-2 text-[11px] leading-none transition-colors hover:border-gold hover:text-gold disabled:opacity-35"
                >
                  {st.lv === 0 ? "Aç" : maxed ? "MAX" : `Lv ${ROMAN[st.lv]}`}
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 text-[11px] uppercase tracking-wider transition-colors ${
        active ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SystemBar({ hud }: { hud: HudState }) {
  return (
    <div className="pointer-events-none absolute bottom-20 left-1/2 flex -translate-x-1/2 gap-2">
      {SYSTEM_ORDER.filter((k) => k !== "mine" && k !== "turbo").map((k) => {
        const st = hud.sys[k];
        const cdFrac = st.cdMax > 1 ? st.cd / st.cdMax : 0;
        return (
          <div
            key={k}
            className={`hud-panel relative h-11 w-11 overflow-hidden text-center ${st.locked ? "opacity-30" : ""}`}
            title={`${SYSTEMS[k]!.name} [${SYSTEMS[k]!.hotkey}]`}
          >
            <div
              className="absolute inset-x-0 bottom-0 bg-primary/25"
              style={{ height: `${cdFrac * 100}%` }}
            />
            <div className="relative pt-1.5 text-sm font-bold leading-none">
              {SYSTEMS[k]!.hotkey.replace(" (basılı)", "").replace(" (pasif)", "")}
            </div>
            <div className="relative text-[9px] leading-tight text-muted-foreground">
              {st.locked ? "—" : ROMAN[Math.max(0, st.lv - 1)]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BranchModal({ hud, onChoose }: { hud: HudState; onChoose: (i: number) => void }) {
  const pb = hud.pendingBranch!;
  const race = RACES.find((r) => r.name === hud.raceName)!;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl px-6">
        <h2 className="text-center font-display text-2xl font-black text-gold drop-shadow-[0_0_18px_rgba(255,207,77,.45)]">
          DAL AYRIMI · SEVİYE {hud.level}
        </h2>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Bu oturum için kalıcı seçim · {Math.ceil(pb.t)}s sonra otomatik
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {pb.opts.map((o, i) => (
            <button
              key={o.id}
              onClick={() => onChoose(i)}
              className="hud-panel group p-5 text-left transition-transform duration-150 hover:-translate-y-1"
              style={{ boxShadow: `0 0 0 1px ${race.color}44` }}
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                [{i + 1}]
              </div>
              <h3 className="mt-1 font-display text-lg font-bold" style={{ color: race.color }}>
                {o.name}
              </h3>
              <p className="mt-2 text-sm text-foreground/80">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EndOverlay({
  hud,
  stats,
  onRestart,
  onMenu,
}: {
  hud: HudState;
  stats: { score: number; kills: number; won: boolean; xpGain: number } | null;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const end = hud.ended!;
  const winner = end.winner >= 0 ? RACES[end.winner]! : null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/88 backdrop-blur-sm">
      <div className="w-full max-w-xl px-6 text-center">
        <h2
          className={`font-display text-3xl font-black ${stats?.won ? "text-gold" : "text-fire"}`}
        >
          {end.reason === "base" ? "ÜS YOK EDİLDİ" : "OTURUM BİTTİ"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {winner ? `Zafer: ${winner.name} (${winner.title})` : "Zaman doldu"}
        </p>
        {stats && (
          <p className="mt-1 text-xs text-gold">
            +{stats.xpGain} Komutan XP {stats.won ? "· ZAFER" : ""}
          </p>
        )}
        <div className="hud-panel mt-6 p-4 text-left">
          {end.standings.map((st, i) => (
            <div
              key={st.raceId}
              className={`mb-2 flex items-center gap-3 last:mb-0 ${end.winner === st.raceId ? "opacity-100" : "opacity-70"}`}
            >
              <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
              <span className="w-20 text-sm font-semibold" style={{ color: st.color }}>
                {st.name}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-secondary">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(st.score / Math.max(1, end.standings[0]!.score)) * 100}%`,
                    background: st.color,
                  }}
                />
              </div>
              <span className="w-16 text-right text-xs">{st.score} puan</span>
              <span className="w-12 text-right text-[11px] text-muted-foreground">
                Üs {st.baseLv}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onRestart}
            className="rounded-md border border-gold px-6 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-background"
          >
            Yeni Oturum
          </button>
          <button
            onClick={onMenu}
            className="rounded-md border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
}

function GameView({
  raceId,
  seed,
  settings,
  onExit,
  onSessionEnd,
  onRestart,
  onOpenSettings,
}: {
  raceId: number;
  seed: number;
  settings: Settings;
  onExit: () => void;
  onSessionEnd: (stats: {
    score: number;
    kills: number;
    won: boolean;
    raceId: number;
    timeSurvived: number;
  }) => void;
  onRestart: () => void;
  onOpenSettings: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mmRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [endedStats, setEndedStats] = useState<{
    score: number;
    kills: number;
    won: boolean;
    xpGain: number;
  } | null>(null);
  const [sysMsg, setSysMsg] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, raceId, seed, settingsRef.current, {
      onHud: (h) => setHud(h),
      onEnded: (raw) => {
        const xpGain = Math.round(raw.score / 10 + raw.kills * 5 + (raw.won ? 150 : 40));
        setEndedStats({ score: raw.score, kills: raw.kills, won: raw.won, xpGain });
        onSessionEnd(raw);
      },
      onPauseChange: (p) => setPaused(p),
    });
    if (mmRef.current) g.attachMinimap(mmRef.current);
    gameRef.current = g;
    g.start();
    return () => {
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, seed]);

  useEffect(() => {
    gameRef.current?.applySettings(settings);
  }, [settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!endedStats) gameRef.current?.togglePaused();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [endedStats]);

  const upgrade = useCallback((k: UpKey) => gameRef.current?.spendUpgrade(k), []);
  const system = useCallback((k: SysKey) => {
    const err = gameRef.current?.spendSystem(k);
    if (err) {
      setSysMsg(err);
      setTimeout(() => setSysMsg(null), 1600);
    }
  }, []);

  if (!hud) {
    return <main className="h-screen w-full bg-background" />;
  }

  const base = {
    energy: hud.baseEnergy,
    canUpgrade: hud.basePool >= hud.baseCost && hud.baseLv < 25,
  };

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

      {/* düşük can vinyeti */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
        style={{
          opacity: hud.lowHp * 0.9,
          background:
            "radial-gradient(ellipse at center, transparent 52%, rgba(255,40,30,.38) 100%)",
        }}
      />

      {paused && !endedStats && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="hud-panel p-6 text-center">
            <h2 className="font-display text-xl font-bold text-gold">DURAKLATILDI</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => gameRef.current?.togglePaused()}
                className="rounded border border-gold px-8 py-2 text-sm text-gold hover:bg-gold hover:text-background"
              >
                Devam Et
              </button>
              <button
                onClick={onOpenSettings}
                className="rounded border border-border px-8 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                Ayarlar
              </button>
              <button
                onClick={onExit}
                className="rounded border border-border px-8 py-2 text-sm text-muted-foreground hover:border-fire hover:text-fire"
              >
                Ana Menü
              </button>
            </div>
          </div>
        </div>
      )}

      {hud.pendingBranch && !hud.dead && (
        <BranchModal hud={hud} onChoose={(i) => gameRef.current?.chooseBranch(i)} />
      )}

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
          <Bar
            value={hud.maxShield ? hud.shield / hud.maxShield : 0}
            className="bg-gradient-to-r from-water to-air"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Kalkan</span>
            <span>
              {Math.round(hud.shield)} / {hud.maxShield}
            </span>
          </div>
          <Bar
            value={hud.level >= 25 ? 1 : hud.xp / hud.xpNeed}
            className="bg-gradient-to-r from-gold to-earth"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Deneyim</span>
            <span>{hud.level >= 25 ? "MAKS" : `${Math.round(hud.xp)} / ${hud.xpNeed}`}</span>
          </div>
          <Bar value={hud.cargo / hud.cargoCap} className="bg-gradient-to-r from-air to-earth" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{hud.resource}</span>
            <span>
              {hud.cargo} / {hud.cargoCap}
              {hud.anti > 0 ? ` · ⚛${hud.anti}` : ""}
            </span>
          </div>
          <Bar value={hud.boost / 100} className="bg-gradient-to-r from-water to-gold" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Turbo (Shift)</span>
            <span>{Math.round(hud.boost)}%</span>
          </div>
        </div>
      </div>

      {/* üst orta: üs + süre */}
      <div className="hud-panel absolute left-1/2 top-4 w-[340px] -translate-x-1/2 p-3 text-center">
        <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <span>
            {hud.baseStage} · Lv {hud.baseLv}
          </span>
          <span className="text-gold">⏱ {fmtTime(hud.roundLeft)}</span>
        </div>
        <div className="mt-1.5">
          <Bar value={base.energy} className="bg-gradient-to-r from-gold to-fire" />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Havuz <b className="text-foreground">{hud.basePool}</b> / {hud.baseCost}
          </span>
          <span>
            Kill <b className="text-foreground">{hud.kills}</b> · Puan{" "}
            <b className="text-foreground">{hud.score}</b>
          </span>
          <button
            onClick={() => gameRef.current?.upgradeBase()}
            disabled={!base.canUpgrade}
            className="rounded border border-gold/70 px-2 py-0.5 text-[10px] font-semibold text-gold transition-colors hover:bg-gold hover:text-background disabled:opacity-35"
          >
            Üssü Yükselt
          </button>
        </div>
      </div>

      {/* sağ üst: skor + killfeed */}
      <div className="absolute right-4 top-4 w-[220px] space-y-2">
        <div className="hud-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Irk Sıralaması
          </div>
          {hud.leaderboard.map((l) => (
            <div key={l.raceId} className="mb-1.5">
              <div className="flex justify-between text-xs">
                <span style={{ color: l.color }}>
                  {l.name} <b className="text-[10px] text-muted-foreground">Üs{l.baseLv}</b>
                </span>
                <span className="text-muted-foreground">{l.score}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded bg-secondary/70">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(l.score / Math.max(1, hud.leaderboard[0]!.score)) * 100}%`,
                    background: l.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-right text-xs">
          {hud.killfeed.map((k) => (
            <div
              key={k.id}
              style={{ color: k.color }}
              className="drop-shadow-[0_1px_3px_rgba(0,0,0,.9)]"
            >
              {k.text}
            </div>
          ))}
        </div>
      </div>

      <UpgradePanel hud={hud} onUpgrade={upgrade} onSystem={system} sysMsg={sysMsg} />
      <SystemBar hud={hud} />

      <canvas
        ref={mmRef}
        width={200}
        height={200}
        className="hud-panel absolute bottom-4 right-4 h-[200px] w-[200px]"
      />

      {hud.toast && (
        <div className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 text-center">
          <div className="font-display text-2xl font-black text-gold drop-shadow-[0_0_24px_rgba(255,207,77,.6)]">
            {hud.toast}
          </div>
        </div>
      )}

      {hud.dead && !hud.ended && (
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

      {hud.ended && (
        <EndOverlay hud={hud} stats={endedStats} onRestart={onRestart} onMenu={onExit} />
      )}

      {!paused && !hud.ended && (
        <button
          onClick={() => gameRef.current?.togglePaused()}
          className="hud-panel absolute right-4 top-[290px] px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Esc · Menü
        </button>
      )}
    </main>
  );
}

/* ---------------- kök bileşen ---------------- */

function Index() {
  const [phase, setPhase] = useState<"menu" | "game">("menu");
  const [raceId, setRaceId] = useState(0);
  const [seed, setSeed] = useState(() => Date.now() % 2147483647);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [settings, setSettings] = useState<Settings>(
    () => loadProfile().settings ?? DEFAULT_SETTINGS,
  );

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    setProfile((p) => {
      const np = { ...p, settings: s };
      saveProfile(np);
      return np;
    });
  }, []);

  const handleSessionEnd = useCallback(
    (raw: { score: number; kills: number; won: boolean; raceId: number }) => {
      const xpGain = Math.round(raw.score / 10 + raw.kills * 5 + (raw.won ? 150 : 40));
      setProfile((p) => {
        const np: Profile = {
          ...p,
          cmdXp: p.cmdXp + xpGain,
          totalKills: p.totalKills + raw.kills,
          totalScore: p.totalScore + raw.score,
          sessions: p.sessions + 1,
          wins: p.wins + (raw.won ? 1 : 0),
        };
        saveProfile(np);
        return np;
      });
    },
    [],
  );

  if (phase === "menu") {
    return (
      <>
        <MenuScreen
          profile={profile}
          settings={settings}
          onStart={(rid) => {
            setRaceId(rid);
            setSeed(Math.floor(Math.random() * 2147483647));
            setSessionNonce((n) => n + 1);
            setPhase("game");
          }}
          onSettings={() => setShowSettings(true)}
        />
        {showSettings && (
          <SettingsModal
            settings={settings}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <GameView
        key={`${raceId}-${seed}-${sessionNonce}`}
        raceId={raceId}
        seed={seed}
        settings={settings}
        onExit={() => setPhase("menu")}
        onSessionEnd={handleSessionEnd}
        onRestart={() => {
          setSeed(Math.floor(Math.random() * 2147483647));
          setSessionNonce((n) => n + 1);
        }}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
