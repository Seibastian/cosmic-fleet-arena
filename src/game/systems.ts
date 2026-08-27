/* CosmoWar Arena — gemi içi sistem modülleri (12 sistem) */

export type SysKey =
  | "mine"
  | "shield"
  | "turbo"
  | "blink"
  | "trap"
  | "gas"
  | "emp"
  | "nanite"
  | "cloak"
  | "gravity"
  | "orbital"
  | "overcharge";

export interface SystemDef {
  key: SysKey;
  name: string;
  hotkey: string;
  unlockLv: number;
  maxLv: number;
  desc: string;
  lvlDesc: (lv: number) => string;
}

export const SYSTEM_ORDER: SysKey[] = [
  "mine",
  "shield",
  "turbo",
  "blink",
  "trap",
  "gas",
  "overcharge",
  "cloak",
  "emp",
  "nanite",
  "gravity",
  "orbital",
];

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
  overcharge: {
    key: "overcharge",
    name: "Aşırı Yük",
    hotkey: "U",
    unlockLv: 11,
    maxLv: 5,
    desc: "6sn boyunca silahlar %45 hızlı, %25 güçlü — sonra 3sn aşırı ısınma.",
    lvlDesc: (lv) => `ateş +${25 + lv * 4}% · hasar +${15 + lv * 3}% · süre ${5 + lv * 0.4}s`,
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
  cloak: {
    key: "cloak",
    name: "Faz Pelerini",
    hotkey: "G",
    unlockLv: 15,
    maxLv: 5,
    desc: "Görünmezlik + %40 hız — ilk atış %45 bonus hasar.",
    lvlDesc: (lv) => `görünmez ${2.5 + lv * 0.35}s · hız +${30 + lv * 4}% · bonus %${35 + lv * 5}`,
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
  emp: {
    key: "emp",
    name: "EMP Darbe",
    hotkey: "Z",
    unlockLv: 19,
    maxLv: 5,
    desc: "Şok dalgası: kalkanları söndürür, kısa sersemletme + yavaşlatma.",
    lvlDesc: (lv) =>
      `yarıçap ${280 + lv * 28} · sersem ${0.7 + lv * 0.18}s · kalkan -%${45 + lv * 6}`,
  },
  nanite: {
    key: "nanite",
    name: "Nanit Sürüsü",
    hotkey: "V",
    unlockLv: 21,
    maxLv: 5,
    desc: "Anında %35 can + 6sn rejenerasyon; yakındaki dostları da onarır.",
    lvlDesc: (lv) =>
      `anında %${28 + lv * 5} · rejenerasyon ${6 + lv * 2}/s · dost menzil ${340 + lv * 24}`,
  },
  gravity: {
    key: "gravity",
    name: "Kütle Kuyusu",
    hotkey: "H",
    unlockLv: 23,
    maxLv: 5,
    desc: "Yere kütle kuyusu bırakır — düşmanları çeker, %40 yavaşlatır.",
    lvlDesc: (lv) => `çekim ${160 + lv * 22} · yarıçap ${180 + lv * 18} · süre ${5 + lv * 0.6}s`,
  },
  orbital: {
    key: "orbital",
    name: "Yörünge Vuruşu",
    hotkey: "Y",
    unlockLv: 25,
    maxLv: 5,
    desc: "1.8sn sonra yörüngeden lazer yağar — devasa alan hasarı + yakma.",
    lvlDesc: (lv) => `hasar ${160 + lv * 32} · yarıçap ${150 + lv * 12} · yakma ${3 + lv}s`,
  },
};
