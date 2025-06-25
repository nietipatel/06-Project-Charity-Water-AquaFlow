// main.js - AquaFlow charity: water game
// All logic merged here for compatibility with direct file opening

// --- Game Logic ---
const LEVELS = [
  { grid: [4, 4], speed: 1000 }, // 20s for 20 ticks (1000ms * 20 = 20,000ms)
  { grid: [5, 5], speed: 1000 },
  { grid: [6, 6], speed: 1000 },
  { grid: [7, 7], speed: 1000 }
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
  { symbol: '┛', connects: ['up', 'left'] },
  { symbol: '╸', connects: ['left'] },  // cap right
  { symbol: '╹', connects: ['up'] },    // cap down
  { symbol: '╺', connects: ['right'] }, // cap left
  { symbol: '╻', connects: ['down'] }   // cap up
];

// Helper to rotate pipe connections
function rotateConnects(connects, rotation) {
  const dirOrder = ['up', 'right', 'down', 'left'];
  return connects.map(dir => {
    let idx = dirOrder.indexOf(dir);
    return dirOrder[(idx + rotation / 90) % 4];
  });
}

const COLLECTIBLE = '💧';
const OBSTACLE = '☠️';
let isMuted = false;
let isPaused = false;

function showStartScreen() {
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <header style="display:flex;align-items:center;gap:18px;justify-content:center;margin-bottom:12px;">
      <img id="charitywater-logo" src="https://d11sa1anfvm2xk.cloudfront.net/media/downloads/logos/cw_vertical_white.jpg" alt="charity: water logo" style="height:72px;width:auto;vertical-align:middle;" />
      <span style="font-size:2em;font-weight:bold;vertical-align:middle;color:#0099e5;text-shadow:0 2px 12px #b3e6ff;letter-spacing:2.5px;">AquaFlow: The Water Pipe Challenge</span>
    </header>
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:1.35em;font-weight:bold;color:#0077b6;margin-bottom:18px;">Guide the water through the pipes!<br>Don’t let it leak!</div>
      <div style="display:flex;justify-content:center;margin-bottom:18px;">
        <a class="info-link" href="https://www.charitywater.org/" target="_blank" style="background:#0099e5;color:#fff;padding:8px 18px;border-radius:8px;font-size:1.1em;text-decoration:none;box-shadow:0 2px 8px #b3e6ff;">Learn about charity: water</a>
      </div>
      <button class="button" id="start-btn" style="margin-bottom:10px;">Start Game</button>
      <p style="font-size:0.9em;">Inspired by charity: water</p>
    </div>
  `;
  setTimeout(() => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.onclick = () => startGame(0);
  }, 0);
}

function startGame(levelIdx) {
  currentLevel = levelIdx;
  score = 0;
  gameState = 'playing';
  renderLevel();
  startWaterFlow();
}

function renderLevel() {
  // Always generate a random maze for every level
  const { grid } = LEVELS[currentLevel];
  LEVEL_LAYOUTS[currentLevel] = createRandomLevelLayout(grid[0], grid[1]);
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <header style="display:flex;align-items:center;gap:18px;justify-content:center;margin-bottom:12px;">
      <img id="charitywater-logo" src="https://d11sa1anfvm2xk.cloudfront.net/media/downloads/logos/cw_vertical_white.jpg" alt="charity: water logo" style="height:72px;width:auto;vertical-align:middle;" />
      <span style="font-size:1.7em;font-weight:bold;vertical-align:middle;color:#0099e5;text-shadow:0 2px 8px #b3e6ff;letter-spacing:2px;">AquaFlow: The Water Pipe Challenge</span>
      <a class="info-link" href="https://www.charitywater.org/" target="_blank" style="margin-left:auto;font-size:0.9em;">charity: water</a>
    </header>
    <div style="display:flex;align-items:flex-start;gap:24px;">
      <div style="flex:1;">
        <div id="level">Level ${currentLevel + 1}</div>
        <div id="pipe-grid"></div>
      </div>
      <div id="timer" style="min-width:110px;font-size:1.3em;font-weight:bold;color:#0077b6;background:#e6f7ff;padding:8px 18px;border-radius:8px;z-index:10;margin-top:8px;">Time: <span id='timer-val'></span>s</div>
    </div>
    <div id="message"></div>
    <button class="button" id="pause-btn" type="button">Pause</button>
    <button class="button" id="next-level-btn" type="button">Next Level</button>
  `;
  // Reset timer/progress bar
  const progressBar = document.getElementById('progress');
  if (progressBar) progressBar.style.width = '0%';
  renderPipeGrid(grid[0], grid[1]);
  document.getElementById('pause-btn').onclick = pauseGame;
  const nextBtn = document.getElementById('next-level-btn');
  nextBtn.onclick = () => {
    if (currentLevel < LEVELS.length - 1) {
      currentLevel++;
      renderLevel();
      startWaterFlow();
    } else {
      showWinScreen();
    }
  };
  showRestartButton();
  updateNextLevelButton();
  startLevelTimer();
}

let timerInterval = null;
function startLevelTimer() {
  if (timerInterval) clearInterval(timerInterval);
  let secondsLeft = 30;
  const timerVal = document.getElementById('timer-val');
  if (timerVal) timerVal.textContent = secondsLeft;
  timerInterval = setInterval(() => {
    secondsLeft--;
    if (timerVal) timerVal.textContent = secondsLeft;
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      // If not solved, show loss popup
      if (document.getElementById('next-level-btn').disabled) showTimeoutLossPopup();
    }
  }, 1000);
}

function showTimeoutLossPopup() {
  // Remove any existing popup
  let old = document.getElementById('timeout-loss-popup');
  if (old) old.remove();
  // Dim background
  let dim = document.createElement('div');
  dim.id = 'timeout-loss-popup';
  dim.style.position = 'fixed';
  dim.style.top = 0;
  dim.style.left = 0;
  dim.style.width = '100vw';
  dim.style.height = '100vh';
  dim.style.background = 'rgba(0,0,0,0.75)';
  dim.style.display = 'flex';
  dim.style.flexDirection = 'column';
  dim.style.justifyContent = 'center';
  dim.style.alignItems = 'center';
  dim.style.zIndex = 3000;
  dim.innerHTML = `
    <div style="background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 4px 24px #0003;text-align:center;max-width:90vw;">
      <div style="font-size:1.5em;font-weight:bold;">You Lost. Try Again!</div>
      <button class="button" id="timeout-restart-btn" style="margin-top:18px;">Restart</button>
    </div>
  `;
  document.body.appendChild(dim);
  document.getElementById('timeout-restart-btn').onclick = () => {
    dim.remove();
    renderLevel();
  };
}

function renderPipeGrid(rows, cols) {
  pipeGrid = [];
  const grid = document.getElementById('pipe-grid');
  grid.style.gridTemplateRows = `repeat(${rows}, 48px)`;
  grid.style.gridTemplateColumns = `repeat(${cols}, 48px)`;
  grid.innerHTML = '';
  const layout = LEVEL_LAYOUTS[currentLevel];
  for (let r = 0; r < rows; r++) {
    pipeGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      let cellType = 'pipe';
      let typeIdx = 0;
      let rotation = 0;
      let symbol = PIPE_TYPES[typeIdx].symbol;
      if (layout && layout[r] && layout[r][c] !== undefined && layout[r][c] !== null) {
        if (layout[r][c] === 'start') {
          symbol = '🚰';
          cellType = 'start';
          typeIdx = 1;
          rotation = 0;
        } else if (layout[r][c] === 'end') {
          symbol = '🏁';
          cellType = 'end';
          typeIdx = 1;
          rotation = 0;
        } else if (layout[r][c] === 'obstacle') {
          symbol = OBSTACLE;
          cellType = 'obstacle';
          typeIdx = null;
          rotation = 0;
        } else if (Array.isArray(layout[r][c])) {
          typeIdx = layout[r][c][0];
          rotation = layout[r][c][1];
          symbol = PIPE_TYPES[typeIdx].symbol;
        } else {
          typeIdx = layout[r][c];
          symbol = PIPE_TYPES[typeIdx].symbol;
          if (currentLevel >= 1) {
            let wrongRotations = [0, 90, 180, 270].filter(rot => rot !== 0);
            rotation = wrongRotations[Math.floor(Math.random() * wrongRotations.length)];
          } else {
            rotation = Math.floor(Math.random() * 4) * 90;
          }
        }
      } else {
        // Fill with a random normal pipe (not a cap), but do not connect to any adjacent path cell
        // Find which directions are adjacent to the path
        const adjacentDirs = [];
        if (r > 0 && layout[r-1][c] !== null && layout[r-1][c] !== undefined && layout[r-1][c] !== 'obstacle') adjacentDirs.push('up');
        if (r < rows - 1 && layout[r+1][c] !== null && layout[r+1][c] !== undefined && layout[r+1][c] !== 'obstacle') adjacentDirs.push('down');
        if (c > 0 && layout[r][c-1] !== null && layout[r][c-1] !== undefined && layout[r][c-1] !== 'obstacle') adjacentDirs.push('left');
        if (c < cols - 1 && layout[r][c+1] !== null && layout[r][c+1] !== undefined && layout[r][c+1] !== 'obstacle') adjacentDirs.push('right');
        let possible = [];
        for (let typeIdx = 0; typeIdx < 6; typeIdx++) { // 0-5: normal pipes
          for (let rot = 0; rot < 4; rot++) {
            const connects = rotateConnects(PIPE_TYPES[typeIdx].connects, rot * 90);
            if (!connects.some(dir => adjacentDirs.includes(dir))) {
              possible.push([typeIdx, rot * 90]);
            }
          }
        }
        if (possible.length === 0) {
          // fallback: random cap
          const capIdx = 6 + Math.floor(Math.random() * 4);
          typeIdx = capIdx;
          symbol = PIPE_TYPES[typeIdx].symbol;
          cellType = 'pipe';
          rotation = 0;
        } else {
          const [chosenType, chosenRot] = possible[Math.floor(Math.random() * possible.length)];
          typeIdx = chosenType;
          symbol = PIPE_TYPES[typeIdx].symbol;
          cellType = 'pipe';
          rotation = chosenRot;
        }
      }
      const cell = document.createElement('div');
      cell.className = 'pipe-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.textContent = symbol;
      cell.style.transform = `rotate(${rotation}deg)`;
      cell.onclick = () => rotatePipe(cell);
      grid.appendChild(cell);
      pipeGrid[r][c] = { typeIdx, symbol, cellType, rotation };
    }
  }
}

function rotatePipe(cell) {
  const r = +cell.dataset.row, c = +cell.dataset.col;
  // Allow all cells (including obstacles) to rotate
  if (pipeGrid[r][c].cellType === 'start' || pipeGrid[r][c].cellType === 'end') return;
  pipeGrid[r][c].rotation = (pipeGrid[r][c].rotation + 90) % 360;
  cell.style.transform = `rotate(${pipeGrid[r][c].rotation}deg)`;
  updateNextLevelButton();
}

function updateNextLevelButton() {
  const nextBtn = document.getElementById('next-level-btn');
  const msg = document.getElementById('message');
  document.querySelectorAll('.path-correct, .path-incorrect').forEach(cell => {
    cell.classList.remove('path-correct', 'path-incorrect');
  });
  const rows = pipeGrid.length, cols = pipeGrid[0].length;
  let queue = [{ r: 0, c: 0, from: null, path: [] }];
  let visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  let found = false;
  let lastPath = [];
  while (queue.length) {
    const { r, c, from, path } = queue.shift();
    if (visited[r][c]) continue;
    visited[r][c] = true;
    const cell = pipeGrid[r][c];
    const newPath = [...path, { r, c }];
    if (cell.cellType === 'obstacle' || cell.cellType === 'empty') continue;
    if (cell.cellType === 'end') {
      found = true;
      lastPath = newPath;
      break;
    }
    let connects = [];
    if (cell.cellType === 'pipe' || cell.cellType === 'start') {
      connects = rotateConnects(PIPE_TYPES[cell.typeIdx].connects, cell.rotation);
    }
    for (const dir of connects) {
      let nr = r, nc = c, back = null;
      if (dir === 'up') { nr--; back = 'down'; }
      if (dir === 'down') { nr++; back = 'up'; }
      if (dir === 'left') { nc--; back = 'right'; }
      if (dir === 'right') { nc++; back = 'left'; }
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        const neighbor = pipeGrid[nr][nc];
        let neighborConnects = [];
        if (neighbor.cellType === 'pipe' || neighbor.cellType === 'end') {
          neighborConnects = rotateConnects(PIPE_TYPES[neighbor.typeIdx].connects, neighbor.rotation);
        }
        if (neighborConnects.includes(back) || neighbor.cellType === 'end') {
          queue.push({ r: nr, c: nc, from: dir, path: newPath });
        }
      }
    }
  }
  if (found) {
    nextBtn.disabled = false;
    msg.textContent = 'Correct! You can go to the next level.';
    showLevelPopup();
    lastPath.forEach(({ r, c }) => {
      const domCell = document.querySelector(`.pipe-cell[data-row='${r}'][data-col='${c}']`);
      if (domCell) domCell.classList.add('path-correct');
    });
  } else {
    nextBtn.disabled = true;
    msg.textContent = 'Arrange the pipes to complete the path.';
    if (lastPath.length) {
      lastPath.forEach(({ r, c }) => {
        const domCell = document.querySelector(`.pipe-cell[data-row='${r}'][data-col='${c}']`);
        if (domCell) domCell.classList.add('path-incorrect');
      });
    }
  }
  // Highlight all connected pipes, even if not the correct path
  if (lastPath.length) {
    lastPath.forEach(({ r, c }) => {
      const domCell = document.querySelector(`.pipe-cell[data-row='${r}'][data-col='${c}']`);
      if (domCell && !domCell.classList.contains('path-correct')) {
        domCell.classList.add('path-incorrect');
      }
    });
  }
}

function testPath() {
  const result = canWaterFlowWithEffects();
  const msg = document.getElementById('message');
  const testBtn = document.getElementById('test-path-btn');
  let nextBtn = document.getElementById('next-level-btn');
  if (result.success) {
    msg.textContent = 'Correct! Click Next Level to continue.';
    if (intervalId) clearInterval(intervalId);
    if (testBtn) testBtn.style.display = 'none';
    if (!nextBtn) {
      nextBtn = document.createElement('button');
      nextBtn.className = 'button';
      nextBtn.id = 'next-level-btn';
      nextBtn.textContent = (currentLevel < LEVELS.length - 1) ? 'Next Level' : 'Finish';
      nextBtn.onclick = () => {
        if (currentLevel < LEVELS.length - 1) {
          currentLevel++;
          renderLevel();
          startWaterFlow();
        } else {
          showWinScreen();
        }
      };
      msg.parentNode.appendChild(nextBtn);
    } else {
      nextBtn.style.display = '';
    }
  } else {
    msg.textContent = 'Path is not complete. Try again!';
    if (nextBtn) nextBtn.style.display = 'none';
  }
}

function startWaterFlow() {
  const { speed } = LEVELS[currentLevel];
  let progress = 0;
  let collected = 0;
  intervalId = setInterval(() => {
    progress += 100 / 20;
    document.getElementById('progress').style.width = progress + '%';
    highlightWaterPath();
    // Check if water can flow from start to end and animate collectibles/obstacles
    const result = canWaterFlowWithEffects();
    if (result.success) {
      clearInterval(intervalId);
      setTimeout(() => nextLevelOrWin(), 600);
      return;
    }
    if (!result.success) {
      clearInterval(intervalId);
      const grid = document.getElementById('pipe-grid');
      grid.classList.add('grid-shake');
      setTimeout(() => grid.classList.remove('grid-shake'), 400);
      gameOver();
      return;
    }
    if (result.collected > collected) {
      score += (result.collected - collected) * 10;
      document.getElementById('score-val').textContent = score;
      collected = result.collected;
      showMilestone(score);
    }
    if (progress >= 100) {
      clearInterval(intervalId);
      // If not solved, show timeout game over
      const solved = canWaterFlowWithEffects().success;
      if (!solved) {
        showLevelPopup('timeout');
        setTimeout(() => gameOver(true), 2500);
      } else {
        nextLevelOrWin();
      }
    }
  }, speed);
}

// --- Water facts for game over/win ---
const WATER_FACTS = [
  "1 in 10 people lack access to clean water.",
  "Women and girls spend 200 million hours every day collecting water.",
  "Every $1 invested in clean water can yield $4–$12 in economic returns.",
  "Unsafe water kills more people each year than all forms of violence, including war.",
  "Access to clean water can improve education, health, and income.",
  "More people have a mobile phone than a toilet.",
  "Clean water reduces water-borne diseases by up to 50%."
];

function getRandomFact() {
  return WATER_FACTS[Math.floor(Math.random() * WATER_FACTS.length)];
}

// --- Milestone feedback ---
function showMilestone(score) {
  const msg = document.getElementById('message');
  if (!msg) return;
  if (score >= 100 && score < 110) msg.textContent = 'Milestone: 100 points!';
  else if (score >= 200 && score < 210) msg.textContent = 'Milestone: 200 points!';
  else if (score >= 300 && score < 310) msg.textContent = 'Milestone: 300 points!';
  else msg.textContent = '';
}

// --- Animated water droplet on path ---
function highlightWaterPath() {
  document.querySelectorAll('.active-pipe').forEach(cell => cell.classList.remove('active-pipe', 'droplet'));
  document.querySelectorAll('.solution-path').forEach(cell => cell.classList.remove('solution-path'));
  const rows = pipeGrid.length, cols = pipeGrid[0].length;
  let queue = [{ r: 0, c: 0, from: null, path: [] }];
  let visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  let solutionPath = [];
  while (queue.length) {
    const { r, c, from, path } = queue.shift();
    if (visited[r][c]) continue;
    visited[r][c] = true;
    const cell = pipeGrid[r][c];
    const newPath = [...path, { r, c }];
    if (cell.cellType === 'obstacle' || cell.cellType === 'empty') return;
    if (cell.cellType === 'end') {
      solutionPath = newPath;
      newPath.forEach(({ r, c }) => {
        const domCell = document.querySelector(`.pipe-cell[data-row='${r}'][data-col='${c}']`);
        if (domCell) {
          domCell.classList.add('active-pipe');
        }
      });
      break;
    }
    let connects = [];
    if (cell.cellType === 'pipe' || cell.cellType === 'start') {
      connects = rotateConnects(PIPE_TYPES[cell.typeIdx].connects, cell.rotation);
    }
    for (const dir of connects) {
      let nr = r, nc = c, back = null;
      if (dir === 'up') { nr--; back = 'down'; }
      if (dir === 'down') { nr++; back = 'up'; }
      if (dir === 'left') { nc--; back = 'right'; }
      if (dir === 'right') { nc++; back = 'left'; }
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        const neighbor = pipeGrid[nr][nc];
        let neighborConnects = [];
        if (neighbor.cellType === 'pipe' || neighbor.cellType === 'end') {
          neighborConnects = rotateConnects(PIPE_TYPES[neighbor.typeIdx].connects, neighbor.rotation);
        }
        if (neighborConnects.includes(back) || neighbor.cellType === 'end') {
          queue.push({ r: nr, c: nc, from: dir, path: newPath });
        }
      }
    }
  }
  if (solutionPath.length) {
    solutionPath.forEach(({ r, c }) => {
      const domCell = document.querySelector(`.pipe-cell[data-row='${r}'][data-col='${c}']`);
      if (domCell) domCell.classList.add('solution-path');
    });
  }
}

// --- Share button logic ---
function addShareButton(container) {
  const shareBtn = document.createElement('button');
  shareBtn.className = 'button';
  shareBtn.textContent = 'Share';
  shareBtn.onclick = () => {
    const shareText = 'Try AquaFlow and learn about clean water! https://www.charitywater.org/';
    if (navigator.share) {
      navigator.share({ title: 'AquaFlow', text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Share link copied to clipboard!');
    }
  };
  container.appendChild(shareBtn);
}

// --- Update showWinScreen and gameOver to use random fact and share button ---
function showWinScreen() {
  gameState = 'win';
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <header>
      <img id="charitywater-logo" src="https://d11sa1anfvm2xk.cloudfront.net/media/downloads/logos/cw_vertical_white.jpg" alt="charity: water logo" style="height:48px;width:auto;vertical-align:middle;" />
      <span style="font-size:1.2em;font-weight:bold;vertical-align:middle;">AquaFlow</span>
      <a class="info-link" href="https://www.charitywater.org/" target="_blank" style="float:right;font-size:0.9em;">charity: water</a>
    </header>
    <h2>You Win!</h2>
    <div>Your Score: ${score}</div>
    <div style="margin:12px 0;">Did you know? ${getRandomFact()}</div>
    <button class="button" id="restart-btn">Restart</button>
  `;
  addShareButton(container);
  document.getElementById('restart-btn').onclick = () => showStartScreen();
  setupUI();
}

function gameOver(isTimeout = false) {
  gameState = 'gameover';
  if (intervalId) clearInterval(intervalId);
  // Create a modal overlay
  let modal = document.createElement('div');
  modal.id = 'gameover-modal';
  modal.style.position = 'fixed';
  modal.style.top = 0;
  modal.style.left = 0;
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.6)';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = 1000;
  let scoreText = `Score: ${currentLevel}/${LEVELS.length}`;
  modal.innerHTML = `
    <div style="background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 4px 24px #0003;text-align:center;max-width:90vw;">
      <div id="message" style="font-size:1.5em;font-weight:bold;">You lost!</div>
      <div style="margin:12px 0;">${isTimeout ? 'Time ran out!' : 'Water was lost.'}</div>
      <div style="margin:12px 0;">${scoreText}</div>
      <div style="margin:12px 0;">Did you know? ${getRandomFact()}</div>
      <button class="button" id="restart-btn">Restart</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('restart-btn').onclick = () => {
    modal.remove();
    showStartScreen();
  };
  setupUI();
}

function pauseGame() {
  const pauseBtn = document.getElementById('pause-btn');
  if (!isPaused) {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      document.getElementById('message').textContent = 'Paused. Click Unpause to continue.';
    }
    isPaused = true;
    if (pauseBtn) pauseBtn.textContent = 'Unpause';
  } else {
    startWaterFlow();
    document.getElementById('message').textContent = '';
    isPaused = false;
    if (pauseBtn) pauseBtn.textContent = 'Pause';
  }
}

// --- Ensure mute button works on all screens ---
function setupUI() {
  // Mute button
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.onclick = () => {
      isMuted = !isMuted;
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
    };
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
  }
  // Pause button
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) pauseBtn.onclick = pauseGame;
  // Test Path button
  const testBtn = document.getElementById('test-path-btn');
  if (testBtn) testBtn.onclick = testPath;
  // Start button
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.onclick = () => startGame(0);
  // Next Level button
  const nextBtn = document.getElementById('next-level-btn');
  if (nextBtn) nextBtn.onclick = () => startGame(currentLevel + 1);
  // Retry button
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) retryBtn.onclick = () => startGame(currentLevel);
  // Restart button
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.onclick = () => showStartScreen();
}

function showRestartButton() {
  let btn = document.getElementById('restart-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'button';
    btn.id = 'restart-btn';
    btn.textContent = 'Restart';
    btn.style.marginTop = '8px';
    btn.onclick = () => showStartScreen();
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn && pauseBtn.parentNode) {
      pauseBtn.parentNode.insertBefore(btn, pauseBtn.nextSibling);
    }
  }
}

// Patch all UI renders to call setupUI after rendering
const _renderLevel = renderLevel;
renderLevel = function() { _renderLevel.apply(this, arguments); setupUI(); };
const _showStartScreen = showStartScreen;
showStartScreen = function() { _showStartScreen.apply(this, arguments); setupUI(); };
const _showWinScreen = showWinScreen;
showWinScreen = function() { _showWinScreen.apply(this, arguments); setupUI(); };
const _gameOver = gameOver;
gameOver = function() { _gameOver.apply(this, arguments); setupUI(); };

document.addEventListener('DOMContentLoaded', () => {
  showStartScreen();
  setupUI();
});

// --- Predefined level layouts for unique solutions ---
const LEVEL_LAYOUTS = [
  // Level 1: 4x4 (zig-zag, last pipe turns down to end)
  [
    ['start', [1,0], [3,0], null],
    [null, null, [0,0], null],
    [null, null, [4,0], [2,0]],
    [null, null, null, 'end']
  ],
  // Level 2: 5x5 (continuous, exactly 4 turns, (2,4) turns down, (3,4) is vertical)
  [
    ['start', [1,0], [1,0], [3,0], null],
    [null, null, null, [0,0], null],
    [null, null, null, [4,0], [3,0]],
    [null, null, null, null, [0,0]],
    [null, null, null, null, 'end']
  ],
  // Level 3: 6x6 (precise snake with correct turns)
  [
    ['start', [1,0], [1,0], [1,0], [1,0], [3,0]],
    [null, null, null, null, null, [0,0]],
    [[5,0], [1,0], [1,0], [1,0], [1,0], [2,0]],
    [[0,0], null, null, null, null, null],
    [[4,0], [1,0], [1,0], [1,0], [1,0], [4,0]],
    [null, null, null, null, null, 'end']
  ],
  // Level 4: 7x7 (complex snake, end-to-end)
  [
    ['start', [1,0], [1,0], [1,0], [1,0], [1,0], [3,0]],
    [[0,0], null, null, null, null, null, [0,0]],
    [[4,0], [1,0], [1,0], [1,0], [1,0], [1,0], [2,0]],
    [[0,0], null, null, null, null, null, [0,0]],
    [[4,0], [1,0], [1,0], [1,0], [1,0], [1,0], [3,0]],
    [[0,0], null, null, null, null, null, [0,0]],
    [[4,0], [1,0], [1,0], [1,0], [1,0], [1,0], 'end']
  ]
];

function showLevelPopup(type) {
  // Remove any existing popup
  let old = document.getElementById('level-popup');
  if (old) old.remove();
  const popup = document.createElement('div');
  popup.id = 'level-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = 'rgba(255,255,255,0.97)';
  popup.style.border = '2px solid #00aaff';
  popup.style.borderRadius = '16px';
  popup.style.padding = '32px 40px';
  popup.style.fontSize = '1.5em';
  popup.style.fontWeight = 'bold';
  popup.style.color = '#0077b6';
  popup.style.boxShadow = '0 4px 32px rgba(0,0,0,0.18)';
  popup.style.zIndex = 2000;
  if (type === 'timeout') {
    popup.textContent = 'You Lost!';
  } else if (currentLevel < LEVELS.length - 1) {
    popup.textContent = 'Correct! Now hit next level to continue!';
  } else {
    popup.textContent = 'Congrats you have completed 4/4 levels!';
  }
  document.body.appendChild(popup);
  // Always show for 2.5s, even if level changes
  setTimeout(() => { if (popup.parentNode) popup.remove(); }, 2500);
}

function generateRandomPath(rows, cols) {
  const path = [];
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  let found = false;

  function dfs(r, c) {
    if (found) return;
    path.push([r, c]);
    visited[r][c] = true;
    if (r === rows - 1 && c === cols - 1) {
      found = true;
      return;
    }
    // Shuffle directions for randomness
    const directions = [
      [0, 1],  // right
      [1, 0],  // down
      [0, -1], // left
      [-1, 0], // up
    ].sort(() => Math.random() - 0.5);

    for (const [dr, dc] of directions) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < rows &&
        nc >= 0 && nc < cols &&
        !visited[nr][nc]
      ) {
        dfs(nr, nc);
        if (found) return;
      }
    }
    if (!found) path.pop();
  }

  dfs(0, 0); // Start from top-left
  return path; // Array of [row, col] pairs
}

function createRandomLevelLayout(rows, cols) {
  const path = generateMazePath(rows, cols); // <--- use maze path!
  const layout = Array.from({ length: rows }, () => Array(cols).fill(null));
  layout[0][0] = 'start';
  layout[rows - 1][cols - 1] = 'end';

  // Helper to get direction between two points
  function getDir([r1, c1], [r2, c2]) {
    if (r2 === r1 && c2 === c1 + 1) return 'right';
    if (r2 === r1 && c2 === c1 - 1) return 'left';
    if (r2 === r1 + 1 && c2 === c1) return 'down';
    if (r2 === r1 - 1 && c2 === c1) return 'up';
    return null;
  }

  // Mark path with correct pipes
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    const from = getDir(curr, prev);
    const to = getDir(curr, next);

    let typeIdx, rotation;
    if ((from === 'left' && to === 'right') || (from === 'right' && to === 'left')) {
      typeIdx = 1; rotation = 0; // ━
    } else if ((from === 'up' && to === 'down') || (from === 'down' && to === 'up')) {
      typeIdx = 0; rotation = 0; // ┃
    } else {
      // It's a turn
      if ((from === 'up' && to === 'right') || (from === 'right' && to === 'up')) {
        typeIdx = 2; rotation = 0; // ┏
      } else if ((from === 'up' && to === 'left') || (from === 'left' && to === 'up')) {
        typeIdx = 3; rotation = 0; // ┓
      } else if ((from === 'down' && to === 'right') || (from === 'right' && to === 'down')) {
        typeIdx = 4; rotation = 0; // ┗
      } else if ((from === 'down' && to === 'left') || (from === 'left' && to === 'down')) {
        typeIdx = 5; rotation = 0; // ┛
      }
    }
    layout[curr[0]][curr[1]] = [typeIdx, rotation];
  }

  // Helper to check if a cell is part of the path
  function isPathCell(r, c) {
    if (r === 0 && c === 0) return true;
    if (r === rows - 1 && c === cols - 1) return true;
    return path.some(([pr, pc]) => pr === r && pc === c);
  }

  // --- Place up to 3 obstacles ---
  let nonPathCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isPathCell(r, c)) nonPathCells.push([r, c]);
    }
  }
  // Shuffle and pick up to 3
  nonPathCells = nonPathCells.sort(() => Math.random() - 0.5);
  const obstacles = nonPathCells.slice(0, 3);

  for (const [r, c] of obstacles) {
    layout[r][c] = 'obstacle';
  }

  // Optionally, sprinkle a few random decoy pipes (not connecting to path)
  for (let i = 0; i < Math.floor(rows * cols * 0.2); i++) {
    const [r, c] = nonPathCells[3 + i] || [];
    if (r !== undefined && layout[r][c] === null) {
      // Use a random pipe type and rotation
      const typeIdx = Math.floor(Math.random() * 6); // 0-5: normal pipes
      const rotation = Math.floor(Math.random() * 4) * 90;
      layout[r][c] = [typeIdx, rotation];
    }
  }

  // All other cells remain null (empty)

  return layout;
}

function createUniqueRandomLevelLayout(rows, cols, maxTries = 20) {
  for (let i = 0; i < maxTries; i++) {
    const layout = createRandomLevelLayout(rows, cols);
    if (hasExactlyOneSolution(layout)) return layout;
  }
  // Fallback: just use the last attempt
  return createRandomLevelLayout(rows, cols);
}

// You'd need to implement hasExactlyOneSolution(layout) to check for uniqueness

function generateMazePath(rows, cols) {
  // Each cell: {visited, parent}
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));
  const stack = [[0, 0]];
  visited[0][0] = true;

  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    if (r === rows - 1 && c === cols - 1) break; // reached end

    // Find unvisited neighbors
    const neighbors = [];
    if (r > 0 && !visited[r - 1][c]) neighbors.push([r - 1, c]);
    if (r < rows - 1 && !visited[r + 1][c]) neighbors.push([r + 1, c]);
    if (c > 0 && !visited[r][c - 1]) neighbors.push([r, c - 1]);
    if (c < cols - 1 && !visited[r][c + 1]) neighbors.push([r, c + 1]);

    if (neighbors.length) {
      const [nr, nc] = neighbors[Math.floor(Math.random() * neighbors.length)];
      parent[nr][nc] = [r, c];
      visited[nr][nc] = true;
      stack.push([nr, nc]);
    } else {
      stack.pop();
    }
  }

  // Reconstruct path from end to start
  let path = [];
  let curr = [rows - 1, cols - 1];
  while (curr) {
    path.push(curr);
    curr = parent[curr[0]][curr[1]];
  }
  return path.reverse();
}
