/**
 * Classic Space Invaders — HTML5 canvas, requestAnimationFrame.
 * Fan recreation of the 1978 arcade game. Mobile pad + this-device high scores.
 */
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const padRoot = document.getElementById("pad");
  const nameEntry = document.getElementById("name-entry");
  const entryScoreEl = document.getElementById("entry-score");
  const btnCrt = document.getElementById("btn-crt");

  const W = canvas.width;
  const H = canvas.height;
  const SCALE = 3;
  const ASPECT = W / H;

  const COLS = 11;
  const ROWS = 5;
  const MAX_PLAYER_SHOTS = 1;
  const MAX_ALIEN_SHOTS = 3;
  const START_LIVES = 3;
  const EXTRA_LIFE_AT = 1500;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const HS_KEY = "si-scores-v1";
  const LAST_KEY = "si-last-v1";
  const HI_KEY = "si-hi";
  const CRT_KEY = "si-crt";

  const COLORS = {
    player: "#33ff66",
    squid: "#ff66dd",
    crab: "#66ffe0",
    octopus: "#f4f4a8",
    ufo: "#ff3355",
    bunker: "#33ff66",
    shot: "#ffffff",
    alienShot: "#ffcc66",
    hud: "#33ff66",
    text: "#e8f0e8",
    dim: "#6a8a6a",
    cyan: "#66ffe0",
    red: "#ff4466",
  };

  const STATE = {
    TITLE: "title",
    PLAYING: "playing",
    PAUSED: "paused",
    DYING: "dying",
    WAVE: "wave",
    GAMEOVER: "gameover",
    NAMEENTRY: "nameentry",
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const keys = new Set();
  const pad = { left: false, right: false, fire: false };
  let state = STATE.TITLE;
  let score = 0;
  let hiScore = 0;
  let lives = START_LIVES;
  let wave = 1;
  let extraAwarded = false;
  let stepNote = 0;

  let player;
  let playerShot = null;
  let aliens = [];
  let alienDir = 1;
  let alienStepTimer = 0;
  let alienStepDelay = 700;
  let alienFrame = 0;
  let alienShots = [];
  let fireCooldown = 0;
  let bunkers = [];
  let ufo = null;
  let ufoTimer = 0;
  let explosions = [];
  let particles = [];
  let overlayTimer = 0;
  let lastTs = 0;
  let shake = 0;
  let highlightId = 0;
  let lastRun = null;
  let scores = [];
  let pendingScore = 0;
  let pendingWave = 1;
  let initials = ["A", "A", "A"];
  let initialSlot = 0;
  let blink = 0;
  let attractT = 0;
  let attractDir = 1;
  let attractX = 80;

  const stars = Array.from({ length: 72 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: Math.random() * 1.6 + 0.3,
    v: Math.random() * 14 + 6,
    tw: Math.random() * Math.PI * 2,
  }));

  function px(n) {
    return n * SCALE;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function rumble(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {}
  }

  function kindForRow(row) {
    if (row === 0) return "squid";
    if (row <= 2) return "crab";
    return "octopus";
  }

  function pointsFor(kind) {
    if (kind === "squid") return 30;
    if (kind === "crab") return 20;
    if (kind === "ufo") return [50, 100, 150, 300][Math.floor(Math.random() * 4)];
    return 10;
  }

  function colorFor(kind) {
    return COLORS[kind] || COLORS.text;
  }

  function gridForAlien(kind, frame) {
    return Sprites[kind][frame % 2];
  }

  function loadScores() {
    let list = [];
    try {
      const raw = JSON.parse(localStorage.getItem(HS_KEY) || "[]");
      if (Array.isArray(raw)) list = raw.filter((r) => r && typeof r.score === "number");
    } catch (_) {}
    const oldHi = Number(localStorage.getItem(HI_KEY) || 0);
    if (!list.length && oldHi > 0) {
      list = [{ name: "---", score: oldHi, wave: 1, ts: 0, id: 1 }];
    }
    list.sort((a, b) => b.score - a.score || (a.ts || 0) - (b.ts || 0));
    scores = list.slice(0, 10);
    hiScore = scores.length ? scores[0].score : oldHi || 0;
    try {
      lastRun = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
    } catch (_) {
      lastRun = null;
    }
  }

  function persistScores() {
    localStorage.setItem(HS_KEY, JSON.stringify(scores.slice(0, 10)));
    hiScore = scores.length ? scores[0].score : hiScore;
    localStorage.setItem(HI_KEY, String(hiScore));
  }

  function qualifies(n) {
    if (n <= 0) return false;
    if (scores.length < 10) return true;
    return n > scores[scores.length - 1].score;
  }

  function rememberLast(entry) {
    lastRun = entry;
    localStorage.setItem(LAST_KEY, JSON.stringify(entry));
  }

  function insertScore(name, n, wv) {
    const entry = {
      name: (name || "AAA").slice(0, 3).toUpperCase(),
      score: n,
      wave: wv,
      ts: Date.now(),
      id: Date.now() + Math.floor(Math.random() * 99),
    };
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score || a.ts - b.ts);
    scores = scores.slice(0, 10);
    persistScores();
    rememberLast(entry);
    highlightId = entry.id;
    return entry;
  }

  function burst(x, y, color, n, speed) {
    const count = n || 14;
    const sp = speed || 160;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * sp;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 220 + Math.random() * 280,
        max: 500,
        color,
        size: 1.4 + Math.random() * 2.2,
      });
    }
  }

  function addExplosion(x, y, color, life) {
    explosions.push({ x, y, color, life, max: life });
    burst(x, y, color, 12, 140);
  }

  function addShake(amount) {
    if (reduceMotion) return;
    shake = Math.max(shake, amount);
  }

  function resetPlayer() {
    const sz = spriteSize(Sprites.player);
    player = {
      x: (W - sz.w * SCALE) / 2,
      y: H - px(28),
      w: sz.w * SCALE,
      h: sz.h * SCALE,
      speed: 180,
      alive: true,
    };
  }

  function spawnAliens() {
    aliens = [];
    const gapX = px(16);
    const gapY = px(12);
    const startX = px(18);
    const startY = px(40) + Math.min(wave - 1, 6) * px(6);
    for (let r = 0; r < ROWS; r++) {
      const kind = kindForRow(r);
      const grid = gridForAlien(kind, 0);
      const sz = spriteSize(grid);
      for (let c = 0; c < COLS; c++) {
        aliens.push({
          kind,
          col: c,
          row: r,
          x: startX + c * gapX,
          y: startY + r * gapY,
          w: sz.w * SCALE,
          h: sz.h * SCALE,
          alive: true,
        });
      }
    }
    alienDir = 1;
    alienFrame = 0;
    alienStepDelay = Math.max(90, 720 - (wave - 1) * 50);
    updateAlienSpeed();
  }

  function livingAliens() {
    return aliens.filter((a) => a.alive);
  }

  function updateAlienSpeed() {
    const n = livingAliens().length;
    const total = COLS * ROWS;
    const t = 1 - n / total;
    const base = Math.max(70, 720 - (wave - 1) * 50);
    alienStepDelay = Math.max(28, base * (0.18 + 0.82 * (1 - t * t)));
    if (n === 1) alienStepDelay = Math.min(alienStepDelay, 32);
  }

  function spawnBunkers() {
    bunkers = [];
    const template = bunkerFromTemplate();
    const bw = template[0].length * SCALE;
    const slots = 4;
    const margin = px(24);
    const usable = W - margin * 2 - bw;
    for (let i = 0; i < slots; i++) {
      const x = margin + (slots === 1 ? 0 : (usable / (slots - 1)) * i);
      bunkers.push({
        x,
        y: H - px(56),
        cells: template.map((row) => row.slice()),
        scale: SCALE,
      });
    }
  }

  function bunkerBounds(b) {
    return {
      x: b.x,
      y: b.y,
      w: b.cells[0].length * b.scale,
      h: b.cells.length * b.scale,
    };
  }

  function damageBunker(b, hitX, hitY, radius) {
    const s = b.scale;
    const cx = Math.floor((hitX - b.x) / s);
    const cy = Math.floor((hitY - b.y) / s);
    let hit = false;
    const r2 = radius * radius;
    for (let r = 0; r < b.cells.length; r++) {
      for (let c = 0; c < b.cells[r].length; c++) {
        if (!b.cells[r][c]) continue;
        const dx = c - cx;
        const dy = r - cy;
        if (dx * dx + dy * dy <= r2) {
          b.cells[r][c] = 0;
          hit = true;
        }
      }
    }
    return hit;
  }

  function shotHitsBunker(shot) {
    const cx = shot.x + shot.w / 2;
    const cy = shot.vy > 0 ? shot.y + shot.h : shot.y;
    for (const b of bunkers) {
      const box = bunkerBounds(b);
      if (!aabb(shot, box)) continue;
      if (damageBunker(b, cx, cy, 2.2)) return true;
    }
    return false;
  }

  function startGame() {
    hideNameEntry();
    score = 0;
    lives = START_LIVES;
    wave = 1;
    extraAwarded = false;
    playerShot = null;
    alienShots = [];
    ufo = null;
    ufoTimer = rand(8000, 14000);
    explosions = [];
    particles = [];
    shake = 0;
    resetPlayer();
    spawnAliens();
    spawnBunkers();
    state = STATE.PLAYING;
    Sfx.unlock();
    Sfx.start();
  }

  function nextWave() {
    wave += 1;
    playerShot = null;
    alienShots = [];
    ufo = null;
    ufoTimer = rand(7000, 12000);
    resetPlayer();
    spawnAliens();
    spawnBunkers();
    state = STATE.PLAYING;
    Sfx.wave();
  }

  function firePlayer() {
    if (state !== STATE.PLAYING || !player.alive) return;
    if (playerShot) return;
    if (MAX_PLAYER_SHOTS < 1) return;
    const sz = { w: SCALE, h: px(5) };
    playerShot = {
      x: player.x + player.w / 2 - sz.w / 2,
      y: player.y - sz.h,
      w: sz.w,
      h: sz.h,
      vy: -420,
    };
    Sfx.shoot();
    rumble(8);
  }

  function bottomShooters() {
    const byCol = new Map();
    for (const a of livingAliens()) {
      const prev = byCol.get(a.col);
      if (!prev || a.row > prev.row) byCol.set(a.col, a);
    }
    return [...byCol.values()];
  }

  function maybeAlienFire(dt) {
    fireCooldown -= dt;
    if (fireCooldown > 0) return;
    const shooters = bottomShooters();
    if (!shooters.length) return;
    if (alienShots.length >= MAX_ALIEN_SHOTS) return;
    const chance = 0.012 + wave * 0.003 + (1 - livingAliens().length / (COLS * ROWS)) * 0.01;
    if (Math.random() > chance * (dt / 16)) {
      fireCooldown = 80;
      return;
    }
    const a = shooters[Math.floor(Math.random() * shooters.length)];
    alienShots.push({
      x: a.x + a.w / 2 - SCALE,
      y: a.y + a.h,
      w: SCALE * 2,
      h: px(5),
      vy: 150 + wave * 12,
      zig: Math.random() < 0.35,
      phase: 0,
    });
    fireCooldown = Math.max(220, 700 - wave * 40);
  }

  function spawnUfo() {
    const grid = Sprites.ufo;
    const sz = spriteSize(grid);
    const fromLeft = Math.random() < 0.5;
    ufo = {
      x: fromLeft ? -sz.w * SCALE : W + 4,
      y: px(18),
      w: sz.w * SCALE,
      h: sz.h * SCALE,
      vx: fromLeft ? 70 : -70,
      alive: true,
    };
  }

  function killPlayer() {
    if (!player.alive) return;
    player.alive = false;
    lives -= 1;
    playerShot = null;
    alienShots = [];
    addExplosion(player.x + player.w / 2, player.y + player.h / 2, COLORS.player, 700);
    burst(player.x + player.w / 2, player.y + player.h / 2, COLORS.player, 22, 220);
    addShake(14);
    Sfx.death();
    rumble([40, 40, 80]);
    overlayTimer = 1100;
    state = STATE.DYING;
  }

  function grantScore(n) {
    score += n;
    if (score > hiScore) hiScore = score;
    if (!extraAwarded && score >= EXTRA_LIFE_AT) {
      extraAwarded = true;
      lives += 1;
      Sfx.extra();
    }
  }

  function finishRun() {
    const run = { name: "", score, wave, ts: Date.now(), id: Date.now() };
    rememberLast({ ...run, name: "---" });
    if (qualifies(score)) {
      pendingScore = score;
      pendingWave = wave;
      initials = ["A", "A", "A"];
      initialSlot = 0;
      state = STATE.NAMEENTRY;
      showNameEntry();
      Sfx.highscore();
    } else {
      state = STATE.GAMEOVER;
    }
  }

  function showNameEntry() {
    nameEntry.classList.remove("hidden");
    entryScoreEl.textContent = String(pendingScore).padStart(5, "0");
    renderInitials();
  }

  function hideNameEntry() {
    nameEntry.classList.add("hidden");
  }

  function renderInitials() {
    nameEntry.querySelectorAll(".letter").forEach((btn) => {
      const i = Number(btn.dataset.i);
      btn.textContent = initials[i];
    });
    nameEntry.querySelectorAll(".letter-col").forEach((col) => {
      col.classList.toggle("is-active", Number(col.dataset.i) === initialSlot);
    });
  }

  function cycleLetter(i, dir) {
    const idx = LETTERS.indexOf(initials[i] || "A");
    const next = (idx + dir + LETTERS.length) % LETTERS.length;
    initials[i] = LETTERS[next];
    renderInitials();
  }

  function commitInitials() {
    if (state !== STATE.NAMEENTRY) return;
    insertScore(initials.join(""), pendingScore, pendingWave);
    hideNameEntry();
    state = STATE.TITLE;
  }

  function stepAliens() {
    const pack = livingAliens();
    if (!pack.length) return;
    Sfx.step(stepNote++);
    alienFrame = 1 - alienFrame;

    let minX = Infinity;
    let maxX = -Infinity;
    for (const a of pack) {
      minX = Math.min(minX, a.x);
      maxX = Math.max(maxX, a.x + a.w);
    }

    const stepX = px(4) * alienDir;
    const wouldHit = alienDir > 0 ? maxX + stepX >= W - px(4) : minX + stepX <= px(4);

    if (wouldHit) {
      alienDir *= -1;
      for (const a of pack) a.y += px(8);
    } else {
      for (const a of pack) a.x += stepX;
    }

    const lowest = Math.max(...pack.map((a) => a.y + a.h));
    if (lowest >= player.y) {
      lives = 1;
      killPlayer();
    }
  }

  function movingLeft() {
    return pad.left || keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  }

  function movingRight() {
    return pad.right || keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  }

  function firing() {
    return pad.fire || keys.has(" ");
  }

  function updatePlaying(dt) {
    const move = (movingLeft() ? -1 : 0) + (movingRight() ? 1 : 0);
    player.x += move * player.speed * (dt / 1000);
    player.x = Math.max(px(2), Math.min(W - player.w - px(2), player.x));
    if (firing()) firePlayer();

    if (playerShot) {
      playerShot.y += playerShot.vy * (dt / 1000);
      if (playerShot.y + playerShot.h < 0) playerShot = null;
    }

    for (const s of alienShots) {
      s.y += s.vy * (dt / 1000);
      if (s.zig) {
        s.phase += dt;
        s.x += Math.sin(s.phase / 90) * 0.35;
      }
    }
    alienShots = alienShots.filter((s) => s.y < H);

    alienStepTimer += dt;
    if (alienStepTimer >= alienStepDelay) {
      alienStepTimer = 0;
      stepAliens();
      if (state !== STATE.PLAYING) return;
    }

    maybeAlienFire(dt);

    ufoTimer -= dt;
    if (!ufo && ufoTimer <= 0) {
      spawnUfo();
      ufoTimer = rand(12000, 22000);
    }
    if (ufo) {
      ufo.x += ufo.vx * (dt / 1000);
      if (Math.random() < 0.04) Sfx.ufo();
      if (ufo.x > W + 40 || ufo.x + ufo.w < -40) ufo = null;
    }

    resolveCollisions();

    if (!livingAliens().length && state === STATE.PLAYING) {
      state = STATE.WAVE;
      overlayTimer = 1400;
      Sfx.wave();
    }
  }

  function resolveCollisions() {
    if (playerShot) {
      if (ufo && aabb(playerShot, ufo)) {
        grantScore(pointsFor("ufo"));
        addExplosion(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, COLORS.ufo, 400);
        burst(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, COLORS.ufo, 18, 200);
        Sfx.hit();
        rumble(15);
        ufo = null;
        playerShot = null;
      }
    }

    if (playerShot) {
      for (const a of livingAliens()) {
        if (!aabb(playerShot, a)) continue;
        a.alive = false;
        grantScore(pointsFor(a.kind));
        addExplosion(a.x + a.w / 2, a.y + a.h / 2, colorFor(a.kind), 280);
        Sfx.hit();
        rumble(10);
        playerShot = null;
        updateAlienSpeed();
        break;
      }
    }

    if (playerShot && shotHitsBunker(playerShot)) {
      Sfx.bunker();
      burst(playerShot.x, playerShot.y, COLORS.bunker, 6, 80);
      playerShot = null;
    }

    for (let i = alienShots.length - 1; i >= 0; i--) {
      const s = alienShots[i];
      if (playerShot && aabb(s, playerShot)) {
        alienShots.splice(i, 1);
        burst(s.x, s.y, COLORS.shot, 8, 90);
        playerShot = null;
        addExplosion(s.x, s.y, COLORS.shot, 160);
        continue;
      }
      if (shotHitsBunker(s)) {
        Sfx.bunker();
        burst(s.x, s.y, COLORS.bunker, 6, 80);
        alienShots.splice(i, 1);
        continue;
      }
      if (player.alive && aabb(s, player)) {
        alienShots.splice(i, 1);
        killPlayer();
        return;
      }
    }

    for (const a of livingAliens()) {
      for (const b of bunkers) {
        const box = bunkerBounds(b);
        if (!aabb(a, box)) continue;
        damageBunker(b, a.x + a.w / 2, a.y + a.h - 2, 3.5);
      }
    }
  }

  function updateExplosions(dt) {
    for (const e of explosions) e.life -= dt;
    explosions = explosions.filter((e) => e.life > 0);
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.vy += 40 * (dt / 1000);
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function updateStars(dt) {
    for (const st of stars) {
      st.y += st.v * (dt / 1000);
      st.tw += dt / 400;
      if (st.y > H) {
        st.y = 0;
        st.x = Math.random() * W;
      }
    }
  }

  function updateAttract(dt) {
    attractT += dt;
    attractX += attractDir * 28 * (dt / 1000);
    if (attractX > 140) attractDir = -1;
    if (attractX < 40) attractDir = 1;
    if (Math.floor(attractT / 420) !== Math.floor((attractT - dt) / 420)) {
      alienFrame = 1 - alienFrame;
    }
  }

  function togglePause() {
    if (state === STATE.PLAYING) state = STATE.PAUSED;
    else if (state === STATE.PAUSED) state = STATE.PLAYING;
  }

  function tryStart() {
    Sfx.unlock();
    if (state === STATE.TITLE || state === STATE.GAMEOVER) startGame();
    else if (state === STATE.NAMEENTRY) commitInitials();
  }

  function update(dt) {
    blink += dt;
    updateStars(dt);
    updateExplosions(dt);
    if (shake > 0) shake *= Math.pow(0.88, dt / 16);

    if (state === STATE.TITLE) updateAttract(dt);
    else if (state === STATE.PLAYING) updatePlaying(dt);
    else if (state === STATE.DYING) {
      overlayTimer -= dt;
      if (overlayTimer <= 0) {
        if (lives <= 0) finishRun();
        else {
          resetPlayer();
          alienShots = [];
          playerShot = null;
          state = STATE.PLAYING;
        }
      }
    } else if (state === STATE.WAVE) {
      overlayTimer -= dt;
      if (overlayTimer <= 0) nextWave();
    }
  }

  function fillText(text, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Courier New", Courier, monospace`;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "top";
    ctx.fillText(text, x, y);
  }

  function drawStars() {
    for (const st of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(st.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = "#c8ffd8";
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    fillText("SCORE", 16, 8, 14, COLORS.dim);
    fillText(String(score).padStart(5, "0"), 16, 24, 20, COLORS.hud);
    fillText("HI-SCORE", W / 2, 8, 14, COLORS.dim, "center");
    fillText(String(hiScore).padStart(5, "0"), W / 2, 24, 20, COLORS.hud, "center");
    fillText("WAVE", W - 16, 8, 14, COLORS.dim, "right");
    fillText(String(wave), W - 16, 24, 20, COLORS.hud, "right");

    fillText("LIVES", 16, H - 22, 13, COLORS.dim);
    const sz = spriteSize(Sprites.player);
    const extras = Math.max(0, lives - (player && player.alive ? 1 : 0));
    for (let i = 0; i < extras; i++) {
      drawSprite(ctx, Sprites.player, 90 + i * (sz.w * SCALE + 8), H - 24, COLORS.player, SCALE);
    }
  }

  function drawBunkers() {
    for (const b of bunkers) {
      ctx.fillStyle = COLORS.bunker;
      const s = b.scale;
      for (let r = 0; r < b.cells.length; r++) {
        for (let c = 0; c < b.cells[r].length; c++) {
          if (b.cells[r][c]) ctx.fillRect(b.x + c * s, b.y + r * s, s, s);
        }
      }
    }
  }

  function drawPlayfield() {
    ctx.strokeStyle = "#1a4a28";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, player.y + player.h + 6);
    ctx.lineTo(W, player.y + player.h + 6);
    ctx.stroke();

    drawBunkers();

    for (const a of livingAliens()) {
      const grid = gridForAlien(a.kind, alienFrame);
      drawSprite(ctx, grid, a.x, a.y, colorFor(a.kind), SCALE);
    }

    if (ufo) drawSprite(ctx, Sprites.ufo, ufo.x, ufo.y, COLORS.ufo, SCALE);

    if (player.alive) {
      drawSprite(ctx, Sprites.player, player.x, player.y, COLORS.player, SCALE);
    } else {
      drawSprite(ctx, Sprites.playerExplode, player.x, player.y, COLORS.player, SCALE);
    }

    if (playerShot) {
      ctx.fillStyle = COLORS.shot;
      ctx.fillRect(playerShot.x, playerShot.y, playerShot.w, playerShot.h);
    }
    for (const s of alienShots) {
      ctx.fillStyle = COLORS.alienShot;
      ctx.fillRect(s.x, s.y, s.w, SCALE);
      ctx.fillRect(s.x + SCALE / 2, s.y + SCALE, SCALE, s.h - SCALE);
      ctx.fillRect(s.x, s.y + s.h - SCALE, s.w, SCALE);
    }

    for (const e of explosions) {
      const t = e.life / e.max;
      const r = (1 - t) * 18 + 4;
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = Math.max(0, t);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawCenteredOverlay(lines) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, W, H);
    let y = H / 2 - lines.length * 18;
    for (const line of lines) {
      fillText(line.text, W / 2, y, line.size || 22, line.color || COLORS.text, "center");
      y += (line.size || 22) + 12;
    }
  }

  function drawHighScoreTable(originY) {
    fillText("HIGH SCORES  ·  THIS DEVICE", W / 2, originY, 14, COLORS.cyan, "center");
    fillText("RK   NAME     SCORE   WAVE", W / 2, originY + 22, 13, COLORS.dim, "center");
    let y = originY + 42;
    for (let i = 0; i < 10; i++) {
      const row = scores[i];
      const rank = String(i + 1).padStart(2, "0");
      if (!row) {
        fillText(rank + "   ···     00000     -", W / 2, y, 15, "#3a4a3a", "center");
      } else {
        const fresh = row.id === highlightId;
        const name = (row.name || "---").padEnd(3, " ");
        const line =
          rank + "   " + name + "     " + String(row.score).padStart(5, "0") + "    " + String(row.wave || 1);
        const col = fresh ? "#fffbe6" : i === 0 ? COLORS.hud : COLORS.text;
        fillText(line, W / 2, y, 15, col, "center");
        if (fresh && Math.sin(blink / 120) > 0) {
          fillText("◀ NEW", W / 2 + 210, y, 13, COLORS.cyan, "left");
        }
      }
      y += 20;
    }
    if (lastRun) {
      fillText(
        "LAST RUN  " +
          String(lastRun.score).padStart(5, "0") +
          "  " +
          (lastRun.name || "---") +
          "  WAVE " +
          (lastRun.wave || 1),
        W / 2,
        y + 8,
        13,
        COLORS.dim,
        "center"
      );
    }
    return y;
  }

  function drawTitle() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawStars();

    fillText("PLAY", W / 2, 36, 16, COLORS.dim, "center");
    fillText("SPACE INVADERS", W / 2, 58, 34, COLORS.hud, "center");
    fillText("FAN RECREATION OF THE 1978 ARCADE GAME", W / 2, 100, 12, COLORS.dim, "center");

    const kinds = ["squid", "crab", "octopus"];
    for (let i = 0; i < 8; i++) {
      const kind = kinds[i % 3];
      const grid = gridForAlien(kind, alienFrame);
      const x = attractX + i * 52;
      const y = 128 + Math.sin((attractT + i * 80) / 260) * 6;
      drawSprite(ctx, grid, x, y, colorFor(kind), SCALE);
    }
    drawSprite(ctx, Sprites.ufo, W - 140 - (attractT / 40) % (W + 80), 118, COLORS.ufo, SCALE);

    const table = [
      { kind: "ufo", pts: "?  MYSTERY" },
      { kind: "squid", pts: "=  30 PTS" },
      { kind: "crab", pts: "=  20 PTS" },
      { kind: "octopus", pts: "=  10 PTS" },
    ];
    let y = 176;
    fillText("* SCORE ADVANCE TABLE *", W / 2, y, 14, COLORS.text, "center");
    y += 28;
    for (const row of table) {
      const grid = row.kind === "ufo" ? Sprites.ufo : Sprites[row.kind][0];
      const sz = spriteSize(grid);
      const x = W / 2 - 88;
      drawSprite(ctx, grid, x, y, colorFor(row.kind), 2);
      fillText(row.pts, x + sz.w * 2 + 16, y + 2, 16, COLORS.text);
      y += 26;
    }

    drawHighScoreTable(y + 8);

    const pulse = !reduceMotion && Math.sin(blink / 220) > 0 ? COLORS.hud : COLORS.cyan;
    fillText("TAP START  ·  PRESS ENTER / SPACE", W / 2, H - 78, 16, pulse, "center");
    fillText("◀ ▶ MOVE    FIRE    1 SHOT    3 LIVES", W / 2, H - 52, 13, COLORS.dim, "center");
    fillText("P / PAUSE    CRT TOGGLES SCANLINES", W / 2, H - 32, 12, COLORS.dim, "center");
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (state === STATE.TITLE) {
      drawTitle();
      return;
    }

    ctx.save();
    if (shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawStars();
    drawHud();
    drawPlayfield();
    ctx.restore();

    if (state === STATE.PAUSED) {
      drawCenteredOverlay([
        { text: "PAUSED", size: 32, color: COLORS.hud },
        { text: "P / PAUSE TO RESUME", size: 16, color: COLORS.dim },
      ]);
    } else if (state === STATE.WAVE) {
      drawCenteredOverlay([
        { text: "WAVE " + wave + " CLEARED", size: 28, color: COLORS.hud },
        { text: "GET READY", size: 16, color: COLORS.dim },
      ]);
    } else if (state === STATE.NAMEENTRY) {
      drawCenteredOverlay([
        { text: "GAME OVER", size: 28, color: COLORS.red },
        { text: "YOU MADE THE TABLE", size: 16, color: COLORS.cyan },
        { text: "ENTER INITIALS", size: 16, color: COLORS.hud },
      ]);
    } else if (state === STATE.GAMEOVER) {
      const made = highlightId && lastRun && lastRun.id === highlightId;
      drawCenteredOverlay([
        { text: "GAME OVER", size: 36, color: COLORS.red },
        { text: "SCORE  " + String(score).padStart(5, "0"), size: 20, color: COLORS.text },
        { text: made ? "NEW ENTRY ON THIS DEVICE" : "THIS DEVICE  ·  NO TABLE ENTRY", size: 14, color: COLORS.cyan },
        { text: "TAP START  ·  PRESS ENTER", size: 16, color: COLORS.hud },
      ]);
    }
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 50) dt = 50;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function fitStage() {
    const wrap = document.querySelector(".stage-wrap");
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const availW = Math.max(120, rect.width);
    const availH = Math.max(120, rect.height);
    let cw;
    let ch;
    if (availW / availH > ASPECT) {
      ch = availH;
      cw = ch * ASPECT;
    } else {
      cw = availW;
      ch = cw / ASPECT;
    }
    canvas.style.width = Math.floor(cw) + "px";
    canvas.style.height = Math.floor(ch) + "px";
  }

  function bindHold(el, on, off) {
    const down = (e) => {
      e.preventDefault();
      Sfx.unlock();
      el.classList.add("is-down");
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      on();
    };
    const up = (e) => {
      e.preventDefault();
      el.classList.remove("is-down");
      off();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
  }

  function unlockOnce() {
    Sfx.unlock();
  }

  ["pointerdown", "touchstart", "keydown"].forEach((ev) => {
    window.addEventListener(ev, unlockOnce, { once: true, passive: true });
  });

  bindHold(
    document.getElementById("btn-left"),
    () => {
      pad.left = true;
    },
    () => {
      pad.left = false;
    }
  );
  bindHold(
    document.getElementById("btn-right"),
    () => {
      pad.right = true;
    },
    () => {
      pad.right = false;
    }
  );
  bindHold(
    document.getElementById("btn-fire"),
    () => {
      pad.fire = true;
      if (state === STATE.TITLE || state === STATE.GAMEOVER) tryStart();
      else if (state === STATE.NAMEENTRY) commitInitials();
      else firePlayer();
    },
    () => {
      pad.fire = false;
    }
  );

  document.getElementById("btn-start").addEventListener("click", (e) => {
    e.preventDefault();
    tryStart();
  });
  document.getElementById("btn-pause").addEventListener("click", (e) => {
    e.preventDefault();
    Sfx.unlock();
    togglePause();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    Sfx.unlock();
    if (state === STATE.TITLE || state === STATE.GAMEOVER) tryStart();
    else if (state === STATE.PLAYING) firePlayer();
  });

  padRoot.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  stage.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  document.getElementById("btn-save-score").addEventListener("click", (e) => {
    e.preventDefault();
    commitInitials();
  });

  nameEntry.querySelectorAll(".letter-col").forEach((col) => {
    const i = Number(col.dataset.i);
    col.querySelectorAll(".chev").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        initialSlot = i;
        cycleLetter(i, btn.dataset.dir === "up" ? -1 : 1);
      });
    });
    col.querySelector(".letter").addEventListener("click", (e) => {
      e.preventDefault();
      initialSlot = i;
      cycleLetter(i, 1);
      renderInitials();
    });
  });

  function applyCrt(on) {
    document.body.classList.toggle("crt-on", on);
    btnCrt.setAttribute("aria-pressed", on ? "true" : "false");
    localStorage.setItem(CRT_KEY, on ? "1" : "0");
  }
  applyCrt((localStorage.getItem(CRT_KEY) || "1") !== "0" && !reduceMotion);
  btnCrt.addEventListener("click", () => {
    applyCrt(document.body.classList.contains("crt-on") === false);
  });

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.key);
    Sfx.unlock();

    if (state === STATE.NAMEENTRY) {
      if (e.key === "ArrowLeft") initialSlot = (initialSlot + 2) % 3;
      else if (e.key === "ArrowRight") initialSlot = (initialSlot + 1) % 3;
      else if (e.key === "ArrowUp") cycleLetter(initialSlot, -1);
      else if (e.key === "ArrowDown") cycleLetter(initialSlot, 1);
      else if (e.key === "Backspace") {
        if (initials[initialSlot] !== "A" && initialSlot >= 0) {
          initials[initialSlot] = "A";
        } else if (initialSlot > 0) {
          initialSlot -= 1;
          initials[initialSlot] = "A";
        }
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        initials[initialSlot] = e.key.toUpperCase();
        initialSlot = Math.min(2, initialSlot + 1);
      } else if (e.key === "Enter" || e.key === " ") {
        commitInitials();
      }
      renderInitials();
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      if (state === STATE.TITLE) startGame();
      else if (state === STATE.GAMEOVER) startGame();
      else if (e.key === " " && state === STATE.PLAYING) firePlayer();
    }
    if ((e.key === "p" || e.key === "P" || e.key === "Escape") && (state === STATE.PLAYING || state === STATE.PAUSED)) {
      togglePause();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    pad.left = pad.right = pad.fire = false;
    if (state === STATE.PLAYING) state = STATE.PAUSED;
  });

  window.addEventListener("resize", fitStage);
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  window.addEventListener("orientationchange", () => setTimeout(fitStage, 80));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitStage);
  }

  loadScores();
  fitStage();
  drawTitle();
  requestAnimationFrame(loop);
})();
