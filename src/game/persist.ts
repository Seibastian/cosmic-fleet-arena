/* CosmoWar Arena — kalıcılık: Komutan XP, ayarlar, denge telemetrisi (localStorage) */
import type { CBMode } from "./data";

const PROFILE_KEY = "cwa_profile_v1";
const TELEMETRY_KEY = "cwa_telemetry_v1";

export interface Settings {
  volume: number;
  muted: boolean;
  shake: boolean;
  bloom: boolean;
  particles: "low" | "med" | "high";
  colorblind: CBMode;
}

export interface Profile {
  cmdXp: number;
  totalKills: number;
  totalScore: number;
  sessions: number;
  wins: number;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.5,
  muted: false,
  shake: true,
  bloom: true,
  particles: "high",
  colorblind: "none",
};

export function commanderLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
}
export function commanderXpNeed(level: number): number {
  return Math.round(Math.pow(level, 2) * 120);
}

export function loadProfile(): Profile {
  const fallback: Profile = {
    cmdXp: 0,
    totalKills: 0,
    totalScore: 0,
    sessions: 0,
    wins: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      ...fallback,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* kota dolu olabilir */
  }
}

export interface TelemetryRow {
  t: number;
  killerRace: number;
  victimRace: number;
  killerLv: number;
  victimLv: number;
}

export function pushTelemetry(rows: TelemetryRow[]) {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    const existing: TelemetryRow[] = raw ? JSON.parse(raw) : [];
    existing.push(...rows);
    if (existing.length > 400) existing.splice(0, existing.length - 400);
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(existing));
  } catch {
    /* yoksay */
  }
}
