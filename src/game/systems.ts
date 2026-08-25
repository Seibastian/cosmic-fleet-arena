/* CosmoWar Arena — gemi içi sistem modülleri (12'den ilk 6) */

export type SysKey = "mine" | "shield" | "turbo" | "blink" | "trap" | "gas";

export interface SystemDef {
  key: SysKey;
  name: string;
  hotkey: string;
  unlockLv: number;
  maxLv: number;
  desc: string;
  lvlDesc: (lv: number) => string;
}

export const SYSTEM_ORDER: SysKey[] = ["mine", "shield", "turbo", "blink", "trap", "gas"];

export const SYSTEMS: Record<SysKey, SystemDef> = {
  mine: {
    key: "mine",
    name: "Maden Işını",
    hotkey: "E (basılı)",
    unlockLv: 1,
    maxLv: 5,
    desc: "Kaynaklara güçlü çekim ışını; ışın aktifken hız düşer.",
    lvlDesc: (lv) =>
      lv >= 4
        ? `${lv} hedef · menzil ${180 + lv * 40} · verim ×${(1 + lv * 0.5).toFixed(1)}`
        : `1 hedef · menzil ${180 + lv * 40} · verim ×${(1 + lv * 0.5).toFixed(1)}`,
  },
  shield: {
    key: "shield",
    name: "Kalkan Aşırı Yükü",
    hotkey: "Q",
    unlockLv: 3,
    maxLv: 5,
    desc: "Kalkanı anında doldurur ve geçici olarak genişletir.",
    lvlDesc: (lv) => `%${40 + lv * 8} dolu başlar · +%${30 + lv * 10} kapasite ${4 + lv * 0.5}s`,
  },
  turbo: {
    key: "turbo",
    name: "Turbo Çerçeve",
    hotkey: "Shift (pasif)",
    unlockLv: 6,
    maxLv: 5,
    desc: "Art yakıcıyı kalıcı güçlendirir; üst seviyede çarpışma bağışıklığı.",
    lvlDesc: (lv) =>
      `hız +${lv * 6}% · ivme +${lv * 8}%${lv >= 3 ? " · çarpışma bağışıklığı" : ""}${lv >= 5 ? " · koç vuruşu" : ""}`,
  },
  blink: {
    key: "blink",
    name: "Işınlanma",
    hotkey: "F",
    unlockLv: 9,
    maxLv: 5,
    desc: "Nişan noktaya doğru kısa mesafe ışınlanma; saniyelerce dokunulmazlık.",
    lvlDesc: (lv) => `mesafe ${260 + lv * 70} · bekleme ${(7 - lv * 0.8).toFixed(1)}s`,
  },
  trap: {
    key: "trap",
    name: "Uzay Tuzağı",
    hotkey: "C",
    unlockLv: 13,
    maxLv: 5,
    desc: "Geriye ırk temalı tuzak bırakır; düşman temasında tetiklenir.",
    lvlDesc: (lv) => `hasar ${60 + lv * 30} · ömür ${18 + lv * 4}s · yarıçap ${70 + lv * 14}`,
  },
  gas: {
    key: "gas",
    name: "Gaz Fırtınası",
    hotkey: "X",
    unlockLv: 17,
    maxLv: 5,
    desc: "Zamanla hasar veren, yavaşlatan bulut yayılır; düşman sensörlerini kör eder.",
    lvlDesc: (lv) => `saniye ${14 + lv * 6} hasar · yarıçap ${110 + lv * 26} · süre ${5 + lv}s`,
  },
};
