/* Headless sim doğrulaması: hakimiyet zaferi, savunma inşası, kalkan delici, çok kaynaklı madencilik */
import { Sim, emptyCmd } from "./src/game/sim";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

const sim = new Sim(12345, 0, "none");
const cmd = emptyCmd();

// 1) Çok kaynaklu kaynaklar mevcut mu?
const solar = sim.resources.filter((r) => r.resType === "solar").length;
const dark = sim.resources.filter((r) => r.resType === "dark").length;
const stellar = sim.resources.filter((r) => r.resType === "stellar").length;
if (solar < 30) fail(`solar kaynak az: ${solar}`);
if (dark < 20) fail(`dark kaynak az: ${dark}`);
if (stellar < 300) fail(`stellar kaynak az: ${stellar}`);
console.log(`kaynak türleri OK — solar:${solar} dark:${dark} stellar:${stellar}`);

// 2) Kargo kapasitesi artmış olmalı
sim.player.level = 10;
sim.applyTier(sim.player);
const cap = sim.cargoCap(sim.player);
if (cap < 15) fail(`kargo kapasitesi düşük: ${cap}`);
console.log(`kargo kapasitesi Lv10: ${cap}`);

// 3) Kalkan delici satın alma
sim.player.bank = 100;
const perr = sim.buyPiercingAmmo();
if (perr !== null || !sim.player.pierceOwned || !sim.player.shieldPierce)
  fail("kalkan delici satın alınamadı");
console.log("kalkan delici OK");

// 4) Savunma inşası (oyuncu üssü yanına ışınla)
const base = sim.bases[0]!;
sim.player.x = base.x + base.radius + 80;
sim.player.y = base.y;
sim.player.bank = 200;
const berr = sim.buildDefense("fortress");
if (berr !== null) fail(`inşa başarısız: ${berr}`);
if (!sim.structures.some((s) => s.type === "fortress")) fail("yapı oluşmadı");
console.log("savunma inşası OK — yapı sayısı:", sim.structures.length);

// 5) Simülasyon: 1800 tick hata olmadan dönmeli
for (let i = 0; i < 1800; i++) {
  cmd.fire = i % 7 < 3;
  cmd.mineHold = i % 5 < 2;
  cmd.ax = Math.cos(i * 0.01) * 3000 + 4500;
  cmd.ay = Math.sin(i * 0.013) * 3000 + 4500;
  cmd.thrust = true;
  sim.setPlayerCmd({ ...cmd });
  sim.update(1 / 60);
  const evs = sim.takeEvents();
  if (evs.length > 400) fail("olay kuyruğu taştı");
}
console.log("1800 tick OK");

// 6) Hakimiyet: 3 düşman üssünü yok et → oturum bitmeli
for (const b of sim.bases) {
  if (b.raceId !== 0) {
    for (let i = 0; i < 40; i++) sim.hitBase(b, 500, 0);
  }
}
sim.update(1 / 60);
sim.takeEvents();
if (sim.session.phase !== "ended") fail("hakimiyet tetiklenmedi");
if (sim.session.winner !== 0) fail(`kazanan yanlış: ${sim.session.winner}`);
if (sim.session.reason !== "domination") fail(`sebep yanlış: ${sim.session.reason}`);
console.log("hakimiyet zaferi OK");

// 7) HUD alanları
const hud = sim.hud();
if (typeof hud.bank !== "number" || typeof hud.shieldPierce !== "boolean")
  fail("hud alanları eksik");
if (hud.aliveTeams.filter((t) => t.alive).length !== 1) fail("aliveTeams yanlış");
console.log("hud OK");

console.log("\nTÜM TESTLER GEÇTİ ✓");
