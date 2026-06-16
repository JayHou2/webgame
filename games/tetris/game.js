"use strict";

const COLS = 10;
const ROWS = 20;
const TARGET_FPS = 90;
const FRAME_MS = 1000 / TARGET_FPS;
const CELL = 36;
const PREVIEW_CELL = 22;

const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const holdCanvas = document.querySelector("#hold-canvas");
const holdCtx = holdCanvas.getContext("2d");
const nextCanvas = document.querySelector("#next-canvas");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const linesEl = document.querySelector("#lines");
const fpsEl = document.querySelector("#fps");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startButton = document.querySelector("#start-button");

const COLORS = {
  I: ["#2efcff", "#7cfbff"],
  J: ["#5d7cff", "#9aacff"],
  L: ["#ff9f43", "#ffd08a"],
  O: ["#ffe36e", "#fff0a8"],
  S: ["#65ff8f", "#b5ffc7"],
  T: ["#c56cff", "#e1b2ff"],
  Z: ["#ff4f7b", "#ff9ab0"]
};

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
};

let board;
let active;
let holdType = null;
let canHold = true;
let queue = [];
let score = 0;
let lines = 0;
let level = 1;
let dropTimer = 0;
let lastFrame = 0;
let lastRender = 0;
let running = false;
let paused = false;
let gameOver = false;
let particles = [];
let flashRows = [];
let frames = 0;
let fpsTimer = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function shuffleBag() {
  const bag = Object.keys(SHAPES);
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [bag[index], bag[swap]] = [bag[swap], bag[index]];
  }
  return bag;
}

function refillQueue() {
  while (queue.length < 7) queue.push(...shuffleBag());
}

function rotateMatrix(matrix, direction = 1) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (direction > 0) {
        rotated[col][size - 1 - row] = matrix[row][col];
      } else {
        rotated[size - 1 - col][row] = matrix[row][col];
      }
    }
  }

  return rotated;
}

function spawnPiece() {
  refillQueue();
  const type = queue.shift();
  active = {
    type,
    matrix: SHAPES[type].map((row) => [...row]),
    x: Math.floor((COLS - SHAPES[type].length) / 2),
    y: type === "I" ? -1 : 0
  };
  canHold = true;

  if (collides(active, 0, 0)) endGame();
}

function collides(piece, offsetX, offsetY, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;

      const x = piece.x + col + offsetX;
      const y = piece.y + row + offsetY;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }

  return false;
}

function move(offsetX, offsetY) {
  if (!canPlay()) return false;
  if (collides(active, offsetX, offsetY)) return false;
  active.x += offsetX;
  active.y += offsetY;
  return true;
}

function rotate(direction = 1) {
  if (!canPlay()) return;
  if (active.type === "O") return;

  const rotated = rotateMatrix(active.matrix, direction);
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    if (!collides(active, kick, 0, rotated)) {
      active.matrix = rotated;
      active.x += kick;
      return;
    }
  }
}

function hardDrop() {
  if (!canPlay()) return;
  let distance = 0;
  while (move(0, 1)) distance += 1;
  score += distance * 2;
  lockPiece();
}

function holdPiece() {
  if (!canPlay() || !canHold) return;

  const currentType = active.type;
  if (!holdType) {
    holdType = currentType;
    spawnPiece();
  } else {
    active = {
      type: holdType,
      matrix: SHAPES[holdType].map((row) => [...row]),
      x: Math.floor((COLS - SHAPES[holdType].length) / 2),
      y: holdType === "I" ? -1 : 0
    };
    holdType = currentType;
    if (collides(active, 0, 0)) endGame();
  }

  canHold = false;
}

function lockPiece() {
  active.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const x = active.x + colIndex;
      const y = active.y + rowIndex;
      if (y >= 0) board[y][x] = active.type;
    });
  });

  clearLines();
  updateHud();
  spawnPiece();
}

function clearLines() {
  const cleared = [];

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (board[row].every(Boolean)) {
      cleared.push(row);
      createLineParticles(row);
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(null));
      row += 1;
    }
  }

  if (!cleared.length) return;

  flashRows = cleared.map((row) => ({ row, life: 260 }));
  const points = [0, 100, 300, 500, 800][cleared.length] || cleared.length * 300;
  lines += cleared.length;
  level = Math.floor(lines / 10) + 1;
  score += points * level;
  updateHud();
}

function createLineParticles(row) {
  for (let col = 0; col < COLS; col += 1) {
    const type = board[row][col] || "I";
    const [color] = COLORS[type];
    particles.push({
      x: col + 0.5,
      y: row + 0.5,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -Math.random() * 0.2 - 0.04,
      life: 520,
      color
    });
  }
}

function update(delta) {
  if (!canPlay()) return;

  dropTimer += delta;
  const interval = Math.max(95, 780 - (level - 1) * 58);
  while (dropTimer >= interval) {
    dropTimer -= interval;
    if (!move(0, 1)) lockPiece();
  }

  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * delta,
      y: particle.y + particle.vy * delta,
      vy: particle.vy + 0.00055 * delta,
      life: particle.life - delta
    }))
    .filter((particle) => particle.life > 0);

  flashRows = flashRows
    .map((flash) => ({ ...flash, life: flash.life - delta }))
    .filter((flash) => flash.life > 0);
}

function draw() {
  const width = COLS * CELL;
  const height = ROWS * CELL;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#070812");
  gradient.addColorStop(1, "#101633");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, COLS, ROWS, CELL);
  drawBoard();
  drawGhost();
  drawPiece(active);
  drawFlashes();
  drawParticles();
  drawScanline();
  drawPreview();
}

function drawGrid(context, cols, rows, cell) {
  context.save();
  context.strokeStyle = "rgba(46, 252, 255, 0.08)";
  context.lineWidth = 1;

  for (let col = 0; col <= cols; col += 1) {
    context.beginPath();
    context.moveTo(col * cell, 0);
    context.lineTo(col * cell, rows * cell);
    context.stroke();
  }

  for (let row = 0; row <= rows; row += 1) {
    context.beginPath();
    context.moveTo(0, row * cell);
    context.lineTo(cols * cell, row * cell);
    context.stroke();
  }

  context.restore();
}

function drawBoard() {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const type = board[row][col];
      if (type) drawBlock(ctx, col, row, type, CELL, 1);
    }
  }
}

function drawPiece(piece, alpha = 1, ghost = false) {
  if (!piece) return;
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      const y = piece.y + rowIndex;
      if (y < 0) return;
      drawBlock(ctx, piece.x + colIndex, y, piece.type, CELL, alpha, ghost);
    });
  });
}

function drawGhost() {
  if (!active) return;
  const ghost = {
    ...active,
    matrix: active.matrix.map((row) => [...row])
  };

  while (!collides(ghost, 0, 1)) ghost.y += 1;
  drawPiece(ghost, 0.22, true);
}

function drawBlock(context, x, y, type, cell, alpha = 1, ghost = false) {
  const [base, glow] = COLORS[type];
  const px = x * cell;
  const py = y * cell;
  const pad = Math.max(2, cell * 0.08);
  const size = cell - pad * 2;

  context.save();
  context.globalAlpha = alpha;
  context.shadowColor = base;
  context.shadowBlur = ghost ? 8 : 18;
  const gradient = context.createLinearGradient(px, py, px + cell, py + cell);
  gradient.addColorStop(0, glow);
  gradient.addColorStop(0.48, base);
  gradient.addColorStop(1, "#111827");
  context.fillStyle = ghost ? "rgba(255,255,255,0.08)" : gradient;
  roundRect(context, px + pad, py + pad, size, size, Math.max(4, cell * 0.16));
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = ghost ? base : "rgba(255,255,255,0.34)";
  context.lineWidth = ghost ? 1.2 : 1.5;
  context.stroke();
  context.restore();
}

function drawFlashes() {
  flashRows.forEach((flash) => {
    const alpha = Math.max(0, flash.life / 260);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, flash.row * CELL, COLS * CELL, CELL);
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    const alpha = Math.max(0, particle.life / 520);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(particle.x * CELL, particle.y * CELL, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawScanline() {
  const y = (performance.now() / 18) % (ROWS * CELL);
  const gradient = ctx.createLinearGradient(0, y - 20, 0, y + 20);
  gradient.addColorStop(0, "rgba(46,252,255,0)");
  gradient.addColorStop(0.5, "rgba(46,252,255,0.08)");
  gradient.addColorStop(1, "rgba(46,252,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, y - 20, COLS * CELL, 40);
}

function drawPreview() {
  drawMiniPiece(holdCtx, holdCanvas, holdType ? SHAPES[holdType] : null, holdType, undefined, undefined, true);
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  queue.slice(0, 4).forEach((type, index) => {
    drawMiniPiece(nextCtx, nextCanvas, SHAPES[type], type, 12, 8 + index * 68, false);
  });
}

function drawMiniPiece(context, targetCanvas, matrix, type, offsetX, offsetY, shouldClear = true) {
  if (shouldClear) context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  if (!matrix || !type) return;

  const cell = PREVIEW_CELL;
  const matrixWidth = matrix[0].length * cell;
  const matrixHeight = matrix.length * cell;
  const x0 = offsetX ?? (targetCanvas.width - matrixWidth) / 2;
  const y0 = offsetY ?? (targetCanvas.height - matrixHeight) / 2;

  matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) return;
      drawMiniBlock(context, x0 + colIndex * cell, y0 + rowIndex * cell, type, cell);
    });
  });
}

function drawMiniBlock(context, x, y, type, cell) {
  const [base, glow] = COLORS[type];
  context.save();
  context.shadowColor = base;
  context.shadowBlur = 10;
  const gradient = context.createLinearGradient(x, y, x + cell, y + cell);
  gradient.addColorStop(0, glow);
  gradient.addColorStop(1, base);
  context.fillStyle = gradient;
  roundRect(context, x + 2, y + 2, cell - 4, cell - 4, 5);
  context.fill();
  context.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function loop(time = 0) {
  if (!lastFrame) lastFrame = time;
  const delta = Math.min(48, time - lastFrame);
  lastFrame = time;
  update(delta);

  if (time - lastRender >= FRAME_MS) {
    lastRender = time - ((time - lastRender) % FRAME_MS);
    draw();
    frames += 1;
  }

  if (time - fpsTimer >= 1000) {
    fpsEl.textContent = String(frames);
    frames = 0;
    fpsTimer = time;
  }

  requestAnimationFrame(loop);
}

function startGame() {
  board = createBoard();
  queue = [];
  holdType = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  dropTimer = 0;
  particles = [];
  flashRows = [];
  running = true;
  paused = false;
  gameOver = false;
  refillQueue();
  spawnPiece();
  updateHud();
  hideOverlay();
}

function endGame() {
  running = false;
  gameOver = true;
  showOverlay("Game Over", "能量耗尽", `最终得分 ${score}。再来一局，把霓虹塔堆得更漂亮。`, "重新开始");
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  if (paused) {
    showOverlay("Paused", "已暂停", "按 P 或点击按钮继续。", "继续游戏");
  } else {
    hideOverlay();
  }
}

function canPlay() {
  return running && !paused && !gameOver && active;
}

function updateHud() {
  scoreEl.textContent = String(score);
  levelEl.textContent = String(level);
  linesEl.textContent = String(lines);
}

function showOverlay(kicker, title, text, buttonText) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function handleAction(action) {
  if (action === "start") {
    if (paused) togglePause();
    else startGame();
    return;
  }

  if (action === "pause") {
    togglePause();
    return;
  }

  if (!canPlay()) return;
  if (action === "left") move(-1, 0);
  if (action === "right") move(1, 0);
  if (action === "soft") {
    if (move(0, 1)) score += 1;
    updateHud();
  }
  if (action === "rotate") rotate(1);
  if (action === "rotate-ccw") rotate(-1);
  if (action === "drop") hardDrop();
  if (action === "hold") holdPiece();
}

document.addEventListener("keydown", (event) => {
  const key = event.key;
  const actionMap = {
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
    ArrowDown: "soft",
    s: "soft",
    S: "soft",
    ArrowUp: "rotate",
    w: "rotate",
    W: "rotate",
    e: "rotate",
    E: "rotate",
    q: "rotate-ccw",
    Q: "rotate-ccw",
    " ": "drop",
    c: "hold",
    C: "hold",
    Shift: "hold",
    p: "pause",
    P: "pause"
  };

  const action = actionMap[key];
  if (!action) return;
  event.preventDefault();
  handleAction(action);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

startButton.addEventListener("click", () => handleAction("start"));

board = createBoard();
refillQueue();
showOverlay("Ready", "准备开始", "方向键或 WASD 移动，空格瞬间下落。", "启动霓虹引擎");
updateHud();
draw();
requestAnimationFrame(loop);
