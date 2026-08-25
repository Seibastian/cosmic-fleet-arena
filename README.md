# Cosmic Fleet Arena

Şimdi sana aşağıda hazır bir oyun kodu vereceğim senden istediğim şey bu oyunu geliştirmen ve starblast ötesi güzel bir oyuna çevirmen. Grafikler iyi olmalı fizik motoru iyi çalışmalı gemilerin her biri ayrıntılı ve farklı özelliklerde olmalı. çok detaylı güzel bir oyuna çevir 

<!DOCTYPE html>

<html lang="tr">

<head>

<meta charset="UTF-8">

<title>CosmoWar Arena</title>

<meta name="viewport" content="width=device-width, initial-scale=1">

<style>

  :root{

    --bg:#05070d;

    --panel:#0b0f1a;

    --panel-line:#1c2436;

    --air:#5fd4ff;

    --water:#3f7fff;

    --earth:#7ad13a;

    --fire:#ff5a3c;

    --text:#dfe7f5;

    --dim:#7c8aa8;

    --gold:#ffcf4d;

  }

  *{box-sizing:border-box;}

  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:'Segoe UI',Consolas,monospace;overflow:hidden;height:100%;}

  #gameCanvas{position:absolute;top:0;left:0;background:radial-gradient(ellipse at center, #0a0f1c 0%, #04060b 100%);cursor:crosshair;}

  #minimap{position:absolute;bottom:16px;right:16px;background:rgba(6,9,16,.75);border:1px solid var(--panel-line);border-radius:8px;box-shadow:0 0 24px rgba(0,0,0,.6);}

  /* ---------- HUD ---------- */

  #hud{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;font-size:13px;}

  .panel{background:rgba(6,9,16,.72);border:1px solid var(--panel-line);border-radius:8px;backdrop-filter:blur(2px);}

  #topLeft{position:absolute;top:14px;left:14px;padding:10px 14px;min-width:230px;}

  #shipName{font-weight:700;font-size:15px;letter-spacing:.3px;}

  #shipClassRow{color:var(--dim);font-size:11px;margin-bottom:6px;}

  .bar{height:8px;border-radius:4px;background:#141a29;overflow:hidden;margin-top:3px;border:1px solid #1e2740;}

  .bar>div{height:100%;transition:width .15s;}

  #hpBar>div{background:linear-gradient(90deg,#ff5a5a,#ff9a5a);}

  #xpBar>div{background:linear-gradient(90deg,#ffcf4d,#fff2b0);}

  #cargoBar>div{background:linear-gradient(90deg,#5fd4ff,#c1f0ff);}

  .barLabel{font-size:10px;color:var(--dim);margin-top:6px;display:flex;justify-content:space-between;}

  #baseEnergy{position:absolute;top:14px;left:50%;transform:translateX(-50%);padding:8px 18px;text-align:center;min-width:260px;}

  #baseEnergy .barLabel{margin-top:4px;}

  #baseBar{height:10px;}

  #killfeed{position:absolute;top:14px;right:14px;width:260px;font-size:12px;text-align:right;color:var(--dim);}

  #killfeed div{margin-bottom:3px;text-shadow:0 0 4px #000;}

  #upgradePanel{position:absolute;bottom:14px;left:14px;padding:10px 14px;width:250px;pointer-events:auto;}

  #upgradePanel h3{margin:0 0 6px;font-size:12px;color:var(--gold);letter-spacing:.5px;}

  .upRow{display:flex;align-items:center;justify-content:space-between;margin:5px 0;}

  .upRow span.lbl{font-size:12px;width:88px;color:var(--text);}

  .upRow .dots{flex:1;display:flex;gap:2px;margin:0 8px;}

  .upRow .dot{width:8px;height:8px;border-radius:2px;background:#1e2740;}

  .upRow .dot.on{background:var(--gold);}

  .upBtn{width:22px;height:22px;border-radius:4px;border:1px solid var(--panel-line);background:#141a29;color:var(--text);cursor:pointer;font-size:14px;line-height:1;}

  .upBtn:hover{border-color:var(--gold);}

  #pointsLeft{font-size:11px;color:var(--dim);margin-top:6px;}

  #instructions{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);padding:8px 16px;font-size:11px;color:var(--dim);text-align:center;}

  #instructions b{color:var(--text);}

  /* ---------- overlays ---------- */

  #overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at center,#0c1120 0%,#020306 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;}

  #overlay.hidden{display:none;}

  #logo{font-size:44px;font-weight:800;letter-spacing:3px;background:linear-gradient(90deg,var(--air),var(--fire));-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:2px;}

  #tagline{color:var(--dim);font-size:13px;letter-spacing:2px;margin-bottom:36px;text-transform:uppercase;}

  #raceGrid{display:flex;gap:22px;}

  .raceCard{width:190px;padding:18px;border-radius:10px;border:1px solid var(--panel-line);background:rgba(255,255,255,.02);cursor:pointer;transition:transform .15s,border-color .15s;text-align:center;}

  .raceCard:hover{transform:translateY(-6px);}

  .raceIcon{width:56px;height:56px;margin:0 auto 10px;}

  .raceCard h3{margin:0 0 4px;font-size:16px;}

  .raceCard p{margin:0;font-size:11px;color:var(--dim);line-height:1.5;}

  .raceCard[data-race="0"]:hover{border-color:var(--air);box-shadow:0 0 24px -6px var(--air);}

  .raceCard[data-race="1"]:hover{border-color:var(--water);box-shadow:0 0 24px -6px var(--water);}

  .raceCard[data-race="2"]:hover{border-color:var(--earth);box-shadow:0 0 24px -6px var(--earth);}

  .raceCard[data-race="3"]:hover{border-color:var(--fire);box-shadow:0 0 24px -6px var(--fire);}

  #deathOverlay{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(2,3,6,.88);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:11;}

  #deathOverlay h2{font-size:30px;color:var(--fire);margin-bottom:6px;}

  #deathOverlay p{color:var(--dim);margin-bottom:20px;}

  #respawnBtn{padding:10px 26px;border-radius:6px;border:1px solid var(--gold);background:transparent;color:var(--gold);font-size:14px;cursor:pointer;}

  #respawnBtn:hover{background:var(--gold);color:#1a1300;}

  #levelToast{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%) scale(.8);opacity:0;pointer-events:none;text-align:center;transition:opacity .25s, transform .25s;z-index:5;}

  #levelToast.show{opacity:1;transform:translate(-50%,-50%) scale(1);}

  #levelToast .big{font-size:26px;font-weight:800;color:var(--gold);text-shadow:0 0 18px rgba(255,207,77,.6);}

  #levelToast .small{font-size:13px;color:var(--text);margin-top:2px;}

</style>

</head>

<body>

<canvas id="gameCanvas"></canvas>

<canvas id="minimap" width="180" height="180"></canvas>

<div id="hud" style="display:none;">

  <div id="topLeft" class="panel">

    <div id="shipName">-</div>

    <div id="shipClassRow">-</div>

    <div class="bar" id="hpBar"><div style="width:100%"></div></div>

    <div class="barLabel"><span>Gövde</span><span id="hpText"></span></div>

    <div class="bar" id="xpBar"><div style="width:0%"></div></div>

    <div class="barLabel"><span>Seviye <span id="lvlText">1</span>/25</span><span id="xpText"></span></div>

    <div class="bar" id="cargoBar"><div style="width:0%"></div></div>

    <div class="barLabel"><span id="resLabel">Kargo</span><span id="cargoText"></span></div>

  </div>

  <div id="baseEnergy" class="panel">

    <div style="font-size:11px;color:var(--dim);letter-spacing:1px;">ANA ÜS ENERJİSİ</div>

    <div class="bar" id="baseBar"><div style="width:0%"></div></div>

  </div>

  <div id="killfeed"></div>

  <div id="upgradePanel" class="panel">

    <h3>GEMİ GELİŞTİRME &nbsp;(U)</h3>

    <div class="upRow"><span class="lbl">Hız</span><div class="dots" id="dots-speed"></div><button class="upBtn" data-stat="speed">+</button></div>

    <div class="upRow"><span class="lbl">Hasar</span><div class="dots" id="dots-damage"></div><button class="upBtn" data-stat="damage">+</button></div>

    <div class="upRow"><span class="lbl">Kalkan</span><div class="dots" id="dots-hp"></div><button class="upBtn" data-stat="hp">+</button></div>

    <div class="upRow"><span class="lbl">Ateş Hızı</span><div class="dots" id="dots-firerate"></div><button class="upBtn" data-stat="firerate">+</button></div>

    <div id="pointsLeft">0 geliştirme puanı</div>

  </div>

  <div id="instructions">

    <b>Fare</b> yönlendirir · <b>Sağ tık</b> itki · <b>Sol tık</b> ateş · madenleri topla, üssüne teslim et

  </div>

</div>

<div id="levelToast"><div class="big">SEVİYE ATLADI!</div><div class="small"></div></div>

<div id="overlay">

  <div id="logo">COSMOWAR ARENA</div>

  <div id="tagline">Dört Irk · Tek Arena · Sonsuz Çatışma</div>

  <div id="raceGrid"></div>

</div>

<div id="deathOverlay">

  <h2>GEMİN YOK EDİLDİ</h2>

  <p id="deathInfo"></p>

  <button id="respawnBtn">Yeniden Doğ</button>

</div>

<script>

(function(){

"use strict";

/* ============================================================

   0. TEMEL AYARLAR

============================================================ */

const WORLD = 6000;

const canvas = document.getElementById('gameCanvas');

const ctx = canvas.getContext('2d');

const mm = document.getElementById('minimap');

const mmCtx = mm.getContext('2d');

function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }

addEventListener('resize', resize); resize();

/* ============================================================

   1. IRKLAR (Hava / Su / Toprak / Ateş)

============================================================ */

const RACES = [

  { id:0, name:'Hava', color:'#5fd4ff', dark:'#173a4a', resource:'Hava Kristali',

    base:{x:600,y:600}, prefixes:['Esinti','Rüzgâr','Fırtına','Kasırga','Bora','Hortum','Zefir','Semum','Muson','Tayfun'],

    suffixes:['Böceği','Avcısı','Yıldızı','Kanadı','Kruvazörü','Fırkateyni','Muhribi','Savaşçısı','Anaforu','Titanı'] },

  { id:1, name:'Su', color:'#3f7fff', dark:'#132747', resource:'Su Özü',

    base:{x:5400,y:600}, prefixes:['Dalga','Girdap','Med','Cezir','Akıntı','Damla','Okyanus','Derin','Fırtına','Buz'],

    suffixes:['Balığı','Avcısı','Prizması','Kabuğu','Kruvazörü','Fırkateyni','Muhribi','Kaşifi','Devi','Efendisi'] },

  { id:2, name:'Toprak', color:'#7ad13a', dark:'#233a13', resource:'Toprak Cevheri',

    base:{x:600,y:5400}, prefixes:['Kaya','Toprak','Dağ','Kütle','Çekirdek','Granit','Zırh','Kök','Heybet','Demir'],

    suffixes:['Böceği','Kaplanı','Zırhlısı','Bastionu','Kruvazörü','Fırkateyni','Muhribi','Kalesi','Devi','Anıtı'] },

  { id:3, name:'Ateş', color:'#ff5a3c', dark:'#3a1710', resource:'Ateş Küresi',

    base:{x:5400,y:5400}, prefixes:['Alev','Kor','Kıvılcım','Volkan','Magma','Cehennem','Kül','Şimşek','Nova','Güneş'],

    suffixes:['Böceği','Avcısı','Yıldızı','Kanadı','Kruvazörü','Fırkateyni','Muhribi','Savaşçısı','Anaforu','Titanı'] },

];

/* 25 gemi kademesi üret (istatistik + isim). Her kademe otomatik seviye atlayınca alınır. */

function buildShipTiers(race){

  const tiers = [];

  for(let lvl=1; lvl<=25; lvl++){

    const t = (lvl-1)/24; // 0..1 ilerleme

    const name = `${race.prefixes[lvl%10]} ${race.suffixes[Math.floor(lvl/2.6)%10]}`;

    let sizeClass;

    if(lvl<=5) sizeClass='scout'; else if(lvl<=10) sizeClass='fighter';

    else if(lvl<=15) sizeClass='gunship'; else if(lvl<=20) sizeClass='cruiser'; else sizeClass='dread';

    tiers.push({

      level: lvl,

      name,

      sizeClass,

      radius: 10 + t*22,

      maxHp: Math.round(24 + lvl*14 + t*30),

      speed: 150 + lvl*7,           // px/s

      accel: 240 + lvl*9,

      turnRate: 4.6 - t*1.4,        // rad/s, düşük seviyeler daha çevik döner

      damage: Math.round(4 + lvl*1.9),

      fireRate: Math.max(0.11, 0.34 - t*0.20), // atış aralığı (s)

      bulletSpeed: 480 + lvl*6,

      cargoCap: 1 + Math.floor(lvl/3),

      xpToNext: Math.round(60 * Math.pow(lvl,1.35)),

    });

  }

  return tiers;

}

RACES.forEach(r=> r.tiers = buildShipTiers(r));

/* ============================================================

   2. GEMİ ŞEKLİ ÇİZİMİ (prosedürel, ırk+kademeye göre)

============================================================ */

function drawShipShape(ctx, sizeClass, radius, color, dark){

  ctx.lineWidth = Math.max(1, radius*0.09);

  ctx.strokeStyle = 'rgba(255,255,255,.55)';

  ctx.fillStyle = color;

  ctx.beginPath();

  const r = radius;

  switch(sizeClass){

    case 'scout':

      ctx.moveTo(r,0); ctx.lineTo(-r*0.8,r*0.7); ctx.lineTo(-r*0.4,0); ctx.lineTo(-r*0.8,-r*0.7); ctx.closePath();

      break;

    case 'fighter':

      ctx.moveTo(r,0); ctx.lineTo(r*0.1,r*0.5); ctx.lineTo(-r*0.9,r*0.9); ctx.lineTo(-r*0.5,0);

      ctx.lineTo(-r*0.9,-r*0.9); ctx.lineTo(r*0.1,-r*0.5); ctx.closePath();

      break;

    case 'gunship':

      ctx.moveTo(r,0); ctx.lineTo(r*0.2,r*0.45); ctx.lineTo(-r*0.3,r*0.5); ctx.lineTo(-r*1.0,r*1.0);

      ctx.lineTo(-r*0.7,0); ctx.lineTo(-r*1.0,-r*1.0); ctx.lineTo(-r*0.3,-r*0.5); ctx.lineTo(r*0.2,-r*0.45);

      ctx.closePath();

      break;

    case 'cruiser':

      ctx.moveTo(r*1.1,0); ctx.lineTo(r*0.3,r*0.55); ctx.lineTo(-r*0.2,r*0.6); ctx.lineTo(-r*1.1,r*1.1);

      ctx.lineTo(-r*1.3,r*0.3); ctx.lineTo(-r*1.3,-r*0.3); ctx.lineTo(-r*1.1,-r*1.1);

      ctx.lineTo(-r*0.2,-r*0.6); ctx.lineTo(r*0.3,-r*0.55); ctx.closePath();

      break;

    default: // dread

      ctx.moveTo(r*1.3,0); ctx.lineTo(r*0.5,r*0.5); ctx.lineTo(r*0.1,r*0.65); ctx.lineTo(-r*0.4,r*0.7);

      ctx.lineTo(-r*1.2,r*1.25); ctx.lineTo(-r*1.5,r*0.4); ctx.lineTo(-r*1.1,0); ctx.lineTo(-r*1.5,-r*0.4);

      ctx.lineTo(-r*1.2,-r*1.25); ctx.lineTo(-r*0.4,-r*0.7); ctx.lineTo(r*0.1,-r*0.65); ctx.lineTo(r*0.5,-r*0.5);

      ctx.closePath();

  }

  ctx.fill(); ctx.stroke();

  // kokpit / çekirdek

  ctx.beginPath(); ctx.arc(r*0.1,0,r*0.22,0,Math.PI*2);

  ctx.fillStyle = dark; ctx.fill();

}

/* ============================================================

   3. DÜNYA: ÜSLER + MADEN BÖLGELERİ

============================================================ */

const bases = RACES.map(r=>({ race:r, x:r.base.x, y:r.base.y, radius:120, hp:2000, maxHp:2000, energy:0, energyMax:1000 }));

// Çatışma bölgeleri: kenar ortalarında iki komşu ırkın kaynağı, merkezde herkesin kaynağı

const zones = [

  { x:WORLD/2, y:900,      races:[0,1] }, // üst kenar: Hava+Su

  { x:WORLD/2, y:WORLD-900,races:[2,3] }, // alt kenar: Toprak+Ateş

  { x:900,     y:WORLD/2,  races:[0,2] }, // sol kenar: Hava+Toprak

  { x:WORLD-900,y:WORLD/2, races:[1,3] }, // sağ kenar: Su+Ateş

  { x:WORLD/2, y:WORLD/2,  races:[0,1,2,3] }, // merkez: herkes

];

let resources = [];

function spawnResourceIn(zone, raceId){

  const ang = Math.random()*Math.PI*2, rad = Math.random()*420;

  resources.push({

    id: Math.random(),

    x: zone.x + Math.cos(ang)*rad,

    y: zone.y + Math.sin(ang)*rad,

    raceId, amount: 3 + Math.floor(Math.random()*3), radius: 9,

  });

}

zones.forEach(z=>{ for(let i=0;i<10;i++) z.races.forEach(rid=> spawnResourceIn(z, rid)); });

/* ============================================================

   4. VARLIKLAR: Gemi / Mermi

============================================================ */

let ships = [];

let bullets = [];

let particles = [];

let killfeedEl = document.getElementById('killfeed');

function makeShip(race, isPlayer){

  const b = bases[race.id];

  const ang = Math.random()*Math.PI*2, rad = Math.random()*80;

  const ship = {

    id: Math.random(),

    race, isPlayer,

    level: 1,

    xp: 0,

    x: b.x + Math.cos(ang)*rad, y: b.y + Math.sin(ang)*rad,

    vx:0, vy:0, angle: Math.random()*Math.PI*2, targetAngle:0,

    hp:1, maxHp:1, cargo:0,

    fireCooldown:0,

    upPoints:0, up:{speed:0,damage:0,hp:0,firerate:0},

    alive:true,

    aiState:'mine', aiTarget:null, aiRepathT:0,

    thrusting:false,

  };

  applyTier(ship);

  ship.hp = ship.maxHp;

  return ship;

}

function statMul(ship, key){ return 1 + ship.up[key]*0.045; }

function applyTier(ship){

  const tier = ship.race.tiers[ship.level-1];

  ship.tier = tier;

  ship.maxHp = Math.round(tier.maxHp * statMul(ship,'hp'));

  ship.radius = tier.radius;

}

let player = null;

let camera = {x:0,y:0};

let selectedRace = null;

let gameStarted = false;

/* Yapay zeka gemileri: her ırktan bot filosu (oyuncu ırkı dahil rakip 3 ırk + kendi ırkından da birkaç dost) */

function seedFleet(){

  ships = [];

  RACES.forEach(race=>{

    const n = 6;

    for(let i=0;i<n;i++){

      const s = makeShip(race, false);

      s.level = 1 + Math.floor(Math.random()*6);

      applyTier(s); s.hp = s.maxHp;

      ships.push(s);

    }

  });

}

/* ============================================================

   5. GİRİŞ: FARE / KLAVYE

============================================================ */

let mouse = {x:innerWidth/2, y:innerHeight/2, down:false, rdown:false};

addEventListener('mousemove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });

addEventListener('mousedown', e=>{

  if(e.button===0) mouse.down=true;

  if(e.button===2) mouse.rdown=true;

});

addEventListener('mouseup', e=>{

  if(e.button===0) mouse.down=false;

  if(e.button===2) mouse.rdown=false;

});

addEventListener('contextmenu', e=>e.preventDefault());

addEventListener('keydown', e=>{

  if(e.key==='u' || e.key==='U') toggleUpgradePanel();

});

/* ============================================================

   6. IRK SEÇİM EKRANI

============================================================ */

const raceGrid = document.getElementById('raceGrid');

RACES.forEach(r=>{

  const card = document.createElement('div');

  card.className='raceCard'; card.dataset.race = r.id;

  card.innerHTML = `

    <svg class="raceIcon" viewBox="-20 -20 40 40"></svg>

    <h3 style="color:${r.color}">${r.name}</h3>

    <p>Kaynak: ${r.resource}<br>25 gemi kademesi<br>Kendi geliştirme ağacı</p>`;

  card.addEventListener('click', ()=> startGame(r));

  raceGrid.appendChild(card);

  // ikon: mini canvas yerine svg üstüne basit üçgen

  const svg = card.querySelector('svg');

  svg.innerHTML = `<polygon points="14,0 -10,9 -5,0 -10,-9" fill="${r.color}" stroke="rgba(255,255,255,.6)"/>`;

});

function startGame(race){

  selectedRace = race;

  document.getElementById('overlay').classList.add('hidden');

  document.getElementById('hud').style.display='block';

  seedFleet();

  player = makeShip(race, true);

  player.hp = player.maxHp;

  ships.push(player);

  document.getElementById('resLabel').textContent = race.resource;

  gameStarted = true;

  updateUpgradeUI();

  requestAnimationFrame(loop);

}

document.getElementById('respawnBtn').addEventListener('click', ()=>{

  document.getElementById('deathOverlay').style.display='none';

  const b = bases[player.race.id];

  player.alive = true;

  player.x = b.x + (Math.random()-0.5)*100; player.y = b.y + (Math.random()-0.5)*100;

  player.vx=0; player.vy=0;

  player.level = Math.max(1, player.level-1);

  applyTier(player); player.hp = player.maxHp; player.cargo=0;

});

/* ============================================================

   7. GELİŞTİRME PANELİ

============================================================ */

let upgradePanel = document.getElementById('upgradePanel');

function toggleUpgradePanel(){ upgradePanel.style.opacity = upgradePanel.style.opacity==='0.35'?'1':'0.35'; }

document.querySelectorAll('.upBtn').forEach(btn=>{

  btn.addEventListener('click', ()=>{

    if(!player || !player.alive) return;

    const stat = btn.dataset.stat;

    if(player.upPoints>0){

      player.upPoints--; player.up[stat]++;

      applyTier(player);

      updateUpgradeUI();

    }

  });

});

function updateUpgradeUI(){

  if(!player) return;

  ['speed','damage','hp','firerate'].forEach(stat=>{

    const el = document.getElementById('dots-'+stat);

    el.innerHTML='';

    for(let i=0;i<10;i++){

      const d = document.createElement('div');

      d.className='dot'+(i<player.up[stat]?' on':'');

      el.appendChild(d);

    }

  });

  document.getElementById('pointsLeft').textContent = player.upPoints+' geliştirme puanı';

}

/* ============================================================

   8. XP / SEVİYE ATLAMA

============================================================ */

function grantXp(ship, amount){

  if(ship.level>=25) return;

  ship.xp += amount;

  const need = ship.tier.xpToNext;

  if(ship.xp >= need){

    ship.xp -= need;

    ship.level = Math.min(25, ship.level+1);

    applyTier(ship);

    ship.hp = ship.maxHp;

    ship.upPoints += 3;

    if(ship.isPlayer){

      flashLevelToast(ship);

      updateUpgradeUI();

    }

  }

}

let toastT=0;

function flashLevelToast(ship){

  const t = document.getElementById('levelToast');

  t.querySelector('.small').textContent = `${ship.tier.name} — Seviye ${ship.level}`;

  t.classList.add('show');

  toastT = 1.6;

}

/* ============================================================

   9. FİZİK + AI GÜNCELLEME

============================================================ */

function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

function steerToward(ship, tx, ty, dt, thrustWanted){

  const desired = Math.atan2(ty-ship.y, tx-ship.x);

  let diff = desired - ship.angle;

  while(diff>Math.PI) diff-=Math.PI*2;

  while(diff<-Math.PI) diff+=Math.PI*2;

  const maxTurn = ship.tier.turnRate*dt;

  ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));

  ship.thrusting = thrustWanted;

}

function updatePhysics(ship, dt){

  if(ship.thrusting){

    const a = ship.tier.accel * statMul(ship,'speed');

    ship.vx += Math.cos(ship.angle)*a*dt;

    ship.vy += Math.sin(ship.angle)*a*dt;

  }

  const maxSpd = ship.tier.speed * statMul(ship,'speed');

  const spd = Math.hypot(ship.vx, ship.vy);

  if(spd > maxSpd){ const k = maxSpd/spd; ship.vx*=k; ship.vy*=k; }

  ship.vx *= 0.992; ship.vy *= 0.992; // hafif uzay sürtünmesi (kontrol edilebilir Newton fiziği)

  ship.x += ship.vx*dt; ship.y += ship.vy*dt;

  ship.x = Math.max(20, Math.min(WORLD-20, ship.x));

  ship.y = Math.max(20, Math.min(WORLD-20, ship.y));

}

function fire(ship){

  if(ship.fireCooldown>0) return;

  ship.fireCooldown = ship.tier.fireRate * (1/statMul(ship,'firerate'));

  const nx = ship.x+Math.cos(ship.angle)*ship.radius, ny = ship.y+Math.sin(ship.angle)*ship.radius;

  bullets.push({

    x:nx, y:ny,

    vx: Math.cos(ship.angle)*ship.tier.bulletSpeed + ship.vx*0.3,

    vy: Math.sin(ship.angle)*ship.tier.bulletSpeed + ship.vy*0.3,

    dmg: ship.tier.damage * statMul(ship,'damage'),

    owner: ship, life: 1.1, race: ship.race.id,

  });

  particles.push({x:nx,y:ny,r:ship.radius*0.4,life:0.08,color:'#fff'});

}

function nearestResource(ship){

  let best=null, bd=Infinity;

  for(const r of resources){

    if(r.raceId!==ship.race.id) continue;

    const d = dist(ship,r);

    if(d<bd){ bd=d; best=r; }

  }

  return best;

}

function nearestEnemy(ship, range){

  let best=null, bd=range;

  for(const o of ships){

    if(o===ship || !o.alive || o.race.id===ship.race.id) continue;

    const d = dist(ship,o);

    if(d<bd){ bd=d; best=o; }

  }

  return best;

}

function updateAI(ship, dt){

  ship.aiRepathT -= dt;

  const enemy = nearestEnemy(ship, 380);

  if(enemy){

    ship.aiState='fight';

    const d = dist(ship, enemy);

    steerToward(ship, enemy.x, enemy.y, dt, d>170);

    if(d<300){ ship.angle2ok=true; fireIfAligned(ship, enemy); }

    return;

  }

  if(ship.cargo >= ship.tier.cargoCap){

    ship.aiState='return';

    const b = bases[ship.race.id];

    steerToward(ship, b.x, b.y, dt, dist(ship,b)>60);

    return;

  }

  if(!ship.aiTarget || ship.aiRepathT<=0 || (ship.aiTarget && !resources.includes(ship.aiTarget))){

    ship.aiTarget = nearestResource(ship);

    ship.aiRepathT = 2;

  }

  if(ship.aiTarget){

    ship.aiState='mine';

    steerToward(ship, ship.aiTarget.x, ship.aiTarget.y, dt, dist(ship,ship.aiTarget)>40);

  } else {

    ship.thrusting=false;

  }

}

function fireIfAligned(ship, target){

  const desired = Math.atan2(target.y-ship.y, target.x-ship.x);

  let diff = Math.abs(desired-ship.angle);

  if(diff>Math.PI) diff = Math.PI*2-diff;

  if(diff < 0.35) fire(ship);

}

/* ============================================================

   10. ANA DÖNGÜ

============================================================ */

let last = performance.now();

function loop(now){

  const dt = Math.min(0.05, (now-last)/1000);

  last = now;

  if(gameStarted) update(dt);

  render();

  requestAnimationFrame(loop);

}

function update(dt){

  // --- oyuncu girişi ---

  if(player.alive){

    const wx = camera.x + mouse.x, wy = camera.y + mouse.y;

    steerToward(player, wx, wy, dt, mouse.rdown);

    if(mouse.down) fire(player);

    updatePhysics(player, dt);

    handleMining(player, dt);

    handleDelivery(player);

  }

  // --- botlar ---

  for(const s of ships){

    if(s===player || !s.alive) continue;

    updateAI(s, dt);

    updatePhysics(s, dt);

    handleMining(s, dt);

    handleDelivery(s);

  }

  // --- ateş bekleme süreleri ---

  for(const s of ships){ if(s.fireCooldown>0) s.fireCooldown -= dt; }

  // --- mermiler ---

  for(let i=bullets.length-1;i>=0;i--){

    const b = bullets[i];

    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;

    let hit=false;

    for(const s of ships){

      if(!s.alive || s===b.owner || s.race.id===b.race) continue;

      if(dist(b,s) < s.radius){

        s.hp -= b.dmg; hit=true;

        particles.push({x:b.x,y:b.y,r:14,life:0.18,color:s.race.color});

        if(s.hp<=0) killShip(s, b.owner);

        break;

      }

    }

    if(hit || b.life<=0) bullets.splice(i,1);

  }

  // --- üsler: enerji > 0 ise düşük hasarlı otomatik savunma ---

  for(const base of bases){

    const enemy = ships.find(s=>s.alive && s.race.id!==base.race.id && dist(s,base)<base.radius+40);

    if(enemy && base.energy>0){

      enemy.hp -= 90*dt;

      base.energy = Math.max(0, base.energy - 20*dt);

      if(enemy.hp<=0) killShip(enemy, null);

    }

  }

  // --- kaynak yeniden doğumu ---

  if(Math.random()<0.02){

    const z = zones[Math.floor(Math.random()*zones.length)];

    const rid = z.races[Math.floor(Math.random()*z.races.length)];

    if(resources.filter(r=>r.raceId===rid).length < 60) spawnResourceIn(z, rid);

  }

  // --- parçacıklar ---

  for(let i=particles.length-1;i>=0;i--){ particles[i].life-=dt; if(particles[i].life<=0) particles.splice(i,1); }

  // --- kamera ---

  camera.x = player.x - canvas.width/2;

  camera.y = player.y - canvas.height/2;

  if(toastT>0){ toastT-=dt; if(toastT<=0) document.getElementById('levelToast').classList.remove('show'); }

  updateHUD();

}

function handleMining(ship, dt){

  if(ship.cargo >= ship.tier.cargoCap) return;

  for(const r of resources){

    if(r.raceId!==ship.race.id) continue;

    if(dist(ship,r) < r.radius+ship.radius){

      const take = Math.min(1, r.amount, ship.tier.cargoCap-ship.cargo);

      if(take>0){

        r.amount -= take; ship.cargo += take;

        grantXp(ship, 4);

        particles.push({x:r.x,y:r.y,r:16,life:0.2,color:ship.race.color});

        if(r.amount<=0) resources.splice(resources.indexOf(r),1);

      }

      break;

    }

  }

}

function handleDelivery(ship){

  if(ship.cargo<=0) return;

  const b = bases[ship.race.id];

  if(dist(ship,b) < b.radius){

    b.energy = Math.min(b.energyMax, b.energy + ship.cargo*35);

    grantXp(ship, ship.cargo*10);

    ship.cargo = 0;

  }

}

function killShip(ship, killer){

  ship.alive = false;

  particles.push({x:ship.x,y:ship.y,r:ship.radius*2.4,life:0.35,color:'#ffcf4d'});

  if(ship.isPlayer){

    document.getElementById('deathInfo').textContent =

      killer ? `${killer.race.name} ırkından bir gemi tarafından yok edildin.` : 'Üs savunması tarafından yok edildin.';

    document.getElementById('deathOverlay').style.display='flex';

  } else {

    // botlar birkaç saniye sonra üslerinde yeniden doğar

    setTimeout(()=>{

      const b = bases[ship.race.id];

      ship.alive = true; ship.x=b.x; ship.y=b.y; ship.vx=0; ship.vy=0; ship.cargo=0;

      ship.level = Math.max(1, ship.level-1); applyTier(ship); ship.hp=ship.maxHp;

    }, 3500);

  }

}

/* ============================================================

   11. RENDER

============================================================ */

function worldToScreen(x,y){ return [x-camera.x, y-camera.y]; }

function render(){

  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(!gameStarted) return;

  drawStars();

  // bölge halkaları

  ctx.save();

  zones.forEach(z=>{

    const [sx,sy] = worldToScreen(z.x,z.y);

    ctx.beginPath(); ctx.arc(sx,sy,430,0,Math.PI*2);

    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=2; ctx.stroke();

  });

  ctx.restore();

  // üsler

  bases.forEach(b=>{

    const [sx,sy]=worldToScreen(b.x,b.y);

    if(sx<-150||sx>canvas.width+150||sy<-150||sy>canvas.height+150) return;

    ctx.beginPath(); ctx.arc(sx,sy,b.radius,0,Math.PI*2);

    ctx.fillStyle = b.race.dark; ctx.globalAlpha=.55; ctx.fill(); ctx.globalAlpha=1;

    ctx.lineWidth=3; ctx.strokeStyle=b.race.color; ctx.stroke();

    ctx.fillStyle=b.race.color; ctx.font='bold 13px Segoe UI'; ctx.textAlign='center';

    ctx.fillText(b.race.name.toUpperCase()+' ÜSSÜ', sx, sy-b.radius-12);

    // enerji halkası

    ctx.beginPath(); ctx.arc(sx,sy,b.radius+10,-Math.PI/2, -Math.PI/2 + Math.PI*2*(b.energy/b.energyMax));

    ctx.strokeStyle='#ffcf4d'; ctx.lineWidth=4; ctx.stroke();

  });

  // kaynaklar

  resources.forEach(r=>{

    const [sx,sy]=worldToScreen(r.x,r.y);

    if(sx<-30||sx>canvas.width+30||sy<-30||sy>canvas.height+30) return;

    const race = RACES[r.raceId];

    ctx.beginPath(); ctx.arc(sx,sy,r.radius,0,Math.PI*2);

    ctx.fillStyle=race.color; ctx.globalAlpha=.85; ctx.fill(); ctx.globalAlpha=1;

    ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.stroke();

  });

  // gemiler

  ships.forEach(s=>{

    if(!s.alive) return;

    const [sx,sy]=worldToScreen(s.x,s.y);

    if(sx<-60||sx>canvas.width+60||sy<-60||sy>canvas.height+60) return;

    ctx.save();

    ctx.translate(sx,sy); ctx.rotate(s.angle);

    drawShipShape(ctx, s.tier.sizeClass, s.radius, s.race.color, s.race.dark);

    if(s.thrusting){

      ctx.beginPath(); ctx.moveTo(-s.radius*0.5,s.radius*0.25);

      ctx.lineTo(-s.radius*(1.1+Math.random()*0.5),0);

      ctx.lineTo(-s.radius*0.5,-s.radius*0.25);

      ctx.fillStyle='rgba(255,190,90,.85)'; ctx.fill();

    }

    ctx.restore();

    // can barı (oyuncu hariç küçük gemilerde)

    if(!s.isPlayer){

      const w=26;

      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(sx-w/2, sy-s.radius-14, w,4);

      ctx.fillStyle=s.race.color; ctx.fillRect(sx-w/2, sy-s.radius-14, w*(s.hp/s.maxHp),4);

    }

  });

  // mermiler

  bullets.forEach(b=>{

    const [sx,sy]=worldToScreen(b.x,b.y);

    ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2);

    ctx.fillStyle = RACES[b.race].color; ctx.fill();

  });

  // parçacıklar

  particles.forEach(p=>{

    const [sx,sy]=worldToScreen(p.x,p.y);

    ctx.beginPath(); ctx.arc(sx,sy,p.r*(p.life>0?p.life*3:0.3),0,Math.PI*2);

    ctx.fillStyle=p.color; ctx.globalAlpha=Math.max(0,p.life*2); ctx.fill(); ctx.globalAlpha=1;

  });

  drawMinimap();

}

let starField = null;

function drawStars(){

  if(!starField){

    starField=[];

    for(let i=0;i<400;i++) starField.push({x:Math.random()*WORLD,y:Math.random()*WORLD,r:Math.random()*1.6});

  }

  ctx.fillStyle='#fff';

  starField.forEach(s=>{

    const sx = s.x-camera.x*0.6 - (camera.x*0.0), sy = s.y-camera.y*0.6;

    // basit paralaks

    const px = s.x*0.3 + WORLD*0.35 - camera.x*0.5;

    const py = s.y*0.3 + WORLD*0.35 - camera.y*0.5;

    const mx = ((px % canvas.width)+canvas.width)%canvas.width;

    const my = ((py % canvas.height)+canvas.height)%canvas.height;

    ctx.globalAlpha = 0.35+s.r*0.3;

    ctx.beginPath(); ctx.arc(mx,my,s.r,0,Math.PI*2); ctx.fill();

  });

  ctx.globalAlpha=1;

}

function drawMinimap(){

  mmCtx.clearRect(0,0,180,180);

  const scale = 180/WORLD;

  mmCtx.fillStyle='rgba(255,255,255,.04)';

  mmCtx.fillRect(0,0,180,180);

  bases.forEach(b=>{

    mmCtx.fillStyle=b.race.color;

    mmCtx.fillRect(b.x*scale-3,b.y*scale-3,6,6);

  });

  resources.forEach(r=>{

    mmCtx.fillStyle=RACES[r.raceId].color; mmCtx.globalAlpha=.5;

    mmCtx.fillRect(r.x*scale,r.y*scale,1.5,1.5);

  });

  mmCtx.globalAlpha=1;

  ships.forEach(s=>{

    if(!s.alive) return;

    mmCtx.fillStyle = s.isPlayer? '#fff' : s.race.color;

    mmCtx.beginPath(); mmCtx.arc(s.x*scale,s.y*scale, s.isPlayer?3:1.6,0,Math.PI*2); mmCtx.fill();

  });

  // görüş alanı kutusu

  mmCtx.strokeStyle='rgba(255,255,255,.4)';

  mmCtx.strokeRect(camera.x*scale, camera.y*scale, canvas.width*scale, canvas.height*scale);

}

/* ============================================================

   12. HUD GÜNCELLE

============================================================ */

function updateHUD(){

  if(!player) return;

  document.getElementById('shipName').textContent = player.tier.name;

  document.getElementById('shipClassRow').textContent = `${player.race.name} Irkı · Kademe ${player.tier.sizeClass}`;

  document.getElementById('lvlText').textContent = player.level;

  document.querySelector('#hpBar>div').style.width = Math.max(0,100*player.hp/player.maxHp)+'%';

  document.getElementById('hpText').textContent = Math.max(0,Math.round(player.hp))+' / '+player.maxHp;

  const need = player.tier.xpToNext;

  document.querySelector('#xpBar>div').style.width = (player.level>=25?100:100*player.xp/need)+'%';

  document.getElementById('xpText').textContent = player.level>=25? 'MAKS' : Math.round(player.xp)+' / '+need;

  document.querySelector('#cargoBar>div').style.width = 100*player.cargo/player.tier.cargoCap+'%';

  document.getElementById('cargoText').textContent = player.cargo+' / '+player.tier.cargoCap;

  const base = bases[player.race.id];

  document.querySelector('#baseBar>div').style.width = 100*base.energy/base.energyMax+'%';

}

})();

</script>

</body>

</html>

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/915f72ce-8bca-410d-851f-c76d666fac9f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
