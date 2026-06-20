"use strict";

const boardEl = document.querySelector("#board");
const turnLabel = document.querySelector("#turn-label");
const statusTitle = document.querySelector("#status-title");
const statusText = document.querySelector("#status-text");
const capturedWhiteEl = document.querySelector("#captured-white");
const capturedBlackEl = document.querySelector("#captured-black");
const moveListEl = document.querySelector("#move-list");
const newGameButton = document.querySelector("#new-game-button");
const undoButton = document.querySelector("#undo-button");

const PIECES = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const initialBoard = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
];

let board;
let turn;
let selected = null;
let legalTargets = [];
let moveHistory = [];
let captured = { w: [], b: [] };
let castling = { wk: true, wq: true, bk: true, bq: true };
let enPassant = null;
let lastMove = null;
let gameOver = false;

function cloneBoard(source) {
  return source.map((row) => [...row]);
}

function startGame() {
  board = cloneBoard(initialBoard);
  turn = "w";
  selected = null;
  legalTargets = [];
  moveHistory = [];
  captured = { w: [], b: [] };
  castling = { wk: true, wq: true, bk: true, bq: true };
  enPassant = null;
  lastMove = null;
  gameOver = false;
  render();
  setStatus("白方回合", "请选择白方棋子", "白方先行。点击棋子后，合法目标格会高亮。");
}

function render() {
  boardEl.innerHTML = "";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = document.createElement("button");
      const piece = board[row][col];
      const colorClass = (row + col) % 2 === 0 ? "light" : "dark";
      square.type = "button";
      square.className = `square ${colorClass}`;
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `${coordName(row, col)} ${piece ? pieceName(piece) : "空格"}`);

      if (selected && selected.row === row && selected.col === col) square.classList.add("selected");
      if (lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col))) {
        square.classList.add("last-move");
      }
      if (legalTargets.some((target) => target.row === row && target.col === col)) {
        square.classList.add(piece ? "capture" : "legal");
      }
      if (piece === `${turn}k` && isInCheck(turn, board)) square.classList.add("check");

      if (piece) {
        const span = document.createElement("span");
        span.className = `piece ${piece[0] === "w" ? "white" : "black"}`;
        span.textContent = PIECES[piece];
        square.append(span);
      }

      if (row === 7 || col === 0) {
        const coord = document.createElement("span");
        coord.className = "coords";
        coord.textContent = row === 7 ? FILES[col] : String(8 - row);
        square.append(coord);
      }

      square.addEventListener("click", () => handleSquareClick(row, col));
      boardEl.append(square);
    }
  }

  capturedWhiteEl.textContent = captured.w.map((piece) => PIECES[piece]).join(" ");
  capturedBlackEl.textContent = captured.b.map((piece) => PIECES[piece]).join(" ");
  moveListEl.innerHTML = moveHistory.map((move, index) => `<li>${index + 1}. ${move.notation}</li>`).join("");
  undoButton.disabled = moveHistory.length === 0;
}

function handleSquareClick(row, col) {
  if (gameOver) return;
  const piece = board[row][col];

  if (selected) {
    const move = legalTargets.find((target) => target.row === row && target.col === col);
    if (move) {
      makeMove(selected, move);
      return;
    }
  }

  if (piece && piece[0] === turn) {
    selected = { row, col };
    legalTargets = getLegalMoves(row, col, board, turn);
    setStatus(turn === "w" ? "白方回合" : "黑方回合", `已选择 ${pieceName(piece)}`, `可走 ${legalTargets.length} 个位置。`);
  } else {
    selected = null;
    legalTargets = [];
  }

  render();
}

function makeMove(from, move) {
  const snapshot = {
    board: cloneBoard(board),
    turn,
    captured: { w: [...captured.w], b: [...captured.b] },
    castling: { ...castling },
    enPassant: enPassant ? { ...enPassant } : null,
    lastMove: lastMove ? { from: { ...lastMove.from }, to: { ...lastMove.to } } : null,
    gameOver
  };

  const piece = board[from.row][from.col];
  const target = board[move.row][move.col];
  if (target) captured[turn].push(target);
  updateCastlingRightsForCapture(target, move);

  board[from.row][from.col] = null;
  board[move.row][move.col] = piece;

  if (move.enPassant) {
    const capturedRow = turn === "w" ? move.row + 1 : move.row - 1;
    const capturedPawn = board[capturedRow][move.col];
    if (capturedPawn) captured[turn].push(capturedPawn);
    board[capturedRow][move.col] = null;
  }

  if (move.castle) {
    const row = turn === "w" ? 7 : 0;
    if (move.castle === "k") {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }

  if (piece[1] === "p" && (move.row === 0 || move.row === 7)) {
    board[move.row][move.col] = `${turn}q`;
  }

  updateCastlingRights(piece, from);
  enPassant = null;
  if (piece[1] === "p" && Math.abs(move.row - from.row) === 2) {
    enPassant = { row: (move.row + from.row) / 2, col: from.col };
  }

  lastMove = { from, to: { row: move.row, col: move.col } };
  const notation = `${turn === "w" ? "白" : "黑"} ${pieceName(piece)} ${coordName(from.row, from.col)}-${coordName(move.row, move.col)}${target ? "x" : ""}${move.castle ? " 王车易位" : ""}${piece[1] === "p" && (move.row === 0 || move.row === 7) ? " 升变为后" : ""}`;
  moveHistory.push({ ...snapshot, notation });

  turn = other(turn);
  selected = null;
  legalTargets = [];
  updateGameStatus();
  render();
}

function undoMove() {
  const previous = moveHistory.pop();
  if (!previous) return;
  board = cloneBoard(previous.board);
  turn = previous.turn;
  captured = { w: [...previous.captured.w], b: [...previous.captured.b] };
  castling = { ...previous.castling };
  enPassant = previous.enPassant ? { ...previous.enPassant } : null;
  lastMove = previous.lastMove ? { from: { ...previous.lastMove.from }, to: { ...previous.lastMove.to } } : null;
  gameOver = previous.gameOver;
  selected = null;
  legalTargets = [];
  setStatus(turn === "w" ? "白方回合" : "黑方回合", "已悔棋", "继续当前回合。");
  render();
}

function updateGameStatus() {
  const moves = allLegalMoves(turn);
  const checked = isInCheck(turn, board);
  const side = turn === "w" ? "白方" : "黑方";

  if (moves.length === 0 && checked) {
    gameOver = true;
    setStatus("将死", `${side}被将死`, `${other(turn) === "w" ? "白方" : "黑方"}获胜。`);
    return;
  }

  if (moves.length === 0) {
    gameOver = true;
    setStatus("和棋", "无合法走法", "当前方没有合法走法，但王未被将军。");
    return;
  }

  setStatus(`${side}回合`, checked ? `${side}被将军` : `请选择${side}棋子`, checked ? "必须解除将军。" : "点击棋子后，合法目标格会高亮。");
}

function getLegalMoves(row, col, source, color) {
  const piece = source[row][col];
  if (!piece || piece[0] !== color) return [];
  return getPseudoMoves(row, col, source)
    .filter((move) => {
      const next = cloneBoard(source);
      applyVirtualMove(next, { row, col }, move);
      return !isInCheck(color, next);
    });
}

function getPseudoMoves(row, col, source) {
  const piece = source[row][col];
  if (!piece) return [];
  const color = piece[0];
  const type = piece[1];
  const moves = [];

  if (type === "p") pawnMoves(row, col, color, source, moves);
  if (type === "n") jumpMoves(row, col, color, source, moves, [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
  if (type === "b") slideMoves(row, col, color, source, moves, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  if (type === "r") slideMoves(row, col, color, source, moves, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
  if (type === "q") slideMoves(row, col, color, source, moves, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
  if (type === "k") kingMoves(row, col, color, source, moves);
  return moves;
}

function pawnMoves(row, col, color, source, moves) {
  const dir = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;
  const one = row + dir;
  if (inside(one, col) && !source[one][col]) {
    moves.push({ row: one, col });
    const two = row + dir * 2;
    if (row === startRow && !source[two][col]) moves.push({ row: two, col });
  }

  for (const dc of [-1, 1]) {
    const targetRow = row + dir;
    const targetCol = col + dc;
    if (!inside(targetRow, targetCol)) continue;
    const target = source[targetRow][targetCol];
    if (target && target[0] !== color) moves.push({ row: targetRow, col: targetCol });
    if (enPassant && enPassant.row === targetRow && enPassant.col === targetCol) {
      moves.push({ row: targetRow, col: targetCol, enPassant: true });
    }
  }
}

function jumpMoves(row, col, color, source, moves, deltas) {
  deltas.forEach(([dr, dc]) => {
    const r = row + dr;
    const c = col + dc;
    if (!inside(r, c)) return;
    if (!source[r][c] || source[r][c][0] !== color) moves.push({ row: r, col: c });
  });
}

function slideMoves(row, col, color, source, moves, deltas) {
  deltas.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;
    while (inside(r, c)) {
      if (!source[r][c]) {
        moves.push({ row: r, col: c });
      } else {
        if (source[r][c][0] !== color) moves.push({ row: r, col: c });
        break;
      }
      r += dr;
      c += dc;
    }
  });
}

function kingMoves(row, col, color, source, moves) {
  jumpMoves(row, col, color, source, moves, [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
  if (isInCheck(color, source)) return;

  const homeRow = color === "w" ? 7 : 0;
  if (row !== homeRow || col !== 4) return;

  if (castling[`${color}k`] && !source[homeRow][5] && !source[homeRow][6] && !isSquareAttacked(homeRow, 5, other(color), source) && !isSquareAttacked(homeRow, 6, other(color), source)) {
    moves.push({ row: homeRow, col: 6, castle: "k" });
  }
  if (castling[`${color}q`] && !source[homeRow][1] && !source[homeRow][2] && !source[homeRow][3] && !isSquareAttacked(homeRow, 3, other(color), source) && !isSquareAttacked(homeRow, 2, other(color), source)) {
    moves.push({ row: homeRow, col: 2, castle: "q" });
  }
}

function applyVirtualMove(source, from, move) {
  const piece = source[from.row][from.col];
  source[from.row][from.col] = null;
  source[move.row][move.col] = piece;
  if (move.enPassant) source[piece[0] === "w" ? move.row + 1 : move.row - 1][move.col] = null;
  if (move.castle === "k") {
    const row = piece[0] === "w" ? 7 : 0;
    source[row][5] = source[row][7];
    source[row][7] = null;
  }
  if (move.castle === "q") {
    const row = piece[0] === "w" ? 7 : 0;
    source[row][3] = source[row][0];
    source[row][0] = null;
  }
}

function isInCheck(color, source) {
  const king = findKing(color, source);
  return king ? isSquareAttacked(king.row, king.col, other(color), source) : false;
}

function findKing(color, source) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (source[row][col] === `${color}k`) return { row, col };
    }
  }
  return null;
}

function isSquareAttacked(row, col, byColor, source) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = source[r][c];
      if (!piece || piece[0] !== byColor) continue;
      if (attacksSquare(r, c, row, col, source)) return true;
    }
  }
  return false;
}

function attacksSquare(fromRow, fromCol, targetRow, targetCol, source) {
  const piece = source[fromRow][fromCol];
  const color = piece[0];
  const type = piece[1];
  const dr = targetRow - fromRow;
  const dc = targetCol - fromCol;

  if (type === "p") return dr === (color === "w" ? -1 : 1) && Math.abs(dc) === 1;
  if (type === "n") return [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].some(([r, c]) => dr === r && dc === c);
  if (type === "k") return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  if (type === "b") return clearLine(fromRow, fromCol, targetRow, targetCol, source) && Math.abs(dr) === Math.abs(dc);
  if (type === "r") return clearLine(fromRow, fromCol, targetRow, targetCol, source) && (dr === 0 || dc === 0);
  if (type === "q") return clearLine(fromRow, fromCol, targetRow, targetCol, source) && (Math.abs(dr) === Math.abs(dc) || dr === 0 || dc === 0);
  return false;
}

function clearLine(fromRow, fromCol, targetRow, targetCol, source) {
  const stepRow = Math.sign(targetRow - fromRow);
  const stepCol = Math.sign(targetCol - fromCol);
  let row = fromRow + stepRow;
  let col = fromCol + stepCol;
  while (row !== targetRow || col !== targetCol) {
    if (source[row][col]) return false;
    row += stepRow;
    col += stepCol;
  }
  return true;
}

function allLegalMoves(color) {
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row][col]?.[0] === color) moves.push(...getLegalMoves(row, col, board, color));
    }
  }
  return moves;
}

function updateCastlingRights(piece, from) {
  if (piece === "wk") {
    castling.wk = false;
    castling.wq = false;
  }
  if (piece === "bk") {
    castling.bk = false;
    castling.bq = false;
  }
  if (piece === "wr" && from.row === 7 && from.col === 0) castling.wq = false;
  if (piece === "wr" && from.row === 7 && from.col === 7) castling.wk = false;
  if (piece === "br" && from.row === 0 && from.col === 0) castling.bq = false;
  if (piece === "br" && from.row === 0 && from.col === 7) castling.bk = false;
}

function updateCastlingRightsForCapture(piece, square) {
  if (piece === "wr" && square.row === 7 && square.col === 0) castling.wq = false;
  if (piece === "wr" && square.row === 7 && square.col === 7) castling.wk = false;
  if (piece === "br" && square.row === 0 && square.col === 0) castling.bq = false;
  if (piece === "br" && square.row === 0 && square.col === 7) castling.bk = false;
}

function inside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function other(color) {
  return color === "w" ? "b" : "w";
}

function coordName(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function pieceName(piece) {
  const side = piece[0] === "w" ? "白" : "黑";
  const names = { k: "王", q: "后", r: "车", b: "象", n: "马", p: "兵" };
  return `${side}${names[piece[1]]}`;
}

function setStatus(label, title, text) {
  turnLabel.textContent = label;
  statusTitle.textContent = title;
  statusText.textContent = text;
}

newGameButton.addEventListener("click", startGame);
undoButton.addEventListener("click", undoMove);

startGame();
