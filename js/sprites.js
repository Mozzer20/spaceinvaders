/**
 * Pixel-art sprite sheets as text grids.
 * 'X' is a lit pixel. Frames are used for alien walk cycles.
 */
const Sprites = {
  player: [
    "......X......",
    ".....XXX.....",
    ".....XXX.....",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
  ],
  playerExplode: [
    "..X.X.X.X.X..",
    "X..X.XXX.X..X",
    ".X.XXXXXXX.X.",
    "XXXX.X.X.XXXX",
    ".X.XXXXXXX.X.",
    "X..X.XXX.X..X",
  ],
  squid: [
    [
      "....XX....",
      "...XXXX...",
      "..XXXXXX..",
      ".XX.XX.XX.",
      ".XXXXXXXX.",
      "..X.XX.X..",
      ".X......X.",
      "X.X....X.X",
    ],
    [
      "....XX....",
      "...XXXX...",
      "..XXXXXX..",
      ".XX.XX.XX.",
      ".XXXXXXXX.",
      "..X.XX.X..",
      ".X......X.",
      ".X.X..X.X.",
    ],
  ],
  crab: [
    [
      "..X.....X..",
      "...X...X...",
      "..XXXXXXX..",
      ".XX.XXX.XX.",
      "XXXXXXXXXXX",
      "X.XXXXXXX.X",
      "X.X.....X.X",
      "...XX.XX...",
    ],
    [
      "..X.....X..",
      "X..X...X..X",
      "X.XXXXXXX.X",
      "XXX.XXX.XXX",
      "XXXXXXXXXXX",
      ".XXXXXXXXX.",
      "..X.....X..",
      ".X.......X.",
    ],
  ],
  octopus: [
    [
      "...XXXXX...",
      ".XXXXXXXXX.",
      "XXXXXXXXXXX",
      "XXX..X..XXX",
      "XXXXXXXXXXX",
      "..XX...XX..",
      ".XX.X.X.XX.",
      "XX.......XX",
    ],
    [
      "...XXXXX...",
      ".XXXXXXXXX.",
      "XXXXXXXXXXX",
      "XXX..X..XXX",
      "XXXXXXXXXXX",
      "..XX.X.XX..",
      ".XX.....XX.",
      "..XX...XX..",
    ],
  ],
  ufo: [
    ".....XXXXXX.....",
    "...XXXXXXXXXX...",
    "..XXXXXXXXXXXX..",
    ".XX.XX.XX.XX.XX.",
    "XXXXXXXXXXXXXXXX",
    "..XXX......XXX..",
    "...XX......XX...",
  ],
  bunkerRow: [
    "....XXXXXXXXXXXX....",
    "...XXXXXXXXXXXXXX...",
    "..XXXXXXXXXXXXXXXX..",
    ".XXXXXXXXXXXXXXXXXX.",
    "XXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXXXX",
    "XXXXXXXX..XXXXXXXXXX",
    "XXXXXXX....XXXXXXXXX",
    "XXXXXX......XXXXXXXX",
    "XXXXX........XXXXXXX",
    "XXXXX........XXXXXXX",
    "XXXXX........XXXXXXX",
  ],
};

function spriteSize(grid) {
  return { w: grid[0].length, h: grid.length };
}

function drawSprite(ctx, grid, x, y, color, scale) {
  ctx.fillStyle = color;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "X") {
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
}

function bunkerFromTemplate() {
  const src = Sprites.bunkerRow;
  const cells = [];
  for (let r = 0; r < src.length; r++) {
    const row = [];
    for (let c = 0; c < src[r].length; c++) {
      row.push(src[r][c] === "X" ? 1 : 0);
    }
    cells.push(row);
  }
  return cells;
}
