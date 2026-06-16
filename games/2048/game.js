"use strict";

const SIZE = 4;
const STORAGE_KEY = "number-2048-state-v1";
const BEST_KEY = "number-2048-best-v1";

const boardElement = document.querySelector("#game-board");
const tileContainer = document.querySelector("#tile-container");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const scoreAddElement = document.querySelector("#score-add");
const undoButton = document.querySelector("#undo-button");
const newGameButton = document.querySelector("#new-game-button");
const tryAgainButton = document.querySelector("#try-again-button");
const keepPlayingButton = document.querySelector("#keep-playing-button");
const messageElement = document.querySelector("#game-message");
const messageKicker = document.querySelector("#message-kicker");
const messageTitle = document.querySelector("#message-title");
const messageText = document.querySelector("#message-text");

let grid = emptyGrid();
let score = 0;
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
let previousState = null;
let won = false;
let keepPlaying = false;
let touchStart = null;

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneGrid(source) {
  return source.map((row) => [...row]);
}

function getEmptyCells(source = grid) {
  const cells = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (source[row][col] === 0) cells.push({ row, col });
    }
  }

  return cells;
}

function addRandomTile() {
  const cells = getEmptyCells();
  if (!cells.length) return null;

  const cell = cells[Math.floor(Math.random() * cells.length)];
  grid[cell.row][cell.col] = Math.random() < 0.9 ? 2 : 4;
  return cell;
}

function startGame() {
  grid = emptyGrid();
  score = 0;
  previousState = null;
  won = false;
  keepPlaying = false;
  addRandomTile();
  addRandomTile();
  hideMessage();
  saveState();
  render({ allNew: true });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    grid,
    score,
    won,
    keepPlaying
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const validGrid = Array.isArray(saved?.grid)
      && saved.grid.length === SIZE
      && saved.grid.every((row) => Array.isArray(row) && row.length === SIZE);

    if (!validGrid) return false;

    grid = saved.grid.map((row) => row.map((value) => Number(value) || 0));
    score = Number(saved.score) || 0;
    won = Boolean(saved.won);
    keepPlaying = Boolean(saved.keepPlaying);
    return true;
  } catch {
    return false;
  }
}

function slideLine(line) {
  const compact = line.filter(Boolean);
  const result = [];
  let gained = 0;
  const mergedIndexes = [];

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const merged = compact[index] * 2;
      result.push(merged);
      gained += merged;
      mergedIndexes.push(result.length - 1);
      index += 1;
    } else {
      result.push(compact[index]);
    }
  }

  while (result.length < SIZE) result.push(0);
  return { line: result, gained, mergedIndexes };
}

function move(direction) {
  if (!messageElement.hidden && !keepPlaying) return;

  const before = cloneGrid(grid);
  let next = emptyGrid();
  let gained = 0;
  const mergedCells = [];

  for (let outer = 0; outer < SIZE; outer += 1) {
    const original = [];

    for (let inner = 0; inner < SIZE; inner += 1) {
      if (direction === "left") original.push(grid[outer][inner]);
      if (direction === "right") original.push(grid[outer][SIZE - 1 - inner]);
      if (direction === "up") original.push(grid[inner][outer]);
      if (direction === "down") original.push(grid[SIZE - 1 - inner][outer]);
    }

    const moved = slideLine(original);
    gained += moved.gained;

    for (let inner = 0; inner < SIZE; inner += 1) {
      let row;
      let col;

      if (direction === "left") [row, col] = [outer, inner];
      if (direction === "right") [row, col] = [outer, SIZE - 1 - inner];
      if (direction === "up") [row, col] = [inner, outer];
      if (direction === "down") [row, col] = [SIZE - 1 - inner, outer];

      next[row][col] = moved.line[inner];
      if (moved.mergedIndexes.includes(inner)) mergedCells.push(`${row}-${col}`);
    }
  }

  if (gridsEqual(before, next)) return;

  previousState = {
    grid: before,
    score,
    won,
    keepPlaying
  };

  grid = next;
  score += gained;
  bestScore = Math.max(bestScore, score);
  localStorage.setItem(BEST_KEY, String(bestScore));

  const newCell = addRandomTile();
  saveState();
  render({ newCell, mergedCells, gained });
  checkGameStatus();
}

function gridsEqual(first, second) {
  return first.every((row, rowIndex) =>
    row.every((value, colIndex) => value === second[rowIndex][colIndex])
  );
}

function hasAvailableMoves() {
  if (getEmptyCells().length) return true;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (col < SIZE - 1 && grid[row][col] === grid[row][col + 1]) return true;
      if (row < SIZE - 1 && grid[row][col] === grid[row + 1][col]) return true;
    }
  }

  return false;
}

function checkGameStatus() {
  const reached2048 = grid.some((row) => row.some((value) => value >= 2048));

  if (reached2048 && !won) {
    won = true;
    saveState();
    showMessage("里程碑达成", "你合成了 2048！", "太棒了。你可以继续挑战更大的数字。", true);
    return;
  }

  if (!hasAvailableMoves()) {
    showMessage("没有可走的格子了", "游戏结束", `本局得分 ${score}，再来一次刷新纪录吧。`, false);
  }
}

function undo() {
  if (!previousState) return;

  grid = cloneGrid(previousState.grid);
  score = previousState.score;
  won = previousState.won;
  keepPlaying = previousState.keepPlaying;
  previousState = null;
  hideMessage();
  saveState();
  render();
}

function render(options = {}) {
  const { newCell = null, mergedCells = [], gained = 0, allNew = false } = options;
  tileContainer.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = grid[row][col];
      if (!value) continue;

      const tile = document.createElement("div");
      const isNew = allNew || (newCell?.row === row && newCell?.col === col);
      const isMerged = mergedCells.includes(`${row}-${col}`);

      tile.className = `tile${isNew ? " tile-new" : ""}${isMerged ? " tile-merged" : ""}`;
      tile.dataset.value = String(value);
      tile.dataset.large = String(value > 2048);
      tile.style.setProperty("--row", row);
      tile.style.setProperty("--col", col);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", String(value));
      tile.innerHTML = `<div class="tile-inner">${value}</div>`;
      tileContainer.append(tile);
    }
  }

  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
  undoButton.disabled = !previousState;

  if (gained > 0) {
    scoreAddElement.textContent = `+${gained}`;
    scoreAddElement.classList.remove("pop");
    void scoreAddElement.offsetWidth;
    scoreAddElement.classList.add("pop");
  }
}

function showMessage(kicker, title, text, canContinue) {
  messageKicker.textContent = kicker;
  messageTitle.textContent = title;
  messageText.textContent = text;
  keepPlayingButton.hidden = !canContinue;
  messageElement.hidden = false;
}

function hideMessage() {
  messageElement.hidden = true;
}

function continueGame() {
  keepPlaying = true;
  hideMessage();
  saveState();
}

function confirmNewGame() {
  const hasProgress = score > 0 || grid.flat().filter(Boolean).length > 2;
  if (!hasProgress || window.confirm("确定要结束当前一局，重新开始吗？")) startGame();
}

function directionFromKey(key) {
  const directions = {
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down"
  };

  return directions[key];
}

document.addEventListener("keydown", (event) => {
  const direction = directionFromKey(event.key);
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

boardElement.addEventListener("pointerdown", (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
  boardElement.setPointerCapture?.(event.pointerId);
});

boardElement.addEventListener("pointerup", (event) => {
  if (!touchStart) return;

  const deltaX = event.clientX - touchStart.x;
  const deltaY = event.clientY - touchStart.y;
  touchStart = null;

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    move(deltaX > 0 ? "right" : "left");
  } else {
    move(deltaY > 0 ? "down" : "up");
  }
});

boardElement.addEventListener("pointercancel", () => {
  touchStart = null;
});

newGameButton.addEventListener("click", confirmNewGame);
tryAgainButton.addEventListener("click", startGame);
keepPlayingButton.addEventListener("click", continueGame);
undoButton.addEventListener("click", undo);

if (!loadState()) {
  startGame();
} else {
  render();
  checkGameStatus();
}
