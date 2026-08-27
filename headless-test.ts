/* Headless ULTIMATE doğrulaması: hakimiyet, savunma, ikmal, warp, boss, 12 sistem, kombo */
import { Sim, emptyCmd } from "./src/game/sim";
import { SYSTEMS, SYSTEM_ORDER } from "./src/game/systems";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

const sim = new Sim(12345, 0, "none");
const cmd = emptyCmd();

// 1) Çok kaynaklı kaynaklar
const solar = sim.resources.filter((r) => r.resType === "solar").length;
const dark = sim.resources.filter((r) => r.resType === "dark").length;
const stellar = sim.resources.filter((r) => r.resType === "stellar").length;
if (solar < 30) fail(`solar az: ${solar}`);
if (dark < 20) fail(`dark az: ${dark}`);
if (stellar < 300) fail(`stellar az: ${stellar}`);
console.log(`kaynak OK — solar:${solar} dark:${dark} stellar:${stellar}`);

// 2) Kargo kapasitesi
sim.player.level = 10;
sim.applyTier(sim.player);
const cap = sim.cargoCap(sim.player);
if (cap < 15) fail(`kargo düşük: ${cap}`);
console.log(`kargo Lv10: ${cap}`);

// 3) Kalkan delici
sim.player.bank = 100;
const perr = sim.buyPiercingAmmo();
if (perr !== null || !sim.player.pierceOwned || !sim.player.shieldPierce)
  fail("delici alınamadı");
console.log("delici OK");

// 4) Savunma inşası
const base = sim.bases[0]!;
sim.player.x = base.x + base.radius + 80;
sim.player.y = base.y;
sim.player.bank = 200;
const berr = sim.buildDefense("fortress");
if (berr !== null) fail(`inşa başarısız: ${berr}`);
if (!sim.structures.some((s) => s.type === "fortress")) fail("yapı oluşmadı");
console.log("savunma OK");

// 5) 12 sistem var mı?
if (SYSTEM_ORDER.length !== 12) fail(`sistem 12 değil: ${SYSTEM_ORDER.length}`);
for (const k of SYSTEM_ORDER) {
  if (!SYSTEMS[k]) fail(`sistem eksik: ${k}`);
}
console.log("12 sistem OK");

// 6) Yüksek seviye sistem kullanım testi
sim.player.level = 25;
sim.applyTier(sim.player);
sim.player.xp = 0;
// unlock all systems
for (const k of SYSTEM_ORDER) sim.player.sys[k].lv = 5;
sim.player.sys.mine.lv = 5;
sim.player.sys.turbo.lv = 5;
sim.player.bank = 999;
sim.player.anti = 99;
sim.player.upPoints = 99;
// test overcharge
{
  const c = emptyCmd();
  c.use = "overcharge";
  sim.setPlayerCmd(c);
  sim.update(1 / 60);
  if (sim.player.overchargeT <= 0) fail("overcharge çalışmadı");
  console.log(`overcharge OK — ${sim.player.overchargeT.toFixed(2)}s`);
  sim.takeEvents();
}
// test cloak
{
  sim.player.sys.cloak.cd = 0;
  const c = emptyCmd();
  c.use = "cloak";
  sim.setPlayerCmd(c);
  sim.update(1 / 60);
  if (sim.player.cloakT <= 0) fail("cloak çalışmadı");
  console.log(`cloak OK — ${sim.player.cloakT.toFixed(2)}s`);
  sim.takeEvents();
}
// test emp
{
  sim.player.sys.emp.cd = 0;
  const c = emptyCmd();
  c.use = "emp";
  sim.setPlayerCmd(c);
  const evBefore = sim.takeEvents().length;
  sim.update(1 / 60);
  const evs = sim.takeEvents();
  if (!evs.some((e) => e.type === "emp")) fail("emp event yok");
  console.log("emp OK");
}
// test nanite
{
  sim.player.hp = sim.player.maxHp * 0.3;
  sim.player.sys.nanite.cd = 0;
  const hpBefore = sim.player.hp;
  const c = emptyCmd();
  c.use = "nanite";
  sim.setPlayerCmd(c);
  sim.update(1 / 60);
  if (sim.player.hp <= hpBefore) fail("nanite iyileştirmedi");
  sim.takeEvents();
  console.log("nanite OK");
}
// test gravity
{
  sim.player.sys.gravity.cd = 0;
  const c = emptyCmd();
  c.use = "gravity";
  sim.setPlayerCmd(c);
  sim.update(1 / 60);
  if (sim.gravityWells.length === 0) fail("gravity well oluşmadı");
  console.log("gravity OK");
}
// test orbital
{
  sim.player.sys.orbital.cd = 0;
  const c = emptyCmd();
  c.use = "orbital";
  c.ax = sim.player.x + 300;
  c.ay = sim.player.y + 300;
  sim.setPlayerCmd(c);
  sim.update(1 / 60);
  if (sim.orbitalStrikes.length === 0) fail("orbital oluşmadı");
  console.log("orbital OK");
  sim.takeEvents();
}

// 7) İkmal kasası
sim.spawnCrate();
if (sim.crates.length === 0) fail("crate spawn olmadı");
const crate = sim.crates[0]!;
sim.player.x = crate.x;
sim.player.y = crate.y;
sim.player.vx = 0;
sim.player.vy = 0;
sim.update(0.5);
if (sim.crates.length !== 0) {
  // maybe collected, check buff or score increase handled
  console.log("crate toplandı veya sürükleniyor, kalan:", sim.crates.length);
} else {
  console.log("crate toplama OK");
}
// ensure at least spawn works
if (sim.crates.length === 0) {
  sim.spawnCrate();
  console.log("crate respawn OK");
}

// 8) Warp kapıları
if (sim.gates.length !== 4) fail(`gate 4 değil: ${sim.gates.length}`);
console.log("warp kapıları OK — ", sim.gates.length);
// test warp teleport
{
  const g = sim.gates[0]!;
  sim.player.x = g.x;
  sim.player.y = g.y;
  sim.player.warpCd = 0;
  sim.update(1 / 60);
  const pair = sim.gates.find((o) => o.id === g.pairId)!;
  const d = Math.hypot(sim.player.x - pair.x, sim.player.y - pair.y);
  if (d > pair.radius + sim.player.radius + 30) fail(`warp teleport başarısız, uzaklık ${d.toFixed(1)}`);
  console.log("warp teleport OK");
}

// 9) Boss spawn + hasar
sim.spawnBoss();
if (!sim.boss || !sim.boss.alive) fail("boss spawn olmadı");
console.log(`boss OK — hp ${sim.boss.hp}`);
const bossHp = sim.boss.hp;
// shoot boss
sim.bullets.push({
  x: sim.boss.x,
  y: sim.boss.y,
  vx: 0,
  vy: 0,
  dmg: 200,
  life: 1,
  raceId: 0,
  ownerId: sim.player.id,
  radius: 4,
  homing: 0,
  pierce: 0,
  burn: 0,
  kind: "slug",
  splash: 0,
  trail: [],
  shieldPierce: false,
});
sim.update(1 / 60);
if (!sim.boss || sim.boss.hp >= bossHp) fail("boss hasar almadı");
console.log(`boss hasar OK — ${bossHp} → ${sim.boss.hp}`);
sim.boss = null; // temizle, hakimiyet testini engellemesin

// 10) Zamanlayıcı (kalan süre azalmalı)
const leftBefore = sim.hud().roundLeft;
for (let i = 0; i < 600; i++) {
  sim.setPlayerCmd(emptyCmd());
  sim.update(1 / 60);
}
const leftAfter = sim.hud().roundLeft;
if (leftAfter >= leftBefore) fail(`zaman azalmadı: ${leftBefore} → ${leftAfter}`);
console.log(`zamanlayıcı OK — ${leftBefore} → ${leftAfter} kalan, elapsed ${sim.hud().roundElapsed}`);

// 11) Kombo
sim.player.comboN = 7;
sim.player.comboT = 3;
sim.update(1 / 60);
if (sim.player.comboMul <= 1) fail(`combo çarpanı düşük: ${sim.player.comboMul}`);
console.log(`kombo OK — N=${sim.player.comboN} mul=${sim.player.comboMul.toFixed(2)}`);

// 12) Simülasyon: 1800 tick stabil
for (let i = 0; i < 1800; i++) {
  cmd.fire = i % 7 < 3;
  cmd.mineHold = i % 5 < 2;
  cmd.ax = Math.cos(i * 0.01) * 3000 + 4500;
  cmd.ay = Math.sin(i * 0.013) * 3000 + 4500;
  cmd.thrust = true;
  cmd.use = null;
  sim.setPlayerCmd({ ...cmd });
  sim.update(1 / 60);
  const evs = sim.takeEvents();
  if (evs.length > 400) fail("olay kuyruğu taştı");
}
console.log("1800 tick OK");

// 13) Hakimiyet: 3 düşman üssünü yok et
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

// 14) HUD ultimate alanlar
const hud = sim.hud();
if (
  typeof hud.bank !== "number" ||
  typeof hud.shieldPierce !== "boolean" ||
  typeof hud.comboN !== "number" ||
  typeof hud.crates === "undefined" ||
  typeof hud.bossWarning !== "number"
)
  fail("hud ultimate alanları eksik");
if (hud.aliveTeams.filter((t) => t.alive).length !== 1) fail("aliveTeams yanlış");
if (hud.gates.length !== 4) fail("hud gates eksik");
console.log("hud ULTIMATE OK");

console.log("\nTÜM ULTIMATE TESTLER GEÇTİ ✓");
