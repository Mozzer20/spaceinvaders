/**
 * Classic Space Invaders — HTML5 canvas, requestAnimationFrame.
 * Fan recreation of the 1978 arcade game.
 */
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;
  const SCALE = 3;

  const COLS = 11;
  const ROWS = 5;
  const MAX_PLAYER_SHOTS = 1;
  const MAX_ALIEN_SHOTS = 3;
  const START_LIVES = 3;
  const EXTRA_LIFE_AT = 1500;

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
  };

  const STATE = {
    TITLE: "title",
    PLAYING: "playing",
    PAUSED: "paused",
    DYING: "dying",
    WAVE: "wave",
    GAMEOVER: "gameover",
  };

  const keys = new Set();
  let state = STATE.TITLE;
  let score = 0;
  let hiScore = Number(localStorage.getItem("si-hi") || 0);
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
  let overlayTimer = 0;
  let lastTs = 0;

  function px(n) {
    return n * SCALE;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
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

  function addExplosion(x, y, color, life) {
    explosions.push({ x, y, color, life, max: life });
  }

  function startGame() {
    score = 0;
    lives = START_LIVES;
    wave = 1;
    extraAwarded = false;
    playerShot = null;
    alienShots = [];
    ufo = null;
    ufoTimer = rand(8000, 14000);
    explosions = [];
    resetPlayer();
    spawnAliens();
    spawnBunkers();
    state = STATE.PLAYING;
    Sfx.unlock();
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
    const sz = { w: SCALE, h: px(5) };
    playerShot = {
      x: player.x + player.w / 2 - sz.w / 2,
      y: player.y - sz.h,
      w: sz.w,
      h: sz.h,
      vy: -420,
    };
    Sfx.shoot();
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
    Sfx.death();
    overlayTimer = 1100;
    state = STATE.DYING;
  }

  function grantScore(n) {
    score += n;
    if (score > hiScore) {
      hiScore = score;
      localStorage.setItem("si-hi", String(hiScore));
    }
    if (!extraAwarded && score >= EXTRA_LIFE_AT) {
      extraAwarded = true;
      lives += 1;
      Sfx.extra();
    }
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

  function updatePlaying(dt) {
    const move = (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") ? -1 : 0) +
      (keys.has("ArrowRight") || keys.has("d") || keys.has("D") ? 1 : 0);
    player.x += move * player.speed * (dt / 1000);
    player.x = Math.max(px(2), Math.min(W - player.w - px(2), player.x));
    if (keys.has(" ")) firePlayer();

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
        Sfx.hit();
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
        playerShot = null;
        updateAlienSpeed();
        break;
      }
    }

    if (playerShot && shotHitsBunker(playerShot)) {
      Sfx.bunker();
      playerShot = null;
    }

    for (let i = alienShots.length - 1; i >= 0; i--) {
      const s = alienShots[i];
      if (playerShot && aabb(s, playerShot)) {
        alienShots.splice(i, 1);
        playerShot = null;
        addExplosion(s.x, s.y, COLORS.shot, 160);
        continue;
      }
      if (shotHitsBunker(s)) {
        Sfx.bunker();
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
  }

  function update(dt) {
    updateExplosions(dt);
    if (state === STATE.PLAYING) updatePlaying(dt);
    else if (state === STATE.DYING) {
      overlayTimer -= dt;
      if (overlayTimer <= 0) {
        if (lives <= 0) {
          state = STATE.GAMEOVER;
        } else {
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

  function drawTitle() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    fillText("PLAY", W / 2, 70, 18, COLORS.dim, "center");
    fillText("SPACE INVADERS", W / 2, 100, 36, COLORS.hud, "center");
    fillText("FAN RECREATION OF THE 1978 ARCADE GAME", W / 2, 148, 13, COLORS.dim, "center");

    const table = [
      { kind: "ufo", pts: "? MYSTERY" },
      { kind: "squid", pts: "= 30 PTS" },
      { kind: "crab", pts: "= 20 PTS" },
      { kind: "octopus", pts: "= 10 PTS" },
    ];
    let y = 210;
    fillText("* SCORE ADVANCE TABLE *", W / 2, y, 16, COLORS.text, "center");
    y += 40;
    for (const row of table) {
      const grid = row.kind === "ufo" ? Sprites.ufo : Sprites[row.kind][0];
      const sz = spriteSize(grid);
      const x = W / 2 - 90;
      drawSprite(ctx, grid, x, y, colorFor(row.kind), SCALE);
      fillText(row.pts, x + sz.w * SCALE + 18, y + 4, 18, COLORS.text);
      y += 42;
    }

    y += 20;
    fillText("ARROW KEYS OR A / D  MOVE", W / 2, y, 15, COLORS.cyan || COLORS.text, "center");
    fillText("SPACE  FIRE   ·   P  PAUSE", W / 2, y + 26, 15, COLORS.text, "center");
    fillText("ONE SHOT ON SCREEN  ·  3 LIVES", W / 2, y + 52, 15, COLORS.dim, "center");
    fillText("PRESS ENTER OR SPACE TO START", W / 2, H - 80, 18, COLORS.hud, "center");
    fillText("HI " + String(hiScore).padStart(5, "0"), W / 2, H - 44, 14, COLORS.dim, "center");
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (state === STATE.TITLE) {
      drawTitle();
      return;
    }

    drawHud();
    drawPlayfield();

    if (state === STATE.PAUSED) {
      drawCenteredOverlay([
        { text: "PAUSED", size: 32, color: COLORS.hud },
        { text: "PRESS P TO RESUME", size: 16, color: COLORS.dim },
      ]);
    } else if (state === STATE.WAVE) {
      drawCenteredOverlay([
        { text: "WAVE " + wave + " CLEARED", size: 28, color: COLORS.hud },
        { text: "GET READY", size: 16, color: COLORS.dim },
      ]);
    } else if (state === STATE.GAMEOVER) {
      drawCenteredOverlay([
        { text: "GAME OVER", size: 36, color: "#ff4466" },
        { text: "SCORE  " + String(score).padStart(5, "0"), size: 20, color: COLORS.text },
        { text: "PRESS ENTER TO RESTART", size: 16, color: COLORS.hud },
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

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.key);

    if (e.key === "Enter" || e.key === " ") {
      Sfx.unlock();
      if (state === STATE.TITLE) startGame();
      else if (state === STATE.GAMEOVER) startGame();
      else if (e.key === " " && state === STATE.PLAYING) firePlayer();
    }
    if ((e.key === "p" || e.key === "P" || e.key === "Escape") && (state === STATE.PLAYING || state === STATE.PAUSED)) {
      state = state === STATE.PAUSED ? STATE.PLAYING : STATE.PAUSED;
    }
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    if (state === STATE.PLAYING) state = STATE.PAUSED;
  });

  drawTitle();
  requestAnimationFrame(loop);
})();
