import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFENSE_COSTS,
  DEFENSE_LABELS,
  RACES,
  UP_KEYS,
  UP_LABELS,
  racePalette,
  type DefenseType,
  type UpKey,
} from "@/game/data";
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
          "CosmoWar Arena ULTIMATE: 12 sistem, warp kapıları, ikmal kasaları, Leviathan boss, kombo zinciri, hit-stop ve hakimiyet savaşı.",
      },
      { property: "og:title", content: "CosmoWar Arena ULTIMATE — Dört Irk, Tek Galaksi" },
      {
        property: "og:description",
        content:
          "Ultimate uzay arenası: 4 ırk · 12 sistem · warp · ikmal · boss · 600+ gemi yolu · 60 FPS juice.",
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
    "M46,0 L7,3 L-5,11 L-21,19 L-12.5,6 L-15.5,0 L-12.5,-6 L-21,-19 L-5,-11 Z",
    "M29,0 L19,8.5 L6,14.5 L-7,23.5 L-19,16.5 L-23,7 L-19,0 L-23,-7 L-19,-16.5 L-7,-23.5 L6,-14.5 L19,-8.5 Z",
    "M24,0 L21,10.5 L9,13.5 L9,22.5 L-8,22.5 L-14.5,12 L-25,12 L-25,-12 L-14.5,-12 L-8,-22.5 L9,-22.5 L9,-13.5 L21,-10.5 Z",
    "M38,0 L17,3 L25,10 L8,11.5 L-2,19 L-14,26.5 L-11,12.5 L-26,9.5 L-17,0 L-26,-9.5 L-11,-12.5 L-14,-26.5 L-2,-19 L8,-11.5 L25,-10 L17,-3 Z",
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

        <div className="mt-8 grid max-w-3xl gap-2 text-center text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            <b className="text-foreground">Fare</b> nişan ·{" "}
            <b className="text-foreground">Sol tık</b> ateş ·{" "}
            <b className="text-foreground">Sağ tık/W</b> itki · <b className="text-foreground">E</b>{" "}
            maden ışını · <b className="text-foreground">Shift/Space</b> boost
          </p>
          <p>
            <b className="text-foreground">Q/F/U/G/Z/V/H/Y/X/C</b> 12 sistem ·{" "}
            <b className="text-foreground">R</b> delici · <b className="text-foreground">B+1/2/3</b>{" "}
            üs savunması
          </p>
          <p>
            ☀ solar · ◉ dark · ◆ stellar topla · <b className="text-gold">⬢ ikmal kasaları</b> ·{" "}
            <b className="text-air">⟁ warp</b> kapıları · <b className="text-fire">☠ Leviathan</b>
          </p>
          <p>
            <b className="text-gold">Zafer:</b> hakimiyet (üsleri yok et) veya süre sonunda en
            yüksek skor — 12dk &lt;720s&gt;
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
  onBuild,
  onPierce,
  sysMsg,
}: {
  hud: HudState;
  onUpgrade: (k: UpKey) => void;
  onSystem: (k: SysKey) => void;
  onBuild: (t: DefenseType) => void;
  onPierce: () => void;
  sysMsg: string | null;
}) {
  const [tab, setTab] = useState<"ship" | "sys" | "base">("ship");
  const bank = hud.bank;
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
          <TabBtn active={tab === "base"} onClick={() => setTab("base")}>
            Üs
          </TabBtn>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {hud.upPoints} puan · ⛭{bank}
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
              disabled={hud.up[k] >= 12 || (hud.upPoints <= 0 && hud.bank < 14)}
              title={hud.upPoints <= 0 ? `Puansız: 14 hammadde` : "Puan harca"}
              className="h-6 w-6 rounded border border-border bg-secondary text-sm leading-none text-foreground transition-colors hover:border-gold hover:text-gold disabled:opacity-35"
            >
              +
            </button>
          </div>
        ))}
      {tab === "sys" && (
        <div className="max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
          {SYSTEM_ORDER.map((key) => {
            const def = SYSTEMS[key];
            const st = hud.sys[key];
            const maxed = st.lv >= def.maxLv;
            const needAnti = st.lv > 0 ? st.lv : 0;
            const canAfford = st.lv === 0 ? true : hud.anti >= needAnti && hud.upPoints > 0;
            return (
              <div key={key} className="mb-1 rounded border border-border/60 p-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold">
                      {def.name}
                      <b className="ml-1 text-gold">{st.lv > 0 ? ROMAN[st.lv - 1] : ""}</b>
                      <b className="ml-1 text-[9px] font-normal text-muted-foreground">
                        [{def.hotkey}]
                      </b>
                    </div>
                    <div className="truncate text-[9px] leading-tight text-muted-foreground">
                      {st.locked
                        ? `Kilitli · seviye ${def.unlockLv}`
                        : st.lv > 0
                          ? def.lvlDesc(st.lv)
                          : def.desc}
                    </div>
                    {st.lv > 0 && !maxed && (
                      <div className="text-[9px] text-muted-foreground">
                        Sonraki: 1 puan + {needAnti} antimadde
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onSystem(key)}
                    disabled={st.locked || maxed || !canAfford}
                    className="h-6 shrink-0 rounded border border-border bg-secondary px-2 text-[10px] leading-none transition-colors hover:border-gold hover:text-gold disabled:opacity-35"
                  >
                    {st.lv === 0 ? "Aç" : maxed ? "MAX" : `Lv ${ROMAN[st.lv]}`}
                  </button>
                </div>
                {st.lv > 0 && (
                  <div className="mt-1 h-1 overflow-hidden rounded bg-secondary">
                    <div
                      className="h-full bg-gold transition-all"
                      style={{ width: `${(st.lv / def.maxLv) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === "base" && (
        <>
          <button
            onClick={onPierce}
            className={`mb-2 w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
              hud.shieldPierce
                ? "border-fire bg-fire/15 text-fire"
                : hud.pierceOwned
                  ? "border-gold/70 text-gold hover:bg-gold/10"
                  : "border-border text-foreground hover:border-gold hover:text-gold"
            }`}
          >
            <b>[R] Kalkan Delici Mühimmat</b>
            <span className="float-right">
              {hud.pierceOwned ? (hud.shieldPierce ? "AÇIK" : "kapalı") : "⛭35 satın al"}
            </span>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Mermiler kalkanı yok sayar, doğrudan gövdeye hasar verir.
            </div>
          </button>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Savunma İnşası [B+1/2/3] · üs yanındayken
          </div>
          {(Object.keys(DEFENSE_COSTS) as DefenseType[]).map((t, i) => {
            const c = DEFENSE_COSTS[t];
            const affordable = bank >= c.resources;
            return (
              <div key={t} className="mb-1.5 rounded border border-border/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">
                      <b className="mr-1 text-muted-foreground">B+{i + 1}</b>
                      {DEFENSE_LABELS[t]}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{c.desc}</div>
                    <div className={`text-[10px] ${affordable ? "text-earth" : "text-fire"}`}>
                      ⛭{c.resources} · HP {c.hp}
                      {c.shield > 0 ? ` · Kalkan ${c.shield}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => onBuild(t)}
                    disabled={!hud.canBuild || !affordable}
                    className="h-6 shrink-0 rounded border border-border bg-secondary px-2 text-[11px] leading-none transition-colors hover:border-gold hover:text-gold disabled:opacity-35"
                  >
                    İnşa et
                  </button>
                </div>
              </div>
            );
          })}
          {!hud.canBuild && (
            <div className="text-[10px] text-muted-foreground">İnşa için üssüne yaklaş.</div>
          )}
          {hud.defenses.length > 0 && (
            <div className="mt-1 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
              Yapılar:{" "}
              {hud.defenses.map((d, i) => (
                <span key={i} className="mr-2">
                  {DEFENSE_LABELS[d.type].split(" ")[0]} {Math.round((d.hp / d.maxHp) * 100)}%
                </span>
              ))}
            </div>
          )}
        </>
      )}
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
  const activeKeys = SYSTEM_ORDER.filter((k) => k !== "mine" && k !== "turbo");
  return (
    <div className="pointer-events-none absolute bottom-20 left-1/2 flex max-w-[420px] -translate-x-1/2 flex-wrap justify-center gap-1.5">
      {activeKeys.map((k) => {
        const st = hud.sys[k];
        const cdFrac = st.cdMax > 1 ? st.cd / st.cdMax : 0;
        const isOverheated =
          k === "overcharge" && (hud as unknown as { overheatT?: number }).overheatT && false; // reserved
        return (
          <div
            key={k}
            className={`hud-panel relative h-10 w-10 overflow-hidden text-center ${st.locked ? "opacity-30" : ""} ${isOverheated ? "border-fire" : ""}`}
            title={`${SYSTEMS[k]!.name} [${SYSTEMS[k]!.hotkey}]`}
          >
            <div
              className={`absolute inset-x-0 bottom-0 ${isOverheated ? "bg-fire/40" : "bg-primary/25"}`}
              style={{ height: `${cdFrac * 100}%` }}
            />
            <div className="relative pt-1 text-xs font-bold leading-none">
              {SYSTEMS[k]!.hotkey.replace(" (basılı)", "").replace(" (pasif)", "")}
            </div>
            <div className="relative text-[8px] leading-tight text-muted-foreground">
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
  const title =
    end.reason === "domination"
      ? "HAKİMİYET SAĞLANDI"
      : end.reason === "eliminated"
        ? "ÜSSÜN YIKILDI"
        : end.reason === "time"
          ? "SÜRE DOLDU"
          : "OTURUM BİTTİ";
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/88 backdrop-blur-sm">
      <div className="w-full max-w-xl px-6 text-center">
        <h2
          className={`font-display text-3xl font-black ${stats?.won ? "text-gold" : "text-fire"}`}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {end.reason === "domination"
            ? `${winner?.name ?? "?"} tüm düşman üslerini yok ederek galaksiye hükmetti`
            : end.reason === "eliminated"
              ? `Üssünü ${winner?.name ?? "düşman"} yok etti — takımın elendi`
              : "Zaman doldu"}
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
              className={`mb-2 flex items-center gap-3 last:mb-0 ${
                end.winner === st.raceId
                  ? "opacity-100"
                  : st.alive
                    ? "opacity-70"
                    : "opacity-35 line-through"
              }`}
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

  const upgrade = useCallback((k: UpKey) => {
    const err = gameRef.current?.spendUpgrade(k);
    if (err) {
      setSysMsg(err);
      setTimeout(() => setSysMsg(null), 1600);
    }
  }, []);
  const build = useCallback((t: DefenseType) => {
    const err = gameRef.current?.buildDefense(t);
    if (err) {
      setSysMsg(err);
      setTimeout(() => setSysMsg(null), 1600);
    }
  }, []);
  const pierce = useCallback(() => {
    const err = gameRef.current?.buyPiercingAmmo();
    if (err) {
      setSysMsg(err);
      setTimeout(() => setSysMsg(null), 1600);
    }
  }, []);
  const system = useCallback((k: SysKey) => {
    const err = gameRef.current?.spendSystem(k);
    if (err) {
      setSysMsg(err);
      setTimeout(() => setSysMsg(null), 1600);
    }
  }, []);

  const canUpgrade = !!hud && hud.basePool >= hud.baseCost && hud.baseLv < 25;

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />
      <canvas
        ref={mmRef}
        width={200}
        height={200}
        className="hud-panel absolute bottom-4 right-4 z-10 h-[200px] w-[200px]"
      />

      {hud && (
        <>
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
              <Bar
                value={hud.cargo / hud.cargoCap}
                className={
                  hud.cargo >= hud.cargoCap
                    ? "bg-gradient-to-r from-fire to-gold animate-pulse"
                    : "bg-gradient-to-r from-air to-earth"
                }
              />
              <div className="flex justify-between text-[10px]">
                <span
                  className={
                    hud.cargo >= hud.cargoCap ? "font-bold text-gold" : "text-muted-foreground"
                  }
                >
                  {hud.resource}
                  {hud.cargo >= hud.cargoCap ? " — DOLU! Üsse dön" : ""}
                </span>
                <span
                  className={
                    hud.cargo >= hud.cargoCap ? "font-bold text-gold" : "text-muted-foreground"
                  }
                >
                  {hud.cargo} / {hud.cargoCap}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Hammadde</span>
                <span>
                  ⛭ {hud.bank}
                  {hud.anti > 0 ? ` · ⚛${hud.anti}` : ""}
                </span>
              </div>
              <Bar value={hud.boost / 100} className="bg-gradient-to-r from-water to-gold" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Turbo (Shift)</span>
                <span>{Math.round(hud.boost)}%</span>
              </div>
              {/* buff infoları */}
              {(hud.damageBuffT > 0 ||
                hud.speedBuffT > 0 ||
                hud.cloakT > 0 ||
                hud.overchargeT > 0) && (
                <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] font-bold">
                  {hud.damageBuffT > 0 && (
                    <span className="rounded bg-fire/20 px-1.5 py-0.5 text-fire">
                      ⬢ HASAR {hud.damageBuffT.toFixed(1)}s
                    </span>
                  )}
                  {hud.speedBuffT > 0 && (
                    <span className="rounded bg-gold/20 px-1.5 py-0.5 text-gold">
                      ⬣ HIZ {hud.speedBuffT.toFixed(1)}s
                    </span>
                  )}
                  {hud.cloakT > 0 && (
                    <span className="rounded bg-[#9e7aff]/20 px-1.5 py-0.5 text-[#9e7aff]">
                      ◈ FAZ {hud.cloakT.toFixed(1)}s
                    </span>
                  )}
                  {hud.overchargeT > 0 && (
                    <span className="rounded bg-gold/25 px-1.5 py-0.5 text-gold animate-pulse">
                      ⚡ AŞIRI {hud.overchargeT.toFixed(1)}s
                    </span>
                  )}
                  {hud.vacuumT > 0 && (
                    <span className="rounded bg-[#9e7aff]/20 px-1.5 py-0.5 text-[#b8a0ff]">
                      ⬔ VAKUM {hud.vacuumT.toFixed(1)}s
                    </span>
                  )}
                  {hud.xpBuffT > 0 && (
                    <span className="rounded bg-[#7affb0]/20 px-1.5 py-0.5 text-[#7affb0]">
                      ⬙ XP×2 {hud.xpBuffT.toFixed(1)}s
                    </span>
                  )}
                </div>
              )}
              {hud.warpCd > 0 && (
                <div className="mt-1 text-[9px] text-air">
                  ⟁ Warp bekleme {hud.warpCd.toFixed(1)}s
                </div>
              )}
            </div>
          </div>

          {/* kombo rozeti — Nihai juice */}
          {hud.comboN >= 3 && (
            <div className="pointer-events-none absolute left-1/2 top-[18%] z-10 -translate-x-1/2 text-center">
              <div
                className={`font-display text-2xl font-black tracking-widest drop-shadow-[0_0_16px_rgba(255,207,77,.7)] ${
                  hud.comboN >= 10 ? "text-gold" : hud.comboN >= 5 ? "text-[#ffd76a]" : "text-white"
                } ${hud.comboN >= 10 ? "animate-pulse" : ""}`}
                style={{
                  transform: `scale(${1 + Math.min(0.35, hud.comboN * 0.02)})`,
                  textShadow:
                    hud.comboN >= 10 ? "0 0 22px rgba(255,207,77,.9)" : "0 0 10px rgba(0,0,0,.8)",
                }}
              >
                KOMBO ×{hud.comboN}{" "}
                <span className="text-sm text-gold/90">×{hud.comboMul.toFixed(2)}</span>
              </div>
              <div className="mx-auto mt-1 h-1 w-24 overflow-hidden rounded bg-secondary/60">
                <div
                  className="h-full bg-gold transition-all duration-100"
                  style={{ width: `${Math.min(100, (hud.comboN / 20) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* boss uyarı / sağlık */}
          {hud.bossWarning > 0 && (
            <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded border border-fire/60 bg-fire/15 px-4 py-2 text-center backdrop-blur">
              <div className="animate-pulse font-display text-sm font-black text-fire">
                ⚠ LEVIATHAN YAKLAŞIYOR {hud.bossWarning.toFixed(1)}s
              </div>
              <div className="text-[10px] text-fire/80">Merkeze yakın dur — kaç veya savaş!</div>
            </div>
          )}
          {hud.boss && (
            <div className="pointer-events-none absolute left-1/2 top-[68px] z-10 w-[260px] -translate-x-1/2">
              <div className="h-2 overflow-hidden rounded border border-fire/60 bg-background/70">
                <div
                  className="h-full bg-gradient-to-r from-fire to-gold transition-all duration-200"
                  style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 text-center text-[9px] font-bold tracking-widest text-fire">
                ☠ LEVIATHAN — {Math.ceil(hud.boss.hp)} / {hud.boss.maxHp}
              </div>
            </div>
          )}

          {/* ikmal & warp bilgi şeridi */}
          <div className="pointer-events-none absolute left-1/2 top-[112px] z-10 flex -translate-x-1/2 gap-2">
            {hud.crates.length > 0 && (
              <div className="rounded bg-gold/15 px-2 py-1 text-[10px] font-semibold text-gold backdrop-blur">
                ⬢ Kasalar {hud.crates.length} haritada
              </div>
            )}
            {hud.gates.length > 0 && (
              <div className="rounded bg-air/15 px-2 py-1 text-[10px] font-semibold text-air backdrop-blur">
                ⟁ Warp aktif · {hud.gates.length} kapı
              </div>
            )}
          </div>

          {/* üst orta: üs + hakimiyet */}
          <div className="hud-panel absolute left-1/2 top-4 w-[340px] -translate-x-1/2 p-3 text-center">
            <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <span>
                {hud.baseStage} · Lv {hud.baseLv}
              </span>
              <span className="text-gold">⏱ {fmtTime(hud.roundLeft)}</span>
            </div>
            <div className="mt-1.5">
              <Bar value={hud.baseEnergy} className="bg-gradient-to-r from-gold to-fire" />
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
                disabled={!canUpgrade}
                className="rounded border border-gold/70 px-2 py-0.5 text-[10px] font-semibold text-gold transition-colors hover:bg-gold hover:text-background disabled:opacity-35"
              >
                Üssü Yükselt
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 border-t border-border/60 pt-2">
              <span className="text-[9px] uppercase tracking-[0.3em] text-gold/80">Hakimiyet</span>
              {hud.aliveTeams.map((t) => (
                <span
                  key={t.name}
                  title={t.alive ? `${t.name} üssü ayakta` : `${t.name} üssü yıkıldı`}
                  className={`flex items-center gap-1 text-[10px] ${t.alive ? "" : "line-through opacity-40"}`}
                  style={{ color: t.color }}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${t.alive ? "animate-pulse" : ""}`}
                    style={{ background: t.alive ? t.color : "#555" }}
                  />
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          {/* sağ üst: skor + killfeed */}
          <div className="absolute right-4 top-4 w-[220px] space-y-2">
            <div className="hud-panel p-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Irk Sıralaması
              </div>
              {hud.leaderboard.map((l) => (
                <div key={l.raceId} className={`mb-1.5 ${l.alive ? "" : "opacity-35"}`}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: l.color }} className={l.alive ? "" : "line-through"}>
                      {l.name}{" "}
                      <b className="text-[10px] text-muted-foreground">
                        {l.alive ? `Üs${l.baseLv}` : "yıkıldı"}
                      </b>
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

          <UpgradePanel
            hud={hud}
            onUpgrade={upgrade}
            onSystem={system}
            onBuild={build}
            onPierce={pierce}
            sysMsg={sysMsg}
          />
          <SystemBar hud={hud} />

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
        </>
      )}

      {!paused && !(hud && hud.ended) && (
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
