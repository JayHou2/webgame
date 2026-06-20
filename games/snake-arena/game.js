"use strict";

const WORLD = { width: 2600, height: 1800 };
const FOOD_COUNT = 150;
const AI_COUNT = 8;
const SEGMENT_GAP = 12;
const BASE_SPEED = 145;
const BOOST_SPEED = 245;
const PLAYER_NAME = "花芯龙";
const AI_NAMES = ["小白兔", "冰糖橙", "大魔王", "云朵蛇", "甜甜圈", "青苹果", "泡泡鱼", "闪电仔"];

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");
const lengthEl = document.querySelector("#length-value");
const killsEl = document.querySelector("#kills-value");
const speedEl = document.querySelector("#speed-value");
const leaderboardEl = document.querySelector("#leaderboard");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startButton = document.querySelector("#start-button");
const joystick = document.querySelector("#joystick");
const joystickKnob = document.querySelector("#joystick-knob");
const boostButton = document.querySelector("#boost-button");

let snakes = [];
let foods = [];
let particles = [];
let player = null;
let camera = { x: WORLD.width / 2, y: WORLD.height / 2 };
let pointer = { x: 0, y: 0, active: false };
let joystickVector = null;
let boosting = false;
let running = false;
let paused = false;
let lastTime = 0;
let kills = 0;

const palettes = [
  ["#2ccf7b", "#9fffd0"],
  ["#ff71b8", "#ffd0ea"],
  ["#ffb13b", "#fff0a8"],
  ["#7a8cff", "#d6dcff"],
  ["#43d8ff", "#c4f6ff"],
  ["#a7e34b", "#edffb8"],
  ["#ff5f5f", "#ffd0d0"],
  ["#b96bff", "#ead4ff"]
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function lerpAngle(current, target, amount) {
  let delta = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return current + delta * amount;
}

function createFood(x = rand(60, WORLD.width - 60), y = rand(60, WORLD.height - 60), value = 1) {
  const colors = ["#ff4fb8", "#ffe252", "#44d08a", "#ff9448", "#52c7ff", "#9b7cff"];
  return {
    x,
    y,
    value,
    radius: 5 + value * 1.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    pulse: rand(0, Math.PI * 2)
  };
}

function createSnake(name, ai, index, x = rand(180, WORLD.width - 180), y = rand(180, WORLD.height - 180)) {
  const palette = ai ? palettes[index % palettes.length] : ["#2ccf7b", "#b9ffd9"];
  const angle = rand(-Math.PI, Math.PI);
  const snake = {
    id: `${name}-${Date.now()}-${Math.random()}`,
    name,
    ai,
    alive: true,
    x,
    y,
    angle,
    targetAngle: angle,
    speed: BASE_SPEED,
    radius: ai ? rand(12, 16) : 16,
    length: ai ? Math.floor(rand(22, 52)) : 26,
    growth: 0,
    kills: 0,
    palette,
    segments: [],
    thinkTimer: 0,
    targetFood: null,
    boostTimer: 0
  };

  for (let i = 0; i < snake.length; i += 1) {
    snake.segments.push({
      x: x - Math.cos(angle) * i * SEGMENT_GAP,
      y: y - Math.sin(angle) * i * SEGMENT_GAP
    });
  }

  return snake;
}

function resetGame() {
  foods = Array.from({ length: FOOD_COUNT }, () => createFood());
  particles = [];
  player = createSnake(PLAYER_NAME, false, 0, WORLD.width / 2, WORLD.height / 2);
  snakes = [player];

  for (let i = 0; i < AI_COUNT; i += 1) {
    snakes.push(createSnake(AI_NAMES[i], true, i + 1));
  }

  kills = 0;
  running = true;
  paused = false;
  boosting = false;
  hideOverlay();
  updateHud();
}

function update(delta) {
  if (!running || paused) return;
  const dt = delta / 1000;

  snakes.forEach((snake) => {
    if (!snake.alive) return;
    if (snake.ai) updateAi(snake, dt);
    else updatePlayerTarget(snake);

    const wantsBoost = snake.ai ? snake.boostTimer > 0 : boosting;
    const canBoost = snake.length > 18;
    snake.speed = wantsBoost && canBoost ? BOOST_SPEED : BASE_SPEED + Math.min(70, snake.length * 0.8);
    speedEl.textContent = snake === player ? `${(snake.speed / BASE_SPEED).toFixed(1)}x` : speedEl.textContent;

    snake.angle = lerpAngle(snake.angle, snake.targetAngle, snake.ai ? 0.055 : 0.12);
    snake.x += Math.cos(snake.angle) * snake.speed * dt;
    snake.y += Math.sin(snake.angle) * snake.speed * dt;
    snake.x = clamp(snake.x, 20, WORLD.width - 20);
    snake.y = clamp(snake.y, 20, WORLD.height - 20);

    snake.segments.unshift({ x: snake.x, y: snake.y });
    const maxSegments = Math.floor(snake.length * 1.35);
    while (snake.segments.length > maxSegments) snake.segments.pop();

    if (wantsBoost && canBoost) {
      snake.growth -= 10 * dt;
      if (snake.growth < -1) {
        snake.growth += 1;
        snake.length = Math.max(18, snake.length - 1);
        shedFood(snake);
      }
    }

    eatFood(snake);
  });

  checkCollisions();
  updateParticles(dt);
  respawnAi();
  updateCamera(dt);
  updateHud();
}

function updatePlayerTarget(snake) {
  if (joystickVector) {
    snake.targetAngle = Math.atan2(joystickVector.y, joystickVector.x);
    return;
  }

  if (pointer.active) {
    snake.targetAngle = angleTo({ x: canvas.width / 2, y: canvas.height / 2 }, pointer);
  }
}

function updateAi(snake, dt) {
  snake.thinkTimer -= dt;
  snake.boostTimer -= dt;

  if (snake.thinkTimer <= 0) {
    snake.thinkTimer = rand(0.25, 0.7);
    const danger = nearestDanger(snake);
    if (danger) {
      snake.targetAngle = angleTo(danger, snake);
      snake.boostTimer = 0.4;
      return;
    }

    snake.targetFood = nearestFood(snake);
    const smallerEnemy = snakes
      .filter((other) => other !== snake && other.alive && other.length < snake.length * 0.75)
      .sort((a, b) => distance(snake, a) - distance(snake, b))[0];

    if (smallerEnemy && distance(snake, smallerEnemy) < 260 && Math.random() > 0.45) {
      snake.targetAngle = angleTo(snake, smallerEnemy);
      snake.boostTimer = 0.5;
    } else if (snake.targetFood) {
      snake.targetAngle = angleTo(snake, snake.targetFood);
    } else {
      snake.targetAngle += rand(-0.8, 0.8);
    }
  }
}

function nearestFood(snake) {
  return foods
    .map((food) => ({ food, d: distance(snake, food) }))
    .sort((a, b) => a.d - b.d)[0]?.food;
}

function nearestDanger(snake) {
  for (const other of snakes) {
    if (other === snake || !other.alive) continue;
    for (let i = 8; i < other.segments.length; i += 3) {
      const seg = other.segments[i];
      if (distance(snake, seg) < snake.radius + other.radius + 10) return seg;
    }
  }
  return null;
}

function eatFood(snake) {
  for (let i = foods.length - 1; i >= 0; i -= 1) {
    const food = foods[i];
    if (Math.hypot(snake.x - food.x, snake.y - food.y) < snake.radius + food.radius + 2) {
      snake.length += food.value;
      snake.growth += food.value;
      burst(food.x, food.y, food.color, 7);
      foods.splice(i, 1);
      foods.push(createFood());
    }
  }
}

function checkCollisions() {
  snakes.forEach((snake) => {
    if (!snake.alive) return;

    for (const other of snakes) {
      if (!other.alive) continue;
      const start = other === snake ? 12 : 5;
      for (let i = start; i < other.segments.length; i += 2) {
        const seg = other.segments[i];
        if (Math.hypot(snake.x - seg.x, snake.y - seg.y) < snake.radius + other.radius * 0.72) {
          killSnake(snake, other);
          return;
        }
      }
    }
  });
}

function killSnake(victim, killer) {
  victim.alive = false;
  victim.segments.forEach((seg, index) => {
    if (index % 3 === 0) foods.push(createFood(seg.x, seg.y, Math.random() > 0.7 ? 2 : 1));
  });
  burst(victim.x, victim.y, victim.palette[0], 24);

  if (killer && killer !== victim) {
    killer.kills += 1;
    if (killer === player) kills += 1;
  }

  if (victim === player) {
    running = false;
    showOverlay("Game Over", "蛇蛇被撞散了", `最终长度 ${Math.floor(player.length)}，击败 ${kills} 条蛇。`, "再来一局");
  }
}

function respawnAi() {
  const livingAi = snakes.filter((snake) => snake.ai && snake.alive).length;
  if (livingAi >= AI_COUNT) return;

  for (let i = livingAi; i < AI_COUNT; i += 1) {
    snakes.push(createSnake(AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)], true, i + 1));
  }
}

function shedFood(snake) {
  const tail = snake.segments[snake.segments.length - 1] || snake;
  foods.push(createFood(tail.x + rand(-8, 8), tail.y + rand(-8, 8), 1));
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.35, 0.75),
      color,
      radius: rand(2, 5)
    });
  }
}

function updateParticles(dt) {
  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
      life: particle.life - dt
    }))
    .filter((particle) => particle.life > 0);
}

function updateCamera(dt) {
  if (!player) return;
  camera.x += (player.x - camera.x) * Math.min(1, dt * 6);
  camera.y += (player.y - camera.y) * Math.min(1, dt * 6);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArenaBackground();
  ctx.save();
  ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);
  drawWorldBounds();
  foods.forEach(drawFood);
  snakes.filter((snake) => snake.alive).sort((a, b) => a.length - b.length).forEach(drawSnake);
  particles.forEach(drawParticle);
  ctx.restore();
}

function drawArenaBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#a7e7ff");
  gradient.addColorStop(1, "#78cdf7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const offsetX = (-camera.x % 24) + canvas.width / 2;
  const offsetY = (-camera.y % 24) + canvas.height / 2;
  for (let x = offsetX - 24; x < canvas.width + 24; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = offsetY - 24; y < canvas.height + 24; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWorldBounds() {
  ctx.save();
  ctx.strokeStyle = "rgba(17,54,95,0.25)";
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
  ctx.restore();
}

function drawFood(food) {
  const pulse = Math.sin(performance.now() / 260 + food.pulse) * 1.2;
  ctx.save();
  ctx.fillStyle = food.color;
  ctx.shadowColor = food.color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(food.x, food.y, food.radius + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(food.x - food.radius * 0.32, food.y - food.radius * 0.32, food.radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnake(snake) {
  const [base, highlight] = snake.palette;
  for (let i = snake.segments.length - 1; i >= 0; i -= 1) {
    const seg = snake.segments[i];
    const ratio = i / Math.max(1, snake.segments.length - 1);
    const radius = snake.radius * (0.72 + (1 - ratio) * 0.28);
    ctx.save();
    ctx.fillStyle = i % 2 ? base : highlight;
    ctx.strokeStyle = "rgba(19, 70, 72, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawSnakeHead(snake);
}

function drawSnakeHead(snake) {
  const [base] = snake.palette;
  ctx.save();
  ctx.translate(snake.x, snake.y);
  ctx.rotate(snake.angle);
  ctx.fillStyle = base;
  ctx.strokeStyle = "rgba(17, 54, 95, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, snake.radius * 1.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(snake.radius * 0.42, -snake.radius * 0.42, snake.radius * 0.34, 0, Math.PI * 2);
  ctx.arc(snake.radius * 0.42, snake.radius * 0.42, snake.radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d3557";
  ctx.beginPath();
  ctx.arc(snake.radius * 0.54, -snake.radius * 0.42, snake.radius * 0.15, 0, Math.PI * 2);
  ctx.arc(snake.radius * 0.54, snake.radius * 0.42, snake.radius * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(17, 54, 95, 0.72)";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(snake.name, snake.x, snake.y - snake.radius - 14);
  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, particle.life);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updateHud() {
  if (!player) return;
  lengthEl.textContent = String(Math.floor(player.length));
  killsEl.textContent = String(kills);
  const sorted = snakes
    .filter((snake) => snake.alive)
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
  leaderboardEl.innerHTML = sorted
    .map((snake) => `<li><b>${snake.name}</b> · ${Math.floor(snake.length)}</li>`)
    .join("");
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

function loop(time = 0) {
  const delta = Math.min(48, time - lastTime || 16);
  lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

canvas.addEventListener("pointermove", (event) => {
  pointer = { ...canvasPoint(event), active: true };
});
canvas.addEventListener("pointerdown", (event) => {
  pointer = { ...canvasPoint(event), active: true };
  boosting = true;
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener("pointerup", () => {
  boosting = false;
});
canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
  boosting = false;
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    boosting = true;
  }
  if (event.key === "p" || event.key === "P") {
    paused = !paused;
    if (paused) showOverlay("Paused", "暂停中", "按 P 继续游戏。", "继续游戏");
    else hideOverlay();
  }
  if (event.key === "r" || event.key === "R") resetGame();
});
document.addEventListener("keyup", (event) => {
  if (event.code === "Space") boosting = false;
});

startButton.addEventListener("click", () => {
  if (paused) {
    paused = false;
    hideOverlay();
  } else {
    resetGame();
  }
});

boostButton.addEventListener("pointerdown", () => { boosting = true; });
boostButton.addEventListener("pointerup", () => { boosting = false; });
boostButton.addEventListener("pointerleave", () => { boosting = false; });

joystick.addEventListener("pointermove", handleJoystick);
joystick.addEventListener("pointerdown", (event) => {
  joystick.setPointerCapture?.(event.pointerId);
  handleJoystick(event);
});
joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

function handleJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const distanceFromCenter = Math.hypot(dx, dy) || 1;
  const max = Math.min(rect.width, rect.height) * 0.32;
  const scale = Math.min(1, max / distanceFromCenter);
  joystickVector = { x: dx / distanceFromCenter, y: dy / distanceFromCenter };
  joystickKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
}

function resetJoystick() {
  joystickVector = null;
  joystickKnob.style.transform = "translate(0, 0)";
}

window.addEventListener("resize", resizeCanvasForDisplay);
resizeCanvasForDisplay();
showOverlay("Ready", "准备进入竞技场", "鼠标移动控制方向，按住鼠标或空格加速。手机可用下方摇杆。", "开始游戏");
requestAnimationFrame(loop);
