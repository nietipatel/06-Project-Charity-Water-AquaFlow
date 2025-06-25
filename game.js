// game.js - Core game logic for AquaFlow
// Handles levels, UI, and game state

const LEVELS = [
  { grid: [4, 4], speed: 1200 },
  { grid: [5, 5], speed: 900 },
  { grid: [6, 6], speed: 700 },
  { grid: [7, 7], speed: 500 }
];

let currentLevel = 0;
let score = 0;
let intervalId = null;
let gameState = 'start'; // start, playing, gameover, win
let pipeGrid = [];
const PIPE_TYPES = [
  { symbol: '┃', connects: ['up', 'down'] },
  { symbol: '━', connects: ['left', 'right'] },
  { symbol: '┏', connects: ['down', 'right'] },
  { symbol: '┓', connects: ['down', 'left'] },
  { symbol: '┗', connects: ['up', 'right'] },
  { symbol: '┛', connects: ['up', 'left'] }
];
const COLLECTIBLE = '💧';
const OBSTACLE = '☠️';

export function showStartScreen() {
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <h1>AquaFlow</h1>
    <p>Guide the water through the pipes!<br>Don’t let it leak!</p>
    <button class="button" id="start-btn">Start Game</button>
    <p style="font-size:0.9em;">Inspired by charity: water</p>
  `;
  document.getElementById('start-btn').onclick = () => startGame(0);
}

export function startGame(levelIdx) {
  currentLevel = levelIdx;
  score = 0;
  gameState = 'playing';
  renderLevel();
  startWaterFlow();
}

function renderLevel() {
  const { grid } = LEVELS[currentLevel];
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <div id="level">Level ${currentLevel + 1}</div>
    <div id="score">Score: <span id="score-val">0</span></div>
    <div id="pipe-grid"></div>
    <div id="progress-bar"><div id="progress"></div></div>
    <div id="message"></div>
    <button class="button" id="pause-btn">Pause</button>
  `;
  renderPipeGrid(grid[0], grid[1]);
  document.getElementById('pause-btn').onclick = pauseGame;
}

function renderPipeGrid(rows, cols) {
  pipeGrid = [];
  const grid = document.getElementById('pipe-grid');
  grid.style.gridTemplateRows = `repeat(${rows}, 48px)`;
  grid.style.gridTemplateColumns = `repeat(${cols}, 48px)`;
  grid.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    pipeGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      let typeIdx = Math.floor(Math.random() * PIPE_TYPES.length);
      let cellType = 'pipe';
      let symbol = PIPE_TYPES[typeIdx].symbol;
      // Place collectibles and obstacles randomly (not on start/end)
      if (!(r === 0 && c === 0) && !(r === rows-1 && c === cols-1)) {
        const rand = Math.random();
        if (rand < 0.08) { symbol = COLLECTIBLE; cellType = 'collectible'; }
        else if (rand < 0.13) { symbol = OBSTACLE; cellType = 'obstacle'; }
      }
      const cell = document.createElement('div');
      cell.className = 'pipe-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.textContent = symbol;
      cell.onclick = () => rotatePipe(cell);
      grid.appendChild(cell);
      pipeGrid[r][c] = { typeIdx, symbol, cellType, rotation: 0 };
    }
  }
  // Set start and end
  grid.children[0].textContent = '🚰';
  pipeGrid[0][0] = { typeIdx: 1, symbol: '🚰', cellType: 'start', rotation: 0 };
  grid.children[grid.children.length - 1].textContent = '🏁';
  pipeGrid[rows-1][cols-1] = { typeIdx: 1, symbol: '🏁', cellType: 'end', rotation: 0 };
}

function rotatePipe(cell) {
  const r = +cell.dataset.row, c = +cell.dataset.col;
  if (pipeGrid[r][c].cellType !== 'pipe') return;
  pipeGrid[r][c].typeIdx = (pipeGrid[r][c].typeIdx + 1) % PIPE_TYPES.length;
  pipeGrid[r][c].symbol = PIPE_TYPES[pipeGrid[r][c].typeIdx].symbol;
  cell.textContent = pipeGrid[r][c].symbol;
}

function startWaterFlow() {
  const { speed } = LEVELS[currentLevel];
  let progress = 0;
  let collected = 0;
  intervalId = setInterval(() => {
    progress += 100 / 20;
    document.getElementById('progress').style.width = progress + '%';
    // Check if water can flow from start to end
    const result = canWaterFlow();
    if (!result.success) {
      clearInterval(intervalId);
      gameOver();
      return;
    }
    // Update score for collectibles
    if (result.collected > collected) {
      score += (result.collected - collected) * 10;
      document.getElementById('score-val').textContent = score;
      collected = result.collected;
    }
    if (progress >= 100) {
      clearInterval(intervalId);
      nextLevelOrWin();
    }
  }, speed);
}

function canWaterFlow() {
  // BFS from start to end, track collectibles and obstacles
  const rows = pipeGrid.length, cols = pipeGrid[0].length;
  let queue = [{ r: 0, c: 0, from: null }];
  let visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  let collected = 0;
  while (queue.length) {
    const { r, c, from } = queue.shift();
    if (visited[r][c]) continue;
    visited[r][c] = true;
    const cell = pipeGrid[r][c];
    if (cell.cellType === 'obstacle') return { success: false };
    if (cell.cellType === 'collectible') collected++;
    if (cell.cellType === 'end') return { success: true, collected };
    // Get possible directions from this pipe
    let connects = [];
    if (cell.cellType === 'pipe' || cell.cellType === 'start') {
      connects = PIPE_TYPES[cell.typeIdx].connects;
    }
    // For each direction, add neighbor if not visited
    for (const dir of connects) {
      let nr = r, nc = c, back = null;
      if (dir === 'up') { nr--; back = 'down'; }
      if (dir === 'down') { nr++; back = 'up'; }
      if (dir === 'left') { nc--; back = 'right'; }
      if (dir === 'right') { nc++; back = 'left'; }
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        // Check if neighbor connects back
        const neighbor = pipeGrid[nr][nc];
        let neighborConnects = [];
        if (neighbor.cellType === 'pipe' || neighbor.cellType === 'end') {
          neighborConnects = PIPE_TYPES[neighbor.typeIdx].connects;
        }
        if (neighborConnects.includes(back) || neighbor.cellType === 'end') {
          queue.push({ r: nr, c: nc, from: dir });
        }
      }
    }
  }
  return { success: false };
}

function pauseGame() {
  if (intervalId) clearInterval(intervalId);
  document.getElementById('message').textContent = 'Paused. Click Start to resume.';
  document.getElementById('pause-btn').onclick = () => startGame(currentLevel);
}

function nextLevelOrWin() {
  if (currentLevel < LEVELS.length - 1) {
    showLevelComplete();
  } else {
    showWinScreen();
  }
}

function showLevelComplete() {
  gameState = 'levelcomplete';
  const container = document.getElementById('game-container');
  container.innerHTML += `
    <div id="message">Level Complete!</div>
    <button class="button" id="next-level-btn">Next Level</button>
  `;
  document.getElementById('next-level-btn').onclick = () => startGame(currentLevel + 1);
}

function showWinScreen() {
  gameState = 'win';
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <h2>You Win!</h2>
    <div>Your Score: ${score}</div>
    <div>Did you know? 1 in 10 people lack access to clean water.</div>
    <button class="button" id="restart-btn">Restart</button>
  `;
  document.getElementById('restart-btn').onclick = () => showStartScreen();
}

function gameOver() {
  gameState = 'gameover';
  if (intervalId) clearInterval(intervalId);
  const container = document.getElementById('game-container');
  container.innerHTML += `
    <div id="message">Game Over! Water was lost.</div>
    <button class="button" id="retry-btn">Retry Level</button>
  `;
  document.getElementById('retry-btn').onclick = () => startGame(currentLevel);
}
